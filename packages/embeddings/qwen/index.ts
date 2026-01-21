import { EmbeddingFunction, registerEmbeddingFunction, EmbeddingConfig } from "seekdb";
import { OpenAIEmbeddingFunction, OpenAIEmbeddingConfig } from "@seekdb/openai";

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
  implements EmbeddingFunction {
  readonly name: string = embeddingFunctionName;

  constructor(config: QwenEmbeddingConfig = {}) {
    super({
      ...config,
      apiKeyEnvVar: config?.apiKeyEnvVar || "DASHSCOPE_API_KEY",
      modelName: config?.modelName || "text-embedding-v4",
      dimensions: config?.dimensions || 1024,
      organizationId: undefined,
      baseURL: baseURLs[config?.region || "cn"],
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
  getConfig(): QwenEmbeddingConfig {
    const { organization_id, ...restConfig } = super.getConfig();
    return restConfig;
  }

  static buildFromConfig(config: EmbeddingConfig): QwenEmbeddingFunction {
    return new QwenEmbeddingFunction({
      modelName: config.model_name,
      apiKey: config.api_key,
      apiKeyEnvVar: config.api_key_env_var,
      dimensions: config.dimensions,
      region: config.region,
    });
  }
}

// Register at the bottom
registerEmbeddingFunction(embeddingFunctionName, QwenEmbeddingFunction);
