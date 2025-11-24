/**
 * Collection DML tests - testing collection.add(), collection.delete(), collection.upsert(), collection.update() interfaces for Server mode
 * Supports configuring connection parameters via environment variables
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekDBClient } from "../src/client.js";
import { Collection } from "../src/collection.js";
import { TEST_CONFIG, generateCollectionName } from "./test-utils.js";

describe("Collection DML Operations", () => {
  let client: SeekDBClient;

  beforeAll(async () => {
    client = new SeekDBClient(TEST_CONFIG);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("Server Mode Collection DML", () => {
    let collection: Collection;
    let collectionName: string;

    beforeAll(async () => {
      collectionName = generateCollectionName("test_dml");
      collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "cosine" },
        embeddingFunction: null,
      });
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test("collection.add - add single item", async () => {
      const testId1 = "test_id_1";
      await collection.add({
        ids: testId1,
        embeddings: [1.0, 2.0, 3.0],
        documents: "This is test document 1",
        metadatas: { category: "test", score: 100 },
      });

      // Verify using collection.get
      const results = await collection.get({ ids: testId1 });
      expect(results.ids.length).toBe(1);
      expect(results.ids[0]).toBe(testId1);
      expect(results.documents![0]).toBe("This is test document 1");
      expect(results.metadatas![0].category).toBe("test");
    });

    test("collection.add - add multiple items", async () => {
      const testIds = ["test_id_2", "test_id_3", "test_id_4"];
      await collection.add({
        ids: testIds,
        embeddings: [
          [2.0, 3.0, 4.0],
          [3.0, 4.0, 5.0],
          [4.0, 5.0, 6.0],
        ],
        documents: ["Document 2", "Document 3", "Document 4"],
        metadatas: [
          { category: "test", score: 90 },
          { category: "test", score: 85 },
          { category: "demo", score: 80 },
        ],
      });

      // Verify using collection.get
      const results = await collection.get({ ids: testIds });
      expect(results.ids.length).toBe(3);
    });

    test("collection.update - update existing item", async () => {
      const testId1 = "test_id_1";
      await collection.update({
        ids: testId1,
        metadatas: { category: "test", score: 95, updated: true },
      });

      // Verify update using collection.get
      const results = await collection.get({ ids: testId1 });
      expect(results.ids.length).toBe(1);
      expect(results.documents![0]).toBe("This is test document 1");
      expect(results.metadatas![0].score).toBe(95);
      expect(results.metadatas![0].updated).toBe(true);
    });

    test("collection.update - update multiple items", async () => {
      const testIds = ["test_id_2", "test_id_3"];
      await collection.update({
        ids: testIds,
        embeddings: [
          [2.1, 3.1, 4.1],
          [3.1, 4.1, 5.1],
        ],
        metadatas: [
          { category: "test", score: 92 },
          { category: "test", score: 87 },
        ],
      });

      // Verify update using collection.get
      const results = await collection.get({ ids: testIds });
      expect(results.ids.length).toBe(2);
    });

    test("collection.upsert - upsert existing item (update)", async () => {
      const testId1 = "test_id_1";
      await collection.upsert({
        ids: testId1,
        embeddings: [1.0, 2.0, 3.0],
        documents: "Upserted document 1",
        metadatas: { category: "test", score: 98 },
      });

      // Verify upsert using collection.get
      const results = await collection.get({ ids: testId1 });
      expect(results.ids.length).toBe(1);
      expect(results.documents![0]).toBe("Upserted document 1");
      expect(results.metadatas![0].score).toBe(98);
    });

    test("collection.upsert - upsert new item (insert)", async () => {
      const testIdNew = "test_id_new";
      await collection.upsert({
        ids: testIdNew,
        embeddings: [5.0, 6.0, 7.0],
        documents: "New upserted document",
        metadatas: { category: "new", score: 99 },
      });

      // Verify upsert using collection.get
      const results = await collection.get({ ids: testIdNew });
      expect(results.ids.length).toBe(1);
      expect(results.documents![0]).toBe("New upserted document");
      expect(results.metadatas![0].category).toBe("new");
    });

    test("collection.delete - delete by ID", async () => {
      const testIds = ["test_id_2", "test_id_3", "test_id_4"];

      // Delete one of the test items
      await collection.delete({ ids: testIds[0] });

      // Verify deletion using collection.get
      const results = await collection.get({ ids: testIds[0] });
      expect(results.ids.length).toBe(0);

      // Verify other items still exist
      const otherResults = await collection.get({
        ids: [testIds[1], testIds[2]],
      });
      expect(otherResults.ids.length).toBe(2);
    });

    test("collection.delete - delete by metadata filter", async () => {
      // Delete items with category="demo"
      await collection.delete({ where: { category: { $eq: "demo" } } });

      // Verify deletion using collection.get
      const results = await collection.get({
        where: { category: { $eq: "demo" } },
      });
      expect(results.ids.length).toBe(0);
    });

    test("collection.delete - delete by document filter", async () => {
      // Add an item with specific document content
      const testIdDoc = "test_id_doc";
      await collection.add({
        ids: testIdDoc,
        embeddings: [6.0, 7.0, 8.0],
        documents: "Delete this document",
        metadatas: { category: "temp" },
      });

      // Delete by document filter
      await collection.delete({
        whereDocument: { $contains: "Delete this" },
      });

      // Verify deletion using collection.get
      const results = await collection.get({
        whereDocument: { $contains: "Delete this" },
      });
      expect(results.ids.length).toBe(0);
    });

    test("verify final state using collection.get", async () => {
      const allResults = await collection.get({ limit: 100 });
      expect(allResults.ids.length).toBeGreaterThan(0);
    });
  });
});
