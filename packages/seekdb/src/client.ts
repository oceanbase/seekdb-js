/**
 * seekdb Client - Remote server mode (MySQL protocol)
 * Supports both seekdb Server and OceanBase Server
 */

import type { RowDataPacket } from "mysql2/promise";
import { Collection } from "./collection.js";
import { InternalClient } from "./internal-client.js";
import { SQLBuilder } from "./sql-builder.js";
import { SeekdbValueError, InvalidCollectionError } from "./errors.js";
import {
  getEmbeddingFunction,
  supportsPersistence,
} from "./embedding-function.js";
import {
  CollectionFieldNames,
  DEFAULT_DISTANCE_METRIC,
  DEFAULT_VECTOR_DIMENSION,
  COLLECTION_V1_PREFIX,
  resolveEmbeddingFunction,
  validateCollectionName,
  CollectionNames,
} from "./utils.js";
import {
  insertCollectionMetadata,
  getCollectionMetadata,
  deleteCollectionMetadata,
  listCollectionMetadata,
  CollectionMetadata,
  METADATA_TABLE_NAME,
} from "./metadata-manager.js";
import type {
  SeekdbClientArgs,
  CreateCollectionOptions,
  GetCollectionOptions,
  DistanceMetric,
  Configuration,
  HNSWConfiguration,
  FulltextAnalyzerConfig,
  ConfigurationParam,
} from "./types.js";

/**
 * seekdb Client for remote server connections
 */
export class SeekdbClient {
  private _internal: InternalClient;

  constructor(args: SeekdbClientArgs) {
    this._internal = new InternalClient(args);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._internal.isConnected();
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    await this._internal.close();
  }

  // ==================== Collection Management ====================

