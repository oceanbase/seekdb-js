/**
 * SQL Builder for SeekDB
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
  /**
   * Build CREATE TABLE SQL for creating a collection
   */
  static buildCreateTable(
    name: string,
    dimension: number,
    distance: DistanceMetric,
  ): string {
    const tableName = CollectionNames.tableName(name);

    return `CREATE TABLE \`${tableName}\` (
      ${CollectionFieldNames.ID} VARBINARY(512) PRIMARY KEY NOT NULL,
      ${CollectionFieldNames.DOCUMENT} TEXT,
      ${CollectionFieldNames.EMBEDDING} VECTOR(${dimension}),
      ${CollectionFieldNames.METADATA} JSON,
      FULLTEXT INDEX ft_idx (${CollectionFieldNames.DOCUMENT}),
      VECTOR INDEX vec_idx (${CollectionFieldNames.EMBEDDING}) WITH(distance=${distance}, type=hnsw, lib=vsag)
    ) ORGANIZATION = HEAP`;
  }

  /**
   * Build SHOW TABLES LIKE SQL
   */
  static buildShowTable(name: string): string {
    const tableName = CollectionNames.tableName(name);
    return `SHOW TABLES LIKE '${tableName}'`;
  }

  /**
   * Build DESCRIBE TABLE SQL
   */
  static buildDescribeTable(name: string): string {
    const tableName = CollectionNames.tableName(name);
    return `DESCRIBE \`${tableName}\``;
  }

  /**
   * Build SHOW INDEX SQL
   */
  static buildShowIndex(name: string): string {
    const tableName = CollectionNames.tableName(name);
    return `SHOW INDEX FROM \`${tableName}\` WHERE Key_name LIKE 'vec_%'`;
  }

  /**
   * Build SHOW CREATE TABLE SQL
   */
  static buildShowCreateTable(name: string): string {
    const tableName = CollectionNames.tableName(name);
    return `SHOW CREATE TABLE \`${tableName}\``;
  }

  /**
   * Build DROP TABLE SQL
   */
  static buildDropTable(name: string): string {
    const tableName = CollectionNames.tableName(name);
    return `DROP TABLE IF EXISTS \`${tableName}\``;
  }

  /**
   * Build INSERT SQL for adding data
   */
  static buildInsert(
    collectionName: string,
    data: {
      ids: string[];
      documents?: (string | null)[];
      embeddings: number[][];
      metadatas?: (Metadata | null)[];
    },
  ): SQLResult {
    const tableName = CollectionNames.tableName(collectionName);
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
    collectionName: string,
    options: {
      ids?: string[];
      where?: Where;
      whereDocument?: WhereDocument;
      limit?: number;
      offset?: number;
      include?: string[];
    },
  ): SQLResult {
    const tableName = CollectionNames.tableName(collectionName);
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

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(" AND ")}`;
    }

    if (limit) {
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    if (offset) {
      sql += ` OFFSET ?`;
      params.push(offset);
    }

    return { sql, params };
  }

  /**
   * Build COUNT SQL
   */
  static buildCount(collectionName: string): string {
    const tableName = CollectionNames.tableName(collectionName);
    return `SELECT COUNT(*) as cnt FROM \`${tableName}\``;
  }

  /**
   * Build UPDATE SQL
   */
  static buildUpdate(
    collectionName: string,
    id: string,
    updates: {
      document?: string;
      embedding?: number[];
      metadata?: Metadata;
    },
  ): SQLResult {
    const tableName = CollectionNames.tableName(collectionName);
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
    collectionName: string,
    options: {
      ids?: string[];
      where?: Where;
      whereDocument?: WhereDocument;
    },
  ): SQLResult {
    const tableName = CollectionNames.tableName(collectionName);
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
    collectionName: string,
    queryVector: number[],
    nResults: number,
    options: {
      where?: Where;
      whereDocument?: WhereDocument;
      include?: string[];
    },
  ): SQLResult {
    const tableName = CollectionNames.tableName(collectionName);
    const { where, whereDocument, include } = options;
    const params: unknown[] = [];

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
             l2_distance(${CollectionFieldNames.EMBEDDING}, '${vectorStr}') AS distance
      FROM \`${tableName}\`
      ${whereClause}
      ORDER BY l2_distance(${CollectionFieldNames.EMBEDDING}, '${vectorStr}')
      APPROXIMATE
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
    // Following Python SDK pattern: use user variable @search_parm
    return `SELECT DBMS_HYBRID_SEARCH.GET_SQL('${tableName}', @search_parm) as query_sql FROM dual`;
  }
}
