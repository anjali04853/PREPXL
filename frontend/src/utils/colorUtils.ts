/**
 * Color Utilities for Accessibility and Theming
 * 
 * Requirements: 10.4, 10.6
 * - Ensure WCAG 2.1 AA contrast ratios
 * - Support theme customization
 */

/**
 * RGB color representation
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * HSL color representation
 */
export interface HSL {
  h: number;
  s: number;
  l: number;
}

/**
 * WCAG contrast ratio requirements
 * AA Normal text: 4.5:1
 * AA Large text: 3:1
 * AAA Normal text: 7:1
 * AAA Large text: 4.5:1
 */
export const WCAG_CONTRAST_RATIOS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5,
} as const;

/**
 * Parse a hex color string to RGB
 * @param hex - Hex color string (e.g., "#ffffff" or "ffffff")
 * @returns RGB object or null if invalid
 */
export function hexToRgb(hex: string): RGB | null {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');
  
  // Validate hex format
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex) && !/^[0-9A-Fa-f]{3}$/.test(cleanHex)) {
    return null;
  }
  
  // Expand shorthand (e.g., "fff" -> "ffffff")
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex;
  
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  
  if (!result || !result[1] || !result[2] || !result[3]) return null;
  
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex string
 * @param rgb - RGB color object
 * @returns Hex color string with # prefix
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Parse an HSL color string to HSL object
 * @param hslString - HSL string (e.g., "hsl(180, 50%, 50%)")
 * @returns HSL object or null if invalid
 */
export function parseHsl(hslString: string): HSL | null {
  const match = hslString.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/i);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  
  return {
    h: parseInt(match[1], 10),
    s: parseInt(match[2], 10),
    l: parseInt(match[3], 10),
  };
}

/**
 * Convert HSL to RGB
 * @param hsl - HSL color object
 * @returns RGB color object
 */
export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  
  let r: number, g: number, b: number;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 formula
 * @param rgb - RGB color object
 * @returns Relative luminance (0-1)
 */
export function getRelativeLuminance(rgb: RGB): number {
  const sRGB = [rgb.r, rgb.g, rgb.b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * (sRGB[0] ?? 0) + 0.7152 * (sRGB[1] ?? 0) + 0.0722 * (sRGB[2] ?? 0);
}

/**
 * Calculate contrast ratio between two colors
 * Based on WCAG 2.1 formula
 * 
 * Property 15: WCAG Contrast Ratio Compliance
 * For any foreground/background color pair used in the UI, 
 * the contrast ratio SHALL be at least 4.5:1 for normal text 
 * and 3:1 for large text (WCAG 2.1 AA).
 * 
 * @param foreground - Foreground RGB color
 * @param background - Background RGB color
 * @returns Contrast ratio (1-21)
 */
export function calculateContrastRatio(foreground: RGB, background: RGB): number {
  const l1 = getRelativeLuminance(foreground);
  const l2 = getRelativeLuminance(background);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color pair meets WCAG AA requirements
 * @param foreground - Foreground RGB color
 * @param background - Background RGB color
 * @param isLargeText - Whether the text is large (18pt+ or 14pt+ bold)
 * @returns Whether the contrast meets WCAG AA requirements
 */
export function meetsWcagAA(
  foreground: RGB,
  background: RGB,
  isLargeText: boolean = false
): boolean {
  const ratio = calculateContrastRatio(foreground, background);
  const threshold = isLargeText ? WCAG_CONTRAST_RATIOS.AA_LARGE : WCAG_CONTRAST_RATIOS.AA_NORMAL;
  return ratio >= threshold;
}

/**
 * Check if a color pair meets WCAG AAA requirements
 * @param foreground - Foreground RGB color
 * @param background - Background RGB color
 * @param isLargeText - Whether the text is large (18pt+ or 14pt+ bold)
 * @returns Whether the contrast meets WCAG AAA requirements
 */
export function meetsWcagAAA(
  foreground: RGB,
  background: RGB,
  isLargeText: boolean = false
): boolean {
  const ratio = calculateContrastRatio(foreground, background);
  const threshold = isLargeText ? WCAG_CONTRAST_RATIOS.AAA_LARGE : WCAG_CONTRAST_RATIOS.AAA_NORMAL;
  return ratio >= threshold;
}

/**
 * Suggest a color adjustment to meet contrast requirements
 * @param foreground - Foreground RGB color
 * @param background - Background RGB color
 * @param targetRatio - Target contrast ratio
 * @returns Adjusted foreground color that meets the target ratio
 */
export function adjustForContrast(
  foreground: RGB,
  background: RGB,
  targetRatio: number = WCAG_CONTRAST_RATIOS.AA_NORMAL
): RGB {
  const currentRatio = calculateContrastRatio(foreground, background);
  
  if (currentRatio >= targetRatio) {
    return foreground;
  }
  
  const bgLuminance = getRelativeLuminance(background);
  const shouldLighten = bgLuminance < 0.5;
  
  // Iteratively adjust the foreground color
  let adjusted = { ...foreground };
  let iterations = 0;
  const maxIterations = 255;
  let bestRatio = currentRatio;
  let bestColor = { ...foreground };
  
  while (iterations < maxIterations) {
    if (shouldLighten) {
      // Lighten the color
      adjusted = {
        r: Math.min(255, adjusted.r + 1),
        g: Math.min(255, adjusted.g + 1),
        b: Math.min(255, adjusted.b + 1),
      };
    } else {
      // Darken the color
      adjusted = {
        r: Math.max(0, adjusted.r - 1),
        g: Math.max(0, adjusted.g - 1),
        b: Math.max(0, adjusted.b - 1),
      };
    }
    
    const newRatio = calculateContrastRatio(adjusted, background);
    
    // Track the best ratio we've found
    if (newRatio > bestRatio) {
      bestRatio = newRatio;
      bestColor = { ...adjusted };
    }
    
    // Stop if we've reached the target
    if (newRatio >= targetRatio) {
      return adjusted;
    }
    
    // Stop if we've hit the color limits
    if (shouldLighten && adjusted.r === 255 && adjusted.g === 255 && adjusted.b === 255) {
      break;
    }
    if (!shouldLighten && adjusted.r === 0 && adjusted.g === 0 && adjusted.b === 0) {
      break;
    }
    
    iterations++;
  }
  
  // Return the best color we found
  return bestColor;
}
