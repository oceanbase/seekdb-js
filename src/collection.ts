/**
 * Collection class - represents a collection of documents with vector embeddings
 */

import type { SeekDBClient } from './client.js';
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
   * Add data to collection
   */
  async add(options: AddOptions): Promise<void> {
    return this.client._collectionAdd(
      this.name,
      options,
      this.embeddingFunction
    );
  }

  /**
   * Update data in collection
   */
  async update(options: UpdateOptions): Promise<void> {
    return this.client._collectionUpdate(
      this.name,
      options,
      this.embeddingFunction
    );
  }

  /**
   * Upsert data in collection
   */
  async upsert(options: UpsertOptions): Promise<void> {
    return this.client._collectionUpsert(
      this.name,
      options,
      this.embeddingFunction
    );
  }

  /**
   * Delete data from collection
   */
  async delete(options: DeleteOptions): Promise<void> {
    return this.client._collectionDelete(this.name, options);
  }

  /**
   * Get data from collection
   */
  async get<TMeta extends Metadata = Metadata>(options?: GetOptions): Promise<GetResult<TMeta>> {
    return this.client._collectionGet<TMeta>(this.name, options);
  }

  /**
   * Query collection with vector similarity search
   */
  async query<TMeta extends Metadata = Metadata>(
    options: QueryOptions
  ): Promise<QueryResult<TMeta>> {
    return this.client._collectionQuery<TMeta>(
      this.name,
      options,
      this.embeddingFunction
    );
  }

  /**
   * Hybrid search (full-text + vector)
   */
  async hybridSearch<TMeta extends Metadata = Metadata>(
    options: HybridSearchOptions
  ): Promise<QueryResult<TMeta>> {
    return this.client._collectionHybridSearch<TMeta>(
      this.name,
      options,
      this.embeddingFunction
    );
  }

  /**
   * Count items in collection
   */
  async count(): Promise<number> {
    return this.client._collectionCount(this.name);
  }

  /**
   * Peek at first N items in collection
   */
  async peek<TMeta extends Metadata = Metadata>(limit: number = 10): Promise<GetResult<TMeta>> {
    return this.get<TMeta>({ limit });
  }
}
