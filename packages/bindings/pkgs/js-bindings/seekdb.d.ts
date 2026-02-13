/**
 * Type definitions for seekdb native bindings
 *
 * These types correspond to the C API types and C++ wrapper classes:
 * - Database -> SeekdbDatabase (wrapper)
 * - Connection -> SeekdbConnection (wrapper, uses SeekdbHandle from C API)
 * - Result -> SeekdbResultWrapper (wrapper, uses SeekdbResult from C API)
 *
 * C API types (from seekdb.h):
 * - SeekdbHandle - Connection handle
 * - SeekdbResult - Query result handle
 * - SeekdbRow - Row handle
 */

/**
 * Database handle - opaque type representing a seekdb database instance
 * Corresponds to SeekdbDatabase in C++ bindings
 */
export interface Database {
  // Opaque type - internal handle
}

/**
 * Connection handle - opaque type representing a database connection
 * Corresponds to SeekdbConnection in C++ bindings
 */
export interface Connection {
  // Opaque type - internal handle
}

/**
 * Query result - contains rows and column information
 * Corresponds to SeekdbResultWrapper in C++ bindings
 */
export interface Result {
  /** Array of rows, where each row is an array of values */
  rows: any[][];
  /** Array of column names */
  columns: string[];
}

/**
 * Open a seekdb database
 * @param db_dir - Database directory path (optional, defaults to current directory)
 * @returns Database handle
 * @throws Error if database cannot be opened
 */
export function open(db_dir?: string): Database;

/**
 * Close a seekdb database synchronously
 * @param database - Database handle returned from open()
 */
export function close_sync(database: Database): void;

/**
 * Create a connection to a database
 * @param database - Database handle returned from open()
 * @param database_name - Name of the database to connect to
 * @param autocommit - Whether to enable autocommit mode
 * @returns Connection handle
 * @throws Error if connection cannot be established
 */
export function connect(
  database: Database,
  database_name: string,
  autocommit: boolean
): Connection;

/**
 * Disconnect from a database
 * @param connection - Connection handle returned from connect()
 */
export function disconnect(connection: Connection): void;

/**
 * Execute a SQL query asynchronously
 * @param connection - Connection handle returned from connect()
 * @param sql - SQL query string (may contain ? placeholders for parameters)
 * @param params - Optional array of parameters to replace ? placeholders
 * @returns Promise that resolves with query results
 * @throws Error if query execution fails
 * @note Column name inference is handled automatically by C ABI layer
 */
export function execute(
  connection: Connection,
  sql: string,
  params?: any[]
): Promise<Result>;
