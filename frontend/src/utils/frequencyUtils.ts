/**
 * Frequency Data Processing Utilities
 * 
 * Requirements: 2.2, 2.3, 2.4
 * - Extract frequency data from AnalyserNode (getByteFrequencyData)
 * - Normalize values to 0-1 range
 * - Map frequency bands to radial positions (low=inner, high=outer)
 */

/**
 * Normalize raw frequency data (0-255) to 0-1 range
 * 
 * Property 1: Frequency Data Normalization
 * For any raw frequency data array, the normalized output values 
 * SHALL all be within the range [0, 1].
 * 
 * @param rawData - Raw frequency data from AnalyserNode (Uint8Array with values 0-255)
 * @returns Float32Array with normalized values in range [0, 1]
 */
export function normalizeFrequencyData(rawData: Uint8Array): Float32Array {
  const normalized = new Float32Array(rawData.length);
  
  for (let i = 0; i < rawData.length; i++) {
    const value = rawData[i];
    // Clamp and normalize to 0-1 range
    // Raw values are 0-255 from getByteFrequencyData
    normalized[i] = Math.max(0, Math.min(1, (value ?? 0) / 255));
  }
  
  return normalized;
}

/**
 * Map a frequency band index to a radius value
 * 
 * Property 2: Frequency-to-Radius Mapping Monotonicity
 * For any two frequency band indices where index_a < index_b, 
 * the mapped radius for index_a SHALL be less than or equal to 
 * the mapped radius for index_b.
 * 
 * @param frequencyIndex - Index of the frequency band (0 to totalBands-1)
 * @param totalBands - Total number of frequency bands
 * @param innerRadius - Inner radius (for lowest frequency)
 * @param outerRadius - Outer radius (for highest frequency)
 * @returns Mapped radius value between innerRadius and outerRadius
 */
export function mapFrequencyToRadius(
  frequencyIndex: number,
  totalBands: number,
  innerRadius: number,
  outerRadius: number
): number {
  // Validate inputs
  if (totalBands <= 0) {
    return innerRadius;
  }
  
  // Clamp index to valid range
  const clampedIndex = Math.max(0, Math.min(frequencyIndex, totalBands - 1));
  
  // Linear interpolation from inner to outer radius
  // Low frequencies (index 0) -> innerRadius
  // High frequencies (index totalBands-1) -> outerRadius
  const t = totalBands === 1 ? 0 : clampedIndex / (totalBands - 1);
  
  return innerRadius + t * (outerRadius - innerRadius);
}

/**
 * Sample frequency data to a specific number of bars
 * Averages frequency bins to reduce data to desired bar count
 * 
 * @param frequencyData - Full frequency data array
 * @param barCount - Desired number of bars (64-128 typical)
 * @returns Sampled and averaged frequency data
 */
export function sampleFrequencyData(
  frequencyData: Uint8Array,
  barCount: number
): Float32Array {
  const sampled = new Float32Array(barCount);
  const binSize = Math.floor(frequencyData.length / barCount);
  
  if (binSize === 0) {
    // More bars than data points - just copy what we have
    for (let i = 0; i < Math.min(barCount, frequencyData.length); i++) {
      sampled[i] = (frequencyData[i] ?? 0) / 255;
    }
    return sampled;
  }
  
  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    const startIndex = i * binSize;
    
    for (let j = 0; j < binSize; j++) {
      const dataIndex = startIndex + j;
      if (dataIndex < frequencyData.length) {
        sum += frequencyData[dataIndex] ?? 0;
      }
    }
    
    // Normalize to 0-1 range
    sampled[i] = sum / binSize / 255;
  }
  
  return sampled;
}

/**
 * Convert decibel value to normalized height
 * 
 * Property 4: Decibel-to-Height Scaling
 * For any decibel value within the configured range [minDecibels, maxDecibels],
 * the scaled bar height SHALL be proportional to the dB value's position 
 * within that range, producing values in [0, maxBarHeight].
 * 
 * @param decibelValue - Decibel value to convert
 * @param minDecibels - Minimum decibel threshold (e.g., -90)
 * @param maxDecibels - Maximum decibel threshold (e.g., -10)
 * @param maxHeight - Maximum output height
 * @returns Scaled height value in range [0, maxHeight]
 */
export function decibelToHeight(
  decibelValue: number,
  minDecibels: number,
  maxDecibels: number,
  maxHeight: number
): number {
  // Clamp decibel value to valid range
  const clampedDb = Math.max(minDecibels, Math.min(maxDecibels, decibelValue));
  
  // Calculate position within range (0 to 1)
  const range = maxDecibels - minDecibels;
  if (range === 0) {
    return 0;
  }
  
  const normalizedPosition = (clampedDb - minDecibels) / range;
  
  // Scale to max height
  return normalizedPosition * maxHeight;
}

/**
 * Convert raw byte value (0-255) to approximate decibel value
 * Based on AnalyserNode's internal scaling
 * 
 * @param byteValue - Raw byte value from getByteFrequencyData (0-255)
 * @param minDecibels - AnalyserNode's minDecibels setting
 * @param maxDecibels - AnalyserNode's maxDecibels setting
 * @returns Approximate decibel value
 */
export function byteToDecibel(
  byteValue: number,
  minDecibels: number,
  maxDecibels: number
): number {
  // getByteFrequencyData scales dB values to 0-255 range
  // 0 = minDecibels, 255 = maxDecibels
  const normalizedByte = Math.max(0, Math.min(255, byteValue)) / 255;
  return minDecibels + normalizedByte * (maxDecibels - minDecibels);
}

/**
 * Apply exponential smoothing to frequency data
 * 
 * Property 3: Animation Smoothing (Damping)
 * For any sequence of raw frequency values, the smoothed/damped output values 
 * SHALL change by no more than the smoothing factor multiplied by the difference 
 * between current and target values per frame.
 * 
 * @param currentValues - Current smoothed values
 * @param targetValues - Target values to smooth towards
 * @param smoothingFactor - Smoothing factor (0.1-0.3 typical)
 * @returns New smoothed values
 */
export function applySmoothing(
  currentValues: Float32Array,
  targetValues: Float32Array,
  smoothingFactor: number
): Float32Array {
  const result = new Float32Array(currentValues.length);
  const clampedFactor = Math.max(0, Math.min(1, smoothingFactor));
  
  for (let i = 0; i < currentValues.length; i++) {
    const current = currentValues[i] ?? 0;
    const target = targetValues[i] ?? 0;
    const difference = target - current;
    
    // Apply smoothing: new = current + (target - current) * factor
    result[i] = current + difference * clampedFactor;
  }
  
  return result;
}

/**
 * Calculate the maximum change allowed by smoothing
 * Used for property testing
 * 
 * @param currentValue - Current smoothed value
 * @param targetValue - Target value
 * @param smoothingFactor - Smoothing factor
 * @returns Maximum allowed change
 */
export function calculateMaxSmoothingChange(
  currentValue: number,
  targetValue: number,
  smoothingFactor: number
): number {
  return Math.abs(targetValue - currentValue) * smoothingFactor;
}
