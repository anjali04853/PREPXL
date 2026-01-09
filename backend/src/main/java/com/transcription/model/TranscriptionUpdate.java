package com.transcription.model;

import java.time.Instant;

/**
 * Represents a transcription update message sent to clients.
 * Contains partial or final transcription text with metadata.
 *
 * @param type       Type of transcription: PARTIAL for interim results, FINAL for completed segments
 * @param text       The transcribed text content
 * @param confidence Confidence score from 0.0 to 1.0
 * @param timestamp  ISO-8601 timestamp of when the transcription was generated
 * @param sequenceId Monotonically increasing sequence identifier for ordering
 */
public record TranscriptionUpdate(
    TranscriptionType type,
    String text,
    double confidence,
    Instant timestamp,
    long sequenceId
) {
    /**
     * Creates a partial transcription update.
     */
    public static TranscriptionUpdate partial(String text, double confidence, long sequenceId) {
        return new TranscriptionUpdate(TranscriptionType.PARTIAL, text, confidence, Instant.now(), sequenceId);
    }

    /**
     * Creates a final transcription update.
     */
    public static TranscriptionUpdate finalResult(String text, double confidence, long sequenceId) {
        return new TranscriptionUpdate(TranscriptionType.FINAL, text, confidence, Instant.now(), sequenceId);
    }
}
