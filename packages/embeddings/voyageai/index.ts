import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
  SeekdbValueError,
} from "seekdb";
import { VoyageAIClient } from "voyageai";
import { EmbedRequestInputType } from "voyageai/api/index.js";

const embeddingFunctionName = "voyageai";

// Known Voyage AI embedding model dimensions
// Source: https://docs.voyageai.com/docs/embeddings
// Note: Many models support flexible dimensions (256, 512, 1024, 2048)
// Default dimensions are listed below
const VOYAGEAI_MODEL_DIMENSIONS: Record<string, number> = {
  // Latest models (voyage-4 series)
  "voyage-4-large": 1024, // default, supports 256, 512, 1024, 2048
  "voyage-4": 1024, // default, supports 256, 512, 1024, 2048
  "voyage-4-lite": 1024, // default, supports 256, 512, 1024, 2048
  "voyage-code-3": 1024, // default, supports 256, 512, 1024, 2048
  "voyage-finance-2": 1024,
  "voyage-law-2": 1024,
  "voyage-code-2": 1536,
  // Previous generation models
  "voyage-3-large": 1024, // default, supports 256, 512, 1024, 2048
  "voyage-3.5": 1024, // default, supports 256, 512, 1024, 2048
  "voyage-3.5-lite": 1024, // default, supports 256, 512, 1024, 2048
  "voyage-3": 1024,
  "voyage-3-lite": 512,
  "voyage-multilingual-2": 1024,
  // Open models
  "voyage-4-nano": 1024, // default, supports 256, 512, 1024, 2048
};

export interface VoyageAIConfig extends EmbeddingConfig {
  /**
   * Defaults to 'VOYAGE_API_KEY'.
   */
  apiKeyEnvVar?: string;
  /**
   * Defaults to process.env['VOYAGE_API_KEY'].
   */
  apiKey?: string;
  /**
   * Default to 'voyage-4-large'.
   */
  modelName?: string;
  inputType?: EmbedRequestInputType;
  truncation?: boolean;
}

export class VoyageAIEmbeddingFunction implements EmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  private readonly apiKeyEnvVar?: string;
  private readonly modelName: string;
  private readonly inputType?: EmbedRequestInputType;
  private readonly truncation?: boolean;
  private client: VoyageAIClient;

  constructor(config: VoyageAIConfig) {
    this.apiKeyEnvVar = config.apiKeyEnvVar || "VOYAGE_API_KEY";
    this.modelName = config.modelName || "voyage-4-large";
    this.inputType = config.inputType;
    this.truncation = config.truncation;

    const apiKey = config.apiKey || process.env[this.apiKeyEnvVar];

    if (!apiKey) {
      throw new Error(
        `Voyage API key is required. Please provide it in the constructor or set the environment variable ${this.apiKeyEnvVar}.`,
      );
    }

    this.client = new VoyageAIClient({ apiKey });
  }

  async generate(texts: string[]): Promise<number[][]> {
    const response = await this.client.embed({
      input: texts,
      model: this.modelName,
      inputType: this.inputType,
      truncation: this.truncation,
    });

    if (!response.data || !response.data.every((e) => e !== undefined)) {
      throw new Error("Failed to generate VoyageAI embeddings");
    }

    return response.data?.map((e) => e.embedding!);
  }

  /**
   * Get the dimension of embeddings produced by this function.
   */
  get dimension(): number {
    // For unknown models, return a default dimension
    // In a real fallback scenario, we would call the API, but since this is a sync property
    // we return the default and the actual determination happens during generate() call
    return VOYAGEAI_MODEL_DIMENSIONS[this.modelName] || 1024;
  }

  /**
   * Get model dimensions dictionary.
   */
  static getModelDimensions(): Record<string, number> {
    return { ...VOYAGEAI_MODEL_DIMENSIONS };
  }

  getConfig(): any {
    return {
      api_key_env_var: this.apiKeyEnvVar,
      model_name: this.modelName,
      input_type: this.inputType,
      truncation: this.truncation,
    };
  }

  static buildFromConfig(config: EmbeddingConfig): VoyageAIEmbeddingFunction {
    if (!config) throw new SeekdbValueError("config is required");
    return new VoyageAIEmbeddingFunction({
      modelName: config.model_name,
      apiKeyEnvVar: config.api_key_env_var,
      inputType: config.input_type,
      truncation: config.truncation,
    });
  }
}

registerEmbeddingFunction(embeddingFunctionName, VoyageAIEmbeddingFunction);
