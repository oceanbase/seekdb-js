import { describe, expect, test } from "vitest";
import { K, Key } from "../../src/key.js";
import {
  FullTextIndexConfig,
  Schema,
  SparseVectorIndexConfig,
  VectorIndexConfig,
} from "../../src/schema.js";
import { SeekdbValueError } from "../../src/errors.js";
import {
  registerSparseEmbeddingFunction,
  supportsPersistence,
  supportsSparsePersistence,
} from "../../src/embedding-function.js";
import type {
  EmbeddingConfig,
  EmbeddingFunction,
  SparseEmbeddingFunction,
  SparseVector,
} from "../../src/types.js";

// ==================== Fixtures ====================

class PersistableDenseEF implements EmbeddingFunction {
  readonly name = "persistable-dense";
  readonly dimension = 3;
  async generate(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2, 0.3]);
  }
  getConfig(): EmbeddingConfig {
    return { dimension: 3 };
  }
  static buildFromConfig(): PersistableDenseEF {
    return new PersistableDenseEF();
  }
}

class PersistableSparseEF implements SparseEmbeddingFunction {
  readonly name = "persistable-sparse-schema-test";
  async generate(texts: string[]): Promise<SparseVector[]> {
    return texts.map(() => ({ 1: 0.5 }));
  }
  getConfig(): EmbeddingConfig {
    return { foo: "bar" };
  }
  static buildFromConfig(): PersistableSparseEF {
    return new PersistableSparseEF();
  }
}

class NonPersistableSparseEF implements SparseEmbeddingFunction {
  readonly name = "non-persistable-sparse";
  async generate(texts: string[]): Promise<SparseVector[]> {
    return texts.map(() => ({}));
  }
  getConfig(): EmbeddingConfig {
    return {};
  }
  // No buildFromConfig -> not persistable
}

try {
  registerSparseEmbeddingFunction(
    "persistable-sparse-schema-test",
    PersistableSparseEF as any
  );
} catch {
  // already registered in a previous test run within the same process
}

// ==================== Key ====================

describe("Key", () => {
  test("built-in static keys have correct names", () => {
    expect(K.ID.name).toBe("#id");
    expect(K.DOCUMENT.name).toBe("#document");
    expect(K.EMBEDDING.name).toBe("#embedding");
    expect(K.METADATA.name).toBe("#metadata");
    expect(K.SPARSE_EMBEDDING.name).toBe("#sparseEmbedding");
  });

  test("K factory creates a Key instance with given name", () => {
    const k = K("custom-field");
    expect(k).toBeInstanceOf(Key);
    expect(k.name).toBe("custom-field");
  });

  test("K static properties are Key instances", () => {
    expect(K.DOCUMENT).toBeInstanceOf(Key);
    expect(K.SPARSE_EMBEDDING).toBeInstanceOf(Key);
  });
});

// ==================== FullTextIndexConfig ====================

describe("FullTextIndexConfig", () => {
  test("defaults to ik analyzer", () => {
    const cfg = new FullTextIndexConfig();
    expect(cfg.analyzer).toBe("ik");
    expect(cfg._type).toBe("FullTextIndexConfig");
  });

  test("accepts other analyzers", () => {
    expect(new FullTextIndexConfig("ngram").analyzer).toBe("ngram");
    expect(new FullTextIndexConfig("space").analyzer).toBe("space");
    expect(new FullTextIndexConfig("beng").analyzer).toBe("beng");
    expect(new FullTextIndexConfig("ngram2").analyzer).toBe("ngram2");
  });

  test("toMetadataJson returns analyzer and properties", () => {
    const cfg = new FullTextIndexConfig("space", { min_token_size: 2 });
    const json = cfg.toMetadataJson();
    expect(json.analyzer).toBe("space");
    expect(json.properties).toEqual({ min_token_size: 2 });
  });

  test("toMetadataJson returns empty properties when not provided", () => {
    const json = new FullTextIndexConfig("ik").toMetadataJson();
    expect(json.analyzer).toBe("ik");
    expect(json.properties).toEqual({});
  });

  test("throws for invalid space analyzer property", () => {
    expect(
      () => new FullTextIndexConfig("space", { min_token_size: 0 } as any)
    ).toThrow(SeekdbValueError);
    expect(
      () => new FullTextIndexConfig("space", { max_token_size: 9 } as any)
    ).toThrow(SeekdbValueError);
  });

  test("throws for invalid ngram analyzer property", () => {
    expect(
      () => new FullTextIndexConfig("ngram", { ngram_token_size: 0 } as any)
    ).toThrow(SeekdbValueError);
    expect(
      () => new FullTextIndexConfig("ngram", { ngram_token_size: 11 } as any)
    ).toThrow(SeekdbValueError);
  });

  test("throws for invalid ik_mode", () => {
    expect(
      () => new FullTextIndexConfig("ik", { ik_mode: "invalid" } as any)
    ).toThrow(SeekdbValueError);
  });

  test("passes for valid properties", () => {
    expect(
      () =>
        new FullTextIndexConfig("space", {
          min_token_size: 2,
          max_token_size: 20,
        } as any)
    ).not.toThrow();
    expect(
      () => new FullTextIndexConfig("ik", { ik_mode: "smart" } as any)
    ).not.toThrow();
  });
});

