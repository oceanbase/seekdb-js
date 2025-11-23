/**
 * Collection class - represents a collection of documents with vector embeddings
 */

import type { RowDataPacket } from 'mysql2/promise';
import type { SeekDBClient } from './client.js';
import { SQLBuilder } from './sql-builder.js';
import { SeekDBValueError } from './errors.js';
import { CollectionFieldNames } from './utils.js';
import { FilterBuilder } from './filters.js';
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
} from './types.js';

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
  private async execute(sql: string): Promise<RowDataPacket[] | null> {
    return (this.client as any).execute(sql);
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
        embeddingsArray = await this.embeddingFunction(documentsArray);
      } else {
        throw new SeekDBValueError(
          'Documents provided but no embeddings and no embedding function'
        );
      }
    }

    if (!embeddingsArray) {
      throw new SeekDBValueError('Either embeddings or documents must be provided');
    }

    // Build INSERT SQL using SQLBuilder
    const sql = SQLBuilder.buildInsert(this.name, {
      ids: idsArray,
      documents: documentsArray ?? undefined,
      embeddings: embeddingsArray,
      metadatas: metadatasArray ?? undefined,
    });

    await this.execute(sql);
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
      embeddingsArray = await this.embeddingFunction(documentsArray);
    }

    // Validate that at least one field is being updated
    if (!embeddingsArray && !metadatasArray && !documentsArray) {
      throw new SeekDBValueError(
        'At least one of embeddings, metadatas, or documents must be provided'
      );
    }

    // Validate lengths
    if (documentsArray && documentsArray.length !== idsArray.length) {
      throw new SeekDBValueError('Length mismatch: documents vs ids');
    }
    if (metadatasArray && metadatasArray.length !== idsArray.length) {
      throw new SeekDBValueError('Length mismatch: metadatas vs ids');
    }
    if (embeddingsArray && embeddingsArray.length !== idsArray.length) {
      throw new SeekDBValueError('Length mismatch: embeddings vs ids');
    }

    // Update each item
    for (let i = 0; i < idsArray.length; i++) {
      const id = idsArray[i];
      const updates: { document?: string; embedding?: number[]; metadata?: Metadata } = {};

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

      const sql = SQLBuilder.buildUpdate(this.name, id, updates);
      await this.execute(sql);
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
      embeddingsArray = await this.embeddingFunction(documentsArray);
    }

    // Validate that at least one field is provided
    if (!embeddingsArray && !metadatasArray && !documentsArray) {
      throw new SeekDBValueError(
        'At least one of embeddings, metadatas, or documents must be provided'
      );
    }

    // Upsert each item
    for (let i = 0; i < idsArray.length; i++) {
      const id = idsArray[i];

      // Check if record exists
      const existing = await this.get({
        ids: [id],
        include: ['documents', 'metadatas', 'embeddings'],
      });

      const doc = documentsArray?.[i];
      const meta = metadatasArray?.[i];
      const vec = embeddingsArray?.[i];

      if (existing.ids.length > 0) {
        // Update existing record
        const updates: { document?: string; embedding?: number[]; metadata?: Metadata } = {};

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
          const sql = SQLBuilder.buildUpdate(this.name, id, updates);
          await this.execute(sql);
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
        'At least one of ids, where, or whereDocument must be provided'
      );
    }

    // Build DELETE SQL using SQLBuilder
    const sql = SQLBuilder.buildDelete(this.name, {
      ids: ids ? (Array.isArray(ids) ? ids : [ids]) : undefined,
      where,
      whereDocument,
    });

    await this.execute(sql);
  }

  /**
   * Get data from collection
   */
  async get<TMeta extends Metadata = Metadata>(options: GetOptions = {}): Promise<GetResult<TMeta>> {
    const { ids: filterIds, limit, offset, include, where, whereDocument } = options;

    // Build SELECT SQL using SQLBuilder
    const sql = SQLBuilder.buildSelect(this.name, {
      ids: filterIds ? (Array.isArray(filterIds) ? filterIds : [filterIds]) : undefined,
      where,
      whereDocument,
      limit,
      offset,
      include: include as string[] | undefined,
    });

    const rows = await this.execute(sql);

    // Use mutable arrays internally, then return as readonly
    const resultIds: string[] = [];
    const resultDocuments: (string | null)[] = [];
    const resultMetadatas: (TMeta | null)[] = [];
    const resultEmbeddings: (number[] | null)[] = [];

    if (rows) {
      for (const row of rows) {
        resultIds.push(row[CollectionFieldNames.ID].toString());

        if (!include || include.includes('documents')) {
          resultDocuments.push(row[CollectionFieldNames.DOCUMENT]);
        }

        if (!include || include.includes('metadatas')) {
          const meta = row[CollectionFieldNames.METADATA];
          resultMetadatas.push(meta ? (typeof meta === 'string' ? JSON.parse(meta) : meta) : null);
        }

        if (!include || include.includes('embeddings')) {
          const vec = row[CollectionFieldNames.EMBEDDING];
          resultEmbeddings.push(vec ? (typeof vec === 'string' ? JSON.parse(vec) : vec) : null);
        }
      }
    }

    const result: GetResult<TMeta> = {
      ids: resultIds,
      documents: (!include || include.includes('documents')) ? resultDocuments : undefined,
      metadatas: (!include || include.includes('metadatas')) ? resultMetadatas : undefined,
      embeddings: (!include || include.includes('embeddings')) ? resultEmbeddings : undefined,
    };

    return result;
  }

  /**
   * Query collection with vector similarity search
   */
  async query<TMeta extends Metadata = Metadata>(
    options: QueryOptions
  ): Promise<QueryResult<TMeta>> {
    let { queryEmbeddings, queryTexts, nResults = 10, where, whereDocument, include } = options;

    // Handle embedding generation
    if (!queryEmbeddings && queryTexts) {
      if (this.embeddingFunction) {
        const textsArray = Array.isArray(queryTexts) ? queryTexts : [queryTexts];
        queryEmbeddings = await this.embeddingFunction(textsArray);
      } else {
        throw new SeekDBValueError(
          'queryTexts provided but no queryEmbeddings and no embedding function'
        );
      }
    }

    if (!queryEmbeddings) {
      throw new SeekDBValueError(
        'Either queryEmbeddings or queryTexts must be provided'
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
      const sql = SQLBuilder.buildVectorQuery(this.name, queryVector, nResults, {
        where,
        whereDocument,
        include: include as string[] | undefined,
      });

      const rows = await this.execute(sql);

      const queryIds: string[] = [];
      const queryDocuments: (string | null)[] = [];
      const queryMetadatas: (TMeta | null)[] = [];
      const queryEmbeddings: number[][] = [];
      const queryDistances: number[] = [];

      if (rows) {
        for (const row of rows) {
          queryIds.push(row[CollectionFieldNames.ID].toString());

          if (!include || include.includes('documents')) {
            queryDocuments.push(row[CollectionFieldNames.DOCUMENT] || null);
          }

          if (!include || include.includes('metadatas')) {
            const meta = row[CollectionFieldNames.METADATA];
            queryMetadatas.push(meta ? (typeof meta === 'string' ? JSON.parse(meta) : meta) : null);
          }

          if (include?.includes('embeddings')) {
            const vec = row[CollectionFieldNames.EMBEDDING];
            queryEmbeddings.push(vec ? (typeof vec === 'string' ? JSON.parse(vec) : vec) : null);
          }

          queryDistances.push(row.distance);
        }
      }

      allIds.push(queryIds);
      if (!include || include.includes('documents')) {
        allDocuments.push(queryDocuments);
      }
      if (!include || include.includes('metadatas')) {
        allMetadatas.push(queryMetadatas);
      }
      if (include?.includes('embeddings')) {
        allEmbeddings.push(queryEmbeddings);
      }
      allDistances.push(queryDistances);
    }

    const result: QueryResult<TMeta> = {
      ids: allIds,
      distances: allDistances,
      documents: (!include || include.includes('documents')) ? allDocuments : undefined,
      metadatas: (!include || include.includes('metadatas')) ? allMetadatas : undefined,
      embeddings: include?.includes('embeddings') ? allEmbeddings : undefined,
    };

    return result;
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

    // Handle query (full-text search)
    if (query) {
      const queryObj: any = {};
      if (query.whereDocument) {
        // Build query expression from whereDocument
        queryObj.query = this.buildQueryExpression(query.whereDocument);
      }
      if (query.where) {
        // Build filter from metadata conditions
        queryObj.filter = this.buildMetadataFilter(query.where);
      }
      if (query.nResults) {
        queryObj.size = query.nResults;
      }
      searchParm.query = queryObj;
    }

    // Handle knn (vector search)
    if (knn) {
      let queryEmbeddings = knn.queryEmbeddings;

      // Generate embeddings from query texts if needed
      if (!queryEmbeddings && knn.queryTexts) {
        if (this.embeddingFunction) {
          const textsArray = Array.isArray(knn.queryTexts)
            ? knn.queryTexts
            : [knn.queryTexts];
          queryEmbeddings = await this.embeddingFunction(textsArray);
        } else {
          throw new SeekDBValueError(
            'knn.queryTexts provided but no embedding function'
          );
        }
      }

      if (!queryEmbeddings) {
        throw new SeekDBValueError(
          'knn must include either queryEmbeddings or queryTexts'
        );
      }

      // Normalize to 2D array
      const embeddingsArray = Array.isArray(queryEmbeddings[0])
        ? (queryEmbeddings as number[][])
        : [queryEmbeddings as number[]];

      const knnObj: any = {
        query_vector: embeddingsArray[0], // Use first vector
      };

      if (knn.where) {
        knnObj.filter = this.buildMetadataFilter(knn.where);
      }
      if (knn.nResults) {
        knnObj.k = knn.nResults;
      }

      searchParm.knn = knnObj;
    }

    // Handle rank (RRF)
    if (rank?.rrf) {
      searchParm.rank = {
        rrf: rank.rrf,
      };
    }

    // Set final result size
    if (nResults) {
      searchParm.size = nResults;
    }

    // Execute hybrid search using DBMS_HYBRID_SEARCH
    const searchParmJson = JSON.stringify(searchParm);

    try {
      const tableName = `c$v1$${this.name}`;
      
      // Set search_parm variable (like Python SDK does)
      const setVarSql = SQLBuilder.buildSetVariable('search_parm', searchParmJson);
      console.log('[DEBUG] SET SQL:', setVarSql.substring(0, 100), '...');
      await this.execute(setVarSql);

      // Get SQL query from DBMS_HYBRID_SEARCH.GET_SQL
      const getSqlQuery = SQLBuilder.buildHybridSearchGetSql(tableName);
      console.log('[DEBUG] GET_SQL query:', getSqlQuery);
      const getSqlResult = await this.execute(getSqlQuery);

      if (!getSqlResult || getSqlResult.length === 0 || !getSqlResult[0].query_sql) {
        console.warn('No SQL query returned from GET_SQL');
        return {
          ids: [[]],
          distances: [[]],
          metadatas: [[]],
          documents: [[]],
          embeddings: [[]],
        };
      }

      // Execute the returned SQL query
      const querySql = getSqlResult[0].query_sql.trim().replace(/^['"]|['"]$/g, '');
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

          if (!include || include.includes('documents')) {
            documents.push(row[CollectionFieldNames.DOCUMENT] || null);
          }

          if (!include || include.includes('metadatas')) {
            const meta = row[CollectionFieldNames.METADATA];
            metadatas.push(meta ? (typeof meta === 'string' ? JSON.parse(meta) : meta) : null);
          }

          if (include?.includes('embeddings')) {
            const vec = row[CollectionFieldNames.EMBEDDING];
            embeddings.push(vec ? (typeof vec === 'string' ? JSON.parse(vec) : vec) : null);
          }

          if (row.distance !== undefined) {
            distances.push(row.distance);
          }
        }
      }

      // Return in query-compatible format (nested arrays)
      const result: QueryResult<TMeta> = {
        ids: [ids],
        distances: [distances],
        documents: (!include || include.includes('documents')) ? [documents] : undefined,
        metadatas: (!include || include.includes('metadatas')) ? [metadatas] : undefined,
        embeddings: include?.includes('embeddings') ? [embeddings] : undefined,
      };

      return result;
    } catch (error: any) {
      // Handle DBMS_HYBRID_SEARCH not supported or SQL errors
      const errorMsg = error.message || '';
      
      // 添加详细错误日志用于调试
      console.error('[DEBUG] Hybrid search error:', errorMsg);
      console.error('[DEBUG] Error code:', error.code);
      console.error('[DEBUG] Error errno:', error.errno);
      
      if (errorMsg.includes('Not supported feature or function') || 
          errorMsg.includes('SQL syntax') ||
          errorMsg.includes('DBMS_HYBRID_SEARCH') ||
          errorMsg.includes('Unknown database function')) {
        console.warn('DBMS_HYBRID_SEARCH is not supported on this database version');
        console.warn('Falling back to empty result. Please use query() for vector search instead.');
        return {
          ids: [[]],
          distances: [[]],
          metadatas: include?.includes('metadatas') ? [[]] : undefined,
          documents: include?.includes('documents') ? [[]] : undefined,
          embeddings: include?.includes('embeddings') ? [[]] : undefined,
        };
      }
      throw error;
    }
  }

  /**
   * Build query expression from whereDocument filter
   * @private
   */
  private buildQueryExpression(whereDocument: any): any {
    if (whereDocument.$contains) {
      return {
        query_string: {
          query: whereDocument.$contains,
        },
      };
    }
    if (whereDocument.$regex) {
      return {
        regexp: {
          document: whereDocument.$regex,
        },
      };
    }
    // Handle logical operators
    if (whereDocument.$and && Array.isArray(whereDocument.$and)) {
      return {
        bool: {
          must: whereDocument.$and.map((cond: any) => this.buildQueryExpression(cond)),
        },
      };
    }
    if (whereDocument.$or && Array.isArray(whereDocument.$or)) {
      return {
        bool: {
          should: whereDocument.$or.map((cond: any) => this.buildQueryExpression(cond)),
        },
      };
    }
    return {};
  }

  /**
   * Build metadata filter for search_parm
   * @private
   */
  private buildMetadataFilter(where: any): any {
    if (!where) {
      return {};
    }

    const filterConditions = FilterBuilder.buildSearchFilter(where);
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
  async peek<TMeta extends Metadata = Metadata>(limit: number = 10): Promise<GetResult<TMeta>> {
    return this.get<TMeta>({ limit, include: ['documents', 'metadatas', 'embeddings'] });
  }
}
