/**
 * TranscriptionDisplay - Real-time transcription text display with smooth updates
 * 
 * Requirements: 7.4, 7.5
 * - Display transcription text with interim/final distinction
 * - Implement incremental text updates (append, not rewrite)
 * - Add smooth text transitions
 * - Auto-scroll to latest text
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type { TranscriptionUpdate, SessionState } from '../types';
import './TranscriptionDisplay.css';

export interface TranscriptionDisplayProps {
  /** History of final transcription updates */
  transcriptionHistory: TranscriptionUpdate[];
  /** Current interim (partial) transcription text */
  currentInterim: string;
  /** Whether recording is currently active */
  isRecording: boolean;
  /** Current session state */
  sessionState: SessionState;
  /** Callback when pause/resume is clicked */
  onPauseResume?: () => void;
  /** Callback when copy is clicked */
  onCopy?: () => void;
  /** Callback when download is clicked */
  onDownload?: () => void;
}

/**
 * TranscriptionDisplay component renders real-time transcription with controls
 */
export function TranscriptionDisplay({
  transcriptionHistory,
  currentInterim,
  isRecording,
  sessionState,
  onPauseResume,
  onCopy,
  onDownload,
}: TranscriptionDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  /**
   * Get the full transcription text from history
   */
  const getFullText = useCallback((): string => {
    return transcriptionHistory
      .filter(update => update.type === 'final')
      .map(update => update.text)
      .join(' ');
  }, [transcriptionHistory]);

  /**
   * Auto-scroll to bottom when new content arrives
   * Requirements: 7.4 - Auto-scroll to latest text
   */
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      const container = containerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [transcriptionHistory, currentInterim, autoScroll]);

  /**
   * Handle scroll to detect if user has scrolled up
   */
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  }, []);

  /**
   * Copy transcription to clipboard
   * Requirements: 8.4 - Copy to clipboard button
   */
  const handleCopy = useCallback(async () => {
    const text = getFullText();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      onCopy?.();
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, [getFullText, onCopy]);

  /**
   * Download transcription as text file
   * Requirements: 8.5 - Download as text file button
   */
  const handleDownload = useCallback(() => {
    const text = getFullText();
    if (!text) return;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcription-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onDownload?.();
  }, [getFullText, onDownload]);

  /**
   * Handle pause/resume
   * Requirements: 8.1, 8.2, 8.3 - Pause/resume control
   */
  const handlePauseResume = useCallback(() => {
    onPauseResume?.();
  }, [onPauseResume]);

  const hasContent = transcriptionHistory.length > 0 || currentInterim;
  const isPaused = sessionState === 'paused';

  return (
    <div className="transcription-display">
      {/* Session Controls */}
      <div 
        className="transcription-controls"
        role="toolbar"
        aria-label="Transcription controls"
      >
        {isRecording && (
          <button
            className={`control-button ${isPaused ? 'resume' : 'pause'}`}
            onClick={handlePauseResume}
            aria-label={isPaused ? 'Resume recording' : 'Pause recording'}
            aria-pressed={isPaused}
          >
            {isPaused ? (
              <>
                <span className="icon" aria-hidden="true">▶</span>
                <span>Resume</span>
              </>
            ) : (
              <>
                <span className="icon" aria-hidden="true">⏸</span>
                <span>Pause</span>
              </>
            )}
          </button>
        )}
        
        <button
          className="control-button copy"
          onClick={handleCopy}
          disabled={!hasContent}
          aria-label={copySuccess ? 'Copied to clipboard' : 'Copy transcription to clipboard'}
          aria-disabled={!hasContent}
        >
          <span className="icon" aria-hidden="true">{copySuccess ? '✓' : '📋'}</span>
          <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
        </button>
        
        <button
          className="control-button download"
          onClick={handleDownload}
          disabled={!hasContent}
          aria-label="Download transcription as text file"
          aria-disabled={!hasContent}
        >
          <span className="icon" aria-hidden="true">⬇</span>
          <span>Download</span>
        </button>
      </div>

      {/* Transcription Text Container */}
      <div
        ref={containerRef}
        className="transcription-container"
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Transcription output"
      >
        {!hasContent && (
          <p className="placeholder-text">
            {isRecording 
              ? 'Listening... Start speaking to see transcription.'
              : 'Click "Start Recording" to begin transcription.'}
          </p>
        )}

        {/* Final transcription segments */}
        {transcriptionHistory
          .filter(update => update.type === 'final')
          .map((update, index) => (
            <span
              key={`final-${update.sequenceId}-${index}`}
              className="transcription-segment final"
              data-confidence={update.confidence.toFixed(2)}
            >
              {update.text}{' '}
            </span>
          ))}

        {/* Current interim transcription */}
        {currentInterim && (
          <span className="transcription-segment interim">
            {currentInterim}
          </span>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && hasContent && (
        <button
          className="scroll-to-bottom"
          onClick={() => {
            setAutoScroll(true);
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }}
          aria-label="Scroll to latest transcription"
        >
          ↓ New text
        </button>
      )}
    </div>
  );
}

export default TranscriptionDisplay;
