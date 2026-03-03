/**
 * Embedded integration tests for sparse vector index support:
 * - Schema with SparseVectorIndexConfig
 * - auto sparse embedding generation (document / metadata field)
 * - query() with K.SPARSE_EMBEDDING (queryTexts and queryEmbeddings)
 * - Schema persistence via getCollection()
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import {
  Schema,
  SparseVectorIndexConfig,
  VectorIndexConfig,
  FullTextIndexConfig,
} from "../../../src/schema.js";
import { K } from "../../../src/key.js";
import { SeekdbValueError } from "../../../src/errors.js";
import { registerSparseEmbeddingFunction } from "../../../src/embedding-function.js";
import { generateCollectionName } from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";
import type {
  EmbeddingConfig,
  EmbeddingFunction,
  SourceKey,
  SparseEmbeddingFunction,
  SparseVector,
} from "../../../src/types.js";

const TEST_FILE = "sparse-vector.test.ts";
const TEST_CONFIG = getEmbeddedTestConfig(TEST_FILE);

// ==================== Test Fixtures ====================
const SPARSE_EF_NAME = "test-sparse-client";
const DENSE_DIM = 3;

class ClientTestSparseEF implements SparseEmbeddingFunction {
  readonly name = SPARSE_EF_NAME;
  async generate(texts: string[]): Promise<SparseVector[]> {
    return texts.map((t) => {
      const v: SparseVector = {};
      t.split(/\s+/).forEach((w) => {
        const k = w.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        v[k] = (v[k] ?? 0) + 1;
      });
      return v;
    });
  }
  getConfig(): EmbeddingConfig {
    return {};
  }
  static buildFromConfig(): ClientTestSparseEF {
    return new ClientTestSparseEF();
  }
}

class ClientTestDenseEF implements EmbeddingFunction {
  readonly name = "test-dense-client";
  readonly dimension = DENSE_DIM;
  async generate(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const h = t.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      return [(h % 10) / 10, ((h >> 4) % 10) / 10, ((h >> 8) % 10) / 10];
    });
  }
  getConfig(): EmbeddingConfig {
    return { dimension: DENSE_DIM };
  }
}

try {
  registerSparseEmbeddingFunction(SPARSE_EF_NAME, ClientTestSparseEF as any);
} catch {
  /* already registered */
}

/**
 * Deterministic sparse embedding function for tests.
 * Maps each character code in the first 5 chars to a weight.
 */
class TestSparseEmbeddingFunction implements SparseEmbeddingFunction {
  readonly name = SPARSE_EF_NAME;

  async generate(texts: string[]): Promise<SparseVector[]> {
    return texts.map((text) => {
      const result: SparseVector = {};
      const words = text.toLowerCase().split(/\s+/);
      for (const word of words) {
        if (!word) continue;
        // Use sum of char codes as a hash key
        const key = word.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
        result[key] = (result[key] ?? 0) + 1.0;
      }
      return result;
    });
  }

  async generateForQueries(texts: string[]): Promise<SparseVector[]> {
    return this.generate(texts);
  }

  getConfig(): EmbeddingConfig {
    return {};
  }

  static buildFromConfig(): TestSparseEmbeddingFunction {
    return new TestSparseEmbeddingFunction();
  }
}

/** Deterministic 3-dim dense embedding function for tests. */
class TestDenseEmbeddingFunction implements EmbeddingFunction {
  readonly name = "test-dense-3d";
  readonly dimension = DENSE_DIM;

  async generate(texts: string[]): Promise<number[][]> {
    return texts.map((text) => {
      const h = text.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      return [(h % 10) / 10, ((h >> 4) % 10) / 10, ((h >> 8) % 10) / 10];
    });
  }

  getConfig(): EmbeddingConfig {
    return { dimension: DENSE_DIM };
  }

  static buildFromConfig(): TestDenseEmbeddingFunction {
    return new TestDenseEmbeddingFunction();
  }
}

// Register once (guard against multiple hot-reloads in watch mode)
try {
  registerSparseEmbeddingFunction(
    SPARSE_EF_NAME,
    TestSparseEmbeddingFunction as any
  );
} catch {
  // already registered
}

// ==================== Helpers ====================

function makeSparseEF() {
  return new TestSparseEmbeddingFunction();
}

function makeDenseEF() {
  return new TestDenseEmbeddingFunction();
}

function makeSparseSchema(sourceKey: SourceKey = K.DOCUMENT) {
  return new Schema()
    .createIndex(
      new VectorIndexConfig({
        hnsw: { dimension: DENSE_DIM, distance: "l2" },
        embeddingFunction: makeDenseEF(),
      })
    )
    .createIndex(new FullTextIndexConfig())
    .createIndex(
      new SparseVectorIndexConfig({
        sourceKey,
        embeddingFunction: makeSparseEF(),
      })
    );
}

// ==================== Tests ====================

