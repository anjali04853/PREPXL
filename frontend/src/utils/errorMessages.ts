/**
 * Error Messages and Recovery Guidance
 * 
 * Requirements: 9.4, 9.5
 * - Create error message mapping for all error types
 * - Display user-friendly error messages
 * - Provide actionable recovery guidance
 */

/**
 * All possible error types in the application
 */
export enum ErrorType {
  // Microphone errors
  MICROPHONE_PERMISSION_DENIED = 'MICROPHONE_PERMISSION_DENIED',
  MICROPHONE_NOT_FOUND = 'MICROPHONE_NOT_FOUND',
  MICROPHONE_DISCONNECTED = 'MICROPHONE_DISCONNECTED',
  MICROPHONE_IN_USE = 'MICROPHONE_IN_USE',
  
  // Audio context errors
  AUDIO_CONTEXT_SUSPENDED = 'AUDIO_CONTEXT_SUSPENDED',
  AUDIO_CONTEXT_FAILED = 'AUDIO_CONTEXT_FAILED',
  
  // WebSocket errors
  WEBSOCKET_CONNECTION_FAILED = 'WEBSOCKET_CONNECTION_FAILED',
  WEBSOCKET_DISCONNECTED = 'WEBSOCKET_DISCONNECTED',
  WEBSOCKET_SEND_FAILED = 'WEBSOCKET_SEND_FAILED',
  WEBSOCKET_PARSE_ERROR = 'WEBSOCKET_PARSE_ERROR',
  
  // Backend/API errors
  GEMINI_API_RATE_LIMIT = 'GEMINI_API_RATE_LIMIT',
  GEMINI_API_TIMEOUT = 'GEMINI_API_TIMEOUT',
  GEMINI_API_ERROR = 'GEMINI_API_ERROR',
  GEMINI_API_UNAVAILABLE = 'GEMINI_API_UNAVAILABLE',
  
  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // Audio format errors
  INVALID_AUDIO_FORMAT = 'INVALID_AUDIO_FORMAT',
  AUDIO_ENCODING_FAILED = 'AUDIO_ENCODING_FAILED',
  
  // Browser compatibility
  BROWSER_NOT_SUPPORTED = 'BROWSER_NOT_SUPPORTED',
  MEDIA_RECORDER_NOT_SUPPORTED = 'MEDIA_RECORDER_NOT_SUPPORTED',
  
