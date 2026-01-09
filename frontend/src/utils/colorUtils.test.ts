/**
 * Property-based tests for color utilities and WCAG contrast compliance
 * 
 * Feature: realtime-audio-transcription
 * Property 15: WCAG Contrast Ratio Compliance
 * 
 * Uses fast-check for property-based testing
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  hexToRgb,
  rgbToHex,
  hslToRgb,
  getRelativeLuminance,
  calculateContrastRatio,
  meetsWcagAA,
  meetsWcagAAA,
  adjustForContrast,
  WCAG_CONTRAST_RATIOS,
  type RGB,
} from './colorUtils';

describe('Color Utils Property Tests', () => {
  /**
   * Property 15: WCAG Contrast Ratio Compliance
   * 
   * For any foreground/background color pair used in the UI, 
   * the contrast ratio SHALL be at least 4.5:1 for normal text 
   * and 3:1 for large text (WCAG 2.1 AA).
   * 
   * **Validates: Requirements 10.4**
   */
  describe('Property 15: WCAG Contrast Ratio Compliance', () => {
    // Arbitrary for RGB color
    const rgbArbitrary = fc.record({
      r: fc.integer({ min: 0, max: 255 }),
      g: fc.integer({ min: 0, max: 255 }),
      b: fc.integer({ min: 0, max: 255 }),
    });

    it('should calculate contrast ratio in valid range [1, 21]', () => {
      fc.assert(
        fc.property(
          rgbArbitrary,
          rgbArbitrary,
          (foreground, background) => {
            const ratio = calculateContrastRatio(foreground, background);
            
            // Contrast ratio is always between 1 (same color) and 21 (black/white)
            expect(ratio).toBeGreaterThanOrEqual(1);
            expect(ratio).toBeLessThanOrEqual(21);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 21:1 for black on white', () => {
      const black: RGB = { r: 0, g: 0, b: 0 };
      const white: RGB = { r: 255, g: 255, b: 255 };
      
      const ratio = calculateContrastRatio(black, white);
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should return 1:1 for same colors', () => {
      fc.assert(
        fc.property(
          rgbArbitrary,
          (color) => {
            const ratio = calculateContrastRatio(color, color);
            expect(ratio).toBeCloseTo(1, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be symmetric (order of colors does not matter)', () => {
      fc.assert(
        fc.property(
          rgbArbitrary,
          rgbArbitrary,
          (color1, color2) => {
            const ratio1 = calculateContrastRatio(color1, color2);
            const ratio2 = calculateContrastRatio(color2, color1);
            
            expect(ratio1).toBeCloseTo(ratio2, 10);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify WCAG AA compliance for normal text (4.5:1)', () => {
      fc.assert(
        fc.property(
          rgbArbitrary,
          rgbArbitrary,
          (foreground, background) => {
            const ratio = calculateContrastRatio(foreground, background);
            const meetsAA = meetsWcagAA(foreground, background, false);
            
            if (ratio >= WCAG_CONTRAST_RATIOS.AA_NORMAL) {
              expect(meetsAA).toBe(true);
            } else {
              expect(meetsAA).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify WCAG AA compliance for large text (3:1)', () => {
      fc.assert(
        fc.property(
          rgbArbitrary,
          rgbArbitrary,
          (foreground, background) => {
            const ratio = calculateContrastRatio(foreground, background);
            const meetsAALarge = meetsWcagAA(foreground, background, true);
            
            if (ratio >= WCAG_CONTRAST_RATIOS.AA_LARGE) {
              expect(meetsAALarge).toBe(true);
            } else {
              expect(meetsAALarge).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify WCAG AAA compliance', () => {
      fc.assert(
        fc.property(
          rgbArbitrary,
          rgbArbitrary,
          (foreground, background) => {
            const ratio = calculateContrastRatio(foreground, background);
            const meetsAAANormal = meetsWcagAAA(foreground, background, false);
            const meetsAAALarge = meetsWcagAAA(foreground, background, true);
            
            if (ratio >= WCAG_CONTRAST_RATIOS.AAA_NORMAL) {
              expect(meetsAAANormal).toBe(true);
            } else {
              expect(meetsAAANormal).toBe(false);
            }
            
            if (ratio >= WCAG_CONTRAST_RATIOS.AAA_LARGE) {
              expect(meetsAAALarge).toBe(true);
            } else {
              expect(meetsAAALarge).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should adjust colors to meet contrast requirements or return best possible', () => {
      fc.assert(
        fc.property(
          rgbArbitrary,
          rgbArbitrary,
          (foreground, background) => {
            const originalRatio = calculateContrastRatio(foreground, background);
            const adjusted = adjustForContrast(foreground, background, WCAG_CONTRAST_RATIOS.AA_NORMAL);
            const newRatio = calculateContrastRatio(adjusted, background);
            
            if (originalRatio >= WCAG_CONTRAST_RATIOS.AA_NORMAL) {
              // If already compliant, should return original
              expect(adjusted.r).toBe(foreground.r);
              expect(adjusted.g).toBe(foreground.g);
              expect(adjusted.b).toBe(foreground.b);
            } else {
              // The adjusted color should have equal or better contrast
              // (or be the best possible if we hit color limits)
              expect(newRatio).toBeGreaterThanOrEqual(originalRatio - 0.001);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Relative Luminance Calculation', () => {
    it('should return 0 for black and 1 for white', () => {
      const black: RGB = { r: 0, g: 0, b: 0 };
      const white: RGB = { r: 255, g: 255, b: 255 };
      
      expect(getRelativeLuminance(black)).toBeCloseTo(0, 5);
      expect(getRelativeLuminance(white)).toBeCloseTo(1, 5);
    });

    it('should return values in [0, 1] for any color', () => {
      fc.assert(
        fc.property(
          fc.record({
            r: fc.integer({ min: 0, max: 255 }),
            g: fc.integer({ min: 0, max: 255 }),
            b: fc.integer({ min: 0, max: 255 }),
          }),
          (color) => {
            const luminance = getRelativeLuminance(color);
            expect(luminance).toBeGreaterThanOrEqual(0);
            expect(luminance).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be monotonically increasing with brightness', () => {
      // Grayscale colors should have increasing luminance
      for (let i = 0; i < 255; i += 10) {
        const darker: RGB = { r: i, g: i, b: i };
        const lighter: RGB = { r: i + 10, g: i + 10, b: i + 10 };
        
        const lumDarker = getRelativeLuminance(darker);
        const lumLighter = getRelativeLuminance(lighter);
        
        expect(lumLighter).toBeGreaterThan(lumDarker);
      }
    });
  });

  describe('Hex to RGB Conversion', () => {
    it('should correctly parse valid hex colors', () => {
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should handle shorthand hex colors', () => {
      expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should handle hex without # prefix', () => {
      expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should return null for invalid hex', () => {
      expect(hexToRgb('invalid')).toBeNull();
      expect(hexToRgb('#gggggg')).toBeNull();
      expect(hexToRgb('#12345')).toBeNull();
    });
  });

  describe('RGB to Hex Conversion', () => {
    it('should be inverse of hexToRgb', () => {
      fc.assert(
        fc.property(
          fc.record({
            r: fc.integer({ min: 0, max: 255 }),
            g: fc.integer({ min: 0, max: 255 }),
            b: fc.integer({ min: 0, max: 255 }),
          }),
          (rgb) => {
            const hex = rgbToHex(rgb);
            const parsed = hexToRgb(hex);
            
            expect(parsed).not.toBeNull();
            expect(parsed?.r).toBe(rgb.r);
            expect(parsed?.g).toBe(rgb.g);
            expect(parsed?.b).toBe(rgb.b);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('HSL to RGB Conversion', () => {
    it('should convert grayscale correctly (saturation = 0)', () => {
      // When saturation is 0, hue doesn't matter, only lightness
      const black = hslToRgb({ h: 0, s: 0, l: 0 });
      const white = hslToRgb({ h: 0, s: 0, l: 100 });
      const gray = hslToRgb({ h: 0, s: 0, l: 50 });
      
      expect(black).toEqual({ r: 0, g: 0, b: 0 });
      expect(white).toEqual({ r: 255, g: 255, b: 255 });
      expect(gray.r).toBeCloseTo(128, 0);
      expect(gray.g).toBeCloseTo(128, 0);
      expect(gray.b).toBeCloseTo(128, 0);
    });

    it('should produce valid RGB values for any HSL input', () => {
      fc.assert(
        fc.property(
          fc.record({
            h: fc.integer({ min: 0, max: 360 }),
            s: fc.integer({ min: 0, max: 100 }),
            l: fc.integer({ min: 0, max: 100 }),
          }),
          (hsl) => {
            const rgb = hslToRgb(hsl);
            
            expect(rgb.r).toBeGreaterThanOrEqual(0);
            expect(rgb.r).toBeLessThanOrEqual(255);
            expect(rgb.g).toBeGreaterThanOrEqual(0);
            expect(rgb.g).toBeLessThanOrEqual(255);
            expect(rgb.b).toBeGreaterThanOrEqual(0);
            expect(rgb.b).toBeLessThanOrEqual(255);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Theme Color Compliance', () => {
    // Test that our defined theme colors meet WCAG AA requirements
    const darkThemeColors = {
      background: { r: 18, g: 18, b: 18 },     // #121212
      text: { r: 255, g: 255, b: 255 },         // #ffffff
      textSecondary: { r: 179, g: 179, b: 179 }, // #b3b3b3
    };

    const lightThemeColors = {
      background: { r: 255, g: 255, b: 255 },   // #ffffff
      text: { r: 17, g: 24, b: 39 },             // #111827
      textSecondary: { r: 75, g: 85, b: 99 },   // #4b5563
    };

    it('dark theme text should meet WCAG AA against background', () => {
      const ratio = calculateContrastRatio(
        darkThemeColors.text,
        darkThemeColors.background
      );
      expect(ratio).toBeGreaterThanOrEqual(WCAG_CONTRAST_RATIOS.AA_NORMAL);
    });

    it('dark theme secondary text should meet WCAG AA against background', () => {
      const ratio = calculateContrastRatio(
        darkThemeColors.textSecondary,
        darkThemeColors.background
      );
      expect(ratio).toBeGreaterThanOrEqual(WCAG_CONTRAST_RATIOS.AA_NORMAL);
    });

    it('light theme text should meet WCAG AA against background', () => {
      const ratio = calculateContrastRatio(
        lightThemeColors.text,
        lightThemeColors.background
      );
      expect(ratio).toBeGreaterThanOrEqual(WCAG_CONTRAST_RATIOS.AA_NORMAL);
    });

    it('light theme secondary text should meet WCAG AA against background', () => {
      const ratio = calculateContrastRatio(
        lightThemeColors.textSecondary,
        lightThemeColors.background
      );
      expect(ratio).toBeGreaterThanOrEqual(WCAG_CONTRAST_RATIOS.AA_NORMAL);
    });
  });
});
