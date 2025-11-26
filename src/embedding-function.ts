import { pipeline, env } from "@xenova/transformers";
import type { EmbeddingFunction, EmbeddingDocuments } from "./types.js";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const DIMENSION = 384;

export class DefaultEmbeddingFunction implements EmbeddingFunction {
  public readonly modelName: string;
  private readonly _dimension: number;
  private model: any = null;

  constructor(modelName: string = MODEL_NAME, dimension: number = DIMENSION) {
    if (modelName !== MODEL_NAME) {
      throw new Error(
        `Currently only 'Xenova/all-MiniLM-L6-v2' is supported, got '${modelName}'`,
      );
    }
    this.modelName = modelName;
    this._dimension = dimension;

    env.remoteHost = process.env.HF_ENDPOINT || "https://hf-mirror.com";
  }

  get dimension(): number {
    return this._dimension;
  }

  private async ensureModel(): Promise<any> {
    if (!this.model) {
      this.model = await pipeline("feature-extraction", this.modelName);
    }
    return this.model;
  }

  async generate(input: EmbeddingDocuments): Promise<number[][]> {
    const texts = Array.isArray(input) ? input : [input];

    if (texts.length === 0) {
      return [];
    }

    const model = await this.ensureModel();

    const output = await model(texts, {
      pooling: "mean",
      normalize: false,
    });

    return output.tolist();
  }

  async dispose(): Promise<void> {
    if (this.model && typeof this.model.dispose === "function") {
      await this.model.dispose();
    }
    this.model = null;
  }
}

let defaultEmbeddingFunction: DefaultEmbeddingFunction | null = null;
export function getDefaultEmbeddingFunction(): DefaultEmbeddingFunction {
  if (!defaultEmbeddingFunction) {
    defaultEmbeddingFunction = new DefaultEmbeddingFunction();
  }
  return defaultEmbeddingFunction;
}
