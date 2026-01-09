package com.transcription.service;

import com.transcription.model.TranscriptionType;
import com.transcription.model.TranscriptionUpdate;
import net.jqwik.api.*;
import net.jqwik.api.constraints.*;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Property-based tests for TranscriptionStreamingService.
 * Feature: realtime-audio-transcription
 */
class TranscriptionStreamingServicePropertyTest {

    // ========================================================================
    // Property 12: TranscriptionUpdate Structure Validity
    // Validates: Requirements 7.2, 7.3
    // For any TranscriptionUpdate message, it SHALL contain: type (either 
    // 'partial' or 'final'), text (string), confidence (float 0-1), 
    // timestamp (ISO-8601 string), and sequenceId (positive integer).
    // ========================================================================

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 12: Valid TranscriptionUpdate passes validation")
    void validTranscriptionUpdatePassesValidation(
            @ForAll("validTranscriptionTypes") TranscriptionType type,
            @ForAll @StringLength(min = 0, max = 1000) String text,
            @ForAll @DoubleRange(min = 0.0, max = 1.0) double confidence,
            @ForAll("positiveSequenceIds") long sequenceId) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        
        TranscriptionUpdate update = new TranscriptionUpdate(
            type,
            text,
            confidence,
            Instant.now(),
            sequenceId
        );
        
        assertThat(service.isValidTranscriptionUpdate(update))
            .as("Valid TranscriptionUpdate should pass validation")
            .isTrue();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 12: TranscriptionUpdate with null type fails validation")
    void transcriptionUpdateWithNullTypeFailsValidation(
            @ForAll @StringLength(min = 0, max = 100) String text,
            @ForAll @DoubleRange(min = 0.0, max = 1.0) double confidence,
            @ForAll("positiveSequenceIds") long sequenceId) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        
        TranscriptionUpdate update = new TranscriptionUpdate(
            null,  // Invalid: null type
            text,
            confidence,
            Instant.now(),
            sequenceId
        );
        
        assertThat(service.isValidTranscriptionUpdate(update))
            .as("TranscriptionUpdate with null type should fail validation")
            .isFalse();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 12: TranscriptionUpdate with null text fails validation")
    void transcriptionUpdateWithNullTextFailsValidation(
            @ForAll("validTranscriptionTypes") TranscriptionType type,
            @ForAll @DoubleRange(min = 0.0, max = 1.0) double confidence,
            @ForAll("positiveSequenceIds") long sequenceId) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        
        TranscriptionUpdate update = new TranscriptionUpdate(
            type,
            null,  // Invalid: null text
            confidence,
            Instant.now(),
            sequenceId
        );
        
        assertThat(service.isValidTranscriptionUpdate(update))
            .as("TranscriptionUpdate with null text should fail validation")
            .isFalse();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 12: TranscriptionUpdate with confidence below 0 fails validation")
    void transcriptionUpdateWithConfidenceBelowZeroFailsValidation(
            @ForAll("validTranscriptionTypes") TranscriptionType type,
            @ForAll @StringLength(min = 0, max = 100) String text,
            @ForAll("negativeConfidences") double confidence,
            @ForAll("positiveSequenceIds") long sequenceId) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        
        TranscriptionUpdate update = new TranscriptionUpdate(
            type,
            text,
            confidence,  // Invalid: negative confidence
            Instant.now(),
            sequenceId
        );
        
        assertThat(service.isValidTranscriptionUpdate(update))
            .as("TranscriptionUpdate with confidence < 0 should fail validation")
            .isFalse();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 12: TranscriptionUpdate with confidence above 1 fails validation")
    void transcriptionUpdateWithConfidenceAboveOneFailsValidation(
            @ForAll("validTranscriptionTypes") TranscriptionType type,
            @ForAll @StringLength(min = 0, max = 100) String text,
            @ForAll("highConfidences") double confidence,
            @ForAll("positiveSequenceIds") long sequenceId) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        
        TranscriptionUpdate update = new TranscriptionUpdate(
            type,
            text,
            confidence,  // Invalid: confidence > 1.0
            Instant.now(),
            sequenceId
        );
        
