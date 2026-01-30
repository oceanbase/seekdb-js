/**
 * Base client class for seekdb
 * Contains common collection management and database admin methods shared by embedded and server clients
 */

import { Collection } from "./collection.js";
import { Database } from "./database.js";
import { SQLBuilder } from "./sql-builder.js";
import {
  DEFAULT_TENANT,
  extractDistance,
  queryTableNames,
  extractTableNamesFromResult,
} from "./utils.js";
import { SeekdbValueError } from "./errors.js";
import { getEmbeddingFunction, type EmbeddingFunction } from "./embedding-function.js";
import type {
  CreateCollectionOptions,
  GetCollectionOptions,
  IInternalClient,
  DistanceMetric,
  HNSWConfiguration,
} from "./types.js";

/**
 * Base class for seekdb clients
 * Provides common collection management functionality
 */
export abstract class BaseSeekdbClient {
  protected abstract readonly _internal: IInternalClient;

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
   * Validate collection name
   */
  private validateCollectionName(name: string): void {
    if (!name || typeof name !== "string") {
      throw new SeekdbValueError("Collection name must be a non-empty string");
    }
  }

  /**
   * Get dimension from embedding function's config
   */
  private getDimensionFromEmbeddingFunction(
    embeddingFunction: EmbeddingFunction,
  ): number {
    const config = embeddingFunction.getConfig();
    const dimension = config?.dimension;

    if (typeof dimension === "number" && dimension > 0) {
      return dimension;
    }

    throw new SeekdbValueError(
      "Embedding function must provide dimension in getConfig() return value",
    );
  }

  /**
   * Normalize distance metric
   */
  private normalizeDistance(distance?: DistanceMetric): DistanceMetric {
    const normalized = (distance || "cosine") as DistanceMetric;
    const validDistances: DistanceMetric[] = ["l2", "cosine", "inner_product"];

    if (!validDistances.includes(normalized)) {
      throw new SeekdbValueError(
        `Distance must be one of: ${validDistances.join(", ")}`,
      );
    }

    return normalized;
  }

