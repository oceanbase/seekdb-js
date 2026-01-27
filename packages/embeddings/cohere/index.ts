import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb";
import { CohereClient } from "cohere-ai";

const embeddingFunctionName = "cohere";

// Known Cohere embedding model dimensions
// Source: https://docs.cohere.com/docs/cohere-embed
const COHERE_MODEL_DIMENSIONS: Record<string, number> = {
  "embed-v4.0": 1536,
  "embed-english-v3.0": 1024,
  "embed-multilingual-v3.0": 1024,
  "embed-english-light-v3.0": 384,
  "embed-multilingual-light-v3.0": 384,
  "embed-english-v2.0": 4096,
  "embed-multilingual-v2.0": 768,
  "embed-english-light-v2.0": 1024,
  "embed-multilingual-light-v2.0": 384,
};

export type CohereEmbedInputType =
  | "search_document"
  | "search_query"
  | "classification"
  | "clustering"
  | "image";

export type CohereEmbedTruncate = "NONE" | "START" | "END";

export type CohereEmbedEmbeddingType =
  | "float"
  | "int8"
  | "uint8"
  | "binary"
  | "ubinary";

export interface CohereConfig extends EmbeddingConfig {
  /**
   * Defaults to process.env['COHERE_API_KEY'].
   */
  apiKey?: string;
  /**
   * Defaults to 'COHERE_API_KEY'.
   */
  apiKeyEnvVar?: string;
  /**
   * Defaults to 'embed-english-v3.0'.
   */
  modelName?: string;
  image?: boolean;
  inputType?: CohereEmbedInputType;
  truncate?: CohereEmbedTruncate;
  embeddingType?: CohereEmbedEmbeddingType;
}

export class CohereEmbeddingFunction implements EmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  private readonly client: CohereClient;
  private readonly apiKeyEnvVar: string;
  private readonly modelName: string;
  private readonly inputType: CohereEmbedInputType | undefined;
  private readonly truncate: CohereEmbedTruncate | undefined;
  private readonly embeddingType: CohereEmbedEmbeddingType | undefined;
  private readonly image: boolean;

  constructor(config: CohereConfig = {}) {
    this.apiKeyEnvVar = config.apiKeyEnvVar || "COHERE_API_KEY";
    this.modelName = config.modelName || "embed-english-v3.0";
    this.inputType = config.inputType || "search_document";
    this.truncate = config.truncate;
    this.embeddingType = config.embeddingType;
    this.image = config.image || false;

    const apiKey = config.apiKey || process.env[this.apiKeyEnvVar];

    if (!apiKey) {
      throw new Error(
        `Cohere API key is required. Please provide it in the constructor or set the environment variable ${this.apiKeyEnvVar}.`,
      );
    }

    this.client = new CohereClient({ token: apiKey });
  }

  async generate(texts: string[]): Promise<number[][]> {
    if (this.image && texts.length > 1) {
      throw new Error("Cohere embedding supports one image at a time");
    }

    if (!this.image && texts.length > 96) {
      throw new Error(
        "Cohere embedding supports a maximum of 96 text inputs at a time",
      );
    }

    const response = await this.client.embed({
      model: this.modelName,
      inputType: this.image ? "image" : this.inputType,
      truncate: this.truncate,
      embeddingTypes: this.embeddingType ? [this.embeddingType] : undefined,
      images: this.image ? texts : undefined,
      texts: !this.image ? texts : undefined,
    });

    const embeddings = response.embeddings;
    if (Array.isArray(embeddings)) {
      return embeddings;
    } else if (
      this.embeddingType &&
      embeddings[this.embeddingType] &&
      Array.isArray(embeddings[this.embeddingType])
    ) {
      return embeddings[this.embeddingType] as number[][];
    } else if (embeddings["float"] && Array.isArray(embeddings["float"])) {
      return embeddings["float"];
    }
    throw new Error("Failed to generate embeddings");
  }

  /**
   * Get the dimension of embeddings produced by this function.
   */
  get dimension(): number {
    // For unknown models, return a default dimension
    // In a real fallback scenario, we would call the API, but since this is a sync property
    // we return the default and the actual determination happens during generate() call
    return COHERE_MODEL_DIMENSIONS[this.modelName] || 1024;
  }

  /**
   * Get model dimensions dictionary.
   */
  static getModelDimensions(): Record<string, number> {
    return { ...COHERE_MODEL_DIMENSIONS };
  }

  getConfig(): any {
    return {
      model_name: this.modelName,
      api_key_env_var: this.apiKeyEnvVar,
      input_type: this.inputType,
      truncate: this.truncate,
      embedding_type: this.embeddingType,
      image: this.image,
    };
  }

  static buildFromConfig(config: any): CohereEmbeddingFunction {
    return new CohereEmbeddingFunction({
      modelName: config.model_name,
      apiKeyEnvVar: config.api_key_env_var,
      inputType: config.input_type,
      truncate: config.truncate,
      embeddingType: config.embedding_type,
      image: config.image,
    });
  }
}

registerEmbeddingFunction(embeddingFunctionName, CohereEmbeddingFunction);
