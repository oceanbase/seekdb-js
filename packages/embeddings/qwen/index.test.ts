import { describe, it, expect, beforeEach, vi } from "vitest";
import { QwenEmbeddingFunction, QwenEmbeddingConfig } from "./index";

// Mock OpenAI client
vi.mock("openai", () => {
  const mockCreate = vi.fn().mockResolvedValue({
    data: [
      {
        embedding: Array(1024)
          .fill(0)
          .map((_, i) => i / 1000),
      },
      {
        embedding: Array(1024)
          .fill(0)
          .map((_, i) => (i + 100) / 1000),
      },
    ],
  });

  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: {
        create: mockCreate,
      },
    })),
  };
});

describe("QwenEmbeddingFunction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default parameters", () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const embedder = new QwenEmbeddingFunction();
    expect(embedder.name).toBe("qwen");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("text-embedding-v4");
    expect(config.api_key_env_var).toBe("DASHSCOPE_API_KEY");
    expect(config.dimensions).toBe(1024);
  });

  it("should initialize with custom parameters", () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const embedder = new QwenEmbeddingFunction({
      modelName: "text-embedding-v3",
      dimensions: 768,
      apiKeyEnvVar: "DASHSCOPE_API_KEY",
      region: "intl",
    });

    const config = embedder.getConfig();
    expect(config.model_name).toBe("text-embedding-v3");
    expect(config.dimensions).toBe(768);
    expect(config.api_key_env_var).toBe("DASHSCOPE_API_KEY");
  });

  it("should initialize with all optional parameters", () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const embedder = new QwenEmbeddingFunction({
      modelName: "custom-model",
      apiKey: "custom-key",
      apiKeyEnvVar: "CUSTOM_DASHSCOPE_KEY",
      dimensions: 2048,
      region: "cn",
    });

    const config = embedder.getConfig();
    expect(config.model_name).toBe("custom-model");
    expect(config.api_key).toBeUndefined();
    expect(config.api_key_env_var).toBe("CUSTOM_DASHSCOPE_KEY");
    expect(config.dimensions).toBe(2048);
  });

  it("should throw error when API key is missing", () => {
    const originalEnv = process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;

    try {
      expect(() => {
        new QwenEmbeddingFunction();
      }).toThrow("OpenAI API Key is required");
    } finally {
      if (originalEnv) {
        process.env.DASHSCOPE_API_KEY = originalEnv;
      }
    }
  });

  it("should use custom API key from constructor", () => {
    const embedder = new QwenEmbeddingFunction({
      apiKey: "custom-api-key",
    });

    expect(embedder.name).toBe("qwen");
    expect(embedder.getConfig().api_key).toBeUndefined();
  });

  it("should use custom API key environment variable", () => {
    process.env.CUSTOM_DASHSCOPE_API_KEY = "test-api-key";

    try {
      const embedder = new QwenEmbeddingFunction({
        apiKeyEnvVar: "CUSTOM_DASHSCOPE_API_KEY",
      });

      expect(embedder.getConfig().api_key_env_var).toBe(
        "CUSTOM_DASHSCOPE_API_KEY"
      );
    } finally {
      delete process.env.CUSTOM_DASHSCOPE_API_KEY;
    }
  });

  it("should use CN region by default", () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const embedder = new QwenEmbeddingFunction();
    expect(embedder.name).toBe("qwen");
  });

  it("should support international region", () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const embedder = new QwenEmbeddingFunction({
      region: "intl",
    });

    expect(embedder.name).toBe("qwen");
  });

  it("should generate embeddings with correct dimensions", async () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const embedder = new QwenEmbeddingFunction();
    const texts = ["Hello world", "Test text"];
    const embeddings = await embedder.generate(texts);

    expect(embeddings.length).toBe(texts.length);
    embeddings.forEach((embedding) => {
      expect(embedding.length).toBe(1024);
    });
    expect(embeddings[0]).not.toEqual(embeddings[1]);
  });

  it("should return correct config", () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const embedder = new QwenEmbeddingFunction({
      modelName: "test-model",
      dimensions: 768,
    });

    const config = embedder.getConfig();
    expect(config.model_name).toBe("test-model");
    expect(config.dimensions).toBe(768);
    expect(config.api_key_env_var).toBe("DASHSCOPE_API_KEY");
    // Should not have organization_id
    expect(config).not.toHaveProperty("organization_id");
  });

  it("should return config in snake_case format", () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const embedder = new QwenEmbeddingFunction({
      modelName: "test-model",
      apiKeyEnvVar: "DASHSCOPE_API_KEY",
      dimensions: 512,
    });

    const config = embedder.getConfig();

    // Verify snake_case keys exist
    expect(config).toHaveProperty("model_name");
    expect(config).toHaveProperty("api_key");
    expect(config).toHaveProperty("api_key_env_var");
    expect(config).toHaveProperty("dimensions");

    // Verify values are correct
    expect(config.model_name).toBe("test-model");
    expect(config.api_key_env_var).toBe("DASHSCOPE_API_KEY");
    expect(config.dimensions).toBe(512);
  });

  it("should build instance from snake_case config", () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const snakeCaseConfig = {
      model_name: "custom-model",
      api_key: "custom-key",
      api_key_env_var: "DASHSCOPE_API_KEY",
      dimensions: 2048,
    };

    const embedder = QwenEmbeddingFunction.buildFromConfig(snakeCaseConfig);

    expect(embedder).toBeInstanceOf(QwenEmbeddingFunction);
    expect(embedder.name).toBe("qwen");

    // Verify config is correctly converted
    const config = embedder.getConfig();
    expect(config.model_name).toBe("custom-model");
    expect(config.api_key).toBeUndefined();
    expect(config.api_key_env_var).toBe("DASHSCOPE_API_KEY");
    expect(config.dimensions).toBe(2048);
  });

  it("should maintain consistency in round-trip conversion", () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const originalConfig: QwenEmbeddingConfig = {
      modelName: "round-trip-model",
      apiKey: "round-trip-key",
      apiKeyEnvVar: "DASHSCOPE_API_KEY",
      dimensions: 512,
      region: "intl",
    };

    const embedder1 = new QwenEmbeddingFunction(originalConfig);
    const snakeConfig = embedder1.getConfig();
    const embedder2 = QwenEmbeddingFunction.buildFromConfig(snakeConfig);
    const finalConfig = embedder2.getConfig();

    // Verify configs match after round-trip
    expect(finalConfig).toEqual(snakeConfig);
    expect(finalConfig.model_name).toBe("round-trip-model");
    expect(finalConfig.api_key).toBeUndefined();
    expect(finalConfig.api_key_env_var).toBe("DASHSCOPE_API_KEY");
    expect(finalConfig.dimensions).toBe(512);
  });

  it("should build instance with default values from empty config", () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const embedder = QwenEmbeddingFunction.buildFromConfig({});

    expect(embedder).toBeInstanceOf(QwenEmbeddingFunction);
    expect(embedder.name).toBe("qwen");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("text-embedding-v4");
    expect(config.api_key_env_var).toBe("DASHSCOPE_API_KEY");
    expect(config.dimensions).toBe(1024);
  });

  it("should not include organization_id in config", () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const embedder = new QwenEmbeddingFunction({
      modelName: "test-model",
    });

    const config = embedder.getConfig();
    expect(config).not.toHaveProperty("organization_id");
  });

  it("should call OpenAI client with correct parameters including encoding_format", async () => {
    process.env.DASHSCOPE_API_KEY = "test-api-key";

    const embedder = new QwenEmbeddingFunction({
      modelName: "test-model",
      dimensions: 1024,
    });

    const OpenAI = (await import("openai")).default;
    const mockInstance = new OpenAI();

    await embedder.generate(["test text"]);

    expect(mockInstance.embeddings.create).toHaveBeenCalledWith({
      input: ["test text"],
      model: "test-model",
      dimensions: 1024,
      encoding_format: "float",
    });
  });
});
