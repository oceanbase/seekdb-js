/**
 * Client creation and connection tests - testing connection and collection management for Embedded mode
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { HNSWConfiguration } from "../../../src/types.js";
import { generateCollectionName } from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("client-creation.test.ts");

describe("Embedded Mode - Client Creation and Collection Management", () => {
  beforeAll(async () => {
    await cleanupTestDb("client-creation.test.ts");
  });

  afterAll(async () => {
    await cleanupTestDb("client-creation.test.ts");
  });

  describe("Client Creation", () => {
    test("create embedded client with path", async () => {
      const client = new SeekdbClient(TEST_CONFIG);
      expect(client).toBeDefined();
      expect(client instanceof SeekdbClient).toBe(true);
      expect(client.isConnected()).toBe(false);
      await client.close();
    });

    test("create embedded admin client (SeekdbClient uses built-in admin for admin ops)", async () => {
      const admin = new SeekdbClient(TEST_CONFIG);
      expect(admin).toBeDefined();
      expect(admin instanceof SeekdbClient).toBe(true);
      await admin.close();
    });
  });

  describe("Collection Management", () => {
    let client: SeekdbClient;

    beforeAll(async () => {
      client = new SeekdbClient(TEST_CONFIG);
    }, 60000);

    afterAll(async () => {
      await client.close();
    });

    test("create_collection - create a new collection", async () => {
      const testCollectionName = generateCollectionName("test_collection");
      const testDimension = 3;

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
    }, 60000);

    test("get_collection - get the collection we just created", async () => {
      const testCollectionName = generateCollectionName("test_collection");
      const testDimension = 3;

      const config: HNSWConfiguration = {
        dimension: testDimension,
        distance: "l2",
      };

      const created = await client.createCollection({
        name: testCollectionName,
        configuration: config,
        embeddingFunction: null,
      });

      const retrieved = await client.getCollection({
        name: testCollectionName,
        embeddingFunction: null,
      });

      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe(testCollectionName);
      expect(retrieved.dimension).toBe(testDimension);
      expect(retrieved.distance).toBe("l2");

      // Cleanup
      await client.deleteCollection(testCollectionName);
    }, 60000);

    test("list_collections - list all collections", async () => {
      const collectionName1 = generateCollectionName("test_list_1");
      const collectionName2 = generateCollectionName("test_list_2");

      await client.createCollection({
        name: collectionName1,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await client.createCollection({
        name: collectionName2,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      const collections = await client.listCollections();
      expect(collections).toBeDefined();
      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThanOrEqual(2);

      // Verify collections exist
      const names = collections.map(c => c.name);
      expect(names).toContain(collectionName1);
      expect(names).toContain(collectionName2);

      // Cleanup
      await client.deleteCollection(collectionName1);
      await client.deleteCollection(collectionName2);
    }, 60000);

    test("has_collection - check if collection exists", async () => {
      const collectionName = generateCollectionName("test_has");
      await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      const exists = await client.hasCollection(collectionName);
      expect(exists).toBe(true);

      // Cleanup
      await client.deleteCollection(collectionName);
    });

    test("has_collection - returns false for non-existing collection", async () => {
      const collectionName = generateCollectionName("test_not_has");
      const exists = await client.hasCollection(collectionName);
      expect(exists).toBe(false);
    });

    test("delete_collection - delete a collection", async () => {
      const collectionName = generateCollectionName("test_delete");
      await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await client.deleteCollection(collectionName);

      const exists = await client.hasCollection(collectionName);
      expect(exists).toBe(false);
    });

    test("get_or_create_collection - creates if not exists", async () => {
      const collectionName = generateCollectionName("test_get_or_create_new");
      const collection = await client.getOrCreateCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe(collectionName);

      // Cleanup
      await client.deleteCollection(collectionName);
    });

    test("get_or_create_collection - gets if exists", async () => {
      const collectionName = generateCollectionName("test_get_or_create_existing");
      const created = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      const retrieved = await client.getOrCreateCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      expect(retrieved.name).toBe(collectionName);
      expect(retrieved.dimension).toBe(created.dimension);

      // Cleanup
      await client.deleteCollection(collectionName);
    });

    test("count_collection - count collections", async () => {
      const initialCount = await client.countCollection();

      const collectionName1 = generateCollectionName("test_count_1");
      const collectionName2 = generateCollectionName("test_count_2");

      await client.createCollection({
        name: collectionName1,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      const count1 = await client.countCollection();
      expect(count1).toBe(initialCount + 1);

      await client.createCollection({
        name: collectionName2,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      const count2 = await client.countCollection();
      expect(count2).toBe(initialCount + 2);

      // Cleanup
      await client.deleteCollection(collectionName1);
      await client.deleteCollection(collectionName2);
    });

    test("create collection with different distance metrics", async () => {
      const distances: Array<"l2" | "cosine" | "inner_product"> = ["l2", "cosine", "inner_product"];

      for (const distance of distances) {
        const collectionName = generateCollectionName(`test_${distance}`);
        const collection = await client.createCollection({
          name: collectionName,
          configuration: {
            dimension: 3,
            distance,
          },
          embeddingFunction: null,
        });

        expect(collection.distance).toBe(distance);
        await client.deleteCollection(collectionName);
      }
    });
  });
});