        assertThat(service.isValidTranscriptionUpdate(update))
            .as("TranscriptionUpdate with confidence > 1.0 should fail validation")
            .isFalse();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 12: TranscriptionUpdate with null timestamp fails validation")
    void transcriptionUpdateWithNullTimestampFailsValidation(
            @ForAll("validTranscriptionTypes") TranscriptionType type,
            @ForAll @StringLength(min = 0, max = 100) String text,
            @ForAll @DoubleRange(min = 0.0, max = 1.0) double confidence,
            @ForAll("positiveSequenceIds") long sequenceId) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        
        TranscriptionUpdate update = new TranscriptionUpdate(
            type,
            text,
            confidence,
            null,  // Invalid: null timestamp
            sequenceId
        );
        
        assertThat(service.isValidTranscriptionUpdate(update))
            .as("TranscriptionUpdate with null timestamp should fail validation")
            .isFalse();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 12: TranscriptionUpdate with non-positive sequenceId fails validation")
    void transcriptionUpdateWithNonPositiveSequenceIdFailsValidation(
            @ForAll("validTranscriptionTypes") TranscriptionType type,
            @ForAll @StringLength(min = 0, max = 100) String text,
            @ForAll @DoubleRange(min = 0.0, max = 1.0) double confidence,
            @ForAll("nonPositiveSequenceIds") long sequenceId) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        
        TranscriptionUpdate update = new TranscriptionUpdate(
            type,
            text,
            confidence,
            Instant.now(),
            sequenceId  // Invalid: non-positive sequenceId
        );
        
