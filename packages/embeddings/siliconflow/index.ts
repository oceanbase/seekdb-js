import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb";
import { OpenAIEmbeddingFunction, OpenAIEmbeddingConfig } from "@seekdb/openai";

// Known SiliconFlow embedding model dimensions
// Source: https://docs.siliconflow.cn/en/api-reference/embeddings/create-embeddings
const SILICONFLOW_MODEL_DIMENSIONS: Record<string, number> = {
  "BAAI/bge-large-zh-v1.5": 1024,
  "BAAI/bge-large-en-v1.5": 1024,
  "netease-youdao/bce-embedding-base_v1": 768,
  "BAAI/bge-m3": 1024,
  "Pro/BAAI/bge-m3": 1024,
  // Qwen models support variable dimensions, default values listed below
  "Qwen/Qwen3-Embedding-8B": 4096, // default, supports [64,128,256,512,768,1024,1536,2048,2560,4096]
  "Qwen/Qwen3-Embedding-4B": 2560, // default, supports [64,128,256,512,768,1024,1536,2048,2560]
  "Qwen/Qwen3-Embedding-0.6B": 1024, // default, supports [64,128,256,512,768,1024]
};

export interface SiliconFlowEmbeddingConfig extends Omit<
  OpenAIEmbeddingConfig,
  "organizationId"
> {
  /**
   * Defaults to process.env['SILICONFLOW_API_KEY'].
   */
  apiKey?: string;
  /**
   * Defaults to 'SILICONFLOW_API_KEY'.
   */
  apiKeyEnvVar?: string;
  /**
   * Model name for SiliconFlow embeddings. Defaults to "BAAI/bge-large-zh-v1.5".
   */
  modelName?: string;
  /**
   * Embedding dimensions.
   */
  dimensions?: number;
}

const embeddingFunctionName = "siliconflow";
const baseURL = "https://api.siliconflow.com/v1";

export class SiliconFlowEmbeddingFunction
  extends OpenAIEmbeddingFunction
  implements EmbeddingFunction
{
  readonly name: string = embeddingFunctionName;

  constructor(config: SiliconFlowEmbeddingConfig = {}) {
    super({
      ...config,
      apiKeyEnvVar: config?.apiKeyEnvVar || "SILICONFLOW_API_KEY",
      modelName: config?.modelName || "BAAI/bge-large-zh-v1.5",
      dimensions: config?.dimensions,
      organizationId: undefined,
      baseURL: config?.baseURL || baseURL,
    });
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
    return SILICONFLOW_MODEL_DIMENSIONS[this.modelName] || 1024;
  }

  /**
   * Get model dimensions dictionary.
   */
  static getModelDimensions(): Record<string, number> {
    return { ...SILICONFLOW_MODEL_DIMENSIONS };
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

  getConfig(): SiliconFlowEmbeddingConfig {
    const { organization_id, ...restConfig } = super.getConfig();
    return restConfig;
  }

  static buildFromConfig(
    config: EmbeddingConfig
  ): SiliconFlowEmbeddingFunction {
    return new SiliconFlowEmbeddingFunction({
      modelName: config.model_name,
      apiKey: config.api_key,
      apiKeyEnvVar: config.api_key_env_var,
      dimensions: config.dimensions,
      baseURL: config.base_url,
    });
  }
}

// Register at the bottom
registerEmbeddingFunction(embeddingFunctionName, SiliconFlowEmbeddingFunction);
