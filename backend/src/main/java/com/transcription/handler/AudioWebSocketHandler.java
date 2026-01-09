package com.transcription.handler;

import com.transcription.model.AudioChunk;
import com.transcription.model.Session;
import com.transcription.model.TranscriptionUpdate;
import com.transcription.service.AudioChunkProcessor;
import com.transcription.service.SessionManager;
import com.transcription.service.TranscriptionStreamingService;
import com.transcription.service.TranscriptionStreamingServiceImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.socket.WebSocketHandler;
import org.springframework.web.reactive.socket.WebSocketMessage;
import org.springframework.web.reactive.socket.WebSocketSession;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import jakarta.annotation.PostConstruct;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket handler for real-time audio streaming and transcription.
 * Handles binary audio chunk messages and routes them to AudioChunkProcessor.
 * Streams transcription updates back to clients.
 * 
 * Requirements: 7.1, 7.2, 7.3, 8.6
 */
@Component
public class AudioWebSocketHandler implements WebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(AudioWebSocketHandler.class);

    private final AudioChunkProcessor audioChunkProcessor;
    private final SessionManager sessionManager;
    private final TranscriptionStreamingService transcriptionStreamingService;
    private final Map<String, Sinks.Many<TranscriptionUpdate>> sessionSinks = new ConcurrentHashMap<>();
    private final Map<String, Sinks.Many<byte[]>> audioSinks = new ConcurrentHashMap<>();

    public AudioWebSocketHandler(
            AudioChunkProcessor audioChunkProcessor,
            SessionManager sessionManager,
            TranscriptionStreamingService transcriptionStreamingService) {
        this.audioChunkProcessor = audioChunkProcessor;
        this.sessionManager = sessionManager;
        this.transcriptionStreamingService = transcriptionStreamingService;
    }

    @PostConstruct
    public void init() {
        // Set up callback for transcription updates
        if (transcriptionStreamingService instanceof TranscriptionStreamingServiceImpl impl) {
            impl.setUpdateCallback(this::broadcastToSession);
        }
    }

    @Override
    public Mono<Void> handle(WebSocketSession session) {
        String sessionId = session.getId();
        log.info("WebSocket connection established: {}", sessionId);

        // Create a session in SessionManager
        Session transcriptionSession = sessionManager.createSession(sessionId);
        log.info("Created transcription session: {}", transcriptionSession.id());

        // Create a sink for sending transcription updates to this session
        Sinks.Many<TranscriptionUpdate> transcriptionSink = Sinks.many().multicast().onBackpressureBuffer();
        sessionSinks.put(sessionId, transcriptionSink);

        // Create a sink for audio chunks to stream to transcription service
        Sinks.Many<byte[]> audioSink = Sinks.many().multicast().onBackpressureBuffer();
        audioSinks.put(sessionId, audioSink);

        // Start transcription streaming
        Flux<TranscriptionUpdate> transcriptionFlux = transcriptionStreamingService
            .startStreaming(audioSink.asFlux(), sessionId)
            .doOnNext(update -> {
                // Forward updates to the transcription sink for WebSocket output
                Sinks.EmitResult result = transcriptionSink.tryEmitNext(update);
                if (result.isFailure()) {
                    log.warn("Failed to emit transcription update to sink for session {}: {}", sessionId, result);
                }
            });

        // Subscribe to transcription flux to keep it active
        transcriptionFlux.subscribe(
            update -> log.debug("Transcription update processed for session {}: {}", sessionId, update.type()),
            error -> log.error("Transcription error for session {}: {}", sessionId, error.getMessage()),
            () -> log.info("Transcription completed for session {}", sessionId)
        );

        // Handle incoming binary audio messages
        Mono<Void> input = session.receive()
            .filter(message -> message.getType() == WebSocketMessage.Type.BINARY)
            .flatMap(message -> processAudioMessage(message, sessionId))
            .doOnError(error -> log.error("Error processing audio for session {}: {}", sessionId, error.getMessage()))
            .doOnComplete(() -> {
                log.info("WebSocket input stream completed for session: {}", sessionId);
                // Send final transcription on session end
                sendFinalTranscription(sessionId);
            })
            .then();

        // Send transcription updates back to client
        Mono<Void> output = session.send(
            transcriptionSink.asFlux()
                .map(update -> session.textMessage(serializeTranscriptionUpdate(update)))
                .doOnError(error -> log.error("Error sending transcription for session {}: {}", sessionId, error.getMessage()))
        );

        // Combine input and output, cleanup on completion
        return Mono.zip(input, output)
            .doFinally(signal -> {
                log.info("WebSocket session {} closed with signal: {}", sessionId, signal);
                cleanup(sessionId);
            })
            .then();
    }

    /**
     * Processes a binary audio message from the WebSocket.
     */
    private Mono<AudioChunk> processAudioMessage(WebSocketMessage message, String sessionId) {
        byte[] audioData = new byte[message.getPayload().readableByteCount()];
        message.getPayload().read(audioData);
        
        log.debug("Received audio chunk of {} bytes for session {}", audioData.length, sessionId);
        
        // Preserve audio data for network interruption recovery (Requirement 9.3)
        if (transcriptionStreamingService instanceof TranscriptionStreamingServiceImpl impl) {
            impl.preserveAudioData(sessionId, audioData);
        }
        
        // Send audio to transcription streaming service
        Sinks.Many<byte[]> audioSink = audioSinks.get(sessionId);
        if (audioSink != null) {
            Sinks.EmitResult result = audioSink.tryEmitNext(audioData);
            if (result.isFailure()) {
                log.warn("Failed to emit audio chunk to sink for session {}: {}", sessionId, result);
            }
        }
        
        return audioChunkProcessor.process(audioData, sessionId)
            .doOnSuccess(chunk -> log.debug("Processed chunk with timestamp {} for session {}", 
                chunk.timestamp(), sessionId))
            .doOnError(error -> log.warn("Failed to process audio chunk for session {}: {}", 
                sessionId, error.getMessage()));
    }

    /**
     * Sends final transcription when session ends.
     * Requirement 8.6: Send final transcription on session end
     */
    private void sendFinalTranscription(String sessionId) {
        transcriptionStreamingService.endSession(sessionId)
            .subscribe(
                finalUpdate -> log.info("Final transcription sent for session {}: {} chars", 
                    sessionId, finalUpdate.text().length()),
                error -> log.error("Error sending final transcription for session {}: {}", 
                    sessionId, error.getMessage())
            );
    }

    /**
     * Broadcasts a transcription update to a specific session.
     */
    public void broadcastToSession(String sessionId, TranscriptionUpdate update) {
        Sinks.Many<TranscriptionUpdate> sink = sessionSinks.get(sessionId);
        if (sink != null) {
            Sinks.EmitResult result = sink.tryEmitNext(update);
            if (result.isFailure()) {
                log.warn("Failed to emit transcription update to session {}: {}", sessionId, result);
            }
        } else {
            log.warn("No sink found for session {}", sessionId);
        }
    }

    /**
     * Serializes a TranscriptionUpdate to JSON string.
     */
    private String serializeTranscriptionUpdate(TranscriptionUpdate update) {
        return String.format(
            "{\"type\":\"%s\",\"text\":\"%s\",\"confidence\":%.4f,\"timestamp\":\"%s\",\"sequenceId\":%d}",
            update.type().name().toLowerCase(),
            escapeJson(update.text()),
            update.confidence(),
            update.timestamp().toString(),
            update.sequenceId()
        );
    }

    /**
     * Escapes special characters in JSON strings.
     */
    private String escapeJson(String text) {
        if (text == null) return "";
        return text
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t");
    }

    /**
     * Cleans up resources for a closed session.
     */
    private void cleanup(String sessionId) {
        Sinks.Many<TranscriptionUpdate> transcriptionSink = sessionSinks.remove(sessionId);
        if (transcriptionSink != null) {
            transcriptionSink.tryEmitComplete();
        }
        
        Sinks.Many<byte[]> audioSink = audioSinks.remove(sessionId);
        if (audioSink != null) {
            audioSink.tryEmitComplete();
        }
        
        log.debug("Cleaned up resources for session {}", sessionId);
    }

    /**
     * Gets the number of active sessions.
     */
    public int getActiveSessionCount() {
        return sessionSinks.size();
    }
}
