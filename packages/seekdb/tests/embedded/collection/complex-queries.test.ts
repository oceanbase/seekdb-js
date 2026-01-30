/**
 * Complex query scenarios tests for Embedded mode
 * Tests advanced query features, filters, and edge cases for embedded mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { generateCollectionName } from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("complex-queries.test.ts");

describe("Embedded Mode - Complex Query Scenarios", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("complex-queries.test.ts");
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

  describe("Complex Metadata Filters", () => {
    test("query with nested metadata filter", async () => {
      const collectionName = generateCollectionName("test_nested_filter");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1", "id2"],
        embeddings: [
          [1, 2, 3],
          [4, 5, 6],
        ],
        metadatas: [
          { nested: { key: "value1" } },
          { nested: { key: "value2" } },
        ],
      });

      const results = await collection.query({
        queryEmbeddings: [[1, 2, 3]],
        where: { "nested.key": { $eq: "value1" } },
        nResults: 10,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids[0].length).toBeGreaterThan(0);

      await client.deleteCollection(collectionName);
    });
  });

  describe("Query with Multiple Query Vectors", () => {
    test("query with multiple query vectors", async () => {
      const collectionName = generateCollectionName("test_multi_query");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1", "id2"],
        embeddings: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      });

      const results = await collection.query({
        queryEmbeddings: [
          [1, 2, 3],
          [4, 5, 6],
        ],
        nResults: 2,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(2);

      await client.deleteCollection(collectionName);
    });
  });
});
