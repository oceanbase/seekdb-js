import { EmbeddingFunction, registerEmbeddingFunction, EmbeddingConfig } from "seekdb";
import { OpenAIEmbeddingFunction, OpenAIEmbeddingConfig } from "@seekdb/openai";

export interface HunyuanEmbeddingConfig extends Omit<
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

export class HunyuanEmbeddingFunction
  extends OpenAIEmbeddingFunction
  implements EmbeddingFunction {
  readonly name: string = embeddingFunctionName;

  constructor(config: HunyuanEmbeddingConfig = {}) {
    super({
      ...config,
      apiKeyEnvVar: config?.apiKeyEnvVar || "HUNYUAN_API_KEY",
      modelName: config?.modelName || "hunyuan-embedding",
      dimensions: config?.dimensions,
      organizationId: undefined,
      baseURL: config?.baseURL || baseURL,
    });
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

  getConfig(): HunyuanEmbeddingConfig {
    const { organization_id, ...restConfig } = super.getConfig();
    return restConfig;
  }

  static buildFromConfig(config: EmbeddingConfig): HunyuanEmbeddingFunction {
    return new HunyuanEmbeddingFunction({
      modelName: config.model_name,
      apiKey: config.api_key,
      apiKeyEnvVar: config.api_key_env_var,
      dimensions: config.dimensions,
      baseURL: config.base_url,
    });
  }
}

// Register at the bottom
registerEmbeddingFunction(embeddingFunctionName, HunyuanEmbeddingFunction);
