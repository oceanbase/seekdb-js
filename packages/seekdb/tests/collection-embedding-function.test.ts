/**
 * Test collection creation with embedding function - testing create_collection,
 * get_or_create_collection, and get_collection interfaces with embedding function handling
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../src/client.js";
import type { HNSWConfiguration } from "../src/types.js";
import { TEST_CONFIG, generateCollectionName } from "./test-utils.js";
import { Simple3DEmbeddingFunction } from "./test-utils.js";
import {
  registerEmbeddingFunction,
  getEmbeddingFunction,
} from "../src/embedding-function.js";
import type { EmbeddingFunction } from "../src/types.js";

describe("Collection Embedding Function Tests", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    client = new SeekdbClient({
      host: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      user: TEST_CONFIG.user,
      password: TEST_CONFIG.password,
      tenant: TEST_CONFIG.tenant,
      database: TEST_CONFIG.database,
    });

    //  preload default embedding function
    try {
      const defaultEf = await getEmbeddingFunction("default");
      console.log("Default embedding function preloaded successfully");
      //  test if the model is loaded
      await defaultEf.generate(["test"]);
      console.log("Model loaded successfully");
    } catch (error) {
      console.warn("Failed to preload default embedding function:", error);
    }
  }, 300000); // 5 minutes timeout for preloading the model

  afterAll(async () => {
    try {
      await client.close();
    } catch (error) {
      console.error("Error closing client:", error);
    }
  });

  describe("createCollection tests", () => {
    test("createCollection with default embedding function", async () => {
      const collectionName = generateCollectionName("test_default_ef");
      console.log(`\nTesting createCollection with default embedding function`);

      // Not providing embeddingFunction should use DefaultEmbeddingFunction
      const collection = await client.createCollection({
        name: collectionName,
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe(collectionName);
      expect(collection.embeddingFunction).toBeDefined();

      expect(collection.dimension).toBe(384);

      console.log(`   Collection dimension: ${collection.dimension}`);

      await client.deleteCollection(collectionName);
    }, 120000); // 2 minutes timeout for creating the collection

    test("createCollection with embeddingFunction=null and explicit configuration", async () => {
      const collectionName = generateCollectionName("test_explicit_none");
      console.log(`\nTesting createCollection with embeddingFunction=null`);

      const config: HNSWConfiguration = { dimension: 128, distance: "cosine" };
      const collection = await client.createCollection({
        name: collectionName,
        configuration: config,
        embeddingFunction: null,
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe(collectionName);
      expect(collection.embeddingFunction).toBeUndefined();
      expect(collection.dimension).toBe(128);

      console.log(`   Collection dimension: ${collection.dimension}`);
      console.log(`   Embedding function: ${collection.embeddingFunction}`);

      await client.deleteCollection(collectionName);
    });

    test("createCollection with custom embedding function", async () => {
      const collectionName = generateCollectionName("test_custom_ef");
      console.log(`\nTesting createCollection with custom embedding function`);

      const customEf = Simple3DEmbeddingFunction();
      const config: HNSWConfiguration = { dimension: 3, distance: "l2" };

      const collection = await client.createCollection({
        name: collectionName,
        configuration: config,
        embeddingFunction: customEf,
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe(collectionName);
      expect(collection.embeddingFunction).toBeDefined();
      expect(collection.embeddingFunction).toBe(customEf);
      expect(collection.dimension).toBe(3);

      console.log(`   Collection dimension: ${collection.dimension}`);

      await client.deleteCollection(collectionName);
    });

    test("createCollection with dimension mismatch should throw error", async () => {
      const collectionName = generateCollectionName("test_dim_mismatch");
      console.log(
        `\nTesting createCollection with dimension mismatch (should fail)`,
      );

      const customEf = Simple3DEmbeddingFunction();
      const config: HNSWConfiguration = { dimension: 128, distance: "cosine" };

      await expect(
        client.createCollection({
          name: collectionName,
          configuration: config,
          embeddingFunction: customEf,
        }),
      ).rejects.toThrow(/dimension/i);

      console.log(`   Correctly raised error for dimension mismatch`);
    });

    test("createCollection with configuration=undefined and embeddingFunction", async () => {
      const collectionName = generateCollectionName("test_config_none_with_ef");
      console.log(
        `\nTesting createCollection with configuration=undefined and embeddingFunction provided`,
      );

      const customEf = Simple3DEmbeddingFunction();
      const collection = await client.createCollection({
        name: collectionName,
        embeddingFunction: customEf,
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe(collectionName);
      expect(collection.embeddingFunction).toBeDefined();
      expect(collection.embeddingFunction).toBe(customEf);
      expect(collection.dimension).toBe(3);

      console.log(`   Collection dimension: ${collection.dimension}`);

      await client.deleteCollection(collectionName);
    });

    test("createCollection with both undefined should use defaults", async () => {
      const collectionName = generateCollectionName("test_both_none");
      console.log(
        `\nTesting createCollection with both undefined (should use defaults)`,
      );

      // When both are undefined, should use DefaultEmbeddingFunction
      const collection = await client.createCollection({
        name: collectionName,
      });

      expect(collection).toBeDefined();
      expect(collection.embeddingFunction).toBeDefined();
      expect(collection.dimension).toBe(384);

      console.log(`   Collection created with default embedding function`);

      await client.deleteCollection(collectionName);
    }, 120000); // 2 minutes timeout for creating the collection
  });

  describe("getCollection tests", () => {
    test("getCollection without embeddingFunction should use default", async () => {
      const collectionName = generateCollectionName("test_get_default_ef");
      console.log(`\nTesting getCollection with default embedding function`);

      // First create a collection
      const config: HNSWConfiguration = { dimension: 384, distance: "cosine" };
      await client.createCollection({
        name: collectionName,
        configuration: config,
      });

      // Then get it without providing embeddingFunction
      const retrievedCollection = await client.getCollection({
        name: collectionName,
      });

      expect(retrievedCollection).toBeDefined();
      expect(retrievedCollection.name).toBe(collectionName);
      expect(retrievedCollection.dimension).toBe(384);
      // When getting, if no embeddingFunction provided, should use default
      expect(retrievedCollection.embeddingFunction).toBeDefined();

      console.log(`   Collection dimension: ${retrievedCollection.dimension}`);

      await client.deleteCollection(collectionName);
    }, 120000); // 2 minutes timeout for getting the collection

    test("getCollection with embeddingFunction=null", async () => {
      const collectionName = generateCollectionName("test_get_explicit_none");
      console.log(`\nTesting getCollection with embeddingFunction=null`);

      // First create a collection
      const config: HNSWConfiguration = { dimension: 128, distance: "cosine" };
      await client.createCollection({
        name: collectionName,
        configuration: config,
        embeddingFunction: null,
      });

      // Then get it with embeddingFunction=null
      const retrievedCollection = await client.getCollection({
        name: collectionName,
        embeddingFunction: null,
      });

      expect(retrievedCollection).toBeDefined();
      expect(retrievedCollection.name).toBe(collectionName);
      expect(retrievedCollection.dimension).toBe(128);
      expect(retrievedCollection.embeddingFunction).toBeUndefined();

      console.log(`   Collection dimension: ${retrievedCollection.dimension}`);
      console.log(
        `   Embedding function: ${retrievedCollection.embeddingFunction}`,
      );

      await client.deleteCollection(collectionName);
    });
  });

  describe("getOrCreateCollection tests", () => {
    test("getOrCreateCollection creating new collection", async () => {
      const collectionName = generateCollectionName("test_get_or_create_new");
      console.log(`\nTesting getOrCreateCollection (create new)`);

      // Collection doesn't exist, should create with default embedding function
      const collection = await client.getOrCreateCollection({
        name: collectionName,
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe(collectionName);
      expect(collection.embeddingFunction).toBeDefined();
      expect(collection.dimension).toBe(384);

      console.log(`   Collection dimension: ${collection.dimension}`);

      await client.deleteCollection(collectionName);
    }, 120000); // 2 minutes timeout for getting the collection

    test("getOrCreateCollection getting existing collection", async () => {
      const collectionName = generateCollectionName(
        "test_get_or_create_existing",
      );
      console.log(`\nTesting getOrCreateCollection (get existing)`);

      // First create a collection
      const config: HNSWConfiguration = { dimension: 128, distance: "cosine" };
      await client.createCollection({
        name: collectionName,
        configuration: config,
        embeddingFunction: null,
      });

      // Then get_or_create it
      const retrievedCollection = await client.getOrCreateCollection({
        name: collectionName,
        configuration: config,
        embeddingFunction: null,
      });

      expect(retrievedCollection).toBeDefined();
      expect(retrievedCollection.name).toBe(collectionName);
      expect(retrievedCollection.dimension).toBe(128);

      console.log(`   Collection dimension: ${retrievedCollection.dimension}`);

      await client.deleteCollection(collectionName);
    });

    test("getOrCreateCollection with custom embedding function", async () => {
      const collectionName = generateCollectionName(
        "test_get_or_create_custom_ef",
      );
      console.log(
        `\nTesting getOrCreateCollection with custom embedding function`,
      );

      const customEf = Simple3DEmbeddingFunction();
      const config: HNSWConfiguration = { dimension: 3, distance: "l2" };

      const collection = await client.getOrCreateCollection({
        name: collectionName,
        configuration: config,
        embeddingFunction: customEf,
      });

      expect(collection).toBeDefined();
      expect(collection.name).toBe(collectionName);
      expect(collection.embeddingFunction).toBeDefined();
      expect(collection.embeddingFunction).toBe(customEf);
      expect(collection.dimension).toBe(3);

      console.log(`   Collection dimension: ${collection.dimension}`);

      await client.deleteCollection(collectionName);
    });
  });

  describe("registerEmbeddingFunction tests", () => {
    test("registerEmbeddingFunction register and use custom model", async () => {
      console.log(`\nTesting registerEmbeddingFunction with custom model`);

      // Define a custom embedding function class
      class CustomModel implements EmbeddingFunction {
        name = "custom_model";
        async generate(texts: string[]): Promise<number[][]> {
          // Returns 4-dimensional vectors
          return texts.map(() => [0.1, 0.2, 0.3, 0.4]);
        }
        getConfig() {
          return {};
        }
      }

      // Register the model
      await registerEmbeddingFunction("my-custom-model", CustomModel);

      // Get an instance of the model
      const ef = await getEmbeddingFunction("my-custom-model");

      expect(ef).toBeDefined();
      // Check if it is an instance of CustomModel
      expect(ef instanceof CustomModel).toBe(true);

      // Verify generate
      const embeddings = await ef.generate(["test"]);
      expect(embeddings.length).toBe(1);
      expect(embeddings[0].length).toBe(4);

      console.log(`   Custom model registered and instantiated successfully`);
      console.log(`   Generated embedding dimension: ${embeddings[0].length}`);

      // Use in collection creation
      const collectionName = generateCollectionName(
        "test_registered_custom_ef",
      );
      const collection = await client.createCollection({
        name: collectionName,
        embeddingFunction: ef,
      });

      expect(collection).toBeDefined();
      expect(collection.dimension).toBe(4);

      console.log(
        `   Collection created with registered custom model, dimension: ${collection.dimension}`,
      );

      await client.deleteCollection(collectionName);
    });
  });
});
