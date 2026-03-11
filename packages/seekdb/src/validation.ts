import { SeekdbValueError } from "./errors.js";
import type {
  DistanceMetric,
  FulltextAnalyzer,
  HnswParams,
  IkProperties,
  SparseVectorIndexConfigOptions,
} from "./types.js";

const FULLTEXT_ANALYZERS: readonly FulltextAnalyzer[] = [
  "space",
  "ngram",
  "ngram2",
  "beng",
  "ik",
];
const IK_MODE_VALUES: readonly IkProperties["ik_mode"][] = [
  "smart",
  "max_word",
];
const DISTANCE_METRICS: readonly DistanceMetric[] = [
  "l2",
  "cosine",
  "inner_product",
];
const HNSW_INDEX_TYPES: readonly HnswParams["type"][] = [
  "hnsw",
  "hnsw_sq",
  "hnsw_bq",
];
const LIBS: readonly HnswParams["lib"][] = ["vsag"];
const REFINE_TYPES: readonly HnswParams["refine_type"][] = ["sq8", "fp32"];
const BQ_BITS_QUERY_VALUES: readonly HnswParams["bq_bits_query"][] = [0, 4, 32];

export function assertRange(
  field: string,
  value: number,
  min: number,
  max: number
): void {
  if (value < min || value > max) {
    throw new SeekdbValueError(
      `Invalid "${field}": expected [${min}, ${max}], got ${value}`
    );
  }
}

export function assertEnum<T>(
  field: string,
  value: T,
  allowed: readonly T[]
): void {
  if (!allowed.includes(value)) {
    throw new SeekdbValueError(
      `Invalid "${field}": expected one of [${(allowed as readonly unknown[]).join(", ")}], got ${value}`
    );
  }
}

// dimension: [0, 4096]
// distance: "l2" | "cosine" | "inner_product"
// type: "hnsw" | "hnsw_sq" | "hnsw_bq"
// lib: "vsag"
// m: [5, 128]
// ef_construction: [5, 1000]
// ef_search: [1, 1000]
// extra_info_max_size: [0, 16384]
// refine_k: [1, 1000]
// refine_type: "sq8" | "fp32"
// bq_bits_query: 0 | 4 | 32
// bq_use_fht: true | false
export function validateHnsw(params: HnswParams): void {
  if (params.dimension !== undefined)
    assertRange("dimension", params.dimension, 0, 4096);
  if (params.distance !== undefined)
    assertEnum<DistanceMetric>("distance", params.distance, DISTANCE_METRICS);
  if (params.type !== undefined)
    assertEnum<HnswParams["type"]>("type", params.type, HNSW_INDEX_TYPES);
  if (params.lib !== undefined)
    assertEnum<HnswParams["lib"]>("lib", params.lib, LIBS);
  if (params.m !== undefined) assertRange("m", params.m, 5, 128);
  if (params.ef_construction !== undefined)
    assertRange("ef_construction", params.ef_construction, 5, 1000);
  if (params.ef_search !== undefined)
    assertRange("ef_search", params.ef_search, 1, 1000);
  if (params.extra_info_max_size !== undefined)
    assertRange("extra_info_max_size", params.extra_info_max_size, 0, 16384);

  if (params.type === "hnsw_bq") {
    // BQ-only fields: validate values
    if (params.refine_k !== undefined)
      assertRange("refine_k", params.refine_k, 1.0, 1000.0);
    if (params.refine_type !== undefined)
      assertEnum<HnswParams["refine_type"]>(
        "refine_type",
        params.refine_type,
        REFINE_TYPES
      );
    if (params.bq_bits_query !== undefined)
      assertEnum<HnswParams["bq_bits_query"]>(
        "bq_bits_query",
        params.bq_bits_query,
        BQ_BITS_QUERY_VALUES
      );
  } else if (params.type !== undefined) {
    // BQ-only fields are not allowed for other types
    for (const field of [
      "refine_k",
      "refine_type",
      "bq_bits_query",
      "bq_use_fht",
    ] as const) {
      if (params[field] !== undefined)
        throw new SeekdbValueError(
          `"${field}" is only supported when type is "hnsw_bq"`
        );
    }
  }
}

// distance: "inner_product"
// type: "sindi"
// lib: "vsag"
// drop_ratio_build: [0, 0.9]
// drop_ratio_search: [0, 0.9]
// refine_k: [1, 1000]
// prune: boolean
// refine: boolean
export function validateSparseIndex(
  params: SparseVectorIndexConfigOptions
): void {
  if (params.distance !== undefined)
    assertEnum("distance", params.distance, ["inner_product"]);
  if (params.type !== undefined) assertEnum("type", params.type, ["sindi"]);
  if (params.lib !== undefined) assertEnum("lib", params.lib, ["vsag"]);
  if (params.prune !== undefined)
    assertEnum<boolean>("prune", params.prune, [true, false]);
  if (params.refine !== undefined)
    assertEnum<boolean>("refine", params.refine, [true, false]);
  if (params.drop_ratio_build !== undefined)
    assertRange("drop_ratio_build", params.drop_ratio_build, 0, 0.9);
  if (params.drop_ratio_search !== undefined)
    assertRange("drop_ratio_search", params.drop_ratio_search, 0, 0.9);
  if (params.refine_k !== undefined)
    assertRange("refine_k", params.refine_k, 1.0, 1000.0);
}

// analyzer: "space" | "ngram" | "ngram2" | "beng" | "ik"
// min_token_size: [1, 16]
// max_token_size: [10, 84]
// ngram_token_size: [1, 10]
// min_ngram_size: [1, 16]
// max_ngram_size: [1, 16]
// ik_mode: "smart" | "max_word"
export function validateFulltextProperties(
  analyzer: string,
  properties: Record<string, unknown>
): void {
  if (!FULLTEXT_ANALYZERS.includes(analyzer as FulltextAnalyzer)) {
    console.warn(
      `[seekdb] Unknown analyzer "${analyzer}", skipping property validation`
    );
    return;
  }
  switch (analyzer as FulltextAnalyzer) {
    case "space":
    case "beng":
      if (properties.min_token_size !== undefined)
        assertRange(
          "min_token_size",
          properties.min_token_size as number,
          1,
          16
        );
      if (properties.max_token_size !== undefined)
        assertRange(
          "max_token_size",
          properties.max_token_size as number,
          10,
          84
        );
      break;
    case "ngram":
      if (properties.ngram_token_size !== undefined)
        assertRange(
          "ngram_token_size",
          properties.ngram_token_size as number,
          1,
          10
        );
      break;
    case "ngram2":
      if (properties.min_ngram_size !== undefined)
        assertRange(
          "min_ngram_size",
          properties.min_ngram_size as number,
          1,
          16
        );
      if (properties.max_ngram_size !== undefined)
        assertRange(
          "max_ngram_size",
          properties.max_ngram_size as number,
          1,
          16
        );
      break;
    case "ik":
      if (properties.ik_mode !== undefined)
        assertEnum("ik_mode", properties.ik_mode as string, IK_MODE_VALUES);
      break;
  }
}
