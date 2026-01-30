import { SeekdbValueError } from "./errors.js";
import { DEFAULT_TENANT } from "./utils.js";
import type { SeekdbAdminClientArgs } from "./types.js";
import { Database } from "./database.js";
import { InternalClient } from "./internal-client.js";

export class SeekdbAdminClient {
  private _internal: InternalClient;
  private readonly tenant: string;

  constructor(args: SeekdbAdminClientArgs) {
    this.tenant = args.tenant ?? DEFAULT_TENANT;
    // Initialize connection manager (no database specified for admin client)
    // Admin client requires host for remote server mode
    if (!args.host) {
      throw new Error(
        "SeekdbAdminClient requires host parameter for remote server mode. " +
        "For embedded mode, use AdminClient() factory function."
      );
    }
    this._internal = new InternalClient({
      ...args,
      database: "information_schema",
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._internal.isConnected();
  }

  async close(): Promise<void> {
    await this._internal.close();
  }

  async createDatabase(
    name: string,
    tenant: string = DEFAULT_TENANT,
  ): Promise<void> {
    // Remote server has multi-tenant architecture. Database is scoped to client's tenant.
    // If specified tenant differs from client tenant, use client tenant and warn
    if (tenant !== this.tenant && tenant !== DEFAULT_TENANT) {
      console.warn(
        `Specified tenant '${tenant}' differs from client tenant '${this.tenant}', using client tenant`,
      );
    }

    const sql = `CREATE DATABASE IF NOT EXISTS \`${name}\``;
    await this._internal.execute(sql);
  }

  async getDatabase(
    name: string,
    tenant: string = DEFAULT_TENANT,
  ): Promise<Database> {
    // Remote server has multi-tenant architecture. Database is scoped to client's tenant.
    // If specified tenant differs from client tenant, use client tenant and warn
    if (tenant !== this.tenant && tenant !== DEFAULT_TENANT) {
      console.warn(
        `Specified tenant '${tenant}' differs from client tenant '${this.tenant}', using client tenant`,
      );
    }

    const sql = `SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`;
    const rows = await this._internal.execute(sql, [name]);

    if (!rows || rows.length === 0) {
      throw new SeekdbValueError(`Database not found: ${name}`);
    }

    const row = rows[0];
    return new Database(
      row.SCHEMA_NAME,
      this.tenant, // Remote server has tenant concept
      row.DEFAULT_CHARACTER_SET_NAME,
      row.DEFAULT_COLLATION_NAME,
    );
  }

  async deleteDatabase(
    name: string,
    tenant: string = DEFAULT_TENANT,
  ): Promise<void> {
    // Remote server has multi-tenant architecture. Database is scoped to client's tenant.
    // If specified tenant differs from client tenant, use client tenant and warn
    if (tenant !== this.tenant && tenant !== DEFAULT_TENANT) {
      console.warn(
        `Specified tenant '${tenant}' differs from client tenant '${this.tenant}', using client tenant`,
      );
    }

    const sql = `DROP DATABASE IF EXISTS \`${name}\``;
    await this._internal.execute(sql);
  }

  async listDatabases(
    limit?: number,
    offset?: number,
    tenant: string = DEFAULT_TENANT,
  ): Promise<Database[]> {
    // Remote server has multi-tenant architecture. Lists databases in client's tenant.
    // If specified tenant differs from client tenant, use client tenant and warn
    if (tenant !== this.tenant && tenant !== DEFAULT_TENANT) {
      console.warn(
        `Specified tenant '${tenant}' differs from client tenant '${this.tenant}', using client tenant`,
      );
    }

    // Validate parameters to prevent SQL injection
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
      throw new SeekdbValueError("limit must be a non-negative integer");
    }
    if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
      throw new SeekdbValueError("offset must be a non-negative integer");
    }

    let sql =
      "SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA";
    const params: number[] = [];

    if (limit !== undefined) {
      if (offset !== undefined) {
        sql += ` LIMIT ?, ?`;
        params.push(offset, limit);
      } else {
        sql += ` LIMIT ?`;
        params.push(limit);
      }
    }

    const rows = await this._internal.execute(sql, params);

    const databases: Database[] = [];
    if (rows) {
      for (const row of rows) {
        databases.push(
          new Database(
            row.SCHEMA_NAME,
            this.tenant, // Remote server has tenant concept
            row.DEFAULT_CHARACTER_SET_NAME,
            row.DEFAULT_COLLATION_NAME,
          ),
        );
      }
    }

    return databases;
  }
}