// ==================== VectorIndexConfig ====================

describe("VectorIndexConfig", () => {
  test("accepts empty options", () => {
    const cfg = new VectorIndexConfig();
    expect(cfg.hnsw).toBeUndefined();
    expect(cfg.embeddingFunction).toBeUndefined();
    expect(cfg._type).toBe("VectorIndexConfig");
  });

  test("stores hnsw dimension and distance", () => {
    const cfg = new VectorIndexConfig({
      hnsw: { dimension: 128, distance: "cosine" },
    });
    expect(cfg.hnsw?.dimension).toBe(128);
    expect(cfg.hnsw?.distance).toBe("cosine");
  });

  test("throws when embeddingFunction dimension mismatches hnsw dimension", () => {
    const ef = new PersistableDenseEF(); // dimension = 3
    expect(
      () =>
        new VectorIndexConfig({
          hnsw: { dimension: 128 },
          embeddingFunction: ef,
        })
    ).toThrow(SeekdbValueError);
  });

  test("no error when embeddingFunction dimension matches hnsw dimension", () => {
    const ef = new PersistableDenseEF(); // dimension = 3
    expect(
      () =>
        new VectorIndexConfig({ hnsw: { dimension: 3 }, embeddingFunction: ef })
    ).not.toThrow();
  });

  test("no error when either dimension is missing", () => {
    const ef = new PersistableDenseEF();
    expect(
      () => new VectorIndexConfig({ embeddingFunction: ef })
    ).not.toThrow();
    expect(
      () => new VectorIndexConfig({ hnsw: { dimension: 3 } })
    ).not.toThrow();
  });

  test("toMetadataJson includes embeddingFunction when persistable", () => {
    const ef = new PersistableDenseEF();
    const cfg = new VectorIndexConfig({
      hnsw: { dimension: 3 },
      embeddingFunction: ef,
    });
    const json = cfg.toMetadataJson();
    expect(json.embeddingFunction?.name).toBe("persistable-dense");
    expect(json.embeddingFunction?.properties).toEqual({ dimension: 3 });
  });

  test("toMetadataJson omits embeddingFunction when not persistable", () => {
    const nonPersistableEf: EmbeddingFunction = {
      name: "no-persist",
      async generate() {
        return [];
      },
      getConfig() {
        return {};
      },
      // No static buildFromConfig
    };
    const cfg = new VectorIndexConfig({ embeddingFunction: nonPersistableEf });
    const json = cfg.toMetadataJson();
    expect(json.embeddingFunction).toBeUndefined();
  });

  test("stores new hnsw fields: type, lib, m, ef_construction, ef_search, extra_info_max_size", () => {
    const cfg = new VectorIndexConfig({
      hnsw: {
        type: "hnsw_sq",
        lib: "vsag",
        m: 32,
        ef_construction: 400,
        ef_search: 64,
        extra_info_max_size: 512,
      },
    });
    expect(cfg.hnsw?.type).toBe("hnsw_sq");
    expect(cfg.hnsw?.lib).toBe("vsag");
    expect(cfg.hnsw?.m).toBe(32);
    expect(cfg.hnsw?.ef_construction).toBe(400);
    expect(cfg.hnsw?.ef_search).toBe(64);
    expect(cfg.hnsw?.extra_info_max_size).toBe(512);
  });

  test("throws for invalid hnsw type", () => {
    expect(
      () => new VectorIndexConfig({ hnsw: { type: "invalid" as any } })
    ).toThrow(SeekdbValueError);
  });

  test("throws for out-of-range hnsw m", () => {
    expect(() => new VectorIndexConfig({ hnsw: { m: 4 } })).toThrow(
      SeekdbValueError
    );
    expect(() => new VectorIndexConfig({ hnsw: { m: 129 } })).toThrow(
      SeekdbValueError
    );
  });

  test("throws for out-of-range hnsw ef_construction", () => {
    expect(
      () => new VectorIndexConfig({ hnsw: { ef_construction: 4 } })
    ).toThrow(SeekdbValueError);
    expect(
      () => new VectorIndexConfig({ hnsw: { ef_construction: 1001 } })
    ).toThrow(SeekdbValueError);
  });

  test("throws when BQ-only field is set on non-hnsw_bq type", () => {
    expect(
      () => new VectorIndexConfig({ hnsw: { type: "hnsw", refine_k: 10 } })
    ).toThrow(SeekdbValueError);
    expect(
      () =>
        new VectorIndexConfig({ hnsw: { type: "hnsw_sq", bq_use_fht: true } })
    ).toThrow(SeekdbValueError);
  });

  test("passes for valid hnsw_bq params", () => {
    expect(
      () =>
        new VectorIndexConfig({
          hnsw: {
            type: "hnsw_bq",
            refine_k: 10,
            refine_type: "fp32",
            bq_bits_query: 4,
            bq_use_fht: true,
          },
        })
    ).not.toThrow();
  });
});

