/**
 * AudioCaptureService - Manages microphone access and audio stream initialization
 * 
 * Requirements: 1.1, 1.2, 1.3, 2.1
 * - Request microphone permission via getUserMedia
 * - Initialize AudioContext with 44.1kHz+ sample rate
 * - Create AnalyserNode with FFT configuration (fftSize: 2048)
 * - Handle permission denied and device not found errors
 */

export type AudioCaptureStatus = 
  | 'idle' 
  | 'requesting' 
  | 'active' 
  | 'disconnected' 
  | 'reconnecting' 
  | 'error';

export interface AudioCaptureError {
  type: 'permission_denied' | 'device_not_found' | 'not_supported' | 'unknown';
  message: string;
  originalError?: Error | undefined;
}

export interface AudioCaptureCallbacks {
  onStatusChange?: (status: AudioCaptureStatus) => void;
  onError?: (error: AudioCaptureError) => void;
  onChunkAvailable?: (chunk: Blob) => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
}

const MIN_SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;
const CHUNK_INTERVAL_MS = 250; // 250ms chunks (within 100-500ms range)

export class AudioCaptureService {
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private status: AudioCaptureStatus = 'idle';
  private callbacks: AudioCaptureCallbacks = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(callbacks?: AudioCaptureCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  /**
   * Request microphone access and initialize audio processing
   * Requirements: 1.1, 1.2, 1.3
   */
  async requestMicrophoneAccess(): Promise<MediaStream> {
    this.setStatus('requesting');

    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const error: AudioCaptureError = {
        type: 'not_supported',
        message: "Your browser doesn't support audio recording. Please use Chrome, Firefox, or Safari."
      };
      this.handleError(error);
      throw error;
    }

    try {
      // Request microphone permission (Requirement 1.1)
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: { ideal: MIN_SAMPLE_RATE }
        }
      });

      // Initialize AudioContext with 44.1kHz+ sample rate (Requirement 1.3)
      await this.initializeAudioContext();
      
      // Set up disconnect detection
      this.setupDisconnectDetection();
      
      // Initialize MediaRecorder for streaming
      this.initializeMediaRecorder();

      this.setStatus('active');
      this.reconnectAttempts = 0;
      
      return this.mediaStream;
    } catch (err) {
      const error = this.mapError(err);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Initialize AudioContext and AnalyserNode
   * Requirements: 1.3, 2.1
   */
  private async initializeAudioContext(): Promise<void> {
    if (!this.mediaStream) {
      throw new Error('MediaStream not available');
    }

    // Create AudioContext with minimum 44.1kHz sample rate (Requirement 1.3)
    this.audioContext = new AudioContext({
      sampleRate: MIN_SAMPLE_RATE
    });

    // Resume context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Create AnalyserNode with FFT configuration (Requirement 2.1)
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = FFT_SIZE;
    this.analyserNode.smoothingTimeConstant = 0.8;
    this.analyserNode.minDecibels = -90;
    this.analyserNode.maxDecibels = -10;

    // Connect media stream to analyser
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.sourceNode.connect(this.analyserNode);
  }

  /**
   * Initialize MediaRecorder for audio chunk streaming
   */
  private initializeMediaRecorder(): void {
    if (!this.mediaStream) {
      throw new Error('MediaStream not available');
    }

    // Prefer WebM/Opus format as specified in requirements
    const mimeType = this.getSupportedMimeType();
    
    this.mediaRecorder = new MediaRecorder(this.mediaStream, {
      mimeType,
      audioBitsPerSecond: 128000
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.callbacks.onChunkAvailable) {
        this.callbacks.onChunkAvailable(event.data);
      }
    };

    this.mediaRecorder.onerror = () => {
      this.handleError({
        type: 'unknown',
        message: 'MediaRecorder error occurred'
      });
    };
  }

  /**
   * Get supported MIME type for MediaRecorder
   */
  private getSupportedMimeType(): string {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return ''; // Let browser choose default
  }

  /**
   * Set up detection for microphone disconnect
   * Requirement 1.4
   */
  private setupDisconnectDetection(): void {
    if (!this.mediaStream) return;

    const tracks = this.mediaStream.getAudioTracks();
    tracks.forEach(track => {
      track.onended = () => {
        this.handleDisconnect();
      };
    });
  }

  /**
   * Handle microphone disconnect
   * Requirement 1.4
   */
  private handleDisconnect(): void {
    this.setStatus('disconnected');
    this.callbacks.onDisconnect?.();
    
    // Attempt automatic reconnection
    this.attemptReconnect();
  }

  /**
   * Attempt to reconnect to microphone
   * Requirement 1.5
   */
  async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.handleError({
        type: 'device_not_found',
        message: 'Unable to reconnect to microphone after multiple attempts'
      });
      return;
    }

    this.setStatus('reconnecting');
    this.reconnectAttempts++;

    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 5000);
    
    this.reconnectTimeoutId = setTimeout(async () => {
      try {
        await this.reconnect();
      } catch {
        this.attemptReconnect();
      }
    }, delay);
  }

  /**
   * Reconnect to microphone
   * Requirement 1.5
   */
  async reconnect(): Promise<void> {
    // Clean up existing resources
    this.cleanupResources();

    try {
      await this.requestMicrophoneAccess();
      this.callbacks.onReconnect?.();
    } catch (err) {
      throw err;
    }
  }

  /**
   * Start recording audio chunks
   */
  startRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
      this.mediaRecorder.start(CHUNK_INTERVAL_MS);
    }
  }

  /**
   * Stop recording audio chunks
   */
  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  /**
   * Get the AudioContext instance
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Get the AnalyserNode instance
   */
  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  /**
   * Get the MediaRecorder instance
   */
  getMediaRecorder(): MediaRecorder | null {
    return this.mediaRecorder;
  }

  /**
   * Get the MediaStream instance
   */
  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  /**
   * Get current status
   */
  getStatus(): AudioCaptureStatus {
    return this.status;
  }

  /**
   * Check if service is active
   */
  isActive(): boolean {
    return this.status === 'active';
  }

  /**
   * Get frequency data from AnalyserNode
   * Requirement 2.1
   */
  getFrequencyData(): Uint8Array {
    if (!this.analyserNode) {
      return new Uint8Array(0);
    }
    
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Get time domain data from AnalyserNode
   */
  getTimeDomainData(): Uint8Array {
    if (!this.analyserNode) {
      return new Uint8Array(0);
    }
    
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  /**
   * Disconnect and clean up all resources
   */
  disconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    
    this.cleanupResources();
    this.setStatus('idle');
  }

  /**
   * Clean up audio resources
   */
  private cleanupResources(): void {
    // Stop recording
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;

    // Disconnect source node
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Stop media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.analyserNode = null;
  }

  /**
   * Map browser errors to AudioCaptureError
   * Requirements: 1.2
   */
  private mapError(err: unknown): AudioCaptureError {
    if (err instanceof DOMException) {
      switch (err.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          return {
            type: 'permission_denied',
            message: 'Microphone access is required. Please allow microphone permission in your browser settings.',
            originalError: err
          };
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          return {
            type: 'device_not_found',
            message: 'No microphone detected. Please connect a microphone and try again.',
            originalError: err
          };
        case 'NotSupportedError':
          return {
            type: 'not_supported',
            message: "Your browser doesn't support audio recording. Please use Chrome, Firefox, or Safari.",
            originalError: err
          };
        default:
          return {
            type: 'unknown',
            message: `Audio capture error: ${err.message}`,
            originalError: err
          };
      }
    }

    return {
      type: 'unknown',
      message: err instanceof Error ? err.message : 'Unknown error occurred',
      originalError: err instanceof Error ? err : undefined
    };
  }

  /**
   * Set status and notify callback
   */
  private setStatus(status: AudioCaptureStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  /**
   * Handle error and notify callback
   */
  private handleError(error: AudioCaptureError): void {
    this.setStatus('error');
    this.callbacks.onError?.(error);
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: AudioCaptureCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}

// Export singleton factory
let instance: AudioCaptureService | null = null;

export function getAudioCaptureService(callbacks?: AudioCaptureCallbacks): AudioCaptureService {
  if (!instance) {
    instance = new AudioCaptureService(callbacks);
  } else if (callbacks) {
    instance.setCallbacks(callbacks);
  }
  return instance;
}

export function resetAudioCaptureService(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}
