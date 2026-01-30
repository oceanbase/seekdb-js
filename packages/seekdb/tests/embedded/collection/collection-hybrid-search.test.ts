/**
 * Collection hybrid search tests - testing collection.hybridSearch() interface for Embedded mode
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { Collection } from "../../../src/collection.js";
import { generateCollectionName } from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("collection-hybrid-search.test.ts");

describe("Embedded Mode - Collection Hybrid Search Operations", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("collection-hybrid-search.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  describe("Embedded Mode Hybrid Search", () => {
    let collection: Collection;
    let collectionName: string;

    beforeAll(async () => {
      collectionName = generateCollectionName("test_hybrid_search");
      collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      // Insert test data
      await collection.add({
        ids: ["h1", "h2", "h3", "h4", "h5"],
        embeddings: [
          [1.0, 2.0, 3.0],
          [2.0, 3.0, 4.0],
          [1.1, 2.1, 3.1],
          [2.1, 3.1, 4.1],
          [1.2, 2.2, 3.2],
        ],
        documents: [
          "Machine learning is a subset of AI",
          "Python is used in data science",
          "Deep learning for neural networks",
          "Data science with Python",
          "AI and neural networks introduction",
        ],
        metadatas: [
          { category: "AI", score: 95 },
          { category: "Programming", score: 88 },
          { category: "AI", score: 92 },
          { category: "Data Science", score: 90 },
          { category: "AI", score: 85 },
        ],
      });
    }, 60000);

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test("hybrid search with vector and text", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.hybridSearch({
        queryEmbeddings: queryVector,
        queryTexts: "machine learning",
        nResults: 3,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);
      expect(results.ids[0].length).toBeGreaterThan(0);
    }, 60000);

    test("hybrid search with where clause", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.hybridSearch({
        queryEmbeddings: queryVector,
        queryTexts: "AI",
        nResults: 5,
        where: { category: { $eq: "AI" } },
      });

      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);
      expect(results.ids[0].length).toBeGreaterThan(0);
    }, 60000);
  });
});
