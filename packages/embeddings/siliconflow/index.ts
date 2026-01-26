import { EmbeddingFunction, registerEmbeddingFunction, EmbeddingConfig } from "seekdb";
import { OpenAIEmbeddingFunction, OpenAIEmbeddingConfig } from "@seekdb/openai";

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
  implements EmbeddingFunction {
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

  static buildFromConfig(config: EmbeddingConfig): SiliconFlowEmbeddingFunction {
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
