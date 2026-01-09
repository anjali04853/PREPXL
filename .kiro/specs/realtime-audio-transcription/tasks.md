# Implementation Plan: Real-Time Audio Transcription Platform

## Overview

This implementation plan covers building a real-time audio transcription platform with a React/TypeScript frontend featuring a circular audio visualizer and a Spring Boot WebFlux backend streaming to Gemini API. Tasks are ordered to enable incremental development with early validation of core functionality.

## Tasks

- [x] 1. Project Setup and Configuration
  - [x] 1.1 Initialize React/TypeScript frontend project with Vite
    - Create project with `npm create vite@latest frontend -- --template react-ts`
    - Configure TypeScript strict mode
    - Install dependencies: fast-check for property testing, vitest for unit tests
    - _Requirements: Technical setup_

  - [x] 1.2 Initialize Spring Boot WebFlux backend project
    - Create project with Spring Initializr (WebFlux, Reactive WebSocket)
    - Configure Gradle/Maven with jqwik for property testing
    - Set up application.yml with Gemini API configuration
    - _Requirements: Technical setup_

  - [x] 1.3 Set up project structure and shared types
    - Create frontend directory structure: components/, services/, hooks/, types/
    - Create backend package structure: handler/, service/, model/, config/
    - Define shared TranscriptionUpdate interface/record
    - _Requirements: Technical setup_

- [x] 2. Audio Capture Service Implementation
  - [x] 2.1 Implement AudioCaptureService with microphone access
    - Create service to request microphone permission via getUserMedia
    - Initialize AudioContext with 44.1kHz+ sample rate
    - Create AnalyserNode with FFT configuration (fftSize: 2048)
    - Handle permission denied and device not found errors
    - _Requirements: 1.1, 1.2, 1.3, 2.1_

  - [x] 2.2 Implement microphone disconnect/reconnect handling
    - Listen for MediaStream 'ended' event
    - Implement automatic reconnection logic
    - Display reconnection status in UI
    - _Requirements: 1.4, 1.5_

  - [x] 2.3 Write unit tests for AudioCaptureService
    - Test permission request flow
    - Test error handling for denied permission
    - Test reconnection logic
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 3. Circular Visualizer Implementation
  - [x] 3.1 Create CircularVisualizer React component with Canvas
    - Set up Canvas element with responsive sizing
    - Implement requestAnimationFrame render loop
    - Create circular bar layout with configurable bar count (64-128)
    - _Requirements: 3.1_

  - [x] 3.2 Implement frequency data processing and normalization
    - Extract frequency data from AnalyserNode (getByteFrequencyData)
    - Normalize values to 0-1 range
    - Map frequency bands to radial positions (low=inner, high=outer)
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 3.3 Write property test for frequency normalization
    - **Property 1: Frequency Data Normalization**
    - **Validates: Requirements 2.3**

  - [x] 3.4 Write property test for frequency-to-radius mapping
    - **Property 2: Frequency-to-Radius Mapping Monotonicity**
    - **Validates: Requirements 2.4**

  - [x] 3.5 Implement smooth animation with damping/easing
    - Apply exponential smoothing between frames
    - Implement dB-to-height scaling
    - Add color gradient based on frequency/amplitude
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 3.6 Write property test for animation smoothing
    - **Property 3: Animation Smoothing (Damping)**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 3.7 Write property test for dB-to-height scaling
    - **Property 4: Decibel-to-Height Scaling**
    - **Validates: Requirements 3.4**

- [x] 4. Checkpoint - Frontend Audio Visualization
  - Ensure visualizer renders at 60 FPS
  - Verify frequency response accuracy
  - Test on multiple viewport sizes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. WebSocket Service Implementation (Frontend)
  - [x] 5.1 Create WebSocketService for backend communication
    - Implement WebSocket connection with reconnection logic
    - Handle connection status changes (connecting, connected, disconnected, reconnecting)
    - Implement message sending for audio chunks
    - _Requirements: 4.1, 9.1, 9.2_

  - [x] 5.2 Implement audio chunk streaming
    - Create MediaRecorder with WebM/Opus encoding
    - Configure chunk interval (100-500ms via timeslice)
    - Stream chunks to WebSocket as binary data
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 5.3 Write property test for audio chunk duration
    - **Property 5: Audio Chunk Duration**
    - **Validates: Requirements 4.2**

  - [x] 5.4 Write unit tests for WebSocketService
    - Test connection lifecycle
    - Test reconnection on disconnect
    - Test message handling
    - _Requirements: 4.1, 9.1, 9.2_

- [x] 6. Backend WebSocket Handler Implementation
  - [x] 6.1 Create WebSocket handler for audio streaming
    - Implement WebSocketHandler with reactive streams
    - Handle binary audio chunk messages
    - Route messages to AudioChunkProcessor
    - _Requirements: 5.1_

  - [x] 6.2 Implement AudioChunkProcessor
    - Validate audio chunk format (WebM/Opus)
    - Assign monotonic timestamps to chunks
    - Reorder out-of-order chunks by timestamp
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.3 Write property test for audio chunk validation
    - **Property 6: Audio Chunk Validation**
    - **Validates: Requirements 5.1**

  - [x] 6.4 Write property test for chunk timestamping
    - **Property 7: Chunk Timestamping**
    - **Validates: Requirements 5.2**

  - [x] 6.5 Write property test for chunk reordering
    - **Property 8: Out-of-Order Chunk Reordering**
    - **Validates: Requirements 5.3**

