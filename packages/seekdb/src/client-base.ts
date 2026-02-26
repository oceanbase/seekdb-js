/**
 * Base client class for seekdb
 * Contains common collection management and database admin methods shared by embedded and server clients
 * Supports both v1 (table-only) and v2 (metadata table + collection_id) collection formats.
 */

import { Collection } from "./collection.js";
import { Database } from "./database.js";
import { SQLBuilder } from "./sql-builder.js";
import {
  DEFAULT_TENANT,
  DEFAULT_DISTANCE_METRIC,
  DEFAULT_VECTOR_DIMENSION,
  COLLECTION_V1_PREFIX,
  queryTableNames,
  extractTableNamesFromResult,
  validateCollectionName,
  resolveEmbeddingFunction,
  CollectionNames,
  CollectionFieldNames,
} from "./utils.js";
import { SeekdbValueError, InvalidCollectionError } from "./errors.js";
import { getEmbeddingFunction } from "./embedding-function.js";
import {
  insertCollectionMetadata,
  getCollectionMetadata,
  deleteCollectionMetadata,
  listCollectionMetadata,
  CollectionMetadata,
} from "./metadata-manager.js";
import type {
  CreateCollectionOptions,
  GetCollectionOptions,
  IInternalClient,
  DistanceMetric,
  Metadata,
} from "./types.js";
import { FullTextIndexConfig, Schema, VectorIndexConfig } from "./schema.js";

/**
 * Base class for seekdb clients
 * Provides common collection management functionality (v1 + v2 collections).
 */
export abstract class BaseSeekdbClient {
  protected abstract readonly _internal: IInternalClient;
  /** Optional internal client for admin ops (e.g. embedded uses information_schema). When set, admin methods use this. */
  protected _adminInternal?: IInternalClient;
  /** Set by SeekdbClient facade so Collection can reference it (e.g. for fork). */
  protected _facade?: unknown;

  setFacade(facade: unknown): void {
    this._facade = facade;
  }

  /**
   * Check if connected
   */
  abstract isConnected(): boolean;

  /**
   * Close connection
   */
  abstract close(): Promise<void>;

  // ==================== Collection Management ====================

  /**
   * Create a new collection (v2 format with metadata table).
   * Supports Configuration (hnsw + fulltextConfig), HNSWConfiguration, and configuration=null with embedding function.
   */
  async createCollection(
    options: CreateCollectionOptions
  ): Promise<Collection> {
    const { name, schema, configuration, embeddingFunction } = options;

    // Validate collection name
    validateCollectionName(name);

    // resolve from configuration and schema
    let schemaResolved = new Schema();
    // Keep legacy behavior when schema is omitted.
    if (schema === undefined)
      schemaResolved = Schema.fromLegacy(configuration, embeddingFunction);
    else {
      // When user provides partial schema, fill missing indexes with defaults.
      schemaResolved.createIndex(
        schema.fulltextIndex ?? new FullTextIndexConfig()
      );
      schemaResolved.createIndex(schema.vectorIndex ?? new VectorIndexConfig());
      if (schema.sparseVectorIndex)
        schemaResolved.createIndex(schema.sparseVectorIndex);
    }

    const { vectorIndex } = schemaResolved;
    const { hnsw = {}, embeddingFunction: vectorEmbeddingFunction } =
      vectorIndex ?? {};

    let distance = hnsw.distance ?? DEFAULT_DISTANCE_METRIC;
    let dimension = hnsw.dimension;
    let ef = vectorEmbeddingFunction;

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
    } else if (hnsw?.dimension !== undefined) {
      // configuration has explicit dimension
      if (dimension !== undefined && hnsw.dimension !== dimension) {
        throw new SeekdbValueError(
          `Configuration dimension (${hnsw.dimension}) does not match embedding function dimension (${dimension})`
        );
      }
    } else {
      // configuration has no dimension: use dimension or default
      dimension = dimension ?? DEFAULT_VECTOR_DIMENSION;
    }

    if (schemaResolved.vectorIndex) {
      schemaResolved.vectorIndex.hnsw = { dimension, distance };
      schemaResolved.vectorIndex.embeddingFunction = ef;
    }

    // Insert metadata and get collection_id
    const collectionId = await insertCollectionMetadata(this._internal, name, {
      schema: schemaResolved.toMetadataJson(),
    });

