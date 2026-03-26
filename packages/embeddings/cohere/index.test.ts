import { describe, it, expect, beforeEach, vi } from "vitest";
import { CohereEmbeddingFunction } from "./index";

const mockEmbed = vi.hoisted(() => vi.fn());

vi.mock("cohere-ai", () => ({
  CohereClient: vi.fn().mockImplementation(() => ({
    embed: mockEmbed,
  })),
}));

describe("CohereEmbeddingFunction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbed.mockResolvedValue({
      embeddings: [
        Array(1024)
          .fill(0)
          .map((_, i) => i / 1000),
        Array(1024)
          .fill(0)
          .map((_, i) => (i + 100) / 1000),
      ],
    });
  });

  it("should initialize with default parameters", () => {
    process.env.COHERE_API_KEY = "test-api-key";

    const embedder = new CohereEmbeddingFunction();
    expect(embedder.name).toBe("cohere");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("embed-english-v3.0");
    expect(config.api_key_env_var).toBe("COHERE_API_KEY");
    expect(config.input_type).toBe("search_document");
    expect(config.image).toBe(false);
  });

  it("should initialize with custom parameters", () => {
    process.env.COHERE_API_KEY = "test-api-key";

    const embedder = new CohereEmbeddingFunction({
      modelName: "embed-multilingual-v3.0",
      inputType: "search_query",
      truncate: "END",
      embeddingType: "float",
      image: false,
      apiKeyEnvVar: "COHERE_API_KEY",
    });

    const config = embedder.getConfig();
    expect(config.model_name).toBe("embed-multilingual-v3.0");
    expect(config.input_type).toBe("search_query");
    expect(config.truncate).toBe("END");
    expect(config.embedding_type).toBe("float");
    expect(config.api_key_env_var).toBe("COHERE_API_KEY");
  });

  it("should throw error when API key is missing", () => {
    const originalEnv = process.env.COHERE_API_KEY;
    delete process.env.COHERE_API_KEY;

    try {
      expect(() => {
        new CohereEmbeddingFunction();
      }).toThrow(/Cohere API key is required/);
    } finally {
      if (originalEnv) {
        process.env.COHERE_API_KEY = originalEnv;
      }
    }
  });

  it("should use custom API key from constructor", () => {
    const embedder = new CohereEmbeddingFunction({
      apiKey: "custom-api-key",
    });

    expect(embedder.name).toBe("cohere");
  });

  it("should use custom API key environment variable", () => {
    process.env.CUSTOM_COHERE_KEY = "test-api-key";

    try {
      const embedder = new CohereEmbeddingFunction({
        apiKeyEnvVar: "CUSTOM_COHERE_KEY",
      });

      expect(embedder.getConfig().api_key_env_var).toBe("CUSTOM_COHERE_KEY");
    } finally {
      delete process.env.CUSTOM_COHERE_KEY;
    }
  });

  it("should generate embeddings with correct dimensions", async () => {
    process.env.COHERE_API_KEY = "test-api-key";

    const embedder = new CohereEmbeddingFunction();
    const texts = ["Hello world", "Test text"];
    const embeddings = await embedder.generate(texts);

    expect(embeddings.length).toBe(texts.length);
    embeddings.forEach((embedding) => {
      expect(embedding.length).toBe(1024);
    });
    expect(embeddings[0]).not.toEqual(embeddings[1]);
  });

  it("should return correct config", () => {
    process.env.COHERE_API_KEY = "test-api-key";

    const embedder = new CohereEmbeddingFunction({
      modelName: "embed-english-v3.0",
      inputType: "classification",
    });

    const config = embedder.getConfig();
    expect(config).toEqual({
      model_name: "embed-english-v3.0",
      api_key_env_var: "COHERE_API_KEY",
      input_type: "classification",
      truncate: undefined,
      embedding_type: undefined,
      image: false,
    });
  });

  it("should return config in snake_case format", () => {
    process.env.COHERE_API_KEY = "test-api-key";

    const embedder = new CohereEmbeddingFunction({
      modelName: "test-model",
      apiKeyEnvVar: "COHERE_API_KEY",
    });

    const config = embedder.getConfig();

    expect(config).toHaveProperty("model_name");
    expect(config).toHaveProperty("api_key_env_var");
    expect(config).toHaveProperty("input_type");
    expect(config.model_name).toBe("test-model");
    expect(config.api_key_env_var).toBe("COHERE_API_KEY");
  });

  it("should build instance from snake_case config", () => {
    process.env.COHERE_API_KEY = "test-api-key";

    const snakeCaseConfig = {
      model_name: "embed-multilingual-v3.0",
      api_key_env_var: "COHERE_API_KEY",
      input_type: "clustering",
      truncate: "START" as const,
      embedding_type: "float" as const,
      image: false,
    };

    const embedder = CohereEmbeddingFunction.buildFromConfig(snakeCaseConfig);

    expect(embedder).toBeInstanceOf(CohereEmbeddingFunction);
    expect(embedder.name).toBe("cohere");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("embed-multilingual-v3.0");
    expect(config.input_type).toBe("clustering");
    expect(config.truncate).toBe("START");
    expect(config.embedding_type).toBe("float");
  });

  it("should maintain consistency in round-trip conversion", () => {
    process.env.COHERE_API_KEY = "test-api-key";

    const embedder1 = new CohereEmbeddingFunction({
      modelName: "embed-english-v3.0",
      apiKeyEnvVar: "COHERE_API_KEY",
      inputType: "search_document",
      truncate: "NONE",
    });
    const snakeConfig = embedder1.getConfig();
    const embedder2 = CohereEmbeddingFunction.buildFromConfig(snakeConfig);
    const finalConfig = embedder2.getConfig();

    expect(finalConfig).toEqual(snakeConfig);
  });

  it("should build instance with default values from empty config", () => {
    process.env.COHERE_API_KEY = "test-api-key";

    const embedder = CohereEmbeddingFunction.buildFromConfig({});

    expect(embedder).toBeInstanceOf(CohereEmbeddingFunction);
    expect(embedder.name).toBe("cohere");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("embed-english-v3.0");
    expect(config.api_key_env_var).toBe("COHERE_API_KEY");
  });

  it("should expose dimension for known models", () => {
    process.env.COHERE_API_KEY = "test-api-key";

    const embedder = new CohereEmbeddingFunction({
      modelName: "embed-english-v3.0",
    });
    expect(embedder.dimension).toBe(1024);
  });

  it("should expose getModelDimensions", () => {
    const dims = CohereEmbeddingFunction.getModelDimensions();
    expect(dims["embed-english-v3.0"]).toBe(1024);
  });

  it("should throw when image mode receives multiple inputs", async () => {
    process.env.COHERE_API_KEY = "test-api-key";

    const embedder = new CohereEmbeddingFunction({ image: true });
    await expect(embedder.generate(["a", "b"])).rejects.toThrow(
      /one image at a time/
    );
  });

  it("should throw when more than 96 text inputs", async () => {
    process.env.COHERE_API_KEY = "test-api-key";

    const embedder = new CohereEmbeddingFunction();
    const texts = Array.from({ length: 97 }, (_, i) => `t${i}`);
    await expect(embedder.generate(texts)).rejects.toThrow(/maximum of 96/);
  });

  it("should call Cohere client embed with correct parameters", async () => {
    process.env.COHERE_API_KEY = "test-api-key";

    const embedder = new CohereEmbeddingFunction({
      modelName: "test-model",
      inputType: "search_query",
      truncate: "END",
      embeddingType: "float",
    });

    await embedder.generate(["hello"]);

    expect(mockEmbed).toHaveBeenCalledWith({
      model: "test-model",
      inputType: "search_query",
      truncate: "END",
      embeddingTypes: ["float"],
      images: undefined,
      texts: ["hello"],
    });
  });
});
