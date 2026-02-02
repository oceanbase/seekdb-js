/**
 * Internal client for embedded mode
 * Implements the same interface as InternalClient but uses native addon
 */

import type { RowDataPacket } from "mysql2/promise"; // For compatibility with IInternalClient
import type { IInternalClient } from "./types.js";
import type { Database, Connection, Result } from "@seekdb/js-bindings";
import type * as Bindings from "@seekdb/js-bindings";
// Note: Data normalization is handled in Collection class for consistency between modes

let _nativeAddon: typeof Bindings | null = null;

try {
  _nativeAddon = require("@seekdb/js-bindings") as typeof Bindings;
} catch {
  // Native addon not available
}

/** Cache Database handle by path so multiple connections (e.g. default db + information_schema + user-created db) share the same instance. */
const _dbCache = new Map<string, Database>();

export class InternalEmbeddedClient implements IInternalClient {
  private readonly path: string;
  private readonly database: string;
  private _db: Database | null = null;
  private _connection: Connection | null = null;
  private _initialized = false;

  constructor(args: { path: string; database: string }) {
    this.path = args.path;
    this.database = args.database;

    if (!_nativeAddon) {
      throw new Error(
        "InternalEmbeddedClient requires native addon. " +
        "Please install @seekdb/js-bindings or use remote server mode."
      );
    }
  }

  /**
   * Ensure connection is established.
   * Reuses the same Database handle for the same path so createDatabase/listDatabases and per-database connections see the same instance.
   */
  private async _ensureConnection(): Promise<Connection> {
    if (!_nativeAddon) {
      throw new Error("Native addon is not available");
    }

    if (!this._initialized) {
      let db = _dbCache.get(this.path);
      if (db === undefined) {
        try {
          db = _nativeAddon.open(this.path);
          _dbCache.set(this.path, db);
        } catch (error: any) {
          if (!error.message || !error.message.includes("initialized twice")) {
            throw error;
          }
          db = _dbCache.get(this.path);
        }
      }
      this._db = db ?? null;
      this._initialized = true;
    }

    if (this._connection === null) {
      if (!this._db) {
        throw new Error("Database not initialized");
      }
      this._connection = _nativeAddon.connect(this._db, this.database, true);
      // Auto-set session defaults so 100KB+ documents work without user config (align with server behavior).
      try {
        await _nativeAddon.execute(this._connection, "SET SESSION ob_default_lob_inrow_threshold = 262144", undefined);
        await _nativeAddon.execute(this._connection, "SET SESSION max_allowed_packet = 2097152", undefined);
      } catch (_) {
        // Ignore if backend does not support these (e.g. older version); 100KB may still work with table default.
      }
    }

    return this._connection;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._connection !== null && this._initialized;
  }

  /**
   * Execute SQL query
   * Parameters and column name inference are handled in C ABI layer via bindings
   */
  async execute(
    sql: string,
    params?: unknown[],
  ): Promise<RowDataPacket[] | null> {
    if (!_nativeAddon) {
      throw new Error("Native addon is not available");
    }

    const conn = await this._ensureConnection();
    // C ABI layer handles parameter binding and column name inference
    const result = await _nativeAddon.execute(conn, sql, params);

    if (!result || !result.rows) {
      return null;
    }

    // Convert result to RowDataPacket format
    const columns = result.columns || [];
    const rows: RowDataPacket[] = [];

    for (const row of result.rows) {
      const rowObj: RowDataPacket = {} as RowDataPacket;
      for (let i = 0; i < columns.length && i < row.length; i++) {
        // Return raw values - normalization will be done in Collection class
        // This ensures consistent behavior between embedded and server modes
        rowObj[columns[i]] = row[i];
      }
      rows.push(rowObj);
    }

    return rows;
  }

  /**
   * Close connection.
   * Embedded mode: no-op. Reasons:
   * 1. DB is process-local and does not require manual close (unlike server mode TCP).
   * 2. close_sync() → seekdb_close() runs synchronously on the main thread; C library
   *    may block (fsync, locks, waiting for background threads), which would block the
   *    Node event loop. Avoiding close_sync prevents test/process hang.
   */
  async close(): Promise<void> {
    // No-op for embedded mode
  }
}
