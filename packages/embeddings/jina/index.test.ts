import { describe, it, expect, beforeEach, vi } from "vitest";
import { JinaEmbeddingFunction } from "./index";

// Mock fetch globally
global.fetch = vi.fn();

describe("JinaEmbeddingFunction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default parameters", () => {
    process.env.JINA_API_KEY = "test-api-key";

    const embedder = new JinaEmbeddingFunction();
    expect(embedder.name).toBe("jina");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("jina-clip-v2");
    expect(config.api_key_env_var).toBe("JINA_API_KEY");
    expect(config.task).toBeUndefined();
    expect(config.late_chunking).toBeUndefined();
    expect(config.truncate).toBeUndefined();
    expect(config.dimensions).toBeUndefined();
    expect(config.normalized).toBeUndefined();
    expect(config.embedding_type).toBeUndefined();
  });

  it("should initialize with custom parameters", () => {
    process.env.JINA_API_KEY = "test-api-key";

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
    expect(config.model_name).toBe("custom-model");
    expect(config.task).toBe("custom-task");
    expect(config.late_chunking).toBe(true);
    expect(config.truncate).toBe(true);
    expect(config.dimensions).toBe(256);
    expect(config.normalized).toBe(true);
    expect(config.embedding_type).toBe("custom-type");
  });

  it("should initialize with all optional parameters", () => {
    process.env.JINA_API_KEY = "test-api-key";

    const embedder = new JinaEmbeddingFunction({
      modelName: "test-model",
      apiKeyEnvVar: "JINA_API_KEY",
      task: "retrieval.passage",
      lateChunking: false,
      truncate: false,
      dimensions: 512,
      normalized: false,
      embeddingType: "float",
    });

    const config = embedder.getConfig();
    expect(config.model_name).toBe("test-model");
    expect(config.api_key_env_var).toBe("JINA_API_KEY");
    expect(config.task).toBe("retrieval.passage");
    expect(config.late_chunking).toBe(false);
    expect(config.truncate).toBe(false);
    expect(config.dimensions).toBe(512);
    expect(config.normalized).toBe(false);
    expect(config.embedding_type).toBe("float");
  });

  it("should throw error when API key is missing", () => {
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

  it("should use custom API key from constructor", () => {
    const embedder = new JinaEmbeddingFunction({
      apiKey: "custom-api-key",
    });

    expect(embedder.name).toBe("jina");
  });

  it("should use custom API key environment variable", () => {
    process.env.CUSTOM_JINA_API_KEY = "test-api-key";

    try {
      const embedder = new JinaEmbeddingFunction({
        apiKeyEnvVar: "CUSTOM_JINA_API_KEY",
      });

      expect(embedder.getConfig().api_key_env_var).toBe("CUSTOM_JINA_API_KEY");
    } finally {
      delete process.env.CUSTOM_JINA_API_KEY;
    }
  });

  it("should generate embeddings with correct dimensions", async () => {
    process.env.JINA_API_KEY = "test-api-key";

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
      expect(embedding.length).toBe(768);
    });
    expect(embeddings[0]).not.toEqual(embeddings[1]);
  });

  it("should handle API errors gracefully", async () => {
    process.env.JINA_API_KEY = "test-api-key";

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => ({ error: "API Error" }),
      ok: false,
    });

    const embedder = new JinaEmbeddingFunction();

    await expect(embedder.generate(["test"])).rejects.toThrow(
      "Failed to generate jina embedding data"
    );
  });

  it("should return correct config", () => {
    process.env.JINA_API_KEY = "test-api-key";

    const embedder = new JinaEmbeddingFunction({
      modelName: "test-model",
      task: "retrieval.query",
      dimensions: 256,
    });

    const config = embedder.getConfig();
    expect(config).toEqual({
      api_key_env_var: "JINA_API_KEY",
      model_name: "test-model",
      task: "retrieval.query",
      late_chunking: undefined,
      truncate: undefined,
      dimensions: 256,
      embedding_type: undefined,
      normalized: undefined,
    });
  });

  it("should return config in snake_case format", () => {
    process.env.JINA_API_KEY = "test-api-key";

    const embedder = new JinaEmbeddingFunction({
      modelName: "test-model",
      apiKeyEnvVar: "JINA_API_KEY",
      lateChunking: true,
      embeddingType: "float",
    });

    const config = embedder.getConfig();

    // Verify snake_case keys exist
    expect(config).toHaveProperty("model_name");
    expect(config).toHaveProperty("api_key_env_var");
    expect(config).toHaveProperty("late_chunking");
    expect(config).toHaveProperty("embedding_type");

    // Verify values are correct
    expect(config.model_name).toBe("test-model");
    expect(config.api_key_env_var).toBe("JINA_API_KEY");
    expect(config.late_chunking).toBe(true);
    expect(config.embedding_type).toBe("float");
  });

  it("should build instance from snake_case config", () => {
    process.env.JINA_API_KEY = "test-api-key";

    const snakeCaseConfig = {
      model_name: "custom-model",
      api_key_env_var: "JINA_API_KEY",
      task: "retrieval.passage",
      late_chunking: true,
      truncate: false,
      dimensions: 512,
      normalized: true,
      embedding_type: "float",
    };

    const embedder = JinaEmbeddingFunction.buildFromConfig(snakeCaseConfig);

    expect(embedder).toBeInstanceOf(JinaEmbeddingFunction);
    expect(embedder.name).toBe("jina");

    // Verify config is correctly converted
    const config = embedder.getConfig();
    expect(config.model_name).toBe("custom-model");
    expect(config.api_key_env_var).toBe("JINA_API_KEY");
    expect(config.task).toBe("retrieval.passage");
    expect(config.late_chunking).toBe(true);
    expect(config.truncate).toBe(false);
    expect(config.dimensions).toBe(512);
    expect(config.normalized).toBe(true);
    expect(config.embedding_type).toBe("float");
  });

  it("should maintain consistency in round-trip conversion", () => {
    process.env.JINA_API_KEY = "test-api-key";

    const originalConfig = {
      modelName: "round-trip-model",
      apiKeyEnvVar: "JINA_API_KEY",
      task: "text-matching",
      lateChunking: true,
      truncate: true,
      dimensions: 1024,
      normalized: false,
      embeddingType: "base64",
    };

    const embedder1 = new JinaEmbeddingFunction(originalConfig);
    const snakeConfig = embedder1.getConfig();
    const embedder2 = JinaEmbeddingFunction.buildFromConfig(snakeConfig);
    const finalConfig = embedder2.getConfig();

    // Verify configs match after round-trip
    expect(finalConfig).toEqual(snakeConfig);
    expect(finalConfig.model_name).toBe("round-trip-model");
    expect(finalConfig.api_key_env_var).toBe("JINA_API_KEY");
    expect(finalConfig.task).toBe("text-matching");
    expect(finalConfig.late_chunking).toBe(true);
    expect(finalConfig.truncate).toBe(true);
    expect(finalConfig.dimensions).toBe(1024);
    expect(finalConfig.normalized).toBe(false);
    expect(finalConfig.embedding_type).toBe("base64");
  });

  it("should build instance with default values from empty config", () => {
    process.env.JINA_API_KEY = "test-api-key";

    const embedder = JinaEmbeddingFunction.buildFromConfig({});

    expect(embedder).toBeInstanceOf(JinaEmbeddingFunction);
    expect(embedder.name).toBe("jina");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("jina-clip-v2");
    expect(config.api_key_env_var).toBe("JINA_API_KEY");
  });

  it("should call fetch with correct parameters", async () => {
    process.env.JINA_API_KEY = "test-api-key";

    const mockResponse = {
      data: [{ embedding: Array(768).fill(0.1) }],
      usage: { total_tokens: 5 },
    };

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockResponse,
      ok: true,
    });

    const embedder = new JinaEmbeddingFunction({
      modelName: "test-model",
      task: "retrieval.query",
      dimensions: 512,
    });

    await embedder.generate(["test text"]);

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.jina.ai/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        }),
      })
    );
  });
});
