/**
 * Official example test case - verifies the documented quick-start workflow for Embedded mode
 *
 * The scenario covers:
 * 1. Creating an embedded client
 * 2. Creating a collection via getOrCreateCollection
 * 3. Upserting documents/metadatas/ids (relying on default embedding function)
 * 4. Querying with queryTexts + metadata filter + document filter
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { SeekdbClient } from "../../../src/client.js";
import { Collection } from "../../../src/collection.js";
import { generateCollectionName } from "../../test-utils.js";
import { getEmbeddedTestConfig, cleanupTestDb } from "../test-utils.js";

const TEST_CONFIG = getEmbeddedTestConfig("official-example.test.ts");

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
  {
    category: "laptop",
    ram: 8,
    storage: 256,
    price: 8000,
    type: "business",
  },
  { category: "tablet", ram: 6, storage: 128, price: 5000, type: "consumer" },
];

describe("Embedded Mode - Official Example", () => {
  let client: SeekdbClient;
  let collection: Collection;
  let collectionName: string;

  beforeAll(async () => {
    await cleanupTestDb("official-example.test.ts");
    client = new SeekdbClient(TEST_CONFIG);
    collectionName = generateCollectionName("official_example");
  });

  afterAll(async () => {
    try {
      await client.deleteCollection(collectionName);
    } catch {
      // Ignore cleanup errors
    }
    await client.close();
  });

  test("official example workflow", async () => {
    // Step 1: Create collection via getOrCreateCollection
    collection = await client.getOrCreateCollection({
      name: collectionName,
    });

    expect(collection).toBeDefined();
    expect(collection.name).toBe(collectionName);

    // Step 2: Upsert documents with metadata
    const productIds = PRODUCT_DOCUMENTS.map((_, i) => `product_${i}`);
    await collection.upsert({
      ids: productIds,
      documents: PRODUCT_DOCUMENTS,
      metadatas: PRODUCT_METADATA,
    });

    // Step 3: Query with queryTexts
    const queryResults = await collection.query({
      queryTexts: "high-performance laptop",
      nResults: 2,
    });

    expect(queryResults).toBeDefined();
    expect(queryResults.ids).toBeDefined();
    expect(queryResults.ids[0].length).toBeGreaterThan(0);

    // Step 4: Query with metadata filter
    const filteredResults = await collection.query({
      queryTexts: "laptop",
      nResults: 3,
      where: { category: { $eq: "laptop" } },
    });

    expect(filteredResults).toBeDefined();
    expect(filteredResults.ids[0].length).toBeGreaterThan(0);

    // Verify all results have category "laptop"
    if (filteredResults.metadatas && filteredResults.metadatas[0]) {
      filteredResults.metadatas[0].forEach((meta: any) => {
        expect(meta.category).toBe("laptop");
      });
    }
  }, 120000); // 2 minutes timeout
});
