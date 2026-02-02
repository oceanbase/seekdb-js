/**
 * Collection class - represents a collection of documents with vector embeddings
 */

import type { IInternalClient } from "./types.js";
import { SQLBuilder } from "./sql-builder.js";
import { SeekdbValueError } from "./errors.js";
import {
  CollectionFieldNames,
  CollectionNames,
  normalizeValue,
  parseEmbeddingBinary,
  parseEmbeddingBinaryString,
} from "./utils.js";
import { FilterBuilder, SearchFilterCondition } from "./filters.js";
import {
  CollectionMetadata,
  deleteCollectionMetadata,
  getCollectionMetadata,
  insertCollectionMetadata,
} from "./metadata-manager.js";
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
  CollectionConfig,
  CollectionContext,
  ForkOptions,
} from "./types.js";
import type { SeekdbClient } from "./client.js";

/**
 * Collection - manages a collection of documents with embeddings
 */
export class Collection {
  readonly name: string;
  readonly dimension: number;
  readonly distance: DistanceMetric;
  readonly embeddingFunction?: EmbeddingFunction;
  readonly metadata?: Metadata;
  readonly collectionId?: string; // v2 format collection ID
  readonly client?: SeekdbClient;
  #client: IInternalClient;

  constructor(config: CollectionConfig) {
    this.name = config.name;
    this.dimension = config.dimension;
    this.distance = config.distance;
    this.embeddingFunction = config.embeddingFunction;
    this.metadata = config.metadata;
    this.collectionId = config.collectionId;
    this.client = config.client;
    this.#client = config.internalClient;
  }

  /**
   * Get collection version (v1 or v2)
   * @private
   */
  private get version(): "v1" | "v2" {
    return this.collectionId ? "v2" : "v1";
  }

  /**
   * Get collection context for SQL building
   * @private
   */
  private get context(): CollectionContext {
    return {
      name: this.name,
      collectionId: this.collectionId,
      dimension: this.dimension,
      distance: this.distance,
    };
  }

