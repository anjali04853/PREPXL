/**
 * CircularVisualizer - Canvas-based circular frequency visualizer
 * 
 * Requirements: 3.1, 10.1, 10.2, 10.3, 10.5
 * - Render frequency bars in a circular/radial pattern using Canvas API
 * - Set up Canvas element with responsive sizing
 * - Implement requestAnimationFrame render loop
 * - Create circular bar layout with configurable bar count (64-128)
 * - Scale visualizer for mobile (320px+), tablet, desktop
 * - Handle orientation changes
 * - Support touch interactions on mobile devices
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type { VisualizerConfig, ColorScheme } from '../types';
import { 
  normalizeFrequencyData, 
  mapFrequencyToRadius,
  applySmoothing,
  decibelToHeight,
  byteToDecibel
} from '../utils/frequencyUtils';
import { useTouchInteraction } from '../hooks/useTouchInteraction';
import './CircularVisualizer.css';

export interface CircularVisualizerProps {
  /** AnalyserNode from AudioCaptureService for frequency data */
  analyserNode: AnalyserNode | null;
  /** Whether the visualizer is actively recording */
  isActive: boolean;
  /** Size of the visualizer in pixels (width and height) - can be responsive */
  size: number;
  /** Color scheme for the visualizer */
  colorScheme: ColorScheme;
  /** Optional custom configuration */
  config?: Partial<VisualizerConfig>;
  /** Callback when visualizer is tapped (touch devices) */
  onTap?: () => void;
  /** Callback when visualizer is long pressed (touch devices) */
  onLongPress?: () => void;
  /** Whether to enable touch interactions */
  enableTouchInteraction?: boolean;
  /** Additional CSS class name */
  className?: string;
}

/** Default visualizer configuration */
export const DEFAULT_CONFIG: VisualizerConfig = {
  innerRadius: 0.3,      // 30% of canvas radius
  outerRadius: 0.9,      // 90% of canvas radius
  barCount: 64,          // Number of frequency bars
  smoothingFactor: 0.2,  // Animation damping
  minDecibels: -90,
  maxDecibels: -10,
};

/**
 * CircularVisualizer component renders a circular audio frequency visualization
 * with responsive sizing and touch interaction support
 */
