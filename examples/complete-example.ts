/**
 * Comprehensive Example: Complete guide to all SeekDB features
 *
 * This example demonstrates all available operations:
 * 1. Client connection
 * 2. Collection management
 * 3. DML operations (add, update, upsert, delete)
 * 4. DQL operations (query, get, hybrid_search)
 * 5. Filter operators
 * 6. Collection information methods
 *
 * This is a complete reference for all client capabilities.
 */

import { SeekDBClient } from '../src/index.js';
import crypto from 'crypto';

async function main() {
  // ============================================================================
  // PART 1: CLIENT CONNECTION
  // ============================================================================

  const client = new SeekDBClient({
    host: '127.0.0.1',
    port: 2881,
    tenant: 'sys',
    database: 'test',
    user: 'root',
    password: '',
  });

  // ============================================================================
  // PART 2: COLLECTION MANAGEMENT
  // ============================================================================

  const collectionName = 'comprehensive_example';
  const dimension = 128;

  // 2.1 Create a collection
  const collection = await client.getOrCreateCollection({
    name: collectionName,
    configuration: {
      dimension,
      distance: 'cosine',
    },
  });

  // 2.2 Check if collection exists
  const exists = await client.hasCollection(collectionName);
  console.log(`Collection exists: ${exists}`);

  // 2.3 Get collection object
  const retrievedCollection = await client.getCollection({ name: collectionName });
  console.log(`Retrieved collection: ${retrievedCollection.name}`);

  // 2.4 List all collections
  const allCollections = await client.listCollections();
  console.log(`All collections: ${allCollections.join(', ')}`);

  // 2.5 Get or create collection
  const collection2 = await client.getOrCreateCollection({
    name: 'another_collection',
    configuration: {
      dimension: 64,
      distance: 'cosine',
    },
  });

  // ============================================================================
  // PART 3: DML OPERATIONS - ADD DATA
  // ============================================================================

  const documents = [
    'Machine learning is transforming the way we solve problems',
    'Python programming language is widely used in data science',
    'Vector databases enable efficient similarity search',
    'Neural networks mimic the structure of the human brain',
    'Natural language processing helps computers understand human language',
    'Deep learning requires large amounts of training data',
    'Reinforcement learning agents learn through trial and error',
    'Computer vision enables machines to interpret visual information',
  ];

  const embeddings = documents.map(() =>
    Array.from({ length: dimension }, () => Math.random())
  );

  const ids = documents.map(() => crypto.randomUUID());

  // 3.1 Add single item
  const singleId = crypto.randomUUID();
  await collection.add({
    ids: singleId,
    documents: 'This is a single document',
    embeddings: Array.from({ length: dimension }, () => Math.random()),
    metadatas: { type: 'single', category: 'test' },
  });

  // 3.2 Add multiple items
  await collection.add({
    ids,
    documents,
    embeddings,
    metadatas: [
      { category: 'AI', score: 95, tag: 'ml', year: 2023 },
      { category: 'Programming', score: 88, tag: 'python', year: 2022 },
      { category: 'Database', score: 92, tag: 'vector', year: 2023 },
      { category: 'AI', score: 90, tag: 'neural', year: 2022 },
      { category: 'NLP', score: 87, tag: 'language', year: 2023 },
      { category: 'AI', score: 93, tag: 'deep', year: 2023 },
      { category: 'AI', score: 85, tag: 'reinforcement', year: 2022 },
      { category: 'CV', score: 91, tag: 'vision', year: 2023 },
    ],
  });

  console.log('Added documents to collection');

  // 3.3 Add with only embeddings (no documents)
  const vectorOnlyIds = [crypto.randomUUID(), crypto.randomUUID()];
  await collection.add({
    ids: vectorOnlyIds,
    embeddings: [
      Array.from({ length: dimension }, () => Math.random()),
      Array.from({ length: dimension }, () => Math.random()),
    ],
    metadatas: [{ type: 'vector_only' }, { type: 'vector_only' }],
  });

  // ============================================================================
  // PART 4: DML OPERATIONS - UPDATE DATA
  // ============================================================================

  // 4.1 Update single item
  await collection.update({
    ids: ids[0],
    metadatas: { category: 'AI', score: 98, tag: 'ml', year: 2024, updated: true },
  });

  // 4.2 Update multiple items
  await collection.update({
    ids: [ids[1], ids[2]],
    documents: ['Updated document 1', 'Updated document 2'],
    embeddings: [
      Array.from({ length: dimension }, () => Math.random()),
      Array.from({ length: dimension }, () => Math.random()),
    ],
    metadatas: [
      { category: 'Programming', score: 95, updated: true },
      { category: 'Database', score: 97, updated: true },
    ],
  });

  console.log('Updated documents');

  // ============================================================================
  // PART 5: DML OPERATIONS - UPSERT DATA
  // ============================================================================

  // 5.1 Upsert existing item (will update)
  await collection.upsert({
    ids: ids[0],
    documents: 'Upserted document (was updated)',
    embeddings: Array.from({ length: dimension }, () => Math.random()),
    metadatas: { category: 'AI', upserted: true },
  });

  // 5.2 Upsert new item (will insert)
  const newId = crypto.randomUUID();
  await collection.upsert({
    ids: newId,
    documents: 'This is a new document from upsert',
    embeddings: Array.from({ length: dimension }, () => Math.random()),
    metadatas: { category: 'New', upserted: true },
  });

  // 5.3 Upsert multiple items
  const upsertIds = [ids[4], crypto.randomUUID()];
  await collection.upsert({
    ids: upsertIds,
    documents: ['Upserted doc 1', 'Upserted doc 2'],
    embeddings: [
      Array.from({ length: dimension }, () => Math.random()),
      Array.from({ length: dimension }, () => Math.random()),
    ],
    metadatas: [{ upserted: true }, { upserted: true }],
  });

  console.log('Upserted documents');

  // ============================================================================
  // PART 6: DQL OPERATIONS - QUERY (VECTOR SIMILARITY SEARCH)
  // ============================================================================

  const queryVector = embeddings[0];

  // 6.1 Basic vector similarity query
  let results = await collection.query({
    queryEmbeddings: queryVector,
    nResults: 3,
  });
  console.log(`Query results: ${results.ids[0].length} items`);

  // 6.2 Query with metadata filter (equality)
  results = await collection.query({
    queryEmbeddings: queryVector,
    where: { category: 'AI' },
    nResults: 5,
  });

  // 6.3 Query with comparison operators
  results = await collection.query({
    queryEmbeddings: queryVector,
    where: { score: { $gte: 90 } },
    nResults: 5,
  });

  // 6.4 Query with $in operator
  results = await collection.query({
    queryEmbeddings: queryVector,
    where: { tag: { $in: ['ml', 'python', 'neural'] } },
    nResults: 5,
  });

  // 6.5 Query with logical operators ($or)
  results = await collection.query({
    queryEmbeddings: queryVector,
    where: {
      $or: [{ category: 'AI' }, { tag: 'python' }],
    },
    nResults: 5,
  });

  // 6.6 Query with logical operators ($and)
  results = await collection.query({
    queryEmbeddings: queryVector,
    where: {
      $and: [{ category: 'AI' }, { score: { $gte: 90 } }],
    },
    nResults: 5,
  });

  // 6.7 Query with document filter
  results = await collection.query({
    queryEmbeddings: queryVector,
    whereDocument: { $contains: 'machine learning' },
    nResults: 5,
  });

  // 6.8 Query with combined filters
  results = await collection.query({
    queryEmbeddings: queryVector,
    where: { category: 'AI', year: { $gte: 2023 } },
    whereDocument: { $contains: 'learning' },
    nResults: 5,
  });

  // 6.9 Query with multiple embeddings (batch query)
  const batchResults = await collection.query({
    queryEmbeddings: [embeddings[0], embeddings[1]],
    nResults: 2,
  });

  // 6.10 Query with specific fields
  results = await collection.query({
    queryEmbeddings: queryVector,
    include: ['documents', 'metadatas', 'embeddings'],
    nResults: 2,
  });

  // ============================================================================
  // PART 7: DQL OPERATIONS - GET (RETRIEVE BY IDS OR FILTERS)
  // ============================================================================

  // 7.1 Get by single ID
  let getResults = await collection.get({ ids: ids[0] });

  // 7.2 Get by multiple IDs
  getResults = await collection.get({ ids: [ids[0], ids[1], ids[2]] });

  // 7.3 Get by metadata filter
  getResults = await collection.get({
    where: { category: 'AI' },
    limit: 5,
  });

  // 7.4 Get with comparison operators
  getResults = await collection.get({
    where: { score: { $gte: 90 } },
    limit: 5,
  });

  // 7.5 Get with $in operator
  getResults = await collection.get({
    where: { tag: { $in: ['ml', 'python'] } },
    limit: 5,
  });

  // 7.6 Get with logical operators
  getResults = await collection.get({
    where: {
      $or: [{ category: 'AI' }, { category: 'Programming' }],
    },
    limit: 5,
  });

  // 7.7 Get by document filter
  getResults = await collection.get({
    whereDocument: { $contains: 'Python' },
    limit: 5,
  });

  // 7.8 Get with pagination
  const resultsPage1 = await collection.get({ limit: 2, offset: 0 });
  const resultsPage2 = await collection.get({ limit: 2, offset: 2 });

  // 7.9 Get with specific fields
  getResults = await collection.get({
    ids: [ids[0], ids[1]],
    include: ['documents', 'metadatas', 'embeddings'],
  });

  // 7.10 Get all data
  const allResults = await collection.get({ limit: 100 });

  console.log('Completed get operations');

  // ============================================================================
  // PART 8: DQL OPERATIONS - HYBRID SEARCH
  // ============================================================================

  try {
    const hybridResults = await collection.hybridSearch({
      query: {
        whereDocument: { $contains: 'machine learning' },
        where: { category: 'AI' },
        nResults: 10,
      },
      knn: {
        queryEmbeddings: [embeddings[0]],
        where: { year: { $gte: 2022 } },
        nResults: 10,
      },
      rank: { rrf: {} },
      nResults: 5,
      include: ['documents', 'metadatas'],
    });

    console.log(`Hybrid search: ${hybridResults.ids[0].length} results`);
  } catch (error: any) {
    console.log('Hybrid search not supported on this database version');
  }

  // ============================================================================
  // PART 9: DML OPERATIONS - DELETE DATA
  // ============================================================================

  // 9.1 Delete by IDs
  await collection.delete({ ids: [vectorOnlyIds[0], newId] });

  // 9.2 Delete by metadata filter
  await collection.delete({ where: { type: { $eq: 'vector_only' } } });

  // 9.3 Delete by document filter
  await collection.delete({ whereDocument: { $contains: 'Updated document' } });

  // 9.4 Delete with combined filters
  await collection.delete({
    where: { category: { $eq: 'CV' } },
    whereDocument: { $contains: 'vision' },
  });

  console.log('Deleted documents');

  // ============================================================================
  // PART 10: COLLECTION INFORMATION
  // ============================================================================

  // 10.1 Get collection count
  const count = await collection.count();
  console.log(`Collection count: ${count} items`);

  // 10.2 Preview first few items
  const preview = await collection.peek(5);
  console.log(`Preview: ${preview.ids.length} items`);
  for (let i = 0; i < preview.ids.length; i++) {
    console.log(`  ID: ${preview.ids[i]}, Document: ${preview.documents?.[i]}`);
    console.log(
      `  Metadata: ${JSON.stringify(preview.metadatas?.[i])}, Embedding dim: ${preview.embeddings?.[i]?.length ?? 0}`
    );
  }

  // 10.3 Count collections
  const collectionCount = await client.countCollection();
  console.log(`Database has ${collectionCount} collections`);

  // ============================================================================
  // PART 11: CLEANUP
  // ============================================================================

  await client.deleteCollection('another_collection');
  await client.deleteCollection(collectionName);

  console.log('Cleanup complete');

  await client.close();
}

main().catch(console.error);

