/**
 * Collection query tests - testing collection.query() interface for Embedded mode
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { Collection } from "../../../src/collection.js";
import {
  generateCollectionName,
  Simple3DEmbeddingFunction,
} from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("collection-query.test.ts");

describe("Embedded Mode - Collection Query Operations", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("collection-query.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  describe("Embedded Mode Collection Query", () => {
    let collection: Collection;
    let collectionName: string;

    beforeAll(async () => {
      collectionName = generateCollectionName("test_query");
      collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      // Insert test data
      await collection.add({
        ids: ["q1", "q2", "q3", "q4", "q5"],
        embeddings: [
          [1.0, 2.0, 3.0],
          [2.0, 3.0, 4.0],
          [1.1, 2.1, 3.1],
          [2.1, 3.1, 4.1],
          [1.2, 2.2, 3.2],
        ],
        documents: [
          "Machine learning document",
          "Python programming tutorial",
          "Advanced ML algorithms",
          "Data science with Python",
          "Neural networks introduction",
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

    test("basic vector similarity query", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        nResults: 3,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);
      expect(results.ids[0].length).toBeGreaterThan(0);
      expect(results.distances).toBeDefined();
    });

    test("query with where clause", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        nResults: 10,
        where: { category: { $eq: "AI" } },
      });

      expect(results.ids).toBeDefined();
      expect(results.ids[0].length).toBeGreaterThan(0);
      // All results should have category "AI"
      if (results.metadatas && results.metadatas[0]) {
        results.metadatas[0].forEach((meta: any) => {
          expect(meta.category).toBe("AI");
        });
      }
    });

    test("query with include", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        nResults: 3,
        include: ["embeddings", "metadatas", "documents"],
      });

      expect(results.embeddings).toBeDefined();
      expect(results.metadatas).toBeDefined();
      expect(results.documents).toBeDefined();
    });

    test("query with multiple query vectors", async () => {
      const queryVectors = [
        [1.0, 2.0, 3.0],
        [2.0, 3.0, 4.0],
      ];
      const results = await collection.query({
        queryEmbeddings: queryVectors,
        nResults: 2,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(2); // One result set per query vector
      expect(results.ids[0].length).toBeGreaterThan(0);
      expect(results.ids[1].length).toBeGreaterThan(0);
    });

    test("query with queryTexts using embedding function", async () => {
      if (!client) {
        throw new Error(
          "Client is not available - this should not happen if beforeAll succeeded"
        );
      }
      const ef = Simple3DEmbeddingFunction();
      const collectionWithEF = await client.createCollection({
        name: generateCollectionName("test_query_ef"),
        embeddingFunction: ef,
      });

      await collectionWithEF.add({
        ids: ["ef1", "ef2"],
        documents: ["test document 1", "test document 2"],
      });

      const results = await collectionWithEF.query({
        queryTexts: "test document",
        nResults: 2,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids[0].length).toBeGreaterThan(0);

      await client.deleteCollection(collectionWithEF.name);
    }, 60000);
  });
});