// ==================== SparseVectorIndexConfig ====================

describe("SparseVectorIndexConfig", () => {
  test("throws when sourceKey is null", () => {
    expect(
      () => new SparseVectorIndexConfig({ sourceKey: null as any })
    ).toThrow(SeekdbValueError);
  });

  test("throws when sourceKey is empty string", () => {
    expect(() => new SparseVectorIndexConfig({ sourceKey: "" as any })).toThrow(
      SeekdbValueError
    );
  });

  test("accepts K.DOCUMENT as sourceKey", () => {
    const cfg = new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT });
    expect(cfg.sourceKey).toBe(K.DOCUMENT);
    expect(cfg._type).toBe("SparseVectorIndexConfig");
  });

  test("accepts K.SPARSE_EMBEDDING is a valid Key", () => {
    // Just verify Key instances work as sourceKey
    const cfg = new SparseVectorIndexConfig({ sourceKey: K("metadata.title") });
    expect((cfg.sourceKey as Key).name).toBe("metadata.title");
  });

  test("accepts plain string sourceKey", () => {
    const cfg = new SparseVectorIndexConfig({ sourceKey: "metadata.title" });
    expect(cfg.sourceKey).toBe("metadata.title");
  });

  test("toMetadataJson serializes Key sourceKey to its name", () => {
    const cfg = new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT });
    expect(cfg.toMetadataJson().sourceKey).toBe("#document");
  });

  test("toMetadataJson serializes string sourceKey as-is", () => {
    const cfg = new SparseVectorIndexConfig({ sourceKey: "metadata.author" });
    expect(cfg.toMetadataJson().sourceKey).toBe("metadata.author");
  });

  test("toMetadataJson includes embeddingFunction when persistable", () => {
    const ef = new PersistableSparseEF();
    const cfg = new SparseVectorIndexConfig({
      sourceKey: K.DOCUMENT,
      embeddingFunction: ef,
    });
    const json = cfg.toMetadataJson();
    expect(json.embeddingFunction?.name).toBe("persistable-sparse-schema-test");
    expect(json.embeddingFunction?.properties).toEqual({ foo: "bar" });
  });

  test("toMetadataJson omits embeddingFunction when not persistable", () => {
    const ef = new NonPersistableSparseEF();
    const cfg = new SparseVectorIndexConfig({
      sourceKey: K.DOCUMENT,
      embeddingFunction: ef,
    });
    expect(cfg.toMetadataJson().embeddingFunction).toBeUndefined();
  });

  test("allows no embeddingFunction (undefined)", () => {
    const cfg = new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT });
    expect(cfg.embeddingFunction).toBeUndefined();
  });

  test("stores optional tuning params", () => {
    const cfg = new SparseVectorIndexConfig({
      sourceKey: K.DOCUMENT,
      prune: true,
      refine: false,
      drop_ratio_build: 0.1,
      drop_ratio_search: 0.2,
      refine_k: 5,
    });
    expect(cfg.prune).toBe(true);
    expect(cfg.refine).toBe(false);
    expect(cfg.drop_ratio_build).toBe(0.1);
    expect(cfg.drop_ratio_search).toBe(0.2);
    expect(cfg.refine_k).toBe(5);
  });

  test("toMetadataJson serializes all optional tuning params", () => {
    const cfg = new SparseVectorIndexConfig({
      sourceKey: K.DOCUMENT,
      prune: true,
      refine: false,
      drop_ratio_build: 0.1,
      drop_ratio_search: 0.2,
      refine_k: 5,
    });
    const json = cfg.toMetadataJson();
    expect(json.prune).toBe(true);
    expect(json.refine).toBe(false);
    expect(json.drop_ratio_build).toBe(0.1);
    expect(json.drop_ratio_search).toBe(0.2);
    expect(json.refine_k).toBe(5);
  });

  test("toMetadataJson omits undefined tuning params", () => {
    const cfg = new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT });
    const json = cfg.toMetadataJson();
    expect(json.prune).toBeUndefined();
    expect(json.refine).toBeUndefined();
    expect(json.drop_ratio_build).toBeUndefined();
    expect(json.drop_ratio_search).toBeUndefined();
    expect(json.refine_k).toBeUndefined();
  });

  test("throws for out-of-range drop_ratio_build", () => {
    expect(
      () =>
        new SparseVectorIndexConfig({
          sourceKey: K.DOCUMENT,
          drop_ratio_build: -0.1,
        })
    ).toThrow(SeekdbValueError);
    expect(
      () =>
        new SparseVectorIndexConfig({
          sourceKey: K.DOCUMENT,
          drop_ratio_build: 1.0,
        })
    ).toThrow(SeekdbValueError);
  });

  test("throws for out-of-range drop_ratio_search", () => {
    expect(
      () =>
        new SparseVectorIndexConfig({
          sourceKey: K.DOCUMENT,
          drop_ratio_search: -0.1,
        })
    ).toThrow(SeekdbValueError);
    expect(
      () =>
        new SparseVectorIndexConfig({
          sourceKey: K.DOCUMENT,
          drop_ratio_search: 1.0,
        })
    ).toThrow(SeekdbValueError);
  });

  test("throws for out-of-range refine_k", () => {
    expect(
      () => new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT, refine_k: 0 })
    ).toThrow(SeekdbValueError);
    expect(
      () =>
        new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT, refine_k: 1001 })
    ).toThrow(SeekdbValueError);
  });

  test("passes for boundary values of drop_ratio and refine_k", () => {
    expect(
      () =>
        new SparseVectorIndexConfig({
          sourceKey: K.DOCUMENT,
          drop_ratio_build: 0,
          drop_ratio_search: 0.9,
          refine_k: 1,
        })
    ).not.toThrow();
    expect(
      () =>
        new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT, refine_k: 1000 })
    ).not.toThrow();
  });
});

