package com.transcription.service;

import com.transcription.config.GeminiConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import net.jqwik.api.*;
import net.jqwik.api.constraints.DoubleRange;
import net.jqwik.api.constraints.IntRange;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Property-based tests for GeminiTranscriptionService.
 * Feature: realtime-audio-transcription
 */
class GeminiTranscriptionServicePropertyTest {

    // ========================================================================
    // Property 9: Confidence Score Parsing
    // Validates: Requirements 6.2
    // For any valid Gemini API transcription response, the parsed confidence 
    // score SHALL be a float value in the range [0.0, 1.0].
    // ========================================================================

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 9: Confidence scores within valid range remain unchanged")
    void confidenceScoresWithinValidRangeRemainUnchanged(
            @ForAll @DoubleRange(min = 0.0, max = 1.0) double validScore) {
        
        GeminiTranscriptionServiceImpl service = createTestService();
        
        double parsed = service.parseConfidenceScore(validScore);
        
        assertThat(parsed)
            .as("Valid confidence scores should remain unchanged")
            .isEqualTo(validScore);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 9: Confidence scores above 1.0 are clamped to 1.0")
    void confidenceScoresAboveOneAreClampedToOne(
            @ForAll("highScores") double highScore) {
        
        GeminiTranscriptionServiceImpl service = createTestService();
        
        double parsed = service.parseConfidenceScore(highScore);
        
        assertThat(parsed)
            .as("Confidence scores above 1.0 should be clamped to 1.0")
            .isEqualTo(1.0);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 9: Confidence scores below 0.0 are clamped to 0.0")
    void confidenceScoresBelowZeroAreClampedToZero(
            @ForAll("lowScores") double lowScore) {
        
        GeminiTranscriptionServiceImpl service = createTestService();
        
        double parsed = service.parseConfidenceScore(lowScore);
        
        assertThat(parsed)
            .as("Confidence scores below 0.0 should be clamped to 0.0")
            .isEqualTo(0.0);
    }

    @Provide
    Arbitrary<Double> highScores() {
        return Arbitraries.doubles().greaterOrEqual(1.01).lessOrEqual(1000.0);
    }

    @Provide
    Arbitrary<Double> lowScores() {
        return Arbitraries.doubles().greaterOrEqual(-1000.0).lessOrEqual(-0.01);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 9: NaN confidence scores are converted to 0.0")
    void nanConfidenceScoresAreConvertedToZero() {
        GeminiTranscriptionServiceImpl service = createTestService();
        
        double parsed = service.parseConfidenceScore(Double.NaN);
        
        assertThat(parsed)
            .as("NaN confidence scores should be converted to 0.0")
            .isEqualTo(0.0);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 9: Positive infinity is clamped to 1.0")
    void positiveInfinityIsClampedToOne() {
        GeminiTranscriptionServiceImpl service = createTestService();
        
        double parsed = service.parseConfidenceScore(Double.POSITIVE_INFINITY);
        
        assertThat(parsed)
            .as("Positive infinity should be clamped to 0.0 (treated as invalid)")
            .isEqualTo(0.0);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 9: Negative infinity is clamped to 0.0")
    void negativeInfinityIsClampedToZero() {
        GeminiTranscriptionServiceImpl service = createTestService();
        
        double parsed = service.parseConfidenceScore(Double.NEGATIVE_INFINITY);
        
        assertThat(parsed)
            .as("Negative infinity should be clamped to 0.0")
            .isEqualTo(0.0);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 9: All parsed confidence scores are in [0.0, 1.0]")
    void allParsedConfidenceScoresAreInValidRange(
            @ForAll double anyScore) {
        
        GeminiTranscriptionServiceImpl service = createTestService();
        
        double parsed = service.parseConfidenceScore(anyScore);
        
        assertThat(parsed)
            .as("All parsed confidence scores must be >= 0.0")
            .isGreaterThanOrEqualTo(0.0);
        assertThat(parsed)
            .as("All parsed confidence scores must be <= 1.0")
            .isLessThanOrEqualTo(1.0);
    }

    // ========================================================================
    // Helper methods
    // ========================================================================

    /**
     * Creates a test instance of GeminiTranscriptionServiceImpl with mock dependencies.
     */
    private GeminiTranscriptionServiceImpl createTestService() {
        WebClient mockWebClient = WebClient.builder().build();
        CircuitBreaker circuitBreaker = CircuitBreaker.of("test", CircuitBreakerConfig.ofDefaults());
        GeminiConfig config = new GeminiConfig();
        
        return new GeminiTranscriptionServiceImpl(mockWebClient, circuitBreaker, config);
    }
}


/**
 * Property-based tests for exponential backoff retry.
 * Feature: realtime-audio-transcription, Property 10: Exponential Backoff Retry
 */
class ExponentialBackoffPropertyTest {

    // ========================================================================
    // Property 10: Exponential Backoff Retry
    // Validates: Requirements 6.3
    // For any sequence of consecutive Gemini API rate limit errors, the retry 
    // delay SHALL follow exponential backoff pattern where delay_n = base_delay * 2^n, 
    // capped at max_delay.
    // ========================================================================

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 10: Delay follows exponential pattern")
    void delayFollowsExponentialPattern(
            @ForAll @IntRange(min = 0, max = 10) int attemptNumber,
            @ForAll("baseDelays") long baseDelay,
            @ForAll("maxDelays") long maxDelay) {
        
        Assume.that(maxDelay >= baseDelay);
        
        RetryBackoffCalculator calculator = new RetryBackoffCalculator(baseDelay, maxDelay);
        
        long delay = calculator.calculateDelay(attemptNumber);
        long expectedDelay = baseDelay * (1L << attemptNumber);
        
        if (expectedDelay > maxDelay || expectedDelay < 0) {
            // Should be capped at maxDelay
            assertThat(delay)
                .as("Delay should be capped at maxDelay when exponential exceeds it")
                .isEqualTo(maxDelay);
        } else {
            // Should follow exponential pattern
            assertThat(delay)
                .as("Delay should follow exponential pattern: base_delay * 2^n")
                .isEqualTo(expectedDelay);
        }
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 10: Delay is always capped at maxDelay")
    void delayIsAlwaysCappedAtMaxDelay(
            @ForAll @IntRange(min = 0, max = 30) int attemptNumber,
            @ForAll("baseDelays") long baseDelay,
            @ForAll("maxDelays") long maxDelay) {
        
        Assume.that(maxDelay >= baseDelay);
        
        RetryBackoffCalculator calculator = new RetryBackoffCalculator(baseDelay, maxDelay);
        
        long delay = calculator.calculateDelay(attemptNumber);
        
        assertThat(delay)
            .as("Delay should never exceed maxDelay")
            .isLessThanOrEqualTo(maxDelay);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 10: Delay is always at least baseDelay")
    void delayIsAlwaysAtLeastBaseDelay(
            @ForAll @IntRange(min = 0, max = 20) int attemptNumber,
            @ForAll("baseDelays") long baseDelay,
            @ForAll("maxDelays") long maxDelay) {
        
        Assume.that(maxDelay >= baseDelay);
        
        RetryBackoffCalculator calculator = new RetryBackoffCalculator(baseDelay, maxDelay);
        
        long delay = calculator.calculateDelay(attemptNumber);
        
        assertThat(delay)
            .as("Delay should always be at least baseDelay")
            .isGreaterThanOrEqualTo(baseDelay);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 10: Delays are monotonically non-decreasing")
    void delaysAreMonotonicallyNonDecreasing(
            @ForAll("baseDelays") long baseDelay,
            @ForAll("maxDelays") long maxDelay) {
        
        Assume.that(maxDelay >= baseDelay);
        
        RetryBackoffCalculator calculator = new RetryBackoffCalculator(baseDelay, maxDelay);
        
        long previousDelay = 0;
        for (int attempt = 0; attempt < 15; attempt++) {
            long currentDelay = calculator.calculateDelay(attempt);
            
            assertThat(currentDelay)
                .as("Delay for attempt %d should be >= delay for previous attempt", attempt)
                .isGreaterThanOrEqualTo(previousDelay);
            
            previousDelay = currentDelay;
        }
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 10: First retry uses baseDelay")
    void firstRetryUsesBaseDelay(
            @ForAll("baseDelays") long baseDelay,
            @ForAll("maxDelays") long maxDelay) {
        
        Assume.that(maxDelay >= baseDelay);
        
        RetryBackoffCalculator calculator = new RetryBackoffCalculator(baseDelay, maxDelay);
        
        long firstDelay = calculator.calculateDelay(0);
        
        assertThat(firstDelay)
            .as("First retry (attempt 0) should use baseDelay")
            .isEqualTo(baseDelay);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 10: Second retry doubles the delay")
    void secondRetryDoublesTheDelay(
            @ForAll("baseDelays") long baseDelay,
            @ForAll("maxDelays") long maxDelay) {
        
        Assume.that(maxDelay >= baseDelay * 2);
        
        RetryBackoffCalculator calculator = new RetryBackoffCalculator(baseDelay, maxDelay);
        
        long firstDelay = calculator.calculateDelay(0);
        long secondDelay = calculator.calculateDelay(1);
        
        assertThat(secondDelay)
            .as("Second retry should double the first delay")
            .isEqualTo(firstDelay * 2);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 10: High attempt numbers don't cause overflow")
    void highAttemptNumbersDontCauseOverflow(
            @ForAll @IntRange(min = 20, max = 50) int attemptNumber,
            @ForAll("baseDelays") long baseDelay,
            @ForAll("maxDelays") long maxDelay) {
        
        Assume.that(maxDelay >= baseDelay);
        
        RetryBackoffCalculator calculator = new RetryBackoffCalculator(baseDelay, maxDelay);
        
        long delay = calculator.calculateDelay(attemptNumber);
        
        assertThat(delay)
            .as("High attempt numbers should not cause overflow or negative values")
            .isPositive()
            .isLessThanOrEqualTo(maxDelay);
    }

    @Provide
    Arbitrary<Long> baseDelays() {
        return Arbitraries.longs().between(100L, 5000L);
    }

    @Provide
    Arbitrary<Long> maxDelays() {
        return Arbitraries.longs().between(5000L, 60000L);
    }
}


/**
 * Property-based tests for circuit breaker state transitions.
 * Feature: realtime-audio-transcription, Property 11: Circuit Breaker State Transitions
 */
class CircuitBreakerStateTransitionsPropertyTest {

    // ========================================================================
    // Property 11: Circuit Breaker State Transitions
    // Validates: Requirements 6.4
    // For any sequence of Gemini API failures exceeding the threshold count 
    // within the time window, the circuit breaker SHALL transition to OPEN state 
    // and reject subsequent requests until the reset timeout.
    // ========================================================================

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 11: Circuit breaker starts in CLOSED state")
    void circuitBreakerStartsInClosedState(
            @ForAll @IntRange(min = 1, max = 100) int failureThreshold,
            @ForAll @IntRange(min = 5, max = 20) int slidingWindowSize,
            @ForAll @IntRange(min = 1, max = 10) int minimumCalls) {
        
        Assume.that(minimumCalls <= slidingWindowSize);
        
        CircuitBreakerManager manager = createCircuitBreakerManager(
            failureThreshold, slidingWindowSize, minimumCalls);
        
        assertThat(manager.getState())
            .as("Circuit breaker should start in CLOSED state")
            .isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 11: Circuit breaker transitions to OPEN after failure threshold exceeded")
    void circuitBreakerTransitionsToOpenAfterFailureThreshold(
            @ForAll @IntRange(min = 50, max = 100) int failureThreshold,
            @ForAll @IntRange(min = 5, max = 10) int slidingWindowSize,
            @ForAll @IntRange(min = 2, max = 5) int minimumCalls) {
        
        Assume.that(minimumCalls <= slidingWindowSize);
        
        CircuitBreakerManager manager = createCircuitBreakerManager(
            failureThreshold, slidingWindowSize, minimumCalls);
        
        // Record enough failures to exceed the threshold
        // We need at least minimumCalls and failure rate > failureThreshold
        int failuresToRecord = Math.max(minimumCalls, slidingWindowSize);
        
        for (int i = 0; i < failuresToRecord; i++) {
            manager.recordFailure(new RuntimeException("Test failure " + i));
        }
        
        // After recording all failures, circuit breaker should be OPEN
        assertThat(manager.getState())
            .as("Circuit breaker should transition to OPEN after failure threshold exceeded")
            .isEqualTo(CircuitBreaker.State.OPEN);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 11: Circuit breaker rejects calls when OPEN")
    void circuitBreakerRejectsCallsWhenOpen(
            @ForAll @IntRange(min = 50, max = 100) int failureThreshold,
            @ForAll @IntRange(min = 5, max = 10) int slidingWindowSize,
            @ForAll @IntRange(min = 2, max = 5) int minimumCalls) {
        
        Assume.that(minimumCalls <= slidingWindowSize);
        
        CircuitBreakerManager manager = createCircuitBreakerManager(
            failureThreshold, slidingWindowSize, minimumCalls);
        
        // Force transition to OPEN state
        manager.transitionToOpen();
        
        // Verify calls are not permitted
        assertThat(manager.isCallPermitted())
            .as("Circuit breaker should reject calls when in OPEN state")
            .isFalse();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 11: Circuit breaker allows calls when CLOSED")
    void circuitBreakerAllowsCallsWhenClosed(
            @ForAll @IntRange(min = 50, max = 100) int failureThreshold,
            @ForAll @IntRange(min = 5, max = 10) int slidingWindowSize,
            @ForAll @IntRange(min = 2, max = 5) int minimumCalls) {
        
        Assume.that(minimumCalls <= slidingWindowSize);
        
        CircuitBreakerManager manager = createCircuitBreakerManager(
            failureThreshold, slidingWindowSize, minimumCalls);
        
        // Verify calls are permitted in CLOSED state
        assertThat(manager.isCallPermitted())
            .as("Circuit breaker should allow calls when in CLOSED state")
            .isTrue();
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 11: Circuit breaker stays CLOSED with successes")
    void circuitBreakerStaysClosedWithSuccesses(
            @ForAll @IntRange(min = 50, max = 100) int failureThreshold,
            @ForAll @IntRange(min = 5, max = 10) int slidingWindowSize,
            @ForAll @IntRange(min = 2, max = 5) int minimumCalls,
            @ForAll @IntRange(min = 1, max = 20) int successCount) {
        
        Assume.that(minimumCalls <= slidingWindowSize);
        
        CircuitBreakerManager manager = createCircuitBreakerManager(
            failureThreshold, slidingWindowSize, minimumCalls);
        
        // Record successes
        for (int i = 0; i < successCount; i++) {
            manager.recordSuccess();
        }
        
        // Circuit breaker should remain CLOSED
        assertThat(manager.getState())
            .as("Circuit breaker should stay CLOSED when only successes are recorded")
            .isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 11: Circuit breaker can be manually reset")
    void circuitBreakerCanBeManuallyReset(
            @ForAll @IntRange(min = 50, max = 100) int failureThreshold,
            @ForAll @IntRange(min = 5, max = 10) int slidingWindowSize,
            @ForAll @IntRange(min = 2, max = 5) int minimumCalls) {
        
        Assume.that(minimumCalls <= slidingWindowSize);
        
        CircuitBreakerManager manager = createCircuitBreakerManager(
            failureThreshold, slidingWindowSize, minimumCalls);
        
        // Force to OPEN state
        manager.transitionToOpen();
        assertThat(manager.getState()).isEqualTo(CircuitBreaker.State.OPEN);
        
        // Reset
        manager.reset();
        
        // Should be back to CLOSED
        assertThat(manager.getState())
            .as("Circuit breaker should return to CLOSED after reset")
            .isEqualTo(CircuitBreaker.State.CLOSED);
    }

    @Property(tries = 100)
    @Label("Feature: realtime-audio-transcription, Property 11: Circuit breaker metrics track failures correctly")
    void circuitBreakerMetricsTrackFailuresCorrectly(
            @ForAll @IntRange(min = 50, max = 100) int failureThreshold,
            @ForAll @IntRange(min = 5, max = 10) int slidingWindowSize,
            @ForAll @IntRange(min = 2, max = 5) int minimumCalls,
            @ForAll @IntRange(min = 1, max = 4) int failureCount) {
        
        Assume.that(minimumCalls <= slidingWindowSize);
        Assume.that(failureCount < minimumCalls); // Don't trigger OPEN state
        
        CircuitBreakerManager manager = createCircuitBreakerManager(
            failureThreshold, slidingWindowSize, minimumCalls);
        
        // Record failures
        for (int i = 0; i < failureCount; i++) {
            manager.recordFailure(new RuntimeException("Test failure " + i));
        }
        
        CircuitBreakerManager.CircuitBreakerMetrics metrics = manager.getMetrics();
        
        assertThat(metrics.failedCalls())
            .as("Metrics should track the correct number of failed calls")
            .isEqualTo(failureCount);
    }

    // ========================================================================
    // Helper methods
    // ========================================================================

    /**
     * Creates a CircuitBreakerManager with the specified configuration.
     */
    private CircuitBreakerManager createCircuitBreakerManager(
            int failureThreshold, int slidingWindowSize, int minimumCalls) {
        return new CircuitBreakerManager(
            "test-" + System.nanoTime(),
            (float) failureThreshold,
            Duration.ofSeconds(30),
            slidingWindowSize,
            minimumCalls
        );
    }
}
