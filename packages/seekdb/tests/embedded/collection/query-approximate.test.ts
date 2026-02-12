/**
 * Query approximate parameter tests for Embedded mode
 * Tests the approximate parameter in query operations for embedded mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { generateCollectionName } from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("query-approximate.test.ts");

describe("Embedded Mode - Query Approximate Parameter", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("query-approximate.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
  });

  afterAll(async () => {
    try {
      await client.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Approximate Query", () => {
    test("query with approximate=true (default)", async () => {
      const collectionName = generateCollectionName("test_approximate");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1", "id2", "id3"],
        embeddings: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      });

      const results = await collection.query({
        queryEmbeddings: [[1, 2, 3]],
        nResults: 3,
        approximate: true,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids[0].length).toBeGreaterThan(0);
      expect(results.distances).toBeDefined();

      await client.deleteCollection(collectionName);
    });

    test("query with approximate=false", async () => {
      const collectionName = generateCollectionName("test_approximate_false");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1", "id2", "id3"],
        embeddings: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      });

      const results = await collection.query({
        queryEmbeddings: [[1, 2, 3]],
        nResults: 3,
        approximate: false,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids[0].length).toBeGreaterThan(0);
      expect(results.distances).toBeDefined();

      await client.deleteCollection(collection.name);
    });

    test("query without approximate parameter (defaults to true)", async () => {
      const collectionName = generateCollectionName("test_approximate_default");
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
        queryEmbeddings: [[1, 2, 3]],
        nResults: 2,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids[0].length).toBeGreaterThan(0);

      await client.deleteCollection(collection.name);
    });
  });
});
