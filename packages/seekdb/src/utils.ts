/**
 * Utility functions for seekdb SDK
 */

import { SeekdbValueError } from "./errors.js";
import type { Metadata, EmbeddingFunction, EmbeddingConfig } from "./types.js";
import { getEmbeddingFunction } from "./embedding-function.js";

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
 * Maximum allowed length for collection names
 */
const MAX_COLLECTION_NAME_LENGTH = 512;

/**
 * Pattern for valid collection names (only letters, digits, and underscore)
 */
const COLLECTION_NAME_PATTERN = /^[A-Za-z0-9_]+$/;

/**
 * Validate collection name against allowed charset and length constraints.
 * 
 * Rules:
 * - Type must be string
 * - Length between 1 and MAX_COLLECTION_NAME_LENGTH (512)
 * - Only [a-zA-Z0-9_]
 * 
 * @param name - Collection name to validate
 * @throws TypeError if name is not a string
 * @throws SeekdbValueError if name is empty, too long, or contains invalid characters
 */
export function validateCollectionName(name: unknown): asserts name is string {
  if (typeof name !== "string") {
    throw new SeekdbValueError(`Collection name must be a string, got ${typeof name}`,);
  }

  if (name.length === 0) {
    throw new SeekdbValueError("Collection name must not be empty");
  }

  if (name.length > MAX_COLLECTION_NAME_LENGTH) {
    throw new SeekdbValueError(
      `Collection name too long: ${name.length} characters; maximum allowed is ${MAX_COLLECTION_NAME_LENGTH}`,
    );
  }

  if (!COLLECTION_NAME_PATTERN.test(name)) {
    throw new SeekdbValueError(
      "Collection name contains invalid characters. " +
      "Only letters, digits, and underscore are allowed: [a-zA-Z0-9_]",
    );
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
  /**
   * Generate table name for collection
   * @param collectionName - Name of the collection
   * @param collectionId - Optional collection ID (for v2 format)
   * @returns Table name in v1 or v2 format
   */
  static tableName(collectionName: string, collectionId?: string): string {
    if (collectionId) {
      return `${COLLECTION_V2_PREFIX}${collectionId}`;
    }
    return `${COLLECTION_V1_PREFIX}${collectionName}`;
  }

  /**
   * Detect table version from table name
   * @param tableName - Full table name
   * @returns "v1" | "v2" | null
   */
  static detectTableVersion(tableName: string): "v1" | "v2" | null {
    if (tableName.startsWith(COLLECTION_V1_PREFIX)) {
      return "v1";
    }
    if (tableName.startsWith(COLLECTION_V2_PREFIX)) {
      return "v2";
    }
    return null;
  }

  /**
   * Extract collection name from v1 table name
   * @param tableName - Full v1 table name (c$v1$collection_name)
   * @returns Collection name or null if not v1 format
   */
  static extractCollectionName(tableName: string): string | null {
    if (tableName.length === 0) {
      return null;
    }
    if (tableName.startsWith(COLLECTION_V1_PREFIX)) {
      return tableName.substring(COLLECTION_V1_PREFIX.length);
    }
    return null;
  }

  /**
   * Extract collection ID from v2 table name
   * @param tableName - Full v2 table name (c$v2$collection_id)
   * @returns Collection ID or null if not v2 format
   */
  static extractCollectionId(tableName: string): string | null {
    if (tableName.startsWith(COLLECTION_V2_PREFIX)) {
      return tableName.substring(COLLECTION_V2_PREFIX.length);
    }
    return null;
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
 * Default constants
 */
export const DEFAULT_VECTOR_DIMENSION = 384;
export const DEFAULT_DISTANCE_METRIC = "cosine";
export const DEFAULT_TENANT = "sys"; // seekdb Server default tenant
export const DEFAULT_DATABASE = "test";
export const DEFAULT_PORT = 2881;
export const DEFAULT_USER = "root";
export const DEFAULT_CHARSET = "utf8mb4";

/**
 * Collection table name prefixes
 */
export const COLLECTION_V1_PREFIX = "c$v1$";
export const COLLECTION_V2_PREFIX = "c$v2$";

/**
 * Resolve embedding function from metadata or props
 * Priority:
 * 1. If customEmbeddingFunction is explicitly null, return undefined (no embedding function)
 * 2. If customEmbeddingFunction is provided (not undefined), use it
 * 3. If embeddingFunctionMetadata exists, use buildFromConfig to instantiate from snake_case config
 * 4. If both are undefined, use default embedding function
 * 
 * Also validates dimension compatibility between metadata and props embedding functions
 */
export async function resolveEmbeddingFunction(
  embeddingFunctionMetadata?: { name: string; properties: EmbeddingConfig },
  customEmbeddingFunction?: EmbeddingFunction | null,
): Promise<EmbeddingFunction | undefined> {
  // If customEmbeddingFunction is explicitly null, return undefined
  if (customEmbeddingFunction === null) {
    return undefined;
  }

  // If customEmbeddingFunction is provided (not undefined), use it
  if (customEmbeddingFunction !== undefined) return customEmbeddingFunction;

  // Use metadata embedding function with buildFromConfig (snake_case config from storage)
  if (embeddingFunctionMetadata) {
    return await getEmbeddingFunction(
      embeddingFunctionMetadata.name,
      embeddingFunctionMetadata.properties,
    );
  }

  // Default - use default embedding function
  return await getEmbeddingFunction();
}
