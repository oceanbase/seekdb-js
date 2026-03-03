import { describe, expect, test } from "vitest";
import { SQLBuilder } from "../../src/sql-builder.js";
import {
  FullTextIndexConfig,
  Schema,
  SparseVectorIndexConfig,
  VectorIndexConfig,
} from "../../src/schema.js";

describe("SQLBuilder sparse index DDL", () => {
  test("should create sparse index on sparse_embedding column", () => {
    const schema = new Schema()
      .createIndex(
        new VectorIndexConfig({
          hnsw: {
            dimension: 3,
            distance: "l2",
          },
        })
      )
      .createIndex(
        new SparseVectorIndexConfig({
          sourceKey: "metadata.title",
        })
      );

    const sql = SQLBuilder.buildCreateTable("test_sparse_sql", schema);
    expect(sql).toContain("VECTOR INDEX idx_sparse (sparse_embedding)");
    expect(sql).not.toContain("idx_sparse (metadata.title)");
  });

  test("should not create sparse index when sparse index config is absent", () => {
    const schema = new Schema().createIndex(
      new VectorIndexConfig({
        hnsw: {
          dimension: 3,
          distance: "l2",
        },
      })
    );

    const sql = SQLBuilder.buildCreateTable("test_dense_sql", schema);
    expect(sql).not.toContain("idx_sparse");
  });

  test("sparse WITH clause has fixed distance=inner_product, type=sindi, lib=vsag", () => {
    const schema = new Schema().createIndex(
      new SparseVectorIndexConfig({ sourceKey: "metadata.title" })
    );
    const sql = SQLBuilder.buildCreateTable("test_sparse_with", schema);
    expect(sql).toContain("distance=inner_product");
    expect(sql).toContain("type=sindi");
    expect(sql).toContain("lib=vsag");
  });

  test("sparse WITH clause appends optional tuning params when provided", () => {
    const schema = new Schema().createIndex(
      new SparseVectorIndexConfig({
        sourceKey: "metadata.title",
        prune: true,
        refine: false,
        drop_ratio_build: 0.1,
        drop_ratio_search: 0.2,
        refine_k: 5,
      })
    );
    const sql = SQLBuilder.buildCreateTable("test_sparse_tuning", schema);
    expect(sql).toContain("prune=true");
    expect(sql).toContain("refine=false");
    expect(sql).toContain("drop_ratio_build=0.1");
    expect(sql).toContain("drop_ratio_search=0.2");
    expect(sql).toContain("refine_k=5");
  });

  test("DDL contains SPARSEVECTOR column when sparseVectorIndex is set", () => {
    const schema = new Schema().createIndex(
      new SparseVectorIndexConfig({ sourceKey: "metadata.title" })
    );
    const sql = SQLBuilder.buildCreateTable("test_sparse_col", schema);
    expect(sql).toContain("SPARSEVECTOR");
  });

  test("DDL does not contain SPARSEVECTOR column when sparseVectorIndex is absent", () => {
    const schema = new Schema().createIndex(
      new VectorIndexConfig({ hnsw: { dimension: 3 } })
    );
    const sql = SQLBuilder.buildCreateTable("test_no_sparse_col", schema);
    expect(sql).not.toContain("SPARSEVECTOR");
  });
});

