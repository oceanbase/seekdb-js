/**
 * Test utilities for seekdb tests
 * Provides common configuration and helper functions
 */

import type { EmbeddingFunction, EmbeddingConfig } from "../src/types.js";
import {
  registerEmbeddingFunction,
  isEmbeddingFunctionRegistered,
} from "../src/embedding-function.js";

/**
 * Get test configuration based on test mode
 */
function getTestConfig() {
  return {
    host: process.env.SEEKDB_HOST || "127.0.0.1",
    port: parseInt(process.env.SEEKDB_PORT || "2881"),
    user: process.env.SEEKDB_USER || "root",
    password: process.env.SEEKDB_PASSWORD || "",
    database: process.env.SEEKDB_DATABASE || "test",
  };
}

// Test configuration from environment variables (same names as examples: SEEKDB_HOST, SEEKDB_PORT, etc.)
export const TEST_CONFIG = getTestConfig();

/**
 * Generate a unique collection name for testing
 */
export function generateCollectionName(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

/**
 * Generate a unique database name for testing
 */
export function generateDatabaseName(prefix: string): string {
  return `${prefix}_${Date.now()}`;
}

/**
 * Create a simple embedding function for testing
 */
export function createTestEmbeddingFunction(dimension: number) {
  const fn = async (input: string | string[]): Promise<number[][]> => {
    const texts = Array.isArray(input) ? input : [input];
    return texts.map(() =>
      Array.from({ length: dimension }, () => Math.random())
    );
  };
  Object.defineProperty(fn, "name", {
    value: "test-embedding",
    configurable: true,
  });
  return fn;
}

/**
 * Simple 3D embedding function for testing
 * Returns deterministic 3-dimensional vectors based on text hash
 */
export function Simple3DEmbeddingFunction(): EmbeddingFunction {
  return {
    name: "test-embedding",
    dimension: 3,
    getConfig: () => ({ dimension: 3 }),
    async generate(input: string | string[]): Promise<number[][]> {
      const texts = Array.isArray(input) ? input : [input];

      const embeddings: number[][] = [];
      for (const doc of texts) {
        // Simple hash-based 3D embedding for testing
        const hashVal = simpleHash(doc) % 1000;
        const embedding = [
          (hashVal % 10) / 10.0,
          (((hashVal / 10) | 0) % 10) / 10.0,
          (((hashVal / 100) | 0) % 10) / 10.0,
        ];
        embeddings.push(embedding);
      }

      return embeddings;
    },
  };
}

/**
 * Simple 128D embedding function for testing
 * Returns deterministic 128-dimensional vectors based on text hash
 */
export function Simple128DEmbeddingFunction(): EmbeddingFunction {
  return {
    name: "test-embedding",
    dimension: 128,
    getConfig: () => ({ dimension: 128 }),
    async generate(input: string | string[]): Promise<number[][]> {
      const texts = Array.isArray(input) ? input : [input];

      const embeddings: number[][] = [];
      for (const doc of texts) {
        // Simple hash-based 128D embedding for testing
        const hashVal = simpleHash(doc);
        const embedding: number[] = [];
        for (let i = 0; i < 128; i++) {
          embedding.push(((hashVal + i) % 100) / 100.0);
        }
        embeddings.push(embedding);
      }

      return embeddings;
    },
  };
}

/**
 * Simple hash function for generating deterministic numbers from strings
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Test default embedding function for testing
 * Manually register a simple default embedding function to avoid module resolution issues with @seekdb/default-embed
 */
export class TestDefaultEmbeddingFunction implements EmbeddingFunction {
  readonly name = "default-embed";

  async generate(texts: string[]): Promise<number[][]> {
    return texts.map(() =>
      Array(384)
        .fill(0)
        .map(() => Math.random())
    );
  }

  getConfig(): EmbeddingConfig {
    return { dimension: 384 };
  }

  static buildFromConfig(): EmbeddingFunction {
    return new TestDefaultEmbeddingFunction();
  }
}

/**
 * Register the test default embedding function
 * Call this function at the top of test files that need the default embedding function
 * This function is idempotent - it will skip registration if already registered
 */
export function registerTestDefaultEmbeddingFunction(): void {
  if (!isEmbeddingFunctionRegistered("default-embed")) {
    registerEmbeddingFunction("default-embed", TestDefaultEmbeddingFunction);
  }
}

/**
 * Mock Embedding Function for testing
 * Supports configurable dimension and custom parameters
 */
export class MockEmbeddingFunction implements EmbeddingFunction {
  readonly name = "mock-embed";
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    if (config.shouldThrow) {
      throw new Error("Config validation failed");
    }
    this.config = config;
  }
  dispose?(): Promise<void> {
    throw new Error("Method not implemented.");
  }
  get dimension(): number {
    return this.config.dimension || 3;
  }

  async generate(texts: string[]): Promise<number[][]> {
    const dim = this.config.dimension || 3;
    return texts.map(() => Array(dim).fill(0.1));
  }

  getConfig(): EmbeddingConfig {
    return this.config;
  }

  static buildFromConfig(config: EmbeddingConfig): EmbeddingFunction {
    return new MockEmbeddingFunction(config);
  }
}
