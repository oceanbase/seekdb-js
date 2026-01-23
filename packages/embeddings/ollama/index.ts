// https://github.com/ollama/ollama-js?tab=readme-ov-file
// https://docs.ollama.com/api/openai-compatibility
// todo: 是否直接support openai兼容？

import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb";

const embeddingFunctionName = "ollama";

// Check if running in browser environment
const isBrowser = (): boolean =>
  typeof globalThis !== "undefined" &&
  typeof (globalThis as any).window !== "undefined";


export interface OllamaConfig extends EmbeddingConfig {
  /**
   * Defaults to 'https://ollama.com'.
   */
  url?: string;
  /**
   * Defaults to 'all-minilm'.
   */
  modelName?: string;
}

export class OllamaEmbeddingFunction implements EmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  private readonly url: string;
  private readonly modelName: string;
  private client: any = undefined;

  constructor(config: OllamaConfig = {}) {
    this.url = config.url || "https://ollama.com";
    this.modelName = config.modelName || "all-minilm";
  }

  private async importClient() {
    if (this.client) return;

    // Dynamic import for Ollama client
    try {
      // Try browser version first if in browser environment
      if (isBrowser()) {
        const { Ollama } = await import("ollama/browser");
        this.client = new Ollama({ host: this.url });
      } else {
        const { Ollama } = await import("ollama");
        this.client = new Ollama({ host: this.url });
      }
    } catch (error) {
      throw new Error(
        `Failed to import Ollama client: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async generate(texts: string[]): Promise<number[][]> {
    await this.importClient();
    if (!this.client) {
      throw new Error("Failed to instantiate Ollama client");
    }
    const response = await this.client.embed({
      model: this.modelName,
      input: texts,
    });
    return response.embeddings;
  }

  getConfig(): any {
    return {
      url: this.url,
      model_name: this.modelName,
    };
  }

  static buildFromConfig(config: any): OllamaEmbeddingFunction {
    return new OllamaEmbeddingFunction({
      url: config.url,
      modelName: config.model_name,
    });
  }
}

registerEmbeddingFunction(embeddingFunctionName, OllamaEmbeddingFunction);
