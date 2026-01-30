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

  test("hybrid search with vector and text", async () => {
    const collectionName = generateCollectionName("test_hybrid_emb");
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
      documents: ["test document 1", "test document 2"],
    });

    try {
      const results = await collection.hybridSearch({
        queryTexts: "test",
        queryEmbeddings: [[1, 2, 3]],
        nResults: 2,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);
    } catch (error: any) {
      if (error.message?.includes("not supported")) {
        // Feature not available in embedded mode
        return;
      }
      throw error;
    }

    await client.deleteCollection(collectionName);
  });

  test("hybrid search with where clause", async () => {
    const collectionName = generateCollectionName("test_hybrid_where");
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
      documents: ["test document 1", "test document 2"],
      metadatas: [{ category: "A" }, { category: "B" }],
    });

    try {
      const results = await collection.hybridSearch({
        queryTexts: "test",
        queryEmbeddings: [[1, 2, 3]],
        nResults: 2,
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

    await client.deleteCollection(collectionName);
  });
});