describe("SQLBuilder.buildCreateTable", () => {
  test("uses default HNSW values when hnsw is undefined", () => {
    const schema = new Schema().createIndex(new VectorIndexConfig());
    const sql = SQLBuilder.buildCreateTable("t", schema);
    // DEFAULT_DISTANCE_METRIC is cosine
    expect(sql).toContain("distance=cosine");
    expect(sql).toContain("type=hnsw");
    expect(sql).toContain("lib=vsag");
  });

  test("includes all optional HNSW params when provided", () => {
    const schema = new Schema().createIndex(
      new VectorIndexConfig({
        hnsw: {
          dimension: 128,
          m: 32,
          ef_construction: 400,
          ef_search: 64,
          extra_info_max_size: 512,
        },
      })
    );
    const sql = SQLBuilder.buildCreateTable("t", schema);
    expect(sql).toContain("m=32");
    expect(sql).toContain("ef_construction=400");
    expect(sql).toContain("ef_search=64");
    expect(sql).toContain("extra_info_max_size=512");
  });

  test("includes BQ-only params in WITH clause for hnsw_bq", () => {
    const schema = new Schema().createIndex(
      new VectorIndexConfig({
        hnsw: {
          type: "hnsw_bq",
          refine_k: 10,
          refine_type: "fp32",
          bq_bits_query: 4,
          bq_use_fht: true,
        },
      })
    );
    const sql = SQLBuilder.buildCreateTable("t", schema);
    expect(sql).toContain("type=hnsw_bq");
    expect(sql).toContain("refine_k=10");
    expect(sql).toContain("refine_type=fp32");
    expect(sql).toContain("bq_bits_query=4");
    expect(sql).toContain("bq_use_fht=true");
  });

  test("does not include BQ params for type hnsw_sq", () => {
    const schema = new Schema().createIndex(
      new VectorIndexConfig({ hnsw: { type: "hnsw_sq" } })
    );
    const sql = SQLBuilder.buildCreateTable("t", schema);
    expect(sql).toContain("type=hnsw_sq");
    expect(sql).not.toContain("refine_k");
    expect(sql).not.toContain("refine_type");
    expect(sql).not.toContain("bq_bits_query");
  });

  test("appends COMMENT clause when comment is provided", () => {
    const schema = new Schema().createIndex(new VectorIndexConfig());
    const sql = SQLBuilder.buildCreateTable("t", schema, "my comment");
    expect(sql).toContain("COMMENT = 'my comment'");
  });

  test("escapes single quotes in comment", () => {
    const schema = new Schema().createIndex(new VectorIndexConfig());
    const sql = SQLBuilder.buildCreateTable("t", schema, "it's ok");
    expect(sql).toContain("COMMENT = 'it''s ok'");
  });

  test("includes fulltext index clause when fulltextIndex is set", () => {
    const schema = new Schema()
      .createIndex(new VectorIndexConfig())
      .createIndex(new FullTextIndexConfig("ik"));
    const sql = SQLBuilder.buildCreateTable("t", schema);
    expect(sql).toContain("FULLTEXT INDEX idx_fts");
    expect(sql).toContain("WITH PARSER ik");
  });

  test("omits fulltext clause when fulltextIndex is absent", () => {
    const schema = new Schema().createIndex(new VectorIndexConfig());
    const sql = SQLBuilder.buildCreateTable("t", schema);
    expect(sql).not.toContain("FULLTEXT INDEX");
  });
});

describe("SQLBuilder.buildFulltextClause", () => {
  test("returns default parser when config is undefined", () => {
    expect(SQLBuilder.buildFulltextClause(undefined)).toBe("WITH PARSER ik");
  });

  test("returns parser only when properties are empty", () => {
    expect(
      SQLBuilder.buildFulltextClause({ analyzer: "space", properties: {} })
    ).toBe("WITH PARSER space");
  });

  test("includes PARSER_PROPERTIES when properties are provided", () => {
    const clause = SQLBuilder.buildFulltextClause({
      analyzer: "ngram",
      properties: { ngram_token_size: 3 },
    });
    expect(clause).toBe(
      "WITH PARSER ngram PARSER_PROPERTIES=(ngram_token_size=3)"
    );
  });

  test("escapes single quotes in string property values", () => {
    const clause = SQLBuilder.buildFulltextClause({
      analyzer: "space",
      properties: { mode: "it's" } as any,
    });
    expect(clause).toContain("mode='it''s'");
  });
});

const CTX = { name: "col", collectionId: undefined } as const;

