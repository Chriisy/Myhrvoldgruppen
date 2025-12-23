import { TRPCError } from '@trpc/server';

// Custom error codes
export const ERROR_CODES = {
  // Authentication
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  NOT_APPROVED: 'NOT_APPROVED',

  // Authorization
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Business logic
  CLAIM_ALREADY_CLOSED: 'CLAIM_ALREADY_CLOSED',
  VISIT_ALREADY_COMPLETED: 'VISIT_ALREADY_COMPLETED',
  AGREEMENT_EXPIRED: 'AGREEMENT_EXPIRED',
  EQUIPMENT_NOT_AVAILABLE: 'EQUIPMENT_NOT_AVAILABLE',

  // External services
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  PDF_GENERATION_FAILED: 'PDF_GENERATION_FAILED',

  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Norwegian error messages
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_CREDENTIALS: 'Ugyldig e-post eller passord',
  SESSION_EXPIRED: 'Okten har utlopt. Vennligst logg inn pa nytt',
  ACCOUNT_DISABLED: 'Kontoen er deaktivert. Kontakt administrator',
  NOT_APPROVED: 'Kontoen er ikke godkjent. Vent pa godkjenning fra leder',
  FORBIDDEN: 'Du har ikke tilgang til denne ressursen',
  INSUFFICIENT_PERMISSIONS: 'Du har ikke tilstrekkelige rettigheter for denne operasjonen',
  NOT_FOUND: 'Ressursen ble ikke funnet',
  ALREADY_EXISTS: 'Ressursen finnes allerede',
  CONFLICT: 'Konflikt - ressursen har blitt endret av en annen bruker',
  VALIDATION_ERROR: 'Valideringsfeil i innsendte data',
  INVALID_INPUT: 'Ugyldig inndata',
  CLAIM_ALREADY_CLOSED: 'Reklamasjonen er allerede lukket',
  VISIT_ALREADY_COMPLETED: 'Besoket er allerede fullfort',
  AGREEMENT_EXPIRED: 'Avtalen har utlopt',
  EQUIPMENT_NOT_AVAILABLE: 'Utstyret er ikke tilgjengelig',
  EMAIL_SEND_FAILED: 'Kunne ikke sende e-post',
  PDF_GENERATION_FAILED: 'Kunne ikke generere PDF',
  INTERNAL_ERROR: 'En intern feil oppstod',
  DATABASE_ERROR: 'Databasefeil oppstod',
};

interface AppErrorOptions {
  code: ErrorCode;
  message?: string;
  cause?: unknown;
  meta?: Record<string, unknown>;
}

/**
 * Application error class that maps to tRPC errors
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly meta?: Record<string, unknown>;

  constructor(options: AppErrorOptions) {
    const message = options.message || ERROR_MESSAGES[options.code] || 'Ukjent feil';
    super(message);
    this.name = 'AppError';
    this.code = options.code;
    this.meta = options.meta;
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  /**
   * Convert to tRPC error
   */
  toTRPCError(): TRPCError {
    const trpcCode = this.getTRPCCode();
    return new TRPCError({
      code: trpcCode,
      message: this.message,
      cause: this.cause,
    });
  }

  private getTRPCCode(): TRPCError['code'] {
    switch (this.code) {
      case 'INVALID_CREDENTIALS':
      case 'SESSION_EXPIRED':
      case 'ACCOUNT_DISABLED':
      case 'NOT_APPROVED':
        return 'UNAUTHORIZED';
      case 'FORBIDDEN':
      case 'INSUFFICIENT_PERMISSIONS':
        return 'FORBIDDEN';
      case 'NOT_FOUND':
        return 'NOT_FOUND';
      case 'ALREADY_EXISTS':
      case 'CONFLICT':
        return 'CONFLICT';
      case 'VALIDATION_ERROR':
      case 'INVALID_INPUT':
        return 'BAD_REQUEST';
      case 'CLAIM_ALREADY_CLOSED':
      case 'VISIT_ALREADY_COMPLETED':
      case 'AGREEMENT_EXPIRED':
      case 'EQUIPMENT_NOT_AVAILABLE':
        return 'PRECONDITION_FAILED';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}

/**
 * Helper functions for common errors
 */
export function notFound(resource: string = 'Ressurs'): AppError {
  return new AppError({
    code: 'NOT_FOUND',
    message: `${resource} ble ikke funnet`,
  });
}

export function forbidden(message?: string): AppError {
  return new AppError({
    code: 'FORBIDDEN',
    message,
  });
}

export function unauthorized(code: ErrorCode = 'SESSION_EXPIRED'): AppError {
  return new AppError({ code });
}

export function validationError(message: string): AppError {
  return new AppError({
    code: 'VALIDATION_ERROR',
    message,
  });
}

export function conflict(message: string): AppError {
  return new AppError({
    code: 'CONFLICT',
    message,
  });
}

export function internalError(cause?: unknown): AppError {
  return new AppError({
    code: 'INTERNAL_ERROR',
    cause,
  });
}

/**
 * Wrap async functions to catch and convert errors
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: unknown) => AppError
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) {
      throw error.toTRPCError();
    }
    if (error instanceof TRPCError) {
      throw error;
    }
    if (errorHandler) {
      throw errorHandler(error).toTRPCError();
    }
    throw internalError(error).toTRPCError();
  }
}

/**
 * Assert condition or throw error
 */
export function assert(
  condition: boolean,
  error: AppError | string
): asserts condition {
  if (!condition) {
    if (typeof error === 'string') {
      throw validationError(error).toTRPCError();
    }
    throw error.toTRPCError();
  }
}

/**
 * Assert resource exists or throw NotFound
 */
export function assertExists<T>(
  value: T | null | undefined,
  resource: string = 'Ressurs'
): asserts value is T {
  if (value === null || value === undefined) {
    throw notFound(resource).toTRPCError();
  }
}
