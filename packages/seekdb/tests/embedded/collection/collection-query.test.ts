/**
 * Collection query tests - testing collection.query() interface for Embedded mode
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { Collection } from "../../../src/collection.js";
import {
  generateCollectionName,
  Simple3DEmbeddingFunction,
} from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";
import {
  Schema,
  SparseVectorIndexConfig,
  VectorIndexConfig,
  FullTextIndexConfig,
} from "../../../src/schema.js";
import { K } from "../../../src/key.js";
import { SeekdbValueError } from "../../../src/errors.js";
import { registerSparseEmbeddingFunction } from "../../../src/embedding-function.js";
import type {
  EmbeddingConfig,
  EmbeddingFunction,
  SparseEmbeddingFunction,
  SparseVector,
} from "../../../src/types.js";

// ---- sparse EF fixture for query tests ----
const SPARSE_EF_NAME_QUERY = "test-sparse-query";
const DENSE_DIM_QUERY = 3;

class QueryTestSparseEF implements SparseEmbeddingFunction {
  readonly name = SPARSE_EF_NAME_QUERY;
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
  static buildFromConfig(): QueryTestSparseEF {
    return new QueryTestSparseEF();
  }
}

class QueryTestDenseEF implements EmbeddingFunction {
  readonly name = "test-dense-query";
  readonly dimension = DENSE_DIM_QUERY;
  async generate(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const h = t.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      return [(h % 10) / 10, ((h >> 4) % 10) / 10, ((h >> 8) % 10) / 10];
    });
  }
  getConfig(): EmbeddingConfig {
    return { dimension: DENSE_DIM_QUERY };
  }
}

try {
  registerSparseEmbeddingFunction(
    SPARSE_EF_NAME_QUERY,
    QueryTestSparseEF as any
  );
} catch {
  /* already registered */
}

const TEST_CONFIG = getEmbeddedTestConfig("collection-query.test.ts");

