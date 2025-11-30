import {
  IEmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb-node-sdk";
import { pipeline, env } from "@huggingface/transformers";

// Set environment variable for HF mirror if needed
env.remoteHost = process.env.HF_ENDPOINT || "https://hf-mirror.com";

export type DType =
  | "auto"
  | "fp32"
  | "fp16"
  | "q8"
  | "int8"
  | "uint8"
  | "q4"
  | "bnb4"
  | "q4f16";

const embeddingFunctionName = "embedding-default";
export interface DefaultEmbeddingFunctionConfig extends EmbeddingConfig {
  modelName?: string;
  revision?: string;
  dtype?: DType;
  cache_dir?: string;
  local_files_only?: boolean;
  progress_callback?: (data: any) => void;
}

export class DefaultEmbeddingFunction implements IEmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  private modelName: string;
  private pipe: any = null;

  // Configuration properties
  private revision?: string;
  private dtype?: DType;
  private cache_dir?: string;
  private local_files_only?: boolean;
  private progress_callback?: (data: any) => void;

  constructor(config: DefaultEmbeddingFunctionConfig = {}) {
    this.modelName = config.modelName || "Xenova/all-MiniLM-L6-v2";
    this.revision = config.revision;
    this.dtype = config.dtype;
    this.cache_dir = config.cache_dir;
    this.local_files_only = config.local_files_only;
    this.progress_callback = config.progress_callback;
  }

  async generate(texts: string[]): Promise<number[][]> {
    if (!this.pipe) {
      this.pipe = await pipeline("feature-extraction", this.modelName, {
        revision: this.revision,
        dtype: this.dtype,
        cache_dir: this.cache_dir,
        local_files_only: this.local_files_only,
        progress_callback: this.progress_callback,
      });
    }
    const inputs = Array.isArray(texts) ? texts : [texts];
    if (inputs.length === 0) return [];
    const output = await this.pipe(inputs, {
      pooling: "mean",
      normalize: true,
    });
    return output.tolist();
  }

  getConfig(): DefaultEmbeddingFunctionConfig {
    return {
      modelName: this.modelName,
      revision: this.revision,
      dtype: this.dtype,
      cache_dir: this.cache_dir,
      local_files_only: this.local_files_only,
      progress_callback: this.progress_callback,
    };
  }

  async dispose(): Promise<void> {
    if (this.pipe && typeof this.pipe.dispose === "function") {
      await this.pipe.dispose();
    }
    this.pipe = null;
  }
}

// Register at the bottom
registerEmbeddingFunction(embeddingFunctionName, DefaultEmbeddingFunction);
