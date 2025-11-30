/**
 * SeekDB Client - Remote server mode (MySQL protocol)
 * Supports both SeekDB Server and OceanBase Server
 */

import type { RowDataPacket } from "mysql2/promise";
import { Collection } from "./collection.js";
import { Connection } from "./connection.js";
import { SQLBuilder } from "./sql-builder.js";
import { SeekDBValueError, InvalidCollectionError } from "./errors.js";
import { getEmbeddingFunction } from "./embedding-function.js";
import {
  CollectionFieldNames,
  DEFAULT_TENANT,
  DEFAULT_DATABASE,
  DEFAULT_PORT,
  DEFAULT_USER,
  DEFAULT_CHARSET,
  DEFAULT_DISTANCE_METRIC,
  DEFAULT_VECTOR_DIMENSION,
} from "./utils.js";
import type {
  SeekDBClientArgs,
  CreateCollectionOptions,
  GetCollectionOptions,
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
  async execute(
    sql: string,
    params?: unknown[],
  ): Promise<RowDataPacket[] | null> {
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
    const { name, configuration, embeddingFunction } = options;

    let ef = embeddingFunction;
    let distance = configuration?.distance ?? DEFAULT_DISTANCE_METRIC;
    let dimension = configuration?.dimension ?? DEFAULT_VECTOR_DIMENSION;

    // If embeddingFunction is provided, use it to generate embeddings and validate dimension
    if (!!ef) {
      const testEmbeddings = await ef.generate(["seekdb"]);
      const actualDimension = testEmbeddings[0].length;

      // Validate dimension matches if is already provided
      if (
        configuration?.dimension &&
        configuration.dimension !== actualDimension
      ) {
        throw new SeekDBValueError(
          `Configuration dimension (${configuration.dimension}) does not match embedding function dimension (${actualDimension})`,
        );
      }

      dimension = actualDimension || DEFAULT_VECTOR_DIMENSION;
    }

    // Default behavior: if neither provided, use DefaultEmbeddingFunction
    if (ef === undefined) {
      ef = await getEmbeddingFunction();
      const testEmbeddings = await ef.generate(["seekdb"]);
      const actualDimension = testEmbeddings[0].length;

      // Validate dimension matches if is already provided
      if (
        configuration?.dimension &&
        configuration.dimension !== actualDimension
      ) {
        throw new SeekDBValueError(
          `Configuration dimension (${configuration.dimension}) does not match embedding function dimension (${actualDimension})`,
        );
      }

      dimension = actualDimension || DEFAULT_VECTOR_DIMENSION;
    }

    // Create table using SQLBuilder
    const sql = SQLBuilder.buildCreateTable(name, dimension, distance);
    await this.execute(sql);

    return new Collection({
      name,
      dimension,
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
        const distanceMatch = createStmt.match(
          /with\s*\([^)]*distance\s*=\s*['"]?(\w+)['"]?/i,
        );
        if (distanceMatch) {
          const parsedDistance = distanceMatch[1].toLowerCase();
          if (
            parsedDistance === "l2" ||
            parsedDistance === "cosine" ||
            parsedDistance === "inner_product" ||
            parsedDistance === "ip"
          ) {
            distance = parsedDistance as DistanceMetric;
          }
        }
      }
    } catch (error) {
      // If extraction fails, use default distance
    }

    let ef = embeddingFunction;
    // Use default embedding function if not provided
    // If embeddingFunction is set to null, do not use embedding function
    if (embeddingFunction === undefined) {
      ef = await getEmbeddingFunction();
    }

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
  async listCollections(): Promise<Collection[]> {
    const prefix = "c$v1$";
    // Match Python implementation: Use SHOW TABLES LIKE for filtering
    const sql = `SHOW TABLES LIKE '${prefix}%'`;
    let result: RowDataPacket[] | null = null;

    try {
      result = await this.execute(sql);
    } catch (error) {
      // Fallback: try to query information_schema
      try {
        // Get current database name
        const dbResult = await this.execute("SELECT DATABASE()");
        if (dbResult && dbResult.length > 0) {
          const dbName =
            (dbResult[0] as any)["DATABASE()"] ||
            Object.values(dbResult[0])[0];
          if (dbName) {
            result = await this.execute(
              `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME LIKE '${prefix}%'`,
            );
          } else {
            return [];
          }
        } else {
          return [];
        }
      } catch (fallbackError) {
        // If fallback also fails, return empty list
        return [];
      }
    }

    if (!result) return [];

    const collections: Collection[] = [];

    for (const row of result) {
      // Extract table name - handle both SHOW TABLES format and information_schema format
      let tableName: string;
      if ((row as any).TABLE_NAME) {
        // information_schema format
        tableName = (row as any).TABLE_NAME;
      } else {
        // SHOW TABLES format - get first value
        tableName = Object.values(row)[0] as string;
      }

      // Double check prefix although SQL filter should handle it
      if (tableName.startsWith(prefix)) {
        const collectionName = tableName.substring(prefix.length);
        try {
          // Fetch full collection details
          const collection = await this.getCollection({ name: collectionName });
          collections.push(collection);
        } catch (error) {
          // Skip if we can't get collection info
          continue;
        }
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
      return this.getCollection(options);
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
}
