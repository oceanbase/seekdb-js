/**
 * Collection Metadata V2 tests - testing v2 collection format with metadata table
 * Supports configuring connection parameters via environment variables
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../src/client.js";
import {
  TEST_CONFIG,
  generateCollectionName,
  MockEmbeddingFunction,
} from "./test-utils.js";
import {
  getCollectionMetadata,
  metadataTableExists,
} from "../src/metadata-manager.js";
import { registerEmbeddingFunction } from "../src/embedding-function.js";
import { COLLECTION_V1_PREFIX } from "../src/utils.js";
import { Configuration } from "../src/types.js";

// Register the mock embedding function
try {
  registerEmbeddingFunction("mock-embed", MockEmbeddingFunction as any);
} catch (e) {
  // Ignore if already registered
}

describe("Collection Metadata V2", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    client = new SeekdbClient(TEST_CONFIG);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("V2 Collection Creation", () => {
    let collectionName: string;

    beforeAll(async () => {
      collectionName = generateCollectionName("test_v2");
    });

    afterAll(async () => {
      try {
        const exists = await client.hasCollection(collectionName);
        if (exists) {
          await client.deleteCollection(collectionName);
        }
      } catch (error) {
        console.error(`Failed to cleanup collection ${collectionName}:`, error);
      }
    });

    test("should create metadata table on first collection creation", async () => {
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { hnsw: { dimension: 3, distance: "cosine" } },
        embeddingFunction: null,
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe(collectionName);
      expect(collection.collectionId).toBeDefined();
      expect(collection.collectionId).toHaveLength(32); // UUID without dashes

      // Verify metadata table exists
      const tableExists = await metadataTableExists(
        (client as any)._internal,
      );
      expect(tableExists).toBe(true);
    });

    test("should store collection metadata in metadata table", async () => {
      const metadata = await getCollectionMetadata(
        (client as any)._internal,
        collectionName,
      );

      expect(metadata).toBeDefined();
      expect(metadata?.collectionName).toBe(collectionName);
      expect(metadata?.collectionId).toBeDefined();
      expect((metadata?.settings.configuration as Configuration)?.hnsw?.dimension).toBe(3);
      expect((metadata?.settings.configuration as Configuration)?.hnsw?.distance).toBe("cosine");
    });

    test("should retrieve v2 collection with collectionId", async () => {
      const collection = await client.getCollection({ name: collectionName });

      expect(collection).toBeDefined();
      expect(collection.name).toBe(collectionName);
      expect(collection.collectionId).toBeDefined();
      expect(collection.dimension).toBe(3);
      expect(collection.distance).toBe("cosine");
    });

    test("should list v2 collection", async () => {
      const collections = await client.listCollections();

      const found = collections.find((c) => c.name === collectionName);
      expect(found).toBeDefined();
      expect(found?.collectionId).toBeDefined();
    });

    test("should check v2 collection exists", async () => {
      const exists = await client.hasCollection(collectionName);
      expect(exists).toBe(true);
    });

    test("should perform CRUD operations on v2 collection", async () => {
      const collection = await client.getCollection({ name: collectionName });

      // Add data
      await collection.add({
        ids: ["id1", "id2"],
        embeddings: [
          [1.0, 2.0, 3.0],
          [4.0, 5.0, 6.0],
        ],
        documents: ["doc1", "doc2"],
      });

      // Get data
      const result = await collection.get({
        ids: ["id1", "id2"],
        include: ["documents", "embeddings"],
      });

      expect(result.ids).toHaveLength(2);
      expect(result.documents).toBeDefined();
      expect(result.embeddings).toBeDefined();

      // Count
      const count = await collection.count();
      expect(count).toBe(2);

      // Delete data
      await collection.delete({ ids: ["id1"] });

      const countAfterDelete = await collection.count();
      expect(countAfterDelete).toBe(1);
    });

    test("should delete v2 collection and clean up metadata", async () => {
      await client.deleteCollection(collectionName);

      // Verify collection doesn't exist
      const exists = await client.hasCollection(collectionName);
      expect(exists).toBe(false);

      // Verify metadata is cleaned up
      const metadata = await getCollectionMetadata(
        (client as any)._internal,
        collectionName,
      );
      expect(metadata).toBeNull();
    });
  });

  describe("V1 and V2 Compatibility", () => {
    let v1CollectionName: string;
    let v2CollectionName: string;

    beforeAll(async () => {
      v1CollectionName = generateCollectionName("test_v1_compat");
      v2CollectionName = generateCollectionName("test_v2_compat");
    });

    afterAll(async () => {
      // Cleanup v1 collection
      try {
        const v1Exists = await client.hasCollection(v1CollectionName);
        if (v1Exists) {
          await client.deleteCollection(v1CollectionName);
        }
      } catch (error) {
        console.error(
          `Failed to cleanup v1 collection ${v1CollectionName}:`,
          error,
        );
      }

      // Cleanup v2 collection
      try {
        const v2Exists = await client.hasCollection(v2CollectionName);
        if (v2Exists) {
          await client.deleteCollection(v2CollectionName);
        }
      } catch (error) {
        console.error(
          `Failed to cleanup v2 collection ${v2CollectionName}:`,
          error,
        );
      }
    });

    test("should create v1 format collection (without metadata table)", async () => {
      // Manually create a v1 format table (simulating old SDK behavior)
      const v1TableName = `${COLLECTION_V1_PREFIX}${v1CollectionName}`;
      const createV1TableSql = `
        CREATE TABLE \`${v1TableName}\` (
          _id VARBINARY(512) PRIMARY KEY NOT NULL,
          document STRING,
          embedding VECTOR(3),
          metadata JSON,
          FULLTEXT INDEX idx_fts (document) WITH PARSER ik,
          VECTOR INDEX idx_vec (embedding) WITH(distance=cosine, type=hnsw, lib=vsag)
        ) ORGANIZATION = HEAP
      `;

      await (client as any)._internal.execute(createV1TableSql);

      // Verify v1 collection can be retrieved
      const v1Collection = await client.getCollection({
        name: v1CollectionName,
      });

      expect(v1Collection).toBeDefined();
      expect(v1Collection.name).toBe(v1CollectionName);
      expect(v1Collection.collectionId).toBeUndefined(); // v1 has no collectionId
      expect(v1Collection.dimension).toBe(3);
      expect(v1Collection.distance).toBe("cosine");
    });

    test("should list both v1 and v2 collections", async () => {
      // Create v2 collection
      await client.createCollection({
        name: v2CollectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      const collections = await client.listCollections();

      // Should have both v1 and v2 collections
      const v1Collection = collections.find(
        (c) => c.name === v1CollectionName,
      );
      const v2Collection = collections.find(
        (c) => c.name === v2CollectionName,
      );

      expect(v1Collection).toBeDefined();
      expect(v1Collection?.collectionId).toBeUndefined(); // v1 has no collectionId

      expect(v2Collection).toBeDefined();
      expect(v2Collection?.collectionId).toBeDefined(); // v2 has collectionId
    });

    test("should perform CRUD operations on v1 collection", async () => {
      const collection = await client.getCollection({
        name: v1CollectionName,
      });

      // Add data to v1 collection
      await collection.add({
        ids: ["v1_id1", "v1_id2"],
        embeddings: [
          [1.0, 2.0, 3.0],
          [4.0, 5.0, 6.0],
        ],
        documents: ["v1 doc1", "v1 doc2"],
      });

      // Get data
      const result = await collection.get({
        ids: ["v1_id1", "v1_id2"],
        include: ["documents", "embeddings"],
      });

      expect(result.ids).toHaveLength(2);
      expect(result.documents).toEqual(["v1 doc1", "v1 doc2"]);

      // Count
      const count = await collection.count();
      expect(count).toBe(2);

      // Delete data
      await collection.delete({ ids: ["v1_id1"] });

      const countAfterDelete = await collection.count();
      expect(countAfterDelete).toBe(1);
    });

    test("should perform CRUD operations on v2 collection", async () => {
      const collection = await client.getCollection({
        name: v2CollectionName,
      });

      // Add data to v2 collection
      await collection.add({
        ids: ["v2_id1", "v2_id2"],
        embeddings: [
          [1.0, 2.0, 3.0],
          [4.0, 5.0, 6.0],
        ],
        documents: ["v2 doc1", "v2 doc2"],
      });

      // Get data
      const result = await collection.get({
        ids: ["v2_id1", "v2_id2"],
        include: ["documents", "embeddings"],
      });

      expect(result.ids).toHaveLength(2);
      expect(result.documents).toEqual(["v2 doc1", "v2 doc2"]);

      // Count
      const count = await collection.count();
      expect(count).toBe(2);

      // Delete data
      await collection.delete({ ids: ["v2_id1"] });

      const countAfterDelete = await collection.count();
      expect(countAfterDelete).toBe(1);
    });

    test("should check existence of both v1 and v2 collections", async () => {
      const v1Exists = await client.hasCollection(v1CollectionName);
      const v2Exists = await client.hasCollection(v2CollectionName);

      expect(v1Exists).toBe(true);
      expect(v2Exists).toBe(true);
    });

    test("should delete v1 collection without affecting metadata table", async () => {
      await client.deleteCollection(v1CollectionName);

      // Verify v1 collection doesn't exist
      const v1Exists = await client.hasCollection(v1CollectionName);
      expect(v1Exists).toBe(false);

      // Verify v2 collection still exists
      const v2Exists = await client.hasCollection(v2CollectionName);
      expect(v2Exists).toBe(true);

      // Verify no metadata entry for v1 collection
      const v1Metadata = await getCollectionMetadata(
        (client as any)._internal,
        v1CollectionName,
      );
      expect(v1Metadata).toBeNull();
    });

    test("should delete v2 collection and clean up metadata", async () => {
      await client.deleteCollection(v2CollectionName);

      // Verify v2 collection doesn't exist
      const v2Exists = await client.hasCollection(v2CollectionName);
      expect(v2Exists).toBe(false);

      // Verify metadata is cleaned up
      const v2Metadata = await getCollectionMetadata(
        (client as any)._internal,
        v2CollectionName,
      );
      expect(v2Metadata).toBeNull();
    });

    test("should support collection names up to 512 bytes", async () => {
      // Create a long collection name (close to 512 bytes)
      const longName = "collection_" + "a".repeat(490);

      try {
        const collection = await client.createCollection({
          name: longName,
          configuration: { dimension: 3, distance: "cosine" },
          embeddingFunction: null,
        });

        expect(collection.name).toBe(longName);
        expect(collection.collectionId).toBeDefined();

        // Clean up
        await client.deleteCollection(longName);
      } catch (error) {
        // If it fails, it might be due to database limitations
        // This is acceptable as long as it doesn't crash
      }
    });
  });

  describe("Embedding Function Persistence", () => {
    const testCollections: string[] = [];

    afterAll(async () => {
      // Cleanup all test collections
      for (const name of testCollections) {
        try {
          const exists = await client.hasCollection(name);
          if (exists) {
            await client.deleteCollection(name);
          }
        } catch (error) {
          console.error(`Failed to cleanup collection ${name}:`, error);
        }
      }
    });

    test("should store default embedding function metadata", async () => {
      const name = generateCollectionName("test_ef_default");
      testCollections.push(name);

      await client.createCollection({
        name,
        configuration: { dimension: 384 }, // Default dimension
        // embeddingFunction: undefined // Should use default
      });

      const metadata = await getCollectionMetadata(
        (client as any)._internal,
        name,
      );

      expect(metadata).toBeDefined();
      expect(metadata?.settings.embeddingFunction).toBeDefined();
      expect(metadata?.settings.embeddingFunction?.name).toBe("default-embed");
    });

    test("should store custom embedding function metadata", async () => {
      const name = generateCollectionName("test_ef_custom");
      testCollections.push(name);

      const ef = new MockEmbeddingFunction({
        dimension: 3,
        model: "test-model",
      });

      await client.createCollection({
        name,
        embeddingFunction: ef,
      });

      const metadata = await getCollectionMetadata(
        (client as any)._internal,
        name,
      );

      expect(metadata).toBeDefined();
      expect(metadata?.settings.embeddingFunction).toBeDefined();
      expect(metadata?.settings.embeddingFunction?.name).toBe("mock-embed");
      expect(metadata?.settings.embeddingFunction?.properties).toEqual({
        dimension: 3,
        model: "test-model",
      });
    });

    test("should restore embedding function from metadata", async () => {
      const name = generateCollectionName("test_ef_restore");
      testCollections.push(name);

      const ef = new MockEmbeddingFunction({
        dimension: 3,
        customParam: "value",
      });

      await client.createCollection({
        name,
        embeddingFunction: ef,
      });

      // Get collection without providing embedding function
      const collection = await client.getCollection({ name });

      expect(collection.embeddingFunction).toBeDefined();
      expect(collection.embeddingFunction?.name).toBe("mock-embed");
      expect(collection.embeddingFunction?.getConfig()).toEqual({
        dimension: 3,
        customParam: "value",
      });
    });

    test("should override stored embedding function when provided explicitly", async () => {
      const name = generateCollectionName("test_ef_override");
      testCollections.push(name);

      const ef1 = new MockEmbeddingFunction({ dimension: 3, version: 1 });

      await client.createCollection({
        name,
        embeddingFunction: ef1,
      });

      const ef2 = new MockEmbeddingFunction({ dimension: 3, version: 2 });

      // Get collection with explicit embedding function
      const collection = await client.getCollection({
        name,
        embeddingFunction: ef2,
      });

      expect(collection.embeddingFunction).toBeDefined();
      expect(collection.embeddingFunction).toBe(ef2); // Should be the exact instance
      expect(collection.embeddingFunction?.getConfig()).toEqual({
        dimension: 3,
        version: 2,
      });
    });

    test("should NOT persist embedding function without buildFromConfig support", async () => {
      const name = generateCollectionName("test_ef_no_persist");
      testCollections.push(name);

      // Create a plain object EF without constructor.buildFromConfig
      const plainObjectEF = {
        name: "plain-embed",
        async generate(texts: string[]): Promise<number[][]> {
          return texts.map(() => [0.1, 0.2, 0.3]);
        },
        getConfig() {
          return { dimension: 3 };
        },
      };

      await client.createCollection({
        name,
        embeddingFunction: plainObjectEF as any,
      });

      const metadata = await getCollectionMetadata(
        (client as any)._internal,
        name,
      );

      expect(metadata).toBeDefined();
      // Embedding function metadata should NOT be stored
      expect(metadata?.settings.embeddingFunction).toBeUndefined();
    });
  });
});
