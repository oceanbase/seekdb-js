import type {
  ConfigurationParam,
  DistanceMetric,
  EmbeddingFunction,
  FulltextAnalyzer,
  FulltextAnalyzerConfig,
  FulltextAnalyzerPropertiesMap,
  HNSWConfiguration,
  SourceKey,
  SparseEmbeddingFunction,
} from "./types.js";
import { Key } from "./key.js";
import {
  getEmbeddingFunction,
  getSparseEmbeddingFunction,
  supportsPersistence,
  supportsSparsePersistence,
} from "./embedding-function.js";
import { SeekdbValueError } from "./errors.js";

const DEFAULT_FULLTEXT_ANALYZER: FulltextAnalyzer = "ik";

export interface HnswParams {
  dimension?: number;
  distance?: DistanceMetric;
  // Future extension:
  // m?: number;
  // efConstruction?: number;
  // efSearch?: number;
  // type?: "hnsw" | "sq" | "bq";
  // lib?: "vsag";
}

export class FullTextIndexConfig {
  readonly type = "FullTextIndexConfig";
  public readonly analyzer: FulltextAnalyzer;
  public readonly properties?: FulltextAnalyzerPropertiesMap[FulltextAnalyzer];

  constructor(
    analyzer?: FulltextAnalyzer,
    properties?: FulltextAnalyzerPropertiesMap[FulltextAnalyzer]
  ) {
    this.analyzer = analyzer ?? DEFAULT_FULLTEXT_ANALYZER;
    this.properties = properties ?? {};
  }

  toMetadataJson(): any {
    return {
      analyzer: this.analyzer,
      properties: this.properties,
    };
  }
}

export interface VectorIndexConfigOptions {
  hnsw?: HnswParams;
  embeddingFunction?: EmbeddingFunction | null;
}

export class VectorIndexConfig {
  readonly type = "VectorIndexConfig";
  hnsw?: HnswParams;
  embeddingFunction?: EmbeddingFunction | null;

  constructor(options: VectorIndexConfigOptions = {}) {
    const { hnsw, embeddingFunction } = options;
    this.hnsw = hnsw;
    this.embeddingFunction = embeddingFunction;
  }

  toMetadataJson(): any {
    return {
      hnsw: this.hnsw,
      embeddingFunction: supportsPersistence(this.embeddingFunction)
        ? {
            name: this.embeddingFunction.name,
            properties: this.embeddingFunction.getConfig(),
          }
        : undefined,
    };
  }
}

export interface SparseVectorIndexConfigOptions {
  sourceKey: SourceKey;
  embeddingFunction?: SparseEmbeddingFunction | null;
}

export class SparseVectorIndexConfig {
  readonly type = "SparseVectorIndexConfig";
  readonly sourceKey: SourceKey;
  readonly embeddingFunction?: SparseEmbeddingFunction | null;

  constructor(options: SparseVectorIndexConfigOptions) {
    const { sourceKey, embeddingFunction } = options;
    if (!sourceKey) throw new SeekdbValueError("sourceKey is required");
    this.sourceKey = sourceKey;
    this.embeddingFunction = embeddingFunction;
  }

  toMetadataJson(): any {
    return {
      sourceKey: resolveSourceKeyName(this.sourceKey),
      embeddingFunction: supportsSparsePersistence(this.embeddingFunction)
        ? {
            name: this.embeddingFunction.name,
            properties: this.embeddingFunction.getConfig(),
          }
        : undefined,
    };
  }
}

export type IndexConfig =
  | FullTextIndexConfig
  | VectorIndexConfig
  | SparseVectorIndexConfig;

const resolveSourceKeyName = (sourceKey: SourceKey): string | null => {
  if (sourceKey == null) return null;
  if (sourceKey instanceof Key) return sourceKey.name;
  return String(sourceKey);
};

/**
 * Collection schema (SeekDB flavor).
 *
 * Notes:
 * - `createIndex` is global (no per-field key in SeekDB JS SDK).
 * - Dense vectorIndex + fulltextIndex are enabled by default when schema is omitted.
 */
