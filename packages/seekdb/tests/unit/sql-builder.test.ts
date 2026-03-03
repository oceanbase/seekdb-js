import { describe, expect, test } from "vitest";
import { SQLBuilder } from "../../src/sql-builder.js";
import {
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
});
