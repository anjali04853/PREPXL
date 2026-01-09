package com.transcription.service;

import com.transcription.model.Session;
import com.transcription.model.SessionState;
import com.transcription.model.TranscriptionType;
import com.transcription.model.TranscriptionUpdate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * Implementation of TranscriptionStreamingService.
 * Coordinates transcription streaming between Gemini API and WebSocket clients.
 * 
 * Requirements: 7.1, 7.2, 7.3, 8.6
 */
@Service
public class TranscriptionStreamingServiceImpl implements TranscriptionStreamingService {

    private static final Logger log = LoggerFactory.getLogger(TranscriptionStreamingServiceImpl.class);

    private final GeminiTranscriptionService geminiService;
    private final SessionManager sessionManager;
    
    /**
     * Callback interface for sending updates to WebSocket clients.
     */
    private TranscriptionUpdateCallback updateCallback;

    /**
     * Per-session sequence counters for final transcription updates.
     */
    private final Map<String, AtomicLong> sessionSequenceCounters = new ConcurrentHashMap<>();

    /**
     * Buffer for preserving audio data during network interruptions.
     * Maps sessionId to list of audio chunks.
     */
    private final Map<String, List<byte[]>> audioBuffers = new ConcurrentHashMap<>();

    public TranscriptionStreamingServiceImpl(
            GeminiTranscriptionService geminiService,
            SessionManager sessionManager) {
        this.geminiService = geminiService;
        this.sessionManager = sessionManager;
    }

    /**
     * Sets the callback for sending transcription updates to clients.
     */
    public void setUpdateCallback(TranscriptionUpdateCallback callback) {
        this.updateCallback = callback;
    }

    @Override
    public Flux<TranscriptionUpdate> startStreaming(Flux<byte[]> audioChunks, String sessionId) {
        log.info("Starting transcription streaming for session: {}", sessionId);
        
        sessionSequenceCounters.putIfAbsent(sessionId, new AtomicLong(0));
        audioBuffers.putIfAbsent(sessionId, new java.util.concurrent.CopyOnWriteArrayList<>());

        return geminiService.streamTranscription(audioChunks, sessionId)
            .doOnNext(update -> {
                // Store update in session history
                sessionManager.addTranscriptionUpdate(sessionId, update);
                
                // Preserve audio data reference for network interruption recovery
                log.debug("Received transcription update for session {}: type={}, sequenceId={}", 
                    sessionId, update.type(), update.sequenceId());
                
                // Send update to client via callback
                if (updateCallback != null) {
                    updateCallback.onUpdate(sessionId, update);
                }
            })
            .doOnError(error -> {
                log.error("Error in transcription stream for session {}: {}", 
                    sessionId, error.getMessage());
            })
            .doOnComplete(() -> {
                log.info("Transcription stream completed for session: {}", sessionId);
            });
    }

    @Override
    public void sendUpdate(String sessionId, TranscriptionUpdate update) {
        // Validate update structure
        if (!isValidTranscriptionUpdate(update)) {
            log.warn("Invalid transcription update for session {}: {}", sessionId, update);
            return;
        }

        // Store in session history
        sessionManager.addTranscriptionUpdate(sessionId, update);

        // Send to client
        if (updateCallback != null) {
            updateCallback.onUpdate(sessionId, update);
        }
        
        log.debug("Sent transcription update to session {}: type={}, confidence={}", 
            sessionId, update.type(), update.confidence());
    }

    @Override
    public Mono<TranscriptionUpdate> endSession(String sessionId) {
        return Mono.fromCallable(() -> {
            log.info("Ending transcription session: {}", sessionId);
            
            // Get session and aggregate transcription
            Session session = sessionManager.getSession(sessionId).orElse(null);
            if (session == null) {
                log.warn("Session not found for end session: {}", sessionId);
                return createEmptyFinalUpdate(sessionId);
            }

            // Aggregate all transcription text
            String aggregatedText = aggregateTranscriptionText(session.transcriptionHistory());
            double averageConfidence = calculateAverageConfidence(session.transcriptionHistory());
            long finalSequenceId = getNextSequenceId(sessionId);

            // Create final transcription update
            TranscriptionUpdate finalUpdate = new TranscriptionUpdate(
                TranscriptionType.FINAL,
                aggregatedText,
                averageConfidence,
                Instant.now(),
                finalSequenceId
            );

            // Store final update
            sessionManager.addTranscriptionUpdate(sessionId, finalUpdate);

            // Send final update to client
            if (updateCallback != null) {
                updateCallback.onUpdate(sessionId, finalUpdate);
            }

            // Close session cleanly
            sessionManager.closeSession(sessionId);
            
            // Cleanup resources
            cleanup(sessionId);

            log.info("Session {} ended with final transcription: {} chars, confidence: {}", 
                sessionId, aggregatedText.length(), averageConfidence);

            return finalUpdate;
        });
    }

