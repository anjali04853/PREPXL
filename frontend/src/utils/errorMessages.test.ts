/**
 * Property-based tests for error messages
 * 
 * Feature: realtime-audio-transcription
 * Property 14: Error Message Coverage
 * 
 * Uses fast-check for property-based testing
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ErrorType,
  ERROR_MESSAGES,
  getErrorMessage,
  getAllErrorTypes,
  validateErrorMessageCoverage,
  mapErrorToType,
  ErrorMessageConfig
} from './errorMessages';

describe('Error Messages Property Tests', () => {
  /**
   * Property 14: Error Message Coverage
   * 
   * For any error state in the defined error types enum, 
   * a corresponding user-friendly error message SHALL exist and be non-empty.
   * 
   * **Validates: Requirements 9.4**
   */
  describe('Property 14: Error Message Coverage', () => {
    it('should have a non-empty message for every error type', () => {
      // Get all error types
      const allErrorTypes = getAllErrorTypes();
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allErrorTypes),
          (errorType: ErrorType) => {
            const config = getErrorMessage(errorType);
            
            // Message must exist and be non-empty
            expect(config).toBeDefined();
            expect(config.message).toBeDefined();
            expect(typeof config.message).toBe('string');
            expect(config.message.trim().length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have a non-empty description for every error type', () => {
      const allErrorTypes = getAllErrorTypes();
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allErrorTypes),
          (errorType: ErrorType) => {
            const config = getErrorMessage(errorType);
            
            // Description must exist and be non-empty
            expect(config.description).toBeDefined();
            expect(typeof config.description).toBe('string');
            expect(config.description.trim().length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have non-empty recovery guidance for every error type', () => {
      const allErrorTypes = getAllErrorTypes();
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allErrorTypes),
          (errorType: ErrorType) => {
            const config = getErrorMessage(errorType);
            
            // Recovery guidance must exist and be non-empty
            expect(config.recoveryGuidance).toBeDefined();
            expect(typeof config.recoveryGuidance).toBe('string');
            expect(config.recoveryGuidance.trim().length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid severity for every error type', () => {
      const validSeverities: ErrorMessageConfig['severity'][] = ['info', 'warning', 'error', 'critical'];
      const allErrorTypes = getAllErrorTypes();
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allErrorTypes),
          (errorType: ErrorType) => {
            const config = getErrorMessage(errorType);
            
            // Severity must be one of the valid values
            expect(validSeverities).toContain(config.severity);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have valid action type for every error type', () => {
      const validActionTypes: ErrorMessageConfig['actionType'][] = [
        'retry', 'settings', 'refresh', 'upgrade', 'wait', 'none'
      ];
      const allErrorTypes = getAllErrorTypes();
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allErrorTypes),
          (errorType: ErrorType) => {
            const config = getErrorMessage(errorType);
            
            // Action type must be one of the valid values
            expect(validActionTypes).toContain(config.actionType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have boolean recoverable flag for every error type', () => {
      const allErrorTypes = getAllErrorTypes();
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allErrorTypes),
          (errorType: ErrorType) => {
            const config = getErrorMessage(errorType);
            
            // Recoverable must be a boolean
            expect(typeof config.recoverable).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have action label when action type requires user action', () => {
      const actionTypesRequiringLabel: ErrorMessageConfig['actionType'][] = [
        'retry', 'settings', 'refresh', 'upgrade'
      ];
      const allErrorTypes = getAllErrorTypes();
      
      fc.assert(
        fc.property(
          fc.constantFrom(...allErrorTypes),
          (errorType: ErrorType) => {
            const config = getErrorMessage(errorType);
            
            // If action type requires user action, label should exist
            if (actionTypesRequiringLabel.includes(config.actionType)) {
              expect(config.actionLabel).toBeDefined();
              expect(typeof config.actionLabel).toBe('string');
              expect(config.actionLabel!.trim().length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass validation for complete error message coverage', () => {
      const result = validateErrorMessageCoverage();
      
      expect(result.valid).toBe(true);
      expect(result.missingTypes).toHaveLength(0);
    });

    it('should have exactly one message config per error type (no duplicates)', () => {
      const allErrorTypes = getAllErrorTypes();
      const uniqueTypes = new Set(allErrorTypes);
      
      // All error types should be unique
      expect(uniqueTypes.size).toBe(allErrorTypes.length);
      
      // Each type should have exactly one entry in ERROR_MESSAGES
      for (const errorType of allErrorTypes) {
        expect(ERROR_MESSAGES[errorType]).toBeDefined();
      }
    });
  });

  describe('Error Type Mapping', () => {
    it('should always return a valid ErrorType for any error', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          (errorMessage: string) => {
            const errorType = mapErrorToType(errorMessage);
            
            // Result should be a valid ErrorType
            const allTypes = getAllErrorTypes();
            expect(allTypes).toContain(errorType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return UNKNOWN_ERROR for unrecognized errors', () => {
      fc.assert(
        fc.property(
          // Generate random strings that don't match any known patterns
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
            !s.toLowerCase().includes('permission') &&
            !s.toLowerCase().includes('microphone') &&
            !s.toLowerCase().includes('websocket') &&
            !s.toLowerCase().includes('connection') &&
            !s.toLowerCase().includes('network') &&
            !s.toLowerCase().includes('offline') &&
            !s.toLowerCase().includes('suspended') &&
            !s.toLowerCase().includes('not supported')
          ),
          (randomMessage: string) => {
            const errorType = mapErrorToType(randomMessage);
            
            // Unrecognized errors should map to UNKNOWN_ERROR
            expect(errorType).toBe(ErrorType.UNKNOWN_ERROR);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly map permission denied errors', () => {
      const permissionDeniedMessages = [
        'NotAllowedError: Permission denied',
        'permission denied by user',
        'Permission denied for microphone'
      ];
      
      for (const message of permissionDeniedMessages) {
        const error = new Error(message);
        error.name = message.includes('NotAllowedError') ? 'NotAllowedError' : 'Error';
        const errorType = mapErrorToType(error);
        expect(errorType).toBe(ErrorType.MICROPHONE_PERMISSION_DENIED);
      }
    });

    it('should correctly map microphone not found errors', () => {
      const notFoundMessages = [
        'NotFoundError: No microphone found',
        'no microphone detected'
      ];
      
      for (const message of notFoundMessages) {
        const error = new Error(message);
        error.name = message.includes('NotFoundError') ? 'NotFoundError' : 'Error';
        const errorType = mapErrorToType(error);
        expect(errorType).toBe(ErrorType.MICROPHONE_NOT_FOUND);
      }
    });
  });
});
