import { Config } from "ollama";
import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb";

const embeddingFunctionName = "ollama";

// Known Ollama embedding model dimensions
// Source: https://docs.ollama.com/capabilities/embeddings
const OLLAMA_MODEL_DIMENSIONS: Record<string, number> = {
  "nomic-embed-text": 768,
  "all-minilm": 384,
};

// Check if running in browser environment
const isBrowser = (): boolean =>
  typeof globalThis !== "undefined" &&
  typeof (globalThis as any).window !== "undefined";

export interface OllamaConfig extends EmbeddingConfig {
  /**
   * Defaults to 'http://localhost:11434/v1', you can use other url if you want to use a remote ollama server.
   */
  url?: string;
  /**
   * Defaults to 'nomic-embed-text'.
   */
  modelName?: string;
  /**
   * Defaults to 'OLLAMA_API_KEY'.
   */
  apiKeyEnv?: string;
}

export class OllamaEmbeddingFunction implements EmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  private readonly url: string;
  private readonly modelName: string;
  private readonly apiKeyEnv: string;
  private client: any = undefined;

  constructor(config: OllamaConfig = {}) {
    this.url = config.url || "http://localhost:11434/v1";
    this.modelName = config.modelName || "nomic-embed-text";
    this.apiKeyEnv = config.apiKeyEnv || "OLLAMA_API_KEY";
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
        const apiKey = process.env[this.apiKeyEnv];
        const clientProps: Config = { host: this.url };
        if (apiKey) {
          clientProps.headers = {
            Authorization: "Bearer " + apiKey,
          };
        }
        this.client = new Ollama(clientProps);
      }
    } catch (error) {
      throw new Error(
        `Failed to import Ollama client: ${error instanceof Error ? error.message : String(error)}`
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

  /**
   * Get the dimension of embeddings produced by this function.
   */
  get dimension(): number {
    // For unknown models, return a default dimension
    // In a real fallback scenario, we would call the API, but since this is a sync property
    // we return the default and the actual determination happens during generate() call
    return OLLAMA_MODEL_DIMENSIONS[this.modelName] || 768;
  }

  /**
   * Get model dimensions dictionary.
   */
  static getModelDimensions(): Record<string, number> {
    return { ...OLLAMA_MODEL_DIMENSIONS };
  }

  getConfig(): any {
    return {
      url: this.url,
      model_name: this.modelName,
      api_key_env: this.apiKeyEnv,
    };
  }

  static buildFromConfig(config: any): OllamaEmbeddingFunction {
    return new OllamaEmbeddingFunction({
      url: config.url,
      modelName: config.model_name,
      apiKeyEnv: config.api_key_env,
    });
  }
}

registerEmbeddingFunction(embeddingFunctionName, OllamaEmbeddingFunction);
