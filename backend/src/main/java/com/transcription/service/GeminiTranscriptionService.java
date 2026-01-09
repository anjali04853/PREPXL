package com.transcription.service;

import com.transcription.model.TranscriptionUpdate;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Service for streaming audio to Gemini API and receiving transcriptions.
 * Implements reactive streaming with circuit breaker and retry patterns.
 */
public interface GeminiTranscriptionService {

    /**
     * Streams audio chunks to Gemini API and returns transcription updates.
     * Audio chunks are forwarded immediately without buffering.
     *
     * @param audioChunks Flux of audio data bytes to transcribe
     * @param sessionId   Session identifier for tracking
     * @return Flux of TranscriptionUpdate containing partial and final results
     */
    Flux<TranscriptionUpdate> streamTranscription(Flux<byte[]> audioChunks, String sessionId);

    /**
     * Closes the transcription session and releases resources.
     *
     * @param sessionId Session identifier to close
     * @return Mono that completes when the session is closed
     */
    Mono<Void> closeSession(String sessionId);

    /**
     * Parses a confidence score from a Gemini API response.
     * Ensures the score is within valid bounds [0.0, 1.0].
     *
     * @param rawScore The raw confidence value from the API
     * @return Normalized confidence score between 0.0 and 1.0
     */
    double parseConfidenceScore(double rawScore);

    /**
     * Checks if the service is currently available (circuit breaker not open).
     *
     * @return true if the service can accept requests
     */
    boolean isAvailable();
}
