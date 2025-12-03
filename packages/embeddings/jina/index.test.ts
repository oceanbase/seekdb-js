import { describe, it, expect, beforeEach, vi } from "vitest";
import { JinaEmbeddingFunction } from "./index";

// Mock fetch globally
global.fetch = vi.fn();

describe("JinaEmbeddingFunction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultParametersTest = "should initialize with default parameters";
  if (!process.env.JINA_API_KEY) {
    it.skip(defaultParametersTest, () => {});
  } else {
    it(defaultParametersTest, () => {
      const embedder = new JinaEmbeddingFunction();
      expect(embedder.name).toBe("jina");

      const config = embedder.getConfig();
      expect(config.modelName).toBe("jina-clip-v2");
      expect(config.apiKeyEnvVar).toBe("JINA_API_KEY");
      expect(config.task).toBeUndefined();
      expect(config.lateChunking).toBeUndefined();
      expect(config.truncate).toBeUndefined();
      expect(config.dimensions).toBeUndefined();
      expect(config.normalized).toBeUndefined();
      expect(config.embeddingType).toBeUndefined();
    });
  }

  const customParametersTest = "should initialize with custom parameters";
  if (!process.env.JINA_API_KEY) {
    it.skip(customParametersTest, () => {});
  } else {
    it(customParametersTest, () => {
      const embedder = new JinaEmbeddingFunction({
        modelName: "custom-model",
        task: "custom-task",
        lateChunking: true,
        truncate: true,
        dimensions: 256,
        normalized: true,
        embeddingType: "custom-type",
      });

      const config = embedder.getConfig();
      expect(config.modelName).toBe("custom-model");
      expect(config.task).toBe("custom-task");
      expect(config.lateChunking).toBe(true);
      expect(config.truncate).toBe(true);
      expect(config.dimensions).toBe(256);
      expect(config.normalized).toBe(true);
      expect(config.embeddingType).toBe("custom-type");
    });
  }

  it("should initialize with custom error for a API key", () => {
    const originalEnv = process.env.JINA_API_KEY;
    delete process.env.JINA_API_KEY;

    try {
      expect(() => {
        new JinaEmbeddingFunction();
      }).toThrow("Jina AI API key is required");
    } finally {
      if (originalEnv) {
        process.env.JINA_API_KEY = originalEnv;
      }
    }
  });

  it("should use custom API key environment variable", () => {
    process.env.CUSTOM_JINA_API_KEY = "test-api-key";

    try {
      const embedder = new JinaEmbeddingFunction({
        apiKeyEnvVar: "CUSTOM_JINA_API_KEY",
      });

      expect(embedder.getConfig().apiKeyEnvVar).toBe("CUSTOM_JINA_API_KEY");
    } finally {
      delete process.env.CUSTOM_JINA_API_KEY;
    }
  });

  const generateEmbeddingsTest = "should generate embeddings";
  if (!process.env.JINA_API_KEY) {
    it.skip(generateEmbeddingsTest, () => {});
  } else {
    it(generateEmbeddingsTest, async () => {
      // Mock fetch response
      const mockEmbeddings = [
        Array(768)
          .fill(0)
          .map((_, i) => i / 1000),
        Array(768)
          .fill(0)
          .map((_, i) => (i + 100) / 1000),
      ];

      const mockResponse = {
        data: [
          { embedding: mockEmbeddings[0] },
          { embedding: mockEmbeddings[1] },
        ],
        usage: {
          total_tokens: 10,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const embedder = new JinaEmbeddingFunction();
      const texts = ["Hello world", "Test text"];
      const embeddings = await embedder.generate(texts);

      expect(embeddings.length).toBe(texts.length);

      embeddings.forEach((embedding) => {
        expect(embedding.length).toBeGreaterThan(0);
      });

      expect(embeddings[0]).not.toEqual(embeddings[1]);
    });
  }
});
