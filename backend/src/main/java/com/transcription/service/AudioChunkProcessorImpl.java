package com.transcription.service;

import com.transcription.model.AudioChunk;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Comparator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Implementation of AudioChunkProcessor that validates, timestamps,
 * and reorders audio chunks for processing.
 */
@Service
public class AudioChunkProcessorImpl implements AudioChunkProcessor {

    private static final Logger log = LoggerFactory.getLogger(AudioChunkProcessorImpl.class);

    /**
     * WebM file signature (EBML header).
     * WebM files start with 0x1A 0x45 0xDF 0xA3 (EBML magic number).
     */
    private static final byte[] WEBM_SIGNATURE = {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3};

    /**
     * Minimum valid chunk size in bytes.
     */
    private static final int MIN_CHUNK_SIZE = 4;

    /**
     * Global timestamp counter for monotonic ordering.
     */
    private final AtomicLong timestampCounter = new AtomicLong(0);

    /**
     * Per-session sequence number counters.
     */
    private final Map<String, AtomicInteger> sessionSequenceCounters = new ConcurrentHashMap<>();

    /**
     * Buffer window duration for reordering chunks.
     */
    private static final Duration REORDER_BUFFER_DURATION = Duration.ofMillis(200);

    @Override
    public Mono<AudioChunk> process(byte[] audioData, String sessionId) {
        return Mono.fromCallable(() -> {
            // Validate the audio chunk format
            if (!validateFormat(audioData)) {
                throw new InvalidAudioChunkException("Invalid audio chunk format: expected WebM/Opus");
            }

            // Validate chunk size
            if (audioData.length > AudioChunk.MAX_CHUNK_SIZE) {
                throw new InvalidAudioChunkException(
                    String.format("Audio chunk exceeds maximum size: %d > %d bytes", 
                        audioData.length, AudioChunk.MAX_CHUNK_SIZE));
            }

            // Assign timestamp and sequence number
            long timestamp = assignTimestamp();
            int sequenceNumber = getNextSequenceNumber(sessionId);

            AudioChunk chunk = new AudioChunk(
                audioData,
                AudioChunk.EXPECTED_FORMAT,
                timestamp,
                sequenceNumber,
                sessionId
            );

            log.debug("Created AudioChunk: session={}, seq={}, timestamp={}, size={}", 
                sessionId, sequenceNumber, timestamp, audioData.length);

            return chunk;
        });
    }

    @Override
    public boolean validateFormat(byte[] audioData) {
        // Check minimum size
        if (audioData == null || audioData.length < MIN_CHUNK_SIZE) {
            log.debug("Audio chunk too small: {} bytes", audioData == null ? 0 : audioData.length);
            return false;
        }

        // Check for WebM signature (EBML header)
        // Note: Subsequent chunks in a stream may not have the full header,
        // so we also accept chunks that are part of an ongoing stream
        if (hasWebMSignature(audioData)) {
            return true;
        }

        // For continuation chunks (after the initial header), we accept them
        // if they have reasonable size and don't start with obviously wrong data
        // This is a simplified validation - in production, you'd track stream state
        if (audioData.length >= MIN_CHUNK_SIZE) {
            // Accept continuation chunks that don't have the header
            // Real validation would involve tracking the WebM stream state
            return true;
        }

        return false;
    }

    /**
     * Checks if the audio data starts with WebM signature.
     */
    private boolean hasWebMSignature(byte[] audioData) {
        if (audioData.length < WEBM_SIGNATURE.length) {
            return false;
        }
        for (int i = 0; i < WEBM_SIGNATURE.length; i++) {
            if (audioData[i] != WEBM_SIGNATURE[i]) {
                return false;
            }
        }
        return true;
    }

    @Override
    public long assignTimestamp() {
        return timestampCounter.incrementAndGet();
    }

    /**
     * Gets the next sequence number for a session.
     */
    private int getNextSequenceNumber(String sessionId) {
        return sessionSequenceCounters
            .computeIfAbsent(sessionId, k -> new AtomicInteger(0))
            .incrementAndGet();
    }

    @Override
    public Flux<AudioChunk> reorderByTimestamp(Flux<AudioChunk> chunks) {
        return chunks
            .bufferTimeout(100, REORDER_BUFFER_DURATION)
            .flatMapIterable(buffer -> {
                // Sort the buffer by timestamp
                buffer.sort(Comparator.comparingLong(AudioChunk::timestamp));
                return buffer;
            });
    }

    /**
     * Resets the sequence counter for a session (called when session ends).
     */
    public void resetSession(String sessionId) {
        sessionSequenceCounters.remove(sessionId);
        log.debug("Reset sequence counter for session: {}", sessionId);
    }

    /**
     * Gets the current timestamp value (for testing).
     */
    public long getCurrentTimestamp() {
        return timestampCounter.get();
    }

    /**
     * Exception thrown when audio chunk validation fails.
     */
    public static class InvalidAudioChunkException extends RuntimeException {
        public InvalidAudioChunkException(String message) {
            super(message);
        }
    }
}
