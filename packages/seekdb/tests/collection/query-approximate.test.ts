/**
 * Query approximate parameter tests for Server mode
 * Tests the approximate parameter in query operations for server mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../src/client.js";
import { TEST_CONFIG, generateCollectionName } from "../test-utils.js";

describe("Server Mode - Query Approximate Parameter", () => {
  describe("Approximate Query", () => {
    let client: SeekdbClient;
    let collectionName: string;

    beforeAll(async () => {
      client = new SeekdbClient(TEST_CONFIG);
      collectionName = generateCollectionName("test_approximate");
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch (error) {
        // Ignore cleanup errors
      }
      await client.close();
    });

    test("query with approximate=true (default)", async () => {
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

      // Query with approximate=true (default)
      const results = await collection.query({
        queryEmbeddings: [[1, 2, 3]],
        nResults: 3,
        approximate: true,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids[0].length).toBeGreaterThan(0);
      expect(results.distances).toBeDefined();
    });

    test("query with approximate=false", async () => {
      const collection = await client.createCollection({
        name: generateCollectionName("test_approximate_false"),
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

      // Query with approximate=false
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
      const collection = await client.createCollection({
        name: generateCollectionName("test_approximate_default"),
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

      // Query without approximate parameter (should default to true)
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