describe("Embedded Mode - Collection Query Operations", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("collection-query.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("Embedded Mode Collection Query", () => {
    let collection: Collection;
    let collectionName: string;

    beforeAll(async () => {
      collectionName = generateCollectionName("test_query");
      collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1", "id2", "id3", "id4", "id5"],
        embeddings: [
          [1.0, 2.0, 3.0],
          [2.0, 3.0, 4.0],
          [1.1, 2.1, 3.1],
          [2.1, 3.1, 4.1],
          [1.2, 2.2, 3.2],
        ],
        documents: [
          "This is a test document about machine learning",
          "Python programming tutorial for beginners",
          "Advanced machine learning algorithms",
          "Data science with Python",
          "Introduction to neural networks",
        ],
        metadatas: [
          { category: "AI", score: 95, tag: "ml" },
          { category: "Programming", score: 88, tag: "python" },
          { category: "AI", score: 92, tag: "ml" },
          { category: "Data Science", score: 90, tag: "python" },
          { category: "AI", score: 85, tag: "neural" },
        ],
      });
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test("basic vector similarity query", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        nResults: 3,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);
      expect(results.ids[0].length).toBeGreaterThan(0);
    });

    test("query with metadata filter using comparison operators", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { score: { $gte: 90 } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with combined filters", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { category: { $eq: "AI" }, score: { $gte: 90 } },
        whereDocument: { $contains: "machine" },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with document filter using regex", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        whereDocument: { $regex: ".*[Pp]ython.*" },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with $in operator", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { tag: { $in: ["ml", "python"] } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with multiple vectors (returns dict with lists of lists)", async () => {
      const queryVector1 = [1.0, 2.0, 3.0];
      const queryVector2 = [2.0, 3.0, 4.0];
      const queryVector3 = [1.1, 2.1, 3.1];

      const results = await collection.query({
        queryEmbeddings: [queryVector1, queryVector2, queryVector3],
        nResults: 2,
      });

      expect(results).toBeDefined();
      expect(typeof results).toBe("object");
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(3);

      for (let i = 0; i < results.ids.length; i++) {
        expect(results.ids[i].length).toBeGreaterThan(0);
      }
    });

    test("single vector returns dict format", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        nResults: 2,
      });

      expect(results).toBeDefined();
      expect(typeof results).toBe("object");
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(1);
      expect(results.ids[0].length).toBeGreaterThan(0);
    });

    test("query with include parameter", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        include: ["documents", "metadatas"],
        nResults: 3,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();

      if (results.ids[0].length > 0) {
        expect(results.documents).toBeDefined();
        expect(results.metadatas).toBeDefined();
        expect(results.ids[0].length).toBe(results.documents![0].length);
        expect(results.ids[0].length).toBe(results.metadatas![0].length);
      }
    });

    test("query with logical operators ($or)", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: {
          $or: [{ category: { $eq: "AI" } }, { tag: { $eq: "python" } }],
        },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with include parameter to get specific fields", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        include: ["documents", "metadatas", "embeddings"],
        nResults: 3,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();

      if (results.ids[0].length > 0) {
        expect(results.documents).toBeDefined();
        expect(results.metadatas).toBeDefined();
        expect(results.embeddings).toBeDefined();
        expect(results.ids[0].length).toBe(results.documents![0].length);
      }
    });

    test("query with $ne (not equal) operator", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { category: { $ne: "AI" } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      if (results.ids[0].length > 0 && results.metadatas) {
        for (const metadata of results.metadatas[0]) {
          if (metadata) {
            expect(metadata.category).not.toBe("AI");
          }
        }
      }
    });

    test("query with $lt (less than) operator", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { score: { $lt: 90 } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      if (results.ids[0].length > 0 && results.metadatas) {
        for (const metadata of results.metadatas[0]) {
          if (metadata && metadata.score !== undefined) {
            expect(metadata.score).toBeLessThan(90);
          }
        }
      }
    });

    test("query with $lte (less than or equal) operator", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { score: { $lte: 88 } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with $gt (greater than) operator", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { score: { $gt: 90 } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      if (results.ids[0].length > 0 && results.metadatas) {
        for (const metadata of results.metadatas[0]) {
          if (metadata && metadata.score !== undefined) {
            expect(metadata.score).toBeGreaterThan(90);
          }
        }
      }
    });

    test("query with $nin (not in) operator", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: { tag: { $nin: ["ml", "python"] } },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with $and operator combining multiple conditions", async () => {
      const queryVector = [1.0, 2.0, 3.0];
      const results = await collection.query({
        queryEmbeddings: queryVector,
        where: {
          $and: [
            { category: { $eq: "AI" } },
            { score: { $gte: 90 } },
            { tag: { $in: ["ml", "neural"] } },
          ],
        },
        nResults: 5,
      });

      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test("query with queryTexts using embedding function", async () => {
      const ef = Simple3DEmbeddingFunction();
      const collectionWithEF = await client.createCollection({
        name: generateCollectionName("test_query_ef"),
        embeddingFunction: ef,
      });

      await collectionWithEF.add({
        ids: ["ef1", "ef2"],
        documents: ["test document 1", "test document 2"],
      });

      const results = await collectionWithEF.query({
        queryTexts: "test document",
        nResults: 2,
      });

      expect(results.ids).toBeDefined();
      expect(results.ids[0].length).toBeGreaterThan(0);

      await client.deleteCollection(collectionWithEF.name);
    });
  });

  // ==================== Schema + Sparse - Query Operations ====================

  describe("Schema + Sparse - query() with sparseEmbedding", () => {
    let sparseCollection: Collection;
    let sparseCollectionName: string;

    const DOCS = [
      "machine learning artificial intelligence",
      "vector database similarity search",
      "deep neural network training optimization",
    ];

    beforeAll(async () => {
      sparseCollectionName = generateCollectionName("query_sparse");
      sparseCollection = await client.createCollection({
        name: sparseCollectionName,
        schema: new Schema()
          .createIndex(
            new VectorIndexConfig({
              hnsw: { dimension: DENSE_DIM_QUERY, distance: "l2" },
              embeddingFunction: new QueryTestDenseEF(),
            })
          )
          .createIndex(new FullTextIndexConfig())
          .createIndex(
            new SparseVectorIndexConfig({
              sourceKey: K.DOCUMENT,
              embeddingFunction: new QueryTestSparseEF(),
            })
          ),
      });
      await sparseCollection.add({
        ids: ["sq1", "sq2", "sq3"],
        documents: DOCS,
        metadatas: [{ tag: "ml" }, { tag: "db" }, { tag: "dl" }],
      });
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(sparseCollectionName);
      } catch {
        /* ignore */
      }
    });

    test("query() with queryKey K.SPARSE_EMBEDDING and queryTexts returns results", async () => {
      const result = await sparseCollection.query({
        queryTexts: ["machine learning"],
        queryKey: K.SPARSE_EMBEDDING,
        nResults: 3,
        include: ["documents", "distances"],
      });
      expect(result.ids).toHaveLength(1);
      expect(result.ids[0].length).toBeGreaterThan(0);
      expect(result.distances).toBeDefined();
    });

    test("query() with queryKey 'sparseEmbedding' string returns results", async () => {
      const result = await sparseCollection.query({
        queryTexts: ["neural network"],
        queryKey: "sparseEmbedding",
        nResults: 2,
      });
      expect(result.ids).toHaveLength(1);
    });

    test("query() with direct SparseVector as queryEmbeddings", async () => {
      const wordKey = "vector"
        .split("")
        .reduce((a, c) => a + c.charCodeAt(0), 0);
      const result = await sparseCollection.query({
        queryEmbeddings: { [wordKey]: 1.0 } as SparseVector,
        nResults: 2,
      });
      expect(result.ids).toHaveLength(1);
    });

    test("query() with array of SparseVectors returns multiple result sets", async () => {
      const k1 = "machine".split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const k2 = "neural".split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const result = await sparseCollection.query({
        queryEmbeddings: [{ [k1]: 1.0 }, { [k2]: 1.0 }] as SparseVector[],
        nResults: 2,
      });
      expect(result.ids).toHaveLength(2);
    });

    test("query() with K.SPARSE_EMBEDDING and metadata where filter", async () => {
      const result = await sparseCollection.query({
        queryTexts: ["learning"],
        queryKey: K.SPARSE_EMBEDDING,
        where: { tag: { $eq: "ml" } },
        nResults: 3,
      });
      expect(result.ids).toHaveLength(1);
    });

    test("query() with K.SPARSE_EMBEDDING throws when no sparseEmbeddingFunction", async () => {
      const noEfName = generateCollectionName("query_sparse_no_ef");
      const noEfColl = await client.createCollection({
        name: noEfName,
        schema: new Schema()
          .createIndex(
            new VectorIndexConfig({
              hnsw: { distance: "l2" },
            })
          )
          .createIndex(new FullTextIndexConfig())
          .createIndex(new SparseVectorIndexConfig({ sourceKey: K.DOCUMENT })),
      });
      await expect(
        noEfColl.query({
          queryTexts: ["test"],
          queryKey: K.SPARSE_EMBEDDING,
          nResults: 1,
        })
      ).rejects.toThrow(SeekdbValueError);
      await client.deleteCollection(noEfName);
    });
  });
});
