/**
 * useErrorHandler - React hook for centralized error handling
 * 
 * Requirements: 9.4, 9.5
 * - Manage application errors
 * - Provide error display and recovery actions
 */

import { useState, useCallback } from 'react';
import { ErrorType, mapErrorToType, getErrorMessage } from '../utils/errorMessages';

export interface AppError {
  /** Unique identifier for the error */
  id: string;
  /** Error type */
  type: ErrorType;
  /** Timestamp when error occurred */
  timestamp: Date;
  /** Original error object if available */
  originalError: Error | undefined;
  /** Whether the error has been dismissed */
  dismissed: boolean;
}

export interface UseErrorHandlerResult {
  /** List of current errors */
  errors: AppError[];
  /** Most recent error */
  currentError: AppError | null;
  /** Add a new error */
  addError: (errorType: ErrorType, originalError?: Error) => void;
  /** Add error from an Error object (auto-maps to ErrorType) */
  handleError: (error: Error | string) => void;
  /** Dismiss an error by ID */
  dismissError: (errorId: string) => void;
  /** Dismiss all errors */
  clearErrors: () => void;
  /** Check if there are any active errors */
  hasErrors: boolean;
  /** Check if there are any critical errors */
  hasCriticalErrors: boolean;
}

let errorIdCounter = 0;

function generateErrorId(): string {
  return `error-${Date.now()}-${++errorIdCounter}`;
}

export function useErrorHandler(): UseErrorHandlerResult {
  const [errors, setErrors] = useState<AppError[]>([]);

  /**
   * Add a new error with a specific type
   */
  const addError = useCallback((errorType: ErrorType, originalError?: Error) => {
    const newError: AppError = {
      id: generateErrorId(),
      type: errorType,
      timestamp: new Date(),
      originalError,
      dismissed: false
    };

    setErrors(prev => {
      // Avoid duplicate errors of the same type within 5 seconds
      const recentSameType = prev.find(
        e => e.type === errorType && 
        !e.dismissed && 
        Date.now() - e.timestamp.getTime() < 5000
      );
      
      if (recentSameType) {
        return prev;
      }

      // Keep only the last 5 errors
      const filtered = prev.filter(e => !e.dismissed).slice(-4);
      return [...filtered, newError];
    });
  }, []);

  /**
   * Handle an error by auto-mapping it to an ErrorType
   */
  const handleError = useCallback((error: Error | string) => {
    const errorType = mapErrorToType(error);
    const originalError = error instanceof Error ? error : new Error(error);
    addError(errorType, originalError);
  }, [addError]);

  /**
   * Dismiss an error by ID
   */
  const dismissError = useCallback((errorId: string) => {
    setErrors(prev => 
      prev.map(e => 
        e.id === errorId ? { ...e, dismissed: true } : e
      )
    );
  }, []);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Get active (non-dismissed) errors
  const activeErrors = errors.filter(e => !e.dismissed);
  
  // Get the most recent active error
  const currentError: AppError | null = activeErrors.length > 0 
    ? activeErrors[activeErrors.length - 1] ?? null
    : null;

  // Check for critical errors
  const hasCriticalErrors = activeErrors.some(e => {
    const config = getErrorMessage(e.type);
    return config.severity === 'critical';
  });

  return {
    errors: activeErrors,
    currentError,
    addError,
    handleError,
    dismissError,
    clearErrors,
    hasErrors: activeErrors.length > 0,
    hasCriticalErrors
  };
}

export default useErrorHandler;
