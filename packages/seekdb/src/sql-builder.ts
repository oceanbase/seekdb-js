/**
 * SQL Builder for seekdb
 * Centralizes all SQL statement construction
 */

import {
  CollectionNames,
  CollectionFieldNames,
  vectorToSqlString,
  serializeMetadata,
} from "./utils.js";
import { FilterBuilder } from "./filters.js";
import type {
  Metadata,
  Where,
  WhereDocument,
  DistanceMetric,
  CollectionContext,
  FulltextAnalyzerConfig,
} from "./types.js";

export interface SQLResult {
  sql: string;
  params: unknown[];
}

/**
 * SQL Builder class
 * Provides static methods to build SQL statements
 */
export class SQLBuilder {
  static buildCreateTable(
    name: string,
    dimension: number,
    distance: DistanceMetric,
    comment?: string,
    collectionId?: string,
    fulltextConfig?: FulltextAnalyzerConfig,
  ): string {
    const tableName = CollectionNames.tableName(name, collectionId);
    const commentClause = comment
      ? ` COMMENT = '${comment.replace(/'/g, "''")}'`
      : "";

    const fulltextClause = this.buildFulltextClause(fulltextConfig);

    return `CREATE TABLE \`${tableName}\` (
      ${CollectionFieldNames.ID} VARBINARY(512) PRIMARY KEY NOT NULL,
      ${CollectionFieldNames.DOCUMENT} STRING,
      ${CollectionFieldNames.EMBEDDING} VECTOR(${dimension}),
      ${CollectionFieldNames.METADATA} JSON,
      FULLTEXT INDEX idx_fts (${CollectionFieldNames.DOCUMENT}) ${fulltextClause},
      VECTOR INDEX idx_vec (${CollectionFieldNames.EMBEDDING}) WITH(distance=${distance}, type=hnsw, lib=vsag)
    ) ORGANIZATION = HEAP${commentClause}`;
  }

  /**
   * Build fulltext clause for CREATE TABLE
   */
  static buildFulltextClause(config?: FulltextAnalyzerConfig): string {
    if (!config) {
      return "WITH PARSER ik";
    }

    const { analyzer, properties } = config;
    if (!properties || Object.keys(properties).length === 0) {
      return `WITH PARSER ${analyzer}`;
    }

    const props = Object.entries(properties)
      .map(([key, value]) => {
        let valStr: string;
        if (typeof value === "string") {
          valStr = `'${value.replace(/'/g, "''")}'`;
        } else {
          valStr = String(value);
        }
        return `${key}=${valStr}`;
      })
      .join(", ");

    return `WITH PARSER ${analyzer} PARSER_PROPERTIES=(${props})`;
  }

  /**
   * Build SHOW TABLES LIKE SQL
   */
  static buildShowTable(name: string, collectionId?: string): string {
    const tableName = CollectionNames.tableName(name, collectionId);
    return `SHOW TABLES LIKE '${tableName}'`;
  }

  /**
   * Build DESCRIBE TABLE SQL
   */
  static buildDescribeTable(name: string, collectionId?: string): string {
    const tableName = CollectionNames.tableName(name, collectionId);
    return `DESCRIBE \`${tableName}\``;
  }

  /**
   * Build SHOW INDEX SQL
   */
  static buildShowIndex(name: string, collectionId?: string): string {
    const tableName = CollectionNames.tableName(name, collectionId);
    return `SHOW INDEX FROM \`${tableName}\` WHERE Key_name LIKE 'vec_%'`;
  }

  /**
   * Build SHOW CREATE TABLE SQL
   */
  static buildShowCreateTable(name: string, collectionId?: string): string {
    const tableName = CollectionNames.tableName(name, collectionId);
    return `SHOW CREATE TABLE \`${tableName}\``;
  }

  /**
   * Build DROP TABLE SQL
   */
  static buildDropTable(name: string, collectionId?: string): string {
    const tableName = CollectionNames.tableName(name, collectionId);
    return `DROP TABLE IF EXISTS \`${tableName}\``;
  }

