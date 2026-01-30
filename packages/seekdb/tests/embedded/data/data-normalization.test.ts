/**
 * Data normalization scenario tests for Embedded mode
 * Tests various data formats (VARCHAR wrapper, JSON strings, etc.) for embedded mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { Client } from "../../../src/factory.js";
import { generateCollectionName } from "../../test-utils.js";
import { getTestDbDir, cleanupTestDb } from "../test-utils.js";
import type { SeekdbClient } from "../../../src/client.js";

describe("Embedded Mode - Data Normalization Scenarios", () => {
  let client: SeekdbClient;
  const TEST_DB_DIR = getTestDbDir("data-normalization.test.ts");

  beforeAll(async () => {
    await cleanupTestDb("data-normalization.test.ts");
    client = Client({
      path: TEST_DB_DIR,
      database: "test",
    });
  }, 60000);

  afterAll(async () => {
    try {
      await client.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Metadata Normalization", () => {
    test("handles simple metadata", async () => {
      const collectionName = generateCollectionName("test_metadata_norm");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1"],
        embeddings: [[1, 2, 3]],
        metadatas: [{ key: "value", num: 123 }],
      });

      const results = await collection.get({ ids: ["id1"] });
      expect(results.metadatas).toBeDefined();
      expect(results.metadatas![0]).toEqual({ key: "value", num: 123 });

      await client.deleteCollection(collectionName);
    });

    test("handles nested metadata", async () => {
      const collectionName = generateCollectionName("test_nested_meta");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1"],
        embeddings: [[1, 2, 3]],
        metadatas: [{ nested: { key: "value" }, array: [1, 2, 3] }],
      });

      const results = await collection.get({ ids: ["id1"] });
      expect(results.metadatas).toBeDefined();
      expect(results.metadatas![0]).toEqual({
        nested: { key: "value" },
        array: [1, 2, 3],
      });

      await client.deleteCollection(collectionName);
    });

    test("handles null metadata", async () => {
      const collectionName = generateCollectionName("test_null_meta");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1"],
        embeddings: [[1, 2, 3]],
        metadatas: [null],
      });

      const results = await collection.get({ ids: ["id1"] });
      expect(results.metadatas).toBeDefined();
      // Embedded: null metadata may come back as {} (SDK treats null → {} for API stability).
      expect([null, {}]).toContainEqual(results.metadatas![0]);

      await client.deleteCollection(collectionName);
    });

    test("handles empty metadata object", async () => {
      const collectionName = generateCollectionName("test_empty_meta");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1"],
        embeddings: [[1, 2, 3]],
        metadatas: [{}],
      });

      const results = await collection.get({ ids: ["id1"] });
      expect(results.metadatas).toBeDefined();
      expect(results.metadatas![0]).toEqual({});

      await client.deleteCollection(collectionName);
    });
  });

  describe("Document Normalization", () => {
    test("handles simple document", async () => {
      const collectionName = generateCollectionName("test_doc_norm");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1"],
        embeddings: [[1, 2, 3]],
        documents: ["test document"],
      });

      const results = await collection.get({ ids: ["id1"] });
      expect(results.documents).toBeDefined();
      expect(results.documents![0]).toBe("test document");

      await client.deleteCollection(collectionName);
    });

    test("handles empty document", async () => {
      const collectionName = generateCollectionName("test_empty_doc");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1"],
        embeddings: [[1, 2, 3]],
        documents: [""],
      });

      const results = await collection.get({ ids: ["id1"] });
      expect(results.documents).toBeDefined();
      expect(results.documents![0]).toBe("");

      await client.deleteCollection(collectionName);
    });

    test("handles long document", async () => {
      const collectionName = generateCollectionName("test_long_doc");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      // Embedded mode may have limits on very long text; use 1000 chars to ensure round-trip
      const longDoc = "a".repeat(1000);
      await collection.add({
        ids: ["id1"],
        embeddings: [[1, 2, 3]],
        documents: [longDoc],
      });

      const results = await collection.get({ ids: ["id1"] });
      expect(results.documents).toBeDefined();
      expect(results.documents![0]).toBe(longDoc);

      await client.deleteCollection(collectionName);
    });
  });

  describe("Embedding Normalization", () => {
    test("handles embedding array format", async () => {
      const collectionName = generateCollectionName("test_emb_norm");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1"],
        embeddings: [[1.1, 2.2, 3.3]],
      });

      const results = await collection.get({
        ids: ["id1"],
        include: ["embeddings"],
      });
      expect(results.embeddings).toBeDefined();
      expect(results.embeddings![0]).toEqual([1.1, 2.2, 3.3]);

      await client.deleteCollection(collectionName);
    });
  });
});
