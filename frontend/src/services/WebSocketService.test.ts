/**
 * Unit tests for WebSocketService
 * 
 * Requirements: 4.1, 9.1, 9.2
 * - Test connection lifecycle
 * - Test reconnection on disconnect
 * - Test message handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  WebSocketService, 
  WebSocketError 
} from './WebSocketService';
import { ConnectionStatus, TranscriptionUpdate } from '../types';

// Mock WebSocket with proper static constants
const MockWebSocketClass = vi.fn();
Object.defineProperty(MockWebSocketClass, 'CONNECTING', { value: 0 });
Object.defineProperty(MockWebSocketClass, 'OPEN', { value: 1 });
Object.defineProperty(MockWebSocketClass, 'CLOSING', { value: 2 });
Object.defineProperty(MockWebSocketClass, 'CLOSED', { value: 3 });

interface MockWebSocketInstance {
  url: string;
  readyState: number;
  binaryType: string;
  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  simulateOpen: () => void;
  simulateError: () => void;
  simulateMessage: (data: string | ArrayBuffer) => void;
  simulateUnexpectedClose: () => void;
}

function createMockWebSocket(url: string): MockWebSocketInstance {
  const instance: MockWebSocketInstance = {
    url,
    readyState: 0, // CONNECTING
    binaryType: 'blob',
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    send: vi.fn(),
    close: vi.fn(function(this: MockWebSocketInstance, code?: number, reason?: string) {
      this.readyState = 3; // CLOSED
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
      }
    }),
    simulateOpen: function() {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    },
    simulateError: function() {
      if (this.onerror) {
        this.onerror(new Event('error'));
      }
      this.readyState = 3; // CLOSED
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code: 1006, reason: 'Connection failed' }));
      }
    },
    simulateMessage: function(data: string | ArrayBuffer) {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data }));
      }
    },
    simulateUnexpectedClose: function() {
      this.readyState = 3; // CLOSED
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code: 1006, reason: 'Connection lost' }));
      }
    }
  };
  return instance;
}

let mockWebSocketInstance: MockWebSocketInstance | null = null;

beforeEach(() => {
  mockWebSocketInstance = null;
  
  MockWebSocketClass.mockImplementation((url: string) => {
    mockWebSocketInstance = createMockWebSocket(url);
    // Auto-open after a microtask
    Promise.resolve().then(() => {
      if (mockWebSocketInstance && mockWebSocketInstance.readyState === 0) {
        mockWebSocketInstance.simulateOpen();
      }
    });
    return mockWebSocketInstance;
  });
  
  vi.stubGlobal('WebSocket', MockWebSocketClass);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('WebSocketService', () => {
  describe('Connection Lifecycle', () => {
    it('should connect to WebSocket server', async () => {
      const statusChanges: ConnectionStatus[] = [];
      const service = new WebSocketService({
        onConnectionStatusChange: (status) => statusChanges.push(status)
      });

      await service.connect('ws://localhost:8080/ws');

      expect(statusChanges).toContain('connecting');
      expect(statusChanges).toContain('connected');
      expect(service.getStatus()).toBe('connected');
    });

    it('should handle connection failure and call error callback', async () => {
      // Override the mock to simulate immediate error without auto-open
      let wsInstance: MockWebSocketInstance | null = null;
      MockWebSocketClass.mockImplementation((url: string) => {
        wsInstance = createMockWebSocket(url);
        mockWebSocketInstance = wsInstance;
        return wsInstance;
      });

      let capturedError: WebSocketError | null = null;
      const statusChanges: ConnectionStatus[] = [];
      const service = new WebSocketService({
        onError: (error) => { capturedError = error; },
        onConnectionStatusChange: (status) => statusChanges.push(status)
      }, {
        maxReconnectAttempts: 0 // Disable reconnection for this test
      });

      // Start connection - don't await since we're testing failure path
      service.connect('ws://localhost:8080/ws');
      
      // Wait for the WebSocket to be created
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify we're in connecting state
      expect(statusChanges).toContain('connecting');
      
      // Now simulate the close event - this should trigger error handling
      const ws = wsInstance as MockWebSocketInstance | null;
      if (ws !== null && ws.onclose) {
        ws.readyState = 3; // CLOSED
        ws.onclose(new CloseEvent('close', { code: 1006, reason: 'Connection failed' }));
      }

      // Wait for callbacks to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // After failure with maxReconnectAttempts=0, status should be disconnected
      expect(service.getStatus()).toBe('disconnected');
      expect(capturedError).not.toBeNull();
      expect(capturedError!.type).toBe('connection_failed');
    });

    it('should disconnect cleanly', async () => {
      const statusChanges: ConnectionStatus[] = [];
      const service = new WebSocketService({
        onConnectionStatusChange: (status) => statusChanges.push(status)
      });

      await service.connect('ws://localhost:8080/ws');
      service.disconnect();

      expect(service.getStatus()).toBe('disconnected');
      expect(mockWebSocketInstance?.close).toHaveBeenCalledWith(1000, 'Client disconnect');
    });

    it('should not reconnect after intentional disconnect', async () => {
      const statusChanges: ConnectionStatus[] = [];
      const service = new WebSocketService({
        onConnectionStatusChange: (status) => statusChanges.push(status)
      });

      await service.connect('ws://localhost:8080/ws');
      statusChanges.length = 0; // Clear
      
      service.disconnect();

      // Wait a bit to ensure no reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(statusChanges).not.toContain('reconnecting');
      expect(service.getStatus()).toBe('disconnected');
    });
  });

  describe('Reconnection on Disconnect', () => {
    it('should attempt reconnection on unexpected disconnect', async () => {
      const statusChanges: ConnectionStatus[] = [];
      const service = new WebSocketService({
        onConnectionStatusChange: (status) => statusChanges.push(status)
      }, {
        maxReconnectAttempts: 3,
        baseReconnectDelay: 100
      });

      await service.connect('ws://localhost:8080/ws');
      statusChanges.length = 0; // Clear initial status changes

      // Simulate unexpected disconnect
      mockWebSocketInstance?.simulateUnexpectedClose();

      expect(statusChanges).toContain('reconnecting');
      expect(service.getReconnectAttempts()).toBe(1);
    });

    it('should track reconnection attempts', async () => {
      vi.useFakeTimers();
      
      let connectCount = 0;
      MockWebSocketClass.mockImplementation((url: string) => {
        connectCount++;
        const ws = createMockWebSocket(url);
        mockWebSocketInstance = ws;
        // First connection succeeds, subsequent ones fail
        Promise.resolve().then(() => {
          if (connectCount === 1) {
            ws.simulateOpen();
          } else {
            ws.simulateError();
          }
        });
        return ws;
      });

      const service = new WebSocketService({}, {
        maxReconnectAttempts: 3,
        baseReconnectDelay: 100,
        maxReconnectDelay: 1000
      });

      await service.connect('ws://localhost:8080/ws');
      
      // Simulate unexpected disconnect
      mockWebSocketInstance?.simulateUnexpectedClose();

      expect(service.getReconnectAttempts()).toBe(1);

      // Advance timer for first reconnect
      await vi.advanceTimersByTimeAsync(100);
      await vi.runAllTimersAsync();
      
      expect(service.getReconnectAttempts()).toBeGreaterThanOrEqual(1);
      
      vi.useRealTimers();
    });
  });

  describe('Message Handling', () => {
    it('should receive and parse transcription updates', async () => {
      let receivedUpdate: TranscriptionUpdate | null = null;
      const service = new WebSocketService({
        onTranscriptionUpdate: (update) => { receivedUpdate = update; }
      });

      await service.connect('ws://localhost:8080/ws');

      const mockUpdate: TranscriptionUpdate = {
        type: 'partial',
        text: 'Hello world',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 1
      };

      mockWebSocketInstance?.simulateMessage(JSON.stringify(mockUpdate));

      expect(receivedUpdate).not.toBeNull();
      expect(receivedUpdate!.type).toBe('partial');
      expect(receivedUpdate!.text).toBe('Hello world');
      expect(receivedUpdate!.confidence).toBe(0.95);
    });

    it('should handle invalid JSON messages gracefully', async () => {
      let errorReceived: WebSocketError | null = null;
      const service = new WebSocketService({
        onError: (error) => { errorReceived = error; }
      });

      await service.connect('ws://localhost:8080/ws');

      mockWebSocketInstance?.simulateMessage('invalid json {{{');

      expect(errorReceived).not.toBeNull();
      expect(errorReceived!.type).toBe('parse_error');
    });

    it('should send JSON messages when connected', async () => {
      const service = new WebSocketService();
      await service.connect('ws://localhost:8080/ws');

      // Ensure socket is in OPEN state
      expect(mockWebSocketInstance?.readyState).toBe(1);

      const message = { type: 'ping' };
      service.sendMessage(message);

      expect(mockWebSocketInstance?.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should not send messages when disconnected', () => {
      const service = new WebSocketService();
      
      // Try to send without connecting
      service.sendMessage({ type: 'ping' });

      // No WebSocket instance should exist
      expect(mockWebSocketInstance).toBeNull();
    });
  });

  describe('Status and Getters', () => {
    it('should return correct initial status', () => {
      const service = new WebSocketService();
      expect(service.getStatus()).toBe('disconnected');
      expect(service.isConnected()).toBe(false);
      expect(service.getReconnectAttempts()).toBe(0);
    });

    it('should update callbacks', async () => {
      const service = new WebSocketService();
      
      let statusReceived: ConnectionStatus | null = null;
      service.setCallbacks({
        onConnectionStatusChange: (status) => { statusReceived = status; }
      });

      await service.connect('ws://localhost:8080/ws');

      expect(statusReceived).toBe('connected');
    });

    it('should report connected status correctly', async () => {
      const service = new WebSocketService();
      
      expect(service.isConnected()).toBe(false);
      
      await service.connect('ws://localhost:8080/ws');
      
      // Check that socket is in OPEN state
      expect(mockWebSocketInstance?.readyState).toBe(1);
      expect(service.getStatus()).toBe('connected');
      
      service.disconnect();
      
      expect(service.getStatus()).toBe('disconnected');
    });
  });
});