export class Schema {
  fulltextIndex?: FullTextIndexConfig;
  vectorIndex?: VectorIndexConfig;
  sparseVectorIndex?: SparseVectorIndexConfig;

  constructor(config?: {
    fulltextIndex?: FullTextIndexConfig;
    vectorIndex?: VectorIndexConfig;
    sparseVectorIndex?: SparseVectorIndexConfig;
  }) {
    if (config?.fulltextIndex) {
      this.fulltextIndex = config.fulltextIndex;
    }
    if (config?.vectorIndex) {
      this.vectorIndex = config.vectorIndex;
    }
    if (config?.sparseVectorIndex) {
      this.sparseVectorIndex = config.sparseVectorIndex;
    }
  }

  createIndex(config: IndexConfig): this {
    if (config instanceof FullTextIndexConfig) {
      this.fulltextIndex = config;
      return this;
    }
    if (config instanceof VectorIndexConfig) {
      this.vectorIndex = config;
      return this;
    }
    if (config instanceof SparseVectorIndexConfig) {
      this.sparseVectorIndex = config;
      return this;
    }
    // Unreachable with current union, but keep runtime safety.
    throw new TypeError("Unknown index config");
  }

  static default(): Schema {
    return new Schema()
      .createIndex(new FullTextIndexConfig())
      .createIndex(new VectorIndexConfig());
  }

  static fromLegacy(
    configuration: ConfigurationParam | null | undefined,
    embeddingFunction?: EmbeddingFunction | null
  ): Schema {
    if (configuration === null || !configuration) {
      // Explicit null keeps the legacy behavior: dimension must be inferred from EF.
      return Schema.default();
    }

    let hnsw: HNSWConfiguration | undefined;
    let fulltextConfig: FulltextAnalyzerConfig | undefined;

    if ("hnsw" in configuration || "fulltextConfig" in configuration) {
      hnsw = configuration.hnsw;
      fulltextConfig = configuration.fulltextConfig;
    } else {
      hnsw = configuration as HNSWConfiguration;
    }

    return new Schema()
      .createIndex(new VectorIndexConfig({ hnsw, embeddingFunction }))
      .createIndex(
        new FullTextIndexConfig(
          fulltextConfig?.analyzer,
          fulltextConfig?.properties
        )
      );
  }

  toMetadataJson(): any {
    return {
      fulltextIndex: this.fulltextIndex
        ? this.fulltextIndex.toMetadataJson()
        : undefined,
      vectorIndex: this.vectorIndex
        ? this.vectorIndex.toMetadataJson()
        : undefined,
      sparseVectorIndex: this.sparseVectorIndex
        ? this.sparseVectorIndex.toMetadataJson()
        : undefined,
    };
  }

  static async fromJSON(json: any): Promise<Schema | undefined> {
    if (!json || typeof json !== "object") return undefined;
    const { fulltextIndex, vectorIndex, sparseVectorIndex } = json;
    const schema = new Schema();

    if (fulltextIndex) {
      schema.createIndex(
        new FullTextIndexConfig(
          (fulltextIndex.analyzer ??
            DEFAULT_FULLTEXT_ANALYZER) as FulltextAnalyzer,
          fulltextIndex.properties
        )
      );
    }
    if (vectorIndex) {
      const embeddingFunction =
        vectorIndex.embeddingFunction &&
        (await getEmbeddingFunction(
          vectorIndex.embeddingFunction.name,
          vectorIndex.embeddingFunction.properties
        ));
      schema.createIndex(
        new VectorIndexConfig({
          hnsw: vectorIndex.hnsw ?? {},
          embeddingFunction,
        })
      );
    }
    if (sparseVectorIndex) {
      const embeddingFunction =
        sparseVectorIndex.embeddingFunction &&
        (await getSparseEmbeddingFunction(
          sparseVectorIndex.embeddingFunction.name,
          sparseVectorIndex.embeddingFunction.properties
        ));
      schema.createIndex(
        new SparseVectorIndexConfig({
          sourceKey: sparseVectorIndex.sourceKey ?? null,
          embeddingFunction,
        })
      );
    }

    return schema;
  }
}
