/**
 * SeekDB Client - Remote server mode (MySQL protocol)
 * Supports both SeekDB Server and OceanBase Server
 */

import mysql from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { Collection } from './collection.js';
import {
  SeekDBConnectionError,
  SeekDBValueError,
  InvalidCollectionError,
} from './errors.js';
import {
  CollectionNames,
  CollectionFieldNames,
  DEFAULT_TENANT,
  DEFAULT_DATABASE,
  DEFAULT_PORT,
  DEFAULT_USER,
  DEFAULT_CHARSET,
  DEFAULT_VECTOR_DIMENSION,
  DEFAULT_DISTANCE_METRIC,
  escapeSqlString,
  vectorToSqlString,
  serializeMetadata,
} from './utils.js';
import { FilterBuilder } from './filters.js';
import type {
  SeekDBClientArgs,
  CreateCollectionOptions,
  GetCollectionOptions,
  HNSWConfiguration,
  EmbeddingFunction,
  AddOptions,
  UpdateOptions,
  UpsertOptions,
  DeleteOptions,
  GetOptions,
  QueryOptions,
  HybridSearchOptions,
  GetResult,
  QueryResult,
  Metadata,
  DistanceMetric,
} from './types.js';

const _NOT_PROVIDED = Symbol('NOT_PROVIDED');
type NotProvided = typeof _NOT_PROVIDED;
type ConfigurationParam = HNSWConfiguration | null | undefined | NotProvided;
type EmbeddingFunctionParam = EmbeddingFunction | null | undefined | NotProvided;

/**
 * SeekDB Client for remote server connections
 */
export class SeekDBClient {
  private readonly host: string;
  private readonly port: number;
  private readonly tenant: string;
  private readonly database: string;
  private readonly user: string;
  private readonly password: string;
  private readonly charset: string;
  private readonly fullUser: string;
  private connection: Connection | null = null;

