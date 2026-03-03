/**
 * Test collection creation with embedding function - testing create_collection,
 * get_or_create_collection, and get_collection interfaces with embedding function handling for Embedded mode
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import type { HNSWConfiguration } from "../../../src/types.js";
import {
  generateCollectionName,
  Simple3DEmbeddingFunction,
} from "../../test-utils.js";
import { SeekdbValueError } from "../../../src/errors.js";
import { Schema, VectorIndexConfig } from "../../../src/schema.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig(
  "collection-embedding-function.test.ts"
);

describe("Embedded Mode - Collection Embedding Function Tests", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("collection-embedding-function.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
  });

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
    });

    test("createCollection with schema.vectorIndex.embeddingFunction=null does not use default embedding function", async () => {
      const collectionName = generateCollectionName("test_schema_ef_null");
      const collection = await client.createCollection({
        name: collectionName,
        schema: new Schema({
          vectorIndex: new VectorIndexConfig({
            embeddingFunction: null,
            hnsw: { dimension: 3, distance: "cosine" },
          }),
        }),
      });

      expect(collection).toBeDefined();
      expect(collection.embeddingFunction).toBeUndefined();
      expect(collection.embeddingFunction?.name).not.toBe("default-embed");
      expect(collection.dimension).toBe(3);

      await client.deleteCollection(collectionName);
    });

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
    });

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
    });
  });

  describe("createCollection parameter priority (schema > configuration > embeddingFunction)", () => {
    test("when schema.vectorIndex.hnsw and configuration and embeddingFunction all set, schema wins for dimension and distance", async () => {
      const collectionName = generateCollectionName("test_priority_hnsw");
      const collection = await client.createCollection({
        name: collectionName,
        schema: new Schema({
          vectorIndex: new VectorIndexConfig({
            hnsw: { dimension: 3, distance: "cosine" },
          }),
        }),
        configuration: { dimension: 128, distance: "l2" },
        embeddingFunction: Simple3DEmbeddingFunction(),
      });

      expect(collection.dimension).toBe(3);
      expect(collection.distance).toBe("cosine");
      await client.deleteCollection(collectionName);
    });

    test("when schema.vectorIndex.embeddingFunction is null, options.embeddingFunction is ignored", async () => {
      const collectionName = generateCollectionName("test_priority_ef_null");
      const collection = await client.createCollection({
        name: collectionName,
        schema: new Schema({
          vectorIndex: new VectorIndexConfig({
            embeddingFunction: null,
            hnsw: { dimension: 3, distance: "cosine" },
          }),
        }),
        embeddingFunction: Simple3DEmbeddingFunction(),
      });

      expect(collection.embeddingFunction).toBeUndefined();
      expect(collection.dimension).toBe(3);
      await client.deleteCollection(collectionName);
    });

    test("when schema.vectorIndex.embeddingFunction and options.embeddingFunction both set, schema EF wins", async () => {
      const collectionName = generateCollectionName("test_priority_ef_schema");
      const schemaEF = Simple3DEmbeddingFunction();
      const optionsEF = Simple3DEmbeddingFunction();
      const collection = await client.createCollection({
        name: collectionName,
        schema: new Schema({
          vectorIndex: new VectorIndexConfig({
            embeddingFunction: schemaEF,
            hnsw: { dimension: 3, distance: "cosine" },
          }),
        }),
        embeddingFunction: optionsEF,
      });

      expect(collection.embeddingFunction).toBe(schemaEF);
      expect(collection.embeddingFunction).not.toBe(optionsEF);
      expect(collection.dimension).toBe(3);
      await client.deleteCollection(collectionName);
    });

    test("schema dimension 5 and embeddingFunction null overrides configuration and options.embeddingFunction", async () => {
      const collectionName = generateCollectionName(
        "test_priority_schema_dim_no_ef"
      );
      const collection = await client.createCollection({
        name: collectionName,
        schema: new Schema({
          vectorIndex: new VectorIndexConfig({
            embeddingFunction: null,
            hnsw: { dimension: 5, distance: "l2" },
          }),
        }),
        configuration: { dimension: 3, distance: "cosine" },
        embeddingFunction: Simple3DEmbeddingFunction(),
      });

      expect(collection.dimension).toBe(5);
      expect(collection.distance).toBe("l2");
      expect(collection.embeddingFunction).toBeUndefined();
      await client.deleteCollection(collectionName);
    });

    test("getCollection config matches createCollection (schema priority)", async () => {
      const collectionName = generateCollectionName(
        "test_get_collection_schema_priority"
      );
      await client.createCollection({
        name: collectionName,
        schema: new Schema({
          vectorIndex: new VectorIndexConfig({
            embeddingFunction: null,
            hnsw: { dimension: 3, distance: "cosine" },
          }),
        }),
        configuration: { dimension: 128, distance: "l2" },
        embeddingFunction: Simple3DEmbeddingFunction(),
      });

      const retrieved = await client.getCollection({
        name: collectionName,
        embeddingFunction: null,
      });

      expect(retrieved.dimension).toBe(3);
      expect(retrieved.distance).toBe("cosine");
      expect(retrieved.embeddingFunction).toBeUndefined();

      await client.deleteCollection(collectionName);
    });

    test("Simple add after create with schema priority", async () => {
      const collectionName = generateCollectionName("test_priority_add_schema");
      const collection = await client.createCollection({
        name: collectionName,
        schema: new Schema({
          vectorIndex: new VectorIndexConfig({
            embeddingFunction: null,
            hnsw: { dimension: 3, distance: "cosine" },
          }),
        }),
        configuration: { dimension: 128, distance: "l2" },
        embeddingFunction: Simple3DEmbeddingFunction(),
      });

      await collection.add({
        ids: "priority_add_1",
        embeddings: [[1, 2, 3]],
      });

      const results = await collection.get({ ids: "priority_add_1" });

      expect(results.ids).toContain("priority_add_1");
      expect(results.embeddings).toBeDefined();
      const embeddings = results.embeddings!;
      expect(embeddings.length).toBe(1);
      expect(embeddings[0]!.length).toBe(3);

      await client.deleteCollection(collectionName);
    });
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
    });

    test("getOrCreateCollection with schema.vectorIndex.embeddingFunction=null does not use default embedding function", async () => {
      const collectionName = generateCollectionName(
        "test_get_or_create_schema_ef_null"
      );
      const collection = await client.getOrCreateCollection({
        name: collectionName,
        schema: new Schema({
          vectorIndex: new VectorIndexConfig({
            embeddingFunction: null,
            hnsw: { dimension: 3, distance: "cosine" },
          }),
        }),
      });

      expect(collection).toBeDefined();
      expect(collection.embeddingFunction).toBeUndefined();
      expect(collection.embeddingFunction?.name).not.toBe("default-embed");
      expect(collection.dimension).toBe(3);

      await client.deleteCollection(collectionName);
    });
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
    });
  });
});
