/**
 * App - Main application component with landing page
 * 
 * Requirements: Integration 5.1
 * - Clean, minimal interface with clear purpose
 * - Prominent "Start Recording" button
 * - Modern 2024-2025 design aesthetics
 */

import { useState, useCallback, useEffect } from 'react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { CircularVisualizer } from './components/CircularVisualizer';
import { TranscriptionDisplay } from './components/TranscriptionDisplay';
import { ConnectionStatusIndicator } from './components/ConnectionStatusIndicator';
import { ErrorDisplay } from './components/ErrorDisplay';
import { ThemeToggle } from './components/ThemeToggle';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useTranscription } from './hooks/useTranscription';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { useErrorHandler } from './hooks/useErrorHandler';
import { useResponsiveSize } from './hooks/useResponsiveSize';
import { WebSocketService } from './services/WebSocketService';
import { ErrorType } from './utils/errorMessages';
import type { TranscriptionUpdate } from './types';
import './App.css';

// WebSocket URL - configurable via environment
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws/transcription';

function AppContent() {
  const { theme, colorScheme } = useTheme();
  const [isStarted, setIsStarted] = useState(false);
  const [wsService] = useState(() => new WebSocketService());
  
  // Custom hooks
  const {
    error: audioError,
    isRecording,
    analyserNode,
    requestMicrophoneAccess,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    disconnect: disconnectAudio,
    clearError: clearAudioError
  } = useAudioCapture({
    onChunkAvailable: (chunk) => {
      wsService.sendAudioChunk(chunk);
    }
  });

  const {
    transcriptionHistory,
    currentInterim,
    sessionState,
    addTranscriptionUpdate,
    clearTranscription,
    setSessionState
  } = useTranscription();

  const {
    connectionStatus,
    healthStatus,
    reconnectAttempts,
    setConnectionStatus,
    setGeminiApiStatus
  } = useConnectionStatus();

  const {
    currentError,
    addError,
    dismissError,
    clearErrors
  } = useErrorHandler();

  // Responsive visualizer size
  const responsiveSize = useResponsiveSize();

  // Handle audio errors
  useEffect(() => {
    if (audioError) {
      addError(audioError.type as ErrorType);
    }
  }, [audioError, addError]);

  // Setup WebSocket callbacks
  useEffect(() => {
    wsService.setCallbacks({
      onTranscriptionUpdate: (update: TranscriptionUpdate) => {
        addTranscriptionUpdate(update);
      },
      onConnectionStatusChange: (status) => {
        setConnectionStatus(status);
        if (status === 'connected') {
          setGeminiApiStatus('healthy');
        } else if (status === 'error' || status === 'disconnected') {
          setGeminiApiStatus('unavailable');
        }
      },
      onError: () => {
        addError(ErrorType.WEBSOCKET_CONNECTION_FAILED);
      }
    });
  }, [wsService, addTranscriptionUpdate, setConnectionStatus, setGeminiApiStatus, addError]);

  /**
   * Handle start recording button click
   */
  const handleStartRecording = useCallback(async () => {
    try {
      clearErrors();
      setIsStarted(true);
      
      // Request microphone access
      await requestMicrophoneAccess();
      
      // Connect to WebSocket
      try {
        await wsService.connect(WS_URL);
      } catch {
        // Continue even if WebSocket fails - user can still see visualizer
        console.warn('WebSocket connection failed, continuing with local visualization');
      }
      
      // Start recording
      startRecording();
      setSessionState('active');
    } catch (err) {
      console.error('Failed to start recording:', err);
      setIsStarted(false);
    }
  }, [requestMicrophoneAccess, wsService, startRecording, setSessionState, clearErrors]);

  /**
   * Handle stop recording
   */
  const handleStopRecording = useCallback(() => {
    stopRecording();
    wsService.disconnect();
    setSessionState('closed');
    setIsStarted(false);
  }, [stopRecording, wsService, setSessionState]);

  /**
   * Handle pause/resume
   */
  const handlePauseResume = useCallback(() => {
    if (sessionState === 'paused') {
      resumeRecording();
      setSessionState('active');
    } else {
      pauseRecording();
      setSessionState('paused');
    }
  }, [sessionState, pauseRecording, resumeRecording, setSessionState]);

  /**
   * Handle new session (clear and restart)
   */
  const handleNewSession = useCallback(() => {
    handleStopRecording();
    clearTranscription();
    disconnectAudio();
    clearAudioError();
    clearErrors();
  }, [handleStopRecording, clearTranscription, disconnectAudio, clearAudioError, clearErrors]);

  return (
    <div 
      className={`app ${theme.isDark ? 'dark' : 'light'}`}
      style={{ 
        backgroundColor: theme.colors.background,
        color: theme.colors.text 
      }}
    >
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <h1 className="app-title">VoiceScribe</h1>
          </div>
          <div className="header-actions">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Error Display */}
        {currentError && (
          <div className="error-container">
            <ErrorDisplay
              errorType={currentError.type}
              onDismiss={() => dismissError(currentError.id)}
              onAction={() => {
                dismissError(currentError.id);
                if (currentError.type === ErrorType.MICROPHONE_PERMISSION_DENIED) {
                  handleStartRecording();
                }
              }}
            />
          </div>
        )}

        {/* Landing Section - shown when not started */}
        {!isStarted && (
          <section className="landing-section">
            <div className="landing-content">
              <h2 className="landing-title">
                Real-Time Audio Transcription
              </h2>
              <p className="landing-subtitle">
                Transform your voice into text instantly with AI-powered transcription.
                Beautiful visualization meets powerful accuracy.
              </p>
              
              {/* Idle Visualizer Preview */}
              <div className="visualizer-preview">
                <CircularVisualizer
                  analyserNode={null}
                  isActive={false}
                  size={Math.min(responsiveSize.size, 300)}
                  colorScheme={colorScheme}
                  enableTouchInteraction={false}
                />
              </div>

              {/* Start Button */}
              <button
                className="start-button"
                onClick={handleStartRecording}
                aria-label="Start recording"
              >
                <span className="button-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                </span>
                <span className="button-text">Start Recording</span>
              </button>

              {/* Features */}
              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon" aria-hidden="true">⚡</div>
                  <h3>Real-Time</h3>
                  <p>See your words appear as you speak with sub-500ms latency</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon" aria-hidden="true">🎨</div>
                  <h3>Beautiful</h3>
                  <p>Stunning audio visualization at 60 FPS</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon" aria-hidden="true">🤖</div>
                  <h3>AI-Powered</h3>
                  <p>Powered by Google Gemini for accurate transcription</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Recording Section - shown when started */}
        {isStarted && (
          <section className="recording-section">
            {/* Connection Status */}
            <div className="status-bar">
              <ConnectionStatusIndicator
                connectionStatus={connectionStatus}
                healthStatus={healthStatus}
                reconnectAttempts={reconnectAttempts}
              />
            </div>

            {/* Visualizer */}
            <div className="visualizer-container">
              <CircularVisualizer
                analyserNode={analyserNode}
                isActive={isRecording}
                size={responsiveSize.size}
                colorScheme={colorScheme}
                onTap={handlePauseResume}
                enableTouchInteraction={true}
                className={isRecording ? 'recording' : 'paused'}
              />
              
              {/* Recording indicator */}
              <div className={`recording-indicator ${isRecording ? 'active' : ''}`}>
                <span className="indicator-dot" aria-hidden="true" />
                <span className="indicator-text">
                  {isRecording ? 'Recording' : sessionState === 'paused' ? 'Paused' : 'Ready'}
                </span>
              </div>
            </div>

            {/* Transcription Display */}
            <div className="transcription-section">
              <TranscriptionDisplay
                transcriptionHistory={transcriptionHistory}
                currentInterim={currentInterim}
                isRecording={isRecording}
                sessionState={sessionState}
                onPauseResume={handlePauseResume}
              />
            </div>

            {/* Control Buttons */}
            <div className="control-bar">
              <button
                className="control-button secondary"
                onClick={handleNewSession}
                aria-label="New session"
              >
                <span className="button-icon" aria-hidden="true">↺</span>
                New Session
              </button>
              
              <button
                className={`control-button ${isRecording ? 'pause' : 'resume'}`}
                onClick={handlePauseResume}
                aria-label={isRecording ? 'Pause recording' : 'Resume recording'}
              >
                <span className="button-icon" aria-hidden="true">
                  {isRecording ? '⏸' : '▶'}
                </span>
                {isRecording ? 'Pause' : 'Resume'}
              </button>
              
              <button
                className="control-button stop"
                onClick={handleStopRecording}
                aria-label="Stop recording"
              >
                <span className="button-icon" aria-hidden="true">⏹</span>
                Stop
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <p>Powered by Gemini AI • Built with React & Spring Boot</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
