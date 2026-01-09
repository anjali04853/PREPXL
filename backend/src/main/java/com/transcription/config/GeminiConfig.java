package com.transcription.config;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;

/**
 * Configuration for Gemini API client with resilience patterns.
 */
@Configuration
public class GeminiConfig {

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.api.base-url}")
    private String baseUrl;

    @Value("${gemini.api.timeout.connect:5000}")
    private int connectTimeout;

    @Value("${gemini.api.timeout.read:30000}")
    private int readTimeout;

    @Value("${resilience.circuit-breaker.failure-rate-threshold:50}")
    private float failureRateThreshold;

    @Value("${resilience.circuit-breaker.wait-duration-in-open-state:30000}")
    private long waitDurationInOpenState;

    @Value("${resilience.circuit-breaker.sliding-window-size:10}")
    private int slidingWindowSize;

    @Value("${resilience.circuit-breaker.minimum-number-of-calls:5}")
    private int minimumNumberOfCalls;

    @Value("${resilience.retry.max-attempts:3}")
    private int maxRetryAttempts;

    @Value("${resilience.retry.base-delay:1000}")
    private long baseDelay;

    @Value("${resilience.retry.max-delay:30000}")
    private long maxDelay;

    @Bean
    public WebClient geminiWebClient() {
        return WebClient.builder()
            .baseUrl(baseUrl)
            .defaultHeader("Content-Type", "application/json")
            .build();
    }

    @Bean
    public CircuitBreaker geminiCircuitBreaker() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
            .failureRateThreshold(failureRateThreshold)
            .waitDurationInOpenState(Duration.ofMillis(waitDurationInOpenState))
            .slidingWindowSize(slidingWindowSize)
            .minimumNumberOfCalls(minimumNumberOfCalls)
            .build();
        return CircuitBreaker.of("geminiApi", config);
    }

    @Bean
    public RetryConfig geminiRetryConfig() {
        return RetryConfig.custom()
            .maxAttempts(maxRetryAttempts)
            .waitDuration(Duration.ofMillis(baseDelay))
            .retryExceptions(GeminiRateLimitException.class)
            .build();
    }

    @Bean
    public Retry geminiRetry(RetryConfig geminiRetryConfig) {
        return Retry.of("geminiRetry", geminiRetryConfig);
    }

    public String getApiKey() {
        return apiKey;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public long getBaseDelay() {
        return baseDelay;
    }

    public long getMaxDelay() {
        return maxDelay;
    }

    public int getMaxRetryAttempts() {
        return maxRetryAttempts;
    }

    /**
     * Exception thrown when Gemini API returns a rate limit error.
     */
    public static class GeminiRateLimitException extends RuntimeException {
        public GeminiRateLimitException(String message) {
            super(message);
        }
    }

    /**
     * Exception thrown when Gemini API returns an error.
     */
    public static class GeminiApiException extends RuntimeException {
        private final int statusCode;

        public GeminiApiException(String message, int statusCode) {
            super(message);
            this.statusCode = statusCode;
        }

        public int getStatusCode() {
            return statusCode;
        }
    }
}
