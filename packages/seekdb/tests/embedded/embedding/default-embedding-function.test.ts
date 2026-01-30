/**
 * Test default embedding function - testing collection creation with default embedding function,
 * automatic vector generation from documents, and hybrid search for Embedded mode
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { Client } from "../../../src/factory.js";
import { generateCollectionName, registerTestDefaultEmbeddingFunction } from "../../test-utils.js";
import { getTestDbDir, cleanupTestDb } from "../test-utils.js";
import type { SeekdbClient } from "../../../src/client.js";

// Register test default embedding function before any tests run
registerTestDefaultEmbeddingFunction();

describe("Embedded Mode - Default Embedding Function Tests", () => {
  let client: SeekdbClient;
  const TEST_DB_DIR = getTestDbDir("default-embedding-function.test.ts");

  beforeAll(async () => {
    await cleanupTestDb("default-embedding-function.test.ts");
    // Use Client() factory function - it will return SeekdbClient (embedded mode when path is provided)
    client = Client({
      path: TEST_DB_DIR,
      database: "test",
    });
  }, 60000);

  afterAll(async () => {
    await client.close();
  });

  test("embedded mode default embedding function", async () => {
    const collectionName = generateCollectionName("test_default_ef");

    // Not providing embeddingFunction should use DefaultEmbeddingFunction
    const collection = await client.createCollection({
      name: collectionName,
    });

    expect(collection).toBeDefined();
    expect(collection.name).toBe(collectionName);
    expect(collection.embeddingFunction).toBeDefined();

    // Default embedding function should have dimension 384
    expect(collection.dimension).toBe(384);

    // Test adding documents without explicit embeddings
    const testDocuments = [
      "This is a test document about machine learning",
      "Python programming tutorial for beginners",
      "Advanced machine learning algorithms",
    ];

    const testIds = testDocuments.map((_, i) => `doc_${i}_${Date.now()}`);
    const testMetadatas = [
      { category: "AI", score: 95 },
      { category: "Programming", score: 88 },
      { category: "AI", score: 92 },
    ];

    await collection.add({
      ids: testIds,
      documents: testDocuments,
      metadatas: testMetadatas,
    });

    // Test query with queryTexts (using the default embedding function)
    const results = await collection.query({
      queryTexts: [testDocuments[0]],
      nResults: 1,
    });

    expect(results.documents).toBeDefined();
    expect(results.documents!.length).toBeGreaterThan(0);

    await client.deleteCollection(collectionName);
  }, 120000); // 2 minutes timeout for creating the collection
});
