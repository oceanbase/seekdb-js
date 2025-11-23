/**
 * Test utilities for SeekDB Node SDK tests
 * Provides common configuration and helper functions
 */

// Test configuration from environment variables
export const TEST_CONFIG = {
  host: process.env.SERVER_HOST || '127.0.0.1',
  port: parseInt(process.env.SERVER_PORT || '2881'),
  user: process.env.SERVER_USER || 'root',
  password: process.env.SERVER_PASSWORD || '',
  // SeekDB 单机版不使用租户，设为空字符串
  // 如果要测试 OceanBase，可以设置环境变量 SERVER_TENANT=sys
  tenant: process.env.SERVER_TENANT || '',
  database: process.env.SERVER_DATABASE || 'test',
};

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
  Object.defineProperty(fn, 'name', { 
    value: 'test-embedding', 
    configurable: true 
  });
  return fn;
}

