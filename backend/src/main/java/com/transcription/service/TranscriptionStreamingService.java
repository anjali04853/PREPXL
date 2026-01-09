package com.transcription.service;

import com.transcription.model.TranscriptionUpdate;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Service for streaming transcription updates to clients.
 * Coordinates between GeminiTranscriptionService and WebSocket connections.
 */
public interface TranscriptionStreamingService {

    /**
     * Starts streaming transcription for a session.
     * Receives audio chunks, sends them to Gemini, and streams results back to client.
     *
     * @param audioChunks Flux of audio data bytes
     * @param sessionId   Session identifier
     * @return Flux of TranscriptionUpdate messages
     */
    Flux<TranscriptionUpdate> startStreaming(Flux<byte[]> audioChunks, String sessionId);

    /**
     * Sends a transcription update to the client for a specific session.
     *
     * @param sessionId Session identifier
     * @param update    TranscriptionUpdate to send
     */
    void sendUpdate(String sessionId, TranscriptionUpdate update);

    /**
     * Ends a transcription session and sends the final transcription.
     * Aggregates all partial transcriptions into a final result.
     *
     * @param sessionId Session identifier
     * @return Mono containing the final TranscriptionUpdate
     */
    Mono<TranscriptionUpdate> endSession(String sessionId);

    /**
     * Gets the aggregated transcription text for a session.
     *
     * @param sessionId Session identifier
     * @return The full transcription text
     */
    String getAggregatedTranscription(String sessionId);
}
