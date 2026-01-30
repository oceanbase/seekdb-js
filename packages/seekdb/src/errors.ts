/**
 * Base error class for seekdb errors
 */
export class SeekdbError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Connection errors - network or connection-related issues
 */
export class SeekdbConnectionError extends SeekdbError {}

/**
 * Server errors - 5xx status codes
 */
export class SeekdbServerError extends SeekdbError {}

/**
 * Client errors - 4xx status codes (generic)
 */
export class SeekdbClientError extends SeekdbError {}

/**
 * Unauthorized errors - 401 status code
 */
export class SeekdbUnauthorizedError extends SeekdbError {}

/**
 * Forbidden errors - 403 status code
 */
export class SeekdbForbiddenError extends SeekdbError {}

/**
 * Not found errors - 404 status code
 */
export class SeekdbNotFoundError extends SeekdbError {}

/**
 * Value errors - invalid parameter values
 */
export class SeekdbValueError extends SeekdbError {}

/**
 * Invalid collection errors
 */
export class InvalidCollectionError extends SeekdbError {}

/**
 * Invalid argument errors
 */
export class InvalidArgumentError extends SeekdbError {}
