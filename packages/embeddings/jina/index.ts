import { EmbeddingFunction, registerEmbeddingFunction } from "seekdb";
import { toSnake } from "@seekdb/common";

const name = "jina";

export interface JinaConfig {
  /**
   * Defaults to 'JINA_API_KEY'
   */
  apiKeyEnvVar?: string;
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
}

export interface JinaArgs extends JinaConfig {
  /**
   * Defaults to process.env['JINA_API_KEY'].
   */
  apiKey?: string;
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

const url = "https://api.jina.ai/v1/embeddings";

export class JinaEmbeddingFunction implements EmbeddingFunction {
  public readonly name = name;
  public readonly url = url;
  private readonly apiKeyEnvVar: string;
  private readonly modelName: string;
  private readonly headers: { [key: string]: string };
  private readonly task: string | undefined;
  private readonly lateChunking: boolean | undefined;
  private readonly truncate: boolean | undefined;
  private readonly dimensions: number | undefined;
  private readonly embeddingType: string | undefined;
  private readonly normalized: boolean | undefined;

  constructor(args: Partial<JinaArgs> = {}) {
    this.modelName = args.modelName || "jina-clip-v2";
    this.apiKeyEnvVar = args.apiKeyEnvVar || "JINA_API_KEY";
    this.task = args.task;
    this.lateChunking = args.lateChunking;
    this.truncate = args.truncate;
    this.dimensions = args.dimensions;
    this.normalized = args.normalized;
    this.embeddingType = args.embeddingType;

    const apiKey = args.apiKey || process.env[this.apiKeyEnvVar];

    if (!apiKey) {
      throw new Error(
        `Jina AI API key is required. Please provide it in the constructor or set the environment variable ${this.apiKeyEnvVar}.`,
      );
    }

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
      apiKeyEnvVar: this.apiKeyEnvVar,
      modelName: this.modelName,
      task: this.task,
      lateChunking: this.lateChunking,
      truncate: this.truncate,
      dimensions: this.dimensions,
      embeddingType: this.embeddingType,
      normalized: this.normalized,
    };
  }
}

registerEmbeddingFunction(name, JinaEmbeddingFunction);
