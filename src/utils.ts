/**
 * Utility functions for SeekDB SDK
 */

import { SeekDBValueError } from './errors.js';
import type { Metadata } from './types.js';

/**
 * Normalize input to array
 */
export function toArray<T>(input: T | T[]): T[] {
  return Array.isArray(input) ? input : [input];
}

/**
 * Normalize embeddings to 2D array
 */
export function normalizeEmbeddings(embeddings: number[] | number[][]): number[][] {
  if (embeddings.length === 0) {
    return [];
  }
  // Check if it's a 1D array (single embedding)
  if (typeof embeddings[0] === 'number') {
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
    throw new SeekDBValueError(
      `Record set has inconsistent lengths: ${JSON.stringify({
        ids: recordSet.ids?.length,
        embeddings: recordSet.embeddings?.length,
        metadatas: recordSet.metadatas?.length,
        documents: recordSet.documents?.length,
      })}`
    );
  }
}

/**
 * Validate IDs
 */
export function validateIDs(ids: string[]): void {
  if (ids.length === 0) {
    throw new SeekDBValueError('IDs cannot be empty');
  }

  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    throw new SeekDBValueError('IDs must be unique');
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
    throw new SeekDBValueError(`Failed to parse metadata: ${error}`);
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
  return '[' + vector.join(',') + ']';
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
  static readonly ID = '_id';
  static readonly DOCUMENT = 'document';
  static readonly METADATA = 'metadata';
  static readonly EMBEDDING = 'embedding';
}

/**
 * Default constants
 */
export const DEFAULT_VECTOR_DIMENSION = 384;
export const DEFAULT_DISTANCE_METRIC = 'cosine';
export const DEFAULT_TENANT = 'sys';
export const DEFAULT_DATABASE = 'test';
export const DEFAULT_PORT = 2881;
export const DEFAULT_USER = 'root';
export const DEFAULT_CHARSET = 'utf8mb4';
