/**
 * Property-based tests and unit tests for AudioStreamingService
 * 
 * Feature: realtime-audio-transcription
 * Uses fast-check for property-based testing
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  isValidChunkDuration,
  calculateExpectedChunkDuration,
  MIN_CHUNK_INTERVAL_MS,
  MAX_CHUNK_INTERVAL_MS,
} from './AudioStreamingService';

describe('AudioStreamingService Property Tests', () => {
  /**
   * Property 5: Audio Chunk Duration
   * 
   * For any audio chunk produced by the MediaRecorder, 
   * the chunk duration SHALL be between 100ms and 500ms.
   * 
   * **Validates: Requirements 4.2**
   */
  describe('Property 5: Audio Chunk Duration', () => {
    it('should validate chunk durations within 100-500ms range', () => {
      fc.assert(
        fc.property(
          // Generate durations within valid range
          fc.integer({ min: MIN_CHUNK_INTERVAL_MS, max: MAX_CHUNK_INTERVAL_MS }),
          (duration) => {
            expect(isValidChunkDuration(duration)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject chunk durations below 100ms', () => {
      fc.assert(
        fc.property(
          // Generate durations below minimum
          fc.integer({ min: 0, max: MIN_CHUNK_INTERVAL_MS - 1 }),
          (duration) => {
            expect(isValidChunkDuration(duration)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject chunk durations above 500ms', () => {
      fc.assert(
        fc.property(
          // Generate durations above maximum
          fc.integer({ min: MAX_CHUNK_INTERVAL_MS + 1, max: 10000 }),
          (duration) => {
            expect(isValidChunkDuration(duration)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should clamp calculated chunk duration to valid range', () => {
      fc.assert(
        fc.property(
          // Generate any timeslice value
          fc.integer({ min: 0, max: 10000 }),
          (timeslice) => {
            const expectedDuration = calculateExpectedChunkDuration(timeslice);
            
            // Result should always be within valid range
            expect(expectedDuration).toBeGreaterThanOrEqual(MIN_CHUNK_INTERVAL_MS);
            expect(expectedDuration).toBeLessThanOrEqual(MAX_CHUNK_INTERVAL_MS);
            
            // Result should be valid
            expect(isValidChunkDuration(expectedDuration)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve valid timeslice values', () => {
      fc.assert(
        fc.property(
          // Generate timeslice within valid range
          fc.integer({ min: MIN_CHUNK_INTERVAL_MS, max: MAX_CHUNK_INTERVAL_MS }),
          (timeslice) => {
            const expectedDuration = calculateExpectedChunkDuration(timeslice);
            
            // Valid timeslice should be preserved
            expect(expectedDuration).toBe(timeslice);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce minimum boundary at 100ms', () => {
      // Test boundary condition
      expect(isValidChunkDuration(100)).toBe(true);
      expect(isValidChunkDuration(99)).toBe(false);
      expect(calculateExpectedChunkDuration(50)).toBe(MIN_CHUNK_INTERVAL_MS);
    });

    it('should enforce maximum boundary at 500ms', () => {
      // Test boundary condition
      expect(isValidChunkDuration(500)).toBe(true);
      expect(isValidChunkDuration(501)).toBe(false);
      expect(calculateExpectedChunkDuration(1000)).toBe(MAX_CHUNK_INTERVAL_MS);
    });
  });
});
