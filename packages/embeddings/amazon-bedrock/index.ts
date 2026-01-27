import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb";

const embeddingFunctionName = "amazon_bedrock";

// Known Amazon Bedrock embedding model dimensions
// Source: https://docs.aws.amazon.com/bedrock/
const AMAZON_BEDROCK_MODEL_DIMENSIONS: Record<string, number> = {
  "amazon.titan-embed-text-v1": 1536,
  "amazon.titan-embed-text-v2": 1024,
  "amazon.titan-embed-g1-text-02": 1024,
  "amazon.titan-embed-text-v2:0": 1024,
};

const DEFAULT_MODEL_NAME = "amazon.titan-embed-text-v2";

export interface BedrockEmbeddingConfig extends EmbeddingConfig {
  /**
   * Amazon Bedrock API key.
   * To generate an API key, visit:https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-generate.html
   */
  apiKey?: string;
  /**
   * Amazon Bedrock API key environment variable, defaults to 'AMAZON_BEDROCK_API_KEY'.
   * To generate an API key, visit:https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-generate.html
   */
  apiKeyEnv?: string;
  /**
   * AWS region (e.g., "us-east-1").
   */
  region?: string;
  /**
   * Model name (defaults to 'amazon.titan-embed-text-v2').
   * See Amazon Bedrock documentation for all available models.
   */
  modelName?: string;
}

export class BedrockEmbeddingFunction implements EmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  private readonly apiKeyEnv: string;
  private readonly apiKey: string;
  private readonly region: string;
  private readonly modelName: string;

  constructor(config: BedrockEmbeddingConfig) {
    this.apiKeyEnv = config.apiKeyEnv || "AMAZON_BEDROCK_API_KEY";
    this.apiKey = config.apiKey || process.env[this.apiKeyEnv] || "";
    if (!this.apiKey) {
      throw new Error(
        "apiKey is required. Generate one at: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-generate.html"
      );
    }

    if (!config.region) {
      throw new Error("region is required (e.g., 'us-east-1')");
    }

    this.region = config.region;
    this.modelName = config.modelName || DEFAULT_MODEL_NAME;
  }

  /**
   * Get the dimension of embeddings produced by this function.
   */
  get dimension(): number {
    // For unknown models, return a default dimension
    // In a real fallback scenario, we would call the API, but since this is a sync property
    // we return the default and the actual determination happens during generate() call
    return AMAZON_BEDROCK_MODEL_DIMENSIONS[this.modelName] || 1024;
  }

  /**
   * Get model dimensions dictionary.
   */
  static getModelDimensions(): Record<string, number> {
    return { ...AMAZON_BEDROCK_MODEL_DIMENSIONS };
  }

  async generate(texts: string[]): Promise<number[][]> {
    // Handle empty input
    if (!texts || texts.length === 0) {
      return [];
    }

    const allEmbeddings: number[][] = [];
    const url = `https://bedrock-runtime.${this.region}.amazonaws.com/model/${this.modelName}/invoke`;

    // Amazon Bedrock processes one text at a time
    for (const text of texts) {
      const requestBody = {
        inputText: text,
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to generate Bedrock embeddings: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const responseBody = (await response.json()) as {
        embedding?: number[];
      };

      if (!responseBody.embedding || !Array.isArray(responseBody.embedding)) {
        throw new Error(
          `Invalid embedding response from Bedrock: ${JSON.stringify(responseBody)}`
        );
      }

      allEmbeddings.push(responseBody.embedding);
    }

    return allEmbeddings;
  }

  getConfig(): any {
    return {
      api_key: this.apiKey,
      region: this.region,
      model_name: this.modelName,
    };
  }

  static buildFromConfig(config: EmbeddingConfig): BedrockEmbeddingFunction {
    if (!config.api_key || !config.region) {
      throw new Error(
        "api_key and region are required in config. Generate API key at: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-generate.html"
      );
    }

    return new BedrockEmbeddingFunction({
      apiKey: config.api_key,
      region: config.region,
      modelName: config.model_name,
    });
  }
}

registerEmbeddingFunction(embeddingFunctionName, BedrockEmbeddingFunction);