// ==================== Schema ====================

describe("Schema", () => {
  test("new Schema() starts with all indexes undefined", () => {
    const schema = new Schema();
    expect(schema.fulltextIndex).toBeUndefined();
    expect(schema.vectorIndex).toBeUndefined();
    expect(schema.sparseVectorIndex).toBeUndefined();
  });

  test("Schema.default() has fulltextIndex and vectorIndex only", () => {
    const schema = Schema.default();
    expect(schema.fulltextIndex).toBeInstanceOf(FullTextIndexConfig);
    expect(schema.vectorIndex).toBeInstanceOf(VectorIndexConfig);
    expect(schema.sparseVectorIndex).toBeUndefined();
  });

  test("constructor with config sets provided indexes", () => {
    const schema = new Schema({
      fulltextIndex: new FullTextIndexConfig("ngram"),
      sparseVectorIndex: new SparseVectorIndexConfig({ sourceKey: "title" }),
    });
    expect(schema.fulltextIndex?.analyzer).toBe("ngram");
    expect(schema.sparseVectorIndex?.sourceKey).toBe("title");
    expect(schema.vectorIndex).toBeUndefined();
  });

  test("createIndex returns this (chainable)", () => {
    const schema = new Schema();
    const ret = schema.createIndex(new FullTextIndexConfig());
    expect(ret).toBe(schema);
  });

  test("createIndex sets each index type to correct field", () => {
    const schema = new Schema()
      .createIndex(new FullTextIndexConfig("space"))
      .createIndex(new VectorIndexConfig({ hnsw: { dimension: 3 } }))
      .createIndex(new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT }));
    expect(schema.fulltextIndex?.analyzer).toBe("space");
    expect(schema.vectorIndex?.hnsw?.dimension).toBe(3);
    expect(schema.sparseVectorIndex?.sourceKey).toBe(K.DOCUMENT);
  });

  test("createIndex overwrites same index type", () => {
    const schema = new Schema()
      .createIndex(new FullTextIndexConfig("ngram"))
      .createIndex(new FullTextIndexConfig("ik"));
    expect(schema.fulltextIndex?.analyzer).toBe("ik");
  });

  test("createIndex with unknown type throws TypeError", () => {
    const schema = new Schema();
    expect(() => schema.createIndex({ type: "Unknown" } as any)).toThrow(
      TypeError
    );
  });

  test("toMetadataJson includes only defined indexes", () => {
    const schema = new Schema()
      .createIndex(new FullTextIndexConfig())
      .createIndex(new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT }));
    const json = schema.toMetadataJson();
    expect(json.fulltextIndex).toBeDefined();
    expect(json.sparseVectorIndex).toBeDefined();
    expect(json.vectorIndex).toBeUndefined();
  });

  test("toMetadataJson returns all three when all indexes are set", () => {
    const schema = new Schema()
      .createIndex(new FullTextIndexConfig())
      .createIndex(new VectorIndexConfig({ hnsw: { dimension: 3 } }))
      .createIndex(new SparseVectorIndexConfig({ sourceKey: "title" }));
    const json = schema.toMetadataJson();
    expect(json.fulltextIndex).toBeDefined();
    expect(json.vectorIndex).toBeDefined();
    expect(json.sparseVectorIndex).toBeDefined();
  });

  // ---- fromLegacy ----

  test("Schema.fromLegacy(null) returns default schema + embeddingFunction", () => {
    const schema = Schema.fromLegacy(null);
    expect(schema.fulltextIndex).toBeInstanceOf(FullTextIndexConfig);
    expect(schema.vectorIndex).toBeInstanceOf(VectorIndexConfig);
  });

  test("Schema.fromLegacy(undefined) behaves like null", () => {
    const schema = Schema.fromLegacy(undefined);
    expect(schema.fulltextIndex).toBeInstanceOf(FullTextIndexConfig);
    expect(schema.vectorIndex).toBeInstanceOf(VectorIndexConfig);
  });

  test("Schema.fromLegacy with HNSWConfiguration (dimension + distance)", () => {
    const schema = Schema.fromLegacy({ dimension: 128, distance: "cosine" });
    expect(schema.vectorIndex?.hnsw?.dimension).toBe(128);
    expect(schema.vectorIndex?.hnsw?.distance).toBe("cosine");
    expect(schema.fulltextIndex).toBeInstanceOf(FullTextIndexConfig);
  });

  test("Schema.fromLegacy with Configuration (hnsw + fulltextConfig)", () => {
    const schema = Schema.fromLegacy({
      hnsw: { dimension: 384 },
      fulltextConfig: { analyzer: "ngram" },
    });
    expect(schema.vectorIndex?.hnsw?.dimension).toBe(384);
    expect(schema.fulltextIndex?.analyzer).toBe("ngram");
  });

  test("Schema.fromLegacy passes embeddingFunction to vectorIndex", () => {
    const ef = new PersistableDenseEF();
    const schema = Schema.fromLegacy(null, ef);
    expect(schema.vectorIndex?.embeddingFunction).toBe(ef);
  });

  // ---- fromJSON ----

  test("Schema.fromJSON returns undefined for null/undefined/non-object input", async () => {
    expect(await Schema.fromJSON(null)).toBeUndefined();
    expect(await Schema.fromJSON(undefined)).toBeUndefined();
    expect(await Schema.fromJSON("bad-string")).toBeUndefined();
    expect(await Schema.fromJSON(42)).toBeUndefined();
  });

  test("Schema.fromJSON roundtrip: fulltextIndex analyzer is preserved", async () => {
    const original = new Schema().createIndex(new FullTextIndexConfig("space"));
    const restored = await Schema.fromJSON(original.toMetadataJson());
    expect(restored?.fulltextIndex?.analyzer).toBe("space");
  });

  test("Schema.fromJSON roundtrip: sparseVectorIndex sourceKey (string) is preserved", async () => {
    const original = new Schema().createIndex(
      new SparseVectorIndexConfig({ sourceKey: "metadata.title" })
    );
    const json = original.toMetadataJson();
    const restored = await Schema.fromJSON(json);
    expect(restored?.sparseVectorIndex?.sourceKey).toBe("metadata.title");
  });

  test("Schema.fromJSON roundtrip: sparseVectorIndex sourceKey (Key) serializes to name string", async () => {
    const original = new Schema().createIndex(
      new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT })
    );
    const json = original.toMetadataJson();
    // After roundtrip, sourceKey is a plain string (the name), not a Key instance
    const restored = await Schema.fromJSON(json);
    expect(restored?.sparseVectorIndex?.sourceKey).toBe("#document");
  });

  test("Schema.fromJSON restores vectorIndex hnsw params", async () => {
    const original = new Schema().createIndex(
      new VectorIndexConfig({
        hnsw: { dimension: 64, distance: "inner_product" },
      })
    );
    const restored = await Schema.fromJSON(original.toMetadataJson());
    expect(restored?.vectorIndex?.hnsw?.dimension).toBe(64);
    expect(restored?.vectorIndex?.hnsw?.distance).toBe("inner_product");
  });

  test("Schema.fromJSON restores persistable sparseEmbeddingFunction from registry", async () => {
    const ef = new PersistableSparseEF();
    const original = new Schema().createIndex(
      new SparseVectorIndexConfig({
        sourceKey: K.DOCUMENT,
        embeddingFunction: ef,
      })
    );
    const json = original.toMetadataJson();
    const restored = await Schema.fromJSON(json);
    expect(restored?.sparseVectorIndex?.embeddingFunction?.name).toBe(
      "persistable-sparse-schema-test"
    );
  });
});

// ==================== Persistence helpers ====================

describe("supportsPersistence / supportsSparsePersistence", () => {
  test("supportsPersistence returns true for persistable EF", () => {
    expect(supportsPersistence(new PersistableDenseEF())).toBe(true);
  });

  test("supportsPersistence returns false for null/undefined", () => {
    expect(supportsPersistence(null)).toBe(false);
    expect(supportsPersistence(undefined)).toBe(false);
  });

  test("supportsPersistence returns false when buildFromConfig is missing", () => {
    const ef: EmbeddingFunction = {
      name: "no-build",
      async generate() {
        return [];
      },
      getConfig() {
        return {};
      },
    };
    expect(supportsPersistence(ef)).toBe(false);
  });

  test("supportsSparsePersistence returns true for persistable sparse EF", () => {
    expect(supportsSparsePersistence(new PersistableSparseEF())).toBe(true);
  });

  test("supportsSparsePersistence returns false for non-persistable sparse EF", () => {
    expect(supportsSparsePersistence(new NonPersistableSparseEF())).toBe(false);
  });

  test("supportsSparsePersistence returns false for null/undefined", () => {
    expect(supportsSparsePersistence(null)).toBe(false);
    expect(supportsSparsePersistence(undefined)).toBe(false);
  });
});
