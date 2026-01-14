/**
 * Client creation and connection tests - testing connection and query execution for Server mode
 * Supports configuring connection parameters via environment variables
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../src/client.js";
import { HNSWConfiguration } from "../src/types.js";
import { TEST_CONFIG, generateCollectionName } from "./test-utils.js";

describe("Client Creation and Collection Management", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    client = new SeekdbClient(TEST_CONFIG);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("Collection Management", () => {
    test("create_collection - create a new collection", async () => {
      const testCollectionName = generateCollectionName("test_collection");
      const testDimension = 128;

      const config: HNSWConfiguration = {
        dimension: testDimension,
        distance: "cosine",
      };

      const collection = await client.createCollection({
        name: testCollectionName,
        configuration: config,
        embeddingFunction: null,
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe(testCollectionName);
      expect(collection.dimension).toBe(testDimension);

      // Cleanup
      await client.deleteCollection(testCollectionName);
    });

    test("get_collection - get the collection we just created", async () => {
      const testCollectionName = generateCollectionName("test_collection");
      const testDimension = 128;

      const config: HNSWConfiguration = {
        dimension: testDimension,
        distance: "cosine",
      };

      await client.createCollection({
        name: testCollectionName,
        configuration: config,
        embeddingFunction: null,
      });

      const retrievedCollection = await client.getCollection({
        name: testCollectionName,
        embeddingFunction: null,
      });

      expect(retrievedCollection).toBeDefined();
      expect(retrievedCollection.name).toBe(testCollectionName);
      expect(retrievedCollection.dimension).toBe(testDimension);

      // Cleanup
      await client.deleteCollection(testCollectionName);
    });

    test("get_collection - should extract correct distance metric (l2)", async () => {
      const testCollectionName = generateCollectionName("test_distance_l2");

      await client.createCollection({
        name: testCollectionName,
        configuration: { dimension: 64, distance: "l2" },
        embeddingFunction: null,
      });

      const collection = await client.getCollection({
        name: testCollectionName,
        embeddingFunction: null,
      });

      expect(collection.distance).toBe("l2");
      await client.deleteCollection(testCollectionName);
    });

    test("get_collection - should extract correct distance metric (cosine)", async () => {
      const testCollectionName = generateCollectionName("test_distance_cosine");

      await client.createCollection({
        name: testCollectionName,
        configuration: { dimension: 64, distance: "cosine" },
        embeddingFunction: null,
      });

      const collection = await client.getCollection({
        name: testCollectionName,
        embeddingFunction: null,
      });

      expect(collection.distance).toBe("cosine");
      await client.deleteCollection(testCollectionName);
    });

    test("get_collection - should extract correct distance metric (inner_product)", async () => {
      const testCollectionName = generateCollectionName("test_distance_ip");

      await client.createCollection({
        name: testCollectionName,
        configuration: { dimension: 64, distance: "inner_product" },
        embeddingFunction: null,
      });

      const collection = await client.getCollection({
        name: testCollectionName,
        embeddingFunction: null,
      });

      expect(collection.distance).toBe("inner_product");
      await client.deleteCollection(testCollectionName);
    });

    test("has_collection - should return false for non-existent collection", async () => {
      const nonExistentName = generateCollectionName(
        "test_collection_nonexistent",
      );
      const exists = await client.hasCollection(nonExistentName);
      expect(exists).toBe(false);
    });

    test("has_collection - should return true for existing collection", async () => {
      const testCollectionName = generateCollectionName("test_collection");

      await client.createCollection({
        name: testCollectionName,
        configuration: { dimension: 64, distance: "l2" },
        embeddingFunction: null,
      });

      const exists = await client.hasCollection(testCollectionName);
      expect(exists).toBe(true);

      // Cleanup
      await client.deleteCollection(testCollectionName);
    });

    test("get_or_create_collection - should get existing collection", async () => {
      const testCollectionName = generateCollectionName("test_collection");
      const config: HNSWConfiguration = {
        dimension: 128,
        distance: "cosine",
      };

      await client.createCollection({
        name: testCollectionName,
        configuration: config,
        embeddingFunction: null,
      });

      const existingCollection = await client.getOrCreateCollection({
        name: testCollectionName,
        configuration: config,
        embeddingFunction: null,
      });

      expect(existingCollection).toBeDefined();
      expect(existingCollection.name).toBe(testCollectionName);
      expect(existingCollection.dimension).toBe(128);

      // Cleanup
      await client.deleteCollection(testCollectionName);
    });

    test("get_or_create_collection - should create new collection", async () => {
      const testCollectionName = generateCollectionName("test_collection_mgmt");
      const config: HNSWConfiguration = {
        dimension: 128,
        distance: "cosine",
      };

      const newCollection = await client.getOrCreateCollection({
        name: testCollectionName,
        configuration: config,
        embeddingFunction: null,
      });

      expect(newCollection).toBeDefined();
      expect(newCollection.name).toBe(testCollectionName);
      expect(newCollection.dimension).toBe(128);

      // Cleanup
      await client.deleteCollection(testCollectionName);
    });

    test("list_collections - should include our collections", async () => {
      const testCollectionName1 = generateCollectionName("test_collection_1");
      const testCollectionName2 = generateCollectionName("test_collection_2");

      try {
        await client.createCollection({
          name: testCollectionName1,
          configuration: { dimension: 64, distance: "cosine" },
          embeddingFunction: null,
        });

        await client.createCollection({
          name: testCollectionName2,
          configuration: { dimension: 64, distance: "cosine" },
          embeddingFunction: null,
        });

        const collections = await client.listCollections();
        expect(Array.isArray(collections)).toBe(true);

        const collectionNames = collections.map((c) => c.name);
        expect(collectionNames).toContain(testCollectionName1);
        expect(collectionNames).toContain(testCollectionName2);
      } finally {
        // Cleanup
        try {
          await client.deleteCollection(testCollectionName1);
          await client.deleteCollection(testCollectionName2);
        } catch (e) {}
      }
    });

    test("delete_collection - should delete the collection", async () => {
      const testCollectionName = generateCollectionName("test_collection_mgmt");

      await client.createCollection({
        name: testCollectionName,
        configuration: { dimension: 64, distance: "cosine" },
        embeddingFunction: null,
      });

      await client.deleteCollection(testCollectionName);
      const exists = await client.hasCollection(testCollectionName);
      expect(exists).toBe(false);
    });

    test("delete_collection - should raise error for non-existent collection", async () => {
      const testCollectionName = generateCollectionName(
        "test_collection_nonexistent",
      );

      await expect(async () => {
        await client.deleteCollection(testCollectionName);
      }).rejects.toThrow();
    });

    test("get_or_create_collection without configuration - should use default configuration", async () => {
      const testCollectionName = generateCollectionName(
        "test_collection_default",
      );

      const defaultCollection = await client.getOrCreateCollection({
        name: testCollectionName,
      });

      expect(defaultCollection).toBeDefined();
      expect(defaultCollection.name).toBe(testCollectionName);
      expect(defaultCollection.dimension).toBe(384);

      // Cleanup
      await client.deleteCollection(testCollectionName);
    });

    test("count_collection - count the number of collections", async () => {
      const collectionCount = await client.countCollection();
      expect(typeof collectionCount).toBe("number");
      expect(collectionCount).toBeGreaterThanOrEqual(0);
    });

    test("collection.count() - count items in collection (should be 0 for empty collection)", async () => {
      const testCollectionName = generateCollectionName("test_collection");

      const collection = await client.createCollection({
        name: testCollectionName,
        configuration: { dimension: 128, distance: "cosine" },
        embeddingFunction: null,
      });

      const itemCount = await collection.count();
      expect(typeof itemCount).toBe("number");
      expect(itemCount).toBe(0);

      // Cleanup
      await client.deleteCollection(testCollectionName);
    });

    test("collection.peek() - preview items in empty collection", async () => {
      const testCollectionName = generateCollectionName("test_collection");

      const collection = await client.createCollection({
        name: testCollectionName,
        configuration: { dimension: 128, distance: "cosine" },
        embeddingFunction: null,
      });

      const preview = await collection.peek(5);
      expect(preview).toBeDefined();
      expect(preview.ids).toBeDefined();
      expect(preview.ids.length).toBe(0);

      // Cleanup
      await client.deleteCollection(testCollectionName);
    });

    test("collection.count() and peek() - with data", async () => {
      const testCollectionName = generateCollectionName("test_collection");

      const collection = await client.createCollection({
        name: testCollectionName,
        configuration: { dimension: 128, distance: "cosine" },
        embeddingFunction: null,
      });

      // Add some test data
      const testIds = ["id1", "id2", "id3"];
      const embeddings = [
        Array.from({ length: 128 }, () => Math.random()),
        Array.from({ length: 128 }, () => Math.random()),
        Array.from({ length: 128 }, () => Math.random()),
      ];

      await collection.add({
        ids: testIds,
        embeddings,
        documents: ["Test document 0", "Test document 1", "Test document 2"],
        metadatas: [{ index: 0 }, { index: 1 }, { index: 2 }],
      });

      // Test count after adding data
      const itemCountAfter = await collection.count();
      expect(itemCountAfter).toBe(3);

      // Test peek with data
      const previewWithData = await collection.peek(2);
      expect(previewWithData).toBeDefined();
      expect(previewWithData.ids).toBeDefined();
      expect(previewWithData.documents).toBeDefined();
      expect(previewWithData.metadatas).toBeDefined();
      expect(previewWithData.embeddings).toBeDefined();
      expect(previewWithData.ids.length).toBe(2);
      expect(previewWithData.ids.length).toBe(
        previewWithData.documents!.length,
      );
      expect(previewWithData.ids.length).toBe(
        previewWithData.metadatas!.length,
      );
      expect(previewWithData.ids.length).toBe(
        previewWithData.embeddings!.length,
      );

      // Test peek with different limit
      const previewAll = await collection.peek(10);
      expect(previewAll.ids.length).toBe(3);

      // Cleanup
      await client.deleteCollection(testCollectionName);
    });
  });
});