  // Network errors
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_SLOW = 'NETWORK_SLOW',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Error message configuration
 */
export interface ErrorMessageConfig {
  /** User-friendly error message */
  message: string;
  /** Detailed description of the error */
  description: string;
  /** Recovery guidance for the user */
  recoveryGuidance: string;
  /** Severity level */
  severity: 'info' | 'warning' | 'error' | 'critical';
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Suggested action type */
  actionType: 'retry' | 'settings' | 'refresh' | 'upgrade' | 'wait' | 'none';
  /** Action button label */
  actionLabel?: string;
}

/**
 * Complete error message mapping for all error types
 * Property 14: Error Message Coverage - Every error type has a corresponding message
 */
export const ERROR_MESSAGES: Record<ErrorType, ErrorMessageConfig> = {
  // Microphone errors
  [ErrorType.MICROPHONE_PERMISSION_DENIED]: {
    message: 'Microphone access denied',
    description: 'Microphone access is required for audio transcription.',
    recoveryGuidance: 'Please allow microphone permission in your browser settings and try again.',
    severity: 'error',
    recoverable: true,
    actionType: 'settings',
    actionLabel: 'Open Settings'
  },
  
  [ErrorType.MICROPHONE_NOT_FOUND]: {
    message: 'No microphone detected',
    description: 'We couldn\'t find a microphone connected to your device.',
    recoveryGuidance: 'Please connect a microphone and click retry.',
    severity: 'error',
    recoverable: true,
    actionType: 'retry',
    actionLabel: 'Retry'
  },
  
  [ErrorType.MICROPHONE_DISCONNECTED]: {
    message: 'Microphone disconnected',
    description: 'Your microphone was disconnected during the session.',
    recoveryGuidance: 'Attempting to reconnect automatically. Please ensure your microphone is properly connected.',
    severity: 'warning',
    recoverable: true,
    actionType: 'wait'
  },
  
  [ErrorType.MICROPHONE_IN_USE]: {
    message: 'Microphone in use',
    description: 'Your microphone is being used by another application.',
    recoveryGuidance: 'Please close other applications using the microphone and try again.',
    severity: 'error',
    recoverable: true,
    actionType: 'retry',
    actionLabel: 'Retry'
  },
  
  // Audio context errors
  [ErrorType.AUDIO_CONTEXT_SUSPENDED]: {
    message: 'Audio paused by browser',
    description: 'The browser has suspended audio processing.',
    recoveryGuidance: 'Click the button below to resume audio.',
    severity: 'info',
    recoverable: true,
    actionType: 'retry',
    actionLabel: 'Resume Audio'
  },
  
  [ErrorType.AUDIO_CONTEXT_FAILED]: {
    message: 'Audio initialization failed',
    description: 'Failed to initialize the audio processing system.',
    recoveryGuidance: 'Please refresh the page and try again.',
    severity: 'error',
    recoverable: true,
    actionType: 'refresh',
    actionLabel: 'Refresh Page'
  },
  
  // WebSocket errors
  [ErrorType.WEBSOCKET_CONNECTION_FAILED]: {
    message: 'Connection failed',
    description: 'Unable to connect to the transcription server.',
    recoveryGuidance: 'Attempting to reconnect. Please check your internet connection.',
    severity: 'error',
    recoverable: true,
    actionType: 'retry',
    actionLabel: 'Reconnect'
  },
  
  [ErrorType.WEBSOCKET_DISCONNECTED]: {
    message: 'Connection lost',
    description: 'The connection to the server was interrupted.',
    recoveryGuidance: 'Reconnecting automatically. Your transcription progress is saved.',
    severity: 'warning',
    recoverable: true,
    actionType: 'wait'
  },
  
  [ErrorType.WEBSOCKET_SEND_FAILED]: {
    message: 'Failed to send audio',
    description: 'Unable to send audio data to the server.',
    recoveryGuidance: 'Please check your connection. Audio will be queued and sent when reconnected.',
    severity: 'warning',
    recoverable: true,
    actionType: 'wait'
  },
  
  [ErrorType.WEBSOCKET_PARSE_ERROR]: {
    message: 'Data error',
    description: 'Received invalid data from the server.',
    recoveryGuidance: 'This is usually temporary. If the problem persists, please refresh the page.',
    severity: 'warning',
    recoverable: true,
    actionType: 'none'
  },
  
  // Backend/API errors
  [ErrorType.GEMINI_API_RATE_LIMIT]: {
    message: 'Service busy',
    description: 'The transcription service is experiencing high demand.',
    recoveryGuidance: 'Please wait a moment. Transcription will resume automatically.',
    severity: 'warning',
    recoverable: true,
    actionType: 'wait'
  },
  
  [ErrorType.GEMINI_API_TIMEOUT]: {
    message: 'Transcription timeout',
    description: 'The transcription service took too long to respond.',
    recoveryGuidance: 'Retrying automatically. Your audio is being processed.',
    severity: 'warning',
    recoverable: true,
    actionType: 'wait'
  },
  
  [ErrorType.GEMINI_API_ERROR]: {
    message: 'Transcription service error',
    description: 'The transcription service encountered an error.',
    recoveryGuidance: 'We\'re working on it. Transcription will resume when the service recovers.',
    severity: 'error',
    recoverable: true,
    actionType: 'wait'
  },
  
  [ErrorType.GEMINI_API_UNAVAILABLE]: {
    message: 'Transcription unavailable',
    description: 'The transcription service is currently unavailable.',
    recoveryGuidance: 'Please try again later. Your recording will continue and can be transcribed when service is restored.',
    severity: 'critical',
    recoverable: false,
    actionType: 'none'
  },
  
  // Session errors
  [ErrorType.SESSION_NOT_FOUND]: {
    message: 'Session not found',
    description: 'Your transcription session could not be found.',
    recoveryGuidance: 'Please start a new recording session.',
    severity: 'error',
    recoverable: true,
    actionType: 'retry',
    actionLabel: 'Start New Session'
  },
  
  [ErrorType.SESSION_EXPIRED]: {
    message: 'Session expired',
    description: 'Your transcription session has expired due to inactivity.',
    recoveryGuidance: 'Please start a new recording session to continue.',
    severity: 'info',
    recoverable: true,
    actionType: 'retry',
    actionLabel: 'Start New Session'
  },
  
  // Audio format errors
  [ErrorType.INVALID_AUDIO_FORMAT]: {
    message: 'Audio format error',
    description: 'The audio format is not supported.',
    recoveryGuidance: 'Please ensure your microphone is working correctly and try again.',
    severity: 'error',
    recoverable: true,
    actionType: 'retry',
    actionLabel: 'Retry'
  },
  
  [ErrorType.AUDIO_ENCODING_FAILED]: {
    message: 'Audio encoding failed',
    description: 'Failed to encode audio for transmission.',
    recoveryGuidance: 'Please refresh the page and try again.',
    severity: 'error',
    recoverable: true,
    actionType: 'refresh',
    actionLabel: 'Refresh Page'
  },
  
  // Browser compatibility
  [ErrorType.BROWSER_NOT_SUPPORTED]: {
    message: 'Browser not supported',
    description: 'Your browser doesn\'t support audio recording.',
    recoveryGuidance: 'Please use a modern browser like Chrome, Firefox, Safari, or Edge.',
    severity: 'critical',
    recoverable: false,
    actionType: 'upgrade',
    actionLabel: 'Learn More'
  },
  
  [ErrorType.MEDIA_RECORDER_NOT_SUPPORTED]: {
    message: 'Recording not supported',
    description: 'Your browser doesn\'t support the required recording features.',
    recoveryGuidance: 'Please update your browser or try a different one like Chrome or Firefox.',
    severity: 'critical',
    recoverable: false,
    actionType: 'upgrade',
    actionLabel: 'Update Browser'
  },
  
  // Network errors
  [ErrorType.NETWORK_OFFLINE]: {
    message: 'No internet connection',
    description: 'You appear to be offline.',
    recoveryGuidance: 'Please check your internet connection. Recording will continue locally.',
    severity: 'error',
    recoverable: true,
    actionType: 'wait'
  },
  
  [ErrorType.NETWORK_SLOW]: {
    message: 'Slow connection',
    description: 'Your internet connection is slow.',
    recoveryGuidance: 'Transcription may be delayed. Consider moving to a better connection.',
    severity: 'warning',
    recoverable: true,
    actionType: 'none'
  },
  
  // Generic errors
  [ErrorType.UNKNOWN_ERROR]: {
    message: 'Something went wrong',
    description: 'An unexpected error occurred.',
    recoveryGuidance: 'Please try again. If the problem persists, refresh the page.',
    severity: 'error',
    recoverable: true,
    actionType: 'retry',
    actionLabel: 'Try Again'
  }
};

/**
 * Get error message configuration for an error type
 */
export function getErrorMessage(errorType: ErrorType): ErrorMessageConfig {
  return ERROR_MESSAGES[errorType] || ERROR_MESSAGES[ErrorType.UNKNOWN_ERROR];
}

/**
 * Get all error types as an array
 */
export function getAllErrorTypes(): ErrorType[] {
  return Object.values(ErrorType);
}

/**
 * Check if all error types have messages defined
 * Used for property testing
 */
export function validateErrorMessageCoverage(): { valid: boolean; missingTypes: ErrorType[] } {
  const allTypes = getAllErrorTypes();
  const missingTypes = allTypes.filter(type => {
    const config = ERROR_MESSAGES[type];
    return !config || !config.message || config.message.trim() === '';
  });
  
  return {
    valid: missingTypes.length === 0,
    missingTypes
  };
}

/**
 * Map common error codes/names to ErrorType
 */
export function mapErrorToType(error: Error | string): ErrorType {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorName = typeof error === 'string' ? '' : error.name;
  const lowerMessage = errorMessage.toLowerCase();
  
  // Microphone errors
  if (errorName === 'NotAllowedError' || lowerMessage.includes('permission denied')) {
    return ErrorType.MICROPHONE_PERMISSION_DENIED;
  }
  if (errorName === 'NotFoundError' || lowerMessage.includes('no microphone')) {
    return ErrorType.MICROPHONE_NOT_FOUND;
  }
  if (lowerMessage.includes('disconnected') && lowerMessage.includes('microphone')) {
    return ErrorType.MICROPHONE_DISCONNECTED;
  }
  if (errorName === 'NotReadableError' || lowerMessage.includes('in use')) {
    return ErrorType.MICROPHONE_IN_USE;
  }
  
  // Audio context errors
  if (lowerMessage.includes('suspended')) {
    return ErrorType.AUDIO_CONTEXT_SUSPENDED;
  }
  
  // WebSocket errors
  if (lowerMessage.includes('websocket') || lowerMessage.includes('connection')) {
    if (lowerMessage.includes('failed')) {
      return ErrorType.WEBSOCKET_CONNECTION_FAILED;
    }
    if (lowerMessage.includes('lost') || lowerMessage.includes('closed')) {
      return ErrorType.WEBSOCKET_DISCONNECTED;
    }
  }
  
  // Network errors
  if (lowerMessage.includes('offline') || lowerMessage.includes('network')) {
    return ErrorType.NETWORK_OFFLINE;
  }
  
  // Browser support
  if (lowerMessage.includes('not supported') || lowerMessage.includes('undefined')) {
    return ErrorType.BROWSER_NOT_SUPPORTED;
  }
  
  return ErrorType.UNKNOWN_ERROR;
}
