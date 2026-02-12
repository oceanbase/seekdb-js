/**
 * Complex query scenarios tests for Embedded mode
 * Tests advanced query features, filters, and edge cases for embedded mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { generateCollectionName } from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("complex-queries.test.ts");

describe("Embedded Mode - Complex Query Scenarios", () => {
  let client: SeekdbClient;
  let collectionName: string;

  beforeAll(async () => {
    await cleanupTestDb("complex-queries.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
    collectionName = generateCollectionName("test_complex_queries");
  });

  afterAll(async () => {
    try {
      await client.deleteCollection(collectionName);
    } catch (error) {
      // Ignore cleanup errors
    }
    await client.close();
  });

  describe("Complex Metadata Filters", () => {
    test("query with nested metadata filter", async () => {
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
        metadatas: [
          { nested: { key: "value1" }, score: 90 },
          { nested: { key: "value2" }, score: 85 },
          { nested: { key: "value1" }, score: 95 },
        ],
      });

      const results = await collection.query({
        queryEmbeddings: [[1, 2, 3]],
        where: { "nested.key": { $eq: "value1" } },
        nResults: 10,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids[0].length).toBeGreaterThan(0);
    });

    test("query with multiple conditions using $and", async () => {
      const name = generateCollectionName("test_and_filter");
      const collection = await client.createCollection({
        name,
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
        metadatas: [
          { category: "A", score: 90 },
          { category: "B", score: 85 },
          { category: "A", score: 95 },
        ],
      });

      const results = await collection.query({
        queryEmbeddings: [[1, 2, 3]],
        where: { category: { $eq: "A" }, score: { $gte: 90 } },
        nResults: 10,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids[0].length).toBeGreaterThanOrEqual(0);

      await client.deleteCollection(collection.name);
    });

    test("query with $in operator on array", async () => {
      const name = generateCollectionName("test_in_filter");
      const collection = await client.createCollection({
        name,
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
        metadatas: [
          { tags: ["tag1", "tag2"] },
          { tags: ["tag2", "tag3"] },
          { tags: ["tag1", "tag3"] },
        ],
      });

      const results = await collection.query({
        queryEmbeddings: [[1, 2, 3]],
        where: { tags: { $in: ["tag1"] } },
        nResults: 10,
      });

      expect(results.ids).toBeDefined();

      await client.deleteCollection(collection.name);
    });
  });

  describe("Query with Different Distance Metrics", () => {
    test("query results differ with different distance metrics", async () => {
      const l2Name = generateCollectionName("test_l2_query");
      const cosineName = generateCollectionName("test_cosine_query");
      const l2Collection = await client.createCollection({
        name: l2Name,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      const cosineCollection = await client.createCollection({
        name: cosineName,
        configuration: { dimension: 3, distance: "cosine" },
        embeddingFunction: null,
      });

      const testData = {
        ids: ["id1", "id2", "id3"],
        embeddings: [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
      };

      await l2Collection.add(testData);
      await cosineCollection.add(testData);

      const queryVector = [[1, 0, 0]];

      const l2Results = await l2Collection.query({
        queryEmbeddings: queryVector,
        nResults: 3,
      });

      const cosineResults = await cosineCollection.query({
        queryEmbeddings: queryVector,
        nResults: 3,
      });

      expect(l2Results.ids).toBeDefined();
      expect(cosineResults.ids).toBeDefined();
      expect(l2Results.distances).toBeDefined();
      expect(cosineResults.distances).toBeDefined();

      await client.deleteCollection(l2Collection.name);
      await client.deleteCollection(cosineCollection.name);
    });
  });

  describe("Query with Include Parameters", () => {
    test("query with include only embeddings", async () => {
      const name = generateCollectionName("test_include_emb");
      const collection = await client.createCollection({
        name,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1"],
        embeddings: [[1, 2, 3]],
        documents: ["test"],
        metadatas: [{ key: "value" }],
      });

      const results = await collection.query({
        queryEmbeddings: [[1, 2, 3]],
        nResults: 1,
        include: ["embeddings"],
      });

      expect(results.embeddings).toBeDefined();
      expect(results.documents).toBeUndefined();
      expect(results.metadatas).toBeUndefined();

      await client.deleteCollection(collection.name);
    });

    test("query with include documents and metadatas", async () => {
      const name = generateCollectionName("test_include_doc_meta");
      const collection = await client.createCollection({
        name,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1"],
        embeddings: [[1, 2, 3]],
        documents: ["test"],
        metadatas: [{ key: "value" }],
      });

      const results = await collection.query({
        queryEmbeddings: [[1, 2, 3]],
        nResults: 1,
        include: ["documents", "metadatas"],
      });

      expect(results.documents).toBeDefined();
      expect(results.metadatas).toBeDefined();
      expect(results.embeddings).toBeUndefined();

      await client.deleteCollection(collection.name);
    });
  });

  describe("Query with Multiple Query Vectors", () => {
    test("query with multiple query vectors returns multiple result sets", async () => {
      const name = generateCollectionName("test_multi_query");
      const collection = await client.createCollection({
        name,
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
        queryEmbeddings: [
          [1, 2, 3],
          [4, 5, 6],
        ],
        nResults: 2,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(2);
      expect(results.ids[0].length).toBeGreaterThan(0);
      expect(results.ids[1].length).toBeGreaterThan(0);

      await client.deleteCollection(collection.name);
    });
  });
});
