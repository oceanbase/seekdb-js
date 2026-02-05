/**
 * Embedded mode - Collection fork operations (same coverage as server collection-fork.test.ts)
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { Collection } from "../../../src/collection.js";
import { generateCollectionName } from "../../test-utils.js";
import { SeekdbValueError } from "../../../src/errors.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("collection-fork.test.ts");

describe("Embedded Mode - Collection Fork Operations", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    await cleanupTestDb("collection-fork.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  describe("Embedded Mode Collection Fork", () => {
    let sourceCollection: Collection;
    let sourceCollectionName: string;
    let targetCollectionName: string;

    beforeAll(async () => {
      sourceCollectionName = generateCollectionName("test_fork_source");
      sourceCollection = await client.createCollection({
        name: sourceCollectionName,
        configuration: { dimension: 3, distance: "cosine" },
        embeddingFunction: null,
      });
      await sourceCollection.add({
        ids: ["id1", "id2", "id3"],
        embeddings: [
          [1.0, 2.0, 3.0],
          [4.0, 5.0, 6.0],
          [7.0, 8.0, 9.0],
        ],
        metadatas: [
          { type: "A", value: 10 },
          { type: "B", value: 20 },
          { type: "A", value: 30 },
        ],
        documents: ["doc1", "doc2", "doc3"],
      });
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(sourceCollectionName);
        if (targetCollectionName) {
          await client.deleteCollection(targetCollectionName);
        }
      } catch {
        // ignore
      }
    });

    test("fork - create a valid fork and verify data", async () => {
      targetCollectionName = generateCollectionName("test_fork_target");
      const targetCollection = await sourceCollection.fork({
        name: targetCollectionName,
      });

      expect(targetCollection).toBeDefined();
      expect(targetCollection.name).toBe(targetCollectionName);

      const result = await targetCollection.get();
      expect(result.ids.length).toBe(3);
      expect(result.ids).toContain("id1");
      expect(result.ids).toContain("id2");
      expect(result.ids).toContain("id3");
      const id1Idx = result.ids.indexOf("id1");
      expect(result.embeddings![id1Idx]).toEqual([1.0, 2.0, 3.0]);
      expect(result.metadatas![id1Idx]).toEqual({ type: "A", value: 10 });
    });

    test("fork - verify isolation (source changes do not affect target)", async () => {
      const tempTargetName = generateCollectionName("test_fork_isolation_1");
      const tempTarget = await sourceCollection.fork({ name: tempTargetName });

      await sourceCollection.add({
        ids: "id_new_source",
        embeddings: [10.0, 11.0, 12.0],
        metadatas: { type: "new" },
        documents: "new source doc",
      });

      const sourceResult = await sourceCollection.get();
      expect(sourceResult.ids.length).toBe(4);
      const targetResult = await tempTarget.get();
      expect(targetResult.ids.length).toBe(3);
      expect(targetResult.ids).not.toContain("id_new_source");

      try {
        await client.deleteCollection(tempTargetName);
      } catch {
        // ignore
      }
    });

    test("fork - verify isolation (target changes do not affect source)", async () => {
      const sourceCountResult = await sourceCollection.get();
      const initialSourceCount = sourceCountResult.ids.length;

      const tempTargetName = generateCollectionName("test_fork_isolation_2");
      const tempTarget = await sourceCollection.fork({ name: tempTargetName });

      await tempTarget.add({
        ids: "id_new_target",
        embeddings: [20.0, 21.0, 22.0],
        metadatas: { type: "new_target" },
        documents: "new target doc",
      });

      const targetResult = await tempTarget.get();
      expect(targetResult.ids.length).toBe(initialSourceCount + 1);
      expect(targetResult.ids).toContain("id_new_target");
      const sourceResult = await sourceCollection.get();
      expect(sourceResult.ids.length).toBe(initialSourceCount);
      expect(sourceResult.ids).not.toContain("id_new_target");

      try {
        await client.deleteCollection(tempTargetName);
      } catch {
        // ignore
      }
    });

    test("fork - throws error if target collection already exists", async () => {
      await expect(async () => {
        await sourceCollection.fork({ name: sourceCollectionName });
      }).rejects.toThrow(SeekdbValueError);

      const existingName = generateCollectionName("existing_collection");
      await client.createCollection({
        name: existingName,
        configuration: { dimension: 3 },
        embeddingFunction: null,
      });

      await expect(async () => {
        await sourceCollection.fork({ name: existingName });
      }).rejects.toThrow();

      try {
        await client.deleteCollection(existingName);
      } catch {
        // ignore
      }
    });
  });
});
