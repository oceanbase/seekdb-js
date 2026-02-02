import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb";
import { OpenAIEmbeddingFunction, OpenAIEmbeddingConfig } from "@seekdb/openai";

// Known Tencent Hunyuan embedding model dimensions
// Source: https://cloud.tencent.com/document/product/1729/111007
// Note: The embedding interface currently only supports input and model parameters.
// Model is fixed as hunyuan-embedding, dimensions is fixed at 1024.
const TENCENT_HUNYUAN_MODEL_DIMENSIONS: Record<string, number> = {
  "hunyuan-embedding": 1024,
};

export interface TencentHunyuanEmbeddingConfig extends Omit<
  OpenAIEmbeddingConfig,
  "organizationId"
> {
  /**
   * Defaults to process.env['HUNYUAN_API_KEY'].
   */
  apiKey?: string;
  /**
   * Defaults to 'HUNYUAN_API_KEY'.
   */
  apiKeyEnvVar?: string;
  /**
   * Model name for Tencent Hunyuan embeddings. Defaults to "hunyuan-embedding".
   */
  modelName?: string;
  /**
   * Embedding dimensions.
   */
  dimensions?: number;
}

const embeddingFunctionName = "tencent-hunyuan";
const baseURL = "https://api.hunyuan.cloud.tencent.com/v1";

export class TencentHunyuanEmbeddingFunction
  extends OpenAIEmbeddingFunction
  implements EmbeddingFunction
{
  readonly name: string = embeddingFunctionName;

  constructor(config: TencentHunyuanEmbeddingConfig = {}) {
    super({
      ...config,
      apiKeyEnvVar: config?.apiKeyEnvVar || "HUNYUAN_API_KEY",
      modelName: config?.modelName || "hunyuan-embedding",
      dimensions: config?.dimensions,
      organizationId: undefined,
      baseURL: config?.baseURL || baseURL,
    });
  }

  /**
   * Get the dimension of embeddings produced by this function.
   * Dimensions are fixed at 1024 for Tencent Hunyuan.
   */
  get dimension(): number {
    return 1024;
  }

  /**
   * Get model dimensions dictionary.
   */
  static getModelDimensions(): Record<string, number> {
    return { ...TENCENT_HUNYUAN_MODEL_DIMENSIONS };
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

  getConfig(): TencentHunyuanEmbeddingConfig {
    const { organization_id, ...restConfig } = super.getConfig();
    return restConfig;
  }

  static buildFromConfig(
    config: EmbeddingConfig
  ): TencentHunyuanEmbeddingFunction {
    if (!config.api_key_env_var) {
      throw new Error(
        "Building tencent hunyuan embedding function from config: api_key_env_var is required in config."
      );
    }
    return new TencentHunyuanEmbeddingFunction({
      modelName: config.model_name,
      apiKeyEnvVar: config.api_key_env_var,
      dimensions: config.dimensions,
      baseURL: config.base_url,
    });
  }
}

// Register at the bottom
registerEmbeddingFunction(
  embeddingFunctionName,
  TencentHunyuanEmbeddingFunction
);
