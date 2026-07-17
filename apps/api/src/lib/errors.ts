import type { ApiError, ErrorCode } from '@ludoteca/shared';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  validation_failed: 422,
  rate_limited: 429,
  upstream_unavailable: 503,
  internal_error: 500,
};

/**
 * The only error type route code should throw. Anything else that escapes a
 * handler is treated as a bug and flattened to a generic 500 by the error
 * handler — an unexpected exception must never narrate itself to a client.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields: Record<string, string> | undefined;
  /** Detail for the log only. Never serialized into the response. */
  readonly detail: string | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    options: { fields?: Record<string, string>; detail?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fields = options.fields;
    this.detail = options.detail;
  }

  toPayload(requestId?: string): ApiError {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
        ...(requestId ? { requestId } : {}),
      },
    };
  }
}

/**
 * Canonical messages. Route code reaches for these rather than inventing
 * prose, which is how we keep responses from leaking whether a login exists,
 * whether a resource is missing or merely someone else's, and so on.
 */
export const Errors = {
  /** Login/register failure. Identical text regardless of which part was wrong. */
  invalidCredentials: () => new AppError('unauthorized', 'Invalid credentials.'),
  notAuthenticated: () => new AppError('unauthorized', 'Authentication required.'),
  sessionExpired: () => new AppError('unauthorized', 'Session expired. Please sign in again.'),
  csrf: () => new AppError('forbidden', 'Request rejected.'),
  /**
   * Used for both "does not exist" and "exists but isn't yours". Returning 403
   * for the second case would confirm the id is real — an oracle we don't give.
   */
  notFound: (what = 'Resource') => new AppError('not_found', `${what} not found.`),
  forbidden: () => new AppError('forbidden', 'You do not have access to this resource.'),
  conflict: (message: string) => new AppError('conflict', message),
  badRequest: (message: string, fields?: Record<string, string>) =>
    new AppError('bad_request', message, fields ? { fields } : {}),
  lockedOut: (retryAfterSeconds: number) =>
    new AppError('rate_limited', 'Too many attempts. Try again later.', {
      detail: `locked for ${retryAfterSeconds}s`,
    }),
  upstreamUnavailable: (detail?: string) =>
    new AppError('upstream_unavailable', 'The games service is temporarily unavailable.', {
      ...(detail ? { detail } : {}),
    }),
  featureDisabled: (name: string) =>
    new AppError('not_found', 'Not found.', { detail: `feature ${name} is disabled` }),
} as const;