    @Override
    public String getAggregatedTranscription(String sessionId) {
        return sessionManager.getSession(sessionId)
            .map(session -> aggregateTranscriptionText(session.transcriptionHistory()))
            .orElse("");
    }

    /**
     * Preserves audio data for a session during network interruptions.
     * Requirement 9.3: Network interruption data preservation
     */
    public void preserveAudioData(String sessionId, byte[] audioData) {
        List<byte[]> buffer = audioBuffers.computeIfAbsent(sessionId, 
            k -> new java.util.concurrent.CopyOnWriteArrayList<>());
        buffer.add(audioData.clone()); // Clone to ensure data is preserved
        log.debug("Preserved audio chunk for session {}: {} bytes", sessionId, audioData.length);
    }

    /**
     * Gets preserved audio data for a session.
     */
    public List<byte[]> getPreservedAudioData(String sessionId) {
        return audioBuffers.getOrDefault(sessionId, List.of());
    }

    /**
     * Validates that a TranscriptionUpdate has all required fields.
     * Property 12: TranscriptionUpdate Structure Validity
     */
    public boolean isValidTranscriptionUpdate(TranscriptionUpdate update) {
        if (update == null) {
            return false;
        }
        
        // Type must be PARTIAL or FINAL
        if (update.type() == null) {
            return false;
        }
        
        // Text must not be null (can be empty)
        if (update.text() == null) {
            return false;
        }
        
        // Confidence must be in [0.0, 1.0]
        if (update.confidence() < 0.0 || update.confidence() > 1.0) {
            return false;
        }
        
        // Timestamp must not be null
        if (update.timestamp() == null) {
            return false;
        }
        
        // SequenceId must be positive
        if (update.sequenceId() <= 0) {
            return false;
        }
        
        return true;
    }

    /**
     * Aggregates transcription text from a list of updates.
     * Only includes FINAL updates to avoid duplicates from partial updates.
     */
    private String aggregateTranscriptionText(List<TranscriptionUpdate> updates) {
        if (updates == null || updates.isEmpty()) {
            return "";
        }

        // Collect final transcriptions, or if none, use the last partial
        List<TranscriptionUpdate> finalUpdates = updates.stream()
            .filter(u -> u.type() == TranscriptionType.FINAL)
            .collect(Collectors.toList());

        if (!finalUpdates.isEmpty()) {
            return finalUpdates.stream()
                .map(TranscriptionUpdate::text)
                .filter(text -> text != null && !text.isBlank())
                .collect(Collectors.joining(" "));
        }

        // If no final updates, use the last partial update
        return updates.stream()
            .filter(u -> u.type() == TranscriptionType.PARTIAL)
            .reduce((first, second) -> second) // Get last
            .map(TranscriptionUpdate::text)
            .orElse("");
    }

    /**
     * Calculates average confidence from a list of updates.
     */
    private double calculateAverageConfidence(List<TranscriptionUpdate> updates) {
        if (updates == null || updates.isEmpty()) {
            return 0.0;
        }

        return updates.stream()
            .mapToDouble(TranscriptionUpdate::confidence)
            .average()
            .orElse(0.0);
    }

    /**
     * Gets the next sequence ID for a session.
     */
    private long getNextSequenceId(String sessionId) {
        return sessionSequenceCounters
            .computeIfAbsent(sessionId, k -> new AtomicLong(0))
            .incrementAndGet();
    }

    /**
     * Creates an empty final update for error cases.
     */
    private TranscriptionUpdate createEmptyFinalUpdate(String sessionId) {
        return new TranscriptionUpdate(
            TranscriptionType.FINAL,
            "",
            0.0,
            Instant.now(),
            getNextSequenceId(sessionId)
        );
    }

    /**
     * Cleans up resources for a session.
     */
    private void cleanup(String sessionId) {
        sessionSequenceCounters.remove(sessionId);
        audioBuffers.remove(sessionId);
        log.debug("Cleaned up streaming resources for session: {}", sessionId);
    }

    /**
     * Callback interface for sending updates to WebSocket clients.
     */
    @FunctionalInterface
    public interface TranscriptionUpdateCallback {
        void onUpdate(String sessionId, TranscriptionUpdate update);
    }
}