        assertThat(service.isValidTranscriptionUpdate(update))
            .as("TranscriptionUpdate with non-positive sequenceId should fail validation")
            .isFalse();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 12: Null TranscriptionUpdate fails validation")
    void nullTranscriptionUpdateFailsValidation() {
        TranscriptionStreamingServiceImpl service = createTestService();
        
        assertThat(service.isValidTranscriptionUpdate(null))
            .as("Null TranscriptionUpdate should fail validation")
            .isFalse();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 12: TranscriptionUpdate created via partial() is valid")
    void transcriptionUpdateCreatedViaPartialIsValid(
            @ForAll @StringLength(min = 0, max = 500) String text,
            @ForAll @DoubleRange(min = 0.0, max = 1.0) double confidence,
            @ForAll("positiveSequenceIds") long sequenceId) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        
        TranscriptionUpdate update = TranscriptionUpdate.partial(text, confidence, sequenceId);
        
        assertThat(service.isValidTranscriptionUpdate(update))
            .as("TranscriptionUpdate created via partial() should be valid")
            .isTrue();
        assertThat(update.type())
            .as("Type should be PARTIAL")
            .isEqualTo(TranscriptionType.PARTIAL);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 12: TranscriptionUpdate created via finalResult() is valid")
    void transcriptionUpdateCreatedViaFinalResultIsValid(
            @ForAll @StringLength(min = 0, max = 500) String text,
            @ForAll @DoubleRange(min = 0.0, max = 1.0) double confidence,
            @ForAll("positiveSequenceIds") long sequenceId) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        
        TranscriptionUpdate update = TranscriptionUpdate.finalResult(text, confidence, sequenceId);
        
        assertThat(service.isValidTranscriptionUpdate(update))
            .as("TranscriptionUpdate created via finalResult() should be valid")
            .isTrue();
        assertThat(update.type())
            .as("Type should be FINAL")
            .isEqualTo(TranscriptionType.FINAL);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 12: All valid updates have type PARTIAL or FINAL")
    void allValidUpdatesHaveTypePartialOrFinal(
            @ForAll("validTranscriptionTypes") TranscriptionType type,
            @ForAll @StringLength(min = 0, max = 100) String text,
            @ForAll @DoubleRange(min = 0.0, max = 1.0) double confidence,
            @ForAll("positiveSequenceIds") long sequenceId) {
        
        TranscriptionUpdate update = new TranscriptionUpdate(
            type,
            text,
            confidence,
            Instant.now(),
            sequenceId
        );
        
        assertThat(update.type())
            .as("Type must be either PARTIAL or FINAL")
            .isIn(TranscriptionType.PARTIAL, TranscriptionType.FINAL);
    }

    // ========================================================================
    // Providers
    // ========================================================================

    @Provide
    Arbitrary<TranscriptionType> validTranscriptionTypes() {
        return Arbitraries.of(TranscriptionType.PARTIAL, TranscriptionType.FINAL);
    }

    @Provide
    Arbitrary<Long> positiveSequenceIds() {
        return Arbitraries.longs().between(1L, Long.MAX_VALUE);
    }

    @Provide
    Arbitrary<Long> nonPositiveSequenceIds() {
        return Arbitraries.longs().between(Long.MIN_VALUE, 0L);
    }

    @Provide
    Arbitrary<Double> negativeConfidences() {
        return Arbitraries.doubles().between(-100.0, -0.01);
    }

    @Provide
    Arbitrary<Double> highConfidences() {
        return Arbitraries.doubles().between(1.01, 100.0);
    }

    // ========================================================================
    // Helper methods
    // ========================================================================

    /**
     * Creates a test instance of TranscriptionStreamingServiceImpl with mock dependencies.
     */
    private TranscriptionStreamingServiceImpl createTestService() {
        // Create mock GeminiTranscriptionService
        GeminiTranscriptionService mockGeminiService = new GeminiTranscriptionService() {
            @Override
            public reactor.core.publisher.Flux<TranscriptionUpdate> streamTranscription(
                    reactor.core.publisher.Flux<byte[]> audioChunks, String sessionId) {
                return reactor.core.publisher.Flux.empty();
            }

            @Override
            public reactor.core.publisher.Mono<Void> closeSession(String sessionId) {
                return reactor.core.publisher.Mono.empty();
            }

            @Override
            public double parseConfidenceScore(double rawScore) {
                return Math.max(0.0, Math.min(1.0, rawScore));
            }

            @Override
            public boolean isAvailable() {
                return true;
            }
        };

        // Create mock SessionManager
        SessionManager mockSessionManager = new SessionManager() {
            @Override
            public com.transcription.model.Session createSession(String connectionId) {
                return com.transcription.model.Session.create("test-session", connectionId);
            }

            @Override
            public java.util.Optional<com.transcription.model.Session> getSession(String sessionId) {
                return java.util.Optional.empty();
            }

            @Override
            public java.util.Optional<com.transcription.model.Session> getSessionByConnectionId(String connectionId) {
                return java.util.Optional.empty();
            }

            @Override
            public java.util.Optional<com.transcription.model.Session> updateSessionState(
                    String sessionId, com.transcription.model.SessionState newState) {
                return java.util.Optional.empty();
            }

            @Override
            public java.util.Optional<com.transcription.model.Session> pauseSession(String sessionId) {
                return java.util.Optional.empty();
            }

            @Override
            public java.util.Optional<com.transcription.model.Session> resumeSession(String sessionId) {
                return java.util.Optional.empty();
            }

            @Override
            public boolean addTranscriptionUpdate(String sessionId, TranscriptionUpdate update) {
                return true;
            }

            @Override
            public void closeSession(String sessionId) {
            }

            @Override
            public int getActiveSessionCount() {
                return 0;
            }

            @Override
            public boolean isSessionInState(String sessionId, com.transcription.model.SessionState state) {
                return false;
            }
        };

        return new TranscriptionStreamingServiceImpl(mockGeminiService, mockSessionManager);
    }
}


/**
 * Property-based tests for network interruption data preservation.
 * Feature: realtime-audio-transcription, Property 13: Network Interruption Data Preservation
 */
class NetworkInterruptionDataPreservationPropertyTest {

    // ========================================================================
    // Property 13: Network Interruption Data Preservation
    // Validates: Requirements 9.3
    // For any network interruption during an active session, all audio chunks 
    // received before the interruption SHALL be preserved in the session buffer 
    // without data loss.
    // ========================================================================

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 13: Audio data is preserved after single chunk")
    void audioDataIsPreservedAfterSingleChunk(
            @ForAll("audioChunks") byte[] audioData) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        String sessionId = "test-session-" + System.nanoTime();
        
        // Preserve audio data
        service.preserveAudioData(sessionId, audioData);
        
        // Retrieve preserved data
        List<byte[]> preserved = service.getPreservedAudioData(sessionId);
        
