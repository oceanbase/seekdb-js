import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DefaultEmbeddingFunction,
  DefaultEmbeddingFunctionConfig,
  DType,
} from "./index";

// Mock the transformers pipeline
vi.mock("@huggingface/transformers", () => {
  // Create a mock embeddings result
  const mockEmbeddings = [
    Array(384)
      .fill(0)
      .map((_, i) => i / 1000),
    Array(384)
      .fill(0)
      .map((_, i) => (i + 100) / 1000),
  ];

  // Create the pipeline mock that returns a function
  const pipelineFunction = vi.fn().mockImplementation(() => {
    // When the pipeline result is called with text, it returns this object with tolist
    return function (texts: string[], options: any) {
      return {
        tolist: () => mockEmbeddings,
      };
    };
  });

  return {
    pipeline: pipelineFunction,
    env: {
      remoteHost: "https://hf-mirror.com",
    },
  };
});

describe("DefaultEmbeddingFunction", () => {
  let embedder: DefaultEmbeddingFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    embedder = new DefaultEmbeddingFunction();
  });

  it("should initialize with default parameters", () => {
    expect(embedder.name).toBe("default-embed");
    const config = embedder.getConfig();
    expect(config.model_name).toBe("Xenova/all-MiniLM-L6-v2");
    expect(config.revision).toBeUndefined();
    expect(config.dtype).toBeUndefined();
  });

  it("should initialize with custom parameters", () => {
    const customEmbedder = new DefaultEmbeddingFunction({
      modelName: "custom-model",
      revision: "custom-revision",
      dtype: "fp16",
    });

    const config = customEmbedder.getConfig();
    expect(config.model_name).toBe("custom-model");
    expect(config.revision).toBe("custom-revision");
    expect(config.dtype).toBe("fp16");
  });

  it("should initialize with all optional parameters", () => {
    const progressCallback = vi.fn();
    const customEmbedder = new DefaultEmbeddingFunction({
      modelName: "test-model",
      revision: "test-revision",
      dtype: "fp32",
      cacheDir: "/tmp/cache",
      localFilesOnly: true,
      progressCallback: progressCallback,
      remoteHost: "https://custom-host.com",
      region: "cn",
    });

    const config = customEmbedder.getConfig();
    expect(config.model_name).toBe("test-model");
    expect(config.revision).toBe("test-revision");
    expect(config.dtype).toBe("fp32");
    expect(config.cache_dir).toBe("/tmp/cache");
    expect(config.local_files_only).toBe(true);
    expect(config.progress_callback).toBe(progressCallback);
  });

  it("should generate embeddings with correct dimensions", async () => {
    const texts = ["Hello world", "Test text"];
    const embeddings = await embedder.generate(texts);

    // Verify we got the correct number of embeddings
    expect(embeddings.length).toBe(texts.length);

    // Verify each embedding has the correct dimension (384 for MiniLM-L6-v2)
    embeddings.forEach((embedding) => {
      expect(embedding.length).toBe(384);
    });

    // Verify embeddings are different (this works with our mock implementation)
    const [embedding1, embedding2] = embeddings;
    expect(embedding1).not.toEqual(embedding2);
  });

  it("should handle empty text array", async () => {
    const embeddings = await embedder.generate([]);
    expect(embeddings).toEqual([]);
  });

  it("should handle single text string", async () => {
    const embeddings = await embedder.generate("Single text");
    expect(embeddings.length).toBe(2); // Mock returns 2 embeddings
  });

  it("should reuse pipeline instance on multiple calls", async () => {
    const texts1 = ["First text"];
    const texts2 = ["Second text"];

    await embedder.generate(texts1);
    await embedder.generate(texts2);

    // Pipeline should be created only once
    const { pipeline } = await import("@huggingface/transformers");
    expect(pipeline).toHaveBeenCalledTimes(1);
  });

  it("should return correct config", () => {
    const embedder = new DefaultEmbeddingFunction({
      modelName: "test-model",
      revision: "v1.0",
      dtype: "fp16",
      cacheDir: "/cache",
      localFilesOnly: false,
    });

    const config = embedder.getConfig();
    expect(config).toEqual({
      model_name: "test-model",
      revision: "v1.0",
      dtype: "fp16",
      cache_dir: "/cache",
      local_files_only: false,
      progress_callback: undefined,
    });
  });

  it("should return config in snake_case format", () => {
    const embedder = new DefaultEmbeddingFunction({
      modelName: "test-model",
      revision: "v1.0",
      dtype: "fp16",
      cacheDir: "/cache",
      localFilesOnly: false,
    });

    const config = embedder.getConfig();

    // Verify snake_case keys exist
    expect(config).toHaveProperty("model_name");
    expect(config).toHaveProperty("cache_dir");
    expect(config).toHaveProperty("local_files_only");
    expect(config).toHaveProperty("progress_callback");

    // Verify values are correct
    expect(config.model_name).toBe("test-model");
    expect(config.cache_dir).toBe("/cache");
    expect(config.local_files_only).toBe(false);
  });

  it("should build instance from snake_case config", () => {
    const snakeCaseConfig = {
      model_name: "custom-model",
      revision: "v2.0",
      dtype: "fp32",
      cache_dir: "/custom/cache",
      local_files_only: true,
    };

    const embedder = DefaultEmbeddingFunction.buildFromConfig(snakeCaseConfig);

    expect(embedder).toBeInstanceOf(DefaultEmbeddingFunction);
    expect(embedder.name).toBe("default-embed");

    // Verify config is correctly converted
    const config = embedder.getConfig();
    expect(config.model_name).toBe("custom-model");
    expect(config.revision).toBe("v2.0");
    expect(config.dtype).toBe("fp32");
    expect(config.cache_dir).toBe("/custom/cache");
    expect(config.local_files_only).toBe(true);
  });

  it("should maintain consistency in round-trip conversion", () => {
    const originalConfig: DefaultEmbeddingFunctionConfig = {
      modelName: "round-trip-model",
      revision: "v1.5",
      dtype: "q8",
      cacheDir: "/round/trip/cache",
      localFilesOnly: true,
    };

    const embedder1 = new DefaultEmbeddingFunction(originalConfig);
    const snakeConfig = embedder1.getConfig();
    const embedder2 = DefaultEmbeddingFunction.buildFromConfig(snakeConfig);
    const finalConfig = embedder2.getConfig();

    // Verify configs match after round-trip
    expect(finalConfig).toEqual(snakeConfig);
    expect(finalConfig.model_name).toBe("round-trip-model");
    expect(finalConfig.revision).toBe("v1.5");
    expect(finalConfig.dtype).toBe("q8");
    expect(finalConfig.cache_dir).toBe("/round/trip/cache");
    expect(finalConfig.local_files_only).toBe(true);
  });

  it("should build instance with default values from empty config", () => {
    const embedder = DefaultEmbeddingFunction.buildFromConfig({});

    expect(embedder).toBeInstanceOf(DefaultEmbeddingFunction);
    expect(embedder.name).toBe("default-embed");

    const config = embedder.getConfig();
    expect(config.model_name).toBe("Xenova/all-MiniLM-L6-v2");
    expect(config.revision).toBeUndefined();
    expect(config.dtype).toBeUndefined();
  });

  it("should dispose pipeline correctly", async () => {
    // Generate embeddings to create pipeline
    await embedder.generate(["test"]);

    // Mock dispose function
    const mockDispose = vi.fn().mockResolvedValue(undefined);
    const { pipeline } = await import("@huggingface/transformers");
    const pipelineInstance = await pipeline("feature-extraction", "test-model");
    pipelineInstance.dispose = mockDispose;

    // Create new embedder and set its pipe
    const newEmbedder = new DefaultEmbeddingFunction();
    (newEmbedder as any).pipe = pipelineInstance;

    await newEmbedder.dispose();

    expect(mockDispose).toHaveBeenCalledTimes(1);
    expect((newEmbedder as any).pipe).toBeNull();
  });

  it("should handle dispose when pipe is null", async () => {
    const embedder = new DefaultEmbeddingFunction();
    // Should not throw when pipe is null
    await expect(embedder.dispose()).resolves.not.toThrow();
  });

  it("should handle dispose when pipe has no dispose method", async () => {
    const embedder = new DefaultEmbeddingFunction();
    // Set a pipe without dispose method
    (embedder as any).pipe = { someMethod: vi.fn() };

    // Should not throw
    await expect(embedder.dispose()).resolves.not.toThrow();
    expect((embedder as any).pipe).toBeNull();
  });
});