  /**
   * Build INSERT SQL for adding data
   */
  static buildInsert(
    context: CollectionContext,
    data: { ids: string[]; documents?: (string | null)[]; embeddings: number[][]; metadatas?: (Metadata | null)[] },
  ): SQLResult {
    const tableName = CollectionNames.tableName(context.name, context.collectionId);
    const valuesList: string[] = [];
    const params: unknown[] = [];
    const numItems = data.ids.length;

    for (let i = 0; i < numItems; i++) {
      const id = data.ids[i];
      const doc = data.documents?.[i] ?? null;
      const meta = data.metadatas?.[i] ?? null;
      const vec = data.embeddings[i];

      valuesList.push(`(CAST(? AS BINARY), ?, ?, ?)`);
      params.push(
        id,
        doc,
        meta ? serializeMetadata(meta) : null,
        vectorToSqlString(vec),
      );
    }

    const sql = `INSERT INTO \`${tableName}\` (${CollectionFieldNames.ID}, ${CollectionFieldNames.DOCUMENT}, ${CollectionFieldNames.METADATA}, ${CollectionFieldNames.EMBEDDING}) VALUES ${valuesList.join(", ")}`;
    return { sql, params };
  }

  /**
   * Build SELECT SQL for getting data
   */
  static buildSelect(
    context: CollectionContext,
    options: {
      ids?: string[];
      where?: Where;
      whereDocument?: WhereDocument;
      limit?: number;
      offset?: number;
      include?: string[];
    },
  ): SQLResult {
    const tableName = CollectionNames.tableName(context.name, context.collectionId);
    const { ids, where, whereDocument, limit, offset, include } = options;
    const params: unknown[] = [];

    // Build SELECT clause
    let sql = `SELECT ${CollectionFieldNames.ID}`;

    if (!include || include.includes("documents")) {
      sql += `, ${CollectionFieldNames.DOCUMENT}`;
    }
    if (!include || include.includes("metadatas")) {
      sql += `, ${CollectionFieldNames.METADATA}`;
    }
    if (!include || include.includes("embeddings")) {
      sql += `, ${CollectionFieldNames.EMBEDDING}`;
    }

    sql += ` FROM \`${tableName}\``;

    // Build WHERE clause
    const whereClauses: string[] = [];

    if (ids) {
      const idsArray = Array.isArray(ids) ? ids : [ids];
      // Skip empty ids array to avoid invalid SQL (WHERE ())
      if (idsArray.length > 0) {
        const idConditions = idsArray.map(
          () => `${CollectionFieldNames.ID} = CAST(? AS BINARY)`,
        );
        whereClauses.push(`(${idConditions.join(" OR ")})`);
        params.push(...idsArray);
      }
    }

    if (where) {
      const metaFilter = FilterBuilder.buildMetadataFilter(
        where,
        CollectionFieldNames.METADATA,
      );
      if (metaFilter.clause && metaFilter.clause !== "1=1") {
        whereClauses.push(`(${metaFilter.clause})`);
        params.push(...metaFilter.params);
      }
    }

    if (whereDocument) {
      const docFilter = FilterBuilder.buildDocumentFilter(
        whereDocument,
        CollectionFieldNames.DOCUMENT,
      );
      if (docFilter.clause && docFilter.clause !== "1=1") {
        whereClauses.push(`(${docFilter.clause})`);
        params.push(...docFilter.params);
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    if (typeof limit === "number") {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    if (typeof offset === "number") {
      sql += ` OFFSET ?`;
      params.push(offset);
    }

    return { sql, params };
  }

  /**
   * Build COUNT SQL
   */
  static buildCount(context: CollectionContext): string {
    const tableName = CollectionNames.tableName(context.name, context.collectionId);
    return `SELECT COUNT(*) as cnt FROM \`${tableName}\``;
  }

  /**
   * Build UPDATE SQL
   */
  static buildUpdate(
    context: CollectionContext,
    data: {
      id: string;
      updates: {
        document?: string;
        embedding?: number[];
        metadata?: Metadata;
      };
    },
  ): SQLResult {
    const tableName = CollectionNames.tableName(context.name, context.collectionId);
    const { id, updates } = data;
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.document !== undefined) {
      setClauses.push(`${CollectionFieldNames.DOCUMENT} = ?`);
      params.push(updates.document);
    }

    if (updates.metadata !== undefined) {
      setClauses.push(`${CollectionFieldNames.METADATA} = ?`);
      params.push(serializeMetadata(updates.metadata));
    }

    if (updates.embedding !== undefined) {
      setClauses.push(`${CollectionFieldNames.EMBEDDING} = ?`);
      params.push(vectorToSqlString(updates.embedding));
    }

    // WHERE clause
    params.push(id);
    const sql = `UPDATE \`${tableName}\` SET ${setClauses.join(", ")} WHERE ${CollectionFieldNames.ID} = CAST(? AS BINARY)`;
    return { sql, params };
  }

  /**
   * Build DELETE SQL
   */
  static buildDelete(
    context: CollectionContext,
    options: {
      ids?: string[];
      where?: Where;
      whereDocument?: WhereDocument;
    },
  ): SQLResult {
    const tableName = CollectionNames.tableName(context.name, context.collectionId);
    const { ids, where, whereDocument } = options;
    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (ids) {
      const idsArray = Array.isArray(ids) ? ids : [ids];
      const idConditions = idsArray.map(
        () => `${CollectionFieldNames.ID} = CAST(? AS BINARY)`,
      );
      whereClauses.push(`(${idConditions.join(" OR ")})`);
      params.push(...idsArray);
    }

    if (where) {
      const metaFilter = FilterBuilder.buildMetadataFilter(
        where,
        CollectionFieldNames.METADATA,
      );
      if (metaFilter.clause && metaFilter.clause !== "1=1") {
        whereClauses.push(`(${metaFilter.clause})`);
        params.push(...metaFilter.params);
      }
    }

    if (whereDocument) {
      const docFilter = FilterBuilder.buildDocumentFilter(
        whereDocument,
        CollectionFieldNames.DOCUMENT,
      );
      if (docFilter.clause && docFilter.clause !== "1=1") {
        whereClauses.push(`(${docFilter.clause})`);
        params.push(...docFilter.params);
      }
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    return { sql: `DELETE FROM \`${tableName}\` ${whereClause}`, params };
  }

  /**
   * Build vector query SQL
   */
  static buildVectorQuery(
    context: CollectionContext,
    queryVector: number[],
    nResults: number,
    options: {
      where?: Where;
      whereDocument?: WhereDocument;
      include?: string[];
      distance?: DistanceMetric;
      approximate?: boolean;
    },
  ): SQLResult {
    const tableName = CollectionNames.tableName(context.name, context.collectionId);
    const {
      where,
      whereDocument,
      include,
      distance = "l2",
      approximate = true,
    } = options;
    const params: unknown[] = [];

    // Map distance metric to SQL function name
    const distanceFunctionMap: Record<DistanceMetric, string> = {
      l2: "l2_distance",
      cosine: "cosine_distance",
      inner_product: "inner_product",
    };

    // Get the distance function name, default to 'l2_distance' if distance is not recognized
    const distanceFunc = distanceFunctionMap[distance];

    // Build SELECT clause
    const selectFields = [CollectionFieldNames.ID];
    if (!include || include.includes("documents")) {
      selectFields.push(CollectionFieldNames.DOCUMENT);
    }
    if (!include || include.includes("metadatas")) {
      selectFields.push(CollectionFieldNames.METADATA);
    }
    if (include?.includes("embeddings")) {
      selectFields.push(CollectionFieldNames.EMBEDDING);
    }

    // Build WHERE clause for filters
    const whereClauses: string[] = [];

    if (where) {
      const metaFilter = FilterBuilder.buildMetadataFilter(
        where,
        CollectionFieldNames.METADATA,
      );
      if (metaFilter.clause && metaFilter.clause !== "1=1") {
        whereClauses.push(`(${metaFilter.clause})`);
        params.push(...metaFilter.params);
      }
    }

    if (whereDocument) {
      const docFilter = FilterBuilder.buildDocumentFilter(
        whereDocument,
        CollectionFieldNames.DOCUMENT,
      );
      if (docFilter.clause && docFilter.clause !== "1=1") {
        whereClauses.push(`(${docFilter.clause})`);
        params.push(...docFilter.params);
      }
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const vectorStr = vectorToSqlString(queryVector);

    const sql = `
      SELECT ${selectFields.join(", ")},
             ${distanceFunc}(${CollectionFieldNames.EMBEDDING}, '${vectorStr}') AS distance
      FROM \`${tableName}\`
      ${whereClause}
      ORDER BY ${distanceFunc}(${CollectionFieldNames.EMBEDDING}, '${vectorStr}')
      ${approximate ? "APPROXIMATE" : ""}
      LIMIT ?
    `.trim();

    params.push(nResults);

    return { sql, params };
  }

  /**
   * Build SET variable SQL for hybrid search
   */
  static buildSetVariable(name: string, value: string): SQLResult {
    return {
      sql: `SET @${name} = ?`,
      params: [value],
    };
  }

  /**
   * Build hybrid search GET_SQL query
   */
  static buildHybridSearchGetSql(tableName: string): string {
    // use user variable @search_parm
    return `SELECT DBMS_HYBRID_SEARCH.GET_SQL('${tableName}', @search_parm) as query_sql FROM dual`;
  }

  static buildFork(sourceName: string, targetName: string): string {
    return `FORK TABLE \`${sourceName}\` TO \`${targetName}\`;`;
  }
}
