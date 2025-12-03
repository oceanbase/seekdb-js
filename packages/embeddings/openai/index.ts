import OpenAI from "openai";
import {
  IEmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb-node-sdk";

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

export class OpenAIEmbeddingFunction implements IEmbeddingFunction {
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

  getConfig(): OpenAIEmbeddingConfig {
    return {
      apiKey: this.apiKey,
      modelName: this.modelName,
      dimensions: this.dimensions,
      organizationId: this.organizationId,
      apiKeyEnvVar: this.apiKeyEnvVar,
    };
  }
}

// Register at the bottom
registerEmbeddingFunction(embeddingFunctionName, OpenAIEmbeddingFunction);
