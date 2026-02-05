/**
 * Data normalization scenario tests for Server mode
 * Tests various data formats (VARCHAR wrapper, JSON strings, etc.) for server mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../src/client.js";
import { TEST_CONFIG, generateCollectionName } from "../test-utils.js";

describe("Server Mode - Data Normalization Scenarios", () => {
  describe("Metadata Normalization", () => {
    let client: SeekdbClient;
    let collectionName: string;

    beforeAll(async () => {
      client = new SeekdbClient(TEST_CONFIG);
      collectionName = generateCollectionName("test_metadata_norm");
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch (error) {
        // Ignore cleanup errors
      }
      await client.close();
    });

    test("handles simple metadata", async () => {
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
    });

    test("handles nested metadata", async () => {
      const collection = await client.createCollection({
        name: generateCollectionName("test_nested_meta"),
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

      await client.deleteCollection(collection.name);
    });

    test("handles null metadata", async () => {
      const collection = await client.createCollection({
        name: generateCollectionName("test_null_meta"),
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
      expect(results.metadatas![0]).toBe(null);

      await client.deleteCollection(collection.name);
    });

    test("handles empty metadata object", async () => {
      const collection = await client.createCollection({
        name: generateCollectionName("test_empty_meta"),
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

      await client.deleteCollection(collection.name);
    });
  });

  describe("Document Normalization", () => {
    let client: SeekdbClient;
    let collectionName: string;

    beforeAll(async () => {
      client = new SeekdbClient(TEST_CONFIG);
      collectionName = generateCollectionName("test_doc_norm");
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch (error) {
        // Ignore cleanup errors
      }
      await client.close();
    });

    test("handles simple document", async () => {
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
    });

    test("handles empty document", async () => {
      const collection = await client.createCollection({
        name: generateCollectionName("test_empty_doc"),
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

      await client.deleteCollection(collection.name);
    });

    test("handles long document", async () => {
      const collection = await client.createCollection({
        name: generateCollectionName("test_long_doc"),
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      const longDoc = "a".repeat(10000);
      await collection.add({
        ids: ["id1"],
        embeddings: [[1, 2, 3]],
        documents: [longDoc],
      });

      const results = await collection.get({ ids: ["id1"] });
      expect(results.documents).toBeDefined();
      expect(results.documents![0]).toBe(longDoc);

      await client.deleteCollection(collection.name);
    });
  });

  describe("Embedding Normalization", () => {
    let client: SeekdbClient;
    let collectionName: string;

    beforeAll(async () => {
      client = new SeekdbClient(TEST_CONFIG);
      collectionName = generateCollectionName("test_emb_norm");
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch (error) {
        // Ignore cleanup errors
      }
      await client.close();
    });

    test("handles embedding array format", async () => {
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
    });
  });
});
