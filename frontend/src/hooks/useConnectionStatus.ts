/**
 * useConnectionStatus - React hook for connection status and health monitoring
 * 
 * Requirements: 9.1
 * - Track WebSocket connection status
 * - Monitor Gemini API health
 * - Track latency metrics
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ConnectionStatus, ConnectionHealthStatus } from '../types';

export interface UseConnectionStatusResult {
  /** Current WebSocket connection status */
  connectionStatus: ConnectionStatus;
  /** Health status including Gemini API and latency */
  healthStatus: ConnectionHealthStatus;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Update WebSocket connection status */
  setConnectionStatus: (status: ConnectionStatus) => void;
  /** Update Gemini API health status */
  setGeminiApiStatus: (status: ConnectionHealthStatus['geminiApi']) => void;
  /** Record a latency measurement */
  recordLatency: (latencyMs: number) => void;
  /** Update health status from server heartbeat */
  updateFromHeartbeat: (heartbeat: Partial<ConnectionHealthStatus>) => void;
  /** Increment reconnection attempts */
  incrementReconnectAttempts: () => void;
  /** Reset reconnection attempts */
  resetReconnectAttempts: () => void;
}

const DEFAULT_HEALTH_STATUS: ConnectionHealthStatus = {
  websocket: 'disconnected',
  geminiApi: 'unavailable',
  latencyMs: -1,
  lastHeartbeat: ''
};

export function useConnectionStatus(): UseConnectionStatusResult {
  const [connectionStatus, setConnectionStatusState] = useState<ConnectionStatus>('disconnected');
  const [healthStatus, setHealthStatus] = useState<ConnectionHealthStatus>(DEFAULT_HEALTH_STATUS);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  // Track latency measurements for averaging
  const latencyHistoryRef = useRef<number[]>([]);
  const maxLatencyHistory = 10;

  /**
   * Update WebSocket connection status
   */
  const setConnectionStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatusState(status);
    
    // Map connection status to health status websocket field
    let wsHealth: ConnectionHealthStatus['websocket'];
    switch (status) {
      case 'connected':
        wsHealth = 'connected';
        break;
      case 'reconnecting':
        wsHealth = 'reconnecting';
        break;
      default:
        wsHealth = 'disconnected';
    }
    
    setHealthStatus(prev => ({
      ...prev,
      websocket: wsHealth
    }));
  }, []);

  /**
   * Update Gemini API health status
   */
  const setGeminiApiStatus = useCallback((status: ConnectionHealthStatus['geminiApi']) => {
    setHealthStatus(prev => ({
      ...prev,
      geminiApi: status
    }));
  }, []);

  /**
   * Record a latency measurement and update average
   */
  const recordLatency = useCallback((latencyMs: number) => {
    latencyHistoryRef.current.push(latencyMs);
    
    // Keep only recent measurements
    if (latencyHistoryRef.current.length > maxLatencyHistory) {
      latencyHistoryRef.current.shift();
    }
    
    // Calculate average latency
    const avgLatency = latencyHistoryRef.current.reduce((a, b) => a + b, 0) 
      / latencyHistoryRef.current.length;
    
    setHealthStatus(prev => ({
      ...prev,
      latencyMs: Math.round(avgLatency),
      lastHeartbeat: new Date().toISOString()
    }));
  }, []);

  /**
   * Update health status from server heartbeat response
   */
  const updateFromHeartbeat = useCallback((heartbeat: Partial<ConnectionHealthStatus>) => {
    setHealthStatus(prev => ({
      ...prev,
      ...heartbeat,
      lastHeartbeat: new Date().toISOString()
    }));
  }, []);

  /**
   * Increment reconnection attempts counter
   */
  const incrementReconnectAttempts = useCallback(() => {
    setReconnectAttempts(prev => prev + 1);
  }, []);

  /**
   * Reset reconnection attempts counter
   */
  const resetReconnectAttempts = useCallback(() => {
    setReconnectAttempts(0);
    latencyHistoryRef.current = [];
  }, []);

  // Reset latency history when disconnected
  useEffect(() => {
    if (connectionStatus === 'disconnected') {
      latencyHistoryRef.current = [];
      setHealthStatus(prev => ({
        ...prev,
        latencyMs: -1
      }));
    }
  }, [connectionStatus]);

  return {
    connectionStatus,
    healthStatus,
    reconnectAttempts,
    setConnectionStatus,
    setGeminiApiStatus,
    recordLatency,
    updateFromHeartbeat,
    incrementReconnectAttempts,
    resetReconnectAttempts
  };
}

export default useConnectionStatus;
