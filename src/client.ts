/**
 * SeekDB Client - Remote server mode (MySQL protocol)
 * Supports both SeekDB Server and OceanBase Server
 */

import type { RowDataPacket } from "mysql2/promise";
import { Collection } from "./collection.js";
import { Connection } from "./connection.js";
import { SQLBuilder } from "./sql-builder.js";
import { SeekDBValueError, InvalidCollectionError } from "./errors.js";
import { getDefaultEmbeddingFunction } from "./embedding-function.js";
import {
  CollectionFieldNames,
  DEFAULT_TENANT,
  DEFAULT_DATABASE,
  DEFAULT_PORT,
  DEFAULT_USER,
  DEFAULT_CHARSET,
  DEFAULT_DISTANCE_METRIC,
} from "./utils.js";
import type {
  SeekDBClientArgs,
  CreateCollectionOptions,
  GetCollectionOptions,
  HNSWConfiguration,
  EmbeddingFunction,
  DistanceMetric,
} from "./types.js";

/**
 * SeekDB Client for remote server connections
 */
export class SeekDBClient {
  private readonly connectionManager: Connection;
  private readonly tenant: string;
  private readonly database: string;

  constructor(args: SeekDBClientArgs) {
    const host = args.host;
    const port = args.port ?? DEFAULT_PORT;
    this.tenant = args.tenant ?? DEFAULT_TENANT;
    this.database = args.database ?? DEFAULT_DATABASE;
    const user = args.user ?? DEFAULT_USER;
    const password = args.password ?? process.env.SEEKDB_PASSWORD ?? "";
    const charset = args.charset ?? DEFAULT_CHARSET;

    const fullUser = this.tenant ? `${user}@${this.tenant}` : user;

    // Initialize connection manager
    this.connectionManager = new Connection({
      host,
      port,
      user: fullUser,
      password,
      database: this.database,
      charset,
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  /**
   * Execute SQL query
   */
  async execute(sql: string, params?: unknown[]): Promise<RowDataPacket[] | null> {
    return this.connectionManager.execute(sql, params);
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    await this.connectionManager.close();
  }

  // ==================== Collection Management ====================

  /**
   * Create a new collection
   */
  async createCollection(
    options: CreateCollectionOptions,
  ): Promise<Collection> {
    const { name } = options;
    const configuration = options.configuration ?? null;
    const embeddingFunction = options.embeddingFunction ?? null;

    let config: HNSWConfiguration | null = configuration;
    let ef: EmbeddingFunction | null = embeddingFunction;

    // Default behavior: if neither provided, use DefaultEmbeddingFunction
    if (config === null && ef === null) {
      ef = getDefaultEmbeddingFunction();
      const testEmbeddings = await ef.generate("seekdb");
      config = {
        dimension: testEmbeddings[0].length,
        distance: DEFAULT_DISTANCE_METRIC,
      };
    }

    // Auto-calculate dimension from embedding function if config not provided
    if (config === null && ef !== null) {
      const testEmbeddings = await ef.generate("seekdb");
      const dimension = testEmbeddings[0].length;
      config = {
        dimension,
        distance: DEFAULT_DISTANCE_METRIC,
      };
    }

    // Validate dimension matches if both provided
    if (config !== null && ef !== null) {
      const testEmbeddings = await ef.generate("seekdb");
      const actualDimension = testEmbeddings[0].length;
      if (config.dimension !== actualDimension) {
        throw new SeekDBValueError(
          `Configuration dimension (${config.dimension}) does not match embedding function dimension (${actualDimension})`,
        );
      }
    }

    if (config === null) {
      throw new SeekDBValueError(
        "Cannot determine dimension: either provide configuration or embeddingFunction",
      );
    }

    // Create table using SQLBuilder
    const distance = config.distance ?? DEFAULT_DISTANCE_METRIC;
    const sql = SQLBuilder.buildCreateTable(name, config.dimension, distance);
    await this.execute(sql);

    return new Collection({
      name,
      dimension: config.dimension,
      distance,
      embeddingFunction: ef ?? undefined,
      client: this,
    });
  }

  /**
   * Get an existing collection
   */
  async getCollection(options: GetCollectionOptions): Promise<Collection> {
    const { name, embeddingFunction } = options;

    // Check if collection exists
    const sql = SQLBuilder.buildShowTable(name);
    const result = await this.execute(sql);

    if (!result || result.length === 0) {
      throw new InvalidCollectionError(`Collection not found: ${name}`);
    }

    // Get table schema to extract dimension and distance
    const descSql = SQLBuilder.buildDescribeTable(name);
    const schema = await this.execute(descSql);

    if (!schema) {
      throw new InvalidCollectionError(
        `Unable to retrieve schema for collection: ${name}`,
      );
    }

    // Parse embedding field to get dimension
    const embeddingField = schema.find(
      (row: any) => row.Field === CollectionFieldNames.EMBEDDING,
    );
    if (!embeddingField) {
      throw new InvalidCollectionError(
        `Collection ${name} does not have embedding field`,
      );
    }

    // Parse VECTOR(dimension) format
    const match = embeddingField.Type.match(/VECTOR\((\d+)\)/i);
    if (!match) {
      throw new InvalidCollectionError(
        `Invalid embedding type: ${embeddingField.Type}`,
      );
    }

    const dimension = parseInt(match[1], 10);

    // Extract distance from CREATE TABLE statement
    let distance: DistanceMetric = DEFAULT_DISTANCE_METRIC;
    try {
      const createTableSql = SQLBuilder.buildShowCreateTable(name);
      const createTableResult = await this.execute(createTableSql);
      
      if (createTableResult && createTableResult.length > 0) {
        const createStmt = (createTableResult[0] as any)["Create Table"] || "";
        // Match: with(distance=value, ...) where value can be l2, cosine, inner_product, or ip
        const distanceMatch = createStmt.match(/with\s*\([^)]*distance\s*=\s*['"]?(\w+)['"]?/i);
        if (distanceMatch) {
          const parsedDistance = distanceMatch[1].toLowerCase();
          if (parsedDistance === "l2" || parsedDistance === "cosine" || parsedDistance === "inner_product" || parsedDistance === "ip") {
            distance = parsedDistance as DistanceMetric;
          }
        }
      }
    } catch (error) {
      // If extraction fails, use default distance
    }

    // Use default embedding function if not provided
    const ef = embeddingFunction === undefined ? getDefaultEmbeddingFunction() : embeddingFunction;

    return new Collection({
      name,
      dimension,
      distance,
      embeddingFunction: ef ?? undefined,
      client: this,
    });
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<string[]> {
    const sql = "SHOW TABLES";
    const result = await this.execute(sql);

    if (!result) return [];

    const prefix = "c$v1$";
    const collections: string[] = [];

    for (const row of result) {
      const tableName = Object.values(row)[0] as string;
      if (tableName.startsWith(prefix)) {
        collections.push(tableName.substring(prefix.length));
      }
    }

    return collections;
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string): Promise<void> {
    // Check if collection exists first
    const exists = await this.hasCollection(name);
    if (!exists) {
      throw new Error(`Collection '${name}' does not exist`);
    }
    const sql = SQLBuilder.buildDropTable(name);
    await this.execute(sql);
  }

  /**
   * Check if collection exists
   */
  async hasCollection(name: string): Promise<boolean> {
    const sql = SQLBuilder.buildShowTable(name);
    const result = await this.execute(sql);
    return result !== null && result.length > 0;
  }

  /**
   * Get or create collection
   */
  async getOrCreateCollection(
    options: CreateCollectionOptions,
  ): Promise<Collection> {
    if (await this.hasCollection(options.name)) {
      return this.getCollection({
        name: options.name,
        embeddingFunction: options.embeddingFunction ?? undefined,
      });
    }
    return this.createCollection(options);
  }

  /**
   * Count collections
   */
  async countCollection(): Promise<number> {
    const collections = await this.listCollections();
    return collections.length;
  }

  // ==================== Transaction Support ====================

  /**
   * Begin a transaction
   * All subsequent operations will be part of this transaction until commit() or rollback() is called
   *
   * @throws {SeekDBConnectionError} If connection fails or transaction cannot be started
   *
   * @example
   * ```typescript
   * await client.beginTransaction();
   * try {
   *   await collection.add({ ids: ['1'], documents: ['doc1'] });
   *   await collection.add({ ids: ['2'], documents: ['doc2'] });
   *   await client.commit();
   * } catch (error) {
   *   await client.rollback();
   *   throw error;
   * }
   * ```
   */
  async beginTransaction(): Promise<void> {
    await this.connectionManager.beginTransaction();
  }

  /**
   * Commit current transaction
   * Saves all changes made since beginTransaction() was called
   *
   * @throws {SeekDBConnectionError} If commit fails
   */
  async commit(): Promise<void> {
    await this.connectionManager.commit();
  }

  /**
   * Rollback current transaction
   * Discards all changes made since beginTransaction() was called
   *
   * @throws {SeekDBConnectionError} If rollback fails
   */
  async rollback(): Promise<void> {
    await this.connectionManager.rollback();
  }

  /**
   * Execute a function within a transaction
   * Automatically commits on success and rolls back on error
   *
   * @param callback - Function to execute within the transaction context
   * @returns The result of the callback function
   * @throws Throws any error from the callback after rolling back the transaction
   *
   * @example
   * ```typescript
   * const result = await client.transaction(async () => {
   *   await collection.add({ ids: ['1'], documents: ['doc1'] });
   *   await collection.add({ ids: ['2'], documents: ['doc2'] });
   *   return { itemsAdded: 2 };
   * });
   * console.log(result); // { itemsAdded: 2 }
   * ```
   */
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.connectionManager.transaction(callback);
  }
}
