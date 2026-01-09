/**
 * Property-based tests for frequency utilities
 * 
 * Feature: realtime-audio-transcription
 * Uses fast-check for property-based testing
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  normalizeFrequencyData,
  mapFrequencyToRadius,
  applySmoothing,
  decibelToHeight,
  calculateMaxSmoothingChange,
} from './frequencyUtils';

describe('Frequency Utils Property Tests', () => {
  /**
   * Property 1: Frequency Data Normalization
   * 
   * For any raw frequency data array from the AnalyserNode, 
   * the normalized output values SHALL all be within the range [0, 1].
   * 
   * **Validates: Requirements 2.3**
   */
  describe('Property 1: Frequency Data Normalization', () => {
    it('should normalize all values to [0, 1] range for any input', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 2048 }),
          (rawValues) => {
            const rawData = new Uint8Array(rawValues);
            const normalized = normalizeFrequencyData(rawData);
            for (let i = 0; i < normalized.length; i++) {
              const value = normalized[i];
              expect(value).toBeGreaterThanOrEqual(0);
              expect(value).toBeLessThanOrEqual(1);
            }
            expect(normalized.length).toBe(rawData.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map 0 to 0 and 255 to 1', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (length) => {
          const zeros = new Uint8Array(length).fill(0);
          const normalizedZeros = normalizeFrequencyData(zeros);
          for (let i = 0; i < normalizedZeros.length; i++) {
            expect(normalizedZeros[i]).toBe(0);
          }

          const maxes = new Uint8Array(length).fill(255);
          const normalizedMaxes = normalizeFrequencyData(maxes);
          for (let i = 0; i < normalizedMaxes.length; i++) {
            expect(normalizedMaxes[i]).toBe(1);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Frequency-to-Radius Mapping Monotonicity
   * 
   * For any two frequency band indices where index_a < index_b, 
   * the mapped radius for index_a SHALL be less than or equal to 
   * the mapped radius for index_b.
   * 
   * **Validates: Requirements 2.4**
   */
  describe('Property 2: Frequency-to-Radius Mapping Monotonicity', () => {
    it('should maintain monotonic mapping: lower index -> smaller or equal radius', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 128 }),
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.5), noNaN: true }),
          fc.float({ min: Math.fround(0.6), max: Math.fround(1.0), noNaN: true }),
          (totalBands, innerRadius, outerRadius) => {
            for (let indexA = 0; indexA < totalBands - 1; indexA++) {
              for (let indexB = indexA + 1; indexB < totalBands; indexB++) {
                const radiusA = mapFrequencyToRadius(indexA, totalBands, innerRadius, outerRadius);
                const radiusB = mapFrequencyToRadius(indexB, totalBands, innerRadius, outerRadius);
                expect(radiusA).toBeLessThanOrEqual(radiusB);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map index 0 to innerRadius and max index to outerRadius', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 128 }),
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.5), noNaN: true }),
          fc.float({ min: Math.fround(0.6), max: Math.fround(1.0), noNaN: true }),
          (totalBands, innerRadius, outerRadius) => {
            const radiusAtZero = mapFrequencyToRadius(0, totalBands, innerRadius, outerRadius);
            const radiusAtMax = mapFrequencyToRadius(totalBands - 1, totalBands, innerRadius, outerRadius);
            expect(radiusAtZero).toBeCloseTo(innerRadius, 5);
            expect(radiusAtMax).toBeCloseTo(outerRadius, 5);
          }
        ),
        { numRuns: 100 }
      );
    });


    it('should always return values within [innerRadius, outerRadius]', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          fc.integer({ min: 1, max: 128 }),
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.5), noNaN: true }),
          fc.float({ min: Math.fround(0.6), max: Math.fround(1.0), noNaN: true }),
          (frequencyIndex, totalBands, innerRadius, outerRadius) => {
            const radius = mapFrequencyToRadius(frequencyIndex, totalBands, innerRadius, outerRadius);
            expect(radius).toBeGreaterThanOrEqual(innerRadius);
            expect(radius).toBeLessThanOrEqual(outerRadius);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Placeholder for Property 3 and 4 tests (to be added in subsequent tasks)
  // These use applySmoothing, decibelToHeight, and calculateMaxSmoothingChange
  void applySmoothing;
  void decibelToHeight;
  void calculateMaxSmoothingChange;

  /**
   * Property 3: Animation Smoothing (Damping)
   * 
   * For any sequence of raw frequency values, the smoothed/damped output values 
   * SHALL change by no more than the smoothing factor multiplied by the difference 
   * between current and target values per frame.
   * 
   * **Validates: Requirements 3.2, 3.3**
   */
  describe('Property 3: Animation Smoothing (Damping)', () => {
    it('should limit change to smoothingFactor * difference', () => {
      fc.assert(
        fc.property(
          // Generate current values array
          fc.array(fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }), 
            { minLength: 1, maxLength: 128 }),
          // Generate target values array (same length)
          fc.array(fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }), 
            { minLength: 1, maxLength: 128 }),
          // Smoothing factor between 0.1 and 0.3
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.3), noNaN: true }),
          (currentArr, targetArr, smoothingFactor) => {
            // Ensure arrays are same length
            const length = Math.min(currentArr.length, targetArr.length);
            const current = new Float32Array(currentArr.slice(0, length));
            const target = new Float32Array(targetArr.slice(0, length));
            
            const result = applySmoothing(current, target, smoothingFactor);
            
            for (let i = 0; i < length; i++) {
              const currentVal = current[i] ?? 0;
              const targetVal = target[i] ?? 0;
              const resultVal = result[i] ?? 0;
              
              // Calculate expected max change
              const maxChange = calculateMaxSmoothingChange(currentVal, targetVal, smoothingFactor);
              const actualChange = Math.abs(resultVal - currentVal);
              
              // Actual change should not exceed max allowed change (with small epsilon for float precision)
              expect(actualChange).toBeLessThanOrEqual(maxChange + 0.0001);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should move towards target value', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }), 
            { minLength: 1, maxLength: 64 }),
          fc.array(fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }), 
            { minLength: 1, maxLength: 64 }),
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.3), noNaN: true }),
          (currentArr, targetArr, smoothingFactor) => {
            const length = Math.min(currentArr.length, targetArr.length);
            const current = new Float32Array(currentArr.slice(0, length));
            const target = new Float32Array(targetArr.slice(0, length));
            
            const result = applySmoothing(current, target, smoothingFactor);
            
            for (let i = 0; i < length; i++) {
              const currentVal = current[i] ?? 0;
              const targetVal = target[i] ?? 0;
              const resultVal = result[i] ?? 0;
              
              // Result should be between current and target (or equal if they're the same)
              if (currentVal <= targetVal) {
                expect(resultVal).toBeGreaterThanOrEqual(currentVal - 0.0001);
                expect(resultVal).toBeLessThanOrEqual(targetVal + 0.0001);
              } else {
                expect(resultVal).toBeLessThanOrEqual(currentVal + 0.0001);
                expect(resultVal).toBeGreaterThanOrEqual(targetVal - 0.0001);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve array length', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 128 }),
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.3), noNaN: true }),
          (length, smoothingFactor) => {
            const current = new Float32Array(length).fill(0);
            const target = new Float32Array(length).fill(1);
            
            const result = applySmoothing(current, target, smoothingFactor);
            
            expect(result.length).toBe(length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Decibel-to-Height Scaling
   * 
   * For any decibel value within the configured range [minDecibels, maxDecibels],
   * the scaled bar height SHALL be proportional to the dB value's position 
   * within that range, producing values in [0, maxBarHeight].
   * 
   * **Validates: Requirements 3.4**
   */
  describe('Property 4: Decibel-to-Height Scaling', () => {
    it('should produce values in [0, maxHeight] for any dB value', () => {
      fc.assert(
        fc.property(
          // Generate dB value (can be outside range to test clamping)
          fc.float({ min: Math.fround(-120), max: Math.fround(0), noNaN: true }),
          // minDecibels (typically -90)
          fc.float({ min: Math.fround(-100), max: Math.fround(-50), noNaN: true }),
          // maxDecibels (typically -10)
          fc.float({ min: Math.fround(-40), max: Math.fround(0), noNaN: true }),
          // maxHeight
          fc.float({ min: Math.fround(10), max: Math.fround(500), noNaN: true }),
          (dbValue, minDb, maxDb, maxHeight) => {
            const height = decibelToHeight(dbValue, minDb, maxDb, maxHeight);
            
            // Height should always be in [0, maxHeight]
            expect(height).toBeGreaterThanOrEqual(0);
            expect(height).toBeLessThanOrEqual(maxHeight);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should map minDecibels to 0 and maxDecibels to maxHeight', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(-100), max: Math.fround(-50), noNaN: true }),
          fc.float({ min: Math.fround(-40), max: Math.fround(0), noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(500), noNaN: true }),
          (minDb, maxDb, maxHeight) => {
            const heightAtMin = decibelToHeight(minDb, minDb, maxDb, maxHeight);
            const heightAtMax = decibelToHeight(maxDb, minDb, maxDb, maxHeight);
            
            // minDecibels should map to 0
            expect(heightAtMin).toBeCloseTo(0, 5);
            
            // maxDecibels should map to maxHeight
            expect(heightAtMax).toBeCloseTo(maxHeight, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be monotonically increasing within range', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(-100), max: Math.fround(-50), noNaN: true }),
          fc.float({ min: Math.fround(-40), max: Math.fround(0), noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(500), noNaN: true }),
          (minDb, maxDb, maxHeight) => {
            // Test multiple points within range
            const range = maxDb - minDb;
            const step = range / 10;
            
            let prevHeight = -1;
            for (let db = minDb; db <= maxDb; db += step) {
              const height = decibelToHeight(db, minDb, maxDb, maxHeight);
              
              // Each height should be >= previous (monotonically increasing)
              expect(height).toBeGreaterThanOrEqual(prevHeight);
              prevHeight = height;
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be proportional (linear scaling)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(-100), max: Math.fround(-50), noNaN: true }),
          fc.float({ min: Math.fround(-40), max: Math.fround(0), noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(500), noNaN: true }),
          (minDb, maxDb, maxHeight) => {
            // Test that midpoint dB maps to midpoint height
            const midDb = (minDb + maxDb) / 2;
            const midHeight = decibelToHeight(midDb, minDb, maxDb, maxHeight);
            const expectedMidHeight = maxHeight / 2;
            
            expect(midHeight).toBeCloseTo(expectedMidHeight, 3);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

});
