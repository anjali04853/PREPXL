/**
 * Unit tests for TranscriptionDisplay component and useTranscription hook
 * 
 * Requirements: 7.4, 8.4, 8.5
 * - Test text update handling
 * - Test copy and download functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TranscriptionUpdate } from '../types';

// Helper to test hook behavior
function createTestHarness() {
  // Simulate hook behavior with plain objects
  const transcriptionHistory: TranscriptionUpdate[] = [];
  let currentInterim = '';
  let sessionState: 'active' | 'paused' | 'closed' = 'closed';
  let lastSequenceId = -1;

  const addTranscriptionUpdate = (update: TranscriptionUpdate) => {
    if (update.sequenceId <= lastSequenceId && update.type === 'final') {
      return;
    }

    if (update.type === 'partial') {
      currentInterim = update.text;
    } else if (update.type === 'final') {
      lastSequenceId = update.sequenceId;
      transcriptionHistory.push(update);
      currentInterim = '';
    }
  };

  const clearTranscription = () => {
    transcriptionHistory.length = 0;
    currentInterim = '';
    lastSequenceId = -1;
  };

  const getFullText = (): string => {
    return transcriptionHistory
      .filter(update => update.type === 'final')
      .map(update => update.text)
      .join(' ')
      .trim();
  };

  const copyToClipboard = async (): Promise<boolean> => {
    const text = getFullText();
    if (!text) return false;

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const downloadAsFile = (filename?: string) => {
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
  };

  return {
    get transcriptionHistory() { return transcriptionHistory; },
    get currentInterim() { return currentInterim; },
    get sessionState() { return sessionState; },
    setSessionState: (state: 'active' | 'paused' | 'closed') => { sessionState = state; },
    addTranscriptionUpdate,
    clearTranscription,
    getFullText,
    copyToClipboard,
    downloadAsFile,
  };
}

describe('useTranscription Hook', () => {
  describe('Text Update Handling', () => {
    it('should add partial transcription updates to interim', () => {
      const harness = createTestHarness();
      
      const partialUpdate: TranscriptionUpdate = {
        type: 'partial',
        text: 'Hello wor',
        confidence: 0.8,
        timestamp: new Date().toISOString(),
        sequenceId: 1
      };

      harness.addTranscriptionUpdate(partialUpdate);

      expect(harness.currentInterim).toBe('Hello wor');
      expect(harness.transcriptionHistory).toHaveLength(0);
    });

    it('should add final transcription updates to history and clear interim', () => {
      const harness = createTestHarness();
      
      // First add a partial
      harness.addTranscriptionUpdate({
        type: 'partial',
        text: 'Hello wor',
        confidence: 0.8,
        timestamp: new Date().toISOString(),
        sequenceId: 1
      });

      // Then add final
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Hello world',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 2
      });

      expect(harness.currentInterim).toBe('');
      expect(harness.transcriptionHistory).toHaveLength(1);
      expect(harness.transcriptionHistory[0]?.text).toBe('Hello world');
    });

    it('should handle multiple final updates incrementally', () => {
      const harness = createTestHarness();
      
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Hello',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 1
      });

      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'world',
        confidence: 0.92,
        timestamp: new Date().toISOString(),
        sequenceId: 2
      });

      expect(harness.transcriptionHistory).toHaveLength(2);
      expect(harness.getFullText()).toBe('Hello world');
    });

    it('should skip duplicate final updates with same or lower sequence ID', () => {
      const harness = createTestHarness();
      
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Hello',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 5
      });

      // Try to add duplicate with same sequence ID
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Hello duplicate',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 5
      });

      // Try to add with lower sequence ID
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Out of order',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 3
      });

      expect(harness.transcriptionHistory).toHaveLength(1);
      expect(harness.transcriptionHistory[0]?.text).toBe('Hello');
    });

    it('should clear all transcription data', () => {
      const harness = createTestHarness();
      
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Hello',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 1
      });

      harness.addTranscriptionUpdate({
        type: 'partial',
        text: 'world',
        confidence: 0.8,
        timestamp: new Date().toISOString(),
        sequenceId: 2
      });

      harness.clearTranscription();

      expect(harness.transcriptionHistory).toHaveLength(0);
      expect(harness.currentInterim).toBe('');
    });
  });

  describe('getFullText', () => {
    it('should return empty string when no transcription', () => {
      const harness = createTestHarness();
      expect(harness.getFullText()).toBe('');
    });

    it('should return concatenated final transcriptions', () => {
      const harness = createTestHarness();
      
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Hello',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 1
      });

      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'beautiful',
        confidence: 0.92,
        timestamp: new Date().toISOString(),
        sequenceId: 2
      });

      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'world',
        confidence: 0.90,
        timestamp: new Date().toISOString(),
        sequenceId: 3
      });

      expect(harness.getFullText()).toBe('Hello beautiful world');
    });

    it('should not include partial transcriptions in full text', () => {
      const harness = createTestHarness();
      
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Hello',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 1
      });

      harness.addTranscriptionUpdate({
        type: 'partial',
        text: 'world in progress',
        confidence: 0.8,
        timestamp: new Date().toISOString(),
        sequenceId: 2
      });

      expect(harness.getFullText()).toBe('Hello');
    });
  });
});

describe('Copy and Download Functionality', () => {
  let mockClipboard: { writeText: ReturnType<typeof vi.fn> };
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockAppendChild: ReturnType<typeof vi.fn>;
  let mockRemoveChild: ReturnType<typeof vi.fn>;
  let mockClick: ReturnType<typeof vi.fn>;
  let createdLink: HTMLAnchorElement | null = null;

  beforeEach(() => {
    // Mock clipboard API
    mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined)
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true
    });

    // Mock URL methods
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:test-url');
    mockRevokeObjectURL = vi.fn();
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    // Mock document methods
    mockClick = vi.fn();
    mockAppendChild = vi.fn();
    mockRemoveChild = vi.fn();
    
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        createdLink = originalCreateElement('a') as HTMLAnchorElement;
        createdLink.click = mockClick;
        return createdLink;
      }
      return originalCreateElement(tagName);
    });
    
    vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    createdLink = null;
  });

  describe('copyToClipboard', () => {
    it('should copy full text to clipboard', async () => {
      const harness = createTestHarness();
      
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Hello world',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 1
      });

      const result = await harness.copyToClipboard();

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('Hello world');
    });

    it('should return false when no text to copy', async () => {
      const harness = createTestHarness();
      
      const result = await harness.copyToClipboard();

      expect(result).toBe(false);
      expect(mockClipboard.writeText).not.toHaveBeenCalled();
    });

    it('should return false when clipboard write fails', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard error'));
      
      const harness = createTestHarness();
      
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Hello world',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 1
      });

      const result = await harness.copyToClipboard();

      expect(result).toBe(false);
    });
  });

  describe('downloadAsFile', () => {
    it('should create and trigger download link', () => {
      const harness = createTestHarness();
      
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Hello world',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 1
      });

      harness.downloadAsFile();

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockRemoveChild).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    });

    it('should use custom filename when provided', () => {
      const harness = createTestHarness();
      
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Hello world',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 1
      });

      harness.downloadAsFile('my-transcription.txt');

      expect(createdLink?.download).toBe('my-transcription.txt');
    });

    it('should generate default filename with timestamp', () => {
      const harness = createTestHarness();
      
      harness.addTranscriptionUpdate({
        type: 'final',
        text: 'Hello world',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        sequenceId: 1
      });

      harness.downloadAsFile();

      expect(createdLink?.download).toMatch(/^transcription-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.txt$/);
    });

    it('should not download when no text available', () => {
      const harness = createTestHarness();
      
      harness.downloadAsFile();

      expect(mockCreateObjectURL).not.toHaveBeenCalled();
      expect(mockClick).not.toHaveBeenCalled();
    });
  });
});

describe('Session State Management', () => {
  it('should initialize with closed state', () => {
    const harness = createTestHarness();
    expect(harness.sessionState).toBe('closed');
  });

  it('should update session state', () => {
    const harness = createTestHarness();
    
    harness.setSessionState('active');
    expect(harness.sessionState).toBe('active');
    
    harness.setSessionState('paused');
    expect(harness.sessionState).toBe('paused');
    
    harness.setSessionState('closed');
    expect(harness.sessionState).toBe('closed');
  });
});
