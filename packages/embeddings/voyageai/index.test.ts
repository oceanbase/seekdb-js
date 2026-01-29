import { describe, it, expect, beforeEach, vi } from "vitest";
import { VoyageAIEmbeddingFunction, VoyageAIConfig } from "./index";
import { SeekdbValueError } from "seekdb";

// Mock VoyageAI client
vi.mock("voyageai", () => {
  const mockEmbed = vi.fn().mockResolvedValue({
    data: [
      { embedding: Array(1024).fill(0).map((_, i) => i / 1000) },
      { embedding: Array(1024).fill(0).map((_, i) => (i + 100) / 1000) },
    ],
  });

  return {
    VoyageAIClient: vi.fn().mockImplementation(() => ({
      embed: mockEmbed,
    })),
  };
});

describe("VoyageAIEmbeddingFunction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOYAGE_API_KEY = "test-api-key";
  });

  it("should have correct name", () => {
    const embedder = new VoyageAIEmbeddingFunction({
      modelName: "voyage-2",
    });
    expect(embedder.name).toBe("voyageai");
  });

  it("should throw SeekdbValueError when modelName is missing", () => {
    expect(() => {
      new VoyageAIEmbeddingFunction({} as any);
    }).toThrow(SeekdbValueError);
    expect(() => {
      new VoyageAIEmbeddingFunction({} as any);
    }).toThrow("VoyageAI model name is required");
  });

  it("should throw SeekdbValueError when API key is missing", () => {
    delete process.env.VOYAGE_API_KEY;

    expect(() => {
      new VoyageAIEmbeddingFunction({
        modelName: "voyage-2",
      });
    }).toThrow(SeekdbValueError);
    expect(() => {
      new VoyageAIEmbeddingFunction({
        modelName: "voyage-2",
      });
    }).toThrow("Voyage API key is required");
  });

  it("should initialize with required modelName", () => {
    const embedder = new VoyageAIEmbeddingFunction({
      modelName: "voyage-2",
    });

    const config = embedder.getConfig();
    expect(config.model_name).toBe("voyage-2");
    expect(config.api_key_env_var).toBe("VOYAGE_API_KEY");
    expect(config.truncation).toBe(true);
  });

  it("should initialize with custom parameters", () => {
    const embedder = new VoyageAIEmbeddingFunction({
      modelName: "voyage-large-2",
      apiKeyEnvVar: "CUSTOM_VOYAGE_KEY",
      inputType: "document",
      truncation: false,
    });

    const config = embedder.getConfig();
    expect(config.model_name).toBe("voyage-large-2");
    expect(config.api_key_env_var).toBe("CUSTOM_VOYAGE_KEY");
    expect(config.input_type).toBe("document");
    expect(config.truncation).toBe(false);
  });

  it("should use custom API key from constructor", () => {
    delete process.env.VOYAGE_API_KEY;

    const embedder = new VoyageAIEmbeddingFunction({
      modelName: "voyage-2",
      apiKey: "custom-api-key",
    });

    expect(embedder.name).toBe("voyageai");
  });

  it("should throw SeekdbValueError when model_name is missing in buildFromConfig", () => {
    expect(() => {
      VoyageAIEmbeddingFunction.buildFromConfig(null as any);
    }).toThrow(SeekdbValueError);
  });

  it("should build from config with model_name", () => {
    const config = {
      model_name: "voyage-2",
      api_key_env_var: "VOYAGE_API_KEY",
      truncation: true,
    };

    const embedder = VoyageAIEmbeddingFunction.buildFromConfig(config);
    expect(embedder).toBeInstanceOf(VoyageAIEmbeddingFunction);

    const resultConfig = embedder.getConfig();
    expect(resultConfig.model_name).toBe("voyage-2");
    expect(resultConfig.api_key_env_var).toBe("VOYAGE_API_KEY");
    expect(resultConfig.truncation).toBe(true);
  });

  it("should maintain round-trip consistency", () => {
    const originalConfig: VoyageAIConfig = {
      modelName: "voyage-large-2",
      apiKeyEnvVar: "VOYAGE_API_KEY",
      inputType: "query",
      truncation: false,
    };

    const embedder1 = new VoyageAIEmbeddingFunction(originalConfig);
    const snakeConfig = embedder1.getConfig();
    const embedder2 = VoyageAIEmbeddingFunction.buildFromConfig(snakeConfig);
    const finalConfig = embedder2.getConfig();

    expect(finalConfig).toEqual(snakeConfig);
    expect(finalConfig.model_name).toBe("voyage-large-2");
    expect(finalConfig.api_key_env_var).toBe("VOYAGE_API_KEY");
    expect(finalConfig.input_type).toBe("query");
    expect(finalConfig.truncation).toBe(false);
  });

  it("should return correct config", () => {
    const embedder = new VoyageAIEmbeddingFunction({
      modelName: "voyage-2",
      inputType: "document",
      truncation: true,
    });

    const config = embedder.getConfig();
    expect(config).toEqual({
      api_key_env_var: "VOYAGE_API_KEY",
      model_name: "voyage-2",
      input_type: "document",
      truncation: true,
    });
  });

  it("should generate embeddings", async () => {
    const embedder = new VoyageAIEmbeddingFunction({
      modelName: "voyage-2",
    });

    const texts = ["Hello world", "Test text"];
    const embeddings = await embedder.generate(texts);

    expect(embeddings.length).toBe(texts.length);
    embeddings.forEach((embedding) => {
      expect(embedding.length).toBe(1024);
    });
  });
});