    // Create table using SQLBuilder with collection_id (v2 format)
    const sql = SQLBuilder.buildCreateTable(
      name,
      schemaResolved,
      undefined,
      collectionId
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
      schema: schemaResolved,
      internalClient: this._internal,
      client: this._facade as any,
      collectionId,
    });
  }

  /**
   * Extract metadata from v1 table COMMENT (JSON string).
   */
  private static extractMetadataFromComment(
    createTable: string
  ): Metadata | undefined {
    const commentMatch = createTable.match(
      /COMMENT\s*=\s*'([^']*(?:''[^']*)*)'/
    );
    if (!commentMatch) return undefined;
    try {
      const commentValue = commentMatch[1].replace(/''/g, "'");
      return JSON.parse(commentValue) as Metadata;
    } catch {
      return undefined;
    }
  }

  /**
   * Get an existing collection
   *
   * Metadata deserialization logic:
   * 1. If metadata has schema, use schema as the base configuration
   * 2. If no schema in metadata, use legacy configuration (embeddingFunctionMeta, configuration)
   * 3. If embeddingFunction is provided in getCollection options, override the schema's embeddingFunction
   */
  async getCollection(options: GetCollectionOptions): Promise<Collection> {
    const { name, embeddingFunction: customEmbeddingFunction } = options;

    // Variables to store collection info
    let collectionId: string | undefined;

    // Try v2 format first (check metadata table)
    const metadata = await getCollectionMetadata(this._internal, name);
    let schemaResolved: Schema | undefined;
    let embeddingFunctionConfig:
      | CollectionMetadata["settings"]["embeddingFunction"]
      | undefined;
    let configurationMeta: CollectionMetadata["settings"]["configuration"];

    if (metadata) {
      // v2 collection found - extract from metadata
      const {
        collectionId: cId,
        settings: {
          embeddingFunction: embeddingFunctionMeta,
          configuration,
          schema: schemaJson,
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

      // Priority: if schemaJson exists, use it; otherwise use legacy configuration
      if (schemaJson) {
        schemaResolved = await Schema.fromJSON(schemaJson);
      }

      collectionId = cId;
      embeddingFunctionConfig = embeddingFunctionMeta;
      configurationMeta = configuration;
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

      const dimension = parseInt(match[1], 10);

      // Extract distance from CREATE TABLE statement
      let distance = DEFAULT_DISTANCE_METRIC;
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

      configurationMeta = {
        hnsw: { dimension, distance: distance as DistanceMetric },
      };
    }

    // Ensure schemaResolved is defined at this point
    if (!schemaResolved) {
      schemaResolved = Schema.fromLegacy(configurationMeta, undefined);
    }

    // Resolve embedding function with priority
    if (customEmbeddingFunction !== undefined) {
      // customEmbeddingFunction overrides everything
      if (schemaResolved.vectorIndex) {
        schemaResolved.vectorIndex.embeddingFunction =
          customEmbeddingFunction === null ? null : customEmbeddingFunction;
      }
    } else if (!schemaResolved.vectorIndex?.embeddingFunction) {
      //  no embedding function in schema, try to get default
      // Note: schema.vectorIndex.embeddingFunction is not undefined (already from fromJSON or schema), skip
      const ef = await resolveEmbeddingFunction(
        embeddingFunctionConfig,
        undefined
      );
      if (schemaResolved.vectorIndex) {
        schemaResolved.vectorIndex.embeddingFunction = ef;
      }
    }

    return new Collection({
      name,
      schema: schemaResolved,
      internalClient: this._internal,
      client: this._facade as any,
      collectionId,
    });
  }

  /**
   * List all collections. Returns v2 collections from metadata table, then v1 (deduplicated).
   * @param config.withEmbeddingFunction - If false, returned collections will not have embedding function loaded. Default true.
   */
  async listCollections(
    config: { withEmbeddingFunction?: boolean } = {
      withEmbeddingFunction: true,
    }
  ): Promise<Collection[]> {
    const { withEmbeddingFunction } = config;
    const collections: Collection[] = [];
    const collectionNames = new Set<string>();

    const v2Metadata = await listCollectionMetadata(this._internal);

    for (const metadata of v2Metadata) {
      try {
        const collection = await this.getCollection({
          name: metadata.collectionName,
          embeddingFunction: withEmbeddingFunction === false ? null : undefined,
        });
        collections.push(collection);
        collectionNames.add(metadata.collectionName);
      } catch {
        continue;
      }
    }

    const prefix = COLLECTION_V1_PREFIX;
    const result = await queryTableNames(this._internal, prefix, true);

    if (result && result.length > 0) {
      const tableNames = extractTableNamesFromResult(result, prefix);

      for (const tableName of tableNames) {
        const collectionName =
          CollectionNames.extractCollectionName(tableName) ??
          tableName.substring(prefix.length);
        if (!collectionName || collectionNames.has(collectionName)) continue;

        try {
          const collection = await this.getCollection({
            name: collectionName,
            embeddingFunction:
              withEmbeddingFunction === false ? null : undefined,
          });
          collections.push(collection);
        } catch {
          continue;
        }
      }
    }

    return collections;
  }

  /**
   * Delete a collection. For v2: drop table and metadata; for v1: drop table only.
   */
  async deleteCollection(name: string): Promise<void> {
    validateCollectionName(name);

    if (!(await this.hasCollection(name))) {
      throw new SeekdbValueError(`Collection not found: ${name}`);
    }

    const metadata = await getCollectionMetadata(this._internal, name);

    if (metadata) {
      const sql = SQLBuilder.buildDropTable(name, metadata.collectionId);
      await this._internal.execute(sql);
      await deleteCollectionMetadata(this._internal, name);
    } else {
      const sql = SQLBuilder.buildDropTable(name);
      await this._internal.execute(sql);
    }
  }

  /**
   * Check if collection exists. Checks v2 metadata first, then v1 table.
   */
  async hasCollection(name: string): Promise<boolean> {
    if (!name || typeof name !== "string") return false;

    const metadata = await getCollectionMetadata(this._internal, name);
    if (metadata) return true;

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
    const { name } = options;

    // Try to get existing collection
    try {
      return await this.getCollection({
        name,
        // Pass undefined (not null) so getCollection can load default embedding function if needed
        embeddingFunction: options.embeddingFunction,
      });
    } catch (error) {
      const isNotFound =
        (error instanceof SeekdbValueError &&
          error.message.includes("not found")) ||
        (error instanceof InvalidCollectionError &&
          error.message.includes("not found"));
      if (isNotFound) {
        return await this.createCollection(options);
      }
      throw error;
    }
  }

  /**
   * Count collections
   */
  async countCollection(): Promise<number> {
    const collections = await this.listCollections();
    return collections.length;
  }

  // ==================== Database Management (admin) ====================
  // Explicit createDatabase: no auto-create on connect. Aligns with server and pyseekdb.

  /**
   * Create database (explicit; connect does not auto-create).
   * Embedded client uses built-in admin connection (information_schema); user does not specify it.
   */
  async createDatabase(
    name: string,
    tenant: string = DEFAULT_TENANT
  ): Promise<void> {
    if (!name || typeof name !== "string") {
      throw new SeekdbValueError("Database name must be a non-empty string");
    }
    const internal = this._adminInternal ?? this._internal;
    const sql = `CREATE DATABASE IF NOT EXISTS \`${name}\``;
    await internal.execute(sql);
  }

  /**
   * Get database metadata.
   */
  async getDatabase(
    name: string,
    tenant: string = DEFAULT_TENANT
  ): Promise<Database> {
    if (!name || typeof name !== "string") {
      throw new SeekdbValueError("Database name must be a non-empty string");
    }
    const sql =
      "SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?";
    const rows = await this._internal.execute(sql, [name]);
    if (!rows || rows.length === 0) {
      throw new SeekdbValueError(`Database not found: ${name}`);
    }
    const row = rows[0] as Record<string, unknown>;
    const schemaName =
      (row.SCHEMA_NAME as string) ?? (row.schema_name as string) ?? "";
    const charset =
      (row.DEFAULT_CHARACTER_SET_NAME as string) ??
      (row.default_character_set_name as string) ??
      "";
    const collation =
      (row.DEFAULT_COLLATION_NAME as string) ??
      (row.default_collation_name as string) ??
      "";
    return new Database(schemaName, charset, collation);
  }

  /**
   * Delete database.
   */
  async deleteDatabase(
    name: string,
    tenant: string = DEFAULT_TENANT
  ): Promise<void> {
    if (!name || typeof name !== "string") {
      throw new SeekdbValueError("Database name must be a non-empty string");
    }
    const internal = this._adminInternal ?? this._internal;
    const sql = `DROP DATABASE IF EXISTS \`${name}\``;
    await internal.execute(sql);
  }

  /**
   * List databases.
   */
  async listDatabases(
    limit?: number,
    offset?: number,
    tenant: string = DEFAULT_TENANT
  ): Promise<Database[]> {
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
      throw new SeekdbValueError("limit must be a non-negative integer");
    }
    if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
      throw new SeekdbValueError("offset must be a non-negative integer");
    }
    const internal = this._adminInternal ?? this._internal;
    let sql =
      "SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA";
    const params: unknown[] = [];
    if (limit !== undefined) {
      if (offset !== undefined) {
        sql += " LIMIT ?, ?";
        params.push(offset, limit);
      } else {
        sql += " LIMIT ?";
        params.push(limit);
      }
    }
    const rows = await internal.execute(
      sql,
      params.length > 0 ? params : undefined
    );
    const databases: Database[] = [];
    if (rows) {
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        const schemaName =
          (r.SCHEMA_NAME as string) ?? (r.schema_name as string) ?? "";
        const charset =
          (r.DEFAULT_CHARACTER_SET_NAME as string) ??
          (r.default_character_set_name as string) ??
          "";
        const collation =
          (r.DEFAULT_COLLATION_NAME as string) ??
          (r.default_collation_name as string) ??
          "";
        databases.push(new Database(schemaName, charset, collation));
      }
    }
    return databases;
  }
}
