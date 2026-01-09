package com.transcription.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.transcription.config.GeminiConfig;
import com.transcription.model.TranscriptionUpdate;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.reactor.circuitbreaker.operator.CircuitBreakerOperator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Implementation of GeminiTranscriptionService that streams audio to Gemini API
 * and receives transcription responses with circuit breaker and retry patterns.
 * 
 * Note: Gemini's standard generateContent API doesn't support real-time transcription.
 * This implementation batches audio chunks and sends them periodically for transcription.
 * For true real-time transcription, consider using Google Cloud Speech-to-Text API
 * or Gemini Live API (WebSocket-based).
 */
@Service
public class GeminiTranscriptionServiceImpl implements GeminiTranscriptionService {

    private static final Logger log = LoggerFactory.getLogger(GeminiTranscriptionServiceImpl.class);

    private final WebClient webClient;
    private final CircuitBreaker circuitBreaker;
    private final GeminiConfig geminiConfig;
    private final ObjectMapper objectMapper;

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.api.model}")
    private String model;

    @Value("${gemini.api.min-request-interval-ms:5000}")
    private long minRequestIntervalMs;

    /**
     * Per-session sequence counters for transcription updates.
     */
    private final Map<String, AtomicLong> sessionSequenceCounters = new ConcurrentHashMap<>();

    /**
     * Tracks active sessions for cleanup.
     */
    private final Map<String, Boolean> activeSessions = new ConcurrentHashMap<>();

    /**
     * Tracks last request time per session to throttle API calls.
     */
    private final Map<String, AtomicLong> lastRequestTime = new ConcurrentHashMap<>();

    public GeminiTranscriptionServiceImpl(
            WebClient geminiWebClient,
            CircuitBreaker geminiCircuitBreaker,
            GeminiConfig geminiConfig) {
        this.webClient = geminiWebClient;
        this.circuitBreaker = geminiCircuitBreaker;
        this.geminiConfig = geminiConfig;
        this.objectMapper = new ObjectMapper();
    }

    @Override
    public Flux<TranscriptionUpdate> streamTranscription(Flux<byte[]> audioChunks, String sessionId) {
        activeSessions.put(sessionId, true);
        sessionSequenceCounters.putIfAbsent(sessionId, new AtomicLong(0));
        lastRequestTime.putIfAbsent(sessionId, new AtomicLong(0));

        log.info("Starting transcription stream for session: {}", sessionId);

        // Buffer audio chunks for ~5 seconds (20 chunks at 250ms each) before sending
        // This reduces API calls and avoids rate limits
        return audioChunks
            .buffer(Duration.ofSeconds(5)) // Buffer 5 seconds of audio
            .filter(chunks -> !chunks.isEmpty())
            .flatMap(chunks -> {
                // Combine chunks into a single audio buffer
                int totalSize = chunks.stream().mapToInt(c -> c.length).sum();
                byte[] combined = new byte[totalSize];
                int offset = 0;
                for (byte[] chunk : chunks) {
                    System.arraycopy(chunk, 0, combined, offset, chunk.length);
                    offset += chunk.length;
                }
                
                // Check if we should throttle
                long now = System.currentTimeMillis();
                long lastTime = lastRequestTime.get(sessionId).get();
                long timeSinceLastRequest = now - lastTime;
                
                if (timeSinceLastRequest < minRequestIntervalMs && lastTime > 0) {
                    long delay = minRequestIntervalMs - timeSinceLastRequest;
                    log.debug("Throttling API call for session {}, waiting {}ms", sessionId, delay);
                    return Mono.delay(Duration.ofMillis(delay))
                        .flatMap(ignored -> {
                            lastRequestTime.get(sessionId).set(System.currentTimeMillis());
                            return transcribeChunk(combined, sessionId);
                        });
                }
                
                lastRequestTime.get(sessionId).set(now);
                log.info("Processing batched audio: {} chunks, {} bytes for session {}", 
                    chunks.size(), totalSize, sessionId);
                return transcribeChunk(combined, sessionId);
            }, 1) // Limit concurrency to 1 to avoid parallel API calls
            .transformDeferred(CircuitBreakerOperator.of(circuitBreaker))
            .doOnError(e -> log.error("Transcription error for session {}: {}", sessionId, e.getMessage()))
            .doOnComplete(() -> log.info("Transcription stream completed for session: {}", sessionId))
            .doFinally(signal -> {
                if (!activeSessions.getOrDefault(sessionId, false)) {
                    cleanupSession(sessionId);
                }
            });
    }

    /**
     * Transcribes a single audio chunk by sending it to Gemini API.
     */
    private Mono<TranscriptionUpdate> transcribeChunk(byte[] audioData, String sessionId) {
        String base64Audio = Base64.getEncoder().encodeToString(audioData);
        log.info("Sending {} bytes of audio to Gemini API for session {}", audioData.length, sessionId);

        // Build the request body for Gemini API
        Map<String, Object> requestBody = buildTranscriptionRequest(base64Audio);

        return webClient.post()
            .uri(uriBuilder -> uriBuilder
                .path("/models/{model}:generateContent")
                .queryParam("key", apiKey)
                .build(model))
            .bodyValue(requestBody)
            .retrieve()
            .onStatus(HttpStatusCode::is4xxClientError, response -> {
                if (response.statusCode().value() == 429) {
                    log.warn("Gemini API rate limit hit for session {}", sessionId);
                    return Mono.error(new GeminiConfig.GeminiRateLimitException("Rate limit exceeded"));
                }
                return response.bodyToMono(String.class)
                    .doOnNext(body -> log.error("Gemini API client error for session {}: {}", sessionId, body))
                    .flatMap(body -> Mono.error(new GeminiConfig.GeminiApiException(
                        "Client error: " + body, response.statusCode().value())));
            })
            .onStatus(HttpStatusCode::is5xxServerError, response ->
                response.bodyToMono(String.class)
                    .doOnNext(body -> log.error("Gemini API server error for session {}: {}", sessionId, body))
                    .flatMap(body -> Mono.error(new GeminiConfig.GeminiApiException(
                        "Server error: " + body, response.statusCode().value()))))
            .bodyToMono(String.class)
            .doOnNext(response -> log.info("Gemini API response received for session {}", sessionId))
            .map(response -> parseTranscriptionResponse(response, sessionId))
            .retryWhen(createRetrySpec())
            .onErrorResume(CallNotPermittedException.class, e -> {
                log.warn("Circuit breaker open for session {}, returning degraded response", sessionId);
                return Mono.just(createDegradedResponse(sessionId));
            })
            .onErrorResume(e -> {
                log.error("Error calling Gemini API for session {}: {}", sessionId, e.getMessage());
                return Mono.just(createDegradedResponse(sessionId));
            });
    }

    /**
     * Builds the request body for Gemini API transcription.
     */
    private Map<String, Object> buildTranscriptionRequest(String base64Audio) {
        return Map.of(
            "contents", new Object[]{
                Map.of(
                    "parts", new Object[]{
                        Map.of(
                            "inlineData", Map.of(
                                "mimeType", "audio/webm;codecs=opus",
                                "data", base64Audio
                            )
                        ),
                        Map.of(
                            "text", "Listen to this audio recording and transcribe exactly what is being said. Output only the transcription text, nothing else. If you cannot hear any speech, respond with [silence]."
                        )
                    }
                )
            },
            "generationConfig", Map.of(
                "temperature", 0.0,
                "maxOutputTokens", 2048
            )
        );
    }

    /**
     * Parses the Gemini API response and extracts transcription.
     */
    private TranscriptionUpdate parseTranscriptionResponse(String response, String sessionId) {
        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode candidates = root.path("candidates");

            if (candidates.isArray() && !candidates.isEmpty()) {
                JsonNode content = candidates.get(0).path("content");
                JsonNode parts = content.path("parts");

                if (parts.isArray() && !parts.isEmpty()) {
                    String text = parts.get(0).path("text").asText("");

                    // Extract confidence from safety ratings or use default
                    double confidence = extractConfidence(candidates.get(0));
                    long sequenceId = getNextSequenceId(sessionId);

                    // Determine if this is a final or partial result
                    String finishReason = candidates.get(0).path("finishReason").asText("");
                    boolean isFinal = "STOP".equals(finishReason);

                    log.info("Parsed transcription: text='{}', confidence={}, isFinal={}", 
                        text.substring(0, Math.min(50, text.length())), confidence, isFinal);

                    return isFinal 
                        ? TranscriptionUpdate.finalResult(text, confidence, sequenceId)
                        : TranscriptionUpdate.partial(text, confidence, sequenceId);
                }
            }

            // Return empty partial if no content found
            return TranscriptionUpdate.partial("", 0.0, getNextSequenceId(sessionId));

        } catch (Exception e) {
            log.error("Failed to parse Gemini response: {}", e.getMessage());
            return TranscriptionUpdate.partial("", 0.0, getNextSequenceId(sessionId));
        }
    }

    /**
     * Extracts confidence score from Gemini response.
     */
    private double extractConfidence(JsonNode candidate) {
        // Try to extract from safety ratings or avg log probs
        JsonNode avgLogprobs = candidate.path("avgLogprobs");
        if (!avgLogprobs.isMissingNode()) {
            // Convert log probability to confidence (0-1 range)
            double logProb = avgLogprobs.asDouble(-1.0);
            return parseConfidenceScore(Math.exp(logProb));
        }

        // Default confidence if not available
        return 0.85;
    }

    @Override
    public double parseConfidenceScore(double rawScore) {
        // Ensure score is within valid bounds [0.0, 1.0]
        if (Double.isNaN(rawScore) || Double.isInfinite(rawScore)) {
            return 0.0;
        }
        return Math.max(0.0, Math.min(1.0, rawScore));
    }

    /**
     * Creates the retry specification with exponential backoff.
     */
    private Retry createRetrySpec() {
        return Retry.backoff(geminiConfig.getMaxRetryAttempts(), Duration.ofMillis(geminiConfig.getBaseDelay()))
            .maxBackoff(Duration.ofMillis(geminiConfig.getMaxDelay()))
            .filter(throwable -> throwable instanceof GeminiConfig.GeminiRateLimitException)
            .doBeforeRetry(signal -> 
                log.warn("Retrying Gemini API call, attempt {}: {}", 
                    signal.totalRetries() + 1, signal.failure().getMessage()));
    }

    /**
     * Creates a degraded response when circuit breaker is open.
     */
    private TranscriptionUpdate createDegradedResponse(String sessionId) {
        return TranscriptionUpdate.partial(
            "[Transcription temporarily unavailable]",
            0.0,
            getNextSequenceId(sessionId)
        );
    }

    /**
     * Gets the next sequence ID for a session.
     */
    private long getNextSequenceId(String sessionId) {
        return sessionSequenceCounters
            .computeIfAbsent(sessionId, k -> new AtomicLong(0))
            .incrementAndGet();
    }

    @Override
    public Mono<Void> closeSession(String sessionId) {
        return Mono.fromRunnable(() -> {
            log.info("Closing transcription session: {}", sessionId);
            activeSessions.put(sessionId, false);
            cleanupSession(sessionId);
        });
    }

    /**
     * Cleans up session resources.
     */
    private void cleanupSession(String sessionId) {
        sessionSequenceCounters.remove(sessionId);
        activeSessions.remove(sessionId);
        lastRequestTime.remove(sessionId);
        log.debug("Cleaned up session resources: {}", sessionId);
    }

    @Override
    public boolean isAvailable() {
        return circuitBreaker.getState() != CircuitBreaker.State.OPEN;
    }

    /**
     * Gets the current circuit breaker state (for testing/monitoring).
     */
    public CircuitBreaker.State getCircuitBreakerState() {
        return circuitBreaker.getState();
    }

    /**
     * Gets the circuit breaker instance (for testing).
     */
    public CircuitBreaker getCircuitBreaker() {
        return circuitBreaker;
    }
}
