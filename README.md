# VoiceScribe - Real-Time Audio Transcription Platform

A modern, full-stack real-time audio transcription platform powered by Google Gemini AI. Features a stunning React frontend with 60 FPS circular audio visualization and a robust Spring Boot WebFlux reactive backend.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Java](https://img.shields.io/badge/Java-21-orange.svg)
![React](https://img.shields.io/badge/React-18.3-61dafb.svg)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3-6db33f.svg)

---

## Table of Contents

- [Features](#features)
- [Demo](#demo)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Core Capabilities
- **Real-Time Transcription** - Stream audio from your microphone and see transcriptions appear instantly with sub-500ms latency
- **Beautiful Audio Visualization** - 60 FPS circular/radial frequency visualizer with smooth animations and frequency-based color mapping
- **AI-Powered Accuracy** - Leverages Google Gemini 1.5 Flash for fast, accurate speech-to-text conversion

### User Experience
- **Dark/Light Theme** - Modern UI with seamless theme toggle and WCAG 2.1 AA compliant contrast ratios
- **Responsive Design** - Fully responsive from mobile (320px) to desktop with touch interaction support
- **Session Management** - Pause, resume, copy, and download transcription sessions
- **Connection Status** - Real-time backend connection monitoring with automatic reconnection

### Technical Excellence
- **Reactive Architecture** - Non-blocking, event-driven backend using Spring WebFlux
- **Resilience Patterns** - Circuit breaker and exponential backoff retry for Gemini API calls
- **Property-Based Testing** - Comprehensive test coverage using fast-check (frontend) and jqwik (backend)
- **Graceful Error Handling** - User-friendly error messages with actionable recovery guidance

---

## Demo

### Landing Page
The landing page features an idle visualizer preview, clear call-to-action, and feature highlights.

### Recording Mode
Once recording starts, users see:
- Live circular audio visualizer responding to voice input
- Real-time transcription appearing as they speak
- Connection status indicator
- Pause/Resume/Stop controls

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React/TypeScript)                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────────────────────────┐  │
│  │  Microphone  │───▶│  AudioContext   │───▶│  AnalyserNode (FFT Analysis)   │  │
│  │  MediaStream │    │  (44.1kHz+)     │    │  Frequency Data Extraction     │  │
│  └──────────────┘    └────────┬────────┘    └───────────────┬────────────────┘  │
│                               │                             │                    │
│                               ▼                             ▼                    │
│                    ┌──────────────────┐      ┌────────────────────────────────┐ │
│                    │  MediaRecorder   │      │  CircularVisualizer (Canvas)   │ │
│                    │  (WebM/Opus)     │      │  60 FPS Rendering              │ │
│                    └────────┬─────────┘      └────────────────────────────────┘ │
│                             │                                                    │
│                             ▼                                                    │
│                    ┌──────────────────┐      ┌────────────────────────────────┐ │
│                    │  WebSocket       │◀────▶│  TranscriptionDisplay          │ │
│                    │  Service         │      │  (Real-time text updates)      │ │
│                    └────────┬─────────┘      └────────────────────────────────┘ │
│                             │                                                    │
└─────────────────────────────┼────────────────────────────────────────────────────┘
                              │ WebSocket (ws://)
                              │ Binary Audio ↑ | JSON Updates ↓
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Spring Boot WebFlux)                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────┐    ┌───────────────────┐    ┌──────────────────────┐   │
│  │  AudioWebSocket    │───▶│  AudioChunk       │───▶│  GeminiTranscription │   │
│  │  Handler           │    │  Processor        │    │  Service (Streaming) │   │
│  └────────────────────┘    └───────────────────┘    └──────────┬───────────┘   │
│           │                                                     │               │
│           │                ┌───────────────────┐                │               │
│           │◀───────────────│  Transcription    │◀───────────────┘               │
│           │                │  Streaming        │                                │
│           ▼                └───────────────────┘                                │
│  ┌────────────────────┐    ┌───────────────────┐                                │
│  │  Session           │───▶│  CircuitBreaker   │                                │
│  │  Manager           │    │  & RetryBackoff   │                                │
│  └────────────────────┘    └───────────────────┘                                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS REST API
                              ▼
                    ┌───────────────────┐
                    │   Google Gemini   │
                    │   1.5 Flash API   │
                    └───────────────────┘
```

### Data Flow

1. **Audio Capture**: Browser captures microphone input via MediaStream API
2. **Dual Processing**: Audio stream splits - one path to AnalyserNode for visualization, another to MediaRecorder for encoding
3. **WebSocket Streaming**: Encoded WebM/Opus chunks (100-500ms) stream to backend via WebSocket
4. **Backend Processing**: Chunks are validated, timestamped, and forwarded to Gemini API
5. **Transcription Return**: Gemini responses stream back through WebSocket as JSON updates
6. **UI Update**: Frontend displays partial/final transcriptions with smooth animations

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18.3 | UI framework with hooks and context |
| TypeScript | Type-safe development |
| Vite 6 | Build tool and dev server |
| Web Audio API | Audio capture and FFT analysis |
| Canvas API | 60 FPS circular visualization |
| fast-check | Property-based testing |
| Vitest | Unit testing framework |

### Backend
| Technology | Purpose |
|------------|---------|
| Java 21 | Runtime with modern features |
| Spring Boot 3.3 | Application framework |
| Spring WebFlux | Reactive, non-blocking web layer |
| Resilience4j | Circuit breaker and retry patterns |
| Gradle 8.8 | Build automation |
| jqwik | Property-based testing |
| JUnit 5 | Unit testing framework |

### External Services
| Service | Purpose |
|---------|---------|
| Google Gemini 1.5 Flash | AI-powered speech-to-text transcription |

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm (for frontend)
- **Java** 21+ (for backend)
- **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Quick Start

#### 1. Clone the Repository

```bash
git clone https://github.com/anjali04853/PREPXL.git
cd PREPXL
```

#### 2. Configure Gemini API Key

**Option A: Environment Variable (Recommended)**
```bash
# Windows (PowerShell)
$env:GEMINI_API_KEY="your-api-key-here"

# Windows (CMD)
set GEMINI_API_KEY=your-api-key-here

# Linux/macOS
export GEMINI_API_KEY=your-api-key-here
```

**Option B: Application Configuration**

Edit `backend/src/main/resources/application.yml`:
```yaml
gemini:
  api:
    key: your-api-key-here
```

#### 3. Start the Backend

```bash
cd backend

# Windows
.\gradlew.bat bootRun

# Linux/macOS
./gradlew bootRun
```

Backend starts at: http://localhost:8080

#### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend starts at: http://localhost:5173

#### 5. Use the Application

1. Open http://localhost:5173 in your browser (Chrome recommended)
2. Click **"Start Recording"**
3. Allow microphone access when prompted
4. Speak into your microphone
5. Watch transcriptions appear in real-time!

---

## Project Structure

```
PREPXL/
├── frontend/                          # React frontend application
│   ├── src/
│   │   ├── components/               # React UI components
│   │   │   ├── CircularVisualizer.tsx    # 60 FPS audio visualization
│   │   │   ├── CircularVisualizer.css
│   │   │   ├── TranscriptionDisplay.tsx  # Real-time text display
│   │   │   ├── TranscriptionDisplay.css
│   │   │   ├── ConnectionStatusIndicator.tsx
│   │   │   ├── ErrorDisplay.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   └── AudioStatusIndicator.tsx
│   │   ├── services/                 # Core services
│   │   │   ├── AudioCaptureService.ts    # Microphone & MediaRecorder
│   │   │   ├── WebSocketService.ts       # WebSocket client
│   │   │   └── AudioStreamingService.ts  # Audio chunk streaming
│   │   ├── hooks/                    # Custom React hooks
│   │   │   ├── useAudioCapture.ts
│   │   │   ├── useTranscription.ts
│   │   │   ├── useConnectionStatus.ts
│   │   │   ├── useErrorHandler.ts
│   │   │   ├── useResponsiveSize.ts
│   │   │   └── useTouchInteraction.ts
│   │   ├── contexts/                 # React context providers
│   │   │   └── ThemeContext.tsx
│   │   ├── utils/                    # Utility functions
│   │   │   ├── frequencyUtils.ts         # FFT & normalization
│   │   │   ├── colorUtils.ts             # Theme & contrast
│   │   │   └── errorMessages.ts          # User-friendly errors
│   │   ├── types/                    # TypeScript type definitions
│   │   │   └── index.ts
│   │   ├── App.tsx                   # Main application component
│   │   ├── App.css                   # Application styles
│   │   ├── main.tsx                  # Entry point
│   │   └── index.css                 # Global styles
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/                          # Spring Boot backend
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/transcription/
│   │   │   │   ├── config/               # Configuration classes
│   │   │   │   │   ├── WebSocketConfig.java
│   │   │   │   │   └── GeminiConfig.java
│   │   │   │   ├── handler/              # WebSocket handlers
│   │   │   │   │   └── AudioWebSocketHandler.java
│   │   │   │   ├── service/              # Business logic
│   │   │   │   │   ├── GeminiTranscriptionService.java
│   │   │   │   │   ├── GeminiTranscriptionServiceImpl.java
│   │   │   │   │   ├── TranscriptionStreamingService.java
│   │   │   │   │   ├── TranscriptionStreamingServiceImpl.java
│   │   │   │   │   ├── SessionManager.java
│   │   │   │   │   ├── SessionManagerImpl.java
│   │   │   │   │   ├── AudioChunkProcessor.java
│   │   │   │   │   ├── AudioChunkProcessorImpl.java
│   │   │   │   │   ├── CircuitBreakerManager.java
│   │   │   │   │   └── RetryBackoffCalculator.java
│   │   │   │   └── model/                # Data models
│   │   │   │       ├── AudioChunk.java
│   │   │   │       ├── Session.java
│   │   │   │       └── TranscriptionUpdate.java
│   │   │   └── resources/
│   │   │       └── application.yml       # Application configuration
│   │   └── test/                         # Test classes
│   │       └── java/com/transcription/
│   │           └── service/
│   │               ├── AudioChunkProcessorPropertyTest.java
│   │               ├── GeminiTranscriptionServicePropertyTest.java
│   │               ├── TranscriptionStreamingServicePropertyTest.java
│   │               └── SessionManagerTest.java
│   ├── build.gradle
│   ├── settings.gradle
│   ├── gradlew
│   └── gradlew.bat
│
├── .kiro/                            # Kiro specifications
│   └── specs/
│       └── realtime-audio-transcription/
│           ├── requirements.md           # Feature requirements
│           ├── design.md                 # Technical design
│           └── tasks.md                  # Implementation tasks
│
└── README.md                         # This file
```

---

## Configuration

### Backend Configuration

Located at `backend/src/main/resources/application.yml`:

```yaml
spring:
  application:
    name: realtime-audio-transcription-backend

server:
  port: 8080

# Gemini API Configuration
gemini:
  api:
    key: ${GEMINI_API_KEY:your-api-key}
    base-url: https://generativelanguage.googleapis.com/v1beta
    model: gemini-1.5-flash-latest
    timeout:
      connect: 5000      # 5 seconds
      read: 30000        # 30 seconds
    min-request-interval-ms: 5000  # Rate limit protection

# WebSocket Configuration
websocket:
  path: /ws/transcription
  max-session-idle-timeout: 300000  # 5 minutes

# Circuit Breaker Configuration
resilience:
  circuit-breaker:
    failure-rate-threshold: 50       # Open after 50% failures
    wait-duration-in-open-state: 30000  # 30 seconds
    sliding-window-size: 10
    minimum-number-of-calls: 5
  retry:
    max-attempts: 3
    base-delay: 1000     # 1 second
    max-delay: 30000     # 30 seconds

# Logging
logging:
  level:
    com.transcription: DEBUG
    org.springframework.web.reactive: INFO
```

### Frontend Configuration

Create `.env` file in `frontend/` directory:

```env
VITE_WS_URL=ws://localhost:8080/ws/transcription
```

For production:
```env
VITE_WS_URL=wss://your-domain.com/ws/transcription
```

---

## API Reference

### WebSocket Endpoint

**URL**: `ws://localhost:8080/ws/transcription`

#### Client → Server (Audio Chunks)

Binary WebSocket messages containing WebM/Opus encoded audio data.

- **Format**: WebM container with Opus codec
- **Chunk Duration**: 100-500ms
- **Sample Rate**: 44.1kHz minimum

#### Server → Client (Transcription Updates)

JSON messages with transcription results:

```json
{
  "type": "partial",
  "text": "Hello world",
  "confidence": 0.92,
  "timestamp": "2026-01-09T12:00:00.000Z",
  "sequenceId": 1
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"partial"` \| `"final"` | Whether transcription is interim or complete |
| `text` | `string` | Transcribed text content |
| `confidence` | `number` | Confidence score (0.0 - 1.0) |
| `timestamp` | `string` | ISO-8601 timestamp |
| `sequenceId` | `number` | Monotonically increasing sequence number |

---

## Testing

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

**Test Coverage:**
- Unit tests for services and utilities
- Property-based tests using fast-check for:
  - Frequency normalization bounds
  - Frequency-to-radius mapping monotonicity
  - Animation smoothing constraints
  - WCAG contrast ratio compliance

### Backend Tests

```bash
cd backend

# Run all tests
.\gradlew.bat test      # Windows
./gradlew test          # Linux/macOS
```

**Test Coverage:**
- Unit tests for all services
- Property-based tests using jqwik for:
  - Audio chunk validation
  - Timestamp monotonicity
  - Out-of-order chunk reordering
  - Confidence score parsing
  - Exponential backoff patterns
  - Circuit breaker state transitions

---

## Development

### Frontend Development

```bash
cd frontend

npm run dev        # Start dev server with HMR (http://localhost:5173)
npm run build      # Production build to dist/
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### Backend Development

```bash
cd backend

.\gradlew.bat bootRun    # Start with hot reload (Windows)
./gradlew bootRun        # Start with hot reload (Linux/macOS)
.\gradlew.bat build      # Build JAR
.\gradlew.bat test       # Run tests
```

### Code Quality

The project uses:
- **ESLint** for frontend JavaScript/TypeScript linting
- **TypeScript** strict mode for type safety
- **Property-based testing** for comprehensive edge case coverage

---

## Troubleshooting

### Common Issues

#### "Transcription temporarily unavailable"
- Verify your Gemini API key is valid and has quota remaining
- Check backend logs for API error details
- Ensure backend is running on port 8080

#### WebSocket connection failed
- Confirm backend is running: `curl http://localhost:8080/actuator/health`
- Check if port 8080 is available
- Verify `VITE_WS_URL` matches backend WebSocket path

#### No audio visualization
- Allow microphone permission in browser settings
- Check if microphone is connected and selected as default
- Try Chrome browser (best Web Audio API support)
- Check browser console for errors

#### "Audio context suspended"
- Click anywhere on the page to resume (browser autoplay policy)
- Ensure user interaction before starting audio

#### Rate limit errors from Gemini
- The backend implements automatic retry with exponential backoff
- Consider increasing `min-request-interval-ms` in configuration
- Check your Gemini API quota at Google AI Studio

### Debug Mode

Enable verbose logging:

**Backend** (`application.yml`):
```yaml
logging:
  level:
    com.transcription: TRACE
```

**Frontend** (browser console):
```javascript
localStorage.setItem('debug', 'voicescribe:*');
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and patterns
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass before submitting PR

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [Google Gemini AI](https://ai.google.dev/) - AI-powered transcription
- [React](https://react.dev/) - Frontend framework
- [Spring Boot](https://spring.io/projects/spring-boot) - Backend framework
- [Vite](https://vitejs.dev/) - Frontend build tool
- [Resilience4j](https://resilience4j.readme.io/) - Fault tolerance library

---

Built with ❤️ using React, Spring Boot, and Gemini AI