  /**
   * Validate dynamic SQL query to prevent SQL injection
   * This is used specifically for hybrid search where SQL is returned from stored procedure
   * @internal
   */
  private validateDynamicSql(sql: string): void {
    if (!sql || typeof sql !== "string") {
      throw new SeekdbValueError(
        "Invalid SQL query: must be a non-empty string"
      );
    }

    // Remove SQL comments for analysis (but don't reject them as they're valid)
    // This helps us analyze the actual SQL without comment noise
    let cleanSql = sql
      .replace(/\/\*[\s\S]*?\*\//g, " ") // Remove /* */ comments
      .replace(/--.*$/gm, " ") // Remove -- comments
      .replace(/#.*$/gm, " ") // Remove # comments
      .trim();

    const upperSql = cleanSql.toUpperCase();

    // Must start with SELECT
    // For hybrid search, DBMS_HYBRID_SEARCH.GET_SQL might return empty or invalid SQL
    // if the feature is not supported, so we allow empty SQL to pass through
    if (upperSql.length > 0 && !upperSql.startsWith("SELECT")) {
      throw new SeekdbValueError("Invalid SQL query: must start with SELECT");
    }

    // Check for dangerous keywords that should not appear in hybrid search results
    const dangerousKeywords = [
      "DROP",
      "DELETE",
      "UPDATE",
      "INSERT",
      "ALTER",
      "CREATE",
      "GRANT",
      "REVOKE",
      "TRUNCATE",
      "REPLACE",
      "RENAME",
      "LOAD_FILE",
      "OUTFILE",
      "DUMPFILE",
      "INTO OUTFILE",
      "INTO DUMPFILE",
      "CALL",
      "LOAD",
    ];

    for (const keyword of dangerousKeywords) {
      // Use word boundary to avoid false positives (e.g., "UPDATE_TIME" column)
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      if (regex.test(cleanSql)) {
        throw new SeekdbValueError(
          `Dangerous SQL keyword detected: ${keyword}`
        );
      }
    }

    // Check for multiple statements (semicolon followed by more SQL)
    const statements = cleanSql.split(";").filter((s) => s.trim().length > 0);
    if (statements.length > 1) {
      throw new SeekdbValueError("Multiple SQL statements are not allowed");
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
        throw new SeekdbValueError(
          "Documents provided but no embeddings and no embedding function"
        );
      }
    }

    if (!embeddingsArray) {
      throw new SeekdbValueError(
        "Either embeddings or documents must be provided"
      );
    }

    // Validate dimension of all embeddings
    if (embeddingsArray.length > 0) {
      const dimension = this.dimension;
      for (let i = 0; i < embeddingsArray.length; i++) {
        if (embeddingsArray[i].length !== dimension) {
          throw new SeekdbValueError(
            `Dimension mismatch at index ${i}. Expected ${dimension}, got ${embeddingsArray[i].length}`
          );
        }
      }
    }

    if (idsArray.length === 0) {
      throw new SeekdbValueError("ids cannot be empty");
    }

    const { sql, params } = SQLBuilder.buildInsert(this.context, {
      ids: idsArray,
      documents: documentsArray ?? undefined,
      embeddings: embeddingsArray,
      metadatas: metadatasArray ?? undefined,
    });

    await this.#client.execute(sql, params);
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
      throw new SeekdbValueError(
        "At least one of embeddings, metadatas, or documents must be provided"
      );
    }

    // Validate lengths
    if (documentsArray && documentsArray.length !== idsArray.length) {
      throw new SeekdbValueError("Length mismatch: documents vs ids");
    }
    if (metadatasArray && metadatasArray.length !== idsArray.length) {
      throw new SeekdbValueError("Length mismatch: metadatas vs ids");
    }
    if (embeddingsArray && embeddingsArray.length !== idsArray.length) {
      throw new SeekdbValueError("Length mismatch: embeddings vs ids");
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

      const { sql, params } = SQLBuilder.buildUpdate(this.context, {
        id,
        updates,
      });
      await this.#client.execute(sql, params);
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
      throw new SeekdbValueError(
        "At least one of embeddings, metadatas, or documents must be provided"
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
          const { sql, params } = SQLBuilder.buildUpdate(this.context, {
            id,
            updates,
          });
          await this.#client.execute(sql, params);
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
      throw new SeekdbValueError(
        "At least one of ids, where, or whereDocument must be provided"
      );
    }

    // Build DELETE SQL using SQLBuilder
    const { sql, params } = SQLBuilder.buildDelete(this.context, {
      ids: ids ? (Array.isArray(ids) ? ids : [ids]) : undefined,
      where,
      whereDocument,
    });

    await this.#client.execute(sql, params);
  }


  /**
   * Get data from collection
   */
  async get<TMeta extends Metadata = Metadata>(
    options: GetOptions = {}
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
    const { sql, params } = SQLBuilder.buildSelect(this.context, {
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

    const rows = await this.#client.execute(sql, params);

    // Use mutable arrays internally, then return as readonly
    const resultIds: string[] = [];
    const resultDocuments: (string | null)[] = [];
    const resultMetadatas: (TMeta | null)[] = [];
    const resultEmbeddings: (number[] | null)[] = [];

    if (rows) {
      for (const row of rows) {
        if (!row[CollectionFieldNames.ID]) {
          throw new Error(`ID field '${CollectionFieldNames.ID}' not found in row. Available keys: ${Object.keys(row).join(", ")}`);
        }
        // Normalize values
        const idValue = normalizeValue(row[CollectionFieldNames.ID]);
        const idString = idValue !== null && idValue !== undefined ? String(idValue) : null;
        if (idString !== null) {
          resultIds.push(idString);
        }

        if (!include || include.includes("documents")) {
          const docValue = normalizeValue(row[CollectionFieldNames.DOCUMENT]);
          // Preserve null for null document (match server; round-trip add({ documents: [null] }) -> get() -> null)
          resultDocuments.push(docValue !== null && docValue !== undefined ? String(docValue) : (null as any));
        }

        if (!include || include.includes("metadatas")) {
          const meta = row[CollectionFieldNames.METADATA];
          resultMetadatas.push(
            meta ? (typeof meta === "string" ? JSON.parse(meta) : meta) : null
          );
        }

        if (!include || include.includes("embeddings")) {
          const vec = row[CollectionFieldNames.EMBEDDING];
          resultEmbeddings.push(
            vec ? (typeof vec === "string" ? JSON.parse(vec) : vec) : null
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
    options: QueryOptions
  ): Promise<QueryResult<TMeta>> {
    let {
      queryEmbeddings,
      queryTexts,
      nResults = 10,
      where,
      whereDocument,
      include,
      distance,
      approximate = true,
    } = options;

    // Handle embedding generation
    if (queryEmbeddings) {
      // Query embeddings provided, use them directly without embedding
    } else if (queryTexts) {
      if (this.embeddingFunction) {
        const textsArray = Array.isArray(queryTexts)
          ? queryTexts
          : [queryTexts];
        queryEmbeddings = await this.embeddingFunction.generate(textsArray);
      } else {
        throw new SeekdbValueError(
          "queryTexts provided but no queryEmbeddings and no embedding function"
        );
      }
    } else {
      throw new SeekdbValueError(
        "Either queryEmbeddings or queryTexts must be provided"
      );
    }

    // Normalize to 2D array
    const embeddingsArray = Array.isArray(queryEmbeddings[0])
      ? (queryEmbeddings as number[][])
      : [queryEmbeddings as number[]];

    const allIds: string[][] = [];
    const allDocuments: (string | null)[][] = [];
    const allMetadatas: (TMeta | null)[][] = [];
    const allEmbeddings: (number[] | null)[][] = [];
    const allDistances: number[][] = [];

    // Query for each vector
    for (const queryVector of embeddingsArray) {
      // Build vector query SQL using SQLBuilder
      const { sql, params } = SQLBuilder.buildVectorQuery(
        this.context,
        queryVector,
        nResults,
        {
          where,
          whereDocument,
          include: include as string[] | undefined,
          distance: distance ?? this.distance,
          approximate,
        }
      );

      const rows = await this.#client.execute(sql, params);

      const queryIds: string[] = [];
      const queryDocuments: (string | null)[] = [];
      const queryMetadatas: (TMeta | null)[] = [];
      const queryEmbeddings: (number[] | null)[] = [];
      const queryDistances: number[] = [];

      if (rows && rows.length > 0) {
        for (const row of rows) {
          if (!row[CollectionFieldNames.ID]) {
            // Row missing ID field, skip it
            continue;
          }
          const idValue = row[CollectionFieldNames.ID];
          const idValueNormalized = normalizeValue(idValue);
          const idString = idValueNormalized !== null && idValueNormalized !== undefined ? String(idValueNormalized) : null;
          if (idString !== null) {
            queryIds.push(idString);
          }

          if (!include || include.includes("documents")) {
            const docValue = normalizeValue(row[CollectionFieldNames.DOCUMENT]);
            queryDocuments.push(docValue !== null && docValue !== undefined ? String(docValue) : null);
          }

          if (!include || include.includes("metadatas")) {
            const meta = row[CollectionFieldNames.METADATA];
            queryMetadatas.push(
              meta ? (typeof meta === "string" ? JSON.parse(meta) : meta) : null
            );
          }

          if (include?.includes("embeddings")) {
            const vec = row[CollectionFieldNames.EMBEDDING];
            queryEmbeddings.push(
              vec ? (typeof vec === "string" ? JSON.parse(vec) : vec) : null
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
    knn: HybridSearchOptions["knn"]
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
          throw new SeekdbValueError(
            `Failed to generate embeddings from queryTexts: ${error}`
          );
        }
      } else {
        throw new SeekdbValueError(
          "knn.queryTexts provided but no knn.queryEmbeddings and no embedding function. " +
            "Either:\n" +
            "  1. Provide knn.queryEmbeddings directly, or\n" +
            "  2. Provide embedding function to auto-generate embeddings from knn.queryTexts."
        );
      }
    } else {
      // Neither queryEmbeddings nor queryTexts provided, raise an error
      throw new SeekdbValueError(
        "knn requires either queryEmbeddings or queryTexts. " +
          "Please provide either:\n" +
          "  1. knn.queryEmbeddings directly, or\n" +
          "  2. knn.queryTexts with embedding function to generate embeddings."
      );
    }

    if (!queryVector) {
      return null;
    }

    // Build knn expression
    const knnExpr: any = {
      field: "embedding",
      k: nResults,
      query_vector: queryVector,
    };

    // Add filter if where conditions provided
    if (where) {
      const filter = this.buildMetadataFilter(where);
      if (filter) {
        knnExpr.filter = filter;
      }
    }

    return knnExpr;
  }

  /**
   * Hybrid search (full-text + vector)
   */
  async hybridSearch<TMeta extends Metadata = Metadata>(
    options: HybridSearchOptions
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
    const tableName = CollectionNames.tableName(this.name, this.collectionId);

    // Set search_parm variable
    const { sql: setVarSql, params: setVarParams } =
      SQLBuilder.buildSetVariable("search_parm", searchParmJson);
    await this.#client.execute(setVarSql, setVarParams);

    // Get SQL query from DBMS_HYBRID_SEARCH.GET_SQL
    const getSqlQuery = SQLBuilder.buildHybridSearchGetSql(tableName);
    let getSqlResult;
    try {
      getSqlResult = await this.#client.execute(getSqlQuery);
    } catch (error: any) {
      // If DBMS_HYBRID_SEARCH is not supported, throw error so test can handle it
      const errorMsg = error.message || "";
      if (
        errorMsg.includes("SQL syntax") ||
        errorMsg.includes("DBMS_HYBRID_SEARCH") ||
        errorMsg.includes("Unknown database function") ||
        errorMsg.includes("function") ||
        errorMsg.includes("syntax")
      ) {
        throw new SeekdbValueError(
          `DBMS_HYBRID_SEARCH is not supported: ${errorMsg}`
        );
      }
      throw error;
    }

    if (
      !getSqlResult ||
      getSqlResult.length === 0 ||
      !getSqlResult[0].query_sql
    ) {
      throw new SeekdbValueError(
        "DBMS_HYBRID_SEARCH.GET_SQL returned no result"
      );
    }

    // Execute the returned SQL query with security validation
    let querySql = getSqlResult[0].query_sql;

    // Normalize querySql using generic normalization
    let normalizedSql = normalizeValue(querySql);

    // Convert to string and clean up
    if (typeof normalizedSql === 'string') {
      querySql = normalizedSql.trim().replace(/^['"]|['"]$/g, "");
    } else {
      querySql = String(normalizedSql).trim().replace(/^['"]|['"]$/g, "");
    }

    // Security check: Validate the SQL query before execution
    // If querySql is empty or invalid, it means DBMS_HYBRID_SEARCH is not supported
    if (!querySql || querySql.length === 0) {
      throw new SeekdbValueError(
        "DBMS_HYBRID_SEARCH.GET_SQL returned empty SQL (feature not supported)"
      );
    }

    // If SQL doesn't start with SELECT, it means DBMS_HYBRID_SEARCH is not supported
    const upperSql = querySql.toUpperCase().trim();
    if (!upperSql.startsWith("SELECT")) {
      throw new SeekdbValueError(
        `DBMS_HYBRID_SEARCH.GET_SQL returned invalid SQL: ${querySql.substring(0, 100)} (feature not supported)`
      );
    }

    this.validateDynamicSql(querySql);

    const resultRows = await this.#client.execute(querySql);

    // Transform results
    const ids: string[] = [];
    const documents: (string | null)[] = [];
    const metadatas: (TMeta | null)[] = [];
    const embeddings: (number[] | null)[] = [];
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
            meta ? (typeof meta === "string" ? JSON.parse(meta) : meta) : null
          );
        }

        if (include?.includes("embeddings")) {
          const vec = row[CollectionFieldNames.EMBEDDING];
          embeddings.push(
            vec ? (typeof vec === "string" ? JSON.parse(vec) : vec) : null
          );
        }

        // Distance field might be named "_distance", "distance", "_score", "score",
        // "DISTANCE", "_DISTANCE", or "SCORE"
        const distanceFields = [
          "_distance",
          "distance",
          "_score",
          "score",
          "DISTANCE",
          "_DISTANCE",
          "SCORE",
        ];
        const distanceValue = distanceFields
          .map((field) => (row as any)[field])
          .find((val) => val !== undefined);
        // Convert to number (database may return string)
        const distance =
          distanceValue !== undefined ? Number(distanceValue) : 0.0;
        distances.push(distance);
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

  async fork(options: ForkOptions): Promise<Collection> {
    const { name: targetName } = options;

    if (!this.client) {
      throw new SeekdbValueError(
        "Collection fork requires a client reference; this collection was created without one.",
      );
    }
    if (await this.client.hasCollection(targetName)) {
      throw new SeekdbValueError(
        `Collection '${targetName}' already exists. Please use a different name.`
      );
    }

    let targetCollectionId: string;
    let sourceSettings: CollectionMetadata["settings"];
    let targetCollectionName = "";

    const sourceMetadata = await getCollectionMetadata(this.#client, this.name);
    if (sourceMetadata) sourceSettings = sourceMetadata.settings;
    else {
      // if source collection has no metadata, it's a v1 collection
      sourceSettings = {
        configuration: {
          dimension: this.dimension,
          distance: this.distance,
        },
        embeddingFunction: this.embeddingFunction
          ? {
              name: this.embeddingFunction.name,
              properties: this.embeddingFunction.getConfig(),
            }
          : undefined,
      };
    }

    try {
      // coyp metadata and get collection_id
      targetCollectionId = await insertCollectionMetadata(
        this.#client,
        targetName,
        sourceSettings
      );
      targetCollectionName = CollectionNames.tableName(
        targetName,
        targetCollectionId
      );
      const sourceTableName = CollectionNames.tableName(
        this.name,
        this.collectionId
      );

      const sql = SQLBuilder.buildFork(sourceTableName, targetCollectionName);
      await this.#client.execute(sql);
    } catch (error) {
      // If table creation fails, try to clean up metadata
      try {
        await deleteCollectionMetadata(this.#client, targetName);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }

    return new Collection({
      name: targetName,
      dimension: this.dimension,
      distance: this.distance,
      embeddingFunction: this.embeddingFunction,
      client: this.client,
      internalClient: this.#client,
      collectionId: targetCollectionId,
    });
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
  private buildMetadataFilter(where: any): SearchFilterCondition[] | null {
    if (!where) {
      return null;
    }

    const filterConditions = FilterBuilder.buildHybridSearchFilter(where);
    if (filterConditions && filterConditions.length > 0) {
      return filterConditions;
    }
    return null;
  }

  /**
   * Count items in collection
   */
  async count(): Promise<number> {
    const sql = SQLBuilder.buildCount(this.context);
    const rows = await this.#client.execute(sql);
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
    limit: number = 10
  ): Promise<GetResult<TMeta>> {
    return this.get<TMeta>({
      limit,
      include: ["documents", "metadatas", "embeddings"],
    });
  }
}
