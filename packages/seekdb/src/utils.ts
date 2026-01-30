/**
 * Utility functions for seekdb SDK
 */

import { SeekdbValueError } from "./errors.js";
import type { Metadata } from "./types.js";

/**
 * Normalize input to array
 */
export function toArray<T>(input: T | T[]): T[] {
  return Array.isArray(input) ? input : [input];
}

/**
 * Normalize embeddings to 2D array
 */
export function normalizeEmbeddings(
  embeddings: number[] | number[][],
): number[][] {
  if (embeddings.length === 0) {
    return [];
  }
  // Check if it's a 1D array (single embedding)
  if (typeof embeddings[0] === "number") {
    return [embeddings as number[]];
  }
  return embeddings as number[][];
}

/**
 * Validate record set length consistency
 */
export function validateRecordSetLengthConsistency(recordSet: {
  ids?: string[];
  embeddings?: number[][];
  metadatas?: Metadata[];
  documents?: string[];
}): void {
  const lengths = new Set<number>();

  if (recordSet.ids) lengths.add(recordSet.ids.length);
  if (recordSet.embeddings) lengths.add(recordSet.embeddings.length);
  if (recordSet.metadatas) lengths.add(recordSet.metadatas.length);
  if (recordSet.documents) lengths.add(recordSet.documents.length);

  if (lengths.size > 1) {
    throw new SeekdbValueError(
      `Record set has inconsistent lengths: ${JSON.stringify({
        ids: recordSet.ids?.length,
        embeddings: recordSet.embeddings?.length,
        metadatas: recordSet.metadatas?.length,
        documents: recordSet.documents?.length,
      })}`,
    );
  }
}

/**
 * Validate IDs
 */
export function validateIDs(ids: string[]): void {
  if (ids.length === 0) {
    throw new SeekdbValueError("IDs cannot be empty");
  }

  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    throw new SeekdbValueError("IDs must be unique");
  }
}

/**
 * Serialize metadata to JSON string
 */
export function serializeMetadata(metadata: Metadata): string {
  return JSON.stringify(metadata);
}

/**
 * Deserialize metadata from JSON string
 */
export function deserializeMetadata(metadata: string): Metadata {
  try {
    return JSON.parse(metadata);
  } catch (error) {
    throw new SeekdbValueError(`Failed to parse metadata: ${error}`);
  }
}

/**
 * Escape SQL string value
 */
export function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Convert vector array to SQL string format
 */
export function vectorToSqlString(vector: number[]): string {
  if (!Array.isArray(vector)) {
    throw new SeekdbValueError("Vector must be an array");
  }
  // Validate that all elements are finite numbers
  for (const val of vector) {
    if (!Number.isFinite(val)) {
      throw new SeekdbValueError(`Vector contains invalid value: ${val}`);
    }
  }
  return JSON.stringify(vector);
}

/**
 * Collection name utilities
 */
export class CollectionNames {
  static tableName(collectionName: string): string {
    return `c$v1$${collectionName}`;
  }
}

/**
 * Collection field names
 */
export class CollectionFieldNames {
  static readonly ID = "_id";
  static readonly DOCUMENT = "document";
  static readonly METADATA = "metadata";
  static readonly EMBEDDING = "embedding";
}

/**
 * Normalize value from database result
 * Handles various formats and converts them to standard JavaScript types
 * This is used to normalize embedded mode's JSON string format to standard values
 */
