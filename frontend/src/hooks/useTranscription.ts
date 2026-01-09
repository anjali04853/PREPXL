/**
 * useTranscription - React hook for transcription state management
 * 
 * Requirements: 7.4, 8.1, 8.2, 8.3, 8.4, 8.5
 * - Manage transcription history and interim text
 * - Handle session state (active, paused, closed)
 * - Provide copy and download functionality
 */

import { useState, useCallback, useRef } from 'react';
import type { TranscriptionUpdate, SessionState } from '../types';

export interface UseTranscriptionResult {
  /** History of final transcription updates */
  transcriptionHistory: TranscriptionUpdate[];
  /** Current interim (partial) transcription text */
  currentInterim: string;
  /** Current session state */
  sessionState: SessionState;
  /** Add a new transcription update */
  addTranscriptionUpdate: (update: TranscriptionUpdate) => void;
  /** Clear all transcription data */
  clearTranscription: () => void;
  /** Set session state */
  setSessionState: (state: SessionState) => void;
  /** Get full transcription text */
  getFullText: () => string;
  /** Copy transcription to clipboard */
  copyToClipboard: () => Promise<boolean>;
  /** Download transcription as text file */
  downloadAsFile: (filename?: string) => void;
}

export function useTranscription(): UseTranscriptionResult {
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionUpdate[]>([]);
  const [currentInterim, setCurrentInterim] = useState('');
  const [sessionState, setSessionState] = useState<SessionState>('closed');
  
  // Track sequence IDs to handle out-of-order updates
  const lastSequenceIdRef = useRef<number>(-1);

  /**
   * Add a new transcription update
   * Requirements: 7.4 - Update text incrementally without rewriting entire content
   */
  const addTranscriptionUpdate = useCallback((update: TranscriptionUpdate) => {
    // Handle out-of-order updates by checking sequence ID
    if (update.sequenceId <= lastSequenceIdRef.current && update.type === 'final') {
      // Skip duplicate or out-of-order final updates
      return;
    }

    if (update.type === 'partial') {
      // Update interim text
      setCurrentInterim(update.text);
    } else if (update.type === 'final') {
      // Add to history and clear interim
      lastSequenceIdRef.current = update.sequenceId;
      setTranscriptionHistory(prev => [...prev, update]);
      setCurrentInterim('');
    }
  }, []);

  /**
   * Clear all transcription data
   */
  const clearTranscription = useCallback(() => {
    setTranscriptionHistory([]);
    setCurrentInterim('');
    lastSequenceIdRef.current = -1;
  }, []);

  /**
   * Get full transcription text from history
   */
  const getFullText = useCallback((): string => {
    return transcriptionHistory
      .filter(update => update.type === 'final')
      .map(update => update.text)
      .join(' ')
      .trim();
  }, [transcriptionHistory]);

  /**
   * Copy transcription to clipboard
   * Requirements: 8.4 - Copy to clipboard button
   */
  const copyToClipboard = useCallback(async (): Promise<boolean> => {
    const text = getFullText();
    if (!text) return false;

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy text:', err);
      return false;
    }
  }, [getFullText]);

  /**
   * Download transcription as text file
   * Requirements: 8.5 - Download as text file button
   */
  const downloadAsFile = useCallback((filename?: string) => {
    const text = getFullText();
    if (!text) return;

    const defaultFilename = `transcription-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [getFullText]);

  return {
    transcriptionHistory,
    currentInterim,
    sessionState,
    addTranscriptionUpdate,
    clearTranscription,
    setSessionState,
    getFullText,
    copyToClipboard,
    downloadAsFile,
  };
}

export default useTranscription;
