import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb";
import { OpenAIEmbeddingFunction, OpenAIEmbeddingConfig } from "@seekdb/openai";

// Known Qwen embedding model dimensions
// Source: Qwen/DashScope documentation
const QWEN_MODEL_DIMENSIONS: Record<string, number> = {
  "text-embedding-v1": 1536,
  "text-embedding-v2": 1536,
  "text-embedding-v3": 1024, // default and can be changed via dimensions parameter
  "text-embedding-v4": 1024, // default and can be changed via dimensions parameter
};

export interface QwenEmbeddingConfig extends Omit<
  OpenAIEmbeddingConfig,
  "organizationId"
> {
  /**
   * Defaults to 'text-embedding-v4'.
   */
  modelName?: string;
  /**
   * Defaults to process.env['DASHSCOPE_API_KEY'].
   */
  apiKey?: string;
  /**
   * Defaults to 'DASHSCOPE_API_KEY'.
   */
  apiKeyEnvVar?: string;
  /**
   * Defaults to 1024.
   */
  dimensions?: number;
  /**
   * Defaults to 'cn'.
   */
  region?: "cn" | "intl";
}

const embeddingFunctionName = "qwen";
const baseURLs = {
  cn: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  intl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
};

export class QwenEmbeddingFunction
  extends OpenAIEmbeddingFunction
  implements EmbeddingFunction
{
  readonly name: string = embeddingFunctionName;
  private readonly region?: "cn" | "intl";

  constructor(config: QwenEmbeddingConfig = {}) {
    super({
      ...config,
      apiKeyEnvVar: config?.apiKeyEnvVar || "DASHSCOPE_API_KEY",
      modelName: config?.modelName || "text-embedding-v4",
      dimensions: config?.dimensions || 1024,
      organizationId: undefined,
      baseURL: baseURLs[config?.region || "cn"],
    });
    this.region = config?.region || "cn";
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
    return QWEN_MODEL_DIMENSIONS[this.modelName] || 1536;
  }

  /**
   * Get model dimensions dictionary.
   */
  static getModelDimensions(): Record<string, number> {
    return { ...QWEN_MODEL_DIMENSIONS };
  }

  async generate(texts: string[]): Promise<number[][]> {
    const resp = await this.client.embeddings.create({
      input: texts,
      model: this.modelName,
      dimensions: this.dimensions,
      encoding_format: "float",
    });

    return resp.data.map((d) => d.embedding);
  }
  getConfig(): QwenEmbeddingConfig {
    const { organization_id, ...restConfig } = super.getConfig();
    return { ...restConfig, region: this.region };
  }

  static buildFromConfig(config: EmbeddingConfig): QwenEmbeddingFunction {
    if (!config.api_key_env_var) {
      throw new Error(
        "Building Qwen embedding function from config: api_key_env_var is required in config."
      );
    }
    return new QwenEmbeddingFunction({
      modelName: config.model_name,
      apiKeyEnvVar: config.api_key_env_var,
      dimensions: config.dimensions,
      region: config.region,
    });
  }
}

// Register at the bottom
registerEmbeddingFunction(embeddingFunctionName, QwenEmbeddingFunction);
