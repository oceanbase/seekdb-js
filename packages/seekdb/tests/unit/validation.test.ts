import { describe, test, expect } from "vitest";
import {
  assertRange,
  assertEnum,
  validateHnsw,
  validateSparseIndex,
  validateFulltextProperties,
} from "../../src/validation.js";
import { SeekdbValueError } from "../../src/errors.js";
import { HnswParams, FulltextAnalyzer } from "../../src/types.js";

describe("assertRange", () => {
  test("passes when value is within range", () => {
    expect(() => assertRange("x", 5, 1, 10)).not.toThrow();
    expect(() => assertRange("x", 1, 1, 10)).not.toThrow();
    expect(() => assertRange("x", 10, 1, 10)).not.toThrow();
  });

  test("throws when value is out of range", () => {
    expect(() => assertRange("x", 0, 1, 10)).toThrow(SeekdbValueError);
    expect(() => assertRange("x", 11, 1, 10)).toThrow(SeekdbValueError);
  });
});

describe("assertEnum", () => {
  test("passes when value is in allowed list", () => {
    expect(() => assertEnum("x", "a", ["a", "b"] as const)).not.toThrow();
  });

  test("throws when value is not in allowed list", () => {
    expect(() => assertEnum("x", "c", ["a", "b"] as const)).toThrow(
      SeekdbValueError
    );
  });
});

describe("validateHnsw", () => {
  test("passes for empty params", () => {
    expect(() => validateHnsw({})).not.toThrow();
  });

  test("passes for valid hnsw params", () => {
    expect(() =>
      validateHnsw({
        type: "hnsw",
        distance: "l2",
        m: 16,
        ef_construction: 200,
      })
    ).not.toThrow();
  });

  test("throws for invalid type", () => {
    expect(() =>
      validateHnsw({ type: "invalid" as HnswParams["type"] })
    ).toThrow(SeekdbValueError);
  });

  test("throws for out-of-range m", () => {
    expect(() => validateHnsw({ m: 4 })).toThrow(SeekdbValueError);
    expect(() => validateHnsw({ m: 129 })).toThrow(SeekdbValueError);
  });

  test("throws for out-of-range ef_construction", () => {
    expect(() => validateHnsw({ ef_construction: 4 })).toThrow(
      SeekdbValueError
    );
    expect(() => validateHnsw({ ef_construction: 1001 })).toThrow(
      SeekdbValueError
    );
  });

  describe("hnsw_bq type", () => {
    test("passes for valid hnsw_bq params", () => {
      expect(() =>
        validateHnsw({
          type: "hnsw_bq",
          refine_k: 10.0,
          refine_type: "sq8",
          bq_bits_query: 4,
        })
      ).not.toThrow();
    });

    test("passes for hnsw_bq without BQ fields", () => {
      expect(() => validateHnsw({ type: "hnsw_bq" })).not.toThrow();
    });

    test("throws for invalid refine_k range", () => {
      expect(() => validateHnsw({ type: "hnsw_bq", refine_k: 0 })).toThrow(
        SeekdbValueError
      );
      expect(() => validateHnsw({ type: "hnsw_bq", refine_k: 1001 })).toThrow(
        SeekdbValueError
      );
    });

    test("throws for invalid refine_type", () => {
      expect(() =>
        validateHnsw({
          type: "hnsw_bq",
          refine_type: "invalid" as HnswParams["refine_type"],
        })
      ).toThrow(SeekdbValueError);
    });

    test("throws for invalid bq_bits_query", () => {
      expect(() =>
        validateHnsw({
          type: "hnsw_bq",
          bq_bits_query: 8 as HnswParams["bq_bits_query"],
        })
      ).toThrow(SeekdbValueError);
    });
  });

  describe("BQ-only fields rejected for non-hnsw_bq types", () => {
    const bqFields = [
      { refine_k: 10 },
      { refine_type: "sq8" },
      { bq_bits_query: 4 },
      { bq_use_fht: true },
    ] as const;

    for (const field of bqFields) {
      const fieldName = Object.keys(field)[0];

      test(`throws when "${fieldName}" is set with type "hnsw"`, () => {
        expect(() => validateHnsw({ type: "hnsw", ...field })).toThrow(
          SeekdbValueError
        );
      });

      test(`throws when "${fieldName}" is set with type "hnsw_sq"`, () => {
        expect(() => validateHnsw({ type: "hnsw_sq", ...field })).toThrow(
          SeekdbValueError
        );
      });

      test(`does not throw when "${fieldName}" is set without explicit type`, () => {
        // type is undefined - no strict rejection
        expect(() => validateHnsw({ ...field })).not.toThrow();
      });
    }
  });
});

