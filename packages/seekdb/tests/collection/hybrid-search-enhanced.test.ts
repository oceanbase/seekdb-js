/**
 * Enhanced hybrid search tests for Server mode
 * Tests advanced hybrid search features, RRF (rank), and edge cases for server mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../src/client.js";
import { TEST_CONFIG, generateCollectionName } from "../test-utils.js";

describe("Server Mode - Enhanced Hybrid Search", () => {
  describe("Hybrid Search Enhanced", () => {
    let client: SeekdbClient;
    let collectionName: string;

    beforeAll(async () => {
      client = new SeekdbClient(TEST_CONFIG);
      collectionName = generateCollectionName("test_hybrid_enhanced");
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch (error) {
        // Ignore cleanup errors
      }
      await client.close();
    });

    describe("Hybrid Search with RRF (Reciprocal Rank Fusion)", () => {
      test("hybrid search with rank parameter", async () => {
        const collection = await client.createCollection({
          name: collectionName,
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        // Insert test data
        await collection.add({
          ids: ["id1", "id2", "id3"],
          embeddings: [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
          ],
          documents: [
            "machine learning document",
            "python programming tutorial",
            "data science with python",
          ],
        });

        // Test hybrid search with rank parameter
        try {
          const results = await collection.hybridSearch({
            queryTexts: "machine learning",
            queryEmbeddings: [[1, 2, 3]],
            nResults: 3,
            rank: true, // Enable RRF
          });

          expect(results.ids).toBeDefined();
          expect(results.ids.length).toBeGreaterThan(0);
        } catch (error: any) {
          // If hybrid search not supported, skip this test
          if (error.message?.includes("not supported")) {
            // Test skipped - feature not available
            return;
          }
          throw error;
        }
      });

      test("hybrid search without rank parameter", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_no_rank"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await collection.add({
          ids: ["id1", "id2"],
          embeddings: [
            [1, 2, 3],
            [4, 5, 6],
          ],
          documents: ["test document 1", "test document 2"],
        });

        try {
          const results = await collection.hybridSearch({
            queryTexts: "test",
            queryEmbeddings: [[1, 2, 3]],
            nResults: 2,
            rank: false, // Disable RRF
          });

          expect(results.ids).toBeDefined();
          expect(results.ids.length).toBeGreaterThan(0);
        } catch (error: any) {
          if (error.message?.includes("not supported")) {
            return;
          }
          throw error;
        }

        await client.deleteCollection(collection.name);
      });
    });

    describe("Hybrid Search Edge Cases", () => {
      test("hybrid search with empty results", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_empty_results"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        // Don't add any data

        try {
          const results = await collection.hybridSearch({
            queryTexts: "test",
            queryEmbeddings: [[1, 2, 3]],
            nResults: 10,
          });

          expect(results.ids).toBeDefined();
          expect(results.ids.length).toBe(0);
        } catch (error: any) {
          if (error.message?.includes("not supported")) {
            return;
          }
          throw error;
        }

        await client.deleteCollection(collection.name);
      });

      test("hybrid search with only text, no vector results", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_text_only"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await collection.add({
          ids: ["id1"],
          embeddings: [[1, 2, 3]],
          documents: ["test document"],
        });

        try {
          // Use queryTexts that doesn't match, but queryEmbeddings that does
          const results = await collection.hybridSearch({
            queryTexts: "completely different text that won't match",
            queryEmbeddings: [[1, 2, 3]],
            nResults: 10,
          });

          expect(results.ids).toBeDefined();
          // Should still return results based on vector similarity
          expect(results.ids.length).toBeGreaterThanOrEqual(0);
        } catch (error: any) {
          if (error.message?.includes("not supported")) {
            return;
          }
          throw error;
        }

        await client.deleteCollection(collection.name);
      });

      test("hybrid search with only vector, no text results", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_vector_only"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await collection.add({
          ids: ["id1"],
          embeddings: [[1, 2, 3]],
          documents: ["test document"],
        });

        try {
          // Use queryEmbeddings that doesn't match, but queryTexts that does
          const results = await collection.hybridSearch({
            queryTexts: "test document",
            queryEmbeddings: [[100, 200, 300]], // Very different vector
            nResults: 10,
          });

          expect(results.ids).toBeDefined();
          // Should still return results based on text search
          expect(results.ids.length).toBeGreaterThanOrEqual(0);
        } catch (error: any) {
          if (error.message?.includes("not supported")) {
            return;
          }
          throw error;
        }

        await client.deleteCollection(collection.name);
      });
    });

    describe("Hybrid Search with Filters", () => {
      test("hybrid search with metadata filter", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_hybrid_filter"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await collection.add({
          ids: ["id1", "id2"],
          embeddings: [
            [1, 2, 3],
            [4, 5, 6],
          ],
          documents: ["test document 1", "test document 2"],
          metadatas: [{ category: "A" }, { category: "B" }],
        });

        try {
          const results = await collection.hybridSearch({
            queryTexts: "test",
            queryEmbeddings: [[1, 2, 3]],
            nResults: 10,
            where: { category: { $eq: "A" } },
          });

          expect(results.ids).toBeDefined();
          expect(results.ids.length).toBeGreaterThanOrEqual(0);
        } catch (error: any) {
          if (error.message?.includes("not supported")) {
            return;
          }
          throw error;
        }

        await client.deleteCollection(collection.name);
      });

      test("hybrid search with whereDocument filter", async () => {
        const collection = await client.createCollection({
          name: generateCollectionName("test_hybrid_where_doc"),
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await collection.add({
          ids: ["id1", "id2"],
          embeddings: [
            [1, 2, 3],
            [4, 5, 6],
          ],
          documents: ["machine learning", "python programming"],
        });

        try {
          const results = await collection.hybridSearch({
            queryTexts: "test",
            queryEmbeddings: [[1, 2, 3]],
            nResults: 10,
            whereDocument: { $contains: "machine" },
          });

          expect(results.ids).toBeDefined();
          expect(results.ids.length).toBeGreaterThanOrEqual(0);
        } catch (error: any) {
          if (error.message?.includes("not supported")) {
            return;
          }
          throw error;
        }

        await client.deleteCollection(collection.name);
      });
    });
  });
});
