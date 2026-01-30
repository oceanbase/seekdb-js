import { EmbeddingFunction, registerEmbeddingFunction, EmbeddingConfig } from "seekdb";
import { toSnake } from "@seekdb/common";

const name = "jina";

// Known Jina AI embedding model dimensions
// Source: https://api.jina.ai/scalar#tag/search-foundation-models/POST/v1/embeddings
// Note: Most Jina v2 models have 768 dimensions
const JINA_MODEL_DIMENSIONS: Record<string, number> = {
  "jina-embeddings-v3": 1024,
  "jina-embeddings-v4": 2048,
  "jina-clip-v2": 1024,
  "jina-colbert-v2": 128,
  "jina-embeddings-v2-base-en": 768,
  "jina-embeddings-v2-base-zh": 768,
  "jina-embeddings-v2-base-es": 768,
  "jina-embeddings-v2-base-de": 768,
  "jina-embeddings-v2-base-code": 768,
  "jina-embeddings-v2-base-multilingual": 768,
  "jina-embeddings-v2-small-en": 512,
  "jina-embeddings-v2-small-zh": 512,
  "jina-embeddings-v2-small-es": 512,
  "jina-embeddings-v2-small-de": 512,
  "jina-embeddings-v2-small-code": 512,
  "jina-embeddings-v2-small-multilingual": 512,
};

export interface JinaConfig extends EmbeddingConfig {
  /**
   * Defaults to 'JINA_API_KEY'
   */
  apiKeyEnvVar?: string;
  /**
   * Defaults to 'jina-clip-v2'.
   */
  modelName?: string;
  task?: string;
  lateChunking?: boolean;
  truncate?: boolean;
  dimensions?: number;
  normalized?: boolean;
  embeddingType?: string;
}

export interface JinaArgs extends JinaConfig {
  /**
   * Defaults to process.env['JINA_API_KEY'].
   */
  apiKey?: string;
}

interface JinaRequestBody extends JinaArgs {
  model: string;
  input: string[];
}

export interface JinaEmbeddingsResponse {
  data: {
    embedding: number[];
  }[];
  usage: {
    total_tokens: number;
  };
}

const url = "https://api.jina.ai/v1/embeddings";

export class JinaEmbeddingFunction implements EmbeddingFunction {
  public readonly name = name;
  public readonly url = url;
  private readonly apiKeyEnvVar: string;
  private readonly modelName: string;
  private readonly headers: { [key: string]: string };
  private readonly task: string | undefined;
  private readonly lateChunking: boolean | undefined;
  private readonly truncate: boolean | undefined;
  private readonly dimensions: number | undefined;
  private readonly embeddingType: string | undefined;
  private readonly normalized: boolean | undefined;

  constructor(args: Partial<JinaArgs> = {}) {
    this.modelName = args.modelName || "jina-clip-v2";
    this.apiKeyEnvVar = args.apiKeyEnvVar || "JINA_API_KEY";
    this.task = args.task;
    this.lateChunking = args.lateChunking;
    this.truncate = args.truncate;
    this.dimensions = args.dimensions;
    this.normalized = args.normalized;
    this.embeddingType = args.embeddingType;

    const apiKey = args.apiKey || process.env[this.apiKeyEnvVar];

    if (!apiKey) {
      throw new Error(
        `Jina AI API key is required. Please provide it in the constructor or set the environment variable ${this.apiKeyEnvVar}.`,
      );
    }

    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      "Accept-Encoding": "identity",
      "Content-Type": "application/json",
    };

  }

  /**
   * Get the dimension of embeddings produced by this function.
   */
  get dimension(): number {
    // For unknown models, return a default dimension
    // In a real fallback scenario, we would call the API, but since this is a sync property
    // we return the default and the actual determination happens during generate() call
    return JINA_MODEL_DIMENSIONS[this.modelName] || 1024;
  }

  /**
  * Get model dimensions dictionary.
  */
  static getModelDimensions(): Record<string, number> {
    return { ...JINA_MODEL_DIMENSIONS };
  }

  async generate(texts: string[]): Promise<number[][]> {
    const body: JinaRequestBody = {
      input: texts,
      model: this.modelName,
      task: this.task,
      lateChunking: this.lateChunking,
      truncate: this.truncate,
      dimensions: this.dimensions,
      normalized: this.normalized,
      embeddingType: this.embeddingType,
    };

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(toSnake(body)),
      });

      const data = (await response.json()) as JinaEmbeddingsResponse;
      if (!data || !data.data) {
        throw new Error("Failed to generate jina embedding data.");
      }
      return data.data.map((result) => result.embedding);
    } catch (error) {
      throw new Error(
        `Error calling Jina AI API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getConfig(): any {
    return {
      api_key_env_var: this.apiKeyEnvVar,
      model_name: this.modelName,
      task: this.task,
      late_chunking: this.lateChunking,
      truncate: this.truncate,
      dimensions: this.dimensions,
      embedding_type: this.embeddingType,
      normalized: this.normalized,
    };
  }

  static buildFromConfig(config: any): JinaEmbeddingFunction {
    return new JinaEmbeddingFunction({
      apiKeyEnvVar: config.api_key_env_var,
      modelName: config.model_name,
      task: config.task,
      lateChunking: config.late_chunking,
      truncate: config.truncate,
      dimensions: config.dimensions,
      embeddingType: config.embedding_type,
      normalized: config.normalized,
    });
  }
}

registerEmbeddingFunction(name, JinaEmbeddingFunction);