        assertThat(preserved)
            .as("Preserved data should contain exactly one chunk")
            .hasSize(1);
        assertThat(preserved.get(0))
            .as("Preserved chunk should match original data")
            .isEqualTo(audioData);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 13: Multiple audio chunks are preserved in order")
    void multipleAudioChunksArePreservedInOrder(
            @ForAll("audioChunkLists") List<byte[]> audioChunks) {
        
        Assume.that(!audioChunks.isEmpty());
        
        TranscriptionStreamingServiceImpl service = createTestService();
        String sessionId = "test-session-" + System.nanoTime();
        
        // Preserve all audio chunks
        for (byte[] chunk : audioChunks) {
            service.preserveAudioData(sessionId, chunk);
        }
        
        // Retrieve preserved data
        List<byte[]> preserved = service.getPreservedAudioData(sessionId);
        
        assertThat(preserved)
            .as("Number of preserved chunks should match input")
            .hasSize(audioChunks.size());
        
        // Verify order and content
        for (int i = 0; i < audioChunks.size(); i++) {
            assertThat(preserved.get(i))
                .as("Chunk at index %d should match original", i)
                .isEqualTo(audioChunks.get(i));
        }
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 13: Preserved data is independent copy")
    void preservedDataIsIndependentCopy(
            @ForAll("audioChunks") byte[] audioData) {
        
        Assume.that(audioData.length > 0);
        
        TranscriptionStreamingServiceImpl service = createTestService();
        String sessionId = "test-session-" + System.nanoTime();
        
        // Preserve audio data
        service.preserveAudioData(sessionId, audioData);
        
        // Modify original data
        byte originalFirstByte = audioData[0];
        audioData[0] = (byte) (audioData[0] + 1);
        
        // Retrieve preserved data
        List<byte[]> preserved = service.getPreservedAudioData(sessionId);
        
        assertThat(preserved.get(0)[0])
            .as("Preserved data should be independent of original (modification should not affect preserved)")
            .isEqualTo(originalFirstByte);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 13: Empty session returns empty list")
    void emptySessionReturnsEmptyList() {
        TranscriptionStreamingServiceImpl service = createTestService();
        String sessionId = "nonexistent-session-" + System.nanoTime();
        
        List<byte[]> preserved = service.getPreservedAudioData(sessionId);
        
        assertThat(preserved)
            .as("Non-existent session should return empty list")
            .isEmpty();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 13: Total preserved bytes equals sum of input bytes")
    void totalPreservedBytesEqualsSumOfInputBytes(
            @ForAll("audioChunkLists") List<byte[]> audioChunks) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        String sessionId = "test-session-" + System.nanoTime();
        
        // Calculate expected total bytes
        int expectedTotalBytes = audioChunks.stream()
            .mapToInt(chunk -> chunk.length)
            .sum();
        
        // Preserve all audio chunks
        for (byte[] chunk : audioChunks) {
            service.preserveAudioData(sessionId, chunk);
        }
        
        // Calculate actual total bytes
        List<byte[]> preserved = service.getPreservedAudioData(sessionId);
        int actualTotalBytes = preserved.stream()
            .mapToInt(chunk -> chunk.length)
            .sum();
        
        assertThat(actualTotalBytes)
            .as("Total preserved bytes should equal sum of input bytes")
            .isEqualTo(expectedTotalBytes);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 13: Sessions are isolated from each other")
    void sessionsAreIsolatedFromEachOther(
            @ForAll("audioChunks") byte[] audioData1,
            @ForAll("audioChunks") byte[] audioData2) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        String sessionId1 = "session-1-" + System.nanoTime();
        String sessionId2 = "session-2-" + System.nanoTime();
        
        // Preserve data in different sessions
        service.preserveAudioData(sessionId1, audioData1);
        service.preserveAudioData(sessionId2, audioData2);
        
        // Retrieve and verify isolation
        List<byte[]> preserved1 = service.getPreservedAudioData(sessionId1);
        List<byte[]> preserved2 = service.getPreservedAudioData(sessionId2);
        
        assertThat(preserved1)
            .as("Session 1 should have exactly one chunk")
            .hasSize(1);
        assertThat(preserved2)
            .as("Session 2 should have exactly one chunk")
            .hasSize(1);
        assertThat(preserved1.get(0))
            .as("Session 1 data should match audioData1")
            .isEqualTo(audioData1);
        assertThat(preserved2.get(0))
            .as("Session 2 data should match audioData2")
            .isEqualTo(audioData2);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 13: Large audio chunks are preserved correctly")
    void largeAudioChunksArePreservedCorrectly(
            @ForAll("largeAudioChunks") byte[] audioData) {
        
        TranscriptionStreamingServiceImpl service = createTestService();
        String sessionId = "test-session-" + System.nanoTime();
        
        // Preserve large audio data
        service.preserveAudioData(sessionId, audioData);
        
        // Retrieve preserved data
        List<byte[]> preserved = service.getPreservedAudioData(sessionId);
        
        assertThat(preserved)
            .as("Preserved data should contain exactly one chunk")
            .hasSize(1);
        assertThat(preserved.get(0).length)
            .as("Preserved chunk length should match original")
            .isEqualTo(audioData.length);
        assertThat(preserved.get(0))
            .as("Preserved chunk content should match original")
            .isEqualTo(audioData);
    }

    // ========================================================================
    // Providers
    // ========================================================================

    @Provide
    Arbitrary<byte[]> audioChunks() {
        return Arbitraries.bytes().array(byte[].class).ofMinSize(1).ofMaxSize(1000);
    }

    @Provide
    Arbitrary<List<byte[]>> audioChunkLists() {
        return audioChunks().list().ofMinSize(0).ofMaxSize(10);
    }

    @Provide
    Arbitrary<byte[]> largeAudioChunks() {
        return Arbitraries.bytes().array(byte[].class).ofMinSize(10000).ofMaxSize(50000);
    }

    // ========================================================================
    // Helper methods
    // ========================================================================

    /**
     * Creates a test instance of TranscriptionStreamingServiceImpl with mock dependencies.
     */
    private TranscriptionStreamingServiceImpl createTestService() {
        // Create mock GeminiTranscriptionService
        GeminiTranscriptionService mockGeminiService = new GeminiTranscriptionService() {
            @Override
            public reactor.core.publisher.Flux<TranscriptionUpdate> streamTranscription(
                    reactor.core.publisher.Flux<byte[]> audioChunks, String sessionId) {
                return reactor.core.publisher.Flux.empty();
            }

            @Override
            public reactor.core.publisher.Mono<Void> closeSession(String sessionId) {
                return reactor.core.publisher.Mono.empty();
            }

            @Override
            public double parseConfidenceScore(double rawScore) {
                return Math.max(0.0, Math.min(1.0, rawScore));
            }

            @Override
            public boolean isAvailable() {
                return true;
            }
        };

        // Create mock SessionManager
        SessionManager mockSessionManager = new SessionManager() {
            @Override
            public com.transcription.model.Session createSession(String connectionId) {
                return com.transcription.model.Session.create("test-session", connectionId);
            }

            @Override
            public java.util.Optional<com.transcription.model.Session> getSession(String sessionId) {
                return java.util.Optional.empty();
            }

            @Override
            public java.util.Optional<com.transcription.model.Session> getSessionByConnectionId(String connectionId) {
                return java.util.Optional.empty();
            }

            @Override
            public java.util.Optional<com.transcription.model.Session> updateSessionState(
                    String sessionId, com.transcription.model.SessionState newState) {
                return java.util.Optional.empty();
            }

            @Override
            public java.util.Optional<com.transcription.model.Session> pauseSession(String sessionId) {
                return java.util.Optional.empty();
            }

            @Override
            public java.util.Optional<com.transcription.model.Session> resumeSession(String sessionId) {
                return java.util.Optional.empty();
            }

            @Override
            public boolean addTranscriptionUpdate(String sessionId, TranscriptionUpdate update) {
                return true;
            }

            @Override
            public void closeSession(String sessionId) {
            }

            @Override
            public int getActiveSessionCount() {
                return 0;
            }

            @Override
            public boolean isSessionInState(String sessionId, com.transcription.model.SessionState state) {
                return false;
            }
        };

        return new TranscriptionStreamingServiceImpl(mockGeminiService, mockSessionManager);
    }
}
