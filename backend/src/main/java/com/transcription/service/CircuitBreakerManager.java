package com.transcription.service;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Manages circuit breaker state transitions and provides utilities for
 * monitoring and controlling circuit breaker behavior.
 */
public class CircuitBreakerManager {

    private static final Logger log = LoggerFactory.getLogger(CircuitBreakerManager.class);

    private final CircuitBreaker circuitBreaker;
    private final int failureThreshold;
    private final Duration waitDurationInOpenState;
    private final int slidingWindowSize;
    private final int minimumNumberOfCalls;

    /**
     * Creates a new CircuitBreakerManager with the specified configuration.
     *
     * @param name                    Name of the circuit breaker
     * @param failureRateThreshold    Percentage of failures to trigger OPEN state (0-100)
     * @param waitDurationInOpenState Duration to wait in OPEN state before transitioning to HALF_OPEN
     * @param slidingWindowSize       Size of the sliding window for failure rate calculation
     * @param minimumNumberOfCalls    Minimum calls before failure rate is calculated
     */
    public CircuitBreakerManager(
            String name,
            float failureRateThreshold,
            Duration waitDurationInOpenState,
            int slidingWindowSize,
            int minimumNumberOfCalls) {
        
        this.failureThreshold = (int) failureRateThreshold;
        this.waitDurationInOpenState = waitDurationInOpenState;
        this.slidingWindowSize = slidingWindowSize;
        this.minimumNumberOfCalls = minimumNumberOfCalls;

        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
            .failureRateThreshold(failureRateThreshold)
            .waitDurationInOpenState(waitDurationInOpenState)
            .slidingWindowSize(slidingWindowSize)
            .minimumNumberOfCalls(minimumNumberOfCalls)
            .automaticTransitionFromOpenToHalfOpenEnabled(true)
            .build();

        this.circuitBreaker = CircuitBreaker.of(name, config);

        // Register event listeners for monitoring
        registerEventListeners();
    }

    /**
     * Creates a CircuitBreakerManager with an existing CircuitBreaker instance.
     *
     * @param circuitBreaker Existing circuit breaker instance
     */
    public CircuitBreakerManager(CircuitBreaker circuitBreaker) {
        this.circuitBreaker = circuitBreaker;
        CircuitBreakerConfig config = circuitBreaker.getCircuitBreakerConfig();
        this.failureThreshold = (int) config.getFailureRateThreshold();
        this.waitDurationInOpenState = config.getMaxWaitDurationInHalfOpenState();
        this.slidingWindowSize = config.getSlidingWindowSize();
        this.minimumNumberOfCalls = config.getMinimumNumberOfCalls();
        
        registerEventListeners();
    }

    /**
     * Registers event listeners for circuit breaker state changes.
     */
    private void registerEventListeners() {
        circuitBreaker.getEventPublisher()
            .onStateTransition(event -> 
                log.info("Circuit breaker '{}' state transition: {} -> {}", 
                    circuitBreaker.getName(),
                    event.getStateTransition().getFromState(),
                    event.getStateTransition().getToState()))
            .onError(event -> 
                log.warn("Circuit breaker '{}' recorded error: {}", 
                    circuitBreaker.getName(),
                    event.getThrowable().getMessage()))
            .onSuccess(event -> 
                log.debug("Circuit breaker '{}' recorded success", 
                    circuitBreaker.getName()));
    }

    /**
     * Gets the current state of the circuit breaker.
     *
     * @return Current circuit breaker state
     */
    public CircuitBreaker.State getState() {
        return circuitBreaker.getState();
    }

    /**
     * Checks if the circuit breaker is allowing calls.
     *
     * @return true if calls are permitted (CLOSED or HALF_OPEN state)
     */
    public boolean isCallPermitted() {
        return circuitBreaker.tryAcquirePermission();
    }

    /**
     * Records a successful call.
     */
    public void recordSuccess() {
        circuitBreaker.onSuccess(0, java.util.concurrent.TimeUnit.MILLISECONDS);
    }

    /**
     * Records a failed call.
     *
     * @param throwable The exception that caused the failure
     */
    public void recordFailure(Throwable throwable) {
        circuitBreaker.onError(0, java.util.concurrent.TimeUnit.MILLISECONDS, throwable);
    }

    /**
     * Manually transitions the circuit breaker to OPEN state.
     */
    public void transitionToOpen() {
        circuitBreaker.transitionToOpenState();
        log.info("Circuit breaker '{}' manually transitioned to OPEN", circuitBreaker.getName());
    }

    /**
     * Manually transitions the circuit breaker to CLOSED state.
     */
    public void transitionToClosed() {
        circuitBreaker.transitionToClosedState();
        log.info("Circuit breaker '{}' manually transitioned to CLOSED", circuitBreaker.getName());
    }

    /**
     * Manually transitions the circuit breaker to HALF_OPEN state.
     */
    public void transitionToHalfOpen() {
        circuitBreaker.transitionToHalfOpenState();
        log.info("Circuit breaker '{}' manually transitioned to HALF_OPEN", circuitBreaker.getName());
    }

    /**
     * Resets the circuit breaker to its initial CLOSED state.
     */
    public void reset() {
        circuitBreaker.reset();
        log.info("Circuit breaker '{}' reset to initial state", circuitBreaker.getName());
    }

    /**
     * Gets the underlying CircuitBreaker instance.
     *
     * @return The circuit breaker instance
     */
    public CircuitBreaker getCircuitBreaker() {
        return circuitBreaker;
    }

    /**
     * Gets the failure rate threshold.
     *
     * @return Failure rate threshold percentage
     */
    public int getFailureThreshold() {
        return failureThreshold;
    }

    /**
     * Gets the wait duration in open state.
     *
     * @return Wait duration
     */
    public Duration getWaitDurationInOpenState() {
        return waitDurationInOpenState;
    }

    /**
     * Gets the sliding window size.
     *
     * @return Sliding window size
     */
    public int getSlidingWindowSize() {
        return slidingWindowSize;
    }

    /**
     * Gets the minimum number of calls.
     *
     * @return Minimum number of calls
     */
    public int getMinimumNumberOfCalls() {
        return minimumNumberOfCalls;
    }

    /**
     * Gets circuit breaker metrics.
     *
     * @return CircuitBreakerMetrics containing current statistics
     */
    public CircuitBreakerMetrics getMetrics() {
        var metrics = circuitBreaker.getMetrics();
        return new CircuitBreakerMetrics(
            metrics.getFailureRate(),
            metrics.getNumberOfSuccessfulCalls(),
            metrics.getNumberOfFailedCalls(),
            metrics.getNumberOfNotPermittedCalls(),
            getState()
        );
    }

    /**
     * Record class for circuit breaker metrics.
     */
    public record CircuitBreakerMetrics(
        float failureRate,
        int successfulCalls,
        int failedCalls,
        long notPermittedCalls,
        CircuitBreaker.State state
    ) {}
}