- [x] 7. Session Management Implementation
  - [x] 7.1 Implement SessionManager
    - Create session on WebSocket connection
    - Track session state (ACTIVE, PAUSED, CLOSED)
    - Store transcription history per session
    - Handle concurrent sessions
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

  - [x] 7.2 Write unit tests for SessionManager
    - Test session creation and retrieval
    - Test state transitions
    - Test concurrent access
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

- [x] 8. Checkpoint - Backend Audio Reception
  - Verify WebSocket connection establishment
  - Test audio chunk reception and validation
  - Verify session management
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Gemini API Integration
  - [x] 9.1 Implement GeminiTranscriptionService
    - Create reactive client for Gemini streaming API
    - Forward audio chunks immediately (no buffering)
    - Parse partial transcription responses
    - Extract confidence scores
    - _Requirements: 5.4, 5.5, 6.1, 6.2_

  - [x] 9.2 Write property test for confidence score parsing
    - **Property 9: Confidence Score Parsing**
    - **Validates: Requirements 6.2**

  - [x] 9.3 Implement error handling with retry and circuit breaker
    - Add exponential backoff for rate limit errors
    - Implement circuit breaker for API failures
    - Handle graceful degradation
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 9.4 Write property test for exponential backoff
    - **Property 10: Exponential Backoff Retry**
    - **Validates: Requirements 6.3**

  - [x] 9.5 Write property test for circuit breaker
    - **Property 11: Circuit Breaker State Transitions**
    - **Validates: Requirements 6.4**

- [x] 10. Transcription Streaming to Client
  - [x] 10.1 Implement transcription update streaming
    - Create TranscriptionUpdate messages with type, text, confidence, timestamp, sequenceId
    - Stream updates to client via WebSocket
    - Send final transcription on session end
    - _Requirements: 7.1, 7.2, 7.3, 8.6_

  - [x] 10.2 Write property test for TranscriptionUpdate structure
    - **Property 12: TranscriptionUpdate Structure Validity**
    - **Validates: Requirements 7.2, 7.3**

  - [x] 10.3 Write property test for data preservation
    - **Property 13: Network Interruption Data Preservation**
    - **Validates: Requirements 9.3**

- [x] 11. Checkpoint - End-to-End Transcription
  - Test full audio-to-transcription flow
  - Verify latency is under 500ms
  - Test error recovery scenarios
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Frontend Transcription Display
  - [x] 12.1 Create TranscriptionDisplay component
    - Display transcription text with interim/final distinction
    - Implement incremental text updates (append, not rewrite)
    - Add smooth text transitions
    - Auto-scroll to latest text
    - _Requirements: 7.4, 7.5_

  - [x] 12.2 Implement session controls
    - Add pause/resume recording button
    - Add copy to clipboard button
    - Add download as text file button
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 12.3 Write unit tests for TranscriptionDisplay
    - Test text update handling
    - Test copy and download functionality
    - _Requirements: 7.4, 8.4, 8.5_

- [x] 13. Error Handling and Status Display
  - [x] 13.1 Implement connection status indicator
    - Display WebSocket connection status
    - Show Gemini API health status
    - Display latency metrics
    - _Requirements: 9.1_

  - [x] 13.2 Implement error messages and recovery guidance
    - Create error message mapping for all error types
    - Display user-friendly error messages
    - Provide actionable recovery guidance
    - _Requirements: 9.4, 9.5_

  - [x] 13.3 Write property test for error message coverage
    - **Property 14: Error Message Coverage**
    - **Validates: Requirements 9.4**

- [x] 14. Responsive Design and Accessibility
  - [x] 14.1 Implement responsive visualizer sizing
    - Scale visualizer for mobile (320px+), tablet, desktop
    - Handle orientation changes
    - Support touch interactions
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

  - [x] 14.2 Implement accessibility and theming
    - Ensure WCAG 2.1 AA contrast ratios
    - Add theme support (dark/light/gradient)
    - Add ARIA labels for controls
    - _Requirements: 10.4, 10.6_

  - [x] 14.3 Write property test for WCAG contrast compliance
    - **Property 15: WCAG Contrast Ratio Compliance**
    - **Validates: Requirements 10.4**

- [x] 15. UI Polish and Landing Page
  - [x] 15.1 Create landing page with modern design
    - Clean, minimal interface with clear purpose
    - Prominent "Start Recording" button
    - Modern 2024-2025 design aesthetics
    - _Requirements: Integration 5.1_

  - [x] 15.2 Polish visualizer appearance
    - Add gradient colors and glow effects
    - Smooth idle animation when not recording
    - Professional visual polish
    - _Requirements: NFR 1.5, 1.6, 1.7_

- [x] 16. Final Checkpoint - Complete Integration
  - End-to-end user journey testing
  - Cross-browser testing (Chrome, Firefox, Safari)
  - Performance validation (60 FPS, <500ms latency)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Frontend uses React/TypeScript with fast-check for property testing
- Backend uses Spring Boot WebFlux with jqwik for property testing
