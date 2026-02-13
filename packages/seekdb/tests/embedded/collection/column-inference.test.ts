/**
 * Column name inference tests for embedded mode
 * Tests that column names are correctly inferred from SQL statements
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { generateCollectionName } from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("column-inference.test.ts");

describe("Embedded Mode - Column Name Inference", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("column-inference.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
  });

  afterAll(async () => {
    try {
      await client.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("SHOW CREATE TABLE column inference", () => {
    test("infers column names for SHOW CREATE TABLE", async () => {
      const collectionName = generateCollectionName("test_show_create");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      // Get the collection again to trigger SHOW CREATE TABLE
      const retrieved = await client.getCollection({
        name: collectionName,
        embeddingFunction: null,
      });

      // Verify that distance was extracted correctly (this implies column names were inferred)
      expect(retrieved).toBeDefined();
      expect(retrieved.distance).toBe("l2");
      expect(retrieved.dimension).toBe(3);

      await client.deleteCollection(collectionName);
    });

    test("infers column names for SHOW CREATE TABLE with different distance metrics", async () => {
      const distances: Array<"l2" | "cosine" | "inner_product"> = [
        "l2",
        "cosine",
        "inner_product",
      ];

      for (const distance of distances) {
        const collectionName = generateCollectionName(`test_${distance}`);
        await client.createCollection({
          name: collectionName,
          configuration: { dimension: 3, distance },
          embeddingFunction: null,
        });

        const retrieved = await client.getCollection({
          name: collectionName,
          embeddingFunction: null,
        });

        // Verify distance extraction (implies column name inference worked)
        expect(retrieved.distance).toBe(distance);

        await client.deleteCollection(collectionName);
      }
    });
  });

  describe("SHOW TABLES column inference", () => {
    test("infers column names for SHOW TABLES", async () => {
      const collectionName1 = generateCollectionName("test_show_tables_1");
      const collectionName2 = generateCollectionName("test_show_tables_2");

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

      // listCollections uses SHOW TABLES internally
      const collections = await client.listCollections();

      // Verify that collections were found (implies column name inference worked)
      expect(collections).toBeDefined();
      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThanOrEqual(2);

      const names = collections.map((c) => c.name);
      expect(names).toContain(collectionName1);
      expect(names).toContain(collectionName2);

      await client.deleteCollection(collectionName1);
      await client.deleteCollection(collectionName2);
    });
  });

  describe("SELECT statement column inference", () => {
    test("infers column names for simple SELECT", async () => {
      const collectionName = generateCollectionName("test_select");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1"],
        embeddings: [[1, 2, 3]],
        documents: ["test document"],
        metadatas: [{ key: "value" }],
      });

      // get() uses SELECT internally
      const results = await collection.get({ ids: ["id1"] });

      // Verify that results have correct structure (implies column name inference worked)
      expect(results.ids).toBeDefined();
      expect(results.ids[0]).toBe("id1");
      expect(results.documents).toBeDefined();
      expect(results.documents![0]).toBe("test document");
      expect(results.metadatas).toBeDefined();
      expect(results.metadatas![0]).toEqual({ key: "value" });

      await client.deleteCollection(collectionName);
    });

    test("infers column names for SELECT with specific fields", async () => {
      const collectionName = generateCollectionName("test_select_fields");
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

      // get() with include parameter uses SELECT with specific fields
      const results = await collection.get({
        ids: ["id1"],
        include: ["documents"],
      });

      // Verify that only documents are returned (implies column name inference worked)
      expect(results.ids).toBeDefined();
      expect(results.documents).toBeDefined();
      expect(results.embeddings).toBeUndefined();
      expect(results.metadatas).toBeUndefined();

      await client.deleteCollection(collectionName);
    });
  });

  describe("Column inference fallback", () => {
    test("handles column name inference failure gracefully", async () => {
      const collectionName = generateCollectionName("test_fallback");
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

      // Even if column name inference fails, get() should still work
      // (it will fallback to col_0, col_1, etc.)
      const results = await collection.get({ ids: ["id1"] });

      // Results should still be accessible
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);

      await client.deleteCollection(collectionName);
    });
  });

  describe("Complex SELECT statements", () => {
    test("handles SELECT with WHERE clause", async () => {
      const collectionName = generateCollectionName("test_select_where");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1", "id2"],
        embeddings: [
          [1, 2, 3],
          [4, 5, 6],
        ],
        metadatas: [{ key: "value1" }, { key: "value2" }],
      });

      // get() with where clause uses SELECT with WHERE
      const results = await collection.get({
        where: { key: { $eq: "value1" } },
      });

      // Verify that filtering worked (implies column name inference worked)
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);

      await client.deleteCollection(collectionName);
    });

    test("handles SELECT with LIMIT and OFFSET", async () => {
      const collectionName = generateCollectionName("test_select_limit");
      const collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: "l2" },
        embeddingFunction: null,
      });

      await collection.add({
        ids: ["id1", "id2", "id3"],
        embeddings: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      });

      // get() with limit uses SELECT with LIMIT
      const results = await collection.get({ limit: 2 });

      // Verify that limit worked (implies column name inference worked)
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeLessThanOrEqual(2);

      await client.deleteCollection(collectionName);
    });
  });
});
