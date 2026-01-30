/**
 * Test collection creation with embedding function - testing create_collection,
 * get_or_create_collection, and get_collection interfaces with embedding function handling for Embedded mode
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { Client } from "../../../src/factory.js";
import type { HNSWConfiguration } from "../../../src/types.js";
import { generateCollectionName, Simple3DEmbeddingFunction } from "../../test-utils.js";
import { SeekdbValueError } from "../../../src/errors.js";
import { getTestDbDir, cleanupTestDb } from "../test-utils.js";
import type { SeekdbClient } from "../../../src/client.js";

describe("Embedded Mode - Collection Embedding Function Tests", () => {
  let client: SeekdbClient;
  const TEST_DB_DIR = getTestDbDir("collection-embedding-function.test.ts");

  beforeAll(async () => {
    await cleanupTestDb("collection-embedding-function.test.ts");
    // Use Client() factory function - it will return SeekdbClient (embedded mode when path is provided)
    client = Client({
      path: TEST_DB_DIR,
      database: "test",
    });
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  describe("createCollection tests", () => {
    test("createCollection with embeddingFunction=null and explicit configuration", async () => {
      const collectionName = generateCollectionName("test_explicit_none");
      const config: HNSWConfiguration = { dimension: 3, distance: "cosine" };
      const collection = await client.createCollection({
        name: collectionName,
        configuration: config,
        embeddingFunction: null,
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe(collectionName);
      expect(collection.dimension).toBe(3);
      expect(collection.distance).toBe("cosine");
      expect(collection.embeddingFunction).toBeUndefined();

      await client.deleteCollection(collectionName);
    }, 60000);

    test("createCollection with custom embedding function", async () => {
      const collectionName = generateCollectionName("test_custom_ef");
      const ef = Simple3DEmbeddingFunction();
      const collection = await client.createCollection({
        name: collectionName,
        embeddingFunction: ef,
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe(collectionName);
      expect(collection.dimension).toBe(3);
      expect(collection.embeddingFunction).toBe(ef);

      // Test adding documents without explicit embeddings
      await collection.add({
        ids: "ef_doc1",
        documents: "Test document for embedding",
      });

      const results = await collection.get({ ids: "ef_doc1" });
      expect(results.ids).toContain("ef_doc1");
      expect(results.embeddings).toBeDefined();

      await client.deleteCollection(collectionName);
    }, 60000);

    test("createCollection with embedding function and explicit dimension mismatch", async () => {
      const collectionName = generateCollectionName("test_ef_dim_mismatch");
      const ef = Simple3DEmbeddingFunction();

      await expect(
        client.createCollection({
          name: collectionName,
          configuration: { dimension: 128 }, // Mismatch with 3D embedding function
          embeddingFunction: ef,
        })
      ).rejects.toThrow(SeekdbValueError);
    });

    test("createCollection with embedding function and matching dimension", async () => {
      const collectionName = generateCollectionName("test_ef_dim_match");
      const ef = Simple3DEmbeddingFunction();
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: ef,
      });

      expect(collection.dimension).toBe(3);
      expect(collection.embeddingFunction).toBe(ef);

      await client.deleteCollection(collectionName);
    }, 60000);
  });

  describe("getOrCreateCollection tests", () => {
    test("getOrCreateCollection with embedding function", async () => {
      const collectionName = generateCollectionName("test_get_or_create_ef");
      const ef = Simple3DEmbeddingFunction();
      const collection = await client.getOrCreateCollection({
        name: collectionName,
        embeddingFunction: ef,
      });

      expect(collection).toBeDefined();
      expect(collection.embeddingFunction).toBe(ef);
      expect(collection.dimension).toBe(3);

      await client.deleteCollection(collectionName);
    }, 60000);
  });

  describe("query with embedding function", () => {
    test("query with queryTexts using embedding function", async () => {
      const collectionName = generateCollectionName("test_ef_query");
      const ef = Simple3DEmbeddingFunction();
      const collection = await client.createCollection({
        name: collectionName,
        embeddingFunction: ef,
      });

      await collection.add({
        ids: ["ef_q1", "ef_q2"],
        documents: ["Document about AI", "Document about Python"],
      });

      const results = await collection.query({
        queryTexts: "AI",
        nResults: 2,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids[0].length).toBeGreaterThan(0);

      await client.deleteCollection(collectionName);
    }, 60000);
  });
});
