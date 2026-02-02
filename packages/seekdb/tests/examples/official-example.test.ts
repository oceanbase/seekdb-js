/**
 * Official example test case - verifies the documented quick-start workflow
 *
 * The scenario covers:
 * 1. Creating a default client (server mode)
 * 2. Creating a collection via getOrCreateCollection
 * 3. Upserting documents/metadatas/ids (relying on default embedding function)
 * 4. Querying with queryTexts + metadata filter + document filter
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../src/client.js";
import { Collection } from "../../src/collection.js";
import { TEST_CONFIG, generateCollectionName } from "../test-utils.js";

const PRODUCT_DOCUMENTS = [
  "Laptop Pro with 16GB RAM, 512GB SSD, and high-speed processor",
  "Gaming Laptop with 32GB RAM, 1TB SSD, and high-performance graphics",
  "Business Ultrabook with 8GB RAM, 256GB SSD, and long battery life",
  "Tablet with 6GB RAM, 128GB storage, and 10-inch display",
];

const PRODUCT_METADATA = [
  {
    category: "laptop",
    ram: 16,
    storage: 512,
    price: 12000,
    type: "professional",
  },
  { category: "laptop", ram: 32, storage: 1000, price: 25000, type: "gaming" },
  { category: "laptop", ram: 8, storage: 256, price: 9000, type: "business" },
  { category: "tablet", ram: 6, storage: 128, price: 6000, type: "consumer" },
];

const PRODUCT_IDS = ["1", "2", "3", "4"];

async function runOfficialExample(collection: Collection) {
  // Upsert documents with metadata
  await collection.upsert({
    documents: PRODUCT_DOCUMENTS,
    metadatas: PRODUCT_METADATA,
    ids: PRODUCT_IDS,
  });

  // Query with filters
  const results = await collection.query({
    queryTexts: ["powerful computer for professional work"],
    where: {
      category: "laptop",
      ram: { $gte: 16 },
    },
    whereDocument: { $contains: "RAM" },
    nResults: 2,
    include: ["documents", "metadatas"],
  });

  expect(results).toBeDefined();
  expect(results.documents).toBeDefined();
  expect(results.documents!.length).toBeGreaterThan(0);
  expect(results.documents![0].length).toBeGreaterThan(0);

  const matchedDocs = results.documents![0];
  const matchedMetadata = results.metadatas![0];

  // Verify documents contain "RAM"
  for (const doc of matchedDocs) {
    if (doc) {
      expect(doc.toLowerCase()).toContain("ram");
    }
  }

  // Verify metadata filters
  for (const metadata of matchedMetadata) {
    if (metadata) {
      expect(metadata.category).toBe("laptop");
      expect(metadata.ram).toBeGreaterThanOrEqual(16);
    }
  }

  return results;
}

describe("Official Example Test", () => {
  let client: SeekdbClient;

  beforeAll(async () => {
    client = new SeekdbClient(TEST_CONFIG);
  });

  afterAll(async () => {
    try {
      await client.close();
    } catch (error) {
      console.error("Error closing client:", error);
    }
  });

  test("server mode official example", async () => {
    const collectionName = generateCollectionName("official_example");

    // Create collection with default embedding function
    const collection = await client.getOrCreateCollection({
      name: collectionName,
    });

    try {
      // Run the official example workflow
      await runOfficialExample(collection);
    } finally {
      // Cleanup
      try {
        await client.deleteCollection(collectionName);
      } catch (error) {
        console.warn(
          `Failed to cleanup collection '${collectionName}':`,
          error
        );
      }
    }
  }, 60000); // 60s timeout for embedding model loading
});
