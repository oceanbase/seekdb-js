/**
 * Collection get tests - testing collection.get() interface for Embedded mode
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { Collection } from "../../../src/collection.js";
import { generateCollectionName } from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("collection-get.test.ts");

describe("Embedded Mode - Collection Get Operations", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("collection-get.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
  }, 60000);

  afterAll(async () => {
    try {
      await client.close();
      // Wait a bit to ensure database is fully closed before cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe("Embedded Mode Collection Get", () => {
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
      insertedIds = ["get1", "get2", "get3", "get4", "get5"];
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
          "Document 1",
          "Document 2",
          "Document 3",
          "Document 4",
          "Document 5",
        ],
        metadatas: [
          { category: "A", score: 95 },
          { category: "B", score: 88 },
          { category: "A", score: 92 },
          { category: "C", score: 90 },
          { category: "A", score: 85 },
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

    test("get by single id", async () => {
      const results = await collection.get({ ids: insertedIds[0] });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(1);
      expect(results.ids[0]).toBe(insertedIds[0]);
      expect(results.documents).toBeDefined();
      expect(results.documents![0]).toBe("Document 1");
    });

    test("get by multiple ids", async () => {
      const results = await collection.get({ ids: insertedIds.slice(0, 2) });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(2);
      expect(results.ids).toContain(insertedIds[0]);
      expect(results.ids).toContain(insertedIds[1]);
    });

    test("get with where clause", async () => {
      const results = await collection.get({
        where: { category: { $eq: "A" } },
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(3);
      expect(results.ids).toContain(insertedIds[0]);
      expect(results.ids).toContain(insertedIds[2]);
      expect(results.ids).toContain(insertedIds[4]);
    });

    test("get with limit", async () => {
      const results = await collection.get({ limit: 2 });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeLessThanOrEqual(2);
    });

    test("get with offset", async () => {
      const results1 = await collection.get({ limit: 2 });
      const results2 = await collection.get({ limit: 2, offset: 2 });
      expect(results1.ids).not.toEqual(results2.ids);
    });

    test("get with include", async () => {
      const results = await collection.get({
        ids: insertedIds[0],
        include: ["embeddings", "metadatas"],
      });
      expect(results.embeddings).toBeDefined();
      expect(results.metadatas).toBeDefined();
    });

    test("get returns empty for non-existing id", async () => {
      const results = await collection.get({ ids: "non_existing" });
      expect(results.ids.length).toBe(0);
    });

    test("peek returns limited results", async () => {
      const results = await collection.peek(3);
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeLessThanOrEqual(3);
      expect(results.embeddings).toBeDefined();
      expect(results.documents).toBeDefined();
      expect(results.metadatas).toBeDefined();
    });
  });
});
