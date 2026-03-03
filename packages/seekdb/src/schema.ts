import type {
  ConfigurationParam,
  DistanceMetric,
  EmbeddingFunction,
  FulltextAnalyzer,
  FulltextAnalyzerConfig,
  FulltextAnalyzerPropertiesMap,
  HNSWConfiguration,
  HnswParams,
  SourceKey,
  SparseEmbeddingFunction,
  SparseVectorIndexConfigOptions,
  VectorIndexConfigOptions,
} from "./types.js";
import { Key } from "./key.js";
import {
  getEmbeddingFunction,
  getSparseEmbeddingFunction,
  supportsPersistence,
  supportsSparsePersistence,
} from "./embedding-function.js";
import { SeekdbValueError } from "./errors.js";
import {
  validateHnsw,
  validateSparseIndex,
  validateFulltextProperties,
} from "./validation.js";

const DEFAULT_FULLTEXT_ANALYZER: FulltextAnalyzer = "ik";

export class FullTextIndexConfig {
  readonly _type = "FullTextIndexConfig";
  public readonly analyzer: FulltextAnalyzer;
  public readonly properties?: FulltextAnalyzerPropertiesMap[FulltextAnalyzer];

  constructor(
    analyzer?: FulltextAnalyzer,
    properties?: FulltextAnalyzerPropertiesMap[FulltextAnalyzer]
  ) {
    this.analyzer = analyzer ?? DEFAULT_FULLTEXT_ANALYZER;
    this.properties = properties ?? {};
    validateFulltextProperties(
      this.analyzer,
      this.properties as Record<string, unknown>
    );
  }

  toMetadataJson(): any {
    return {
      analyzer: this.analyzer,
      properties: this.properties,
    };
  }
}

export class VectorIndexConfig {
  readonly _type = "VectorIndexConfig";
  hnsw?: HnswParams;
  embeddingFunction?: EmbeddingFunction | null;

  constructor(options: VectorIndexConfigOptions = {}) {
    const { hnsw, embeddingFunction } = options;
    this.hnsw = hnsw;
    this.embeddingFunction = embeddingFunction;

    if (hnsw) validateHnsw(hnsw);

    // Only validate: if both set, they must match (dimension is resolved in createCollection)
    if (
      embeddingFunction?.dimension !== undefined &&
      this.hnsw?.dimension !== undefined &&
      this.hnsw.dimension !== embeddingFunction.dimension
    ) {
      throw new SeekdbValueError(
        `Embedding function dimension (${embeddingFunction.dimension}) does not match hnsw dimension (${this.hnsw.dimension})`
      );
    }
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

export class SparseVectorIndexConfig {
  readonly _type = "SparseVectorIndexConfig";
  readonly distance?: "inner_product";
  readonly type?: "sindi";
  readonly lib?: "vsag";
  readonly sourceKey: SourceKey;
  readonly embeddingFunction?: SparseEmbeddingFunction | null;
  readonly prune?: boolean;
  readonly refine?: boolean;
  readonly drop_ratio_build?: number;
  readonly drop_ratio_search?: number;
  readonly refine_k?: number;

  constructor(options: SparseVectorIndexConfigOptions) {
    const {
      sourceKey,
      distance,
      type,
      lib,
      embeddingFunction,
      prune,
      refine,
      drop_ratio_build,
      drop_ratio_search,
      refine_k,
    } = options;
    if (!sourceKey) throw new SeekdbValueError("sourceKey is required");
    validateSparseIndex(options);
    this.sourceKey = sourceKey;
    this.distance = distance;
    this.type = type;
    this.lib = lib;
    this.embeddingFunction = embeddingFunction;
    this.prune = prune;
    this.refine = refine;
    this.drop_ratio_build = drop_ratio_build;
    this.drop_ratio_search = drop_ratio_search;
    this.refine_k = refine_k;
  }

  toMetadataJson(): any {
    return {
      sourceKey: resolveSourceKeyName(this.sourceKey),
      distance: this.distance,
      type: this.type,
      lib: this.lib,
      prune: this.prune,
      refine: this.refine,
      drop_ratio_build: this.drop_ratio_build,
      drop_ratio_search: this.drop_ratio_search,
      refine_k: this.refine_k,
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
    if (configuration === null || configuration === undefined) {
      const schema = Schema.default();
      // Always pass second param so embeddingFunction applies when config is absent (#1);
      // explicit null yields VectorIndexConfig({ embeddingFunction: null }) (#2)
      schema.vectorIndex = new VectorIndexConfig({ embeddingFunction });
      return schema;
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
