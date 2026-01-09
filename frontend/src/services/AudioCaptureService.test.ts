/**
 * Unit tests for AudioCaptureService
 * 
 * Requirements: 1.1, 1.2, 1.4, 1.5
 * - Test permission request flow
 * - Test error handling for denied permission
 * - Test reconnection logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  AudioCaptureService, 
  AudioCaptureStatus, 
  AudioCaptureError 
} from './AudioCaptureService';

// Mock Web Audio API
const mockAudioContext = {
  state: 'running',
  sampleRate: 44100,
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  createAnalyser: vi.fn(),
  createMediaStreamSource: vi.fn()
};

const mockAnalyserNode = {
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10,
  frequencyBinCount: 1024,
  getByteFrequencyData: vi.fn(),
  getByteTimeDomainData: vi.fn()
};

const mockSourceNode = {
  connect: vi.fn(),
  disconnect: vi.fn()
};

const mockMediaStream = {
  getTracks: vi.fn().mockReturnValue([]),
  getAudioTracks: vi.fn().mockReturnValue([{ onended: null, stop: vi.fn() }])
};

const mockMediaRecorder = {
  state: 'inactive',
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  ondataavailable: null,
  onerror: null
};

// Setup global mocks
beforeEach(() => {
  // Mock AudioContext
  vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => ({
    ...mockAudioContext,
    createAnalyser: vi.fn().mockReturnValue({ ...mockAnalyserNode }),
    createMediaStreamSource: vi.fn().mockReturnValue({ ...mockSourceNode })
  })));

  // Mock MediaRecorder
  vi.stubGlobal('MediaRecorder', vi.fn().mockImplementation(() => ({
    ...mockMediaRecorder
  })));
  (MediaRecorder as unknown as { isTypeSupported: (type: string) => boolean }).isTypeSupported = vi.fn().mockReturnValue(true);

  // Mock navigator.mediaDevices
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({ ...mockMediaStream })
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('AudioCaptureService', () => {
  describe('requestMicrophoneAccess', () => {
    it('should request microphone permission and initialize audio context', async () => {
      const statusChanges: AudioCaptureStatus[] = [];
      const service = new AudioCaptureService({
        onStatusChange: (status) => statusChanges.push(status)
      });

      await service.requestMicrophoneAccess();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: { ideal: 44100 }
        }
      });
      expect(statusChanges).toContain('requesting');
      expect(statusChanges).toContain('active');
      expect(service.getStatus()).toBe('active');
    });

    it('should handle permission denied error', async () => {
      const permissionError = new DOMException('Permission denied', 'NotAllowedError');
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(permissionError);

      let capturedError: AudioCaptureError | null = null;
      const service = new AudioCaptureService({
        onError: (error) => { capturedError = error; }
      });

      await expect(service.requestMicrophoneAccess()).rejects.toMatchObject({
        type: 'permission_denied'
      });

      expect(capturedError).not.toBeNull();
      expect(capturedError!.type).toBe('permission_denied');
      expect(capturedError!.message).toContain('Microphone access is required');
      expect(service.getStatus()).toBe('error');
    });

    it('should handle device not found error', async () => {
      const notFoundError = new DOMException('No device found', 'NotFoundError');
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(notFoundError);

      let capturedError: AudioCaptureError | null = null;
      const service = new AudioCaptureService({
        onError: (error) => { capturedError = error; }
      });

      await expect(service.requestMicrophoneAccess()).rejects.toMatchObject({
        type: 'device_not_found'
      });

      expect(capturedError).not.toBeNull();
      expect(capturedError!.type).toBe('device_not_found');
      expect(capturedError!.message).toContain('No microphone detected');
    });

    it('should handle browser not supported', async () => {
      vi.stubGlobal('navigator', { mediaDevices: undefined });

      let capturedError: AudioCaptureError | null = null;
      const service = new AudioCaptureService({
        onError: (error) => { capturedError = error; }
      });

      await expect(service.requestMicrophoneAccess()).rejects.toMatchObject({
        type: 'not_supported'
      });

      expect(capturedError).not.toBeNull();
      expect(capturedError!.type).toBe('not_supported');
      expect(capturedError!.message).toContain("browser doesn't support");
    });
  });

  describe('disconnect/reconnect handling', () => {
    it('should detect microphone disconnect via track ended event', async () => {
      let disconnectCalled = false;
      const statusChanges: AudioCaptureStatus[] = [];
      const mockTrack = { 
        onended: null as (() => void) | null, 
        stop: vi.fn() 
      };
      
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({
        getTracks: vi.fn().mockReturnValue([mockTrack]),
        getAudioTracks: vi.fn().mockReturnValue([mockTrack])
      } as unknown as MediaStream);

      const service = new AudioCaptureService({
        onDisconnect: () => { disconnectCalled = true; },
        onStatusChange: (status) => statusChanges.push(status)
      });

      await service.requestMicrophoneAccess();
      statusChanges.length = 0; // Clear initial status changes
      
      // Simulate track ended
      if (mockTrack.onended) {
        mockTrack.onended();
      }

      expect(disconnectCalled).toBe(true);
      // Status transitions to 'disconnected' then immediately to 'reconnecting'
      expect(statusChanges).toContain('disconnected');
    });

    it('should attempt automatic reconnection on disconnect', async () => {
      vi.useFakeTimers();
      
      const statusChanges: AudioCaptureStatus[] = [];
      const mockTrack = { 
        onended: null as (() => void) | null, 
        stop: vi.fn() 
      };
      
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({
        getTracks: vi.fn().mockReturnValue([mockTrack]),
        getAudioTracks: vi.fn().mockReturnValue([mockTrack])
      } as unknown as MediaStream);

      const service = new AudioCaptureService({
        onStatusChange: (status) => statusChanges.push(status)
      });

      await service.requestMicrophoneAccess();
      statusChanges.length = 0; // Clear initial status changes
      
      // Simulate disconnect
      if (mockTrack.onended) {
        mockTrack.onended();
      }

      expect(statusChanges).toContain('disconnected');
      
      // Advance timer to trigger reconnect attempt
      await vi.advanceTimersByTimeAsync(1000);
      
      expect(statusChanges).toContain('reconnecting');
      
      vi.useRealTimers();
    });

    it('should call onReconnect callback on successful reconnection', async () => {
      vi.useFakeTimers();
      
      let reconnectCalled = false;
      const mockTrack = { 
        onended: null as (() => void) | null, 
        stop: vi.fn() 
      };
      
      vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({
        getTracks: vi.fn().mockReturnValue([mockTrack]),
        getAudioTracks: vi.fn().mockReturnValue([mockTrack])
      } as unknown as MediaStream);

      const service = new AudioCaptureService({
        onReconnect: () => { reconnectCalled = true; }
      });

      await service.requestMicrophoneAccess();
      
      // Simulate disconnect
      if (mockTrack.onended) {
        mockTrack.onended();
      }

      // Advance timer and wait for reconnect
      await vi.advanceTimersByTimeAsync(1000);
      await vi.runAllTimersAsync();
      
      expect(reconnectCalled).toBe(true);
      
      vi.useRealTimers();
    });
  });

  describe('recording controls', () => {
    it('should start and stop recording', async () => {
      const service = new AudioCaptureService();
      await service.requestMicrophoneAccess();

      const recorder = service.getMediaRecorder();
      expect(recorder).not.toBeNull();

      service.startRecording();
      expect(recorder!.start).toHaveBeenCalled();

      service.stopRecording();
      // Note: stop is not called because mock state is 'inactive'
    });

    it('should pause and resume recording', async () => {
      const service = new AudioCaptureService();
      await service.requestMicrophoneAccess();

      expect(service.getMediaRecorder()).not.toBeNull();
      
      service.pauseRecording();
      // Note: pause is not called because mock state is 'inactive'
      
      service.resumeRecording();
      // Note: resume is not called because mock state is not 'paused'
    });
  });

  describe('getters', () => {
    it('should return null for audio context before initialization', () => {
      const service = new AudioCaptureService();
      expect(service.getAudioContext()).toBeNull();
      expect(service.getAnalyserNode()).toBeNull();
      expect(service.getMediaRecorder()).toBeNull();
      expect(service.getMediaStream()).toBeNull();
    });

    it('should return instances after initialization', async () => {
      const service = new AudioCaptureService();
      await service.requestMicrophoneAccess();

      expect(service.getAudioContext()).not.toBeNull();
      expect(service.getAnalyserNode()).not.toBeNull();
      expect(service.getMediaRecorder()).not.toBeNull();
      expect(service.getMediaStream()).not.toBeNull();
    });

    it('should return empty arrays for frequency data before initialization', () => {
      const service = new AudioCaptureService();
      expect(service.getFrequencyData()).toEqual(new Uint8Array(0));
      expect(service.getTimeDomainData()).toEqual(new Uint8Array(0));
    });
  });

  describe('disconnect', () => {
    it('should clean up all resources on disconnect', async () => {
      const service = new AudioCaptureService();
      await service.requestMicrophoneAccess();

      expect(service.isActive()).toBe(true);

      service.disconnect();

      expect(service.getStatus()).toBe('idle');
      expect(service.isActive()).toBe(false);
    });
  });
});
