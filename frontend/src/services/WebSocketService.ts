/**
 * WebSocketService - Manages WebSocket connection for backend communication
 * 
 * Requirements: 4.1, 9.1, 9.2
 * - Implement WebSocket connection with reconnection logic
 * - Handle connection status changes (connecting, connected, disconnected, reconnecting)
 * - Implement message sending for audio chunks
 */

import { ConnectionStatus, TranscriptionUpdate } from '../types';

export interface WebSocketCallbacks {
  onTranscriptionUpdate?: (update: TranscriptionUpdate) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: WebSocketError) => void;
}

export interface WebSocketError {
  type: 'connection_failed' | 'send_failed' | 'parse_error' | 'unknown';
  message: string;
  originalError?: Error | undefined;
}

export interface WebSocketConfig {
  /** Maximum reconnection attempts before giving up */
  maxReconnectAttempts: number;
  /** Base delay for exponential backoff in ms */
  baseReconnectDelay: number;
  /** Maximum delay between reconnection attempts in ms */
  maxReconnectDelay: number;
  /** Heartbeat interval in ms (0 to disable) */
  heartbeatInterval: number;
}

const DEFAULT_CONFIG: WebSocketConfig = {
  maxReconnectAttempts: 5,
  baseReconnectDelay: 1000,
  maxReconnectDelay: 30000,
  heartbeatInterval: 30000
};

export class WebSocketService {
  private socket: WebSocket | null = null;
  private url: string = '';
  private status: ConnectionStatus = 'disconnected';
  private callbacks: WebSocketCallbacks = {};
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private messageQueue: ArrayBuffer[] = [];
  private isIntentionalClose = false;

  constructor(callbacks?: WebSocketCallbacks, config?: Partial<WebSocketConfig>) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connect to WebSocket server
   * Requirement 4.1: Establish WebSocket connection to backend
   */
  async connect(url: string): Promise<void> {
    if (this.socket && this.status === 'connected') {
      return; // Already connected
    }

    this.url = url;
    this.isIntentionalClose = false;
    this.setStatus('connecting');

    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(url);
        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
          this.handleOpen();
          resolve();
        };

        this.socket.onclose = (event) => {
          this.handleClose(event);
          if (this.status === 'connecting') {
            reject(new Error(`WebSocket connection failed: ${event.reason || 'Unknown reason'}`));
          }
        };

        this.socket.onerror = (event) => {
          this.handleError(event);
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event);
        };
      } catch (err) {
        const error: WebSocketError = {
          type: 'connection_failed',
          message: err instanceof Error ? err.message : 'Failed to create WebSocket connection',
          originalError: err instanceof Error ? err : undefined
        };
        this.callbacks.onError?.(error);
        this.setStatus('error');
        reject(error);
      }
    });
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    this.setStatus('connected');
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.flushMessageQueue();
  }

  /**
   * Handle WebSocket close event
   * Requirement 9.2: Attempt automatic reconnection
   */
  private handleClose(event: CloseEvent): void {
    this.stopHeartbeat();
    
    if (this.isIntentionalClose) {
      this.setStatus('disconnected');
      return;
    }

    // Attempt reconnection if not intentionally closed
    if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.attemptReconnect();
    } else {
      this.setStatus('disconnected');
      this.callbacks.onError?.({
        type: 'connection_failed',
        message: `WebSocket closed: ${event.reason || 'Connection lost'}`
      });
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(_event: Event): void {
    // Error details are limited in browser WebSocket API
    // The close event will follow with more details
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      // Handle text messages (transcription updates)
      if (typeof event.data === 'string') {
        const update = JSON.parse(event.data) as TranscriptionUpdate;
        this.callbacks.onTranscriptionUpdate?.(update);
      }
      // Binary messages could be handled here if needed
    } catch (err) {
      this.callbacks.onError?.({
        type: 'parse_error',
        message: 'Failed to parse server message',
        originalError: err instanceof Error ? err : undefined
      });
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   * Requirement 9.2: Display reconnection status and attempt automatic reconnection
   */
  private attemptReconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    this.setStatus('reconnecting');
    this.reconnectAttempts++;

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    );

    this.reconnectTimeoutId = setTimeout(async () => {
      try {
        await this.connect(this.url);
      } catch {
        // handleClose will be called and may trigger another reconnect attempt
      }
    }, delay);
  }

  /**
   * Send audio chunk as binary data
   * Requirement 4.1: Stream audio chunks to backend
   */
  sendAudioChunk(chunk: Blob): void {
    if (!this.socket || this.status !== 'connected') {
      // Queue the message for later if not connected
      chunk.arrayBuffer().then(buffer => {
        this.messageQueue.push(buffer);
      });
      return;
    }

    chunk.arrayBuffer().then(buffer => {
      this.sendBinary(buffer);
    }).catch(err => {
      this.callbacks.onError?.({
        type: 'send_failed',
        message: 'Failed to convert audio chunk to buffer',
        originalError: err instanceof Error ? err : undefined
      });
    });
  }

  /**
   * Send binary data through WebSocket
   */
  private sendBinary(data: ArrayBuffer): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(data);
      return;
    }

    try {
      this.socket.send(data);
    } catch (err) {
      this.callbacks.onError?.({
        type: 'send_failed',
        message: 'Failed to send audio chunk',
        originalError: err instanceof Error ? err : undefined
      });
    }
  }

  /**
   * Send text message through WebSocket
   */
  sendMessage(message: object): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.socket.send(JSON.stringify(message));
    } catch (err) {
      this.callbacks.onError?.({
        type: 'send_failed',
        message: 'Failed to send message',
        originalError: err instanceof Error ? err : undefined
      });
    }
  }

  /**
   * Flush queued messages after reconnection
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const data = this.messageQueue.shift();
      if (data) {
        this.sendBinary(data);
      }
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) return;

    this.stopHeartbeat();
    this.heartbeatIntervalId = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isIntentionalClose = true;
    
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    this.stopHeartbeat();
    this.messageQueue = [];

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }

    this.setStatus('disconnected');
  }

  /**
   * Reconnect to WebSocket server
   */
  async reconnect(): Promise<void> {
    this.disconnect();
    this.isIntentionalClose = false;
    this.reconnectAttempts = 0;
    await this.connect(this.url);
  }

  /**
   * Get current connection status
   * Requirement 9.1: Display real-time backend connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status === 'connected' && 
           this.socket !== null && 
           this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Get reconnection attempts count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Set status and notify callback
   */
  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.callbacks.onConnectionStatusChange?.(status);
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: WebSocketCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}

// Export singleton factory
let instance: WebSocketService | null = null;

export function getWebSocketService(
  callbacks?: WebSocketCallbacks, 
  config?: Partial<WebSocketConfig>
): WebSocketService {
  if (!instance) {
    instance = new WebSocketService(callbacks, config);
  } else if (callbacks) {
    instance.setCallbacks(callbacks);
  }
  return instance;
}

export function resetWebSocketService(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}