export function normalizeValue(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }

  // If it's already a standard type (not a JSON string), return as-is
  if (typeof value !== 'string') {
    // Handle object with type information (e.g., {VARCHAR: "value"})
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Try to extract the actual value from type-wrapped objects
      const extracted = value.VARCHAR || value.MEDIUMTEXT || value.TEXT ||
        value.LONGTEXT || value.varchar || value.mediumtext ||
        value.text || value.longtext;
      if (extracted !== undefined && extracted !== null) {
        return extracted;
      }
      // If no type key found, return the object as-is
      return value;
    }
    return value;
  }

  // Handle JSON-like string format: {"VARCHAR":"value", ...} or {"MEDIUMTEXT":"value", ...}
  const trimmed = value.trim();
  if (trimmed.startsWith('{') &&
    (trimmed.includes('VARCHAR') || trimmed.includes('MEDIUMTEXT') ||
      trimmed.includes('TEXT') || trimmed.includes('LONGTEXT'))) {
    try {
      // Try to parse as JSON
      const cleaned = value.replace(/[\x00-\x1F\x7F]/g, '');
      const parsed = JSON.parse(cleaned);
      // Extract the actual value from type-wrapped JSON
      const extracted = parsed.VARCHAR || parsed.MEDIUMTEXT || parsed.TEXT ||
        parsed.LONGTEXT || parsed.varchar || parsed.mediumtext ||
        parsed.text || parsed.longtext;
      if (extracted !== undefined && extracted !== null) {
        return extracted;
      }
      // If extraction failed, try regex fallback
      const match = value.match(/"(?:VARCHAR|MEDIUMTEXT|TEXT|LONGTEXT)"\s*:\s*"([^"]+)"/);
      if (match && match[1]) {
        return match[1];
      }
      // Last resort: return original value
      return value;
    } catch (e) {
      // If JSON parse fails, try regex extraction
      const match = value.match(/"(?:VARCHAR|MEDIUMTEXT|TEXT|LONGTEXT)"\s*:\s*"([^"]+)"/);
      if (match && match[1]) {
        return match[1];
      }
      // If regex also fails, return original value
      return value;
    }
  }

  // Return string as-is if not JSON format
  return value;
}

/**
 * Parse embedding column from binary (float32 little-endian, 4 bytes per float).
 * Used when DB returns VECTOR as Buffer/Uint8Array.
 */
export function parseEmbeddingBinary(buf: Uint8Array): number[] | null {
  if (buf.length % 4 !== 0) return null;
  const arr: number[] = [];
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let i = 0; i < buf.length; i += 4) {
    arr.push(view.getFloat32(i, true));
  }
  return arr;
}

/**
 * Parse embedding from string (raw bytes: each char code = byte).
 * Used when DB returns VECTOR as binary string.
 */
export function parseEmbeddingBinaryString(str: string): number[] | null {
  if (typeof str !== "string" || str.length % 4 !== 0) return null;
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return parseEmbeddingBinary(bytes);
}

/**
 * Normalize a row of data from database result
 * Applies normalizeValue to all values in the row
 */
export function normalizeRow(row: any): any {
  if (!row || typeof row !== 'object') {
    return row;
  }

  const normalized: any = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = normalizeValue(value);
  }
  return normalized;
}

/**
 * Normalize an array of rows from database result
 */
export function normalizeRows(rows: any[]): any[] {
  if (!Array.isArray(rows)) {
    return rows;
  }
  return rows.map(row => normalizeRow(row));
}

/**
 * Extract column value from row by trying multiple column name formats
 * This is a generic helper that works for both embedded and server modes
 */
export function extractColumnValue(
  row: any,
  possibleColumnNames: string[]
): any {
  if (!row || typeof row !== 'object') {
    return undefined;
  }

  // Try exact match first
  for (const colName of possibleColumnNames) {
    if (colName in row) {
      return normalizeValue(row[colName]);
    }
  }

  // Try case-insensitive match
  const rowKeys = Object.keys(row);
  for (const colName of possibleColumnNames) {
    const lowerColName = colName.toLowerCase();
    const matchedKey = rowKeys.find(key => key.toLowerCase() === lowerColName);
    if (matchedKey) {
      return normalizeValue(row[matchedKey]);
    }
  }

  // Try to find by checking if any key contains the column name
  for (const colName of possibleColumnNames) {
    const matchedKey = rowKeys.find(key =>
      key.toLowerCase().includes(colName.toLowerCase())
    );
    if (matchedKey) {
      return normalizeValue(row[matchedKey]);
    }
  }

  return undefined;
}

/**
 * Extract string value from row by trying multiple column name formats
 */
export function extractStringValue(
  row: any,
  possibleColumnNames: string[]
): string | null {
  const value = extractColumnValue(row, possibleColumnNames);
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
}

/**
 * Extract embedding field from schema rows
 * Generic helper that works for both embedded and server modes
 */
