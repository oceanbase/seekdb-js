import { IEmbeddingFunction, registerEmbeddingFunction } from "seekdb-node-sdk";
import { toSnake } from "@seekdb/common";

const name = "jina";

export interface JinaConfig {
  api_key_env_var: string;
  model_name: string;
  task?: string;
  late_chunking?: boolean;
  truncate?: boolean;
  dimensions?: number;
  normalized?: boolean;
  embedding_type?: string;
}

export interface JinaArgs {
  /**
   * Defaults to 'jina-clip-v2'.
   */
  modelName?: string;
  task?: string;
  lateChunking?: boolean;
  truncate?: boolean;
  dimensions?: number;
  normalized?: boolean;
  embeddingType?: string;
  /**
   * Defaults to process.env['JINA_API_KEY'].
   */
  apiKey?: string;
  /**
   * Defaults to 'JINA_API_KEY'
   */
  apiKeyEnvVar?: string;
}

interface JinaRequestBody extends JinaArgs {
  model: string;
  input: string[];
}

export interface JinaEmbeddingsResponse {
  data: {
    embedding: number[];
  }[];
  usage: {
    total_tokens: number;
  };
}

export class JinaEmbeddingFunction implements IEmbeddingFunction {
  public readonly name = name;

  private readonly apiKeyEnvVar: string;
  private readonly modelName: string;
  private readonly url: string;
  private readonly headers: { [key: string]: string };
  private readonly task: string | undefined;
  private readonly lateChunking: boolean | undefined;
  private readonly truncate: boolean | undefined;
  private readonly dimensions: number | undefined;
  private readonly embeddingType: string | undefined;
  private readonly normalized: boolean | undefined;

  constructor(args: Partial<JinaArgs> = {}) {
    const {
      apiKeyEnvVar = "JINA_API_KEY",
      modelName = "jina-clip-v2",
      task,
      lateChunking,
      truncate,
      dimensions,
      normalized,
      embeddingType,
    } = args;

    const apiKey = args.apiKey || process.env[apiKeyEnvVar];

    if (!apiKey) {
      throw new Error(
        `Jina AI API key is required. Please provide it in the constructor or set the environment variable ${apiKeyEnvVar}.`,
      );
    }

    this.modelName = modelName;
    this.apiKeyEnvVar = apiKeyEnvVar;
    this.task = task;
    this.lateChunking = lateChunking;
    this.truncate = truncate;
    this.dimensions = dimensions;
    this.normalized = normalized;
    this.embeddingType = embeddingType;

    this.url = "https://api.jina.ai/v1/embeddings";
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      "Accept-Encoding": "identity",
      "Content-Type": "application/json",
    };
  }

  public async generate(texts: string[]): Promise<number[][]> {
    const body: JinaRequestBody = {
      input: texts,
      model: this.modelName,
      task: this.task,
      lateChunking: this.lateChunking,
      truncate: this.truncate,
      dimensions: this.dimensions,
      normalized: this.normalized,
      embeddingType: this.embeddingType,
    };

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(toSnake(body)),
      });

      const data = (await response.json()) as JinaEmbeddingsResponse;
      if (!data || !data.data) {
        throw new Error("Failed to generate jina embedding data.");
      }
      return data.data.map((result) => result.embedding);
    } catch (error) {
      throw new Error(
        `Error calling Jina AI API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public getConfig(): JinaConfig {
    return {
      api_key_env_var: this.apiKeyEnvVar,
      model_name: this.modelName,
      task: this.task,
      late_chunking: this.lateChunking,
      truncate: this.truncate,
      dimensions: this.dimensions,
      embedding_type: this.embeddingType,
      normalized: this.normalized,
    };
  }
}

registerEmbeddingFunction(name, JinaEmbeddingFunction);
