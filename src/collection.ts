/**
 * Collection class - represents a collection of documents with vector embeddings
 */

import type { RowDataPacket } from "mysql2/promise";
import type { SeekDBClient } from "./client.js";
import { SQLBuilder } from "./sql-builder.js";
import { SeekDBValueError } from "./errors.js";
import { CollectionFieldNames } from "./utils.js";
import { FilterBuilder } from "./filters.js";
import type {
  EmbeddingFunction,
  Metadata,
  AddOptions,
  UpdateOptions,
  UpsertOptions,
  DeleteOptions,
  GetOptions,
  QueryOptions,
  HybridSearchOptions,
  GetResult,
  QueryResult,
  DistanceMetric,
} from "./types.js";

export interface CollectionConfig {
  name: string;
  dimension: number;
  distance: DistanceMetric;
  embeddingFunction?: EmbeddingFunction;
  metadata?: Metadata;
  client: SeekDBClient;
}

/**
 * Collection - manages a collection of documents with embeddings
 */
export class Collection {
  readonly name: string;
  readonly dimension: number;
  readonly distance: DistanceMetric;
  readonly embeddingFunction?: EmbeddingFunction;
  readonly metadata?: Metadata;
  private readonly client: SeekDBClient;

  constructor(config: CollectionConfig) {
    this.name = config.name;
    this.dimension = config.dimension;
    this.distance = config.distance;
    this.embeddingFunction = config.embeddingFunction;
    this.metadata = config.metadata;
    this.client = config.client;
  }

  /**
   * Execute SQL query via client
   * @internal
   */
  private async execute(sql: string, params?: unknown[]): Promise<RowDataPacket[] | null> {
    return (this.client as any).execute(sql, params);
  }

