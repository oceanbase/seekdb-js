/**
 * Test utilities for seekdb tests
 * Provides common configuration and helper functions
 */

import type { EmbeddingFunction, EmbeddingConfig } from "../src/types.js";

/**
 * Get test configuration based on test mode
 */
function getTestConfig() {
  const baseConfig = {
    host: process.env.SERVER_HOST || "127.0.0.1",
    port: parseInt(process.env.SERVER_PORT || "2881"),
    user: process.env.SERVER_USER || "root",
    password: process.env.SERVER_PASSWORD || "",
    database: process.env.SERVER_DATABASE || "test",
  };

  return baseConfig;
}

// Test configuration from environment variables
export const TEST_CONFIG = getTestConfig();
export const TEST_CONFIG_OB = { ...TEST_CONFIG, tenant: process.env.SERVER_TENANT || "sys" };

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
      Array.from({ length: dimension }, () => Math.random()),
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
    // Generate mock embeddings based on dimension in config or default 3
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

