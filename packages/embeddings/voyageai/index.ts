import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb";
import { VoyageAIClient } from "voyageai";
import { EmbedRequestInputType } from "voyageai/api/index.js";

const embeddingFunctionName = "voyageai";

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

  getConfig(): any {
    return {
      api_key_env_var: this.apiKeyEnvVar,
      model_name: this.modelName,
      input_type: this.inputType,
      truncation: this.truncation,
    };
  }

  static buildFromConfig(config: EmbeddingConfig): VoyageAIEmbeddingFunction {
    return new VoyageAIEmbeddingFunction({
      modelName: config.model_name,
      apiKeyEnvVar: config.api_key_env_var,
      inputType: config.input_type,
      truncation: config.truncation,
    });
  }
}

registerEmbeddingFunction(embeddingFunctionName, VoyageAIEmbeddingFunction);
