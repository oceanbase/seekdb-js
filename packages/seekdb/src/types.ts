/**
 * Type definitions for seekdb SDK
 */

import type { RowDataPacket } from "mysql2/promise";
import type { SeekdbClient } from "./client.js";

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

/**
 * Internal client interface - implemented by both InternalClient and InternalEmbeddedClient
 */
export interface IInternalClient {
  isConnected(): boolean;
  execute(sql: string, params?: unknown[]): Promise<RowDataPacket[] | null>;
  close(): Promise<void>;
}

export interface CollectionContext {
  name: string;
  collectionId?: string;
  dimension?: number;
  distance?: DistanceMetric;
}

export interface CollectionConfig {
  name: string;
  dimension: number;
  distance: DistanceMetric;
  embeddingFunction?: EmbeddingFunction;
  metadata?: Metadata;
  collectionId?: string; // v2 format collection ID
  client?: SeekdbClient;
  internalClient: IInternalClient;
}

export interface HNSWConfiguration {
  dimension: number;
  distance?: DistanceMetric;
}

export type FulltextAnalyzer = "space" | "ngram" | "ngram2" | "beng" | "ik";

export interface SpaceProperties {
  min_token_size?: number; // [1, 16]
  max_token_size?: number; // [10, 84]
}

export interface NgramProperties {
  ngram_token_size?: number; // [1, 10]
}

export interface Ngram2Properties {
  min_ngram_size?: number; // [1, 16]
  max_ngram_size?: number; // [1, 16]
}

export interface BengProperties {
  min_token_size?: number; // [1, 16]
  max_token_size?: number; // [10, 84]
}

export interface IkProperties {
  ik_mode?: "smart" | "max_word";
}

export type FulltextProperties =
  | SpaceProperties
  | NgramProperties
  | Ngram2Properties
  | BengProperties
  | IkProperties;

export interface FulltextAnalyzerConfig {
  analyzer?: FulltextAnalyzer;
  properties?: FulltextProperties;
}

export interface Configuration {
  hnsw?: HNSWConfiguration;
  fulltextConfig?: FulltextAnalyzerConfig;
}

export type ConfigurationParam = HNSWConfiguration | Configuration;

// ==================== Client Configuration ====================

export interface SeekdbClientArgs {
  path?: string; // For embedded mode
  host?: string; // For remote server mode
  port?: number;
  /** For OceanBase server mode only: tenant name (e.g. `"sys"`). Omit for seekdb server. */
  tenant?: string;
  database?: string;
  user?: string;
  password?: string;
  charset?: string;
  /** Optional OceanBase/seekdb query timeout in milliseconds. */
  queryTimeout?: number;
}

export interface SeekdbAdminClientArgs {
  path?: string; // For embedded mode
  host?: string; // For remote server mode
  port?: number;
  /** For OceanBase server mode only: tenant name (e.g. `"sys"`). Omit for seekdb server. */
  tenant?: string;
  user?: string;
  password?: string;
  charset?: string;
}

// ==================== Collection Options ====================

export interface CreateCollectionOptions {
  name: string;
  configuration?: ConfigurationParam | null;
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
  distance?: DistanceMetric;
  /**
   * Defaults to true.
   */
  approximate?: boolean;
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

export interface ForkOptions {
  name: string;
}

// ==================== Database Types ====================

export type { Database } from "./database.js";

// ==================== Embedding Function Types ====================

export interface EmbeddingConfig {
  [key: string]: any;
}

export interface EmbeddingFunction {
  readonly name: string;
  generate(texts: string[]): Promise<number[][]>;
  getConfig(): EmbeddingConfig;
  dispose?(): Promise<void>;
  dimension?: number;
}

export interface EmbeddingFunctionConstructor {
  new (config: EmbeddingConfig): EmbeddingFunction;
  buildFromConfig(config: EmbeddingConfig): EmbeddingFunction;
  getModelDimensions?: () => Record<string, number>;
}
