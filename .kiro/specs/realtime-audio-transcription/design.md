# Design Document: Real-Time Audio Transcription Platform

## Overview

This design describes a real-time audio transcription platform consisting of a React/TypeScript frontend with a circular audio visualizer and a Spring Boot WebFlux backend that streams audio to Gemini API for transcription. The system prioritizes low latency (<500ms), smooth 60 FPS visualization, and a polished modern UI.

The architecture follows a reactive streaming pattern where audio flows from the browser microphone through Web Audio API for visualization, while simultaneously being encoded and streamed via WebSocket to the backend, which forwards chunks to Gemini API and streams transcription results back to the client.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React/TypeScript)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────────────┐   │
│  │  Microphone  │───▶│  AudioContext   │───▶│  AnalyserNode (FFT)      │   │
│  │  MediaStream │    │  (44.1kHz+)     │    │  Frequency Data          │   │
│  └──────────────┘    └────────┬────────┘    └───────────┬──────────────┘   │
│                               │                         │                   │
│                               ▼                         ▼                   │
│                    ┌──────────────────┐    ┌──────────────────────────┐    │
│                    │  MediaRecorder   │    │  CircularVisualizer      │    │
│                    │  (WebM/Opus)     │    │  (Canvas 60 FPS)         │    │
│                    └────────┬─────────┘    └──────────────────────────┘    │
│                             │                                               │
│                             ▼                                               │
│                    ┌──────────────────┐    ┌──────────────────────────┐    │
│                    │  WebSocket       │    │  TranscriptionDisplay    │    │
│                    │  Client          │◀──▶│  (Real-time updates)     │    │
│                    └────────┬─────────┘    └──────────────────────────┘    │
│                             │                                               │
└─────────────────────────────┼───────────────────────────────────────────────┘
                              │ WebSocket (wss://)
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Spring Boot WebFlux)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌─────────────────┐    ┌────────────────────┐     │
│  │  WebSocket       │───▶│  AudioChunk     │───▶│  Gemini API        │     │
│  │  Handler         │    │  Processor      │    │  Client (Streaming)│     │
│  └──────────────────┘    └─────────────────┘    └─────────┬──────────┘     │
│           │                                               │                 │
│           │              ┌─────────────────┐              │                 │
│           │◀─────────────│  Transcription  │◀─────────────┘                 │
│           │              │  Aggregator     │                                │
│           ▼              └─────────────────┘                                │
│  ┌──────────────────┐                                                       │
│  │  Session         │    ┌─────────────────┐                                │
│  │  Manager         │───▶│  Circuit Breaker│                                │
│  └──────────────────┘    │  & Retry Logic  │                                │
│                          └─────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### 1. AudioCaptureService
Manages microphone access and audio stream initialization.

```typescript
interface AudioCaptureService {
  requestMicrophoneAccess(): Promise<MediaStream>;
  getAudioContext(): AudioContext;
  getAnalyserNode(): AnalyserNode;
  getMediaRecorder(): MediaRecorder;
  onChunkAvailable: (chunk: Blob) => void;
  disconnect(): void;
  reconnect(): Promise<void>;
}
```

#### 2. CircularVisualizer
Canvas-based circular frequency visualizer with smooth animations.

```typescript
interface CircularVisualizerProps {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
  size: number;
  colorScheme: 'dark' | 'light' | 'gradient';
}

interface VisualizerConfig {
  innerRadius: number;      // Inner circle radius (low frequencies)
  outerRadius: number;      // Max bar extension (high frequencies)
  barCount: number;         // Number of frequency bars (64-128)
  smoothingFactor: number;  // Animation damping (0.1-0.3)
  minDecibels: number;      // -90 dB
  maxDecibels: number;      // -10 dB
}
```

#### 3. WebSocketService
Manages WebSocket connection for audio streaming and transcription receiving.

```typescript
interface WebSocketService {
  connect(url: string): Promise<void>;
  sendAudioChunk(chunk: Blob): void;
  onTranscriptionUpdate: (update: TranscriptionUpdate) => void;
  onConnectionStatusChange: (status: ConnectionStatus) => void;
  disconnect(): void;
  reconnect(): Promise<void>;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
```

#### 4. TranscriptionDisplay
Real-time transcription text display with smooth updates.

```typescript
interface TranscriptionDisplayProps {
  transcriptionHistory: TranscriptionUpdate[];
  currentInterim: string;
  isRecording: boolean;
}
```

### Backend Components

#### 1. WebSocketHandler
Handles WebSocket connections and message routing.

```java
public interface WebSocketHandler {
    Mono<Void> handle(WebSocketSession session);
    void broadcastToSession(String sessionId, TranscriptionUpdate update);
}
```

