import { describe, it, expect, vi } from "vitest";
import {
  SentenceTransformerEmbeddingFunction,
  SentenceTransformerConfig,
} from "./index";
import { SeekdbValueError } from "seekdb";

// Mock @huggingface/transformers
vi.mock("@huggingface/transformers", () => {
  const mockPipeline = vi.fn().mockResolvedValue({
    tolist: vi.fn().mockReturnValue([
      Array(384).fill(0).map((_, i) => i / 1000),
      Array(384).fill(0).map((_, i) => (i + 100) / 1000),
    ]),
  });

  return {
    pipeline: vi.fn().mockImplementation(() => {
      return Promise.resolve(mockPipeline);
    }),
  };
});

describe("SentenceTransformerEmbeddingFunction", () => {
  it("should have correct name (sentence-transformer)", () => {
    const embedder = new SentenceTransformerEmbeddingFunction();
    expect(embedder.name).toBe("sentence-transformer");
  });

  it("should initialize with default parameters", () => {
    const embedder = new SentenceTransformerEmbeddingFunction();
    const config = embedder.getConfig();

    expect(config.model_name).toBe("Xenova/all-MiniLM-L6-v2");
    expect(config.device).toBe("cpu");
    expect(config.normalize_embeddings).toBe(false);
    expect(config.kwargs).toEqual({});
  });

  it("should initialize with custom parameters", () => {
    const embedder = new SentenceTransformerEmbeddingFunction({
      modelName: "custom-model",
      device: "gpu",
      normalizeEmbeddings: true,
      kwargs: { max_length: 512 },
    });

    const config = embedder.getConfig();
    expect(config.model_name).toBe("custom-model");
    expect(config.device).toBe("gpu");
    expect(config.normalize_embeddings).toBe(true);
    expect(config.kwargs).toEqual({ max_length: 512 });
  });

  it("should throw SeekdbValueError for non-JSON-serializable kwargs", () => {
    expect(() => {
      new SentenceTransformerEmbeddingFunction({
        kwargs: { callback: () => { } },
      });
    }).toThrow(SeekdbValueError);

    expect(() => {
      new SentenceTransformerEmbeddingFunction({
        kwargs: { sym: Symbol("test") },
      });
    }).toThrow(SeekdbValueError);
  });

  it("should build from config with all required fields", () => {
    const config = {
      model_name: "test-model",
      device: "cpu",
      normalize_embeddings: true,
      kwargs: { test: "value" },
    };

    const embedder =
      SentenceTransformerEmbeddingFunction.buildFromConfig(config);
    expect(embedder).toBeInstanceOf(SentenceTransformerEmbeddingFunction);

    const resultConfig = embedder.getConfig();
    expect(resultConfig.model_name).toBe("test-model");
    expect(resultConfig.device).toBe("cpu");
    expect(resultConfig.normalize_embeddings).toBe(true);
    expect(resultConfig.kwargs).toEqual({ test: "value" });
  });

  it("should throw SeekdbValueError when all required fields are missing in buildFromConfig", () => {
    expect(() => {
      SentenceTransformerEmbeddingFunction.buildFromConfig(null);
    }).toThrow(SeekdbValueError);
  });

  it("should maintain round-trip consistency", () => {
    const originalConfig: SentenceTransformerConfig = {
      modelName: "round-trip-model",
      device: "cpu",
      normalizeEmbeddings: true,
      kwargs: { test: 123 },
    };

    const embedder1 = new SentenceTransformerEmbeddingFunction(originalConfig);
    const snakeConfig = embedder1.getConfig();
    const embedder2 =
      SentenceTransformerEmbeddingFunction.buildFromConfig(snakeConfig);
    const finalConfig = embedder2.getConfig();

    expect(finalConfig).toEqual(snakeConfig);
    expect(finalConfig.model_name).toBe("round-trip-model");
    expect(finalConfig.device).toBe("cpu");
    expect(finalConfig.normalize_embeddings).toBe(true);
    expect(finalConfig.kwargs).toEqual({ test: 123 });
  });
});
