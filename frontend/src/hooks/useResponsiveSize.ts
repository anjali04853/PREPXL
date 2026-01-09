/**
 * useResponsiveSize - React hook for responsive visualizer sizing
 * 
 * Requirements: 10.1, 10.2, 10.3
 * - Scale visualizer for mobile (320px+), tablet, desktop
 * - Handle orientation changes
 * - Provide responsive size calculations
 */

import { useState, useEffect, useCallback } from 'react';

export interface ResponsiveSizeConfig {
  /** Minimum size for mobile devices (320px+) */
  minSize: number;
  /** Maximum size for desktop */
  maxSize: number;
  /** Percentage of viewport to use (0-1) */
  viewportPercentage: number;
  /** Padding to subtract from viewport */
  padding: number;
}

export interface ResponsiveSizeResult {
  /** Calculated size in pixels */
  size: number;
  /** Current viewport width */
  viewportWidth: number;
  /** Current viewport height */
  viewportHeight: number;
  /** Current device type */
  deviceType: 'mobile' | 'tablet' | 'desktop';
  /** Current orientation */
  orientation: 'portrait' | 'landscape';
  /** Whether the device is touch-enabled */
  isTouchDevice: boolean;
}

const DEFAULT_CONFIG: ResponsiveSizeConfig = {
  minSize: 200,
  maxSize: 500,
  viewportPercentage: 0.8,
  padding: 40,
};

// Breakpoints for device types
const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
};

/**
 * Detect if device supports touch
 */
function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error - msMaxTouchPoints is IE-specific
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Get device type based on viewport width
 */
function getDeviceType(width: number): 'mobile' | 'tablet' | 'desktop' {
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
}

/**
 * Get orientation based on viewport dimensions
 */
function getOrientation(width: number, height: number): 'portrait' | 'landscape' {
  return height > width ? 'portrait' : 'landscape';
}

/**
 * Calculate responsive size based on viewport and config
 */
function calculateSize(
  viewportWidth: number,
  viewportHeight: number,
  config: ResponsiveSizeConfig
): number {
  // Use the smaller dimension to ensure the visualizer fits
  const smallerDimension = Math.min(viewportWidth, viewportHeight);
  
  // Calculate size based on viewport percentage and padding
  const calculatedSize = (smallerDimension * config.viewportPercentage) - config.padding;
  
  // Clamp to min/max bounds
  return Math.max(config.minSize, Math.min(config.maxSize, calculatedSize));
}

/**
 * Hook for responsive visualizer sizing
 */
export function useResponsiveSize(
  customConfig?: Partial<ResponsiveSizeConfig>
): ResponsiveSizeResult {
  const config: ResponsiveSizeConfig = {
    ...DEFAULT_CONFIG,
    ...customConfig,
  };

  const [dimensions, setDimensions] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        viewportWidth: 1024,
        viewportHeight: 768,
      };
    }
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  const [isTouchDevice] = useState(() => detectTouchDevice());

  /**
   * Handle resize events
   */
  const handleResize = useCallback(() => {
    setDimensions({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }, []);

  /**
   * Handle orientation change events
   */
  const handleOrientationChange = useCallback(() => {
    // Small delay to allow viewport to update after orientation change
    setTimeout(() => {
      setDimensions({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
    }, 100);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Add event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    // Also listen for screen orientation API if available
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientationChange);
      }
    };
  }, [handleResize, handleOrientationChange]);

  const { viewportWidth, viewportHeight } = dimensions;
  const size = calculateSize(viewportWidth, viewportHeight, config);
  const deviceType = getDeviceType(viewportWidth);
  const orientation = getOrientation(viewportWidth, viewportHeight);

  return {
    size,
    viewportWidth,
    viewportHeight,
    deviceType,
    orientation,
    isTouchDevice,
  };
}

export default useResponsiveSize;
