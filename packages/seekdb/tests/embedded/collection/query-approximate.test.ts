/**
 * Query approximate parameter tests for Embedded mode
 * Tests the approximate parameter in query operations for embedded mode
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { Client } from "../../../src/factory.js";
import { generateCollectionName } from "../../test-utils.js";
import { getTestDbDir, cleanupTestDb } from "../test-utils.js";
import type { SeekdbClient } from "../../../src/client.js";

describe("Embedded Mode - Query Approximate Parameter", () => {
  let client: SeekdbClient;
  const TEST_DB_DIR = getTestDbDir("query-approximate.test.ts");

  beforeAll(async () => {
    await cleanupTestDb("query-approximate.test.ts");
    client = Client({
      path: TEST_DB_DIR,
      database: "test",
    });
  }, 60000);

  afterAll(async () => {
    try {
      await client.close();
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test("query with approximate parameter", async () => {
    const collectionName = generateCollectionName("test_approximate");
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
    });

    // Query with approximate parameter
    const results = await collection.query({
      queryEmbeddings: [[1, 2, 3]],
      nResults: 2,
      approximate: true,
    });

    expect(results.ids).toBeDefined();
    expect(results.ids[0].length).toBeGreaterThan(0);

    await client.deleteCollection(collectionName);
  });
});
