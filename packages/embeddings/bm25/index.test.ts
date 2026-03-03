import { describe, expect, it } from "vitest";
import { SeekdbValueError } from "seekdb";
import { Bm25EmbeddingFunction } from "./index";

describe("Bm25EmbeddingFunction", () => {
  it("should have correct name", () => {
    const ef = new Bm25EmbeddingFunction();
    expect(ef.name).toBe("bm25");
  });

  it("should return default config in snake_case", () => {
    const ef = new Bm25EmbeddingFunction();
    const cfg = ef.getConfig();
    expect(cfg.k).toBe(1.2);
    expect(cfg.b).toBe(0.75);
    expect(cfg.avg_doc_length).toBe(256);
    expect(cfg.token_max_length).toBe(40);
  });

  it("should generate sparse vectors", async () => {
    const ef = new Bm25EmbeddingFunction();
    const vectors = await ef.generate(["machine learning machine"]);
    expect(vectors).toHaveLength(1);
    const vector = vectors[0];
    expect(Object.keys(vector).length).toBeGreaterThan(0);
    for (const value of Object.values(vector)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it("should filter stopwords and return empty sparse vector when all filtered", async () => {
    const ef = new Bm25EmbeddingFunction();
    const vectors = await ef.generate(["the and is to"]);
    expect(vectors).toEqual([{}]);
  });

  it("should filter over-length tokens", async () => {
    const ef = new Bm25EmbeddingFunction({ tokenMaxLength: 5 });
    const vectors = await ef.generate([
      "supercalifragilisticexpialidocious short",
    ]);
    expect(vectors).toHaveLength(1);
    const keys = Object.keys(vectors[0]);
    expect(keys.length).toBe(1);
  });

  it("should keep config round-trip consistency", () => {
    const ef1 = new Bm25EmbeddingFunction({
      k: 1.4,
      b: 0.4,
      avgDocLength: 300,
      tokenMaxLength: 32,
      stopwords: ["foo", "bar"],
    });
    const cfg = ef1.getConfig();
    const ef2 = Bm25EmbeddingFunction.buildFromConfig(cfg);
    expect(ef2.getConfig()).toEqual(cfg);
  });

  it("should support generateForQueries", async () => {
    const ef = new Bm25EmbeddingFunction();
    const qv = await ef.generateForQueries(["vector database"]);
    const dv = await ef.generate(["vector database"]);
    expect(qv).toEqual(dv);
  });

  it("should reject invalid constructor config", () => {
    expect(() => new Bm25EmbeddingFunction({ k: 0 })).toThrow(SeekdbValueError);
    expect(() => new Bm25EmbeddingFunction({ b: 1.1 })).toThrow(
      SeekdbValueError
    );
    expect(() => new Bm25EmbeddingFunction({ avgDocLength: 0 })).toThrow(
      SeekdbValueError
    );
    expect(() => new Bm25EmbeddingFunction({ tokenMaxLength: 0 })).toThrow(
      SeekdbValueError
    );
  });

  it("should reject unsupported config update keys", () => {
    const ef = new Bm25EmbeddingFunction();
    expect(() =>
      ef.validateConfigUpdate?.({ token_max_length: 64, unknown: true })
    ).toThrow(SeekdbValueError);
  });
});
