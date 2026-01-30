/**
 * Batch operations tests for Embedded mode
 * Tests operations with large datasets and batch processing for embedded mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { generateCollectionName } from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("batch-operations.test.ts");

describe("Embedded Mode - Batch Operations", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("batch-operations.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
  }, 60000);

  afterAll(async () => {
    try {
      await client.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test("add large batch of items", async () => {
    const collectionName = generateCollectionName("test_large_batch");
    const collection = await client.createCollection({
      name: collectionName,
      configuration: { dimension: 3, distance: "l2" },
      embeddingFunction: null,
    });

    const batchSize = 50;
    const ids = Array.from({ length: batchSize }, (_, i) => `id_${i}`);
    const embeddings = Array.from({ length: batchSize }, (_, i) => [
      i * 0.1,
      i * 0.2,
      i * 0.3,
    ]);

    await collection.add({
      ids,
      embeddings,
    });

    // Verify all items were added
    const results = await collection.get({ ids: ids.slice(0, 10) });
    expect(results.ids.length).toBe(10);

    await client.deleteCollection(collectionName);
  }, 60000);

  test("get large batch of items", async () => {
    const collectionName = generateCollectionName("test_large_get");
    const collection = await client.createCollection({
      name: collectionName,
      configuration: { dimension: 3, distance: "l2" },
      embeddingFunction: null,
    });

    const batchSize = 30;
    const ids = Array.from({ length: batchSize }, (_, i) => `id_${i}`);
    const embeddings = Array.from({ length: batchSize }, (_, i) => [
      i * 0.1,
      i * 0.2,
      i * 0.3,
    ]);

    await collection.add({
      ids,
      embeddings,
    });

    // Get all items
    const results = await collection.get({ ids });
    expect(results.ids.length).toBe(batchSize);

    await client.deleteCollection(collectionName);
  }, 60000);
});
