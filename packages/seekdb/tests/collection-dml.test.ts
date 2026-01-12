/**
 * Collection DML tests - testing collection.add(), collection.delete(), collection.upsert(), collection.update() interfaces for Server mode
 * Supports configuring connection parameters via environment variables
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../src/client.js";
import { Collection } from "../src/collection.js";
import { TEST_CONFIG, generateCollectionName } from "./test-utils.js";
import { SeekdbValueError } from "../src/errors.js";

describe("Collection DML Operations", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    client = new SeekdbClient(TEST_CONFIG);
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

    test("collection.add - throws error for vector with NaN", async () => {
      const testId = "test_id_nan";
      await expect(async () => {
        await collection.add({
          ids: testId,
          embeddings: [1.0, NaN, 3.0],
        });
      }).rejects.toThrow(SeekdbValueError);
      await expect(async () => {
        await collection.add({
          ids: testId,
          embeddings: [1.0, NaN, 3.0],
        });
      }).rejects.toThrow("Vector contains invalid value: NaN");
    });

    test("collection.add - throws error for vector with Infinity", async () => {
      const testId = "test_id_inf";
      await expect(async () => {
        await collection.add({
          ids: testId,
          embeddings: [1.0, Infinity, 3.0],
        });
      }).rejects.toThrow(SeekdbValueError);
      await expect(async () => {
        await collection.add({
          ids: testId,
          embeddings: [1.0, Infinity, 3.0],
        });
      }).rejects.toThrow("Vector contains invalid value: Infinity");
    });

    test("collection.add - throws error for vector dimension mismatch at start", async () => {
      const testId = "test_id_dim_mismatch_start";
      await expect(async () => {
        await collection.add({
          ids: testId,
          // Collection dimension is configured as 3, so providing 2 dims should fail
          embeddings: [1.0, 2.0],
        });
      }).rejects.toThrow(SeekdbValueError);
      await expect(async () => {
        await collection.add({
          ids: testId,
          embeddings: [1.0, 2.0],
        });
      }).rejects.toThrow("Dimension mismatch at index 0. Expected 3, got 2");
    });

    test("collection.add - throws error for vector dimension mismatch in middle", async () => {
      const testIds = ["id1", "id2", "id3"];
      await expect(async () => {
        await collection.add({
          ids: testIds,
          embeddings: [
            [1.0, 2.0, 3.0], // Correct
            [1.0, 2.0],      // Incorrect
            [4.0, 5.0, 6.0], // Correct
          ],
        });
      }).rejects.toThrow(SeekdbValueError);
      await expect(async () => {
        await collection.add({
          ids: testIds,
          embeddings: [
            [1.0, 2.0, 3.0],
            [1.0, 2.0],
            [4.0, 5.0, 6.0],
          ],
        });
      }).rejects.toThrow("Dimension mismatch at index 1. Expected 3, got 2");
    });

    test("collection.update - throws error for vector with -Infinity", async () => {
      const testId = "test_id_neg_inf";
      // First add a valid item
      await collection.add({
        ids: testId,
        embeddings: [1.0, 2.0, 3.0],
      });

      await expect(async () => {
        await collection.update({
          ids: testId,
          embeddings: [1.0, -Infinity, 3.0],
        });
      }).rejects.toThrow(SeekdbValueError);
      await expect(async () => {
        await collection.update({
          ids: testId,
          embeddings: [1.0, -Infinity, 3.0],
        });
      }).rejects.toThrow("Vector contains invalid value: -Infinity");
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
      expect(results?.metadatas![0]?.category).toBe("test");
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
      expect(results?.metadatas![0]?.score).toBe(95);
      expect(results?.metadatas![0]?.updated).toBe(true);
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
      expect(results?.metadatas![0]?.score).toBe(98);
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
      expect(results?.metadatas![0]?.category).toBe("new");
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

    test("collection.update - update only metadata without changing document", async () => {
      const testId = "test_id_update_metadata_only";

      // Add item first
      await collection.add({
        ids: testId,
        embeddings: [10.0, 11.0, 12.0],
        documents: "Original document text",
        metadatas: { status: "active", version: 1 },
      });

      // Update only metadata
      await collection.update({
        ids: testId,
        metadatas: { status: "inactive", version: 2, updated: true },
      });

      // Verify document unchanged, metadata updated
      const results = await collection.get({ ids: testId });
      expect(results.ids.length).toBe(1);
      expect(results.documents![0]).toBe("Original document text");
      expect(results?.metadatas![0]?.status).toBe("inactive");
      expect(results?.metadatas![0]?.version).toBe(2);
      expect(results?.metadatas![0]?.updated).toBe(true);
    });

    test("collection.update - update only embeddings without changing document or metadata", async () => {
      const testId = "test_id_update_embeddings_only";

      // Add item first
      await collection.add({
        ids: testId,
        embeddings: [20.0, 21.0, 22.0],
        documents: "Test document",
        metadatas: { tag: "original" },
      });

      // Update only embeddings
      await collection.update({
        ids: testId,
        embeddings: [30.0, 31.0, 32.0],
      });

      // Verify document and metadata unchanged, embeddings updated
      const results = await collection.get({ ids: testId });
      expect(results.ids.length).toBe(1);
      console.log("results", results);
      expect(results?.documents![0]).toBe("Test document");
      expect(results?.metadatas![0]?.tag).toBe("original");
      expect(results?.embeddings![0]).toEqual([30.0, 31.0, 32.0]);
    });

    test("collection.add - add item without document", async () => {
      const testId = "test_id_no_document";

      await collection.add({
        ids: testId,
        embeddings: [40.0, 41.0, 42.0],
        metadatas: { type: "vector_only" },
      });

      const results = await collection.get({ ids: testId });
      expect(results.ids.length).toBe(1);
      expect(results.ids[0]).toBe(testId);
      expect(results?.metadatas![0]?.type).toBe("vector_only");
    });

    test("collection.add - add item without metadata", async () => {
      const testId = "test_id_no_metadata";

      await collection.add({
        ids: testId,
        embeddings: [50.0, 51.0, 52.0],
        documents: "Document without metadata",
      });

      const results = await collection.get({ ids: testId });
      expect(results.ids.length).toBe(1);
      expect(results?.documents![0]).toBe("Document without metadata");
    });

    test("collection.delete - delete multiple IDs at once", async () => {
      const testIds = ["test_id_multi_1", "test_id_multi_2", "test_id_multi_3"];

      // Add items first
      await collection.add({
        ids: testIds,
        embeddings: [
          [60.0, 61.0, 62.0],
          [61.0, 62.0, 63.0],
          [62.0, 63.0, 64.0],
        ],
        documents: ["Doc 1", "Doc 2", "Doc 3"],
        metadatas: [{ id: 1 }, { id: 2 }, { id: 3 }],
      });

      // Delete multiple IDs
      await collection.delete({ ids: [testIds[0], testIds[2]] });

      // Verify deletion
      const deletedResults = await collection.get({
        ids: [testIds[0], testIds[2]],
      });
      expect(deletedResults.ids.length).toBe(0);

      // Verify remaining item still exists
      const remainingResults = await collection.get({ ids: testIds[1] });
      expect(remainingResults.ids.length).toBe(1);
    });

    test("collection.delete - delete by combined metadata filters", async () => {
      const testId = "test_id_combined_filter";

      // Add item with specific metadata
      await collection.add({
        ids: testId,
        embeddings: [70.0, 71.0, 72.0],
        documents: "Test for combined filter",
        metadatas: { category: "test", score: 100, active: true },
      });

      // Delete by combined filters
      await collection.delete({
        where: {
          category: { $eq: "test" },
          score: { $gte: 100 },
          active: { $eq: true },
        },
      });

      // Verify deletion
      const results = await collection.get({ ids: testId });
      expect(results.ids.length).toBe(0);
    });

    test("collection.upsert - upsert multiple items", async () => {
      const testIds = ["test_id_upsert_1", "test_id_upsert_2"];

      // Upsert multiple items (mix of new and existing)
      await collection.upsert({
        ids: testIds,
        embeddings: [
          [80.0, 81.0, 82.0],
          [81.0, 82.0, 83.0],
        ],
        documents: ["Upsert doc 1", "Upsert doc 2"],
        metadatas: [{ type: "upsert" }, { type: "upsert" }],
      });

      // Verify both items exist
      const results = await collection.get({ ids: testIds });
      expect(results.ids.length).toBe(2);
      expect(results.documents![0]).toBe("Upsert doc 1");
      expect(results.documents![1]).toBe("Upsert doc 2");
    });

    test("collection.add - throws error for duplicate ID", async () => {
      const testId = "test_id_duplicate";

      // Add item first time
      await collection.add({
        ids: testId,
        embeddings: [90.0, 91.0, 92.0],
        documents: "First document",
      });

      // Try to add again with same ID (should fail)
      await expect(async () => {
        await collection.add({
          ids: testId,
          embeddings: [91.0, 92.0, 93.0],
          documents: "Duplicate document",
        });
      }).rejects.toThrow();
    });

    test("collection.update - throws error for non-existent ID", async () => {
      const nonExistentId = "test_id_nonexistent";

      await expect(async () => {
        await collection.update({
          ids: nonExistentId,
          metadatas: { updated: true },
        });
      });
    });
  });
});
