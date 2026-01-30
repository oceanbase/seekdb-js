import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
  SeekdbValueError,
} from "seekdb";
import { pipeline } from "@huggingface/transformers";

const embeddingFunctionName = "sentence-transformer";

export interface SentenceTransformerConfig extends EmbeddingConfig {
  /**
   * Defaults to 'Xenova/all-MiniLM-L6-v2'.
   */
  modelName?: string;
  device?: string;
  normalizeEmbeddings?: boolean;
  kwargs?: Record<string, any>;
}

export class SentenceTransformerEmbeddingFunction implements EmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  private readonly modelName: string;
  private readonly device: string;
  private readonly normalizeEmbeddings: boolean;
  private readonly kwargs: Record<string, any>;
  private pipelinePromise: Promise<any> | null = null;
  private pipeline: any = null;

  constructor(config: SentenceTransformerConfig = {}) {
    this.modelName = config.modelName || "Xenova/all-MiniLM-L6-v2";
    this.device = config.device || "cpu";
    this.normalizeEmbeddings = config.normalizeEmbeddings || false;
    this.kwargs = config.kwargs || {};

    // Validate kwargs are JSON-serializable
    for (const [key, value] of Object.entries(this.kwargs)) {
      if (typeof value === "function" || typeof value === "symbol") {
        throw new SeekdbValueError(
          `Keyword argument '${key}' has a value of type '${typeof value}', which is not supported. Only JSON-serializable values are allowed.`
        );
      }
    }
  }

  private async getPipeline(): Promise<any> {
    if (this.pipeline) {
      return this.pipeline;
    }

    if (!this.pipelinePromise) {
      // Resolve model name: if it doesn't contain a '/', prefix with 'Xenova/'
      let resolvedModelName = this.modelName;
      if (!resolvedModelName.includes("/")) {
        resolvedModelName = `Xenova/${resolvedModelName}`;
      }

      this.pipelinePromise = pipeline("feature-extraction", resolvedModelName, {
        device: this.device as any,
        ...this.kwargs,
      } as any).catch((error) => {
        // Reset pipelinePromise on error to allow retry on next call
        this.pipelinePromise = null;
        throw error;
      });
    }

    this.pipeline = await this.pipelinePromise;
    return this.pipeline;
  }

  async generate(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    const pipe = await this.getPipeline();

    // Process all texts in batch
    const output = await pipe(texts, {
      pooling: "mean",
      normalize: this.normalizeEmbeddings,
    });

    // Convert tensor output to JavaScript array
    return output.tolist();
  }

  getConfig(): any {
    return {
      model_name: this.modelName,
      device: this.device,
      normalize_embeddings: this.normalizeEmbeddings,
      kwargs: this.kwargs,
    };
  }

  static buildFromConfig(config: any): SentenceTransformerEmbeddingFunction {
    if (!config) throw new SeekdbValueError("config is required");
    return new SentenceTransformerEmbeddingFunction({
      modelName: config.model_name,
      device: config.device,
      normalizeEmbeddings: config.normalize_embeddings,
      kwargs: config.kwargs || {},
    });
  }

  async dispose(): Promise<void> {
    // To avoid race conditions, we capture the promise and then nullify the instance properties
    const promiseToDispose = this.pipelinePromise;
    this.pipeline = null;
    this.pipelinePromise = null;

    if (!promiseToDispose) return;

    try {
      const pipeline = await promiseToDispose;
      if (pipeline && typeof pipeline.dispose === "function") {
        await pipeline.dispose();
      }
    } catch {
      // If the pipeline promise fails, there's nothing to dispose
    }
  }
}

registerEmbeddingFunction(
  embeddingFunctionName,
  SentenceTransformerEmbeddingFunction
);
