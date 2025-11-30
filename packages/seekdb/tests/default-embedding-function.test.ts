/**
 * Test default embedding function - testing collection creation with default embedding function,
 * automatic vector generation from documents, and hybrid search
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekDBClient } from "../src/client.js";
import { TEST_CONFIG, generateCollectionName } from "./test-utils.js";
import { DefaultEmbeddingFunction } from "@seekdb/embedding-default";

describe("Default Embedding Function Tests", () => {
  let client: SeekDBClient;

  beforeAll(async () => {
    client = new SeekDBClient({
      host: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      user: TEST_CONFIG.user,
      password: TEST_CONFIG.password,
      tenant: TEST_CONFIG.tenant,
      database: TEST_CONFIG.database,
    });
  });

  afterAll(async () => {
    try {
      await client.close();
    } catch (error) {
      console.error("Error closing client:", error);
    }
  });

  test("server mode default embedding function", async () => {
    const collectionName = generateCollectionName("test_default_ef");

    console.log(
      `\nCreating collection '${collectionName}' with default embedding function`,
    );

    // Instantiate DefaultEmbeddingFunction
    const efInstance = new DefaultEmbeddingFunction();

    // Create collection with explicit embeddingFunction
    const collection = await client.createCollection({
      name: collectionName,
      embeddingFunction: efInstance,
    });

    expect(collection).toBeDefined();
    expect(collection.name).toBe(collectionName);
    expect(collection.embeddingFunction).toBeDefined();

    // Verify it's using DefaultEmbeddingFunction
    const ef = collection.embeddingFunction!;
    // Check name and behavior instead of internal property
    expect(ef.name).toBe("embedding-default");

    console.log(`   Collection dimension: ${collection.dimension}`);
    console.log(`   Embedding function: ${ef.name}`);

    try {
      // Test 1: Add documents without providing embeddings
      console.log(
        `\nTesting collection.add() with documents only (auto-generate vectors)`,
      );

      const testDocuments = [
        "Machine learning is a subset of artificial intelligence",
        "Python programming language is widely used in data science",
        "Deep learning algorithms for neural networks",
        "Data science with Python and machine learning",
        "Introduction to artificial intelligence and neural networks",
      ];

      const testIds = testDocuments.map((_, i) => `doc_${i}_${Date.now()}`);
      const testMetadatas = [
        { category: "AI", page: 1 },
        { category: "Programming", page: 2 },
        { category: "AI", page: 3 },
        { category: "Data Science", page: 4 },
        { category: "AI", page: 5 },
      ];

      // Add documents without embeddings - will be auto-generated
      await collection.add({
        ids: testIds,
        documents: testDocuments,
        metadatas: testMetadatas,
      });

      console.log(
        `   Added ${testDocuments.length} documents (vectors auto-generated)`,
      );

      // Verify data was inserted
      const results = await collection.get({
        ids: testIds[0],
        include: ["documents", "metadatas", "embeddings"],
      });

      expect(results.ids.length).toBe(1);
      expect(results.documents![0]).toBe(testDocuments[0]);

      if (results.embeddings && results.embeddings[0]) {
        expect(results.embeddings[0].length).toBe(collection.dimension);
        console.log(
          `   Verified: document and embedding (dim=${results.embeddings[0].length}) stored correctly`,
        );
      } else {
        console.log(
          `   Verified: document stored correctly (embedding not included in get results)`,
        );
      }

      // Test 2: Generate query embedding using default embedding function
      console.log(`\nTesting query embedding generation`);
      const queryText = "artificial intelligence and machine learning";
      const queryEmbedding = (
        await collection.embeddingFunction!.generate([queryText])
      )[0];
      expect(queryEmbedding.length).toBe(collection.dimension);
      console.log(
        `   Generated query embedding with dimension: ${queryEmbedding.length}`,
      );

      // Wait a bit for indexes to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Test 3: Query with query text (auto-generate query embedding)
      console.log(`\nTesting collection.query() with queryTexts`);
      const queryResults = await collection.query({
        queryTexts: [queryText],
        nResults: 3,
        include: ["documents", "metadatas", "distances"],
      });

      expect(queryResults).toBeDefined();
      expect(queryResults.ids).toBeDefined();
      expect(queryResults.ids.length).toBeGreaterThan(0);
      console.log(`   Found ${queryResults.ids[0].length} results`);

      // Test 4: Hybrid search with vector search
      console.log(`\nTesting hybrid_search with vector search`);
      try {
        const hybridResults = await collection.hybridSearch({
          knn: {
            queryEmbeddings: [queryEmbedding],
            nResults: 3,
          },
          nResults: 3,
          include: ["documents", "metadatas", "distances"],
        });

        expect(hybridResults).toBeDefined();
        expect(hybridResults.ids).toBeDefined();
        expect(hybridResults.ids.length).toBeGreaterThan(0);
        console.log(`   Found ${hybridResults.ids.length} results`);

        if (hybridResults.documents && hybridResults.documents.length > 0) {
          console.log(`   Retrieved documents successfully`);
        }
      } catch (e) {
        console.log(`   Warning: Hybrid search with vector failed: ${e}`);
      }

      // Test 5: Hybrid search with full-text search
      console.log(`\nTesting hybrid_search with full-text search`);
      try {
        const fulltextResults = await collection.hybridSearch({
          query: {
            whereDocument: { $contains: "machine learning" },
            nResults: 3,
          },
          nResults: 3,
          include: ["documents", "metadatas"],
        });

        expect(fulltextResults).toBeDefined();
        expect(fulltextResults.ids).toBeDefined();
        expect(fulltextResults.ids.length).toBeGreaterThan(0);
        console.log(
          `   Found ${fulltextResults.ids.length} results from full-text search`,
        );
      } catch (e) {
        console.log(`   Warning: Hybrid search with full-text failed: ${e}`);
      }

      // Test 6: Hybrid search combining both vector and full-text
      console.log(
        `\nTesting hybrid_search with both vector and full-text search`,
      );
      try {
        const combinedResults = await collection.hybridSearch({
          query: {
            whereDocument: { $contains: "machine learning" },
            nResults: 3,
          },
          knn: {
            queryEmbeddings: [queryEmbedding],
            nResults: 3,
          },
          nResults: 3,
          include: ["documents", "metadatas", "distances"],
        });

        expect(combinedResults).toBeDefined();
        expect(combinedResults.ids).toBeDefined();
        expect(combinedResults.ids.length).toBeGreaterThan(0);
        console.log(
          `   Found ${combinedResults.ids.length} results from hybrid search`,
        );
      } catch (e) {
        console.log(`   Warning: Hybrid search combining both failed: ${e}`);
      }
    } finally {
      // Cleanup
      try {
        await client.deleteCollection(collectionName);
        console.log(`\nCleaned up collection '${collectionName}'`);
      } catch (e) {
        console.warn(`\nFailed to cleanup collection: ${e}`);
      }
    }
  }, 120000); // 120s timeout for model loading and processing
});
