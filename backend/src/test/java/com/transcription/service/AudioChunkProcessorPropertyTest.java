package com.transcription.service;

import com.transcription.model.AudioChunk;
import net.jqwik.api.*;
import net.jqwik.api.constraints.IntRange;
import net.jqwik.api.constraints.Size;
import reactor.core.publisher.Flux;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Property-based tests for AudioChunkProcessor.
 * Feature: realtime-audio-transcription
 */
class AudioChunkProcessorPropertyTest {

    private final AudioChunkProcessorImpl processor = new AudioChunkProcessorImpl();

    /**
     * WebM file signature (EBML header).
     */
    private static final byte[] WEBM_SIGNATURE = {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3};

    // ========================================================================
    // Property 6: Audio Chunk Validation
    // Validates: Requirements 5.1
    // For any audio chunk received by the backend, validation SHALL accept 
    // chunks with valid WebM/Opus format and reject chunks with invalid format 
    // or exceeding size limits.
    // ========================================================================

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 6: Valid WebM chunks are accepted")
    void validWebMChunksAreAccepted(
            @ForAll @Size(min = 10, max = 1000) byte[] randomData) {
        // Create valid WebM chunk by prepending signature
        byte[] validChunk = createValidWebMChunk(randomData);
        
        boolean isValid = processor.validateFormat(validChunk);
        
        assertThat(isValid)
            .as("Valid WebM chunk with signature should be accepted")
            .isTrue();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 6: Chunks exceeding max size are rejected during processing")
    void chunksExceedingMaxSizeAreRejected(
            @ForAll @IntRange(min = AudioChunk.MAX_CHUNK_SIZE + 1, max = AudioChunk.MAX_CHUNK_SIZE + 1000) int size) {
        // Create oversized chunk with valid signature
        byte[] oversizedChunk = new byte[size];
        System.arraycopy(WEBM_SIGNATURE, 0, oversizedChunk, 0, WEBM_SIGNATURE.length);
        
        // Process should fail due to size - expect exception
        try {
            processor.process(oversizedChunk, "test-session").block();
            // If we get here without exception, the test should fail
            assertThat(false)
                .as("Expected InvalidAudioChunkException for oversized chunk")
                .isTrue();
        } catch (AudioChunkProcessorImpl.InvalidAudioChunkException e) {
            // Expected behavior - oversized chunks should be rejected
            assertThat(e.getMessage())
                .as("Exception message should mention size limit")
                .contains("exceeds maximum size");
        }
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 6: Empty or null chunks are rejected")
    void emptyOrTooSmallChunksAreRejected(
            @ForAll @IntRange(min = 0, max = 3) int size) {
        byte[] smallChunk = new byte[size];
        
        boolean isValid = processor.validateFormat(smallChunk);
        
        assertThat(isValid)
            .as("Chunks smaller than minimum size should be rejected")
            .isFalse();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 6: Null chunks are rejected")
    void nullChunksAreRejected() {
        boolean isValid = processor.validateFormat(null);
        
        assertThat(isValid)
            .as("Null chunks should be rejected")
            .isFalse();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 6: Continuation chunks with valid size are accepted")
    void continuationChunksWithValidSizeAreAccepted(
            @ForAll @Size(min = 4, max = 10000) byte[] randomData) {
        // Continuation chunks (without WebM header) should be accepted if they have valid size
        // This simulates chunks that come after the initial header chunk
        
        boolean isValid = processor.validateFormat(randomData);
        
        assertThat(isValid)
            .as("Continuation chunks with valid size should be accepted")
            .isTrue();
    }

    // ========================================================================
    // Helper methods
    // ========================================================================

    /**
     * Creates a valid WebM chunk by prepending the WebM signature.
     */
    private byte[] createValidWebMChunk(byte[] data) {
        byte[] chunk = new byte[WEBM_SIGNATURE.length + data.length];
        System.arraycopy(WEBM_SIGNATURE, 0, chunk, 0, WEBM_SIGNATURE.length);
        System.arraycopy(data, 0, chunk, WEBM_SIGNATURE.length, data.length);
        return chunk;
    }
}


/**
 * Property-based tests for chunk timestamping.
 * Feature: realtime-audio-transcription, Property 7: Chunk Timestamping
 */
class ChunkTimestampingPropertyTest {

    private final AudioChunkProcessorImpl processor = new AudioChunkProcessorImpl();

    /**
     * WebM file signature (EBML header).
     */
    private static final byte[] WEBM_SIGNATURE = {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3};

    // ========================================================================
    // Property 7: Chunk Timestamping
    // Validates: Requirements 5.2
    // For any audio chunk received by the backend, a monotonically increasing 
    // timestamp SHALL be assigned before processing.
    // ========================================================================

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 7: Timestamps are monotonically increasing")
    void timestampsAreMonotonicallyIncreasing(
            @ForAll @Size(min = 2, max = 50) List<@Size(min = 10, max = 100) byte[]> chunks) {
        
        long previousTimestamp = -1;
        
        for (byte[] chunkData : chunks) {
            // Create valid WebM chunk
            byte[] validChunk = createValidWebMChunk(chunkData);
            
            AudioChunk processed = processor.process(validChunk, "test-session").block();
            
            assertThat(processed).isNotNull();
            assertThat(processed.timestamp())
                .as("Each timestamp should be greater than the previous one")
                .isGreaterThan(previousTimestamp);
            
            previousTimestamp = processed.timestamp();
        }
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 7: Timestamps are unique across sessions")
    void timestampsAreUniqueAcrossSessions(
            @ForAll @Size(min = 5, max = 20) byte[] chunkData,
            @ForAll("sessionIds") List<String> sessionIds) {
        
        byte[] validChunk = createValidWebMChunk(chunkData);
        long previousTimestamp = -1;
        
        for (String sessionId : sessionIds) {
            AudioChunk processed = processor.process(validChunk, sessionId).block();
            
            assertThat(processed).isNotNull();
            assertThat(processed.timestamp())
                .as("Timestamps should be unique even across different sessions")
                .isGreaterThan(previousTimestamp);
            
            previousTimestamp = processed.timestamp();
        }
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 7: Timestamps are positive")
    void timestampsArePositive(
            @ForAll @Size(min = 5, max = 100) byte[] chunkData) {
        
        byte[] validChunk = createValidWebMChunk(chunkData);
        AudioChunk processed = processor.process(validChunk, "test-session").block();
        
        assertThat(processed).isNotNull();
        assertThat(processed.timestamp())
            .as("Timestamps should be positive")
            .isPositive();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 7: assignTimestamp returns increasing values")
    void assignTimestampReturnsIncreasingValues(
            @ForAll @IntRange(min = 2, max = 100) int count) {
        
        AudioChunkProcessorImpl localProcessor = new AudioChunkProcessorImpl();
        long previousTimestamp = 0;
        
        for (int i = 0; i < count; i++) {
            long timestamp = localProcessor.assignTimestamp();
            
            assertThat(timestamp)
                .as("Each call to assignTimestamp should return a larger value")
                .isGreaterThan(previousTimestamp);
            
            previousTimestamp = timestamp;
        }
    }

    @Provide
    Arbitrary<List<String>> sessionIds() {
        return Arbitraries.strings()
            .alpha()
            .ofMinLength(5)
            .ofMaxLength(20)
            .list()
            .ofMinSize(2)
            .ofMaxSize(10);
    }

    /**
     * Creates a valid WebM chunk by prepending the WebM signature.
     */
    private byte[] createValidWebMChunk(byte[] data) {
        byte[] chunk = new byte[WEBM_SIGNATURE.length + data.length];
        System.arraycopy(WEBM_SIGNATURE, 0, chunk, 0, WEBM_SIGNATURE.length);
        System.arraycopy(data, 0, chunk, WEBM_SIGNATURE.length, data.length);
        return chunk;
    }
}


/**
 * Property-based tests for chunk reordering.
 * Feature: realtime-audio-transcription, Property 8: Out-of-Order Chunk Reordering
 */
class ChunkReorderingPropertyTest {

    private final AudioChunkProcessorImpl processor = new AudioChunkProcessorImpl();

    // ========================================================================
    // Property 8: Out-of-Order Chunk Reordering
    // Validates: Requirements 5.3
    // For any sequence of audio chunks arriving out of order, the reordered 
    // output sequence SHALL be sorted by timestamp in ascending order.
    // ========================================================================

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 8: Reordered chunks are sorted by timestamp")
    void reorderedChunksAreSortedByTimestamp(
            @ForAll("outOfOrderChunks") List<AudioChunk> chunks) {
        
        Assume.that(chunks.size() >= 2);
        
        // Create a flux from the out-of-order chunks
        Flux<AudioChunk> inputFlux = Flux.fromIterable(chunks);
        
        // Reorder the chunks
        List<AudioChunk> reordered = processor.reorderByTimestamp(inputFlux)
            .collectList()
            .block();
        
        assertThat(reordered).isNotNull();
        assertThat(reordered).hasSameSizeAs(chunks);
        
        // Verify the output is sorted by timestamp
        for (int i = 1; i < reordered.size(); i++) {
            assertThat(reordered.get(i).timestamp())
                .as("Chunk at index %d should have timestamp >= chunk at index %d", i, i - 1)
                .isGreaterThanOrEqualTo(reordered.get(i - 1).timestamp());
        }
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 8: Reordering preserves all chunks")
    void reorderingPreservesAllChunks(
            @ForAll("outOfOrderChunks") List<AudioChunk> chunks) {
        
        Assume.that(!chunks.isEmpty());
        
        Flux<AudioChunk> inputFlux = Flux.fromIterable(chunks);
        
        List<AudioChunk> reordered = processor.reorderByTimestamp(inputFlux)
            .collectList()
            .block();
        
        assertThat(reordered).isNotNull();
        assertThat(reordered).hasSameSizeAs(chunks);
        
        // Verify all original chunks are present (by timestamp)
        List<Long> originalTimestamps = chunks.stream()
            .map(AudioChunk::timestamp)
            .sorted()
            .toList();
        List<Long> reorderedTimestamps = reordered.stream()
            .map(AudioChunk::timestamp)
            .toList();
        
        assertThat(reorderedTimestamps)
            .as("All original chunks should be preserved after reordering")
            .containsExactlyElementsOf(originalTimestamps);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 8: Already sorted chunks remain sorted")
    void alreadySortedChunksRemainSorted(
            @ForAll("sortedChunks") List<AudioChunk> chunks) {
        
        Assume.that(chunks.size() >= 2);
        
        Flux<AudioChunk> inputFlux = Flux.fromIterable(chunks);
        
        List<AudioChunk> reordered = processor.reorderByTimestamp(inputFlux)
            .collectList()
            .block();
        
        assertThat(reordered).isNotNull();
        
        // Verify the output maintains sorted order
        for (int i = 1; i < reordered.size(); i++) {
            assertThat(reordered.get(i).timestamp())
                .as("Already sorted chunks should remain sorted")
                .isGreaterThanOrEqualTo(reordered.get(i - 1).timestamp());
        }
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 8: Reverse ordered chunks are correctly sorted")
    void reverseOrderedChunksAreCorrectlySorted(
            @ForAll("reverseOrderedChunks") List<AudioChunk> chunks) {
        
        Assume.that(chunks.size() >= 2);
        
        Flux<AudioChunk> inputFlux = Flux.fromIterable(chunks);
        
        List<AudioChunk> reordered = processor.reorderByTimestamp(inputFlux)
            .collectList()
            .block();
        
        assertThat(reordered).isNotNull();
        
        // Verify the output is sorted in ascending order
        for (int i = 1; i < reordered.size(); i++) {
            assertThat(reordered.get(i).timestamp())
                .as("Reverse ordered chunks should be sorted in ascending order")
                .isGreaterThanOrEqualTo(reordered.get(i - 1).timestamp());
        }
    }

    @Provide
    Arbitrary<List<AudioChunk>> outOfOrderChunks() {
        return Arbitraries.integers()
            .between(1, 1000)
            .list()
            .ofMinSize(2)
            .ofMaxSize(50)
            .map(timestamps -> {
                // Shuffle the timestamps to create out-of-order chunks
                java.util.Collections.shuffle(timestamps);
                return timestamps.stream()
                    .map(ts -> new AudioChunk(
                        new byte[]{0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 0x00},
                        "webm/opus",
                        ts.longValue(),
                        0,
                        "test-session"
                    ))
                    .toList();
            });
    }

    @Provide
    Arbitrary<List<AudioChunk>> sortedChunks() {
        return Arbitraries.integers()
            .between(1, 1000)
            .list()
            .ofMinSize(2)
            .ofMaxSize(50)
            .map(timestamps -> {
                // Sort timestamps to create already-sorted chunks
                java.util.Collections.sort(timestamps);
                return timestamps.stream()
                    .map(ts -> new AudioChunk(
                        new byte[]{0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 0x00},
                        "webm/opus",
                        ts.longValue(),
                        0,
                        "test-session"
                    ))
                    .toList();
            });
    }

    @Provide
    Arbitrary<List<AudioChunk>> reverseOrderedChunks() {
        return Arbitraries.integers()
            .between(1, 1000)
            .list()
            .ofMinSize(2)
            .ofMaxSize(50)
            .map(timestamps -> {
                // Sort in reverse order
                timestamps.sort(java.util.Collections.reverseOrder());
                return timestamps.stream()
                    .map(ts -> new AudioChunk(
                        new byte[]{0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 0x00},
                        "webm/opus",
                        ts.longValue(),
                        0,
                        "test-session"
                    ))
                    .toList();
            });
    }
}
