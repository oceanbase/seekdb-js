/**
 * Batch operations tests for Server mode
 * Tests operations with large datasets and batch processing for server mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../src/client.js";
import { TEST_CONFIG, generateCollectionName } from "../test-utils.js";

describe("Server Mode - Batch Operations", () => {
  describe("Batch Operations", () => {
    let client: SeekdbClient;

    beforeAll(async () => {
      client = new SeekdbClient(TEST_CONFIG);
    });

    afterAll(async () => {
      await client.close();
    });

    test("add large batch of items", async () => {
      const collectionName = generateCollectionName("test_large_batch");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      const batchSize = 100;
      const ids = Array.from({ length: batchSize }, (_, i) => `id_${i}`);
      const embeddings = Array.from({ length: batchSize }, (_, i) => [
        i * 0.1,
        i * 0.2,
        i * 0.3,
      ]);
      const documents = Array.from(
        { length: batchSize },
        (_, i) => `Document ${i}`
      );
      const metadatas = Array.from({ length: batchSize }, (_, i) => ({
        index: i,
        batch: "large",
      }));

      await collection.add({
        ids,
        embeddings,
        documents,
        metadatas,
      });

      // Verify all items were added
      const results = await collection.get({ ids: ids.slice(0, 10) });
      expect(results.ids.length).toBe(10);

      // Verify count
      const count = await client.countCollection();
      // Should have at least our batch
      expect(count).toBeGreaterThanOrEqual(1);

      await client.deleteCollection(collectionName);
    }, 60000);

    test("get large batch of items", async () => {
      const collectionName = generateCollectionName("test_large_get");
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

      // Get all items
      const results = await collection.get({ ids });
      expect(results.ids.length).toBe(batchSize);
      expect(results.embeddings).toBeDefined();
      expect(results.embeddings!.length).toBe(batchSize);

      await client.deleteCollection(collectionName);
    }, 60000);

    test("query with large result set", async () => {
      const collectionName = generateCollectionName("test_large_query");
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

      // Query for all results
      const results = await collection.query({
        queryEmbeddings: [[1, 2, 3]],
        nResults: batchSize,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids[0].length).toBeLessThanOrEqual(batchSize);
      expect(results.distances).toBeDefined();
      expect(results.distances![0].length).toBeLessThanOrEqual(batchSize);

      await client.deleteCollection(collectionName);
    }, 60000);

    test("delete large batch of items", async () => {
      const collectionName = generateCollectionName("test_large_delete");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      const batchSize = 40;
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

      // Delete half of them
      const idsToDelete = ids.slice(0, batchSize / 2);
      await collection.delete({ ids: idsToDelete });

      // Verify deleted items are gone
      const results = await collection.get({ ids: idsToDelete });
      expect(results.ids.length).toBe(0);

      // Verify remaining items still exist
      const remainingIds = ids.slice(batchSize / 2);
      const remainingResults = await collection.get({ ids: remainingIds });
      expect(remainingResults.ids.length).toBe(remainingIds.length);

      await client.deleteCollection(collectionName);
    }, 60000);
  });
});
