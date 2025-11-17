/**
 * Base error class for SeekDB errors
 */
export class SeekDBError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
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
export class SeekDBConnectionError extends SeekDBError {}

/**
 * Server errors - 5xx status codes
 */
export class SeekDBServerError extends SeekDBError {}

/**
 * Client errors - 4xx status codes (generic)
 */
export class SeekDBClientError extends SeekDBError {}

/**
 * Unauthorized errors - 401 status code
 */
export class SeekDBUnauthorizedError extends SeekDBError {}

/**
 * Forbidden errors - 403 status code
 */
export class SeekDBForbiddenError extends SeekDBError {}

/**
 * Not found errors - 404 status code
 */
export class SeekDBNotFoundError extends SeekDBError {}

/**
 * Value errors - invalid parameter values
 */
export class SeekDBValueError extends SeekDBError {}

/**
 * Invalid collection errors
 */
export class InvalidCollectionError extends SeekDBError {}

/**
 * Invalid argument errors
 */
export class InvalidArgumentError extends SeekDBError {}
