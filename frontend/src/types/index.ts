/**
 * Shared types for the Real-Time Audio Transcription Platform
 */

/**
 * TranscriptionUpdate represents a transcription message from the backend.
 * Contains partial or final transcription text with metadata.
 */
export interface TranscriptionUpdate {
  /** Type of transcription: 'partial' for interim results, 'final' for completed segments */
  type: 'partial' | 'final';
  /** The transcribed text content */
  text: string;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** ISO-8601 timestamp of when the transcription was generated */
  timestamp: string;
  /** Monotonically increasing sequence identifier for ordering */
  sequenceId: number;
}

/**
 * Connection status for WebSocket communication
 */
export type ConnectionStatus = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'reconnecting' 
  | 'error';

/**
 * Health status for backend services
 */
export interface ConnectionHealthStatus {
  /** WebSocket connection state */
  websocket: 'connected' | 'disconnected' | 'reconnecting';
  /** Gemini API health state */
  geminiApi: 'healthy' | 'degraded' | 'unavailable';
  /** Current latency in milliseconds */
  latencyMs: number;
  /** ISO-8601 timestamp of last heartbeat */
  lastHeartbeat: string;
}

/**
 * Configuration for the circular visualizer
 */
export interface VisualizerConfig {
  /** Inner circle radius (low frequencies) */
  innerRadius: number;
  /** Max bar extension (high frequencies) */
  outerRadius: number;
  /** Number of frequency bars (64-128) */
  barCount: number;
  /** Animation damping factor (0.1-0.3) */
  smoothingFactor: number;
  /** Minimum decibels for scaling (-90 dB typical) */
  minDecibels: number;
  /** Maximum decibels for scaling (-10 dB typical) */
  maxDecibels: number;
}

/**
 * Color scheme options for the visualizer
 */
export type ColorScheme = 'dark' | 'light' | 'gradient';

/**
 * Session state for recording sessions
 */
export type SessionState = 'active' | 'paused' | 'closed';
