/**
 * AudioStreamingService - Integrates audio capture with WebSocket streaming
 * 
 * Requirements: 4.2, 4.3, 4.4
 * - Create MediaRecorder with WebM/Opus encoding
 * - Configure chunk interval (100-500ms via timeslice)
 * - Stream chunks to WebSocket as binary data
 */

import { AudioCaptureService, AudioCaptureCallbacks } from './AudioCaptureService';
import { WebSocketService, WebSocketCallbacks } from './WebSocketService';
import { ConnectionStatus, TranscriptionUpdate } from '../types';

export type StreamingStatus = 
  | 'idle' 
  | 'connecting' 
  | 'streaming' 
  | 'paused' 
  | 'reconnecting' 
  | 'error';

export interface AudioStreamingCallbacks {
  onStatusChange?: (status: StreamingStatus) => void;
  onTranscriptionUpdate?: (update: TranscriptionUpdate) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: AudioStreamingError) => void;
  onChunkSent?: (chunk: Blob) => void;
}

export interface AudioStreamingError {
  type: 'audio' | 'websocket' | 'unknown';
  message: string;
  originalError?: Error | undefined;
}

export interface AudioStreamingConfig {
  /** WebSocket server URL */
  serverUrl: string;
  /** Audio chunk interval in ms (100-500ms per requirements) */
  chunkIntervalMs: number;
}

const DEFAULT_CONFIG: AudioStreamingConfig = {
  serverUrl: 'ws://localhost:8080/ws/transcription',
  chunkIntervalMs: 250 // 250ms chunks (within 100-500ms range per Requirement 4.2)
};

// Valid chunk interval range per requirements
export const MIN_CHUNK_INTERVAL_MS = 100;
export const MAX_CHUNK_INTERVAL_MS = 500;

export class AudioStreamingService {
  private audioCaptureService: AudioCaptureService;
  private webSocketService: WebSocketService;
  private config: AudioStreamingConfig;
  private callbacks: AudioStreamingCallbacks = {};
  private status: StreamingStatus = 'idle';
  private chunkCount = 0;

  constructor(
    callbacks?: AudioStreamingCallbacks,
    config?: Partial<AudioStreamingConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Validate chunk interval is within required range
    this.config.chunkIntervalMs = Math.max(
      MIN_CHUNK_INTERVAL_MS,
      Math.min(MAX_CHUNK_INTERVAL_MS, this.config.chunkIntervalMs)
    );

    if (callbacks) {
      this.callbacks = callbacks;
    }

    // Initialize audio capture service with callbacks
    const audioCaptureCallbacks: AudioCaptureCallbacks = {
      onStatusChange: (status) => this.handleAudioStatusChange(status),
      onError: (error) => this.handleAudioError(error),
      onChunkAvailable: (chunk) => this.handleAudioChunk(chunk),
      onDisconnect: () => this.handleAudioDisconnect(),
      onReconnect: () => this.handleAudioReconnect()
    };
    this.audioCaptureService = new AudioCaptureService(audioCaptureCallbacks);

    // Initialize WebSocket service with callbacks
    const webSocketCallbacks: WebSocketCallbacks = {
      onTranscriptionUpdate: (update) => this.callbacks.onTranscriptionUpdate?.(update),
      onConnectionStatusChange: (status) => this.handleWebSocketStatusChange(status),
      onError: (error) => this.handleWebSocketError(error)
    };
    this.webSocketService = new WebSocketService(webSocketCallbacks);
  }

  /**
   * Start streaming audio to backend
   * Requirements: 4.1, 4.2, 4.3
   */
  async startStreaming(): Promise<void> {
    if (this.status === 'streaming') {
      return; // Already streaming
    }

    this.setStatus('connecting');
    this.chunkCount = 0;

    try {
      // First, establish WebSocket connection (Requirement 4.1)
      await this.webSocketService.connect(this.config.serverUrl);

      // Then, request microphone access
      await this.audioCaptureService.requestMicrophoneAccess();

      // Start recording with configured chunk interval (Requirement 4.2)
      this.startRecording();

      this.setStatus('streaming');
    } catch (err) {
      this.setStatus('error');
      this.callbacks.onError?.({
        type: 'unknown',
        message: err instanceof Error ? err.message : 'Failed to start streaming',
        originalError: err instanceof Error ? err : undefined
      });
      throw err;
    }
  }

  /**
   * Start MediaRecorder with configured timeslice
   * Requirement 4.2: Stream audio chunks in 100-500ms segments
   */
  private startRecording(): void {
    const mediaRecorder = this.audioCaptureService.getMediaRecorder();
    if (mediaRecorder && mediaRecorder.state === 'inactive') {
      // Start with timeslice to get chunks at regular intervals
      mediaRecorder.start(this.config.chunkIntervalMs);
    }
  }

