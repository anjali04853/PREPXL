package com.transcription.service;

import com.transcription.model.AudioChunk;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Processes incoming audio chunks from WebSocket connections.
 * Validates format, assigns timestamps, and reorders out-of-order chunks.
 */
public interface AudioChunkProcessor {

    /**
     * Processes a raw audio chunk and returns a validated AudioChunk.
     *
     * @param audioData Raw audio data bytes
     * @param sessionId Session identifier
     * @return Mono containing the processed AudioChunk, or error if validation fails
     */
    Mono<AudioChunk> process(byte[] audioData, String sessionId);

    /**
     * Validates the audio chunk format.
     *
     * @param audioData Raw audio data bytes
     * @return true if the format is valid WebM/Opus, false otherwise
     */
    boolean validateFormat(byte[] audioData);

    /**
     * Assigns a monotonically increasing timestamp to the chunk.
     *
     * @return The assigned timestamp
     */
    long assignTimestamp();

    /**
     * Reorders a flux of audio chunks by their timestamps.
     *
     * @param chunks Flux of potentially out-of-order chunks
     * @return Flux of chunks sorted by timestamp
     */
    Flux<AudioChunk> reorderByTimestamp(Flux<AudioChunk> chunks);
}
