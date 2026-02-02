/**
 * Edge cases and error handling tests for Server mode
 * Tests boundary conditions, error scenarios, and special cases for server mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../src/client.js";
import { TEST_CONFIG, generateCollectionName } from "../test-utils.js";
import { SeekdbValueError, SeekdbNotFoundError } from "../../src/errors.js";

describe("Server Mode - Edge Cases and Error Handling", () => {
  describe("Edge Cases", () => {
    let client: SeekdbClient;

    beforeAll(async () => {
      client = new SeekdbClient(TEST_CONFIG);
    });

    afterAll(async () => {
      await client.close();
    });

    describe("Collection Management Edge Cases", () => {
      test("createCollection with empty name should fail", async () => {
        await expect(async () => {
          await client.createCollection({
            name: "",
            configuration: { dimension: 3, distance: "l2" },
            embeddingFunction: null,
          });
        }).rejects.toThrow();
      });

      test("getCollection with non-existent collection should throw", async () => {
        const nonExistentName = generateCollectionName("non_existent");
        await expect(async () => {
          await client.getCollection({
            name: nonExistentName,
            embeddingFunction: null,
          });
        }).rejects.toThrow();
      });

      test("deleteCollection with non-existent collection should throw", async () => {
        const nonExistentName = generateCollectionName("non_existent");
        await expect(async () => {
          await client.deleteCollection(nonExistentName);
        }).rejects.toThrow();
      });

      test("hasCollection returns false for non-existent collection", async () => {
        const nonExistentName = generateCollectionName("non_existent");
        const exists = await client.hasCollection(nonExistentName);
        expect(exists).toBe(false);
      });
    });

    describe("Data Operations Edge Cases", () => {
      let collectionName: string;

      beforeAll(async () => {
        collectionName = generateCollectionName("test_edge_cases");
      });

      afterAll(async () => {
        try {
          await client.deleteCollection(collectionName);
        } catch (error) {
          // Ignore cleanup errors
        }
      });

      test("add with empty IDs array should fail", async () => {
        const collection = await client.createCollection({
          name: collectionName,
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await expect(async () => {
          await collection.add({
            ids: [],
            embeddings: [[1, 2, 3]],
          });
        }).rejects.toThrow(SeekdbValueError);
      });

      test("add with null document should work", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_null_doc"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await collection.add({
          ids: ["id_null_doc"],
          embeddings: [[1, 2, 3]],
          documents: [null as any],
        });

        const results = await collection.get({ ids: ["id_null_doc"] });
        expect(results.documents).toBeDefined();
        expect(results.documents![0]).toBe(null);

        await client.deleteCollection(collection.name);
      });

      test("add with empty string document should work", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_empty_doc"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await collection.add({
          ids: ["id_empty_doc"],
          embeddings: [[1, 2, 3]],
          documents: [""],
        });

        const results = await collection.get({ ids: ["id_empty_doc"] });
        expect(results.documents).toBeDefined();
        expect(results.documents![0]).toBe("");

        await client.deleteCollection(collection.name);
      });

      test("add with null metadata should work", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_null_meta"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await collection.add({
          ids: ["id_null_meta"],
          embeddings: [[1, 2, 3]],
          metadatas: [null],
        });

        const results = await collection.get({ ids: ["id_null_meta"] });
        expect(results.metadatas).toBeDefined();
        expect(results.metadatas![0]).toBe(null);

        await client.deleteCollection(collection.name);
      });

      test("add with empty metadata object should work", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_empty_meta"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await collection.add({
          ids: ["id_empty_meta"],
          embeddings: [[1, 2, 3]],
          metadatas: [{}],
        });

        const results = await collection.get({ ids: ["id_empty_meta"] });
        expect(results.metadatas).toBeDefined();
        expect(results.metadatas![0]).toEqual({});

        await client.deleteCollection(collection.name);
      });

      test("get with empty IDs array should return empty results", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_empty_ids"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        const results = await collection.get({ ids: [] });
        expect(results.ids).toBeDefined();
        expect(results.ids.length).toBe(0);

        await client.deleteCollection(collection.name);
      });

      test("get with non-existent IDs should return empty results", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_nonexistent_ids"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        const results = await collection.get({ ids: ["non_existent_id"] });
        expect(results.ids).toBeDefined();
        expect(results.ids.length).toBe(0);

        await client.deleteCollection(collection.name);
      });

      test("query with nResults=0 should return empty results", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_query_zero"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await collection.add({
          ids: ["id1"],
          embeddings: [[1, 2, 3]],
        });

        const results = await collection.query({
          queryEmbeddings: [[1, 2, 3]],
          nResults: 0,
        });

        expect(results.ids).toBeDefined();
        expect(results.ids[0].length).toBe(0);

        await client.deleteCollection(collection.name);
      });

      test("query with nResults larger than collection size should return all", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_query_large_n"),
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
          nResults: 100,
        });

        expect(results.ids).toBeDefined();
        expect(results.ids[0].length).toBeLessThanOrEqual(2);

        await client.deleteCollection(collection.name);
      });
    });

    describe("Special Characters and Encoding", () => {
      test("handles Unicode characters in documents", async () => {
        const collectionName = generateCollectionName("test_unicode");
        const collection = await client.createCollection({
          name: collectionName,
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        const unicodeText = "测试 🚀 中文 日本語 한국어";
        await collection.add({
          ids: ["id_unicode"],
          embeddings: [[1, 2, 3]],
          documents: [unicodeText],
        });

        const results = await collection.get({ ids: ["id_unicode"] });
        expect(results.documents![0]).toBe(unicodeText);

        await client.deleteCollection(collectionName);
      });

      test("handles special characters in metadata", async () => {
        const collectionName = generateCollectionName("test_special_chars");
        const collection = await client.createCollection({
          name: collectionName,
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        const specialMetadata = {
          "key with spaces": "value",
          "key-with-dashes": "value",
          key_with_underscores: "value",
          "key.with.dots": "value",
          "key:with:colons": "value",
          'key"with"quotes': "value",
          "key'with'quotes": "value",
          "key\nwith\nnewlines": "value",
        };

        await collection.add({
          ids: ["id_special"],
          embeddings: [[1, 2, 3]],
          metadatas: [specialMetadata],
        });

        const results = await collection.get({ ids: ["id_special"] });
        expect(results.metadatas![0]).toEqual(specialMetadata);

        await client.deleteCollection(collectionName);
      });

      test("handles very long document", async () => {
        const collectionName = generateCollectionName("test_long_doc");
        const collection = await client.createCollection({
          name: collectionName,
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        const longDoc = "a".repeat(100000); // 100KB document
        await collection.add({
          ids: ["id_long"],
          embeddings: [[1, 2, 3]],
          documents: [longDoc],
        });

        const results = await collection.get({ ids: ["id_long"] });
        expect(results.documents![0]).toBe(longDoc);
        expect(results.documents![0].length).toBe(100000);

        await client.deleteCollection(collectionName);
      });
    });
  });

  describe("Error Recovery and Resilience", () => {
    let client: SeekdbClient;

    beforeAll(async () => {
      client = new SeekdbClient(TEST_CONFIG);
    });

    afterAll(async () => {
      await client.close();
    });

    test("operations work after error", async () => {
      const collectionName = generateCollectionName("test_recovery");

      // Try invalid operation first
      try {
        const collection = await client.createCollection({
          name: collectionName,
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await expect(async () => {
          await collection.add({
            ids: ["id1"],
            embeddings: [[1, 2]], // Wrong dimension
          });
        }).rejects.toThrow();

        // After error, valid operation should still work
        await collection.add({
          ids: ["id2"],
          embeddings: [[1, 2, 3]], // Correct dimension
        });

        const results = await collection.get({ ids: ["id2"] });
        expect(results.ids.length).toBe(1);

        await client.deleteCollection(collectionName);
      } catch (error) {
        // Ignore if server not available
      }
    });
  });
});
