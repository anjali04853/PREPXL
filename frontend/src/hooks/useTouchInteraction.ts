/**
 * useTouchInteraction - React hook for touch interactions on the visualizer
 * 
 * Requirements: 10.5
 * - Support touch interactions on mobile devices
 * - Handle tap, long press, and swipe gestures
 */

import { useRef, useCallback, useEffect, useState } from 'react';

export interface TouchInteractionConfig {
  /** Threshold for tap detection (ms) */
  tapThreshold: number;
  /** Threshold for long press detection (ms) */
  longPressThreshold: number;
  /** Minimum distance for swipe detection (px) */
  swipeThreshold: number;
}

export interface TouchInteractionCallbacks {
  /** Called when user taps the element */
  onTap?: (() => void) | undefined;
  /** Called when user long presses the element */
  onLongPress?: (() => void) | undefined;
  /** Called when user swipes on the element */
  onSwipe?: ((direction: 'up' | 'down' | 'left' | 'right') => void) | undefined;
  /** Called when touch starts */
  onTouchStart?: (() => void) | undefined;
  /** Called when touch ends */
  onTouchEnd?: (() => void) | undefined;
}

export interface TouchInteractionResult {
  /** Whether a touch is currently active */
  isTouching: boolean;
  /** Ref to attach to the target element */
  touchRef: React.RefObject<HTMLElement>;
  /** Touch event handlers to spread on the element */
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchCancel: (e: React.TouchEvent) => void;
  };
}

const DEFAULT_CONFIG: TouchInteractionConfig = {
  tapThreshold: 200,
  longPressThreshold: 500,
  swipeThreshold: 50,
};

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

/**
 * Hook for touch interactions
 */
export function useTouchInteraction(
  callbacks: TouchInteractionCallbacks = {},
  customConfig?: Partial<TouchInteractionConfig>
): TouchInteractionResult {
  const config: TouchInteractionConfig = {
    ...DEFAULT_CONFIG,
    ...customConfig,
  };

  const touchRef = useRef<HTMLElement>(null);
  const [isTouching, setIsTouching] = useState(false);
  const touchStateRef = useRef<TouchState | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Clear long press timer
   */
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  /**
   * Handle touch start
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch) return;
    
    touchStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };

    setIsTouching(true);
    callbacks.onTouchStart?.();

    // Start long press timer
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      callbacks.onLongPress?.();
      touchStateRef.current = null; // Prevent tap after long press
    }, config.longPressThreshold);
  }, [callbacks, config.longPressThreshold, clearLongPressTimer]);

  /**
   * Handle touch move
   */
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStateRef.current || e.touches.length !== 1) return;

    const touch = e.touches[0];
    if (!touch) return;
    
    const deltaX = touch.clientX - touchStateRef.current.startX;
    const deltaY = touch.clientY - touchStateRef.current.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Cancel long press if user moves too much
    if (distance > 10) {
      clearLongPressTimer();
    }
  }, [clearLongPressTimer]);

  /**
   * Handle touch end
   */
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearLongPressTimer();
    setIsTouching(false);
    callbacks.onTouchEnd?.();

    if (!touchStateRef.current) return;

    const touch = e.changedTouches[0];
    if (!touch) return;
    
    const deltaX = touch.clientX - touchStateRef.current.startX;
    const deltaY = touch.clientY - touchStateRef.current.startY;
    const duration = Date.now() - touchStateRef.current.startTime;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Check for swipe
    if (distance > config.swipeThreshold) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY) {
        callbacks.onSwipe?.(deltaX > 0 ? 'right' : 'left');
      } else {
        callbacks.onSwipe?.(deltaY > 0 ? 'down' : 'up');
      }
    }
    // Check for tap
    else if (duration < config.tapThreshold && distance < 10) {
      callbacks.onTap?.();
    }

    touchStateRef.current = null;
  }, [callbacks, config.swipeThreshold, config.tapThreshold, clearLongPressTimer]);

  /**
   * Handle touch cancel
   */
  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer();
    setIsTouching(false);
    touchStateRef.current = null;
    callbacks.onTouchEnd?.();
  }, [callbacks, clearLongPressTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  return {
    isTouching,
    touchRef,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
  };
}

export default useTouchInteraction;