#### 2. AudioChunkProcessor
Validates and processes incoming audio chunks.

```java
public interface AudioChunkProcessor {
    Mono<ProcessedChunk> process(byte[] audioData, String sessionId);
    boolean validateFormat(byte[] audioData);
    long assignTimestamp(byte[] audioData);
}
```

#### 3. GeminiTranscriptionService
Streams audio to Gemini API and receives transcriptions.

```java
public interface GeminiTranscriptionService {
    Flux<TranscriptionUpdate> streamTranscription(Flux<byte[]> audioChunks, String sessionId);
    Mono<Void> closeSession(String sessionId);
}
```

#### 4. SessionManager
Manages concurrent user sessions.

```java
public interface SessionManager {
    Session createSession(String connectionId);
    Optional<Session> getSession(String sessionId);
    void closeSession(String sessionId);
    int getActiveSessionCount();
}
```

## Data Models

### TranscriptionUpdate
```typescript
interface TranscriptionUpdate {
  type: 'partial' | 'final';
  text: string;
  confidence: number;        // 0.0 - 1.0
  timestamp: string;         // ISO-8601
  sequenceId: number;
}
```

### AudioChunk (Backend)
```java
public record AudioChunk(
    byte[] data,
    String format,           // "webm/opus"
    long timestamp,
    int sequenceNumber,
    String sessionId
) {}
```

### Session
```java
public record Session(
    String id,
    String connectionId,
    Instant createdAt,
    SessionState state,
    List<TranscriptionUpdate> transcriptionHistory
) {}

public enum SessionState {
    ACTIVE, PAUSED, CLOSED
}
```

### ConnectionHealthStatus
```typescript
interface ConnectionHealthStatus {
  websocket: 'connected' | 'disconnected' | 'reconnecting';
  geminiApi: 'healthy' | 'degraded' | 'unavailable';
  latencyMs: number;
  lastHeartbeat: string;
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Frequency Data Normalization

*For any* raw frequency data array from the AnalyserNode, the normalized output values SHALL all be within the range [0, 1].

**Validates: Requirements 2.3**

### Property 2: Frequency-to-Radius Mapping Monotonicity

*For any* two frequency band indices where index_a < index_b, the mapped radius for index_a SHALL be less than or equal to the mapped radius for index_b (low frequencies map to inner radius, high frequencies to outer).

**Validates: Requirements 2.4**

### Property 3: Animation Smoothing (Damping)

*For any* sequence of raw frequency values, the smoothed/damped output values SHALL change by no more than the smoothing factor multiplied by the difference between current and target values per frame.

**Validates: Requirements 3.2, 3.3**

### Property 4: Decibel-to-Height Scaling

*For any* decibel value within the configured range [minDecibels, maxDecibels], the scaled bar height SHALL be proportional to the dB value's position within that range, producing values in [0, maxBarHeight].

**Validates: Requirements 3.4**

### Property 5: Audio Chunk Duration

*For any* audio chunk produced by the MediaRecorder, the chunk duration SHALL be between 100ms and 500ms.

**Validates: Requirements 4.2**

### Property 6: Audio Chunk Validation

*For any* audio chunk received by the backend, validation SHALL accept chunks with valid WebM/Opus format and reject chunks with invalid format or exceeding size limits.

**Validates: Requirements 5.1**

### Property 7: Chunk Timestamping

*For any* audio chunk received by the backend, a monotonically increasing timestamp SHALL be assigned before processing.

**Validates: Requirements 5.2**

### Property 8: Out-of-Order Chunk Reordering

*For any* sequence of audio chunks arriving out of order, the reordered output sequence SHALL be sorted by timestamp in ascending order.

**Validates: Requirements 5.3**

### Property 9: Confidence Score Parsing

*For any* valid Gemini API transcription response, the parsed confidence score SHALL be a float value in the range [0.0, 1.0].

**Validates: Requirements 6.2**

### Property 10: Exponential Backoff Retry

*For any* sequence of consecutive Gemini API rate limit errors, the retry delay SHALL follow exponential backoff pattern where delay_n = base_delay * 2^n, capped at max_delay.

**Validates: Requirements 6.3**

### Property 11: Circuit Breaker State Transitions

*For any* sequence of Gemini API failures exceeding the threshold count within the time window, the circuit breaker SHALL transition to OPEN state and reject subsequent requests until the reset timeout.

**Validates: Requirements 6.4**

### Property 12: TranscriptionUpdate Structure Validity

*For any* TranscriptionUpdate message, it SHALL contain: type (either 'partial' or 'final'), text (string), confidence (float 0-1), timestamp (ISO-8601 string), and sequenceId (positive integer).

**Validates: Requirements 7.2, 7.3**

### Property 13: Network Interruption Data Preservation

*For any* network interruption during an active session, all audio chunks received before the interruption SHALL be preserved in the session buffer without data loss.

**Validates: Requirements 9.3**

### Property 14: Error Message Coverage

*For any* error state in the defined error types enum, a corresponding user-friendly error message SHALL exist and be non-empty.

**Validates: Requirements 9.4**

### Property 15: WCAG Contrast Ratio Compliance

*For any* foreground/background color pair used in the UI, the contrast ratio SHALL be at least 4.5:1 for normal text and 3:1 for large text (WCAG 2.1 AA).

**Validates: Requirements 10.4**

## Error Handling

### Frontend Error Handling

| Error Type | Detection | User Message | Recovery Action |
|------------|-----------|--------------|-----------------|
| Microphone Permission Denied | `NotAllowedError` from getUserMedia | "Microphone access is required. Please allow microphone permission in your browser settings." | Show settings guidance |
| Microphone Not Found | `NotFoundError` from getUserMedia | "No microphone detected. Please connect a microphone and try again." | Retry button |
| Microphone Disconnected | MediaStream `ended` event | "Microphone disconnected. Reconnecting..." | Auto-reconnect attempt |
| WebSocket Connection Failed | WebSocket `error`/`close` event | "Connection lost. Reconnecting..." | Exponential backoff reconnect |
| Audio Context Suspended | AudioContext state check | "Audio paused by browser. Click to resume." | Resume on user interaction |
| Browser Not Supported | Feature detection failure | "Your browser doesn't support audio recording. Please use Chrome, Firefox, or Safari." | Browser upgrade guidance |

### Backend Error Handling

| Error Type | Detection | Response | Recovery Action |
|------------|-----------|----------|-----------------|
| Invalid Audio Format | Format validation failure | 400 Bad Request with error details | Client retry with correct format |
| Gemini API Rate Limit | 429 response code | Backpressure signal to client | Exponential backoff retry |
| Gemini API Timeout | Request timeout | 504 Gateway Timeout | Retry with circuit breaker |
| Gemini API Error | 5xx response codes | 502 Bad Gateway | Circuit breaker activation |
| Session Not Found | Session lookup failure | 404 Not Found | Client reconnect |
| WebSocket Disconnect | Connection close event | N/A | Session cleanup after timeout |

### Circuit Breaker Configuration

```java
CircuitBreakerConfig config = CircuitBreakerConfig.custom()
    .failureRateThreshold(50)           // Open after 50% failures
    .waitDurationInOpenState(Duration.ofSeconds(30))
    .slidingWindowSize(10)              // Last 10 calls
    .minimumNumberOfCalls(5)            // Minimum calls before evaluation
    .build();
