/**
 * AudioStatusIndicator - Displays audio capture status including reconnection state
 * 
 * Requirements: 1.4, 1.5
 * - Display reconnection status in UI
 * - Show user-friendly messages for different states
 */

import React from 'react';
import { AudioCaptureStatus, AudioCaptureError } from '../services/AudioCaptureService';

export interface AudioStatusIndicatorProps {
  status: AudioCaptureStatus;
  error: AudioCaptureError | null;
  onRetry?: () => void;
  onDismissError?: () => void;
}

const STATUS_MESSAGES: Record<AudioCaptureStatus, string> = {
  idle: 'Ready to start',
  requesting: 'Requesting microphone access...',
  active: 'Microphone active',
  disconnected: 'Microphone disconnected',
  reconnecting: 'Reconnecting to microphone...',
  error: 'Error occurred'
};

const STATUS_COLORS: Record<AudioCaptureStatus, string> = {
  idle: '#6b7280',      // gray
  requesting: '#f59e0b', // amber
  active: '#10b981',     // green
  disconnected: '#ef4444', // red
  reconnecting: '#f59e0b', // amber
  error: '#ef4444'       // red
};

export const AudioStatusIndicator: React.FC<AudioStatusIndicatorProps> = ({
  status,
  error,
  onRetry,
  onDismissError
}) => {
  const statusMessage = STATUS_MESSAGES[status];
  const statusColor = STATUS_COLORS[status];

  return (
    <div 
      className="audio-status-indicator" 
      style={styles.container}
      role="region"
      aria-label="Audio capture status"
    >
      {/* Status dot and message */}
      <div style={styles.statusRow}>
        <span 
          style={{
            ...styles.statusDot,
            backgroundColor: statusColor,
            animation: status === 'reconnecting' ? 'pulse 1.5s infinite' : 'none'
          }}
          aria-hidden="true"
        />
        <span 
          style={styles.statusText} 
          role="status" 
          aria-live="polite"
          aria-label={`Microphone status: ${statusMessage}`}
        >
          {statusMessage}
        </span>
      </div>

      {/* Error message */}
      {error && (
        <div style={styles.errorContainer} role="alert" aria-live="assertive">
          <p style={styles.errorMessage}>{error.message}</p>
          <div style={styles.errorActions} role="group" aria-label="Error recovery actions">
            {onRetry && (
              <button 
                onClick={onRetry}
                style={styles.retryButton}
                aria-label="Retry microphone access"
              >
                Retry
              </button>
            )}
            {onDismissError && (
              <button 
                onClick={onDismissError}
                style={styles.dismissButton}
                aria-label="Dismiss error message"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {/* Reconnection guidance */}
      {status === 'disconnected' && !error && (
        <p style={styles.guidance} role="status" aria-live="polite">
          Your microphone was disconnected. Attempting to reconnect automatically...
        </p>
      )}

      {status === 'reconnecting' && (
        <p style={styles.guidance} role="status" aria-live="polite">
          Reconnecting to microphone. Please wait...
        </p>
      )}

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px 16px',
    borderRadius: '8px',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0
  },
  statusText: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151'
  },
  errorContainer: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: '#fef2f2',
    borderRadius: '6px',
    border: '1px solid #fecaca'
  },
  errorMessage: {
    margin: 0,
    fontSize: '14px',
    color: '#991b1b',
    lineHeight: 1.5
  },
  errorActions: {
    marginTop: '8px',
    display: 'flex',
    gap: '8px'
  },
  retryButton: {
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  dismissButton: {
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  guidance: {
    marginTop: '8px',
    marginBottom: 0,
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: 1.5
  }
};

export default AudioStatusIndicator;
