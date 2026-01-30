/**
 * Collection query tests - testing collection.query() interface for Server mode
 * Supports configuring connection parameters via environment variables
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../src/client.js";
import { Collection } from "../../src/collection.js";
import { TEST_CONFIG, generateCollectionName } from "../test-utils.js";

describe("Collection Query Operations", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    client = new SeekdbClient(TEST_CONFIG);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("Server Mode Collection Query", () => {
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
        ids: ["id1", "id2", "id3", "id4", "id5"],
        embeddings: [
          [1.0, 2.0, 3.0],
          [2.0, 3.0, 4.0],
          [1.1, 2.1, 3.1],
          [2.1, 3.1, 4.1],
          [1.2, 2.2, 3.2],
        ],
        documents: [
          "This is a test document about machine learning",
          "Python programming tutorial for beginners",
          "Advanced machine learning algorithms",
          "Data science with Python",
          "Introduction to neural networks",
        ],
        metadatas: [
          { category: "AI", score: 95, tag: "ml" },
          { category: "Programming", score: 88, tag: "python" },
          { category: "AI", score: 92, tag: "ml" },
          { category: "Data Science", score: 90, tag: "python" },
          { category: "AI", score: 85, tag: "neural" },
        ],
      });
    });

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
    });

    test("query with metadata filter using comparison operators", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { score: { $gte: 90 } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with combined filters", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { category: { $eq: "AI" }, score: { $gte: 90 } },
        whereDocument: { $contains: "machine" },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with document filter using regex", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        whereDocument: { $regex: ".*[Pp]ython.*" },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with $in operator", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { tag: { $in: ["ml", "python"] } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with multiple vectors (returns dict with lists of lists)", async () => {
      const queryVector1 = [1.0, 2.0, 3.0];
      const queryVector2 = [2.0, 3.0, 4.0];
      const queryVector3 = [1.1, 2.1, 3.1];

      const results = await collection.query({
        queryEmbeddings: [queryVector1, queryVector2, queryVector3],
        nResults: 2,
      });

      expect(results).toBeDefined();
      expect(typeof results).toBe("object");
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(3);

      for (let i = 0; i < results.ids.length; i++) {
        expect(results.ids[i].length).toBeGreaterThan(0);
      }
    });

    test("single vector returns dict format", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        nResults: 2,
      });

      expect(results).toBeDefined();
      expect(typeof results).toBe("object");
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(1);
      expect(results.ids[0].length).toBeGreaterThan(0);
    });

    test("query with include parameter", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        include: ["documents", "metadatas"],
        nResults: 3,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();

      if (results.ids[0].length > 0) {
        expect(results.documents).toBeDefined();
        expect(results.metadatas).toBeDefined();
        expect(results.ids[0].length).toBe(results.documents![0].length);
        expect(results.ids[0].length).toBe(results.metadatas![0].length);
      }
    });

    test("query with logical operators ($or)", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: {
          $or: [{ category: { $eq: "AI" } }, { tag: { $eq: "python" } }],
        },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with include parameter to get specific fields", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        include: ["documents", "metadatas", "embeddings"],
        nResults: 3,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();

      if (results.ids[0].length > 0) {
        expect(results.documents).toBeDefined();
        expect(results.metadatas).toBeDefined();
        expect(results.embeddings).toBeDefined();
        expect(results.ids[0].length).toBe(results.documents![0].length);
      }
    });

    test("query with $ne (not equal) operator", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { category: { $ne: "AI" } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      // Verify no results have category="AI"
      if (results.ids[0].length > 0 && results.metadatas) {
        for (const metadata of results.metadatas[0]) {
          if (metadata) {
            expect(metadata.category).not.toBe("AI");
          }
        }
      }
    });

    test("query with $lt (less than) operator", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { score: { $lt: 90 } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      // Verify all results have score < 90
      if (results.ids[0].length > 0 && results.metadatas) {
        for (const metadata of results.metadatas[0]) {
          if (metadata && metadata.score !== undefined) {
            expect(metadata.score).toBeLessThan(90);
          }
        }
      }
    });

    test("query with $lte (less than or equal) operator", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { score: { $lte: 88 } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with $gt (greater than) operator", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { score: { $gt: 90 } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      // Verify all results have score > 90
      if (results.ids[0].length > 0 && results.metadatas) {
        for (const metadata of results.metadatas[0]) {
          if (metadata && metadata.score !== undefined) {
            expect(metadata.score).toBeGreaterThan(90);
          }
        }
      }
    });

    test("query with $nin (not in) operator", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { tag: { $nin: ["ml", "python"] } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      // Verify no results have tag in ["ml", "python"]
      if (results.ids[0].length > 0 && results.metadatas) {
        for (const metadata of results.metadatas[0]) {
          if (metadata && metadata.tag) {
            expect(["ml", "python"]).not.toContain(metadata.tag);
          }
        }
      }
    });

    test("query with $and operator combining multiple conditions", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: {
          $and: [
            { category: { $eq: "AI" } },
            { score: { $gte: 90 } },
            { tag: { $in: ["ml", "neural"] } },
          ],
        },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });
  });
});
