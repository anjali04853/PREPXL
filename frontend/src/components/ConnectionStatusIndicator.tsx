/**
 * ConnectionStatusIndicator - Displays real-time connection status and health metrics
 * 
 * Requirements: 9.1
 * - Display WebSocket connection status
 * - Show Gemini API health status
 * - Display latency metrics
 */

import React from 'react';
import type { ConnectionStatus, ConnectionHealthStatus } from '../types';

export interface ConnectionStatusIndicatorProps {
  /** Current WebSocket connection status */
  connectionStatus: ConnectionStatus;
  /** Health status including Gemini API and latency */
  healthStatus?: ConnectionHealthStatus;
  /** Number of reconnection attempts */
  reconnectAttempts?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
}

const CONNECTION_STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; icon: string }> = {
  connecting: { label: 'Connecting...', color: '#f59e0b', icon: '⟳' },
  connected: { label: 'Connected', color: '#10b981', icon: '●' },
  disconnected: { label: 'Disconnected', color: '#6b7280', icon: '○' },
  reconnecting: { label: 'Reconnecting...', color: '#f59e0b', icon: '⟳' },
  error: { label: 'Connection Error', color: '#ef4444', icon: '✕' }
};

const GEMINI_STATUS_CONFIG: Record<ConnectionHealthStatus['geminiApi'], { label: string; color: string }> = {
  healthy: { label: 'Healthy', color: '#10b981' },
  degraded: { label: 'Degraded', color: '#f59e0b' },
  unavailable: { label: 'Unavailable', color: '#ef4444' }
};

/**
 * Format latency for display
 */
function formatLatency(latencyMs: number): string {
  if (latencyMs < 0) return '--';
  if (latencyMs < 1000) return `${Math.round(latencyMs)}ms`;
  return `${(latencyMs / 1000).toFixed(1)}s`;
}

/**
 * Get latency color based on value
 */
function getLatencyColor(latencyMs: number): string {
  if (latencyMs < 0) return '#6b7280';
  if (latencyMs < 200) return '#10b981'; // green - excellent
  if (latencyMs < 500) return '#f59e0b'; // amber - acceptable
  return '#ef4444'; // red - poor
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  connectionStatus,
  healthStatus,
  reconnectAttempts = 0,
  maxReconnectAttempts = 5
}) => {
  const wsConfig = CONNECTION_STATUS_CONFIG[connectionStatus];
  const geminiConfig = healthStatus 
    ? GEMINI_STATUS_CONFIG[healthStatus.geminiApi] 
    : null;
  const latencyColor = healthStatus 
    ? getLatencyColor(healthStatus.latencyMs) 
    : '#6b7280';

  return (
    <div 
      style={styles.container} 
      role="status" 
      aria-label="Connection status"
      aria-live="polite"
    >
      {/* WebSocket Status */}
      <div style={styles.statusSection} aria-labelledby="ws-status-label">
        <div style={styles.statusHeader}>
          <span id="ws-status-label" style={styles.statusLabel}>WebSocket</span>
        </div>
        <div style={styles.statusRow}>
          <span 
            style={{
              ...styles.statusIcon,
              color: wsConfig.color,
              animation: connectionStatus === 'connecting' || connectionStatus === 'reconnecting' 
                ? 'spin 1s linear infinite' 
                : 'none'
            }}
            aria-hidden="true"
          >
            {wsConfig.icon}
          </span>
          <span 
            style={{ ...styles.statusValue, color: wsConfig.color }}
            aria-label={`WebSocket status: ${wsConfig.label}`}
          >
            {wsConfig.label}
          </span>
        </div>
        {connectionStatus === 'reconnecting' && (
          <span style={styles.reconnectInfo} aria-live="polite">
            Attempt {reconnectAttempts}/{maxReconnectAttempts}
          </span>
        )}
      </div>

      {/* Gemini API Status */}
      <div style={styles.statusSection} aria-labelledby="gemini-status-label">
        <div style={styles.statusHeader}>
          <span id="gemini-status-label" style={styles.statusLabel}>Gemini API</span>
        </div>
        <div style={styles.statusRow}>
          <span 
            style={{
              ...styles.statusDot,
              backgroundColor: geminiConfig?.color || '#6b7280'
            }}
            aria-hidden="true"
          />
          <span 
            style={{ ...styles.statusValue, color: geminiConfig?.color || '#6b7280' }}
            aria-label={`Gemini API status: ${geminiConfig?.label || 'Unknown'}`}
          >
            {geminiConfig?.label || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Latency */}
      <div style={styles.statusSection} aria-labelledby="latency-label">
        <div style={styles.statusHeader}>
          <span id="latency-label" style={styles.statusLabel}>Latency</span>
        </div>
        <div style={styles.statusRow}>
          <span 
            style={{ ...styles.latencyValue, color: latencyColor }}
            aria-label={`Current latency: ${healthStatus ? formatLatency(healthStatus.latencyMs) : 'Unknown'}`}
          >
            {healthStatus ? formatLatency(healthStatus.latencyMs) : '--'}
          </span>
        </div>
      </div>

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '8px 16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px'
  },
  statusSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  statusHeader: {
    display: 'flex',
    alignItems: 'center'
  },
  statusLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  statusIcon: {
    fontSize: '14px',
    display: 'inline-block'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  statusValue: {
    fontWeight: 500
  },
  latencyValue: {
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums'
  },
  reconnectInfo: {
    fontSize: '11px',
    color: '#9ca3af'
  }
};

export default ConnectionStatusIndicator;