  /**
   * Create a new collection
   */
  async createCollection(
    options: CreateCollectionOptions
  ): Promise<Collection> {
    const { name, configuration, embeddingFunction } = options;

    // Validate collection name
    validateCollectionName(name);

    let ef = embeddingFunction;
    let hnsw: HNSWConfiguration | undefined;
    let fulltextConfig: FulltextAnalyzerConfig | undefined;

    // Extract HNSW and fulltext config
    if (configuration) {
      if ("hnsw" in configuration || "fulltextConfig" in configuration) {
        const config = configuration as Configuration;
        hnsw = config.hnsw;
        fulltextConfig = config.fulltextConfig;
      } else {
        hnsw = configuration as HNSWConfiguration;
      }
    }

    let distance = hnsw?.distance ?? DEFAULT_DISTANCE_METRIC;

    // Calculate actual dimension from embedding function if provided
    let dimension: number | undefined;

    // Handle embedding function: undefined means use default, null means no EF
    if (ef === undefined) {
      ef = await getEmbeddingFunction();
    }

    // If embedding function exists, try to get dimension
    if (ef !== null) {
      // Priority 1: Read dimension property (avoid model initialization)
      if ("dimension" in ef && typeof ef.dimension === "number") {
        dimension = ef.dimension;
      } else {
        // Priority 2: Call generate to calculate dimension
        const testEmbeddings = await ef.generate(["seekdb"]);
        dimension = testEmbeddings[0]?.length;
        if (!dimension) {
          throw new SeekdbValueError(
            "Embedding function returned empty result when called with 'seekdb'"
          );
        }
      }
    }

    // Determine final dimension based on configuration and embedding function
    if (configuration === null) {
      // configuration=null: MUST have embedding function to infer dimension
      if (ef === null || dimension === undefined) {
        throw new SeekdbValueError(
          "Cannot create collection: configuration is explicitly set to null and " +
            "embedding_function is also null. Cannot determine dimension without either a configuration " +
            "or an embedding function. Please either:\n" +
            "  1. Provide a configuration with dimension specified (e.g., { dimension: 128, distance: 'cosine' }), or\n" +
            "  2. Provide an embeddingFunction to calculate dimension automatically, or\n" +
            "  3. Do not set configuration=null (use default configuration)."
        );
      }
    } else if (hnsw?.dimension !== undefined) {
      // configuration has explicit dimension
      if (dimension !== undefined && hnsw.dimension !== dimension) {
        throw new SeekdbValueError(
          `Configuration dimension (${hnsw.dimension}) does not match embedding function dimension (${dimension})`
        );
      }
      dimension = hnsw.dimension;
    } else {
      // configuration has no dimension: use dimension or default
      dimension = dimension ?? DEFAULT_VECTOR_DIMENSION;
    }

    // Prepare embedding function metadata (only if ef supports persistence)
    let embeddingFunctionMetadata:
      | { name: string; properties: any }
      | undefined;
    if (supportsPersistence(ef)) {
      embeddingFunctionMetadata = { name: ef.name, properties: ef.getConfig() };
    }

    // Insert metadata and get collection_id
    const collectionId = await insertCollectionMetadata(this._internal, name, {
      configuration: {
        hnsw: { dimension, distance },
        fulltextConfig,
      },
      embeddingFunction: embeddingFunctionMetadata,
    });

    // Create table using SQLBuilder with collection_id (v2 format)
    const sql = SQLBuilder.buildCreateTable(
      name,
      dimension,
      distance,
      undefined,
      collectionId,
      fulltextConfig
    );

    try {
      await this._internal.execute(sql);
    } catch (error) {
      // If table creation fails, try to clean up metadata
      try {
        await deleteCollectionMetadata(this._internal, name);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }

    return new Collection({
      name,
      dimension,
      distance,
      embeddingFunction: ef ?? undefined,
      internalClient: this._internal,
      client: this,
      collectionId,
    });
  }

  /**
   * Get an existing collection
   */
  async getCollection(options: GetCollectionOptions): Promise<Collection> {
    const { name, embeddingFunction } = options;

    // Variables to store collection info
    let dimension: number;
    let distance: DistanceMetric;
    let collectionId: string | undefined;

    let embeddingFunctionConfig:
      | CollectionMetadata["settings"]["embeddingFunction"]
      | undefined;

    // Try v2 format first (check metadata table)
    const metadata = await getCollectionMetadata(this._internal, name);

    if (metadata) {
      // v2 collection found - extract from metadata
      const {
        collectionId: cId,
        settings: {
          embeddingFunction: embeddingFunctionMeta,
          configuration,
        } = {},
      } = metadata;

      // Verify table exists
      const sql = SQLBuilder.buildShowTable(name, cId);
      const result = await this._internal.execute(sql);

      if (!result || result.length === 0) {
        throw new InvalidCollectionError(
          `Collection metadata exists but table not found: ${name}`
        );
      }

      let hnsw: HNSWConfiguration | undefined;
      if (configuration) {
        if ("hnsw" in configuration) {
          hnsw = configuration.hnsw;
        } else {
          hnsw = configuration as HNSWConfiguration;
        }
      }

      dimension = hnsw?.dimension ?? DEFAULT_VECTOR_DIMENSION;
      distance = hnsw?.distance ?? DEFAULT_DISTANCE_METRIC;
      collectionId = cId;
      embeddingFunctionConfig = embeddingFunctionMeta;
    } else {
      // Fallback to v1 format - extract from table schema
      const sql = SQLBuilder.buildShowTable(name);
      const result = await this._internal.execute(sql);

      if (!result || result.length === 0) {
        throw new InvalidCollectionError(`Collection not found: ${name}`);
      }

      // Get table schema to extract dimension and distance
      const descSql = SQLBuilder.buildDescribeTable(name);
      const schema = await this._internal.execute(descSql);

      if (!schema) {
        throw new InvalidCollectionError(
          `Unable to retrieve schema for collection: ${name}`
        );
      }

      // Parse embedding field to get dimension
      const embeddingField = schema.find(
        (row: any) => row.Field === CollectionFieldNames.EMBEDDING
      );
      if (!embeddingField) {
        throw new InvalidCollectionError(
          `Collection ${name} does not have embedding field`
        );
      }

      // Parse VECTOR(dimension) format
      const match = embeddingField.Type.match(/VECTOR\((\d+)\)/i);
      if (!match) {
        throw new InvalidCollectionError(
          `Invalid embedding type: ${embeddingField.Type}`
        );
      }

      dimension = parseInt(match[1], 10);

      // Extract distance from CREATE TABLE statement
      distance = DEFAULT_DISTANCE_METRIC;
      try {
        const createTableSql = SQLBuilder.buildShowCreateTable(name);
        const createTableResult = await this._internal.execute(createTableSql);

        if (createTableResult && createTableResult.length > 0) {
          const createStmt =
            (createTableResult[0] as any)["Create Table"] || "";
          // Match: with(distance=value, ...) where value can be l2, cosine, inner_product, or ip
          const distanceMatch = createStmt.match(
            /with\s*\([^)]*distance\s*=\s*['"]?(\w+)['"]?/i
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
    }

    // Unified embedding function resolution
    const ef = await resolveEmbeddingFunction(
      embeddingFunctionConfig,
      embeddingFunction
    );

    return new Collection({
      name,
      dimension,
      distance,
      embeddingFunction: ef,
      internalClient: this._internal,
      client: this,
      collectionId,
    });
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<Collection[]> {
    const collections: Collection[] = [];
    const collectionNames = new Set<string>();

    // 1. Get v2 collections from metadata table
    const v2Metadata = await listCollectionMetadata(this._internal);

    for (const metadata of v2Metadata) {
      try {
        const collection = await this.getCollection({
          name: metadata.collectionName,
        });
        collections.push(collection);
        collectionNames.add(metadata.collectionName);
      } catch (error) {
        // Skip if we can't get collection info
        continue;
      }
    }

    // 2. Get v1 collections
    const sql = `SHOW TABLES LIKE '${COLLECTION_V1_PREFIX}%'`;
    let result: RowDataPacket[] | null = null;

    try {
      result = await this._internal.execute(sql);
    } catch (error) {
      // Fallback: try to query information_schema
      try {
        // Get current database name
        const dbResult = await this._internal.execute("SELECT DATABASE()");
        if (dbResult && dbResult.length > 0) {
          const dbName =
            (dbResult[0] as any)["DATABASE()"] || Object.values(dbResult[0])[0];
          if (dbName) {
            result = await this._internal.execute(
              `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME LIKE '${COLLECTION_V1_PREFIX}%'`
            );
          }
        }
      } catch (fallbackError) {
        // If fallback also fails, continue with v2 collections only
      }
    }

    if (result) {
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
        const collectionName =
          CollectionNames.extractCollectionName(tableName) || "";

        // Skip if already added as v2 collection
        if (collectionName && collectionNames.has(collectionName)) {
          continue;
        }

        try {
          // Fetch full collection details
          const collection = await this.getCollection({
            name: collectionName,
          });
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

    // Check if it's a v2 collection
    const metadata = await getCollectionMetadata(this._internal, name);

    if (metadata) {
      // v2 collection - delete both table and metadata
      const { collectionId } = metadata;

      // Delete table
      const sql = SQLBuilder.buildDropTable(name, collectionId);
      await this._internal.execute(sql);

      // Delete metadata
      await deleteCollectionMetadata(this._internal, name);
    } else {
      // v1 collection - delete table only
      const sql = SQLBuilder.buildDropTable(name);
      await this._internal.execute(sql);
    }
  }

  /**
   * Check if collection exists
   */
  async hasCollection(name: string): Promise<boolean> {
    // Check v2 format first (metadata table)
    const metadata = await getCollectionMetadata(this._internal, name);
    if (metadata) {
      return true;
    }

    // Fallback to v1 format
    const sql = SQLBuilder.buildShowTable(name);
    const result = await this._internal.execute(sql);
    return result !== null && result.length > 0;
  }

  /**
   * Get or create collection
   */
  async getOrCreateCollection(
    options: CreateCollectionOptions
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
    const collectionNames = new Set<string>();

    // 1. Count v2 collections from metadata table
    const v2Metadata = await listCollectionMetadata(this._internal);
    const v2Count = v2Metadata.length;

    // 2. Count v1 collections
    let v1Count = 0;
    const sql = `SELECT collection_name as TABLE_NAME FROM ${METADATA_TABLE_NAME}`;
    let result: RowDataPacket[] | null = null;

    try {
      result = await this._internal.execute(sql);
    } catch (error) {
      // Fallback: try to query information_schema
      try {
        const dbResult = await this._internal.execute("SELECT DATABASE()");
        if (dbResult && dbResult.length > 0) {
          const dbName =
            (dbResult[0] as any)["DATABASE()"] || Object.values(dbResult[0])[0];
          if (dbName) {
            result = await this._internal.execute(
              `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME LIKE '${COLLECTION_V1_PREFIX}%'`
            );
          }
        }
      } catch (fallbackError) {
        // If fallback also fails, continue with v2 count only
      }
    }

    if (result) {
      for (const row of result) {
        // Extract table name
        let tableName: string;
        if ((row as any).TABLE_NAME) {
          tableName = (row as any).TABLE_NAME;
        } else {
          tableName = Object.values(row)[0] as string;
        }

        const collectionName = CollectionNames.extractCollectionName(tableName);
        // Only count if not already in v2
        if (collectionName && !collectionNames.has(collectionName)) {
          v1Count++;
        }
      }
    }

    return v2Count + v1Count;
  }
}