  constructor(args: SeekDBClientArgs) {
    this.host = args.host;
    this.port = args.port ?? DEFAULT_PORT;
    this.tenant = args.tenant ?? DEFAULT_TENANT;
    this.database = args.database ?? DEFAULT_DATABASE;
    this.user = args.user ?? DEFAULT_USER;
    this.password = args.password ?? process.env.SEEKDB_PASSWORD ?? '';
    this.charset = args.charset ?? DEFAULT_CHARSET;
    this.fullUser = `${this.user}@${this.tenant}`;

    console.log(
      `Initialize SeekDBClient: ${this.fullUser}@${this.host}:${this.port}/${this.database}`
    );
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnection(): Promise<Connection> {
    if (!this.connection) {
      try {
        this.connection = await mysql.createConnection({
          host: this.host,
          port: this.port,
          user: this.fullUser,
          password: this.password,
          database: this.database,
          charset: this.charset,
        });
        console.log(
          `✅ Connected to remote server: ${this.host}:${this.port}/${this.database}`
        );
      } catch (error) {
        throw new SeekDBConnectionError(
          `Failed to connect to ${this.host}:${this.port}`,
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
   */
  async execute(sql: string): Promise<RowDataPacket[] | null> {
    const conn = await this.ensureConnection();
    const sqlUpper = sql.trim().toUpperCase();

    if (
      sqlUpper.startsWith('SELECT') ||
      sqlUpper.startsWith('SHOW') ||
      sqlUpper.startsWith('DESCRIBE') ||
      sqlUpper.startsWith('DESC')
    ) {
      const [rows] = await conn.query<RowDataPacket[]>(sql);
      return rows;
    }

    await conn.query(sql);
    return null;
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      console.log('Connection closed');
    }
  }

  // ==================== Collection Management ====================

  /**
   * Create a new collection
   */
  async createCollection(
    options: CreateCollectionOptions
  ): Promise<Collection> {
    const { name } = options;
    const configuration = options.configuration ?? null;
    const embeddingFunction = options.embeddingFunction ?? null;

    let config: HNSWConfiguration | null = configuration;
    let ef: EmbeddingFunction | null = embeddingFunction;

    // Default behavior: if neither provided, use defaults
    if (config === null && ef === null) {
      config = {
        dimension: DEFAULT_VECTOR_DIMENSION,
        distance: DEFAULT_DISTANCE_METRIC,
      };
      // No default embedding function in Node.js version
    }

    // Auto-calculate dimension from embedding function if config not provided
    if (config === null && ef !== null) {
      const testEmbeddings = await ef('seekdb');
      const dimension = testEmbeddings[0].length;
      config = {
        dimension,
        distance: DEFAULT_DISTANCE_METRIC,
      };
    }

    // Validate dimension matches if both provided
    if (config !== null && ef !== null) {
      const testEmbeddings = await ef('seekdb');
      const actualDimension = testEmbeddings[0].length;
      if (config.dimension !== actualDimension) {
        throw new SeekDBValueError(
          `Configuration dimension (${config.dimension}) does not match embedding function dimension (${actualDimension})`
        );
      }
    }

    if (config === null) {
      throw new SeekDBValueError(
        'Cannot determine dimension: either provide configuration or embeddingFunction'
      );
    }

    // Create table
    const tableName = CollectionNames.tableName(name);
    const distance = config.distance ?? DEFAULT_DISTANCE_METRIC;

    const sql = `CREATE TABLE \`${tableName}\` (
      ${CollectionFieldNames.ID} VARBINARY(512) PRIMARY KEY,
      ${CollectionFieldNames.DOCUMENT} TEXT,
      ${CollectionFieldNames.METADATA} JSON,
      ${CollectionFieldNames.EMBEDDING} VECTOR(${config.dimension}, ${distance.toUpperCase()}),
      FULLTEXT INDEX ft_idx (${CollectionFieldNames.DOCUMENT})
    )`;

    await this.execute(sql);
    console.log(`✅ Created collection: ${name}`);

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
    const tableName = CollectionNames.tableName(name);
    const sql = `SHOW TABLES LIKE '${tableName}'`;
    const result = await this.execute(sql);

    if (!result || result.length === 0) {
      throw new InvalidCollectionError(`Collection not found: ${name}`);
    }

    // Get table schema to extract dimension and distance
    const descSql = `DESCRIBE \`${tableName}\``;
    const schema = await this.execute(descSql);

    if (!schema) {
      throw new InvalidCollectionError(
        `Unable to retrieve schema for collection: ${name}`
      );
    }

    // Parse embedding field to get dimension and distance
    const embeddingField = schema.find(
      (row: any) => row.Field === CollectionFieldNames.EMBEDDING
    );
    if (!embeddingField) {
      throw new InvalidCollectionError(
        `Collection ${name} does not have embedding field`
      );
    }

    // Parse VECTOR(dimension, distance) format
    const match = embeddingField.Type.match(/VECTOR\((\d+),\s*(\w+)\)/i);
    if (!match) {
      throw new InvalidCollectionError(
        `Invalid embedding type: ${embeddingField.Type}`
      );
    }

    const dimension = parseInt(match[1], 10);
    const distance = match[2].toLowerCase() as DistanceMetric;

    return new Collection({
      name,
      dimension,
      distance,
      embeddingFunction: embeddingFunction ?? undefined,
      client: this,
    });
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<string[]> {
    const sql = 'SHOW TABLES';
    const result = await this.execute(sql);

    if (!result) return [];

    const prefix = 'c$v1$';
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
    const tableName = CollectionNames.tableName(name);
    const sql = `DROP TABLE IF EXISTS \`${tableName}\``;
    await this.execute(sql);
    console.log(`✅ Deleted collection: ${name}`);
  }

  /**
   * Check if collection exists
   */
  async hasCollection(name: string): Promise<boolean> {
    const tableName = CollectionNames.tableName(name);
    const sql = `SHOW TABLES LIKE '${tableName}'`;
    const result = await this.execute(sql);
    return result !== null && result.length > 0;
  }

  /**
   * Get or create collection
   */
  async getOrCreateCollection(
    options: CreateCollectionOptions
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

  // ==================== Internal Collection Operations ====================
  // These methods are called by Collection instances

  /**
   * Add data to collection
   */
  async _collectionAdd(
    collectionName: string,
    options: AddOptions,
    embeddingFunction?: EmbeddingFunction
  ): Promise<void> {
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
      if (embeddingFunction) {
        embeddingsArray = await embeddingFunction(documentsArray);
      } else {
        throw new SeekDBValueError(
          'Documents provided but no embeddings and no embedding function'
        );
      }
    }

    if (!embeddingsArray) {
      throw new SeekDBValueError('Either embeddings or documents must be provided');
    }

    const numItems = idsArray.length;
    const tableName = CollectionNames.tableName(collectionName);

    // Build INSERT SQL
    const valuesList: string[] = [];
    for (let i = 0; i < numItems; i++) {
      const id = idsArray[i];
      const doc = documentsArray?.[i];
      const meta = metadatasArray?.[i];
      const vec = embeddingsArray[i];

      const idSql = `CAST('${escapeSqlString(id)}' AS BINARY)`;
      const docSql = doc ? `'${escapeSqlString(doc)}'` : 'NULL';
      const metaSql = meta
        ? `'${escapeSqlString(serializeMetadata(meta))}'`
        : 'NULL';
      const vecSql = `'${vectorToSqlString(vec)}'`;

      valuesList.push(`(${idSql}, ${docSql}, ${metaSql}, ${vecSql})`);
    }

    const sql = `INSERT INTO \`${tableName}\` (${CollectionFieldNames.ID}, ${CollectionFieldNames.DOCUMENT}, ${CollectionFieldNames.METADATA}, ${CollectionFieldNames.EMBEDDING}) VALUES ${valuesList.join(', ')}`;

    await this.execute(sql);
    console.log(`✅ Added ${numItems} item(s) to collection '${collectionName}'`);
  }

  /**
   * Get data from collection
   */
  async _collectionGet<TMeta extends Metadata = Metadata>(
    collectionName: string,
    options: GetOptions = {}
  ): Promise<GetResult<TMeta>> {
    const tableName = CollectionNames.tableName(collectionName);
    const { ids: filterIds, limit, offset, include, where, whereDocument } = options;

    let sql = `SELECT ${CollectionFieldNames.ID}`;

    if (!include || include.includes('documents')) {
      sql += `, ${CollectionFieldNames.DOCUMENT}`;
    }
    if (!include || include.includes('metadatas')) {
      sql += `, ${CollectionFieldNames.METADATA}`;
    }
    if (!include || include.includes('embeddings')) {
      sql += `, ${CollectionFieldNames.EMBEDDING}`;
    }

    sql += ` FROM \`${tableName}\``;

    // Build WHERE clause using FilterBuilder
    const whereClauses: string[] = [];

    // Add IDs filter if provided
    if (filterIds) {
      const idsArray = Array.isArray(filterIds) ? filterIds : [filterIds];
      const idConditions = idsArray.map(
        (id) => `${CollectionFieldNames.ID} = CAST('${escapeSqlString(id)}' AS BINARY)`
      );
      whereClauses.push(`(${idConditions.join(' OR ')})`);
    }

    // Add metadata filter
    if (where) {
      const metaFilter = FilterBuilder.buildMetadataFilter(where, CollectionFieldNames.METADATA);
      if (metaFilter.clause && metaFilter.clause !== '1=1') {
        whereClauses.push(`(${metaFilter.clause})`);
        // Note: For simplicity, we're not using parameterized queries here
        // In production, you'd want to handle params properly
      }
    }

    // Add document filter
    if (whereDocument) {
      const docFilter = FilterBuilder.buildDocumentFilter(whereDocument, CollectionFieldNames.DOCUMENT);
      if (docFilter.clause && docFilter.clause !== '1=1') {
        whereClauses.push(`(${docFilter.clause})`);
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    if (limit) {
      sql += ` LIMIT ${limit}`;
    }
    if (offset) {
      sql += ` OFFSET ${offset}`;
    }

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
          resultMetadatas.push(meta ? JSON.parse(meta) : null);
        }

        if (!include || include.includes('embeddings')) {
          const vec = row[CollectionFieldNames.EMBEDDING];
          resultEmbeddings.push(vec ? JSON.parse(vec) : null);
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
   * Count items in collection
   */
  async _collectionCount(collectionName: string): Promise<number> {
    const tableName = CollectionNames.tableName(collectionName);
    const sql = `SELECT COUNT(*) as cnt FROM \`${tableName}\``;
    const rows = await this.execute(sql);
    if (!rows || rows.length === 0) return 0;
    return rows[0].cnt;
  }

  /**
   * Update data in collection
   */
  async _collectionUpdate(
    collectionName: string,
    options: UpdateOptions,
    embeddingFunction?: EmbeddingFunction
  ): Promise<void> {
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
      if (embeddingFunction) {
        embeddingsArray = await embeddingFunction(documentsArray);
      } else {
        throw new SeekDBValueError(
          'Documents provided but no embeddings and no embedding function'
        );
      }
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

    const tableName = CollectionNames.tableName(collectionName);

    // Update each item
    for (let i = 0; i < idsArray.length; i++) {
      const id = idsArray[i];
      const setClauses: string[] = [];

      if (documentsArray && documentsArray[i]) {
        const doc = documentsArray[i];
        setClauses.push(
          `${CollectionFieldNames.DOCUMENT} = '${escapeSqlString(doc)}'`
        );
      }

      if (metadatasArray && metadatasArray[i]) {
        const meta = metadatasArray[i];
        setClauses.push(
          `${CollectionFieldNames.METADATA} = '${escapeSqlString(
            serializeMetadata(meta)
          )}'`
        );
      }

      if (embeddingsArray && embeddingsArray[i]) {
        const vec = embeddingsArray[i];
        setClauses.push(
          `${CollectionFieldNames.EMBEDDING} = '${vectorToSqlString(vec)}'`
        );
      }

      if (setClauses.length === 0) {
        continue;
      }

      const idSql = `CAST('${escapeSqlString(id)}' AS BINARY)`;
      const sql = `UPDATE \`${tableName}\` SET ${setClauses.join(', ')} WHERE ${CollectionFieldNames.ID} = ${idSql}`;

      await this.execute(sql);
    }

    console.log(
      `✅ Updated ${idsArray.length} item(s) in collection '${collectionName}'`
    );
  }

  /**
   * Upsert data in collection (insert or update)
   */
  async _collectionUpsert(
    collectionName: string,
    options: UpsertOptions,
    embeddingFunction?: EmbeddingFunction
  ): Promise<void> {
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
      if (embeddingFunction) {
        embeddingsArray = await embeddingFunction(documentsArray);
      } else {
        throw new SeekDBValueError(
          'Documents provided but no embeddings and no embedding function'
        );
      }
    }

    if (!embeddingsArray && !metadatasArray) {
      throw new SeekDBValueError(
        'At least one of embeddings or metadatas must be provided'
      );
    }

    const tableName = CollectionNames.tableName(collectionName);

    // Upsert each item
    for (let i = 0; i < idsArray.length; i++) {
      const id = idsArray[i];

      // Check if record exists
      const existing = await this._collectionGet(collectionName, {
        ids: [id],
        include: ['documents', 'metadatas', 'embeddings'],
      });

      const doc = documentsArray?.[i];
      const meta = metadatasArray?.[i];
      const vec = embeddingsArray?.[i];

      if (existing.ids.length > 0) {
        // Update existing record
        const setClauses: string[] = [];

        if (doc !== undefined) {
          setClauses.push(
            `${CollectionFieldNames.DOCUMENT} = '${escapeSqlString(doc)}'`
          );
        }

        if (meta !== undefined) {
          setClauses.push(
            `${CollectionFieldNames.METADATA} = '${escapeSqlString(
              serializeMetadata(meta)
            )}'`
          );
        }

        if (vec !== undefined) {
          setClauses.push(
            `${CollectionFieldNames.EMBEDDING} = '${vectorToSqlString(vec)}'`
          );
        }

        if (setClauses.length > 0) {
          const idSql = `CAST('${escapeSqlString(id)}' AS BINARY)`;
          const sql = `UPDATE \`${tableName}\` SET ${setClauses.join(', ')} WHERE ${CollectionFieldNames.ID} = ${idSql}`;
          await this.execute(sql);
        }
      } else {
        // Insert new record
        const idSql = `CAST('${escapeSqlString(id)}' AS BINARY)`;
        const docSql = doc ? `'${escapeSqlString(doc)}'` : 'NULL';
        const metaSql = meta
          ? `'${escapeSqlString(serializeMetadata(meta))}'`
          : 'NULL';
        const vecSql = vec ? `'${vectorToSqlString(vec)}'` : 'NULL';

        const sql = `INSERT INTO \`${tableName}\` (${CollectionFieldNames.ID}, ${CollectionFieldNames.DOCUMENT}, ${CollectionFieldNames.METADATA}, ${CollectionFieldNames.EMBEDDING}) VALUES (${idSql}, ${docSql}, ${metaSql}, ${vecSql})`;
        await this.execute(sql);
      }
    }

    console.log(
      `✅ Upserted ${idsArray.length} item(s) in collection '${collectionName}'`
    );
  }

  /**
   * Delete data from collection
   */
  async _collectionDelete(
    collectionName: string,
    options: DeleteOptions
  ): Promise<void> {
    const { ids, where, whereDocument } = options;

    // Validate at least one filter
    if (!ids && !where && !whereDocument) {
      throw new SeekDBValueError(
        'At least one of ids, where, or whereDocument must be provided'
      );
    }

    const tableName = CollectionNames.tableName(collectionName);
    const whereClauses: string[] = [];

    // Handle IDs filter
    if (ids) {
      const idsArray = Array.isArray(ids) ? ids : [ids];
      const idConditions = idsArray.map(
        (id) => `${CollectionFieldNames.ID} = CAST('${escapeSqlString(id)}' AS BINARY)`
      );
      whereClauses.push(`(${idConditions.join(' OR ')})`);
    }

    // Handle metadata filter
    if (where) {
      const metaFilter = FilterBuilder.buildMetadataFilter(where, CollectionFieldNames.METADATA);
      if (metaFilter.clause && metaFilter.clause !== '1=1') {
        whereClauses.push(`(${metaFilter.clause})`);
      }
    }

    // Handle document filter
    if (whereDocument) {
      const docFilter = FilterBuilder.buildDocumentFilter(whereDocument, CollectionFieldNames.DOCUMENT);
      if (docFilter.clause && docFilter.clause !== '1=1') {
        whereClauses.push(`(${docFilter.clause})`);
      }
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `DELETE FROM \`${tableName}\` ${whereClause}`;

    await this.execute(sql);
    console.log(`✅ Deleted data from collection '${collectionName}'`);
  }

  /**
   * Query collection with vector similarity search
   */
  async _collectionQuery<TMeta extends Metadata = Metadata>(
    collectionName: string,
    options: QueryOptions,
    embeddingFunction?: EmbeddingFunction
  ): Promise<QueryResult<TMeta>> {
    let { queryEmbeddings, queryTexts, nResults = 10, where, whereDocument, include } = options;

    // Handle embedding generation
    if (!queryEmbeddings && queryTexts) {
      if (embeddingFunction) {
        const textsArray = Array.isArray(queryTexts) ? queryTexts : [queryTexts];
        queryEmbeddings = await embeddingFunction(textsArray);
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

    const tableName = CollectionNames.tableName(collectionName);

    // Build SELECT clause
    let selectFields = [CollectionFieldNames.ID];
    if (!include || include.includes('documents')) {
      selectFields.push(CollectionFieldNames.DOCUMENT);
    }
    if (!include || include.includes('metadatas')) {
      selectFields.push(CollectionFieldNames.METADATA);
    }
    if (include?.includes('embeddings')) {
      selectFields.push(CollectionFieldNames.EMBEDDING);
    }

    // Build WHERE clause for filters
    const whereClauses: string[] = [];

    if (where) {
      const metaFilter = FilterBuilder.buildMetadataFilter(where, CollectionFieldNames.METADATA);
      if (metaFilter.clause && metaFilter.clause !== '1=1') {
        whereClauses.push(`(${metaFilter.clause})`);
      }
    }

    if (whereDocument) {
      const docFilter = FilterBuilder.buildDocumentFilter(whereDocument, CollectionFieldNames.DOCUMENT);
      if (docFilter.clause && docFilter.clause !== '1=1') {
        whereClauses.push(`(${docFilter.clause})`);
      }
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const allIds: string[][] = [];
    const allDocuments: (string | null)[][] = [];
    const allMetadatas: (TMeta | null)[][] = [];
    const allEmbeddings: number[][][] = [];
    const allDistances: number[][] = [];

    // Query for each vector
    for (const queryVector of embeddingsArray) {
      const vectorStr = vectorToSqlString(queryVector);

      // Use l2_distance by default
      const sql = `
        SELECT ${selectFields.join(', ')},
               l2_distance(${CollectionFieldNames.EMBEDDING}, '${vectorStr}') AS distance
        FROM \`${tableName}\`
        ${whereClause}
        ORDER BY l2_distance(${CollectionFieldNames.EMBEDDING}, '${vectorStr}')
        APPROXIMATE
        LIMIT ${nResults}
      `;

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
          queryMetadatas.push(meta ? JSON.parse(meta) : null);
        }

        if (include?.includes('embeddings')) {
          const vec = row[CollectionFieldNames.EMBEDDING];
          queryEmbeddings.push(vec ? JSON.parse(vec) : null);
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

    console.log(
      `✅ Query completed for '${collectionName}' with ${embeddingsArray.length} vector(s)`
    );
    return result;
  }

  /**
   * Hybrid search (full-text + vector)
   */
  async _collectionHybridSearch<TMeta extends Metadata = Metadata>(
    collectionName: string,
    options: HybridSearchOptions,
    embeddingFunction?: EmbeddingFunction
  ): Promise<QueryResult<TMeta>> {
    const { query, knn, rank, nResults = 10, include } = options;

    // Build search_parm JSON
    const searchParm: any = {};

    // Handle query (full-text search)
    if (query) {
      const queryObj: any = {};
      if (query.whereDocument) {
        // Build query expression from whereDocument
        queryObj.query = this._buildQueryExpression(query.whereDocument);
      }
      if (query.where) {
        // Build filter from metadata conditions
        queryObj.filter = this._buildMetadataFilter(query.where);
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
        if (embeddingFunction) {
          const textsArray = Array.isArray(knn.queryTexts)
            ? knn.queryTexts
            : [knn.queryTexts];
          queryEmbeddings = await embeddingFunction(textsArray);
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
        knnObj.filter = this._buildMetadataFilter(knn.where);
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
    const tableName = CollectionNames.tableName(collectionName);
    const searchParmJson = JSON.stringify(searchParm);

    // Set search_parm variable
    const setVarSql = `SET @search_parm = '${escapeSqlString(searchParmJson)}'`;
    await this.execute(setVarSql);

    // Get SQL query from DBMS_HYBRID_SEARCH.GET_SQL
    const getSqlQuery = `SELECT DBMS_HYBRID_SEARCH.GET_SQL('${tableName}', @search_parm) as query_sql FROM dual`;
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
          metadatas.push(meta ? JSON.parse(meta) : null);
        }

        if (include?.includes('embeddings')) {
          const vec = row[CollectionFieldNames.EMBEDDING];
          embeddings.push(vec ? JSON.parse(vec) : null);
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

    console.log(
      `✅ Hybrid search completed for '${collectionName}' with ${ids.length} result(s)`
    );
    return result;
  }

  /**
   * Build query expression from whereDocument filter
   */
  private _buildQueryExpression(whereDocument: any): any {
    if (whereDocument.$contains) {
      return {
        query_string: {
          query: whereDocument.$contains,
        },
      };
    }
    if (whereDocument.$regex) {
      // REGEXP pattern for document search
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
          must: whereDocument.$and.map((cond: any) => this._buildQueryExpression(cond)),
        },
      };
    }
    if (whereDocument.$or && Array.isArray(whereDocument.$or)) {
      return {
        bool: {
          should: whereDocument.$or.map((cond: any) => this._buildQueryExpression(cond)),
        },
      };
    }
    return {};
  }

  /**
   * Build metadata filter for search_parm
   */
  private _buildMetadataFilter(where: any): any {
    if (!where) {
      return {};
    }

    const filterConditions = FilterBuilder.buildSearchFilter(where);
    if (filterConditions && filterConditions.length > 0) {
      return filterConditions;
    }
    return {};
  }
}
