/**
 * MySQL Connection Manager
 * Manages database connections for SeekDB clients
 */

import mysql from 'mysql2/promise';
import type { Connection as MySQLConnection, RowDataPacket } from 'mysql2/promise';
import { SeekDBConnectionError } from './errors.js';

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
      } catch (error) {
        throw new SeekDBConnectionError(
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
   * @returns Query results for SELECT/SHOW/DESCRIBE statements, null for others
   */
  async execute(sql: string): Promise<RowDataPacket[] | null> {
    const conn = await this.ensureConnection();
    const sqlUpper = sql.trim().toUpperCase();

    // Return rows for SELECT-like queries
    if (
      sqlUpper.startsWith('SELECT') ||
      sqlUpper.startsWith('SHOW') ||
      sqlUpper.startsWith('DESCRIBE') ||
      sqlUpper.startsWith('DESC')
    ) {
      const [rows] = await conn.query<RowDataPacket[]>(sql);
      return rows;
    }

    // Execute without returning rows for DDL/DML statements
    await conn.query(sql);
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
      await this.connection.end();
      this.connection = null;
    }
  }

  // ==================== Transaction Support ====================

  /**
   * Begin a transaction
   * @throws {SeekDBConnectionError} If not connected or transaction fails to start
   */
  async beginTransaction(): Promise<void> {
    const conn = await this.ensureConnection();
    try {
      await conn.beginTransaction();
    } catch (error) {
      throw new SeekDBConnectionError('Failed to begin transaction', error);
    }
  }

  /**
   * Commit current transaction
   * @throws {SeekDBConnectionError} If not connected or commit fails
   */
  async commit(): Promise<void> {
    const conn = await this.ensureConnection();
    try {
      await conn.commit();
    } catch (error) {
      throw new SeekDBConnectionError('Failed to commit transaction', error);
    }
  }

  /**
   * Rollback current transaction
   * @throws {SeekDBConnectionError} If not connected or rollback fails
   */
  async rollback(): Promise<void> {
    const conn = await this.ensureConnection();
    try {
      await conn.rollback();
    } catch (error) {
      throw new SeekDBConnectionError('Failed to rollback transaction', error);
    }
  }

  /**
   * Execute a function within a transaction
   * Automatically commits on success and rolls back on error
   * @param callback - Function to execute within the transaction
   * @returns The result of the callback function
   * @throws {SeekDBConnectionError} If transaction fails
   * 
   * @example
   * ```typescript
   * const result = await connection.transaction(async () => {
   *   await connection.execute('INSERT INTO ...');
   *   await connection.execute('UPDATE ...');
   *   return { success: true };
   * });
   * ```
   */
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.beginTransaction();
    
    try {
      const result = await callback();
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}

