import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb";
import { PredictionServiceClient } from "@google-cloud/aiplatform";

const embeddingFunctionName = "google-vertex";

export interface GoogleVertexEmbeddingConfig extends EmbeddingConfig {
  projectId?: string;
  /**
   * Defaults to 'us-central1'.
   */
  location?: string;
  /**
   * Defaults to 'textembedding-gecko'.
   */
  modelName?: string;
  /**
   * Output dimensionality (optional).
   */
  outputDimensionality?: number;
}

export class GoogleVertexEmbeddingFunction implements EmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  private readonly projectId?: string;
  private readonly location?: string;
  private readonly modelName?: string;
  private client: PredictionServiceClient;

  constructor(config: GoogleVertexEmbeddingConfig) {
    this.projectId = config.projectId;

    if (!this.projectId) {
      throw new Error("projectId is required");
    }

    this.location = config.location || "us-central1";
    this.modelName = config.modelName || "textembedding-gecko";

    this.client = new PredictionServiceClient({
      apiEndpoint: `${this.location}-aiplatform.googleapis.com`,
    });
  }

  async generate(texts: string[]): Promise<number[][]> {
    const endpoint = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.modelName}`;
    const allEmbeddings: number[][] = [];

    // Import google protobuf dynamically
    const { google } = await import("@google-cloud/aiplatform/build/protos/protos.js");

    // Google Vertex AI embedding API processes one text at a time
    for (const text of texts) {
      const instanceFields: any = {
        content: { stringValue: text },
      };

      const instance = google.protobuf.Value.fromObject({
        structValue: {
          fields: instanceFields,
        },
      });

      const request: any = {
        endpoint,
        instances: [instance],
      };

      const [response] = await this.client.predict(request);

      if (!response.predictions || response.predictions.length === 0) {
        throw new Error("Failed to generate Google Vertex embeddings");
      }

      const prediction = response.predictions[0];
      const embeddingsProto = (prediction as any).structValue?.fields?.embeddings;
      const valuesProto = embeddingsProto?.structValue?.fields?.values;
      const embedding = valuesProto?.listValue?.values?.map(
        (v: any) => v.numberValue
      );

      if (!embedding || embedding.length === 0) {
        throw new Error("Invalid embedding response from Google Vertex");
      }

      allEmbeddings.push(embedding);
    }

    return allEmbeddings;
  }

  getConfig(): any {
    return {
      project_id: this.projectId,
      location: this.location,
      model_name: this.modelName,
    };
  }

  static buildFromConfig(
    config: EmbeddingConfig
  ): GoogleVertexEmbeddingFunction {
    if (!config.project_id) {
      throw new Error("Google Cloud project ID is required");
    }
    return new GoogleVertexEmbeddingFunction({
      projectId: config.project_id,
      location: config.location,
      modelName: config.model_name,
    });
  }
}

registerEmbeddingFunction(embeddingFunctionName, GoogleVertexEmbeddingFunction);
