import { pipeline } from '@xenova/transformers';
import type { EmbeddingFunction, EmbeddingDocuments } from './types.js';

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const DIMENSION = 384;

export function DefaultEmbeddingFunction(): EmbeddingFunction {
  let model: any = null;

  const ensureModel = async () => {
    if (!model) {
      model = await pipeline('feature-extraction', MODEL_NAME);
    }
    return model;
  };

  const embeddingFn: EmbeddingFunction = async (input: EmbeddingDocuments): Promise<number[][]> => {
    const currentModel = await ensureModel();
    const texts = Array.isArray(input) ? input : [input];
    
    if (texts.length === 0) {
      return [];
    }

    const embeddings: number[][] = [];
    for (const text of texts) {
      const output = await currentModel(text, { pooling: 'mean', normalize: true });
      embeddings.push(Array.from(output.data));
    }

    return embeddings;
  };

  Object.defineProperty(embeddingFn, 'name', { 
    value: 'DefaultEmbeddingFunction',
    configurable: true 
  });

  Object.defineProperty(embeddingFn, 'dimension', { 
    value: DIMENSION,
    writable: false,
    enumerable: true
  });

  return embeddingFn;
}

let defaultEmbeddingFunction: EmbeddingFunction | null = null;

export function getDefaultEmbeddingFunction(): EmbeddingFunction {
  if (!defaultEmbeddingFunction) {
    defaultEmbeddingFunction = DefaultEmbeddingFunction();
  }
  return defaultEmbeddingFunction;
}