```

## Testing Strategy

### Unit Tests

Unit tests verify specific examples, edge cases, and error conditions:

**Frontend Unit Tests:**
- AudioCaptureService: Permission handling, stream initialization, reconnection
- CircularVisualizer: Canvas rendering, animation frame updates
- WebSocketService: Connection lifecycle, message handling
- TranscriptionDisplay: Text updates, scroll behavior

**Backend Unit Tests:**
- AudioChunkProcessor: Format validation, timestamp assignment
- GeminiTranscriptionService: Response parsing, error handling
- SessionManager: Session lifecycle, concurrent access
- WebSocketHandler: Message routing, connection management

### Property-Based Tests

Property-based tests verify universal properties across all inputs using **fast-check** (TypeScript) and **jqwik** (Java).

**Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: realtime-audio-transcription, Property {N}: {description}`

**Frontend Property Tests (fast-check):**
- Property 1: Frequency normalization bounds
- Property 2: Frequency-to-radius monotonicity
- Property 3: Animation smoothing constraints
- Property 4: dB-to-height scaling linearity
- Property 5: Audio chunk duration bounds
- Property 15: WCAG contrast ratio compliance

**Backend Property Tests (jqwik):**
- Property 6: Audio chunk validation
- Property 7: Chunk timestamping monotonicity
- Property 8: Out-of-order chunk reordering
- Property 9: Confidence score parsing bounds
- Property 10: Exponential backoff pattern
- Property 11: Circuit breaker state transitions
- Property 12: TranscriptionUpdate structure validity
- Property 13: Data preservation on interruption
- Property 14: Error message coverage

### Integration Tests

- End-to-end audio capture to transcription display
- WebSocket connection lifecycle
- Gemini API integration (with mocked responses)
- Session management across reconnections

### Performance Tests

- 60 FPS visualization benchmark
- Sub-500ms latency measurement
- 100 concurrent connection load test
- Memory leak detection over extended sessions
