import { describe, it, expect } from 'vitest';
import {
  AppError,
  notFound,
  forbidden,
  validationError,
  ERROR_CODES
} from '../lib/errors';

describe('Error Utilities', () => {
  describe('AppError', () => {
    it('should create error with correct code', () => {
      const error = new AppError({ code: 'NOT_FOUND' });

      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Ressursen ble ikke funnet');
    });

    it('should use custom message if provided', () => {
      const error = new AppError({
        code: 'NOT_FOUND',
        message: 'Bruker ikke funnet'
      });

      expect(error.message).toBe('Bruker ikke funnet');
    });

    it('should convert to tRPC error', () => {
      const error = new AppError({ code: 'FORBIDDEN' });
      const trpcError = error.toTRPCError();

      expect(trpcError.code).toBe('FORBIDDEN');
    });
  });

  describe('Helper functions', () => {
    it('notFound should create NOT_FOUND error', () => {
      const error = notFound('Kunde');

      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toContain('Kunde');
    });

    it('forbidden should create FORBIDDEN error', () => {
      const error = forbidden();

      expect(error.code).toBe('FORBIDDEN');
    });

    it('validationError should create VALIDATION_ERROR', () => {
      const error = validationError('Ugyldig e-post');

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Ugyldig e-post');
    });
  });

  describe('ERROR_CODES', () => {
    it('should have all required codes', () => {
      expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
      expect(ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN');
      expect(ERROR_CODES.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
      expect(ERROR_CODES.CLAIM_ALREADY_CLOSED).toBe('CLAIM_ALREADY_CLOSED');
    });
  });
});
