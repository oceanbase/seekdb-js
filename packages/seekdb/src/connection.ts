/**
 * MySQL Connection Manager
 * Manages database connections for seekdb clients
 */

import mysql from "mysql2/promise";
import type {
  Connection as MySQLConnection,
  RowDataPacket,
} from "mysql2/promise";
import { SeekdbConnectionError } from "./errors.js";

/**
 * Configuration for MySQL connection
 */
export interface ConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
  charset: string;
  /** Optional OceanBase/seekdb query timeout in milliseconds (e.g. 60000 = 60s). */
  queryTimeout?: number;
}

/**
 * MySQL connection manager
 * Handles connection lifecycle and SQL execution
 */
export class Connection {
  private connection: MySQLConnection | null = null;
  private readonly config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  /**
   * Ensure connection is established
   */
  async ensureConnection(): Promise<MySQLConnection> {
    if (!this.connection) {
      try {
        this.connection = await mysql.createConnection({
          host: this.config.host,
          port: this.config.port,
          user: this.config.user,
          password: this.config.password,
          database: this.config.database,
          charset: this.config.charset,
        });
        if (this.config.queryTimeout != null) {
          try {
            const timeoutUs = this.config.queryTimeout * 1000;
            await this.connection.query(
              `SET ob_query_timeout = ${timeoutUs}`
            );
          } catch {
            // Ignore if server does not support ob_query_timeout (e.g. plain MySQL)
          }
        }
      } catch (error) {
        throw new SeekdbConnectionError(
          `Failed to connect to ${this.config.host}:${this.config.port}`,
          error
        );
      }
    }
    return this.connection;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection !== null;
  }

  /**
   * Execute SQL query
   * @param sql - SQL statement to execute
   * @param params - Parameters for the query
   * @returns Query results for SELECT/SHOW/DESCRIBE statements, null for others
   */
  async execute(
    sql: string,
    params?: unknown[]
  ): Promise<RowDataPacket[] | null> {
    const conn = await this.ensureConnection();
    const sqlUpper = sql.trim().toUpperCase();

    // Return rows for SELECT-like queries
    if (
      sqlUpper.startsWith("SELECT") ||
      sqlUpper.startsWith("SHOW") ||
      sqlUpper.startsWith("DESCRIBE") ||
      sqlUpper.startsWith("DESC")
    ) {
      const [rows] = await conn.query<RowDataPacket[]>(sql, params);
      return rows;
    }

    // Execute without returning rows for DDL/DML statements
    await conn.query(sql, params);
    return null;
  }

  /**
   * Get the raw connection object
   * @internal
   */
  getRawConnection(): MySQLConnection | null {
    return this.connection;
  }

  /**
   * Close connection and cleanup resources
   */
  async close(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
      } catch {
        this.connection.destroy();
      } finally {
        this.connection = null;
      }
    }
  }
}
