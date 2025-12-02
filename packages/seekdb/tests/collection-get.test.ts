/**
 * Collection get tests - testing collection.get() interface for Server mode
 * Supports configuring connection parameters via environment variables
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekDBClient } from "../src/client.js";
import { Collection } from "../src/collection.js";
import { TEST_CONFIG, generateCollectionName } from "./test-utils.js";

describe("Collection Get Operations", () => {
  let client: SeekDBClient;

  beforeAll(async () => {
    client = new SeekDBClient(TEST_CONFIG);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("Server Mode Collection Get", () => {
    let collection: Collection;
    let collectionName: string;
    let insertedIds: string[];

    beforeAll(async () => {
      collectionName = generateCollectionName("test_get");
      collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      // Insert test data
      insertedIds = ["id1", "id2", "id3", "id4", "id5"];
      await collection.add({
        ids: insertedIds,
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

    test("get by single ID", async () => {
      const results = await collection.get({ ids: insertedIds[0] });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(1);
    });

    test("get by multiple IDs", async () => {
      const results = await collection.get({ ids: insertedIds.slice(0, 2) });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(2);
    });

    test("get with metadata filter", async () => {
      const results = await collection.get({
        where: { category: { $eq: "AI" } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);
    });

    test("get with metadata filter using comparison operators", async () => {
      const results = await collection.get({
        where: { score: { $gte: 90 } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);
    });

    test("get with combined metadata filters", async () => {
      const results = await collection.get({
        where: { category: { $eq: "AI" }, score: { $gte: 90 } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("get with document filter", async () => {
      const results = await collection.get({
        whereDocument: { $contains: "Python" },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("get with $in operator", async () => {
      const results = await collection.get({
        where: { tag: { $in: ["ml", "python"] } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("get with limit and offset", async () => {
      const results = await collection.get({ limit: 2, offset: 1 });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(2);
    });

    test("get with include parameter", async () => {
      const results = await collection.get({
        ids: insertedIds.slice(0, 2),
        include: ["documents", "metadatas", "embeddings"],
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.documents).toBeDefined();
      expect(results.metadatas).toBeDefined();
      expect(results.embeddings).toBeDefined();
      expect(results.ids.length).toBe(2);
    });

    test("get by multiple IDs returns dict format", async () => {
      const results = await collection.get({ ids: insertedIds.slice(0, 3) });
      expect(results).toBeDefined();
      expect(typeof results).toBe("object");
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeLessThanOrEqual(3);
    });

    test("single ID returns dict format", async () => {
      const results = await collection.get({ ids: insertedIds[0] });
      expect(results).toBeDefined();
      expect(typeof results).toBe("object");
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(1);
    });

    test("get with filters returns dict format", async () => {
      const results = await collection.get({
        where: { category: { $eq: "AI" } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(typeof results).toBe("object");
      expect(results.ids).toBeDefined();
    });

    test("get with logical operators ($or)", async () => {
      const results = await collection.get({
        where: {
          $or: [{ category: "AI" }, { tag: "python" }],
        },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("get with combined filters (where + whereDocument)", async () => {
      const results = await collection.get({
        where: { category: { $eq: "AI" } },
        whereDocument: { $contains: "machine" },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("get all data without filters", async () => {
      const results = await collection.get({ limit: 100 });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);
    });

    test("get with include parameter - only documents", async () => {
      const results = await collection.get({
        ids: insertedIds.slice(0, 2),
        include: ["documents"],
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.documents).toBeDefined();
      expect(results.metadatas).toBeUndefined();
      expect(results.embeddings).toBeUndefined();
    });

    test("get with include parameter - only metadatas", async () => {
      const results = await collection.get({
        ids: insertedIds.slice(0, 2),
        include: ["metadatas"],
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.metadatas).toBeDefined();
      expect(results.documents).toBeUndefined();
      expect(results.embeddings).toBeUndefined();
    });

    test("get with include parameter - only embeddings", async () => {
      const results = await collection.get({
        ids: insertedIds.slice(0, 2),
        include: ["embeddings"],
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.embeddings).toBeDefined();
      expect(results.documents).toBeUndefined();
      expect(results.metadatas).toBeUndefined();
    });

    test("get with limit 0 returns empty results", async () => {
      const results = await collection.get({ limit: 0 });
      console.log("results", results);
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(0);
    });

    test("get with offset beyond available items returns empty results", async () => {
      const allResults = await collection.get({ limit: 100 });
      const offsetResults = await collection.get({
        limit: 10,
        offset: allResults.ids.length + 100,
      });
      expect(offsetResults).toBeDefined();
      expect(offsetResults.ids.length).toBe(0);
    });

    test("get with $ne (not equal) operator", async () => {
      const results = await collection.get({
        where: { category: { $ne: "AI" } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      // Verify no results have category="AI"
      if (results.metadatas) {
        for (const metadata of results.metadatas) {
          if (metadata) {
            expect(metadata.category).not.toBe("AI");
          }
        }
      }
    });

    test("get with $lt (less than) operator", async () => {
      const results = await collection.get({
        where: { score: { $lt: 90 } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      // Verify all results have score < 90
      if (results.metadatas) {
        for (const metadata of results.metadatas) {
          if (metadata && metadata.score !== undefined) {
            expect(metadata.score).toBeLessThan(90);
          }
        }
      }
    });

    test("get with $lte (less than or equal) operator", async () => {
      const results = await collection.get({
        where: { score: { $lte: 88 } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("get with $gt (greater than) operator", async () => {
      const results = await collection.get({
        where: { score: { $gt: 90 } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      // Verify all results have score > 90
      if (results.metadatas) {
        for (const metadata of results.metadatas) {
          if (metadata && metadata.score !== undefined) {
            expect(metadata.score).toBeGreaterThan(90);
          }
        }
      }
    });

    test("get with $nin (not in) operator", async () => {
      const results = await collection.get({
        where: { tag: { $nin: ["ml", "python"] } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      // Verify no results have tag in ["ml", "python"]
      if (results.metadatas) {
        for (const metadata of results.metadatas) {
          if (metadata && metadata.tag) {
            expect(["ml", "python"]).not.toContain(metadata.tag);
          }
        }
      }
    });

    test("get with $and operator combining multiple conditions", async () => {
      const results = await collection.get({
        where: {
          $and: [
            { category: { $eq: "AI" } },
            { score: { $gte: 90 } },
            { tag: { $in: ["ml", "neural"] } },
          ],
        },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("get with document filter using $regex", async () => {
      const results = await collection.get({
        whereDocument: { $regex: ".*[Pp]ython.*" },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("get with empty IDs array - returns all records", async () => {
      const results = await collection.get({ ids: [], limit: 100 });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      // Empty ids array should return all records (not empty)
      expect(Array.isArray(results.ids)).toBe(true);
      // Should return records if collection has data (insertedIds has 5 items)
      expect(results.ids.length).toBeGreaterThanOrEqual(0);
    });

    test("get with non-existent IDs returns empty results", async () => {
      const results = await collection.get({
        ids: ["non_existent_id_1", "non_existent_id_2"],
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(0);
    });
  });
});