describe("Embedded - Sparse Vector Index", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb(TEST_FILE);
    client = new SeekdbClient(TEST_CONFIG);
  });

  afterAll(async () => {
    await client.close();
  });

  // ---- Collection Creation ----

  describe("createCollection with sparseVectorIndex schema", () => {
    test("creates collection with sparseVectorIndex using K.DOCUMENT", async () => {
      const name = generateCollectionName("sparse_create");
      const collection = await client.createCollection({
        name,
        schema: makeSparseSchema(),
      });
      expect(collection.name).toBe(name);
      expect(collection.schema?.sparseVectorIndex).toBeDefined();
      expect(collection.schema?.sparseVectorIndex?.sourceKey).toBe(K.DOCUMENT);
      await client.deleteCollection(name);
    });

    test("creates collection with sparseVectorIndex using metadata string key", async () => {
      const name = generateCollectionName("sparse_meta_key");
      const schema = makeSparseSchema(K.METADATA);
      const collection = await client.createCollection({ name, schema });
      expect(collection.schema?.sparseVectorIndex?.sourceKey).toBe(K.METADATA);
      await client.deleteCollection(name);
    });

    test("creates collection with sparse index but no embeddingFunction", async () => {
      const name = generateCollectionName("sparse_no_ef");
      const schema = new Schema()
        .createIndex(
          new VectorIndexConfig({
            hnsw: { dimension: DENSE_DIM, distance: "l2" },
            embeddingFunction: new ClientTestDenseEF(),
          })
        )
        .createIndex(new FullTextIndexConfig())
        .createIndex(new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT }));
      const collection = await client.createCollection({ name, schema });
      expect(collection.schema?.sparseVectorIndex).toBeDefined();
      expect(collection.sparseEmbeddingFunction).toBeUndefined();
      await client.deleteCollection(name);
    });
  });

  // ---- add() with auto sparse embedding generation ----

  describe("add() - auto sparse embedding from document", () => {
    let collectionName: string;

    beforeAll(async () => {
      collectionName = generateCollectionName("sparse_add_doc");
      await client.createCollection({
        name: collectionName,
        schema: makeSparseSchema(K.DOCUMENT),
      });
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch {
        // ignore
      }
    });

    test("add() succeeds and data can be retrieved", async () => {
      const collection = await client.getCollection({ name: collectionName });
      await collection.add({
        ids: ["doc1", "doc2"],
        documents: ["machine learning algorithms", "vector database search"],
        metadatas: [{ category: "ml" }, { category: "db" }],
      });

      const result = await collection.get({ ids: ["doc1", "doc2"] });
      expect(result.ids).toHaveLength(2);
      expect(result.ids).toContain("doc1");
      expect(result.ids).toContain("doc2");
    });

    test("add() with single document", async () => {
      const collection = await client.getCollection({ name: collectionName });
      await collection.add({
        ids: "single_doc",
        documents: "neural network deep learning",
      });

      const result = await collection.get({ ids: ["single_doc"] });
      expect(result.ids).toHaveLength(1);
    });
  });

  // ---- add() with auto sparse embedding from metadata field ----

  describe("add() - auto sparse embedding from metadata field", () => {
    let collectionName: string;

    beforeAll(async () => {
      collectionName = generateCollectionName("sparse_add_meta");
      await client.createCollection({
        name: collectionName,
        schema: makeSparseSchema("metadata.title"),
      });
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch {
        // ignore
      }
    });

    test("add() with metadata title field generates sparse embedding", async () => {
      const collection = await client.getCollection({ name: collectionName });
      await collection.add({
        ids: ["art1", "art2"],
        documents: ["Full article content here.", "Another article body."],
        metadatas: [
          { title: "Introduction to Machine Learning" },
          { title: "Deep Learning Fundamentals" },
        ],
      });

      const result = await collection.get({ ids: ["art1", "art2"] });
      expect(result.ids).toHaveLength(2);
    });

    test("add() when metadata field is missing - does not fail", async () => {
      const collection = await client.getCollection({ name: collectionName });
      // metadata.title is missing -> sparse embedding should be null/skipped, not throw
      await expect(
        collection.add({
          ids: ["art_no_title"],
          documents: ["Content without title metadata."],
          metadatas: [{ author: "unknown" }],
        })
      ).resolves.not.toThrow();
    });
  });

  // ---- query() with K.SPARSE_EMBEDDING ----

  describe("query() with sparseEmbedding queryKey", () => {
    let collectionName: string;

    beforeAll(async () => {
      collectionName = generateCollectionName("sparse_query");
      const collection = await client.createCollection({
        name: collectionName,
        schema: makeSparseSchema(K.DOCUMENT),
      });
      await collection.add({
        ids: ["q1", "q2", "q3"],
        documents: [
          "machine learning artificial intelligence",
          "vector database similarity search",
          "deep neural network training",
        ],
      });
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch {
        // ignore
      }
    });

    test("query() with queryKey K.SPARSE_EMBEDDING and queryTexts returns results", async () => {
      const collection = await client.getCollection({ name: collectionName });
      const result = await collection.query({
        queryTexts: ["machine learning"],
        queryKey: K.SPARSE_EMBEDDING,
        nResults: 3,
        include: ["documents", "distances"],
      });

      expect(result.ids).toHaveLength(1);
      expect(result.ids[0].length).toBeGreaterThan(0);
      expect(result.distances).toBeDefined();
    });

    test("query() with queryKey 'sparseEmbedding' string also works", async () => {
      const collection = await client.getCollection({ name: collectionName });
      const result = await collection.query({
        queryTexts: ["neural network"],
        queryKey: "sparseEmbedding",
        nResults: 2,
      });
      expect(result.ids).toHaveLength(1);
    });

    test("query() with direct SparseVector as queryEmbeddings", async () => {
      const collection = await client.getCollection({ name: collectionName });
      // Build sparse vector manually for "machine"
      const machineKey = "machine"
        .split("")
        .reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const sparseQuery: SparseVector = { [machineKey]: 1.0 };

      const result = await collection.query({
        queryEmbeddings: sparseQuery,
        nResults: 2,
        include: ["documents"],
      });
      expect(result.ids).toHaveLength(1);
    });

    test("query() with array of SparseVectors returns multiple result sets", async () => {
      const collection = await client.getCollection({ name: collectionName });
      const k1 = "vector"
        .split("")
        .reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const k2 = "neural"
        .split("")
        .reduce((acc, c) => acc + c.charCodeAt(0), 0);

      const result = await collection.query({
        queryEmbeddings: [{ [k1]: 1.0 }, { [k2]: 1.0 }],
        nResults: 2,
      });
      expect(result.ids).toHaveLength(2);
    });

    test("query() with queryKey K.SPARSE_EMBEDDING without sparseEmbeddingFunction throws", async () => {
      // Collection with sparseVectorIndex but no embeddingFunction
      const noEfName = generateCollectionName("sparse_no_ef_query");
      const noEfSchema = new Schema()
        .createIndex(
          new VectorIndexConfig({
            hnsw: { dimension: DENSE_DIM, distance: "l2" },
          })
        )
        .createIndex(new FullTextIndexConfig())
        .createIndex(new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT }));

      const noEfCollection = await client.createCollection({
        name: noEfName,
        schema: noEfSchema,
      });

      await expect(
        noEfCollection.query({
          queryTexts: ["test"],
          queryKey: K.SPARSE_EMBEDDING,
          nResults: 1,
        })
      ).rejects.toThrow(SeekdbValueError);

      await client.deleteCollection(noEfName);
    });
  });

  // ---- upsert() with sparse auto-generation ----

  describe("upsert() with sparse auto-generation", () => {
    let collectionName: string;

    beforeAll(async () => {
      collectionName = generateCollectionName("sparse_upsert");
      await client.createCollection({
        name: collectionName,
        schema: makeSparseSchema(K.DOCUMENT),
      });
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch {
        // ignore
      }
    });

    test("upsert() inserts new docs with sparse embedding", async () => {
      const collection = await client.getCollection({ name: collectionName });
      await collection.upsert({
        ids: ["u1", "u2"],
        documents: [
          "transformer attention mechanism",
          "convolutional neural networks",
        ],
      });
      const result = await collection.get({ ids: ["u1", "u2"] });
      expect(result.ids).toHaveLength(2);
    });

    test("upsert() updates existing docs and regenerates sparse embedding", async () => {
      const collection = await client.getCollection({ name: collectionName });
      await collection.upsert({
        ids: ["u1"],
        documents: ["updated transformer content recurrent"],
      });
      const result = await collection.get({
        ids: ["u1"],
        include: ["documents"],
      });
      expect(result.documents?.[0]).toContain("updated");
    });
  });

  // ---- Schema Persistence (getCollection restores schema) ----

  describe("Schema persistence via getCollection()", () => {
    let collectionName: string;

    beforeAll(async () => {
      collectionName = generateCollectionName("sparse_persist");
      await client.createCollection({
        name: collectionName,
        schema: makeSparseSchema(K.DOCUMENT),
      });
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch {
        // ignore
      }
    });

    test("getCollection() restores sparseVectorIndex sourceKey", async () => {
      const collection = await client.getCollection({ name: collectionName });
      expect(collection.schema?.sparseVectorIndex).toBeDefined();
      // sourceKey K.DOCUMENT serializes as "#document" string after roundtrip
      const sourceKey = collection.schema?.sparseVectorIndex?.sourceKey;
      const sourceKeyName =
        typeof sourceKey === "string" ? sourceKey : (sourceKey as any)?.name;
      expect(sourceKeyName).toBe("#document");
    });

    test("getCollection() restores sparseEmbeddingFunction by name from registry", async () => {
      const collection = await client.getCollection({ name: collectionName });
      expect(collection.sparseEmbeddingFunction?.name).toBe(SPARSE_EF_NAME);
    });

    test("getCollection() can add and query after restoration", async () => {
      const collection = await client.getCollection({ name: collectionName });
      await collection.add({
        ids: ["persist1"],
        documents: ["restored sparse embedding generation"],
      });
      const result = await collection.query({
        queryTexts: ["sparse embedding"],
        queryKey: K.SPARSE_EMBEDDING,
        nResults: 1,
      });
      expect(result.ids[0]).toContain("persist1");
    });
  });
});