describe("SQLBuilder.buildSelect", () => {
  test("selects all fields when include is omitted", () => {
    const { sql } = SQLBuilder.buildSelect(CTX, {});
    expect(sql).toContain("_id");
    expect(sql).toContain("document");
    expect(sql).toContain("metadata");
    expect(sql).toContain("embedding");
  });

  test("selects only specified fields with include", () => {
    const { sql } = SQLBuilder.buildSelect(CTX, { include: ["documents"] });
    expect(sql).toContain("document");
    expect(sql).not.toContain("metadata");
    expect(sql).not.toContain("embedding");
  });

  test("adds WHERE clause for ids", () => {
    const { sql, params } = SQLBuilder.buildSelect(CTX, { ids: ["a", "b"] });
    expect(sql).toContain("WHERE");
    expect(sql).toContain("CAST(? AS BINARY)");
    expect(params).toContain("a");
    expect(params).toContain("b");
  });

  test("skips WHERE clause for empty ids array", () => {
    const { sql } = SQLBuilder.buildSelect(CTX, { ids: [] });
    expect(sql).not.toContain("WHERE");
  });

  test("adds LIMIT and OFFSET", () => {
    const { sql, params } = SQLBuilder.buildSelect(CTX, {
      limit: 10,
      offset: 5,
    });
    expect(sql).toContain("LIMIT ?");
    expect(sql).toContain("OFFSET ?");
    expect(params).toContain(10);
    expect(params).toContain(5);
  });
});

describe("SQLBuilder.buildInsert", () => {
  test("builds INSERT without sparse embeddings", () => {
    const { sql, params } = SQLBuilder.buildInsert(CTX, {
      ids: ["id1"],
      embeddings: [[1, 2, 3]],
      documents: ["doc"],
      metadatas: [{ k: "v" }],
    });
    expect(sql).toContain("INSERT INTO");
    expect(sql).toContain("(CAST(? AS BINARY), ?, ?, ?)");
    expect(params).toContain("id1");
    expect(params).toContain("doc");
  });

  test("builds INSERT with sparse embeddings column", () => {
    const { sql, params } = SQLBuilder.buildInsert(CTX, {
      ids: ["id1"],
      embeddings: [[1, 2, 3]],
      sparseEmbeddings: [{ 0: 0.5, 1: 0.3 }],
    });
    expect(sql).toContain("sparse_embedding");
    expect(sql).toContain("(CAST(? AS BINARY), ?, ?, ?, ?)");
    expect(params.length).toBe(5);
  });

  test("serializes null sparse embedding as null", () => {
    const { params } = SQLBuilder.buildInsert(CTX, {
      ids: ["id1"],
      embeddings: [[1, 2, 3]],
      sparseEmbeddings: [null],
    });
    expect(params[params.length - 1]).toBeNull();
  });
});

describe("SQLBuilder.buildUpdate", () => {
  test("builds UPDATE with document only", () => {
    const { sql, params } = SQLBuilder.buildUpdate(CTX, {
      id: "id1",
      updates: { document: "new doc" },
    });
    expect(sql).toContain("UPDATE");
    expect(sql).toContain("document = ?");
    expect(params).toContain("new doc");
  });

  test("builds UPDATE with all fields", () => {
    const { sql, params } = SQLBuilder.buildUpdate(CTX, {
      id: "id1",
      updates: { document: "d", embedding: [1, 2], metadata: { x: 1 } },
    });
    expect(sql).toContain("document = ?");
    expect(sql).toContain("metadata = ?");
    expect(sql).toContain("embedding = ?");
    expect(params[params.length - 1]).toBe("id1");
  });

  test("builds UPDATE with null sparse embedding", () => {
    const { sql, params } = SQLBuilder.buildUpdate(CTX, {
      id: "id1",
      updates: { sparseEmbedding: null },
    });
    expect(sql).toContain("sparse_embedding = ?");
    expect(params[0]).toBeNull();
  });
});

describe("SQLBuilder.buildDelete", () => {
  test("builds DELETE with ids", () => {
    const { sql, params } = SQLBuilder.buildDelete(CTX, { ids: ["a", "b"] });
    expect(sql).toContain("DELETE FROM");
    expect(sql).toContain("WHERE");
    expect(params).toContain("a");
  });

  test("builds DELETE without filters", () => {
    const { sql, params } = SQLBuilder.buildDelete(CTX, {});
    expect(sql).toContain("DELETE FROM");
    expect(sql).not.toContain("WHERE");
    expect(params).toHaveLength(0);
  });
});