export function extractEmbeddingField(schema: any[]): any | null {
  if (!Array.isArray(schema) || schema.length === 0) {
    return null;
  }

  // Try to find by Field name matching CollectionFieldNames.EMBEDDING
  let embeddingField = schema.find(
    (row: any) => {
      const fieldName = extractStringValue(row, ['Field', 'field', 'FIELD']);
      return fieldName === CollectionFieldNames.EMBEDDING;
    }
  );

  // Fallback: try to find by Type containing VECTOR
  if (!embeddingField) {
    embeddingField = schema.find(
      (row: any) => {
        const typeValue = extractStringValue(row, ['Type', 'type', 'TYPE']);
        return typeValue && /VECTOR\(/i.test(typeValue);
      }
    );
  }

  // Another fallback: check all values for VECTOR type
  if (!embeddingField) {
    for (const row of schema) {
      for (const value of Object.values(row)) {
        const strValue = typeof value === 'string' ? value : String(value);
        if (/VECTOR\(/i.test(strValue)) {
          return row;
        }
      }
    }
  }

  return embeddingField;
}

/**
 * Extract dimension from embedding field
 */
export function extractDimension(embeddingField: any): number | null {
  if (!embeddingField) {
    return null;
  }

  // Try to get Type value
  let typeValue = extractStringValue(embeddingField, ['Type', 'type', 'TYPE']);

  // If not found, search all values
  if (!typeValue || !/VECTOR\(/i.test(typeValue)) {
    for (const value of Object.values(embeddingField)) {
      const strValue = typeof value === 'string' ? value : String(value);
      if (/VECTOR\(/i.test(strValue)) {
        typeValue = strValue;
        break;
      }
    }
  }

  if (!typeValue || !/VECTOR\(/i.test(typeValue)) {
    return null;
  }

  const match = typeValue.match(/VECTOR\((\d+)\)/i);
  if (!match) {
    return null;
  }

  return parseInt(match[1], 10);
}

/**
 * Extract distance from CREATE TABLE statement
 * Generic helper that works for both embedded and server modes
 */
export function extractDistance(createTableRow: any): string | null {
  if (!createTableRow || typeof createTableRow !== 'object') {
    return null;
  }

  // Strategy 1: Try to find CREATE TABLE statement first (most reliable)
  // Check common column names for SHOW CREATE TABLE result
  let createStmt: string | null = null;

  // Try standard column names
  const possibleColumnNames = ['Create Table', 'Create table', 'CREATE TABLE', 'col_1', 'col_0'];
  for (const colName of possibleColumnNames) {
    if (colName in createTableRow) {
      const value = createTableRow[colName];
      if (value !== null && value !== undefined) {
        const strValue = String(value);
        if (strValue.length > 0 && /CREATE TABLE/i.test(strValue)) {
          createStmt = strValue;
          break;
        }
      }
    }
  }

  // Strategy 2: If not found by column name, search all values
  if (!createStmt) {
    for (const value of Object.values(createTableRow)) {
      if (value !== null && value !== undefined) {
        const strValue = String(value);
        if (strValue.length > 0 && /CREATE TABLE/i.test(strValue)) {
          createStmt = strValue;
          break;
        }
      }
    }
  }

  // Strategy 3: If CREATE TABLE statement found, extract distance from it
  if (createStmt) {
    const normalized = createStmt.replace(/\s+/g, ' ').replace(/\n/g, ' ');

    // Try exact match first: distance=l2, distance=cosine, etc.
    const exactMatch = normalized.match(/distance\s*=\s*(l2|cosine|inner_product|ip)\b/i);
    if (exactMatch && exactMatch[1]) {
      return exactMatch[1].toLowerCase();
    }

    // Try permissive match: distance= followed by any non-whitespace, non-comma, non-paren sequence
    const permissiveMatch = normalized.match(/distance\s*=\s*([^,\s\)]+)/i);
    if (permissiveMatch && permissiveMatch[1]) {
      const parsedDistance = permissiveMatch[1].toLowerCase().replace(/['"]/g, '').trim();
      if (
        parsedDistance === "l2" ||
        parsedDistance === "cosine" ||
        parsedDistance === "inner_product" ||
        parsedDistance === "ip"
      ) {
        return parsedDistance;
      }
    }
  }

  // Strategy 4: Fallback - search all values for distance= pattern (in case CREATE TABLE not found)
  for (const value of Object.values(createTableRow)) {
    if (value !== null && value !== undefined) {
      const strValue = String(value);
      const normalized = strValue.replace(/\s+/g, ' ').replace(/\n/g, ' ');

      if (normalized.includes('distance')) {
        const exactMatch = normalized.match(/distance\s*=\s*(l2|cosine|inner_product|ip)\b/i);
        if (exactMatch && exactMatch[1]) {
          return exactMatch[1].toLowerCase();
        }

        const permissiveMatch = normalized.match(/distance\s*=\s*([^,\s\)]+)/i);
        if (permissiveMatch && permissiveMatch[1]) {
          const parsedDistance = permissiveMatch[1].toLowerCase().replace(/['"]/g, '').trim();
          if (
            parsedDistance === "l2" ||
            parsedDistance === "cosine" ||
            parsedDistance === "inner_product" ||
            parsedDistance === "ip"
          ) {
            return parsedDistance;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Common column names for SHOW TABLES result
 * Used for extracting table names in listCollections
 */
export const TABLE_NAME_COLUMNS: string[] = [
  'Tables_in_database',
  'Table',
  'table',
  'TABLE',
  'Table_name',
  'table_name',
  'TABLE_NAME'
];

/**
 * Shared core logic for listCollections
 * Extracts table names from query results and filters by prefix
 * 
 * @param result - Query result rows
 * @param prefix - Table name prefix to filter (e.g., "c$v1$")
 * @returns Array of table names matching the prefix
 */
export function extractTableNamesFromResult(
  result: any[],
  prefix: string
): string[] {
  const tableNames: string[] = [];
  const seenNames = new Set<string>();

  for (const row of result) {
    // Extract table name using generic extraction
    let tableName = extractStringValue(row, [...TABLE_NAME_COLUMNS]);

    // Handle information_schema format (TABLE_NAME column)
    if (!tableName && (row as any).TABLE_NAME) {
      tableName = (row as any).TABLE_NAME;
    }

    // If not found, try to get first string value from row
    if (!tableName) {
      for (const value of Object.values(row)) {
        if (value !== null && value !== undefined) {
          const strValue = String(value).trim();
          if (strValue.length > 0) {
            tableName = strValue;
            break;
          }
        }
      }
    }

    // Remove backticks if present
    if (tableName && typeof tableName === 'string') {
      tableName = tableName.replace(/^`|`$/g, '');

      // Only process if table name starts with prefix and we haven't seen it before
      if (tableName.startsWith(prefix) && !seenNames.has(tableName)) {
        seenNames.add(tableName);
        tableNames.push(tableName);
      }
    }
  }

  return tableNames;
}

/**
 * Query table names using multiple strategies
 * Tries SHOW TABLES LIKE, then SHOW TABLES, then information_schema (if supported)
 * 
 * @param internalClient - Internal client for executing queries
 * @param prefix - Table name prefix to filter (e.g., "c$v1$")
 * @param tryInformationSchema - Whether to try information_schema fallback (default: true)
 * @returns Query result rows, or null if no results
 */
export async function queryTableNames(
  internalClient: { execute(sql: string, params?: unknown[]): Promise<any[] | null> },
  prefix: string,
  tryInformationSchema: boolean = true
): Promise<any[] | null> {
  // Strategy 1: Try SHOW TABLES LIKE first (more efficient if supported)
  let sql = `SHOW TABLES LIKE '${prefix}%'`;
  let result = await internalClient.execute(sql);

  // Strategy 2: If no results, try SHOW TABLES to get all tables and filter manually
  if (!result || result.length === 0) {
    sql = `SHOW TABLES`;
    result = await internalClient.execute(sql);
  }

  // Strategy 3: Fallback to information_schema (if supported and enabled)
  if ((!result || result.length === 0) && tryInformationSchema) {
    try {
      // Get current database name
      const dbResult = await internalClient.execute("SELECT DATABASE()");
      if (dbResult && dbResult.length > 0) {
        const dbName =
          (dbResult[0] as any)["DATABASE()"] || Object.values(dbResult[0])[0];
        if (dbName) {
          result = await internalClient.execute(
            `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE ?`,
            [dbName, `${prefix}%`]
          );
        }
      }
    } catch (fallbackError) {
      // If information_schema is not supported (e.g., embedded mode), silently ignore
      // This is expected behavior for embedded mode
    }
  }

  return result && result.length > 0 ? result : null;
}

/**
 * Default constants
 */
export const DEFAULT_VECTOR_DIMENSION = 384;
export const DEFAULT_DISTANCE_METRIC = "cosine";
export const DEFAULT_TENANT = "sys"; // seekdb Server default tenant
export const DEFAULT_DATABASE = "test";
export const DEFAULT_PORT = 2881;
export const DEFAULT_USER = "root";
export const DEFAULT_CHARSET = "utf8mb4";
