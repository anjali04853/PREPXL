/**
 * ErrorDisplay - Displays user-friendly error messages with recovery guidance
 * 
 * Requirements: 9.4, 9.5
 * - Display user-friendly error messages for all error states
 * - Provide actionable guidance for resolution
 */

import React from 'react';
import { ErrorType, getErrorMessage, ErrorMessageConfig } from '../utils/errorMessages';

export interface ErrorDisplayProps {
  /** The error type to display */
  errorType: ErrorType;
  /** Optional custom message override */
  customMessage?: string;
  /** Callback when action button is clicked */
  onAction?: () => void;
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void;
  /** Whether to show the dismiss button */
  showDismiss?: boolean;
  /** Additional CSS class name */
  className?: string;
}

const SEVERITY_STYLES: Record<ErrorMessageConfig['severity'], { bg: string; border: string; icon: string; iconColor: string }> = {
  info: { bg: '#eff6ff', border: '#bfdbfe', icon: 'ℹ', iconColor: '#2563eb' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '⚠', iconColor: '#d97706' },
  error: { bg: '#fef2f2', border: '#fecaca', icon: '✕', iconColor: '#dc2626' },
  critical: { bg: '#fef2f2', border: '#f87171', icon: '⛔', iconColor: '#b91c1c' }
};

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  errorType,
  customMessage,
  onAction,
  onDismiss,
  showDismiss = true,
  className = ''
}) => {
  const config = getErrorMessage(errorType);
  const severityStyle = SEVERITY_STYLES[config.severity];

  const handleAction = () => {
    if (config.actionType === 'refresh') {
      window.location.reload();
    } else if (config.actionType === 'settings') {
      // Open browser settings guidance
      window.open('https://support.google.com/chrome/answer/2693767', '_blank');
    } else if (config.actionType === 'upgrade') {
      window.open('https://browsehappy.com/', '_blank');
    } else {
      onAction?.();
    }
  };

  return (
    <div 
      className={`error-display ${className}`}
      style={{
        ...styles.container,
        backgroundColor: severityStyle.bg,
        borderColor: severityStyle.border
      }}
      role="alert"
      aria-live="assertive"
    >
      {/* Header with icon and title */}
      <div style={styles.header}>
        <span 
          style={{ ...styles.icon, color: severityStyle.iconColor }}
          aria-hidden="true"
        >
          {severityStyle.icon}
        </span>
        <span style={styles.title}>
          {customMessage || config.message}
        </span>
        {showDismiss && onDismiss && (
          <button
            onClick={onDismiss}
            style={styles.dismissButton}
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>

      {/* Description */}
      <p style={styles.description}>
        {config.description}
      </p>

      {/* Recovery guidance */}
      <p style={styles.guidance}>
        {config.recoveryGuidance}
      </p>

      {/* Action button */}
      {config.actionType !== 'none' && config.actionType !== 'wait' && config.actionLabel && (
        <div style={styles.actions}>
          <button
            onClick={handleAction}
            style={styles.actionButton}
            aria-label={config.actionLabel}
          >
            {config.actionLabel}
          </button>
        </div>
      )}

      {/* Waiting indicator */}
      {config.actionType === 'wait' && (
        <div style={styles.waitingIndicator}>
          <span style={styles.spinner} aria-hidden="true">⟳</span>
          <span style={styles.waitingText}>Please wait...</span>
        </div>
      )}

      {/* CSS for spinner animation */}
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
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: '400px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  icon: {
    fontSize: '18px',
    flexShrink: 0
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1f2937',
    flex: 1
  },
  dismissButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    color: '#6b7280',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1
  },
  description: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    color: '#4b5563',
    lineHeight: 1.5
  },
  guidance: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    color: '#6b7280',
    lineHeight: 1.5
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  actionButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#ffffff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  waitingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  spinner: {
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
    fontSize: '16px',
    color: '#6b7280'
  },
  waitingText: {
    fontSize: '13px',
    color: '#6b7280'
  }
};

export default ErrorDisplay;