describe("SQLBuilder.buildVectorQuery", () => {
  test("uses l2_distance for l2 metric on dense column", () => {
    const { sql } = SQLBuilder.buildVectorQuery(CTX, [1, 2, 3], 5, {
      distance: "l2",
    });
    expect(sql).toContain("l2_distance");
    expect(sql).not.toContain("DESC");
  });

  test("uses inner_product DESC for inner_product metric", () => {
    const { sql } = SQLBuilder.buildVectorQuery(CTX, [1, 2, 3], 5, {
      distance: "inner_product",
    });
    expect(sql).toContain("inner_product");
    expect(sql).toContain("DESC");
  });

  test("uses cosine_distance for cosine metric", () => {
    const { sql } = SQLBuilder.buildVectorQuery(CTX, [1, 2, 3], 5, {
      distance: "cosine",
    });
    expect(sql).toContain("cosine_distance");
  });

  test("uses inner_product DESC for sparse column regardless of distance", () => {
    const { sql } = SQLBuilder.buildVectorQuery(CTX, { 0: 0.5 }, 5, {
      column: "sparse_embedding",
      distance: "l2",
    });
    expect(sql).toContain("inner_product");
    expect(sql).toContain("DESC");
    expect(sql).not.toContain("l2_distance");
  });

  test("omits APPROXIMATE when approximate=false", () => {
    const { sql } = SQLBuilder.buildVectorQuery(CTX, [1, 2, 3], 5, {
      approximate: false,
    });
    expect(sql).not.toContain("APPROXIMATE");
  });

  test("includes APPROXIMATE by default", () => {
    const { sql } = SQLBuilder.buildVectorQuery(CTX, [1, 2, 3], 5, {});
    expect(sql).toContain("APPROXIMATE");
  });

  test("uses cosine_distance when no distance is specified (default is cosine)", () => {
    const { sql } = SQLBuilder.buildVectorQuery(CTX, [1, 2, 3], 5, {});
    expect(sql).toContain("cosine_distance");
    expect(sql).not.toContain("l2_distance");
  });

  test("nResults is appended as param", () => {
    const { params } = SQLBuilder.buildVectorQuery(CTX, [1, 2, 3], 42, {});
    expect(params[params.length - 1]).toBe(42);
  });
});

describe("SQLBuilder simple builders", () => {
  test("buildShowTable returns SHOW TABLES LIKE", () => {
    expect(SQLBuilder.buildShowTable("col")).toContain("SHOW TABLES LIKE");
  });

  test("buildDescribeTable returns DESCRIBE", () => {
    expect(SQLBuilder.buildDescribeTable("col")).toContain("DESCRIBE");
  });

  test("buildShowIndex returns SHOW INDEX FROM", () => {
    expect(SQLBuilder.buildShowIndex("col")).toContain("SHOW INDEX FROM");
  });

  test("buildShowCreateTable returns SHOW CREATE TABLE", () => {
    expect(SQLBuilder.buildShowCreateTable("col")).toContain(
      "SHOW CREATE TABLE"
    );
  });

  test("buildDropTable returns DROP TABLE IF EXISTS", () => {
    expect(SQLBuilder.buildDropTable("col")).toContain("DROP TABLE IF EXISTS");
  });

  test("buildCount returns SELECT COUNT(*)", () => {
    expect(SQLBuilder.buildCount(CTX)).toContain("SELECT COUNT(*)");
  });

  test("buildSetVariable returns SET @name = ?", () => {
    const { sql, params } = SQLBuilder.buildSetVariable("foo", "bar");
    expect(sql).toBe("SET @foo = ?");
    expect(params).toEqual(["bar"]);
  });

  test("buildFork returns FORK TABLE statement", () => {
    const sql = SQLBuilder.buildFork("src", "dst");
    expect(sql).toContain("FORK TABLE");
    expect(sql).toContain("src");
    expect(sql).toContain("dst");
  });
});
