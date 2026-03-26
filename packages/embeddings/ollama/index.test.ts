import { describe, it, expect, beforeEach, vi } from "vitest";
import { OllamaEmbeddingFunction } from "./index";

const mockEmbed = vi.hoisted(() => vi.fn());

vi.mock("ollama", () => ({
  Ollama: vi.fn().mockImplementation(() => ({
    embed: mockEmbed,
  })),
}));

describe("OllamaEmbeddingFunction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbed.mockResolvedValue({
      embeddings: [
        Array(768)
          .fill(0)
          .map((_, i) => i / 1000),
        Array(768)
          .fill(0)
          .map((_, i) => (i + 100) / 1000),
      ],
    });
    delete process.env.OLLAMA_API_KEY;
  });

  it("should initialize with default parameters", () => {
    const embedder = new OllamaEmbeddingFunction();
    expect(embedder.name).toBe("ollama");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("nomic-embed-text");
    expect(config.url).toBe("http://localhost:11434/v1");
    expect(config.api_key_env).toBe("OLLAMA_API_KEY");
  });

  it("should initialize with custom parameters", () => {
    const embedder = new OllamaEmbeddingFunction({
      url: "http://remote:11434/v1",
      modelName: "all-minilm",
      apiKeyEnv: "CUSTOM_OLLAMA_KEY",
    });

    const config = embedder.getConfig();
    expect(config.model_name).toBe("all-minilm");
    expect(config.url).toBe("http://remote:11434/v1");
    expect(config.api_key_env).toBe("CUSTOM_OLLAMA_KEY");
  });

  it("should generate embeddings with correct dimensions", async () => {
    const embedder = new OllamaEmbeddingFunction();
    const texts = ["Hello world", "Test text"];
    const embeddings = await embedder.generate(texts);

    expect(embeddings.length).toBe(texts.length);
    embeddings.forEach((embedding) => {
      expect(embedding.length).toBe(768);
    });
    expect(embeddings[0]).not.toEqual(embeddings[1]);
  });

  it("should return correct config", () => {
    const embedder = new OllamaEmbeddingFunction({
      url: "http://localhost:9999/v1",
      modelName: "nomic-embed-text",
    });

    const config = embedder.getConfig();
    expect(config).toEqual({
      url: "http://localhost:9999/v1",
      model_name: "nomic-embed-text",
      api_key_env: "OLLAMA_API_KEY",
    });
  });

  it("should return config in snake_case format", () => {
    const embedder = new OllamaEmbeddingFunction({
      modelName: "nomic-embed-text",
    });

    const config = embedder.getConfig();

    expect(config).toHaveProperty("model_name");
    expect(config).toHaveProperty("api_key_env");
    expect(config).toHaveProperty("url");
    expect(config.model_name).toBe("nomic-embed-text");
  });

  it("should build instance from snake_case config", () => {
    const snakeCaseConfig = {
      url: "http://host:11434/v1",
      model_name: "all-minilm",
      api_key_env: "OLLAMA_API_KEY",
    };

    const embedder = OllamaEmbeddingFunction.buildFromConfig(snakeCaseConfig);

    expect(embedder).toBeInstanceOf(OllamaEmbeddingFunction);
    expect(embedder.name).toBe("ollama");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("all-minilm");
    expect(config.url).toBe("http://host:11434/v1");
  });

  it("should maintain consistency in round-trip conversion", () => {
    const embedder1 = new OllamaEmbeddingFunction({
      url: "http://a/v1",
      modelName: "nomic-embed-text",
      apiKeyEnv: "OLLAMA_API_KEY",
    });
    const snakeConfig = embedder1.getConfig();
    const embedder2 = OllamaEmbeddingFunction.buildFromConfig(snakeConfig);
    const finalConfig = embedder2.getConfig();

    expect(finalConfig).toEqual(snakeConfig);
  });

  it("should build instance with default values from empty config", () => {
    const embedder = OllamaEmbeddingFunction.buildFromConfig({});

    expect(embedder).toBeInstanceOf(OllamaEmbeddingFunction);
    expect(embedder.name).toBe("ollama");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("nomic-embed-text");
    expect(config.url).toBe("http://localhost:11434/v1");
  });

  it("should expose dimension for known models", () => {
    const embedder = new OllamaEmbeddingFunction({
      modelName: "all-minilm",
    });
    expect(embedder.dimension).toBe(384);
  });

  it("should expose getModelDimensions", () => {
    const dims = OllamaEmbeddingFunction.getModelDimensions();
    expect(dims["nomic-embed-text"]).toBe(768);
  });

  it("should call Ollama embed with correct parameters", async () => {
    const embedder = new OllamaEmbeddingFunction({
      modelName: "my-model",
    });

    await embedder.generate(["test text"]);

    expect(mockEmbed).toHaveBeenCalledWith({
      model: "my-model",
      input: ["test text"],
    });
  });

  it("should pass Authorization header when API key is set", async () => {
    process.env.OLLAMA_API_KEY = "secret-token";

    const { Ollama } = await import("ollama");
    const embedder = new OllamaEmbeddingFunction();

    await embedder.generate(["x"]);

    expect(Ollama).toHaveBeenCalledWith({
      host: "http://localhost:11434/v1",
      headers: { Authorization: "Bearer secret-token" },
    });
  });
});
