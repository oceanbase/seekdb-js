import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAIEmbeddingFunction, OpenAIEmbeddingConfig } from "./index";

// Mock OpenAI client
vi.mock("openai", () => {
  const mockCreate = vi.fn().mockResolvedValue({
    data: [
      { embedding: Array(1536).fill(0).map((_, i) => i / 1000) },
      { embedding: Array(1536).fill(0).map((_, i) => (i + 100) / 1000) },
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

describe("OpenAIEmbeddingFunction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default parameters", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    
    const embedder = new OpenAIEmbeddingFunction();
    expect(embedder.name).toBe("openai");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("text-embedding-3-small");
    expect(config.api_key_env_var).toBe("OPENAI_API_KEY");
    expect(config.dimensions).toBeUndefined();
    expect(config.organization_id).toBeUndefined();
  });

  it("should initialize with custom parameters", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    
    const embedder = new OpenAIEmbeddingFunction({
      modelName: "text-embedding-3-large",
      dimensions: 3072,
      organizationId: "org-123",
      apiKeyEnvVar: "OPENAI_API_KEY",
    });

    const config = embedder.getConfig();
    expect(config.model_name).toBe("text-embedding-3-large");
    expect(config.dimensions).toBe(3072);
    expect(config.organization_id).toBe("org-123");
    expect(config.api_key_env_var).toBe("OPENAI_API_KEY");
  });

  it("should initialize with all optional parameters", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    
    const embedder = new OpenAIEmbeddingFunction({
      modelName: "custom-model",
      apiKey: "custom-key",
      apiKeyEnvVar: "CUSTOM_OPENAI_KEY",
      organizationId: "org-456",
      dimensions: 2048,
      baseURL: "https://custom.openai.com",
    });

    const config = embedder.getConfig();
    expect(config.model_name).toBe("custom-model");
    expect(config.api_key).toBe("custom-key");
    expect(config.api_key_env_var).toBe("CUSTOM_OPENAI_KEY");
    expect(config.organization_id).toBe("org-456");
    expect(config.dimensions).toBe(2048);
  });

  it("should throw error when API key is missing", () => {
    const originalEnv = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      expect(() => {
        new OpenAIEmbeddingFunction();
      }).toThrow("OpenAI API Key is required");
    } finally {
      if (originalEnv) {
        process.env.OPENAI_API_KEY = originalEnv;
      }
    }
  });

  it("should use custom API key from constructor", () => {
    const embedder = new OpenAIEmbeddingFunction({
      apiKey: "custom-api-key",
    });

    expect(embedder.name).toBe("openai");
    expect(embedder.getConfig().api_key).toBe("custom-api-key");
  });

  it("should use custom API key environment variable", () => {
    process.env.CUSTOM_OPENAI_API_KEY = "test-api-key";

    try {
      const embedder = new OpenAIEmbeddingFunction({
        apiKeyEnvVar: "CUSTOM_OPENAI_API_KEY",
      });

      expect(embedder.getConfig().api_key_env_var).toBe("CUSTOM_OPENAI_API_KEY");
    } finally {
      delete process.env.CUSTOM_OPENAI_API_KEY;
    }
  });

  it("should generate embeddings with correct dimensions", async () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    
    const embedder = new OpenAIEmbeddingFunction();
    const texts = ["Hello world", "Test text"];
    const embeddings = await embedder.generate(texts);

    expect(embeddings.length).toBe(texts.length);
    embeddings.forEach((embedding) => {
      expect(embedding.length).toBe(1536);
    });
    expect(embeddings[0]).not.toEqual(embeddings[1]);
  });

  it("should return correct config", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    
    const embedder = new OpenAIEmbeddingFunction({
      modelName: "test-model",
      dimensions: 1536,
      organizationId: "org-test",
    });

    const config = embedder.getConfig();
    expect(config).toEqual({
      api_key: "test-api-key",
      model_name: "test-model",
      dimensions: 1536,
      organization_id: "org-test",
      api_key_env_var: "OPENAI_API_KEY",
    });
  });

  it("should return config in snake_case format", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    
    const embedder = new OpenAIEmbeddingFunction({
      modelName: "test-model",
      apiKeyEnvVar: "OPENAI_API_KEY",
      organizationId: "org-123",
    });

    const config = embedder.getConfig();

    // Verify snake_case keys exist
    expect(config).toHaveProperty("model_name");
    expect(config).toHaveProperty("api_key");
    expect(config).toHaveProperty("api_key_env_var");
    expect(config).toHaveProperty("organization_id");

    // Verify values are correct
    expect(config.model_name).toBe("test-model");
    expect(config.api_key_env_var).toBe("OPENAI_API_KEY");
    expect(config.organization_id).toBe("org-123");
  });

  it("should build instance from snake_case config", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    
    const snakeCaseConfig = {
      model_name: "custom-model",
      api_key: "custom-key",
      api_key_env_var: "OPENAI_API_KEY",
      organization_id: "org-789",
      dimensions: 2048,
    };

    const embedder = OpenAIEmbeddingFunction.buildFromConfig(snakeCaseConfig);

    expect(embedder).toBeInstanceOf(OpenAIEmbeddingFunction);
    expect(embedder.name).toBe("openai");

    // Verify config is correctly converted
    const config = embedder.getConfig();
    expect(config.model_name).toBe("custom-model");
    expect(config.api_key).toBe("custom-key");
    expect(config.api_key_env_var).toBe("OPENAI_API_KEY");
    expect(config.organization_id).toBe("org-789");
    expect(config.dimensions).toBe(2048);
  });

  it("should maintain consistency in round-trip conversion", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    
    const originalConfig: OpenAIEmbeddingConfig = {
      modelName: "round-trip-model",
      apiKey: "round-trip-key",
      apiKeyEnvVar: "OPENAI_API_KEY",
      organizationId: "org-round-trip",
      dimensions: 1024,
    };

    const embedder1 = new OpenAIEmbeddingFunction(originalConfig);
    const snakeConfig = embedder1.getConfig();
    const embedder2 = OpenAIEmbeddingFunction.buildFromConfig(snakeConfig);
    const finalConfig = embedder2.getConfig();

    // Verify configs match after round-trip
    expect(finalConfig).toEqual(snakeConfig);
    expect(finalConfig.model_name).toBe("round-trip-model");
    expect(finalConfig.api_key).toBe("round-trip-key");
    expect(finalConfig.api_key_env_var).toBe("OPENAI_API_KEY");
    expect(finalConfig.organization_id).toBe("org-round-trip");
    expect(finalConfig.dimensions).toBe(1024);
  });

  it("should build instance with default values from empty config", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    
    const embedder = OpenAIEmbeddingFunction.buildFromConfig({});

    expect(embedder).toBeInstanceOf(OpenAIEmbeddingFunction);
    expect(embedder.name).toBe("openai");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("text-embedding-3-small");
    expect(config.api_key_env_var).toBe("OPENAI_API_KEY");
  });

  it("should support custom baseURL", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    
    const embedder = new OpenAIEmbeddingFunction({
      baseURL: "https://custom-endpoint.com/v1",
    });

    expect(embedder.name).toBe("openai");
  });

  it("should call OpenAI client with correct parameters", async () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    
    const embedder = new OpenAIEmbeddingFunction({
      modelName: "test-model",
      dimensions: 1536,
    });

    const OpenAI = (await import("openai")).default;
    const mockInstance = new OpenAI();

    await embedder.generate(["test text"]);

    expect(mockInstance.embeddings.create).toHaveBeenCalledWith({
      input: ["test text"],
      model: "test-model",
      dimensions: 1536,
    });
  });
});
