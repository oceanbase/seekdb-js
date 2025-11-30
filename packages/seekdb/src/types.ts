/**
 * Type definitions for SeekDB SDK
 */

import { IEmbeddingFunction } from "./embedding-function.js";
export type EmbeddingFunction = IEmbeddingFunction;

// ==================== Basic Types ====================

/**
 * Metadata type - supports primitive values, arrays, and nested objects
 */
export type MetadataValue =
  | string
  | number
  | boolean
  | null
  | MetadataValue[]
  | { [key: string]: MetadataValue };
export type Metadata = Record<string, MetadataValue>;

export type EmbeddingDocuments = string | string[];
export type Embeddings = number[][] | number[];

// ==================== Where Filter Types ====================

/**
 * Comparison operators for metadata filtering
 */
export interface WhereOperator<T = MetadataValue> {
  $eq?: T;
  $ne?: T;
  $gt?: number;
  $gte?: number;
  $lt?: number;
  $lte?: number;
  $in?: T[];
  $nin?: T[];
}

export interface WhereLogical {
  $and?: Where[];
  $or?: Where[];
}

export type Where =
  | WhereLogical
  | Record<string, MetadataValue | WhereOperator>;

// ==================== Document Filter Types ====================

export interface WhereDocumentOperator {
  $contains?: string;
  $regex?: string;
}

export interface WhereDocumentLogical {
  $and?: WhereDocument[];
  $or?: WhereDocument[];
}

export type WhereDocument = WhereDocumentLogical | WhereDocumentOperator;

// ==================== Record Types ====================

export interface RecordSet {
  ids: string[];
  embeddings?: number[][];
  metadatas?: Metadata[];
  documents?: string[];
}

// ==================== Result Types ====================

export interface GetResult<TMeta extends Metadata = Metadata> {
  readonly ids: readonly string[];
  readonly embeddings?: readonly (number[] | null)[];
  readonly metadatas?: readonly (TMeta | null)[];
  readonly documents?: readonly (string | null)[];
}

export interface QueryResult<TMeta extends Metadata = Metadata> {
  readonly ids: readonly (readonly string[])[];
  readonly embeddings?: readonly (readonly (number[] | null)[])[];
  readonly metadatas?: readonly (readonly (TMeta | null)[])[];
  readonly documents?: readonly (readonly (string | null)[])[];
  readonly distances?: readonly (readonly (number | null)[])[];
}

// ==================== Collection Configuration ====================

export type DistanceMetric = "l2" | "cosine" | "inner_product";

export interface HNSWConfiguration {
  dimension: number;
  distance?: DistanceMetric;
}

// ==================== Client Configuration ====================

export interface SeekDBClientArgs {
  host: string;
  port?: number;
  tenant?: string;
  database?: string;
  user?: string;
  password?: string;
  charset?: string;
}

export interface SeekDBAdminClientArgs {
  host: string;
  port?: number;
  tenant?: string;
  user?: string;
  password?: string;
  charset?: string;
}

// ==================== Collection Options ====================

export interface CreateCollectionOptions {
  name: string;
  configuration?: HNSWConfiguration | null;
  embeddingFunction?: EmbeddingFunction | null;
}

export interface GetCollectionOptions {
  name: string;
  embeddingFunction?: EmbeddingFunction | null;
}

// ==================== Collection Operation Options ====================

export interface AddOptions {
  ids: string | string[];
  embeddings?: number[] | number[][];
  metadatas?: Metadata | Metadata[];
  documents?: string | string[];
}

export interface UpdateOptions {
  ids: string | string[];
  embeddings?: number[] | number[][];
  metadatas?: Metadata | Metadata[];
  documents?: string | string[];
}

export interface UpsertOptions {
  ids: string | string[];
  embeddings?: number[] | number[][];
  metadatas?: Metadata | Metadata[];
  documents?: string | string[];
}

export interface DeleteOptions {
  ids?: string | string[];
  where?: Where;
  whereDocument?: WhereDocument;
}

export interface GetOptions {
  ids?: string | string[];
  where?: Where;
  whereDocument?: WhereDocument;
  limit?: number;
  offset?: number;
  include?: readonly ("documents" | "metadatas" | "embeddings")[];
}

export interface QueryOptions {
  queryEmbeddings?: number[] | number[][];
  queryTexts?: string | string[];
  nResults?: number;
  where?: Where;
  whereDocument?: WhereDocument;
  include?: readonly ("documents" | "metadatas" | "embeddings" | "distances")[];
}

export interface HybridSearchQuery {
  whereDocument?: WhereDocument;
  where?: Where;
  nResults?: number;
}

export interface HybridSearchKNN {
  queryEmbeddings?: number[] | number[][];
  queryTexts?: string | string[];
  where?: Where;
  nResults?: number;
}

export interface HybridSearchRank {
  rrf?: {
    rankWindowSize?: number;
    rankConstant?: number;
  };
}

export interface HybridSearchOptions {
  query?: HybridSearchQuery;
  knn?: HybridSearchKNN;
  rank?: HybridSearchRank;
  nResults?: number;
  include?: readonly ("documents" | "metadatas" | "embeddings" | "distances")[];
}

// ==================== Database Types ====================

export type { Database } from "./database.js";
