import {
  EmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb";
import { pipeline, env } from "@huggingface/transformers";

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

const embeddingFunctionName = "default-embed";
export interface DefaultEmbeddingFunctionConfig extends EmbeddingConfig {
  /**
   * Defaults to 'Xenova/all-MiniLM-L6-v2'.
   */
  modelName?: string;
  revision?: string;
  dtype?: DType;
  cacheDir?: string;
  localFilesOnly?: boolean;
  progressCallback?: (data: any) => void;
  /**
   * Defaults to 'https://hf-mirror.com'.
   */
  remoteHost?: string;
  /**
   * Defaults to 'cn'.
   */
  region?: "cn" | "intl";
}

const remoteUrls = {
  cn: "https://hf-mirror.com",
  intl: "https://huggingface.co",
};

export class DefaultEmbeddingFunction implements EmbeddingFunction {
  readonly name: string = embeddingFunctionName;
  private modelName: string;
  private pipe: any = null;

  // Configuration properties
  private revision?: string;
  private dtype?: DType;
  private cacheDir?: string;
  private localFilesOnly?: boolean;
  private progressCallback?: (data: any) => void;

  constructor(config: DefaultEmbeddingFunctionConfig = {}) {
    this.modelName = config.modelName || "Xenova/all-MiniLM-L6-v2";
    this.revision = config.revision;
    this.dtype = config.dtype;
    this.cacheDir = config.cacheDir;
    this.localFilesOnly = config.localFilesOnly;
    this.progressCallback = config.progressCallback;
    env.remoteHost =
      config.remoteHost ||
      process.env.HF_ENDPOINT ||
      remoteUrls[config.region || "cn"];
  }

  async generate(texts: string | string[]): Promise<number[][]> {
    if (!this.pipe) {
      this.pipe = await pipeline("feature-extraction", this.modelName, {
        revision: this.revision,
        dtype: this.dtype,
        cache_dir: this.cacheDir,
        local_files_only: this.localFilesOnly,
        progress_callback: this.progressCallback,
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
      model_name: this.modelName,
      revision: this.revision,
      dtype: this.dtype,
      cache_dir: this.cacheDir,
      local_files_only: this.localFilesOnly,
      progress_callback: this.progressCallback,
    };
  }

  static buildFromConfig(config: EmbeddingConfig): DefaultEmbeddingFunction {
    return new DefaultEmbeddingFunction({
      modelName: config.model_name,
      revision: config.revision,
      dtype: config.dtype,
      cacheDir: config.cache_dir,
      localFilesOnly: config.local_files_only,
      progressCallback: config.progress_callback,
    });
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