  /**
   * Handle audio chunk from MediaRecorder
   * Requirement 4.4: Share same audio stream without duplicate capture
   */
  private handleAudioChunk(chunk: Blob): void {
    if (this.status !== 'streaming') {
      return;
    }

    // Stream chunk to WebSocket as binary data
    this.webSocketService.sendAudioChunk(chunk);
    this.chunkCount++;
    this.callbacks.onChunkSent?.(chunk);
  }

  /**
   * Pause streaming
   * Requirement 8.2: Stop streaming audio but maintain WebSocket connection
   */
  pauseStreaming(): void {
    if (this.status !== 'streaming') {
      return;
    }

    this.audioCaptureService.pauseRecording();
    this.setStatus('paused');
  }

  /**
   * Resume streaming
   * Requirement 8.3: Continue streaming from current audio position
   */
  resumeStreaming(): void {
    if (this.status !== 'paused') {
      return;
    }

    this.audioCaptureService.resumeRecording();
    this.setStatus('streaming');
  }

  /**
   * Stop streaming and disconnect
   */
  stopStreaming(): void {
    this.audioCaptureService.stopRecording();
    this.audioCaptureService.disconnect();
    this.webSocketService.disconnect();
    this.setStatus('idle');
    this.chunkCount = 0;
  }

  /**
   * Handle audio capture status changes
   */
  private handleAudioStatusChange(status: string): void {
    if (status === 'disconnected' || status === 'reconnecting') {
      this.setStatus('reconnecting');
    }
  }

  /**
   * Handle audio capture errors
   */
  private handleAudioError(error: { type: string; message: string }): void {
    this.setStatus('error');
    this.callbacks.onError?.({
      type: 'audio',
      message: error.message
    });
  }

  /**
   * Handle audio disconnect
   */
  private handleAudioDisconnect(): void {
    this.setStatus('reconnecting');
  }

  /**
   * Handle audio reconnect
   */
  private handleAudioReconnect(): void {
    if (this.webSocketService.isConnected()) {
      this.startRecording();
      this.setStatus('streaming');
    }
  }

  /**
   * Handle WebSocket status changes
   */
  private handleWebSocketStatusChange(status: ConnectionStatus): void {
    this.callbacks.onConnectionStatusChange?.(status);

    if (status === 'disconnected' || status === 'reconnecting') {
      if (this.status === 'streaming') {
        this.setStatus('reconnecting');
      }
    } else if (status === 'connected' && this.status === 'reconnecting') {
      if (this.audioCaptureService.isActive()) {
        this.startRecording();
        this.setStatus('streaming');
      }
    }
  }

  /**
   * Handle WebSocket errors
   */
  private handleWebSocketError(error: { type: string; message: string }): void {
    this.callbacks.onError?.({
      type: 'websocket',
      message: error.message
    });
  }

  /**
   * Get current streaming status
   */
  getStatus(): StreamingStatus {
    return this.status;
  }

  /**
   * Get WebSocket connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.webSocketService.getStatus();
  }

  /**
   * Check if currently streaming
   */
  isStreaming(): boolean {
    return this.status === 'streaming';
  }

  /**
   * Get the AnalyserNode for visualization
   */
  getAnalyserNode(): AnalyserNode | null {
    return this.audioCaptureService.getAnalyserNode();
  }

  /**
   * Get frequency data for visualization
   */
  getFrequencyData(): Uint8Array {
    return this.audioCaptureService.getFrequencyData();
  }

  /**
   * Get chunk count
   */
  getChunkCount(): number {
    return this.chunkCount;
  }

  /**
   * Get configured chunk interval
   */
  getChunkIntervalMs(): number {
    return this.config.chunkIntervalMs;
  }

  /**
   * Set status and notify callback
   */
  private setStatus(status: StreamingStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: AudioStreamingCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}

// Export singleton factory
let instance: AudioStreamingService | null = null;

export function getAudioStreamingService(
  callbacks?: AudioStreamingCallbacks,
  config?: Partial<AudioStreamingConfig>
): AudioStreamingService {
  if (!instance) {
    instance = new AudioStreamingService(callbacks, config);
  } else if (callbacks) {
    instance.setCallbacks(callbacks);
  }
  return instance;
}

export function resetAudioStreamingService(): void {
  if (instance) {
    instance.stopStreaming();
    instance = null;
  }
}

/**
 * Utility function to validate chunk duration
 * Used for property testing (Property 5)
 */
export function isValidChunkDuration(durationMs: number): boolean {
  return durationMs >= MIN_CHUNK_INTERVAL_MS && durationMs <= MAX_CHUNK_INTERVAL_MS;
}

/**
 * Calculate expected chunk duration from timeslice
 * Note: Actual chunk duration may vary slightly due to browser implementation
 */
export function calculateExpectedChunkDuration(timesliceMs: number): number {
  return Math.max(MIN_CHUNK_INTERVAL_MS, Math.min(MAX_CHUNK_INTERVAL_MS, timesliceMs));
}
