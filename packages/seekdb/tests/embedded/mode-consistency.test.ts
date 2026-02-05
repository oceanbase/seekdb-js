/**
 * Mode consistency tests (embedded + server)
 * Compares behavior between embedded and server modes to ensure they are functionally identical.
 * Lives under embedded/ because it requires the native addon.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../src/client.js";
import { Client } from "../../src/factory.js";
import { TEST_CONFIG, generateCollectionName } from "../test-utils.js";
import { getTestDbDir, cleanupTestDb } from "./test-utils.js";
import type { SeekdbClient as SeekdbClientType } from "../../src/client.js";

describe("Mode Consistency Tests", () => {
  describe("Collection Creation and Retrieval", () => {
    let serverClient: SeekdbClient;
    let embeddedClient: SeekdbClientType;
    const TEST_DB_DIR = getTestDbDir("mode-consistency.test.ts");

    beforeAll(async () => {
      serverClient = new SeekdbClient(TEST_CONFIG);
      await cleanupTestDb("mode-consistency.test.ts");
      embeddedClient = Client({
        path: TEST_DB_DIR,
        database: "test",
      });
    }, 60000);

    afterAll(async () => {
      try {
        await serverClient.close();
        await embeddedClient.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test("getCollection returns same distance for both modes", async () => {
      const collectionName = generateCollectionName("test_distance");
      const distance = "l2";

      // Create in server mode
      await serverClient.createCollection({
        name: collectionName,
        configuration: { dimension: 128, distance },
        embeddingFunction: null,
      });

      const serverCollection = await serverClient.getCollection({
        name: collectionName,
        embeddingFunction: null,
      });

      // Create in embedded mode
      await embeddedClient.createCollection({
        name: collectionName,
        configuration: { dimension: 128, distance },
        embeddingFunction: null,
      });

      const embeddedCollection = await embeddedClient.getCollection({
        name: collectionName,
        embeddingFunction: null,
      });

      // Both should return the same distance
      expect(serverCollection.distance).toBe(distance);
      expect(embeddedCollection.distance).toBe(distance);
      expect(serverCollection.distance).toBe(embeddedCollection.distance);

      await serverClient.deleteCollection(collectionName);
      await embeddedClient.deleteCollection(collectionName);
    });

    test("getCollection returns same dimension for both modes", async () => {
      const collectionName = generateCollectionName("test_dimension");
      const dimension = 256;

      // Create in server mode
      await serverClient.createCollection({
        name: collectionName,
        configuration: { dimension, distance: "l2" },
        embeddingFunction: null,
      });

      const serverCollection = await serverClient.getCollection({
        name: collectionName,
        embeddingFunction: null,
      });

      // Create in embedded mode
      await embeddedClient.createCollection({
        name: collectionName,
        configuration: { dimension, distance: "l2" },
        embeddingFunction: null,
      });

      const embeddedCollection = await embeddedClient.getCollection({
        name: collectionName,
        embeddingFunction: null,
      });

      // Both should return the same dimension
      expect(serverCollection.dimension).toBe(dimension);
      expect(embeddedCollection.dimension).toBe(dimension);
      expect(serverCollection.dimension).toBe(embeddedCollection.dimension);

      await serverClient.deleteCollection(collectionName);
      await embeddedClient.deleteCollection(collectionName);
    });

    test("listCollections returns same structure for both modes", async () => {
      const collectionName1 = generateCollectionName("test_list_1");
      const collectionName2 = generateCollectionName("test_list_2");

      // Create collections in server mode
      await serverClient.createCollection({
        name: collectionName1,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await serverClient.createCollection({
        name: collectionName2,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      // Create collections in embedded mode
      await embeddedClient.createCollection({
        name: collectionName1,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await embeddedClient.createCollection({
        name: collectionName2,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      const serverCollections = await serverClient.listCollections();
      const embeddedCollections = await embeddedClient.listCollections();

      // Both should return arrays
      expect(Array.isArray(serverCollections)).toBe(true);
      expect(Array.isArray(embeddedCollections)).toBe(true);

      // Both should contain the collections we created
      const serverNames = serverCollections.map((c) => c.name);
      const embeddedNames = embeddedCollections.map((c) => c.name);

      expect(serverNames).toContain(collectionName1);
      expect(serverNames).toContain(collectionName2);
      expect(embeddedNames).toContain(collectionName1);
      expect(embeddedNames).toContain(collectionName2);

      await serverClient.deleteCollection(collectionName1);
      await serverClient.deleteCollection(collectionName2);
      await embeddedClient.deleteCollection(collectionName1);
      await embeddedClient.deleteCollection(collectionName2);
    });
  });

  describe("Data Operations Consistency", () => {
    let serverClient: SeekdbClient;
    let embeddedClient: SeekdbClientType;
    const TEST_DB_DIR = getTestDbDir("mode-consistency.test.ts");

    beforeAll(async () => {
      serverClient = new SeekdbClient(TEST_CONFIG);
      await cleanupTestDb("mode-consistency.test.ts");
      embeddedClient = Client({
        path: TEST_DB_DIR,
        database: "test",
      });
    }, 60000);

    afterAll(async () => {
      try {
        await serverClient.close();
        await embeddedClient.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test("get() returns same normalized data for both modes", async () => {
      const collectionName = generateCollectionName("test_get_consistency");
      const testId = "test_id_1";
      const testDocument = "test document";
      const testMetadata = { key: "value", num: 123 };
      const testEmbedding = [1.0, 2.0, 3.0];

      // Create and add data in server mode
      const serverCollection = await serverClient.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await serverCollection.add({
        ids: [testId],
        embeddings: [testEmbedding],
        documents: [testDocument],
        metadatas: [testMetadata],
      });

      // Create and add data in embedded mode
      const embeddedCollection = await embeddedClient.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await embeddedCollection.add({
        ids: [testId],
        embeddings: [testEmbedding],
        documents: [testDocument],
        metadatas: [testMetadata],
      });

      // Get data from both modes
      const serverResults = await serverCollection.get({ ids: [testId] });
      const embeddedResults = await embeddedCollection.get({ ids: [testId] });

      // Both should return the same normalized data
      expect(serverResults.ids[0]).toBe(testId);
      expect(embeddedResults.ids[0]).toBe(testId);
      expect(serverResults.ids[0]).toBe(embeddedResults.ids[0]);

      expect(serverResults.documents![0]).toBe(testDocument);
      expect(embeddedResults.documents![0]).toBe(testDocument);
      expect(serverResults.documents![0]).toBe(embeddedResults.documents![0]);

      expect(serverResults.metadatas![0]).toEqual(testMetadata);
      expect(embeddedResults.metadatas![0]).toEqual(testMetadata);
      expect(serverResults.metadatas![0]).toEqual(
        embeddedResults.metadatas![0]
      );

      // Embeddings should be the same (within floating point precision)
      expect(serverResults.embeddings![0]).toEqual(testEmbedding);
      expect(embeddedResults.embeddings![0]).toEqual(testEmbedding);

      await serverClient.deleteCollection(collectionName);
      await embeddedClient.deleteCollection(collectionName);
    });

    test("query() returns same structure for both modes", async () => {
      const collectionName = generateCollectionName("test_query_consistency");
      const testEmbedding = [1.0, 2.0, 3.0];

      // Create and add data in server mode
      const serverCollection = await serverClient.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await serverCollection.add({
        ids: ["id1", "id2"],
        embeddings: [
          [1.0, 2.0, 3.0],
          [2.0, 3.0, 4.0],
        ],
        documents: ["doc1", "doc2"],
      });

      // Create and add data in embedded mode
      const embeddedCollection = await embeddedClient.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await embeddedCollection.add({
        ids: ["id1", "id2"],
        embeddings: [
          [1.0, 2.0, 3.0],
          [2.0, 3.0, 4.0],
        ],
        documents: ["doc1", "doc2"],
      });

      // Query both modes
      const serverResults = await serverCollection.query({
        queryEmbeddings: [testEmbedding],
        nResults: 2,
      });

      const embeddedResults = await embeddedCollection.query({
        queryEmbeddings: [testEmbedding],
        nResults: 2,
      });

      // Both should return the same structure
      expect(serverResults.ids).toBeDefined();
      expect(embeddedResults.ids).toBeDefined();
      expect(Array.isArray(serverResults.ids[0])).toBe(true);
      expect(Array.isArray(embeddedResults.ids[0])).toBe(true);

      expect(serverResults.distances).toBeDefined();
      expect(embeddedResults.distances).toBeDefined();
      expect(Array.isArray(serverResults.distances![0])).toBe(true);
      expect(Array.isArray(embeddedResults.distances![0])).toBe(true);

      expect(serverResults.documents).toBeDefined();
      expect(embeddedResults.documents).toBeDefined();

      // Both should return results
      expect(serverResults.ids[0].length).toBeGreaterThan(0);
      expect(embeddedResults.ids[0].length).toBeGreaterThan(0);

      await serverClient.deleteCollection(collectionName);
      await embeddedClient.deleteCollection(collectionName);
    });
  });

  describe("Distance Metric Consistency", () => {
    let serverClient: SeekdbClient;
    let embeddedClient: SeekdbClientType;
    const TEST_DB_DIR = getTestDbDir("mode-consistency.test.ts");

    beforeAll(async () => {
      serverClient = new SeekdbClient(TEST_CONFIG);
      await cleanupTestDb("mode-consistency.test.ts");
      embeddedClient = Client({
        path: TEST_DB_DIR,
        database: "test",
      });
    }, 60000);

    afterAll(async () => {
      try {
        await serverClient.close();
        await embeddedClient.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test("all distance metrics work consistently", async () => {
      const distances: Array<"l2" | "cosine" | "inner_product"> = [
        "l2",
        "cosine",
        "inner_product",
      ];

      for (const distance of distances) {
        const collectionName = generateCollectionName(`test_${distance}`);

        // Create in server mode
        await serverClient.createCollection({
          name: collectionName,
          configuration: { dimension: 3, distance },
          embeddingFunction: null,
        });

        const serverCollection = await serverClient.getCollection({
          name: collectionName,
          embeddingFunction: null,
        });

        // Create in embedded mode
        await embeddedClient.createCollection({
          name: collectionName,
          configuration: { dimension: 3, distance },
          embeddingFunction: null,
        });

        const embeddedCollection = await embeddedClient.getCollection({
          name: collectionName,
          embeddingFunction: null,
        });

        // Both should return the same distance
        expect(serverCollection.distance).toBe(distance);
        expect(embeddedCollection.distance).toBe(distance);

        await serverClient.deleteCollection(collectionName);
        await embeddedClient.deleteCollection(collectionName);
      }
    });
  });
});