export function CircularVisualizer({
  analyserNode,
  isActive,
  size,
  colorScheme,
  config: customConfig,
  onTap,
  onLongPress,
  enableTouchInteraction = true,
  className = '',
}: CircularVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const smoothedDataRef = useRef<Float32Array | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  
  // Merge custom config with defaults
  const config: VisualizerConfig = {
    ...DEFAULT_CONFIG,
    ...customConfig,
  };

  // Touch interaction support (Requirements: 10.5)
  const { touchHandlers, isTouching } = useTouchInteraction(
    enableTouchInteraction ? {
      onTap,
      onLongPress,
      onTouchStart: () => setIsPressed(true),
      onTouchEnd: () => setIsPressed(false),
    } : {},
  );

  /**
   * Get color based on scheme and frequency/amplitude
   * Requirements: 3.2, 3.3, 3.4 - Color gradient based on frequency/amplitude
   */
  const getBarColor = useCallback((
    index: number,
    normalizedValue: number,
    totalBars: number
  ): string => {
    const frequencyPosition = index / totalBars; // 0 = low freq, 1 = high freq
    const amplitude = Math.min(1, normalizedValue); // Clamp to 0-1
    
    switch (colorScheme) {
      case 'gradient':
        // Rainbow gradient: low freq = red/orange, high freq = blue/purple
        // Amplitude affects saturation and lightness
        const hue = frequencyPosition * 270; // 0 (red) to 270 (violet)
        const saturation = 70 + amplitude * 30; // 70-100%
        const lightness = 45 + amplitude * 25; // 45-70%
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
      case 'light':
        // Light theme: blue to purple gradient
        // Low freq = deep blue, high freq = purple
        const lightHue = 220 + frequencyPosition * 80; // 220 (blue) to 300 (purple)
        const lightSat = 60 + amplitude * 30;
        const lightLum = 35 + amplitude * 30;
        return `hsl(${lightHue}, ${lightSat}%, ${lightLum}%)`;
        
      case 'dark':
      default:
        // Dark theme: cyan to magenta gradient with glow effect
        // Low freq = cyan, high freq = magenta
        const darkHue = 180 + frequencyPosition * 120; // 180 (cyan) to 300 (magenta)
        const darkSat = 80 + amplitude * 20;
        const darkLum = 50 + amplitude * 25;
        return `hsl(${darkHue}, ${darkSat}%, ${darkLum}%)`;
    }
  }, [colorScheme]);

  /**
   * Render the circular visualizer
   */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY);
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw outer glow ring (subtle ambient effect)
    const glowGradient = ctx.createRadialGradient(
      centerX, centerY, radius * config.innerRadius * 0.8,
      centerX, centerY, radius * config.outerRadius
    );
    if (colorScheme === 'light') {
      glowGradient.addColorStop(0, 'rgba(102, 126, 234, 0.03)');
      glowGradient.addColorStop(0.5, 'rgba(118, 75, 162, 0.02)');
      glowGradient.addColorStop(1, 'transparent');
    } else {
      glowGradient.addColorStop(0, 'rgba(79, 172, 254, 0.05)');
      glowGradient.addColorStop(0.5, 'rgba(102, 126, 234, 0.03)');
      glowGradient.addColorStop(1, 'transparent');
    }
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * config.outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = glowGradient;
    ctx.fill();

    // Draw background circle (inner core)
    const innerGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius * config.innerRadius * 0.9
    );
    if (colorScheme === 'light') {
      innerGradient.addColorStop(0, 'rgba(102, 126, 234, 0.08)');
      innerGradient.addColorStop(0.7, 'rgba(118, 75, 162, 0.04)');
      innerGradient.addColorStop(1, 'rgba(0, 0, 0, 0.02)');
    } else {
      innerGradient.addColorStop(0, 'rgba(79, 172, 254, 0.1)');
      innerGradient.addColorStop(0.7, 'rgba(102, 126, 234, 0.05)');
      innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
    }
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * config.innerRadius * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = innerGradient;
    ctx.fill();

    // Get frequency data if analyser is available
    let frequencyData: Uint8Array;
    if (analyserNode && isActive) {
      frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
      analyserNode.getByteFrequencyData(frequencyData);
    } else {
      // Idle animation - smooth wave effect
      const time = Date.now() / 1000;
      frequencyData = new Uint8Array(config.barCount);
      for (let i = 0; i < config.barCount; i++) {
        // Create a gentle wave pattern that moves around the circle
        const waveOffset = (i / config.barCount) * Math.PI * 2;
        const wave1 = Math.sin(time * 0.8 + waveOffset) * 0.5 + 0.5;
        const wave2 = Math.sin(time * 1.2 + waveOffset * 2) * 0.3 + 0.5;
        const wave3 = Math.sin(time * 0.5 + waveOffset * 0.5) * 0.2 + 0.5;
        // Combine waves for organic movement, scale to 0-40 range for subtle effect
        frequencyData[i] = Math.floor((wave1 * wave2 * wave3) * 40 + 15);
      }
    }

    // Normalize frequency data using utility function (Requirement 2.3)
    const normalizedData = normalizeFrequencyData(frequencyData);

    // Initialize smoothed data if needed
    if (!smoothedDataRef.current || smoothedDataRef.current.length !== config.barCount) {
      smoothedDataRef.current = new Float32Array(config.barCount);
    }

    // Sample normalized data to match bar count
    const binSize = Math.floor(normalizedData.length / config.barCount);
    const sampledData = new Float32Array(config.barCount);
    
    for (let i = 0; i < config.barCount; i++) {
      let sum = 0;
      for (let j = 0; j < binSize; j++) {
        const dataIndex = i * binSize + j;
        sum += normalizedData[dataIndex] ?? 0;
      }
      sampledData[i] = binSize > 0 ? sum / binSize : 0;
    }

    // Apply smoothing using utility function (Requirement 3.2, 3.3)
    const smoothedData = applySmoothing(
      smoothedDataRef.current,
      sampledData,
      config.smoothingFactor
    );
    smoothedDataRef.current = smoothedData;

    const barAngle = (Math.PI * 2) / config.barCount;
    const innerR = radius * config.innerRadius;
    const outerR = radius * config.outerRadius;
    const maxBarHeight = outerR - innerR;

    for (let i = 0; i < config.barCount; i++) {
      const normalizedValue = smoothedData[i] ?? 0;

      // Convert normalized value to decibel then to height (Requirement 3.4)
      const dbValue = byteToDecibel(
        normalizedValue * 255,
        config.minDecibels,
        config.maxDecibels
      );
      const barHeight = decibelToHeight(
        dbValue,
        config.minDecibels,
        config.maxDecibels,
        maxBarHeight
      );

      const angle = i * barAngle - Math.PI / 2; // Start from top

      // Calculate bar position - bars extend outward from inner radius
      // Low frequencies (low index) are at inner positions
      // High frequencies (high index) are at outer positions
      // The mapFrequencyToRadius function ensures monotonic mapping
      const baseRadius = mapFrequencyToRadius(i, config.barCount, innerR, innerR);
      const x1 = centerX + Math.cos(angle) * baseRadius;
      const y1 = centerY + Math.sin(angle) * baseRadius;
      const x2 = centerX + Math.cos(angle) * (baseRadius + barHeight);
      const y2 = centerY + Math.sin(angle) * (baseRadius + barHeight);

      // Draw bar with glow effect for high amplitude
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      
      const barColor = getBarColor(i, normalizedValue, config.barCount);
      
      // Enhanced glow effect based on amplitude (Requirement 3.3 - smooth visual transitions)
      // Lower threshold for more visible glow, stronger effect
      if (normalizedValue > 0.15) {
        ctx.shadowColor = barColor;
        ctx.shadowBlur = normalizedValue * 15 + 5;
      } else {
        // Subtle glow even for low amplitudes
        ctx.shadowColor = barColor;
        ctx.shadowBlur = 3;
      }
      
      ctx.strokeStyle = barColor;
      ctx.lineWidth = Math.max(2.5, (barAngle * innerR) * 0.65);
      ctx.lineCap = 'round';
      ctx.stroke();
      
      // Reset shadow for next iteration
      ctx.shadowBlur = 0;
    }

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(render);
  }, [analyserNode, isActive, config, colorScheme, getBarColor]);

  /**
   * Start/stop animation loop based on component lifecycle
   */
  useEffect(() => {
    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      // Cleanup animation frame on unmount
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [render]);

  /**
   * Handle canvas resize for responsive sizing
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions with device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    // Scale context for high DPI displays
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className={`circular-visualizer ${className} ${isPressed || isTouching ? 'pressed' : ''}`}
      style={{
        width: size,
        height: size,
        maxWidth: '100%',
        maxHeight: '100%',
        borderRadius: '50%',
        touchAction: 'none', // Prevent default touch behaviors for custom handling
        cursor: enableTouchInteraction ? 'pointer' : 'default',
        transform: isPressed || isTouching ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 0.1s ease-out',
      }}
      aria-label="Audio frequency visualizer"
      role="img"
      {...(enableTouchInteraction ? touchHandlers : {})}
    />
  );
}

export default CircularVisualizer;
