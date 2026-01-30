import { describe, it, expect, beforeEach, vi } from "vitest";
import { AmazonBedrockEmbeddingFunction } from "./index";

// Mock AWS Bedrock Runtime client
vi.mock("@aws-sdk/client-bedrock-runtime", () => {
  const mockSend = vi.fn().mockResolvedValue({
    body: new TextEncoder().encode(
      JSON.stringify({
        embedding: Array(1536)
          .fill(0)
          .map((_, i) => i / 1000),
      })
    ),
  });

  return {
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    InvokeModelCommand: vi.fn().mockImplementation((params) => params),
  };
});

describe("AmazonBedrockEmbeddingFunction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default parameters", () => {
    const embedder = new AmazonBedrockEmbeddingFunction({});
    expect(embedder.name).toBe("bedrock");

    const config = embedder.getConfig();
    expect(config.model_id).toBe("amazon.titan-embed-text-v1");
  });

  it("should initialize with custom parameters", () => {
    const embedder = new AmazonBedrockEmbeddingFunction({
      region: "us-west-2",
      modelId: "custom-model-id",
    });

    const config = embedder.getConfig();
    expect(config.region).toBe("us-west-2");
    expect(config.model_id).toBe("custom-model-id");
  });

  it("should generate embeddings", async () => {
    const embedder = new AmazonBedrockEmbeddingFunction({});
    const texts = ["Hello world", "Test text"];
    const embeddings = await embedder.generate(texts);

    expect(embeddings.length).toBe(texts.length);
    embeddings.forEach((embedding) => {
      expect(embedding.length).toBe(1536);
    });
  });

  it("should build from config", () => {
    const snakeCaseConfig = {
      region: "eu-west-1",
      model_id: "amazon.titan-embed-text-v2:0",
    };

    const embedder =
      AmazonBedrockEmbeddingFunction.buildFromConfig(snakeCaseConfig);

    expect(embedder).toBeInstanceOf(AmazonBedrockEmbeddingFunction);
    expect(embedder.name).toBe("bedrock");

    const config = embedder.getConfig();
    expect(config.region).toBe("eu-west-1");
    expect(config.model_id).toBe("amazon.titan-embed-text-v2:0");
  });

  it("should handle empty config", () => {
    const embedder = AmazonBedrockEmbeddingFunction.buildFromConfig({});

    expect(embedder).toBeInstanceOf(AmazonBedrockEmbeddingFunction);
    const config = embedder.getConfig();
    expect(config.model_id).toBe("amazon.titan-embed-text-v1");
  });
});
