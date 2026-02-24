/**
 * Internal client for embedded mode (same interface as InternalClient, uses native addon).
 * Addon is loaded on first use; may trigger on-demand download via js-bindings.
 */
import type { RowDataPacket } from "mysql2/promise";
import type { IInternalClient } from "./types.js";
import type { Database, Connection } from "@seekdb/js-bindings";
import type { NativeBindings } from "./native-addon-loader.js";
import { getNativeAddon } from "./native-addon-loader.js";

const _dbCache = new Map<string, Database>();

export class InternalEmbeddedClient implements IInternalClient {
  private readonly path: string;
  private readonly database: string;
  private _db: Database | null = null;
  private _connection: Connection | null = null;
  private _initialized = false;
  private _addon: NativeBindings | null = null;

  constructor(args: { path: string; database: string }) {
    this.path = args.path;
    this.database = args.database;
  }

  /** Ensure connection; loads addon on first use (may download via js-bindings). Reuses Database by path. */
  private async _ensureConnection(): Promise<Connection> {
    if (!this._addon) this._addon = await getNativeAddon();

    if (!this._initialized) {
      let db = _dbCache.get(this.path);
      if (db === undefined) {
        try {
          db = this._addon.open(this.path);
          _dbCache.set(this.path, db);
        } catch (error: unknown) {
          const err = error as { message?: string };
          if (!err.message?.includes("initialized twice")) {
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
      this._connection = this._addon.connect(this._db, this.database, true);
      // Auto-set session defaults so 100KB+ documents work without user config (align with server behavior).
      try {
        await this._addon.execute(
          this._connection,
          "SET SESSION ob_default_lob_inrow_threshold = 262144",
          undefined
        );
        await this._addon.execute(
          this._connection,
          "SET SESSION max_allowed_packet = 2097152",
          undefined
        );
      } catch {
        // Ignore if backend does not support these (e.g. older version); 100KB may still work with table default.
      }
    }

    return this._connection;
  }

  isConnected(): boolean {
    return this._connection !== null && this._initialized;
  }

  async execute(
    sql: string,
    params?: unknown[]
  ): Promise<RowDataPacket[] | null> {
    const conn = await this._ensureConnection();
    const addon = this._addon!;
    const result = await addon.execute(conn, sql, params);

    if (!result || !result.rows) {
      return null;
    }

    const columns = result.columns || [];
    const rows: RowDataPacket[] = [];
    for (const row of result.rows) {
      const rowObj: RowDataPacket = {} as RowDataPacket;
      for (let i = 0; i < columns.length && i < row.length; i++)
        rowObj[columns[i]] = row[i];
      rows.push(rowObj);
    }
    return rows;
  }

  async close(): Promise<void> {
    // No-op (embedded DB is process-local; close_sync would block event loop)
  }
}
