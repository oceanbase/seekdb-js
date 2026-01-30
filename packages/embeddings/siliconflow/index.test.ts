import { describe, it, expect, beforeEach, vi } from "vitest";
import { SiliconFlowEmbeddingFunction } from "./index";

// Mock OpenAI client
vi.mock("openai", () => {
  const mockCreate = vi.fn().mockResolvedValue({
    data: [
      {
        embedding: Array(1536)
          .fill(0)
          .map((_, i) => i / 1000),
      },
      {
        embedding: Array(1536)
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

describe("SiliconFlowEmbeddingFunction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default parameters", () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";

    const embedder = new SiliconFlowEmbeddingFunction();
    expect(embedder.name).toBe("siliconflow");

    const config = embedder.getConfig();
    expect(config.api_key_env_var).toBe("SILICONFLOW_API_KEY");
    expect(config.base_url).toBe("https://api.siliconflow.com/v1");
  });

  it("should initialize with custom parameters", () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";

    const embedder = new SiliconFlowEmbeddingFunction({
      modelName: "custom-model",
      dimensions: 1024,
      apiKeyEnvVar: "SILICONFLOW_API_KEY",
    });

    const config = embedder.getConfig();
    expect(config.model_name).toBe("custom-model");
    expect(config.dimensions).toBe(1024);
    expect(config.api_key_env_var).toBe("SILICONFLOW_API_KEY");
  });

  it("should generate embeddings", async () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";

    const embedder = new SiliconFlowEmbeddingFunction();
    const texts = ["Hello world", "Test text"];
    const embeddings = await embedder.generate(texts);

    expect(embeddings.length).toBe(texts.length);
    embeddings.forEach((embedding) => {
      expect(embedding.length).toBe(1536);
    });
  });

  it("should build from config", () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";

    const snakeCaseConfig = {
      model_name: "custom-model",
      api_key: "custom-key",
      api_key_env_var: "SILICONFLOW_API_KEY",
      dimensions: 2048,
      base_url: "https://api.siliconflow.com/v1",
    };

    const embedder =
      SiliconFlowEmbeddingFunction.buildFromConfig(snakeCaseConfig);

    expect(embedder).toBeInstanceOf(SiliconFlowEmbeddingFunction);
    expect(embedder.name).toBe("siliconflow");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("custom-model");
    expect(config.api_key).toBe("custom-key");
  });

  it("should not include organization_id in config", () => {
    process.env.SILICONFLOW_API_KEY = "test-api-key";

    const embedder = new SiliconFlowEmbeddingFunction();
    const config = embedder.getConfig();

    expect(config).not.toHaveProperty("organization_id");
  });
});