  /**
   * Validate dynamic SQL query to prevent SQL injection
   * This is used specifically for hybrid search where SQL is returned from stored procedure
   * @internal
   */
  private validateDynamicSql(sql: string): void {
    if (!sql || typeof sql !== 'string') {
      throw new SeekDBValueError("Invalid SQL query: must be a non-empty string");
    }

    // Remove SQL comments for analysis (but don't reject them as they're valid)
    // This helps us analyze the actual SQL without comment noise
    let cleanSql = sql
      .replace(/\/\*[\s\S]*?\*\//g, ' ')  // Remove /* */ comments
      .replace(/--.*$/gm, ' ')             // Remove -- comments
      .replace(/#.*$/gm, ' ')              // Remove # comments
      .trim();

    const upperSql = cleanSql.toUpperCase();

    // Must start with SELECT
    if (!upperSql.startsWith('SELECT')) {
      throw new SeekDBValueError("Invalid SQL query: must start with SELECT");
    }

    // Check for dangerous keywords that should not appear in hybrid search results
    const dangerousKeywords = [
      'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 
      'GRANT', 'REVOKE', 'TRUNCATE', 'REPLACE', 'RENAME',
      'LOAD_FILE', 'OUTFILE', 'DUMPFILE', 'INTO OUTFILE', 'INTO DUMPFILE'
    ];

    for (const keyword of dangerousKeywords) {
      // Use word boundary to avoid false positives (e.g., "UPDATE_TIME" column)
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(cleanSql)) {
        throw new SeekDBValueError(`Dangerous SQL keyword detected: ${keyword}`);
      }
    }

    // Check for multiple statements (semicolon followed by more SQL)
    const statements = cleanSql.split(';').filter(s => s.trim().length > 0);
    if (statements.length > 1) {
      throw new SeekDBValueError("Multiple SQL statements are not allowed");
    }
  }

  /**
   * Add data to collection
   */
  async add(options: AddOptions): Promise<void> {
    let { ids, embeddings, metadatas, documents } = options;

    // Normalize to arrays
    const idsArray = Array.isArray(ids) ? ids : [ids];
    let embeddingsArray = embeddings
      ? Array.isArray(embeddings[0])
        ? (embeddings as number[][])
        : [embeddings as number[]]
      : undefined;
    const metadatasArray = metadatas
      ? Array.isArray(metadatas)
        ? metadatas
        : [metadatas]
      : undefined;
    const documentsArray = documents
      ? Array.isArray(documents)
        ? documents
        : [documents]
      : undefined;

    // Handle embedding generation
    if (!embeddingsArray && documentsArray) {
      if (this.embeddingFunction) {
        embeddingsArray = await this.embeddingFunction.generate(documentsArray);
      } else {
        throw new SeekDBValueError(
          "Documents provided but no embeddings and no embedding function",
        );
      }
    }

    if (!embeddingsArray) {
      throw new SeekDBValueError(
        "Either embeddings or documents must be provided",
      );
    }

    // Build INSERT SQL using SQLBuilder
    const { sql, params } = SQLBuilder.buildInsert(this.name, {
      ids: idsArray,
      documents: documentsArray ?? undefined,
      embeddings: embeddingsArray,
      metadatas: metadatasArray ?? undefined,
    });

    await this.execute(sql, params);
  }

  /**
   * Update data in collection
   */
  async update(options: UpdateOptions): Promise<void> {
    let { ids, embeddings, metadatas, documents } = options;

    // Normalize to arrays
    const idsArray = Array.isArray(ids) ? ids : [ids];
    let embeddingsArray = embeddings
      ? Array.isArray(embeddings[0])
        ? (embeddings as number[][])
        : [embeddings as number[]]
      : undefined;
    const metadatasArray = metadatas
      ? Array.isArray(metadatas)
        ? metadatas
        : [metadatas]
      : undefined;
    const documentsArray = documents
      ? Array.isArray(documents)
        ? documents
        : [documents]
      : undefined;

    // Handle embedding generation
    // For update, embeddings are optional - only generate if documents provided and embedding function available
    if (!embeddingsArray && documentsArray && this.embeddingFunction) {
      embeddingsArray = await this.embeddingFunction.generate(documentsArray);
    }

    // Validate that at least one field is being updated
    if (!embeddingsArray && !metadatasArray && !documentsArray) {
      throw new SeekDBValueError(
        "At least one of embeddings, metadatas, or documents must be provided",
      );
    }

    // Validate lengths
    if (documentsArray && documentsArray.length !== idsArray.length) {
      throw new SeekDBValueError("Length mismatch: documents vs ids");
    }
    if (metadatasArray && metadatasArray.length !== idsArray.length) {
      throw new SeekDBValueError("Length mismatch: metadatas vs ids");
    }
    if (embeddingsArray && embeddingsArray.length !== idsArray.length) {
      throw new SeekDBValueError("Length mismatch: embeddings vs ids");
    }

    // Update each item
    for (let i = 0; i < idsArray.length; i++) {
      const id = idsArray[i];
      const updates: {
        document?: string;
        embedding?: number[];
        metadata?: Metadata;
      } = {};

      if (documentsArray && documentsArray[i]) {
        updates.document = documentsArray[i];
      }
      if (metadatasArray && metadatasArray[i]) {
        updates.metadata = metadatasArray[i];
      }
      if (embeddingsArray && embeddingsArray[i]) {
        updates.embedding = embeddingsArray[i];
      }

      if (Object.keys(updates).length === 0) {
        continue;
      }

      const { sql, params } = SQLBuilder.buildUpdate(this.name, id, updates);
      await this.execute(sql, params);
    }
  }

  /**
   * Upsert data in collection
   */
  async upsert(options: UpsertOptions): Promise<void> {
    let { ids, embeddings, metadatas, documents } = options;

    // Normalize to arrays
    const idsArray = Array.isArray(ids) ? ids : [ids];
    let embeddingsArray = embeddings
      ? Array.isArray(embeddings[0])
        ? (embeddings as number[][])
        : [embeddings as number[]]
      : undefined;
    const metadatasArray = metadatas
      ? Array.isArray(metadatas)
        ? metadatas
        : [metadatas]
      : undefined;
    const documentsArray = documents
      ? Array.isArray(documents)
        ? documents
        : [documents]
      : undefined;

    // Handle embedding generation
    if (!embeddingsArray && documentsArray && this.embeddingFunction) {
      embeddingsArray = await this.embeddingFunction.generate(documentsArray);
    }

    // Validate that at least one field is provided
    if (!embeddingsArray && !metadatasArray && !documentsArray) {
      throw new SeekDBValueError(
        "At least one of embeddings, metadatas, or documents must be provided",
      );
    }

    // Upsert each item
    for (let i = 0; i < idsArray.length; i++) {
      const id = idsArray[i];

      // Check if record exists
      const existing = await this.get({
        ids: [id],
        include: ["documents", "metadatas", "embeddings"],
      });

      const doc = documentsArray?.[i];
      const meta = metadatasArray?.[i];
      const vec = embeddingsArray?.[i];

      if (existing.ids.length > 0) {
        // Update existing record
        const updates: {
          document?: string;
          embedding?: number[];
          metadata?: Metadata;
        } = {};

        if (doc !== undefined) {
          updates.document = doc;
        }
        if (meta !== undefined) {
          updates.metadata = meta;
        }
        if (vec !== undefined) {
          updates.embedding = vec;
        }

        if (Object.keys(updates).length > 0) {
          const { sql, params } = SQLBuilder.buildUpdate(this.name, id, updates);
          await this.execute(sql, params);
        }
      } else {
        // Insert new record using add method
        await this.add({
          ids: [id],
          documents: doc ? [doc] : undefined,
          metadatas: meta ? [meta] : undefined,
          embeddings: vec ? [vec] : undefined,
        });
      }
    }
  }

  /**
   * Delete data from collection
   */
  async delete(options: DeleteOptions): Promise<void> {
    const { ids, where, whereDocument } = options;

    // Validate at least one filter
    if (!ids && !where && !whereDocument) {
      throw new SeekDBValueError(
        "At least one of ids, where, or whereDocument must be provided",
      );
    }

    // Build DELETE SQL using SQLBuilder
    const { sql, params } = SQLBuilder.buildDelete(this.name, {
      ids: ids ? (Array.isArray(ids) ? ids : [ids]) : undefined,
      where,
      whereDocument,
    });

    await this.execute(sql, params);
  }

  /**
   * Get data from collection
   */
  async get<TMeta extends Metadata = Metadata>(
    options: GetOptions = {},
  ): Promise<GetResult<TMeta>> {
    const {
      ids: filterIds,
      limit,
      offset,
      include,
      where,
      whereDocument,
    } = options;

    // Build SELECT SQL using SQLBuilder
    const { sql, params } = SQLBuilder.buildSelect(this.name, {
      ids: filterIds
        ? Array.isArray(filterIds)
          ? filterIds
          : [filterIds]
        : undefined,
      where,
      whereDocument,
      limit,
      offset,
      include: include as string[] | undefined,
    });

    const rows = await this.execute(sql, params);

    // Use mutable arrays internally, then return as readonly
    const resultIds: string[] = [];
    const resultDocuments: (string | null)[] = [];
    const resultMetadatas: (TMeta | null)[] = [];
    const resultEmbeddings: (number[] | null)[] = [];

    if (rows) {
      for (const row of rows) {
        resultIds.push(row[CollectionFieldNames.ID].toString());

        if (!include || include.includes("documents")) {
          resultDocuments.push(row[CollectionFieldNames.DOCUMENT]);
        }

        if (!include || include.includes("metadatas")) {
          const meta = row[CollectionFieldNames.METADATA];
          resultMetadatas.push(
            meta ? (typeof meta === "string" ? JSON.parse(meta) : meta) : null,
          );
        }

        if (!include || include.includes("embeddings")) {
          const vec = row[CollectionFieldNames.EMBEDDING];
          resultEmbeddings.push(
            vec ? (typeof vec === "string" ? JSON.parse(vec) : vec) : null,
          );
        }
      }
    }

    const result: GetResult<TMeta> = {
      ids: resultIds,
      documents:
        !include || include.includes("documents") ? resultDocuments : undefined,
      metadatas:
        !include || include.includes("metadatas") ? resultMetadatas : undefined,
      embeddings:
        !include || include.includes("embeddings")
          ? resultEmbeddings
          : undefined,
    };

    return result;
  }

  /**
   * Query collection with vector similarity search
   */
  async query<TMeta extends Metadata = Metadata>(
    options: QueryOptions,
  ): Promise<QueryResult<TMeta>> {
    let {
      queryEmbeddings,
      queryTexts,
      nResults = 10,
      where,
      whereDocument,
      include,
    } = options;

    // Handle embedding generation
    if (!queryEmbeddings && queryTexts) {
      if (this.embeddingFunction) {
        const textsArray = Array.isArray(queryTexts)
          ? queryTexts
          : [queryTexts];
        queryEmbeddings = await this.embeddingFunction.generate(textsArray);
      } else {
        throw new SeekDBValueError(
          "queryTexts provided but no queryEmbeddings and no embedding function",
        );
      }
    }

    if (!queryEmbeddings) {
      throw new SeekDBValueError(
        "Either queryEmbeddings or queryTexts must be provided",
      );
    }

    // Normalize to 2D array
    const embeddingsArray = Array.isArray(queryEmbeddings[0])
      ? (queryEmbeddings as number[][])
      : [queryEmbeddings as number[]];

    const allIds: string[][] = [];
    const allDocuments: (string | null)[][] = [];
    const allMetadatas: (TMeta | null)[][] = [];
    const allEmbeddings: number[][][] = [];
    const allDistances: number[][] = [];

    // Query for each vector
    for (const queryVector of embeddingsArray) {
      // Build vector query SQL using SQLBuilder
      const { sql, params } = SQLBuilder.buildVectorQuery(
        this.name,
        queryVector,
        nResults,
        {
          where,
          whereDocument,
          include: include as string[] | undefined,
        },
      );

      const rows = await this.execute(sql, params);

      const queryIds: string[] = [];
      const queryDocuments: (string | null)[] = [];
      const queryMetadatas: (TMeta | null)[] = [];
      const queryEmbeddings: number[][] = [];
      const queryDistances: number[] = [];

      if (rows) {
        for (const row of rows) {
          queryIds.push(row[CollectionFieldNames.ID].toString());

          if (!include || include.includes("documents")) {
            queryDocuments.push(row[CollectionFieldNames.DOCUMENT] || null);
          }

          if (!include || include.includes("metadatas")) {
            const meta = row[CollectionFieldNames.METADATA];
            queryMetadatas.push(
              meta
                ? typeof meta === "string"
                  ? JSON.parse(meta)
                  : meta
                : null,
            );
          }

          if (include?.includes("embeddings")) {
            const vec = row[CollectionFieldNames.EMBEDDING];
            queryEmbeddings.push(
              vec ? (typeof vec === "string" ? JSON.parse(vec) : vec) : null,
            );
          }

          queryDistances.push(row.distance);
        }
      }

      allIds.push(queryIds);
      if (!include || include.includes("documents")) {
        allDocuments.push(queryDocuments);
      }
      if (!include || include.includes("metadatas")) {
        allMetadatas.push(queryMetadatas);
      }
      if (include?.includes("embeddings")) {
        allEmbeddings.push(queryEmbeddings);
      }
      allDistances.push(queryDistances);
    }

    const result: QueryResult<TMeta> = {
      ids: allIds,
      distances: allDistances,
      documents:
        !include || include.includes("documents") ? allDocuments : undefined,
      metadatas:
        !include || include.includes("metadatas") ? allMetadatas : undefined,
      embeddings: include?.includes("embeddings") ? allEmbeddings : undefined,
    };

    return result;
  }

  /**
   * Build knn expression from knn options
   * 
   * @param knn Vector search configuration with:
   *   - queryTexts: Query text(s) to be embedded (optional if queryEmbeddings provided)
   *   - queryEmbeddings: Query vector(s) (optional if queryTexts provided)
   *   - where: Metadata filter conditions (optional)
   *   - nResults: Number of results for vector search (optional, default 10)
   * @returns knn expression object with optional filter
   * @private
   */
  private async _buildKnnExpression(
    knn: HybridSearchOptions["knn"],
  ): Promise<any | null> {
    if (!knn) {
      return null;
    }

    const queryTexts = knn.queryTexts;
    const queryEmbeddings = knn.queryEmbeddings;
    const where = knn.where;
    const nResults = knn.nResults || 10;

    // Handle vector generation logic:
    // 1. If queryEmbeddings are provided, use them directly without embedding
    // 2. If queryEmbeddings are not provided but queryTexts are provided:
    //    - If embeddingFunction is provided, use it to generate embeddings from queryTexts
    //    - If embeddingFunction is not provided, raise an error
    // 3. If neither queryEmbeddings nor queryTexts are provided, raise an error

    let queryVector: number[] | null = null;

    if (queryEmbeddings) {
      // Query embeddings provided, use them directly without embedding
      if (Array.isArray(queryEmbeddings) && queryEmbeddings.length > 0) {
        if (Array.isArray(queryEmbeddings[0])) {
          queryVector = queryEmbeddings[0]; // Use first vector
        } else {
          queryVector = queryEmbeddings as number[];
        }
      }
    } else if (queryTexts) {
      // Query embeddings not provided but queryTexts are provided, check for embeddingFunction
      if (this.embeddingFunction) {
        try {
          const textsArray = Array.isArray(queryTexts)
            ? queryTexts
            : [queryTexts];
          const embeddings = await this.embeddingFunction.generate(textsArray);
          if (embeddings && embeddings.length > 0) {
            queryVector = embeddings[0];
          }
        } catch (error) {
          throw new SeekDBValueError(
            `Failed to generate embeddings from queryTexts: ${error}`,
          );
        }
      } else {
        throw new SeekDBValueError(
          "knn.queryTexts provided but no knn.queryEmbeddings and no embedding function. " +
            "Either:\n" +
            "  1. Provide knn.queryEmbeddings directly, or\n" +
            "  2. Provide embedding function to auto-generate embeddings from knn.queryTexts.",
        );
      }
    } else {
      // Neither queryEmbeddings nor queryTexts provided, raise an error
      throw new SeekDBValueError(
        "knn requires either queryEmbeddings or queryTexts. " +
          "Please provide either:\n" +
          "  1. knn.queryEmbeddings directly, or\n" +
          "  2. knn.queryTexts with embedding function to generate embeddings.",
      );
    }

    if (!queryVector) {
      return null;
    }

    // Build knn expression - field order matches Python SDK
    const knnExpr: any = {
      field: "embedding",
      k: nResults,
      query_vector: queryVector,
    };

    // Add filter if where conditions provided
    if (where) {
      knnExpr.filter = this.buildMetadataFilter(where);
    }

    return knnExpr;
  }

  /**
   * Hybrid search (full-text + vector)
   */
  async hybridSearch<TMeta extends Metadata = Metadata>(
    options: HybridSearchOptions,
  ): Promise<QueryResult<TMeta>> {
    const { query, knn, rank, nResults = 10, include } = options;

    // Build search_parm JSON
    const searchParm: any = {};

    // Handle query (full-text search and/or metadata filtering)
    if (query) {
      const queryExpr = this.buildCompleteQueryExpression(query);
      if (queryExpr) {
        searchParm.query = queryExpr;
      }
    }

    // Handle knn (vector search)
    const knnExpr = await this._buildKnnExpression(knn);
    if (knnExpr) {
      searchParm.knn = knnExpr;
    }

    // Handle rank (RRF) - convert camelCase to snake_case for server
    if (rank?.rrf) {
      const rrfConfig: any = {};
      if (rank.rrf.rankWindowSize !== undefined) {
        rrfConfig.rank_window_size = rank.rrf.rankWindowSize;
      }
      if (rank.rrf.rankConstant !== undefined) {
        rrfConfig.rank_constant = rank.rrf.rankConstant;
      }
      searchParm.rank = {
        rrf: rrfConfig,
      };
    }

    // Set final result size
    if (nResults) {
      searchParm.size = nResults;
    }

    // Execute hybrid search using DBMS_HYBRID_SEARCH
    const searchParmJson = JSON.stringify(searchParm);
    const tableName = `c$v1$${this.name}`;

    // Set search_parm variable
    const { sql: setVarSql, params: setVarParams } = SQLBuilder.buildSetVariable(
      "search_parm",
      searchParmJson,
    );
    await this.execute(setVarSql, setVarParams);

    // Get SQL query from DBMS_HYBRID_SEARCH.GET_SQL
    const getSqlQuery = SQLBuilder.buildHybridSearchGetSql(tableName);
    const getSqlResult = await this.execute(getSqlQuery);

    if (
      !getSqlResult ||
      getSqlResult.length === 0 ||
      !getSqlResult[0].query_sql
    ) {
      return {
        ids: [[]],
        distances: [[]],
        metadatas: [[]],
        documents: [[]],
        embeddings: [[]],
      };
    }

    // Execute the returned SQL query with security validation
    const querySql = getSqlResult[0].query_sql
      .trim()
      .replace(/^['"]|['"]$/g, "");
    
    // Security check: Validate the SQL query before execution
    this.validateDynamicSql(querySql);
    
    const resultRows = await this.execute(querySql);

    // Transform results
    const ids: string[] = [];
    const documents: (string | null)[] = [];
    const metadatas: (TMeta | null)[] = [];
    const embeddings: number[][] = [];
    const distances: number[] = [];

    if (resultRows) {
      for (const row of resultRows) {
        ids.push(row[CollectionFieldNames.ID].toString());

        if (!include || include.includes("documents")) {
          documents.push(row[CollectionFieldNames.DOCUMENT] || null);
        }

        if (!include || include.includes("metadatas")) {
          const meta = row[CollectionFieldNames.METADATA];
          metadatas.push(
            meta ? (typeof meta === "string" ? JSON.parse(meta) : meta) : null,
          );
        }

        if (include?.includes("embeddings")) {
          const vec = row[CollectionFieldNames.EMBEDDING];
          embeddings.push(
            vec ? (typeof vec === "string" ? JSON.parse(vec) : vec) : null,
          );
        }

        // Distance field might be named "_distance" or "distance"
        if (row._distance !== undefined) {
          distances.push(row._distance);
        } else if (row.distance !== undefined) {
          distances.push(row.distance);
        }
      }
    }

    // Return in query-compatible format (nested arrays)
    const result: QueryResult<TMeta> = {
      ids: [ids],
      distances: [distances],
      documents:
        !include || include.includes("documents") ? [documents] : undefined,
      metadatas:
        !include || include.includes("metadatas") ? [metadatas] : undefined,
      embeddings: include?.includes("embeddings") ? [embeddings] : undefined,
    };

    return result;
  }

  /**
   * Build document query from whereDocument filter
   * Converts whereDocument conditions into query_string format compatible with DBMS_HYBRID_SEARCH
   * @private
   */
  private buildDocumentQuery(whereDocument: any): any {
    if (!whereDocument) {
      return null;
    }

    // Handle simple $contains
    if (whereDocument.$contains) {
      return {
        query_string: {
          fields: ["document"],
          query: whereDocument.$contains,
        },
      };
    }

    // Handle $and with $contains - merge into single query_string with space (AND semantic)
    if (whereDocument.$and && Array.isArray(whereDocument.$and)) {
      const containsQueries: string[] = [];
      for (const condition of whereDocument.$and) {
        if (condition && condition.$contains) {
          containsQueries.push(condition.$contains);
        }
      }
      if (containsQueries.length > 0) {
        return {
          query_string: {
            fields: ["document"],
            query: containsQueries.join(" "), // Space = AND in query_string
          },
        };
      }
    }

    // Handle $or with $contains - merge into single query_string with OR
    if (whereDocument.$or && Array.isArray(whereDocument.$or)) {
      const containsQueries: string[] = [];
      for (const condition of whereDocument.$or) {
        if (condition && condition.$contains) {
          containsQueries.push(condition.$contains);
        }
      }
      if (containsQueries.length > 0) {
        return {
          query_string: {
            fields: ["document"],
            query: containsQueries.join(" OR "), // Explicit OR operator
          },
        };
      }
    }

    // Handle $regex
    if (whereDocument.$regex) {
      return {
        regexp: {
          document: whereDocument.$regex,
        },
      };
    }

    // Default case for string (treat as $contains)
    if (typeof whereDocument === "string") {
      return {
        query_string: {
          fields: ["document"],
          query: whereDocument,
        },
      };
    }

    return null;
  }

  /**
   * Build complete query expression from query object
   * Handles both metadata filtering (where) and full-text search (whereDocument)
   * @private
   */
  private buildCompleteQueryExpression(query: any): any {
    if (!query) {
      return null;
    }

    const whereDocument = query.whereDocument;
    const where = query.where;

    // Case 1: Metadata filtering only (no full-text search)
    if (!whereDocument && where) {
      const filterConditions = this.buildMetadataFilter(where);
      if (filterConditions && filterConditions.length > 0) {
        // Optimize for single condition
        if (filterConditions.length === 1) {
          const cond = filterConditions[0];
          // Check if it's a simple range or term query
          if (cond.range && !cond.term && !cond.bool) {
            return { range: cond.range };
          } else if (cond.term && !cond.range && !cond.bool) {
            return { term: cond.term };
          } else {
            return { bool: { filter: filterConditions } };
          }
        }
        return { bool: { filter: filterConditions } };
      }
    }

    // Case 2: Full-text search (with or without metadata filtering)
    if (whereDocument) {
      const docQuery = this.buildDocumentQuery(whereDocument);
      if (docQuery) {
        const filterConditions = this.buildMetadataFilter(where);

        if (filterConditions && filterConditions.length > 0) {
          // Full-text search + metadata filtering
          return {
            bool: {
              must: [docQuery],
              filter: filterConditions,
            },
          };
        } else {
          // Full-text search only
          return docQuery;
        }
      }
    }

    return null;
  }

  /**
   * Build metadata filter for search_parm in hybrid search
   * Uses JSON_EXTRACT format for field names
   * @private
   */
  private buildMetadataFilter(where: any): any {
    if (!where) {
      return {};
    }

    const filterConditions = FilterBuilder.buildHybridSearchFilter(where);
    if (filterConditions && filterConditions.length > 0) {
      return filterConditions;
    }
    return {};
  }

  /**
   * Count items in collection
   */
  async count(): Promise<number> {
    const sql = SQLBuilder.buildCount(this.name);
    const rows = await this.execute(sql);
    if (!rows || rows.length === 0) return 0;
    return rows[0].cnt;
  }

  /**
   * Get detailed collection information
   *
   * @returns Object containing collection metadata
   *
   * @example
   * ```typescript
   * const info = await collection.describe();
   * console.log(`Name: ${info.name}, Dimension: ${info.dimension}`);
   * ```
   */
  async describe(): Promise<{
    name: string;
    dimension: number;
    distance: DistanceMetric;
    metadata?: Metadata;
  }> {
    return {
      name: this.name,
      dimension: this.dimension,
      distance: this.distance,
      metadata: this.metadata,
    };
  }

  /**
   * Peek at first N items in collection
   *
   * @param limit - Number of items to preview (default: 10)
   * @returns GetResult containing preview data
   *
   * @example
   * ```typescript
   * const preview = await collection.peek(5);
   * for (let i = 0; i < preview.ids.length; i++) {
   *   console.log(`ID: ${preview.ids[i]}, Document: ${preview.documents[i]}`);
   * }
   * ```
   */
  async peek<TMeta extends Metadata = Metadata>(
    limit: number = 10,
  ): Promise<GetResult<TMeta>> {
    return this.get<TMeta>({
      limit,
      include: ["documents", "metadatas", "embeddings"],
    });
  }
}
