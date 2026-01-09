package com.transcription.service;

/**
 * Utility class for calculating exponential backoff delays for retry operations.
 * Implements the formula: delay_n = base_delay * 2^n, capped at max_delay.
 */
public class RetryBackoffCalculator {

    private final long baseDelay;
    private final long maxDelay;

    /**
     * Creates a new RetryBackoffCalculator.
     *
     * @param baseDelay Base delay in milliseconds for the first retry
     * @param maxDelay  Maximum delay in milliseconds (cap)
     */
    public RetryBackoffCalculator(long baseDelay, long maxDelay) {
        if (baseDelay <= 0) {
            throw new IllegalArgumentException("Base delay must be positive");
        }
        if (maxDelay < baseDelay) {
            throw new IllegalArgumentException("Max delay must be >= base delay");
        }
        this.baseDelay = baseDelay;
        this.maxDelay = maxDelay;
    }

    /**
     * Calculates the backoff delay for a given retry attempt.
     * Uses exponential backoff: delay_n = base_delay * 2^n, capped at max_delay.
     *
     * @param attemptNumber The retry attempt number (0-based)
     * @return The calculated delay in milliseconds
     */
    public long calculateDelay(int attemptNumber) {
        if (attemptNumber < 0) {
            throw new IllegalArgumentException("Attempt number must be non-negative");
        }

        // Calculate exponential backoff: base_delay * 2^attemptNumber
        // Use bit shifting for efficiency: 2^n = 1 << n
        long multiplier = 1L << Math.min(attemptNumber, 30); // Cap at 2^30 to prevent overflow
        long delay = baseDelay * multiplier;

        // Handle overflow - if delay becomes negative or exceeds max, use max
        if (delay < 0 || delay > maxDelay) {
            return maxDelay;
        }

        return delay;
    }

    /**
     * Calculates the backoff delay with jitter to prevent thundering herd.
     *
     * @param attemptNumber The retry attempt number (0-based)
     * @param jitterFactor  Factor for jitter (0.0 to 1.0), e.g., 0.1 for ±10%
     * @return The calculated delay with jitter in milliseconds
     */
    public long calculateDelayWithJitter(int attemptNumber, double jitterFactor) {
        long baseCalculatedDelay = calculateDelay(attemptNumber);
        
        if (jitterFactor <= 0 || jitterFactor > 1.0) {
            return baseCalculatedDelay;
        }

        // Add random jitter: delay ± (delay * jitterFactor)
        double jitter = (Math.random() * 2 - 1) * jitterFactor * baseCalculatedDelay;
        long delayWithJitter = baseCalculatedDelay + (long) jitter;

        // Ensure delay stays within bounds
        return Math.max(baseDelay, Math.min(maxDelay, delayWithJitter));
    }

    /**
     * Gets the base delay.
     *
     * @return Base delay in milliseconds
     */
    public long getBaseDelay() {
        return baseDelay;
    }

    /**
     * Gets the maximum delay.
     *
     * @return Maximum delay in milliseconds
     */
    public long getMaxDelay() {
        return maxDelay;
    }

    /**
     * Calculates the total time for all retries up to a given attempt.
     *
     * @param maxAttempts Maximum number of retry attempts
     * @return Total delay time in milliseconds
     */
    public long calculateTotalDelayTime(int maxAttempts) {
        long total = 0;
        for (int i = 0; i < maxAttempts; i++) {
            total += calculateDelay(i);
        }
        return total;
    }
}
