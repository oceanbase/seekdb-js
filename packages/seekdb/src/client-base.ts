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
  extractDistance,
  queryTableNames,
  extractTableNamesFromResult,
  validateCollectionName,
  resolveEmbeddingFunction,
  CollectionNames,
  CollectionFieldNames,
} from "./utils.js";
import { SeekdbValueError, InvalidCollectionError } from "./errors.js";
import { getEmbeddingFunction, supportsPersistence } from "./embedding-function.js";
import {
  insertCollectionMetadata,
  getCollectionMetadata,
  deleteCollectionMetadata,
  listCollectionMetadata,
} from "./metadata-manager.js";
import type {
  CreateCollectionOptions,
  GetCollectionOptions,
  IInternalClient,
  DistanceMetric,
  HNSWConfiguration,
  Configuration,
  FulltextAnalyzerConfig,
  EmbeddingFunction,
  Metadata,
} from "./types.js";

/**
 * Base class for seekdb clients
 * Provides common collection management functionality (v1 + v2 collections).
 */
export abstract class BaseSeekdbClient {
  protected abstract readonly _internal: IInternalClient;
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
    options: CreateCollectionOptions,
  ): Promise<Collection> {
    const { name, configuration, embeddingFunction } = options;

    validateCollectionName(name);

    if (await this.hasCollection(name)) {
      throw new SeekdbValueError(`Collection already exists: ${name}`);
    }

    let ef = embeddingFunction;
    let hnsw: HNSWConfiguration | undefined;
    let fulltextConfig: FulltextAnalyzerConfig | undefined;

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
    let dimension: number;
    let actualDimension: number | undefined;

    if (ef === undefined) {
      ef = await getEmbeddingFunction();
    }

    if (ef !== null) {
      if ("dimension" in ef && typeof ef.dimension === "number") {
        actualDimension = ef.dimension;
      } else {
        const testEmbeddings = await ef.generate(["seekdb"]);
        actualDimension = testEmbeddings[0]?.length;
        if (!actualDimension) {
          throw new SeekdbValueError(
            "Embedding function returned empty result when called with 'seekdb'",
          );
        }
      }
    }

    if (configuration === null) {
      if (ef === null || actualDimension === undefined) {
        throw new SeekdbValueError(
          "Cannot create collection: configuration is explicitly set to null and " +
          "embedding_function is also null. Cannot determine dimension without either a configuration " +
          "or an embedding function.",
        );
      }
      dimension = actualDimension;
    } else if (hnsw?.dimension !== undefined) {
      if (actualDimension !== undefined && hnsw.dimension !== actualDimension) {
        throw new SeekdbValueError(
          `Configuration dimension (${hnsw.dimension}) does not match embedding function dimension (${actualDimension})`,
        );
      }
      dimension = hnsw.dimension;
    } else {
      dimension = actualDimension ?? DEFAULT_VECTOR_DIMENSION;
    }

    let embeddingFunctionMetadata: { name: string; properties: any } | undefined;
    if (supportsPersistence(ef)) {
      embeddingFunctionMetadata = { name: ef.name, properties: ef.getConfig() };
    }

    const collectionId = await insertCollectionMetadata(this._internal, name, {
      configuration,
      embeddingFunction: embeddingFunctionMetadata,
    });

    const sql = SQLBuilder.buildCreateTable(
      name,
      dimension,
      distance,
      undefined,
      collectionId,
      fulltextConfig,
    );

    try {
      await this._internal.execute(sql);
    } catch (error) {
      try {
        await deleteCollectionMetadata(this._internal, name);
      } catch {
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
      client: this._facade as any,
      collectionId,
    });
  }

  /**
   * Extract metadata from v1 table COMMENT (JSON string).
   */
  private static extractMetadataFromComment(createTable: string): Metadata | undefined {
    const commentMatch = createTable.match(
      /COMMENT\s*=\s*'([^']*(?:''[^']*)*)'/,
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
   * Get an existing collection. Tries v2 (metadata table) first, then v1 (table-only).
   */
  async getCollection(options: GetCollectionOptions): Promise<Collection> {
    const { name, embeddingFunction } = options;

    validateCollectionName(name);

    let dimension: number;
    let distance: DistanceMetric;
    let collectionId: string | undefined;
    let embeddingFunctionConfig: { name: string; properties: any } | undefined;
    let collectionMetadata: Metadata | undefined;

    const metadata = await getCollectionMetadata(this._internal, name);

    if (metadata) {
      const { collectionId: cId, settings: { embeddingFunction: embeddingFunctionMeta, configuration } = {} } = metadata;

      const sql = SQLBuilder.buildShowTable(name, cId);
      const result = await this._internal.execute(sql);

      if (!result || result.length === 0) {
        throw new InvalidCollectionError(
          `Collection metadata exists but table not found: ${name}`,
        );
      }

      let hnsw: HNSWConfiguration | undefined;
      if (configuration) {
        if ("hnsw" in configuration) {
          hnsw = (configuration as Configuration).hnsw;
        } else {
          hnsw = configuration as HNSWConfiguration;
        }
      }

      dimension = hnsw?.dimension ?? DEFAULT_VECTOR_DIMENSION;
      distance = hnsw?.distance ?? DEFAULT_DISTANCE_METRIC;
      collectionId = cId;
      embeddingFunctionConfig = embeddingFunctionMeta;
    } else {
      const sql = SQLBuilder.buildShowTable(name);
      const result = await this._internal.execute(sql);

      if (!result || result.length === 0) {
        throw new InvalidCollectionError(`Collection not found: ${name}`);
      }

      const descSql = SQLBuilder.buildDescribeTable(name);
      const schema = await this._internal.execute(descSql);

      if (!schema) {
        throw new InvalidCollectionError(
          `Unable to retrieve schema for collection: ${name}`,
        );
      }

      const embeddingField = schema.find(
        (row: any) => row.Field === CollectionFieldNames.EMBEDDING,
      );
      if (!embeddingField) {
        throw new InvalidCollectionError(
          `Collection ${name} does not have embedding field`,
        );
      }

      const match = (embeddingField as any).Type?.match?.(/VECTOR\((\d+)\)/i);
      if (!match) {
        throw new InvalidCollectionError(
          `Invalid embedding type: ${(embeddingField as any).Type}`,
        );
      }

      dimension = parseInt(match[1], 10);
      distance = DEFAULT_DISTANCE_METRIC;

      try {
        const createTableSql = SQLBuilder.buildShowCreateTable(name);
        const createTableResult = await this._internal.execute(createTableSql);

        if (createTableResult && createTableResult.length > 0) {
          const createStmt =
            (createTableResult[0] as any)["Create Table"] ||
            (createTableResult[0] as any)["create table"] ||
            "";
          const distanceMatch = createStmt.match(
            /with\s*\([^)]*distance\s*=\s*['"]?(\w+)['"]?/i,
          );
          if (distanceMatch) {
            const parsed = distanceMatch[1].toLowerCase();
            if (parsed === "l2" || parsed === "cosine" || parsed === "inner_product" || parsed === "ip") {
              distance = (parsed === "ip" ? "inner_product" : parsed) as DistanceMetric;
            }
          }
          collectionMetadata = BaseSeekdbClient.extractMetadataFromComment(createStmt);
        }
      } catch {
        // Use default distance
      }
    }

    const ef = await resolveEmbeddingFunction(
      embeddingFunctionConfig,
      embeddingFunction,
    );

    return new Collection({
      name,
      dimension,
      distance,
      embeddingFunction: ef,
      metadata: collectionMetadata,
      internalClient: this._internal,
      client: this._facade as any,
      collectionId,
    });
  }

  /**
   * List all collections. Returns v2 collections from metadata table, then v1 (deduplicated).
   */
  async listCollections(): Promise<Collection[]> {
    const collections: Collection[] = [];
    const collectionNames = new Set<string>();

    const v2Metadata = await listCollectionMetadata(this._internal);

    for (const metadata of v2Metadata) {
      try {
        const collection = await this.getCollection({
          name: metadata.collectionName,
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
        const collectionName = CollectionNames.extractCollectionName(tableName) ?? tableName.substring(prefix.length);
        if (!collectionName || collectionNames.has(collectionName)) continue;

        try {
          const collection = await this.getCollection({ name: collectionName });
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
    options: CreateCollectionOptions,
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
        (error instanceof SeekdbValueError && error.message.includes("not found")) ||
        (error instanceof InvalidCollectionError && error.message.includes("not found"));
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
   * For embedded, use AdminClient({ path }) which connects to information_schema first.
   */
  async createDatabase(
    name: string,
    tenant: string = DEFAULT_TENANT,
  ): Promise<void> {
    if (!name || typeof name !== "string") {
      throw new SeekdbValueError("Database name must be a non-empty string");
    }
    const sql = `CREATE DATABASE IF NOT EXISTS \`${name}\``;
    await this._internal.execute(sql);
  }

  /**
   * Get database metadata.
   */
  async getDatabase(
    name: string,
    tenant: string = DEFAULT_TENANT,
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
    tenant: string = DEFAULT_TENANT,
  ): Promise<void> {
    if (!name || typeof name !== "string") {
      throw new SeekdbValueError("Database name must be a non-empty string");
    }
    const sql = `DROP DATABASE IF EXISTS \`${name}\``;
    await this._internal.execute(sql);
  }

  /**
   * List databases.
   */
  async listDatabases(
    limit?: number,
    offset?: number,
    tenant: string = DEFAULT_TENANT,
  ): Promise<Database[]> {
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
      throw new SeekdbValueError("limit must be a non-negative integer");
    }
    if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
      throw new SeekdbValueError("offset must be a non-negative integer");
    }
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
    const rows = await this._internal.execute(sql, params.length > 0 ? params : undefined);
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
