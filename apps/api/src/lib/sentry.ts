import * as Sentry from '@sentry/node';
import { logger } from './logger';

let isInitialized = false;

export function initSentry() {
  if (isInitialized) return;

  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || 'unknown',

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replay (for frontend)
    integrations: [
      Sentry.httpIntegration(),
    ],

    // Filter out non-critical errors
    beforeSend(event, hint) {
      // Don't send expected errors
      const error = hint.originalException;
      if (error instanceof Error) {
        // Filter out authentication errors (expected)
        if (error.message.includes('UNAUTHORIZED') || error.message.includes('Session expired')) {
          return null;
        }
      }
      return event;
    },

    // Ignore specific errors
    ignoreErrors: [
      'ResizeObserver loop',
      'Network request failed',
      'Load failed',
    ],
  });

  isInitialized = true;
  logger.info('Sentry initialized successfully');
}

/**
 * Capture exception with context
 */
export function captureException(
  error: Error | unknown,
  context?: {
    user?: { id: string; email?: string };
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
) {
  if (!isInitialized) {
    logger.error({ error }, 'Error captured (Sentry disabled)');
    return;
  }

  Sentry.withScope((scope) => {
    if (context?.user) {
      scope.setUser({
        id: context.user.id,
        email: context.user.email,
      });
    }

    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureException(error);
  });
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string = 'app',
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, unknown>
) {
  if (!isInitialized) return;

  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}

/**
 * Set user context
 */
export function setUser(user: { id: string; email?: string; role?: string } | null) {
  if (!isInitialized) return;

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Create transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  if (!isInitialized) return null;

  return Sentry.startSpan({
    name,
    op,
  }, () => {});
}

export { Sentry };
