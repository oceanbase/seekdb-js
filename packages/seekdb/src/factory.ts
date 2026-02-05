/**
 * Factory functions for creating seekdb clients
 * Automatically selects embedded or remote server mode based on parameters
 */

import { SeekdbClient } from "./client.js";
import { SeekdbAdminClient } from "./client-admin.js";
import type { SeekdbClientArgs, SeekdbAdminClientArgs } from "./types.js";
import {
  DEFAULT_TENANT,
  DEFAULT_DATABASE,
  DEFAULT_PORT,
  DEFAULT_USER,
} from "./utils.js";
import * as path from "node:path";

/**
 * Resolve password from environment variable if not provided
 */
function _resolvePassword(password?: string): string {
  return password ?? process.env.SEEKDB_PASSWORD ?? "";
}

/**
 * Get default seekdb path (current working directory)
 */
function _defaultSeekdbPath(): string {
  return path.resolve(process.cwd(), "seekdb.db");
}

/**
 * Create server client (embedded or remote)
 * This is the single change point for client creation
 */
function _createServerClient(
  args: SeekdbClientArgs,
  isAdmin: boolean = false
): SeekdbClient {
  const { path: dbPath, host, port, tenant, database, user, password } = args;

  // Embedded mode: if path is provided
  if (dbPath !== undefined) {
    return new SeekdbClient({
      path: dbPath,
      database: database ?? DEFAULT_DATABASE,
    });
  }

  // Remote server mode: if host is provided
  if (host !== undefined) {
    const finalPort = port ?? DEFAULT_PORT;
    const finalUser = user ?? DEFAULT_USER;
    const finalPassword = _resolvePassword(password);
    const finalTenant = tenant ?? DEFAULT_TENANT;

    // For remote server mode, we need to ensure host is provided
    return new SeekdbClient({
      host,
      port: finalPort,
      tenant: finalTenant,
      database: database ?? DEFAULT_DATABASE,
      user: finalUser,
      password: finalPassword,
      charset: args.charset,
    });
  }

  // Default behavior: try embedded mode if available
  // Note: This will throw an error if native addon is not available
  const defaultPath = _defaultSeekdbPath();

  try {
    return new SeekdbClient({
      path: defaultPath,
      database: database ?? DEFAULT_DATABASE,
    });
  } catch (error) {
    throw new Error(
      "Default embedded mode is not available because native addon could not be loaded. " +
        "Please provide host/port parameters to use RemoteServerClient, or provide path parameter for embedded mode."
    );
  }
}

/**
 * Smart client factory function
 *
 * Automatically selects embedded or remote server mode based on parameters:
 * - If path is provided, uses embedded mode
 * - If host/port is provided, uses remote server mode
 * - If neither path nor host is provided, defaults to embedded mode (if available)
 *
 * @param args - Client configuration arguments
 * @returns SeekdbClient instance (supports both embedded and server modes)
 *
 * @example
 * ```typescript
 * // Embedded mode with no args (default path: cwd/seekdb.db, default database)
 * const client = SeekdbClient();
 *
 * // Embedded mode with explicit path
 * const client = SeekdbClient({ path: "/path/to/seekdb", database: "db1" });
 *
 * // Embedded mode (default path: current working directory)
 * const client = SeekdbClient({ database: "db1" });
 *
 * // Remote server mode
 * const client = Client({
 *   host: "localhost",
 *   port: 2881,
 *   tenant: "sys",
 *   database: "db1",
 *   user: "root",
 *   password: "pass"
 * });
 * ```
 */
export function Client(args: SeekdbClientArgs = {}): SeekdbClient {
  return _createServerClient(args, false);
}

/**
 * Smart admin client factory function
 *
 * Always returns SeekdbClient (same entry type as Client()). Uses database "information_schema"
 * for admin operations (createDatabase, listDatabases, getDatabase, deleteDatabase).
 *
 * - If path is provided, uses embedded mode
 * - If host/port is provided, uses remote server mode
 *
 * @param args - Admin client configuration arguments
 * @returns SeekdbClient instance (connected to information_schema for admin use)
 *
 * @example
 * ```typescript
 * // Embedded mode
 * const admin = AdminClient({ path: "/path/to/seekdb" });
 *
 * // Remote server mode
 * const admin = AdminClient({
 *   host: "localhost",
 *   port: 2881,
 *   tenant: "sys",
 *   user: "root",
 *   password: "pass"
 * });
 * ```
 */
export function AdminClient(args: SeekdbAdminClientArgs = {}): SeekdbClient {
  // Embedded: admin database is built-in in SeekdbEmbeddedClient; no need to specify.
  // Server: connect to information_schema for admin operations.
  const clientArgs: SeekdbClientArgs =
    args.host !== undefined
      ? { ...args, database: "information_schema" }
      : { ...args };
  return _createServerClient(clientArgs, true);
}