describe("validateSparseIndex", () => {
  const minimalSparse = { sourceKey: "document" as const };

  test("passes for minimal params (sourceKey only)", () => {
    expect(() => validateSparseIndex(minimalSparse)).not.toThrow();
  });

  test("passes for valid params", () => {
    expect(() =>
      validateSparseIndex({
        ...minimalSparse,
        drop_ratio_build: 0.5,
        drop_ratio_search: 0.3,
        refine_k: 10,
      })
    ).not.toThrow();
  });

  test("passes for valid distance/type/lib", () => {
    expect(() =>
      validateSparseIndex({
        ...minimalSparse,
        distance: "inner_product",
        type: "sindi",
        lib: "vsag",
      })
    ).not.toThrow();
  });

  test("passes for valid prune and refine", () => {
    expect(() =>
      validateSparseIndex({
        ...minimalSparse,
        prune: true,
        refine: false,
      })
    ).not.toThrow();
  });

  test("throws for invalid distance", () => {
    expect(() =>
      validateSparseIndex({
        ...minimalSparse,
        distance: "l2",
      } as any)
    ).toThrow(SeekdbValueError);
  });

  test("throws for invalid type", () => {
    expect(() =>
      validateSparseIndex({
        ...minimalSparse,
        type: "hnsw",
      } as any)
    ).toThrow(SeekdbValueError);
  });

  test("throws for invalid lib", () => {
    expect(() =>
      validateSparseIndex({
        ...minimalSparse,
        lib: "other",
      } as any)
    ).toThrow(SeekdbValueError);
  });

  test("throws for invalid prune (non-boolean)", () => {
    expect(() =>
      validateSparseIndex({
        ...minimalSparse,
        prune: "true",
      } as any)
    ).toThrow(SeekdbValueError);
  });

  test("throws for invalid refine (non-boolean)", () => {
    expect(() =>
      validateSparseIndex({
        ...minimalSparse,
        refine: 1,
      } as any)
    ).toThrow(SeekdbValueError);
  });

  test("throws for out-of-range drop_ratio_build", () => {
    expect(() =>
      validateSparseIndex({ ...minimalSparse, drop_ratio_build: -0.1 })
    ).toThrow(SeekdbValueError);
    expect(() =>
      validateSparseIndex({ ...minimalSparse, drop_ratio_build: 1.0 })
    ).toThrow(SeekdbValueError);
  });

  test("throws for out-of-range drop_ratio_search", () => {
    expect(() =>
      validateSparseIndex({ ...minimalSparse, drop_ratio_search: -0.1 })
    ).toThrow(SeekdbValueError);
    expect(() =>
      validateSparseIndex({ ...minimalSparse, drop_ratio_search: 1.0 })
    ).toThrow(SeekdbValueError);
  });

  test("throws for out-of-range refine_k", () => {
    expect(() =>
      validateSparseIndex({ ...minimalSparse, refine_k: 0 })
    ).toThrow(SeekdbValueError);
    expect(() =>
      validateSparseIndex({ ...minimalSparse, refine_k: 1001 })
    ).toThrow(SeekdbValueError);
  });
});

describe("validateFulltextProperties", () => {
  test("skips validation for unknown analyzer", () => {
    expect(() =>
      validateFulltextProperties("unknown", { any: "value" })
    ).not.toThrow();
  });

  test("validates space analyzer min/max_token_size", () => {
    expect(() =>
      validateFulltextProperties("space", {
        min_token_size: 1,
        max_token_size: 10,
      })
    ).not.toThrow();
    expect(() =>
      validateFulltextProperties("space", { min_token_size: 0 })
    ).toThrow(SeekdbValueError);
    expect(() =>
      validateFulltextProperties("space", { max_token_size: 9 })
    ).toThrow(SeekdbValueError);
  });

  test("validates ngram analyzer ngram_token_size", () => {
    expect(() =>
      validateFulltextProperties("ngram", { ngram_token_size: 5 })
    ).not.toThrow();
    expect(() =>
      validateFulltextProperties("ngram", { ngram_token_size: 0 })
    ).toThrow(SeekdbValueError);
    expect(() =>
      validateFulltextProperties("ngram", { ngram_token_size: 11 })
    ).toThrow(SeekdbValueError);
  });

  test("validates ngram2 analyzer min/max_ngram_size", () => {
    expect(() =>
      validateFulltextProperties("ngram2", {
        min_ngram_size: 1,
        max_ngram_size: 10,
      })
    ).not.toThrow();
    expect(() =>
      validateFulltextProperties("ngram2", { min_ngram_size: 0 })
    ).toThrow(SeekdbValueError);
    expect(() =>
      validateFulltextProperties("ngram2", { max_ngram_size: 17 })
    ).toThrow(SeekdbValueError);
  });

  test("validates ik analyzer ik_mode", () => {
    expect(() =>
      validateFulltextProperties("ik", { ik_mode: "smart" })
    ).not.toThrow();
    expect(() =>
      validateFulltextProperties("ik", { ik_mode: "invalid" })
    ).toThrow(SeekdbValueError);
  });
});
