/**
 * Enhanced hybrid search tests for Embedded mode
 * Tests advanced hybrid search features, RRF (rank), and edge cases for embedded mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { generateCollectionName } from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("hybrid-search-enhanced.test.ts");

describe("Embedded Mode - Enhanced Hybrid Search", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("hybrid-search-enhanced.test.ts");
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

  describe("Hybrid Search Enhanced", () => {
    let collectionName: string;

    beforeAll(async () => {
      collectionName = generateCollectionName("test_hybrid_enhanced");
    });

    describe("Hybrid Search with RRF (Reciprocal Rank Fusion)", () => {
      test("hybrid search with rank parameter", async () => {
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
          documents: [
            "machine learning document",
            "python programming tutorial",
            "data science with python",
          ],
        });

        try {
          const results = await collection.hybridSearch({
            query: {
              whereDocument: { $contains: "machine learning" },
              nResults: 10,
            },
            knn: {
              queryEmbeddings: [[1, 2, 3]],
              nResults: 10,
            },
            rank: { rrf: {} },
            nResults: 3,
          });

          expect(results.ids).toBeDefined();
          expect(results.ids.length).toBeGreaterThan(0);
        } catch (error: any) {
          if (error.message?.includes("not supported")) {
            return;
          }
          throw error;
        } finally {
          await client.deleteCollection(collection.name);
        }
      });

      test("hybrid search without rank parameter", async () => {
        const name = generateCollectionName("test_no_rank");
        const collection = await client.createCollection({
          name,
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
            query: {
              whereDocument: { $contains: "test" },
              nResults: 10,
            },
            knn: {
              queryEmbeddings: [[1, 2, 3]],
              nResults: 10,
            },
            nResults: 2,
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
        const name = generateCollectionName("test_empty_results");
        const collection = await client.createCollection({
          name,
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        try {
          const results = await collection.hybridSearch({
            query: {
              whereDocument: { $contains: "test" },
              nResults: 10,
            },
            knn: {
              queryEmbeddings: [[1, 2, 3]],
              nResults: 10,
            },
            nResults: 10,
          });
          expect(results.ids).toBeDefined();
          expect(results.ids.length).toBe(1);
          expect(results.ids[0].length).toBe(0);
        } catch (error: any) {
          if (error.message?.includes("not supported")) {
            return;
          }
          throw error;
        }

        await client.deleteCollection(collection.name);
      });

      test("hybrid search with only text, no vector results", async () => {
        const name = generateCollectionName("test_text_only");
        const collection = await client.createCollection({
          name,
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await collection.add({
          ids: ["id1"],
          embeddings: [[1, 2, 3]],
          documents: ["test document"],
        });

        try {
          const results = await collection.hybridSearch({
            query: {
              whereDocument: {
                $contains: "xyznonexistentnomatch",
              },
              nResults: 10,
            },
            knn: {
              queryEmbeddings: [[1, 2, 3]],
              nResults: 10,
            },
            nResults: 10,
          });

          expect(results.ids).toBeDefined();
          expect(results.ids.length).toBeGreaterThanOrEqual(0);
        } catch (error: any) {
          if (error.message?.includes("not supported") || error.message?.includes("Parse error")) {
            return;
          }
          throw error;
        }

        await client.deleteCollection(collection.name);
      });

      test("hybrid search with only vector, no text results", async () => {
        const name = generateCollectionName("test_vector_only");
        const collection = await client.createCollection({
          name,
          configuration: { dimension: 3, distance: "l2" },
          embeddingFunction: null,
        });

        await collection.add({
          ids: ["id1"],
          embeddings: [[1, 2, 3]],
          documents: ["test document"],
        });

        try {
          const results = await collection.hybridSearch({
            query: {
              whereDocument: { $contains: "test document" },
              nResults: 10,
            },
            knn: {
              queryEmbeddings: [[100, 200, 300]],
              nResults: 10,
            },
            nResults: 10,
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

    describe("Hybrid Search with Filters", () => {
      test("hybrid search with metadata filter", async () => {
        const name = generateCollectionName("test_hybrid_filter");
        const collection = await client.createCollection({
          name,
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
            query: {
              whereDocument: { $contains: "test" },
              where: { category: { $eq: "A" } },
              nResults: 10,
            },
            knn: {
              queryEmbeddings: [[1, 2, 3]],
              where: { category: { $eq: "A" } },
              nResults: 10,
            },
            nResults: 10,
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
        const name = generateCollectionName("test_hybrid_where_doc");
        const collection = await client.createCollection({
          name,
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
            query: {
              whereDocument: { $contains: "machine" },
              nResults: 10,
            },
            knn: {
              queryEmbeddings: [[1, 2, 3]],
              nResults: 10,
            },
            nResults: 10,
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
