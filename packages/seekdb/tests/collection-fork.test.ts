import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../src/client.js";
import { Collection } from "../src/collection.js";
import { TEST_CONFIG, generateCollectionName } from "./test-utils.js";
import { SeekdbValueError } from "../src/errors.js";

describe("Collection Fork Operations", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    client = new SeekdbClient(TEST_CONFIG);
  });

  afterAll(async () => {
    await client.close();
  });

  describe("Server Mode Collection Fork", () => {
    let sourceCollection: Collection;
    let sourceCollectionName: string;
    let targetCollectionName: string;

    beforeAll(async () => {
      sourceCollectionName = generateCollectionName("test_fork_source");
      // Create source collection
      sourceCollection = await client.createCollection({
        name: sourceCollectionName,
        configuration: { dimension: 3, distance: "cosine" },
        embeddingFunction: null,
      });

      // Insert some data into source collection
      await sourceCollection.add({
        ids: ["id1", "id2", "id3"],
        embeddings: [
          [1.0, 2.0, 3.0],
          [4.0, 5.0, 6.0],
          [7.0, 8.0, 9.0]
        ],
        metadatas: [
          { type: "A", value: 10 },
          { type: "B", value: 20 },
          { type: "A", value: 30 }
        ],
        documents: ["doc1", "doc2", "doc3"]
      });
    });

    afterAll(async () => {
      // Cleanup
      try {
        await client.deleteCollection(sourceCollectionName);
        if (targetCollectionName) {
          await client.deleteCollection(targetCollectionName);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test("fork - create a valid fork and verify data", async () => {
      targetCollectionName = generateCollectionName("test_fork_target");

      // Execute fork
      const targetCollection = await sourceCollection.fork({
        name: targetCollectionName
      });

      expect(targetCollection).toBeDefined();
      // targetCollection.name might be the raw table name (with v2_ prefix) or just the name provided
      // The implementation usually returns the full table name or the logical name. 
      // Based on collection.ts: targetCollectionName is now the logical name
      expect(targetCollection.name).toBe(targetCollectionName);

      // Verify data in target collection
      const result = await targetCollection.get();
      expect(result.ids.length).toBe(3);
      expect(result.ids).toContain("id1");
      expect(result.ids).toContain("id2");
      expect(result.ids).toContain("id3");

      // Verify metadata/embeddings are preserved (sample check)
      const id1Idx = result.ids.indexOf("id1");
      expect(result.embeddings![id1Idx]).toEqual([1.0, 2.0, 3.0]);
      expect(result.metadatas![id1Idx]).toEqual({ type: "A", value: 10 });
    });

    test("fork - verify isolation (source changes do not affect target)", async () => {
      const tempTargetName = generateCollectionName("test_fork_isolation_1");
      const tempTarget = await sourceCollection.fork({ name: tempTargetName });

      // Add new data to source
      await sourceCollection.add({
        ids: "id_new_source",
        embeddings: [10.0, 11.0, 12.0],
        metadatas: { type: "new" },
        documents: "new source doc"
      });

      // Verify source has 4 items
      const sourceResult = await sourceCollection.get();
      expect(sourceResult.ids.length).toBe(4);

      // Verify target still has 3 items
      const targetResult = await tempTarget.get();
      expect(targetResult.ids.length).toBe(3);
      expect(targetResult.ids).not.toContain("id_new_source");

      // Cleanup
      try {
        await client.deleteCollection(tempTargetName);
      } catch (e) {
        // ignore
      }
    });

    test("fork - verify isolation (target changes do not affect source)", async () => {
      // Get current source count
      const sourceCountResult = await sourceCollection.get();
      const initialSourceCount = sourceCountResult.ids.length;

      const tempTargetName = generateCollectionName("test_fork_isolation_2");
      const tempTarget = await sourceCollection.fork({ name: tempTargetName });

      // Add new data to target
      await tempTarget.add({
        ids: "id_new_target",
        embeddings: [20.0, 21.0, 22.0],
        metadatas: { type: "new_target" },
        documents: "new target doc"
      });

      // Verify target has initial + 1 items
      const targetResult = await tempTarget.get();
      expect(targetResult.ids.length).toBe(initialSourceCount + 1);
      expect(targetResult.ids).toContain("id_new_target");

      // Verify source has same items as before
      const sourceResult = await sourceCollection.get();
      expect(sourceResult.ids.length).toBe(initialSourceCount);
      expect(sourceResult.ids).not.toContain("id_new_target");

      // Cleanup
      try {
        await client.deleteCollection(tempTargetName);
      } catch (e) {
        // ignore
      }
    });

    test("fork - throws error if target collection already exists", async () => {
      // Try to fork to sourceCollectionName (which exists)
      await expect(async () => {
        await sourceCollection.fork({ name: sourceCollectionName });
      }).rejects.toThrow(SeekdbValueError);

      // Also try to fork to an existing unrelated collection
      const existingName = generateCollectionName("existing_collection");
      await client.createCollection({
        name: existingName,
        configuration: { dimension: 3 },
        embeddingFunction: null
      });

      await expect(async () => {
        await sourceCollection.fork({ name: existingName });
      }).rejects.toThrow();

      try {
        await client.deleteCollection(existingName);
      } catch (e) {
        // ignore
      }
    });
  });
});
