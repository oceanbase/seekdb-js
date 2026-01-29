import { describe, it, expect, beforeEach, vi } from "vitest";
import { GoogleVertexEmbeddingFunction } from "./index";

// Mock Google Cloud AI Platform client
vi.mock("@google-cloud/aiplatform", () => {
  const mockPredict = vi.fn().mockResolvedValue([
    {
      predictions: [
        {
          structValue: {
            fields: {
              embeddings: {
                structValue: {
                  fields: {
                    values: {
                      listValue: {
                        values: Array(768)
                          .fill(0)
                          .map((_, i) => ({ numberValue: i / 1000 })),
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
  ]);

  return {
    PredictionServiceClient: vi.fn().mockImplementation(() => ({
      predict: mockPredict,
    })),
    google: {
      protobuf: {
        Value: {
          fromObject: vi.fn((obj) => obj),
        },
      },
      cloud: {
        aiplatform: {
          v1: {},
        },
      },
    },
  };
});

describe("GoogleVertexEmbeddingFunction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw error when projectId is missing", () => {
    expect(() => {
      new GoogleVertexEmbeddingFunction({} as any);
    }).toThrow("Google Cloud project ID is required");
  });

  it("should initialize with default parameters", () => {
    const embedder = new GoogleVertexEmbeddingFunction({
      projectId: "test-project",
    });

    expect(embedder.name).toBe("google-vertex");

    const config = embedder.getConfig();
    expect(config.project_id).toBe("test-project");
    expect(config.location).toBe("us-central1");
    expect(config.model_name).toBe("textembedding-gecko");
    expect(config.api_endpoint).toBe("us-central1-aiplatform.googleapis.com");
  });

  it("should initialize with custom parameters", () => {
    const embedder = new GoogleVertexEmbeddingFunction({
      projectId: "test-project",
      location: "us-central1",
      modelName: "custom-model",
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: 512,
    });

    const config = embedder.getConfig();
    expect(config.project_id).toBe("test-project");
    expect(config.location).toBe("us-central1");
    expect(config.model_name).toBe("custom-model");
    expect(config.task_type).toBe("RETRIEVAL_QUERY");
    expect(config.output_dimensionality).toBe(512);
  });

  it("should generate embeddings", async () => {
    const embedder = new GoogleVertexEmbeddingFunction({
      projectId: "test-project",
    });

    const texts = ["Hello world", "Test text"];
    const embeddings = await embedder.generate(texts);

    expect(embeddings.length).toBe(texts.length);
    embeddings.forEach((embedding) => {
      expect(embedding.length).toBe(768);
    });
  });

  it("should build from config", () => {
    const snakeCaseConfig = {
      project_id: "test-project",
      location: "us-central1",
      model_name: "custom-model",
      task_type: "SEMANTIC_SIMILARITY",
      output_dimensionality: 256,
      api_endpoint: "us-central1-aiplatform.googleapis.com",
    };

    const embedder = GoogleVertexEmbeddingFunction.buildFromConfig(snakeCaseConfig);

    expect(embedder).toBeInstanceOf(GoogleVertexEmbeddingFunction);
    expect(embedder.name).toBe("google-vertex");

    const config = embedder.getConfig();
    expect(config.project_id).toBe("test-project");
    expect(config.location).toBe("us-central1");
    expect(config.model_name).toBe("custom-model");
  });

  it("should throw error when building from config without projectId", () => {
    expect(() => {
      GoogleVertexEmbeddingFunction.buildFromConfig({});
    }).toThrow("Google Cloud project ID is required");
  });
});