  /**
   * Load default embedding function or return undefined if not available
   */
  private async loadDefaultEmbeddingFunction(): Promise<EmbeddingFunction | undefined> {
    try {
      return await getEmbeddingFunction("default-embed");
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Resolve configuration and embedding function for collection creation
   */
  private async resolveCollectionConfig(
    configuration: HNSWConfiguration | null | undefined,
    embeddingFunction: EmbeddingFunction | null | undefined,
  ): Promise<{
    configuration: { dimension: number; distance: DistanceMetric };
    embeddingFunction: EmbeddingFunction | undefined;
  }> {
    let finalConfiguration = configuration;
    let finalEmbeddingFunction = embeddingFunction;

    // If no configuration and no embeddingFunction, use default embedding function
    if (!finalConfiguration && !finalEmbeddingFunction) {
      const defaultEf = await this.loadDefaultEmbeddingFunction();
      if (!defaultEf) {
        throw new SeekdbValueError(
          "Failed to load default embedding function. Please provide either configuration or embeddingFunction.",
        );
      }
      finalEmbeddingFunction = defaultEf;
    }

    // If no configuration but have embeddingFunction, get dimension from embeddingFunction
    if (!finalConfiguration && finalEmbeddingFunction) {
      const dimension = this.getDimensionFromEmbeddingFunction(
        finalEmbeddingFunction,
      );
      finalConfiguration = { dimension, distance: "cosine" };
    }

    // If still no configuration, throw error
    if (!finalConfiguration) {
      throw new SeekdbValueError("Configuration is required");
    }

    // Validate dimension
    const { dimension } = finalConfiguration;
    if (!dimension || dimension <= 0) {
      throw new SeekdbValueError(
        "Dimension must be a positive integer",
      );
    }

    // Normalize distance and ensure it's set
    const normalizedDistance = this.normalizeDistance(finalConfiguration.distance);

    // If both configuration and embeddingFunction are provided, validate dimension match
    if (finalEmbeddingFunction) {
      const efDimension = this.getDimensionFromEmbeddingFunction(
        finalEmbeddingFunction,
      );
      if (efDimension !== dimension) {
        throw new SeekdbValueError(
          `Dimension mismatch: configuration specifies dimension ${dimension}, but embedding function returns dimension ${efDimension}`,
        );
      }
    }

    return {
      configuration: {
        dimension,
        distance: normalizedDistance,
      },
      embeddingFunction: finalEmbeddingFunction ?? undefined,
    };
  }

  /**
   * Extract CREATE TABLE statement from query result
   */
  private extractCreateTableStatement(rows: any[]): string {
    if (!rows || rows.length === 0) {
      throw new SeekdbValueError("No rows returned from query");
    }

    const row = rows[0];
    const createTable =
      row["Create Table"] ||
      row["create table"] ||
      row["CREATE TABLE"] ||
      row["col_0"] ||
      row["col_1"] ||
      Object.values(row).find(
        (v: any) =>
          v && typeof v === "string" && /CREATE TABLE/i.test(v),
      ) as string | undefined;

    if (!createTable) {
      throw new SeekdbValueError("Failed to get CREATE TABLE statement");
    }

    return String(createTable);
  }

  /**
   * Parse dimension from CREATE TABLE statement
   */
  private parseDimensionFromCreateTable(createTable: string): number {
    const vectorMatch = createTable.match(/VECTOR\((\d+)\)/);
    if (!vectorMatch) {
      throw new SeekdbValueError(
        `Failed to parse dimension from CREATE TABLE statement`,
      );
    }
    return parseInt(vectorMatch[1], 10);
  }

  /**
   * Extract metadata from CREATE TABLE statement comment
   */
  private extractMetadataFromComment(createTable: string): any {
    const commentMatch = createTable.match(
      /COMMENT\s*=\s*'([^']*(?:''[^']*)*)'/,
    );
    if (!commentMatch) {
      return undefined;
    }

    try {
      const commentValue = commentMatch[1].replace(/''/g, "'");
      return JSON.parse(commentValue);
    } catch {
      // Ignore parse errors
      return undefined;
    }
  }

  /**
   * Create a new collection
   */
  async createCollection(
    options: CreateCollectionOptions,
  ): Promise<Collection> {
    const { name, configuration, embeddingFunction } = options;

    this.validateCollectionName(name);

    // Check if collection already exists
    if (await this.hasCollection(name)) {
      throw new SeekdbValueError(`Collection already exists: ${name}`);
    }

    // Resolve configuration and embedding function
    const {
      configuration: finalConfiguration,
      embeddingFunction: finalEmbeddingFunction,
    } = await this.resolveCollectionConfig(configuration, embeddingFunction);

    const { dimension, distance } = finalConfiguration;
    // distance is guaranteed to be set by resolveCollectionConfig
    const finalDistance = distance as DistanceMetric;

    // Build comment with configuration
    const comment = JSON.stringify({
      dimension,
      distance: finalDistance,
      embeddingFunction: finalEmbeddingFunction ? "custom" : null,
    });

    // Create table
    const sql = SQLBuilder.buildCreateTable(name, dimension, finalDistance, comment);
    await this._internal.execute(sql);

    // Create and return collection instance
    return new Collection({
      name,
      dimension,
      distance: finalDistance,
      embeddingFunction: finalEmbeddingFunction,
      client: this._internal,
    });
  }

  /**
   * Get an existing collection
   */
  async getCollection(options: GetCollectionOptions): Promise<Collection> {
    const { name, embeddingFunction } = options;

    this.validateCollectionName(name);

    // Check if collection exists
    if (!(await this.hasCollection(name))) {
      throw new SeekdbValueError(`Collection not found: ${name}`);
    }

    // Get collection metadata from SHOW CREATE TABLE
    const sql = SQLBuilder.buildShowCreateTable(name);
    const rows = await this._internal.execute(sql);

    if (!rows || rows.length === 0) {
      throw new SeekdbValueError(`Collection not found: ${name}`);
    }

    // Extract CREATE TABLE statement
    const createTable = this.extractCreateTableStatement(rows);

    // Parse dimension and distance
    const dimension = this.parseDimensionFromCreateTable(createTable);

    const distanceStr = extractDistance(rows[0]);
    if (!distanceStr) {
      throw new SeekdbValueError(
        `Failed to parse distance from collection: ${name}. CREATE TABLE: ${createTable.substring(0, 200)}`,
      );
    }
    // Normalize distance: "ip" -> "inner_product" for type compatibility
    const distance = (distanceStr === "ip"
      ? "inner_product"
      : distanceStr) as DistanceMetric;

    // Extract metadata from comment
    const metadata = this.extractMetadataFromComment(createTable);

    // If embeddingFunction is not provided (not null, but undefined), try to use default
    let finalEmbeddingFunction = embeddingFunction;
    if (embeddingFunction === undefined) {
      finalEmbeddingFunction = await this.loadDefaultEmbeddingFunction();
    }

    return new Collection({
      name,
      dimension,
      distance,
      embeddingFunction: finalEmbeddingFunction ?? undefined,
      metadata,
      client: this._internal,
    });
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<Collection[]> {
    const prefix = "c$v1$";

    // Use queryTableNames utility to get table names with multiple fallback strategies
    const result = await queryTableNames(this._internal, prefix, false);

    if (!result || result.length === 0) {
      return [];
    }

    // Extract table names from result using utility function
    const tableNames = extractTableNamesFromResult(result, prefix);

    const collections: Collection[] = [];

    for (const tableName of tableNames) {
      // Extract collection name from table name (remove "c$v1$" prefix)
      const collectionName = tableName.substring(prefix.length);

      try {
        const collection = await this.getCollection({
          name: collectionName,
          embeddingFunction: null,
        });
        collections.push(collection);
      } catch (error) {
        // Skip collections that can't be loaded
        console.warn(`Failed to load collection ${collectionName}:`, error);
      }
    }

    return collections;
  }

  /**
   * Delete a collection
   */
  async deleteCollection(name: string): Promise<void> {
    this.validateCollectionName(name);

    // Check if collection exists
    if (!(await this.hasCollection(name))) {
      throw new SeekdbValueError(`Collection not found: ${name}`);
    }

    // Drop table
    const sql = SQLBuilder.buildDropTable(name);
    await this._internal.execute(sql);
  }

  /**
   * Check if collection exists
   */
  async hasCollection(name: string): Promise<boolean> {
    if (!name || typeof name !== "string") {
      return false;
    }

    const sql = SQLBuilder.buildShowTable(name);
    const rows = await this._internal.execute(sql);

    return rows !== null && rows.length > 0;
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
      // If collection doesn't exist, create it
      if (
        error instanceof SeekdbValueError &&
        error.message.includes("not found")
      ) {
        return await this.createCollection(options);
      }
      // Re-throw other errors
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
    return new Database(schemaName, tenant ?? null, charset, collation);
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
        databases.push(new Database(schemaName, tenant ?? null, charset, collation));
      }
    }
    return databases;
  }
}
