/**
 * useAudioCapture - React hook for audio capture functionality
 * 
 * Provides a convenient interface to AudioCaptureService with React state management
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  AudioCaptureService, 
  AudioCaptureStatus, 
  AudioCaptureError 
} from '../services/AudioCaptureService';

export interface UseAudioCaptureResult {
  status: AudioCaptureStatus;
  error: AudioCaptureError | null;
  isActive: boolean;
  isRecording: boolean;
  analyserNode: AnalyserNode | null;
  audioContext: AudioContext | null;
  requestMicrophoneAccess: () => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  disconnect: () => void;
  getFrequencyData: () => Uint8Array;
  getTimeDomainData: () => Uint8Array;
  clearError: () => void;
}

export interface UseAudioCaptureOptions {
  onChunkAvailable?: (chunk: Blob) => void;
  autoReconnect?: boolean;
}

export function useAudioCapture(options: UseAudioCaptureOptions = {}): UseAudioCaptureResult {
  const [status, setStatus] = useState<AudioCaptureStatus>('idle');
  const [error, setError] = useState<AudioCaptureError | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  
  const serviceRef = useRef<AudioCaptureService | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Initialize service on mount
  useEffect(() => {
    serviceRef.current = new AudioCaptureService({
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        if (newStatus === 'active') {
          setAnalyserNode(serviceRef.current?.getAnalyserNode() ?? null);
          setAudioContext(serviceRef.current?.getAudioContext() ?? null);
        }
      },
      onError: (err) => {
        setError(err);
        setIsRecording(false);
      },
      onChunkAvailable: (chunk) => {
        optionsRef.current.onChunkAvailable?.(chunk);
      },
      onDisconnect: () => {
        setIsRecording(false);
      },
      onReconnect: () => {
        // Reconnected successfully
      }
    });

    return () => {
      serviceRef.current?.disconnect();
      serviceRef.current = null;
    };
  }, []);

  const requestMicrophoneAccess = useCallback(async () => {
    if (!serviceRef.current) return;
    
    setError(null);
    try {
      await serviceRef.current.requestMicrophoneAccess();
    } catch {
      // Error is handled by callback
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!serviceRef.current) return;
    serviceRef.current.startRecording();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    if (!serviceRef.current) return;
    serviceRef.current.stopRecording();
    setIsRecording(false);
  }, []);

  const pauseRecording = useCallback(() => {
    if (!serviceRef.current) return;
    serviceRef.current.pauseRecording();
    setIsRecording(false);
  }, []);

  const resumeRecording = useCallback(() => {
    if (!serviceRef.current) return;
    serviceRef.current.resumeRecording();
    setIsRecording(true);
  }, []);

  const disconnect = useCallback(() => {
    if (!serviceRef.current) return;
    serviceRef.current.disconnect();
    setIsRecording(false);
    setAnalyserNode(null);
    setAudioContext(null);
  }, []);

  const getFrequencyData = useCallback(() => {
    return serviceRef.current?.getFrequencyData() ?? new Uint8Array(0);
  }, []);

  const getTimeDomainData = useCallback(() => {
    return serviceRef.current?.getTimeDomainData() ?? new Uint8Array(0);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    status,
    error,
    isActive: status === 'active',
    isRecording,
    analyserNode,
    audioContext,
    requestMicrophoneAccess,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    disconnect,
    getFrequencyData,
    getTimeDomainData,
    clearError
  };
}
