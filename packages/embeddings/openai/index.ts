import OpenAI from "openai";
import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb";

// Known OpenAI embedding model dimensions
// Source: https://platform.openai.com/docs/guides/embeddings
const OPENAI_MODEL_DIMENSIONS: Record<string, number> = {
  "text-embedding-ada-002": 1536,
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
};

export interface OpenAIEmbeddingConfig extends EmbeddingConfig {
  /**
   * Defaults to 'text-embedding-3-small'.
   */
  modelName?: string;
  /**
   * Defaults to process.env['OPENAI_API_KEY'].
   */
  apiKey?: string;
  /**
   * Defaults to 'OPENAI_API_KEY'.
   */
  apiKeyEnvVar?: string;
  /**
   * Defaults to process.env['OPENAI_ORG_ID'].
   */
  organizationId?: string;
  dimensions?: number;
  baseURL?: string;
}

const embeddingFunctionName = "openai";

export class OpenAIEmbeddingFunction implements EmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  protected apiKey: string;
  protected modelName: string;
  protected dimensions: number | undefined;
  protected organizationId: string | undefined;
  protected client: OpenAI;
  protected apiKeyEnvVar: string;
  protected baseURL: string | undefined;

  constructor(config: OpenAIEmbeddingConfig = {}) {
    this.apiKeyEnvVar = config?.apiKeyEnvVar || "OPENAI_API_KEY";
    this.apiKey = config?.apiKey || process.env[this.apiKeyEnvVar] || "";
    if (!this.apiKey) {
      throw new Error(
        `OpenAI API Key is required. Provide it via config.apiKey or set ${this.apiKeyEnvVar} environment variable.`,
      );
    }
    this.modelName = config?.modelName || "text-embedding-3-small";
    this.dimensions = config?.dimensions;
    this.organizationId = config?.organizationId || process.env.OPENAI_ORG_ID;
    this.baseURL = config?.baseURL;

    this.client = new OpenAI({
      apiKey: this.apiKey,
      organization: this.organizationId,
      baseURL: this.baseURL,
    });
  }

  async generate(texts: string[]): Promise<number[][]> {
    const resp = await this.client.embeddings.create({
      input: texts,
      model: this.modelName,
      dimensions: this.dimensions,
    });

    return resp.data.map((d) => d.embedding);
  }

  /**
   * Get the dimension of embeddings produced by this function.
   */
  get dimension(): number {
    // For unknown models, return a default dimension
    // In a real fallback scenario, we would call the API, but since this is a sync property
    // we return the default and the actual determination happens during generate() call
    if (this.dimensions) {
      return this.dimensions;
    }
    return OPENAI_MODEL_DIMENSIONS[this.modelName] || 1536;
  }

  /**
   * Get model dimensions dictionary.
   */
  static getModelDimensions(): Record<string, number> {
    return { ...OPENAI_MODEL_DIMENSIONS };
  }

  getConfig(): OpenAIEmbeddingConfig {
    return {
      api_key: this.apiKey,
      model_name: this.modelName,
      dimensions: this.dimensions,
      organization_id: this.organizationId,
      api_key_env_var: this.apiKeyEnvVar,
      base_url: this.baseURL,
    };
  }

  static buildFromConfig(config: EmbeddingConfig): OpenAIEmbeddingFunction {
    return new OpenAIEmbeddingFunction({
      apiKey: config.api_key,
      modelName: config.model_name,
      dimensions: config.dimensions,
      organizationId: config.organization_id,
      apiKeyEnvVar: config.api_key_env_var,
      baseURL: config.base_url,
    });
  }
}

// Register at the bottom
registerEmbeddingFunction(embeddingFunctionName, OpenAIEmbeddingFunction);
