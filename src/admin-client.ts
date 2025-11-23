import type { RowDataPacket } from 'mysql2/promise';
import { Connection } from './connection.js';
import {
  SeekDBValueError,
} from './errors.js';
import {
  DEFAULT_TENANT,
  DEFAULT_PORT,
  DEFAULT_USER,
  DEFAULT_CHARSET,
} from './utils.js';
import type { SeekDBAdminClientArgs } from './types.js';
import { Database } from './database.js';

export function AdminClient(args: SeekDBAdminClientArgs): SeekDBAdminClient {
  return new SeekDBAdminClient(args);
}

export class SeekDBAdminClient {
  private readonly connectionManager: Connection;
  private readonly tenant: string;

  constructor(args: SeekDBAdminClientArgs) {
    const host = args.host;
    const port = args.port ?? DEFAULT_PORT;
    this.tenant = args.tenant ?? DEFAULT_TENANT;
    const user = args.user ?? DEFAULT_USER;
    const password = args.password ?? process.env.SEEKDB_PASSWORD ?? '';
    const charset = args.charset ?? DEFAULT_CHARSET;
    
    // SeekDB 单机版不使用租户，只有指定了非空 tenant 时才添加 @tenant 后缀
    const fullUser = this.tenant ? `${user}@${this.tenant}` : user;

    // Initialize connection manager (no database specified for admin client)
    this.connectionManager = new Connection({
      host,
      port,
      user: fullUser,
      password,
      charset,
    });
  }

  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  async close(): Promise<void> {
    await this.connectionManager.close();
  }

  /**
   * Execute SQL query
   * @internal
   */
  private async execute(sql: string): Promise<RowDataPacket[] | null> {
    return this.connectionManager.execute(sql);
  }

  async createDatabase(name: string, _tenant: string = DEFAULT_TENANT): Promise<void> {
    const sql = `CREATE DATABASE IF NOT EXISTS \`${name}\``;
    await this.execute(sql);
  }

  async getDatabase(name: string, _tenant: string = DEFAULT_TENANT): Promise<Database> {
    const sql = `SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${name}'`;
    const rows = await this.execute(sql);
    
    if (!rows || rows.length === 0) {
      throw new SeekDBValueError(`Database not found: ${name}`);
    }
    
    const row = rows[0];
    return new Database(
      row.SCHEMA_NAME,
      this.tenant,
      row.DEFAULT_CHARACTER_SET_NAME,
      row.DEFAULT_COLLATION_NAME
    );
  }

  async deleteDatabase(name: string, _tenant: string = DEFAULT_TENANT): Promise<void> {
    const sql = `DROP DATABASE IF EXISTS \`${name}\``;
    await this.execute(sql);
  }

  async listDatabases(
    limit?: number,
    offset?: number,
    _tenant: string = DEFAULT_TENANT
  ): Promise<Database[]> {
    let sql = 'SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA';
    
    if (limit !== undefined) {
      if (offset !== undefined) {
        sql += ` LIMIT ${offset}, ${limit}`;
      } else {
        sql += ` LIMIT ${limit}`;
      }
    }
    
    const rows = await this.execute(sql);
    
    const databases: Database[] = [];
    if (rows) {
      for (const row of rows) {
        databases.push(
          new Database(
            row.SCHEMA_NAME,
            this.tenant,
            row.DEFAULT_CHARACTER_SET_NAME,
            row.DEFAULT_COLLATION_NAME
          )
        );
      }
    }
    
    return databases;
  }
}

