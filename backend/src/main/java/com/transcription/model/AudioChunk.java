package com.transcription.model;

/**
 * Represents an audio chunk received from the client.
 *
 * @param data           Raw audio data bytes
 * @param format         Audio format (e.g., "webm/opus")
 * @param timestamp      Timestamp assigned by the backend for sequencing
 * @param sequenceNumber Sequence number for ordering
 * @param sessionId      Session identifier this chunk belongs to
 */
public record AudioChunk(
    byte[] data,
    String format,
    long timestamp,
    int sequenceNumber,
    String sessionId
) {
    /** Expected audio format for incoming chunks */
    public static final String EXPECTED_FORMAT = "webm/opus";
    
    /** Maximum allowed chunk size in bytes (1MB) */
    public static final int MAX_CHUNK_SIZE = 1024 * 1024;
}
