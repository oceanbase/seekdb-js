import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AmazonBedrockEmbeddingFunction } from "./index";

const mockFetch = vi.hoisted(() => vi.fn());

describe("AmazonBedrockEmbeddingFunction", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    let call = 0;
    mockFetch.mockImplementation(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
      json: async () => ({
        embedding: Array(1024)
          .fill(0)
          .map((_, i) => (i + call++) / 1000),
      }),
    }));
    vi.clearAllMocks();
    process.env.AMAZON_BEDROCK_API_KEY = "test-api-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.AMAZON_BEDROCK_API_KEY;
  });

  it("should initialize with default parameters", () => {
    const embedder = new AmazonBedrockEmbeddingFunction({
      region: "us-east-1",
    });
    expect(embedder.name).toBe("amazon_bedrock");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("amazon.titan-embed-text-v2");
    expect(config.region).toBe("us-east-1");
    expect(config.api_key_env).toBe("AMAZON_BEDROCK_API_KEY");
  });

  it("should initialize with custom parameters", () => {
    const embedder = new AmazonBedrockEmbeddingFunction({
      apiKey: "direct-key",
      region: "us-west-2",
      modelName: "amazon.titan-embed-text-v1",
      apiKeyEnv: "CUSTOM_BEDROCK_KEY",
    });

    const config = embedder.getConfig();
    expect(config.region).toBe("us-west-2");
    expect(config.model_name).toBe("amazon.titan-embed-text-v1");
    expect(config.api_key_env).toBe("CUSTOM_BEDROCK_KEY");
  });

  it("should throw when API key is missing", () => {
    delete process.env.AMAZON_BEDROCK_API_KEY;
    expect(() => {
      new AmazonBedrockEmbeddingFunction({ region: "us-east-1" });
    }).toThrow(/apiKey is required/);
  });

  it("should throw when region is missing", () => {
    expect(() => {
      new AmazonBedrockEmbeddingFunction({ apiKey: "k" });
    }).toThrow(/region is required/);
  });

  it("should generate embeddings", async () => {
    const embedder = new AmazonBedrockEmbeddingFunction({
      region: "us-east-1",
    });
    const texts = ["Hello world", "Test text"];
    const embeddings = await embedder.generate(texts);

    expect(embeddings.length).toBe(texts.length);
    embeddings.forEach((embedding) => {
      expect(embedding.length).toBe(1024);
    });
    expect(embeddings[0]).not.toEqual(embeddings[1]);
  });

  it("should return empty array for empty input", async () => {
    const embedder = new AmazonBedrockEmbeddingFunction({
      region: "us-east-1",
    });
    expect(await embedder.generate([])).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should build from config", () => {
    const snakeCaseConfig = {
      region: "eu-west-1",
      model_name: "amazon.titan-embed-text-v2:0" as const,
      api_key_env: "AMAZON_BEDROCK_API_KEY",
    };

    const embedder =
      AmazonBedrockEmbeddingFunction.buildFromConfig(snakeCaseConfig);

    expect(embedder).toBeInstanceOf(AmazonBedrockEmbeddingFunction);
    expect(embedder.name).toBe("amazon_bedrock");

    const config = embedder.getConfig();
    expect(config.region).toBe("eu-west-1");
    expect(config.model_name).toBe("amazon.titan-embed-text-v2:0");
  });

  it("should build instance with defaults from partial config", () => {
    const embedder = AmazonBedrockEmbeddingFunction.buildFromConfig({
      region: "us-east-1",
    });

    expect(embedder).toBeInstanceOf(AmazonBedrockEmbeddingFunction);
    const config = embedder.getConfig();
    expect(config.model_name).toBe("amazon.titan-embed-text-v2");
  });

  it("should call fetch with correct URL and headers", async () => {
    const embedder = new AmazonBedrockEmbeddingFunction({
      region: "us-east-1",
      modelName: "amazon.titan-embed-text-v2",
    });

    await embedder.generate(["hello"]);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.titan-embed-text-v2/invoke",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
          Accept: "application/json",
        }),
        body: JSON.stringify({ inputText: "hello" }),
      })
    );
  });

  it("should expose dimension and getModelDimensions", () => {
    const embedder = new AmazonBedrockEmbeddingFunction({
      region: "us-east-1",
      modelName: "amazon.titan-embed-text-v1",
    });
    expect(embedder.dimension).toBe(1536);
    expect(
      AmazonBedrockEmbeddingFunction.getModelDimensions()[
        "amazon.titan-embed-text-v2"
      ]
    ).toBe(1024);
  });
});
