import {
  IEmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb-node-sdk";

export interface OpenAIEmbeddingConfig extends EmbeddingConfig {
  apiKey: string;
  modelName?: string;
}

const embeddingFunctionName = "openai";

export class OpenAIEmbeddingFunction implements IEmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  private apiKey: string;
  private modelName: string;

  constructor(config: OpenAIEmbeddingConfig) {
    const openaiConfig = config as OpenAIEmbeddingConfig;
    if (!openaiConfig?.apiKey) {
      throw new Error("OpenAI API Key is required");
    }
    this.apiKey = openaiConfig.apiKey;
    this.modelName = openaiConfig.modelName || "text-embedding-3-small";
  }

  async generate(texts: string[]): Promise<number[][]> {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.modelName, input: texts }),
    });

    if (!resp.ok) throw new Error(`OpenAI API Error: ${resp.statusText}`);
    const data = (await resp.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => d.embedding);
  }

  getConfig(): OpenAIEmbeddingConfig {
    return {
      apiKey: this.apiKey,
      modelName: this.modelName,
    };
  }
}

// Register at the bottom
registerEmbeddingFunction(embeddingFunctionName, OpenAIEmbeddingFunction);
