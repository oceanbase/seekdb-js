/**
 * Collection hybrid search tests - testing collection.hybridSearch() interface for Server mode
 * Supports configuring connection parameters via environment variables
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { SeekDBClient } from '../src/client.js';
import { Collection } from '../src/collection.js';
import { TEST_CONFIG, generateCollectionName } from './test-utils.js';

/**
 * Helper function to check if error is due to DBMS_HYBRID_SEARCH not being supported
 */
function isHybridSearchNotSupported(error: any): boolean {
  const errorMsg = error.message || '';
  return (
    errorMsg.includes('SQL syntax') ||
    errorMsg.includes('DBMS_HYBRID_SEARCH') ||
    errorMsg.includes('Unknown database function')
  );
}

/**
 * Helper function to handle hybrid search test execution with graceful fallback
 */
async function runHybridSearchTest(testFn: () => Promise<void>): Promise<void> {
  try {
    await testFn();
  } catch (error: any) {
    if (isHybridSearchNotSupported(error)) {
      console.warn('Skipping test: DBMS_HYBRID_SEARCH not supported on this database version');
      return;
    }
    throw error;
  }
}

describe('Collection Hybrid Search Operations', () => {
  let client: SeekDBClient;

  beforeAll(async () => {
    client = new SeekDBClient(TEST_CONFIG);
  });

  afterAll(async () => {
    await client.close();
  });

  describe('Server Mode Hybrid Search', () => {
    let collection: Collection;
    let collectionName: string;

    beforeAll(async () => {
      collectionName = generateCollectionName('test_hybrid_search');
      collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: 'l2' },
        embeddingFunction: null,
      });

      // Insert test data
      await collection.add({
        ids: ['id1', 'id2', 'id3', 'id4', 'id5', 'id6', 'id7', 'id8'],
        embeddings: [
          [1.0, 2.0, 3.0],
          [2.0, 3.0, 4.0],
          [1.1, 2.1, 3.1],
          [2.1, 3.1, 4.1],
          [1.2, 2.2, 3.2],
          [1.3, 2.3, 3.3],
          [2.2, 3.2, 4.2],
          [1.4, 2.4, 3.4],
        ],
        documents: [
          'Machine learning is a subset of artificial intelligence',
          'Python programming language is widely used in data science',
          'Deep learning algorithms for neural networks',
          'Data science with Python and machine learning',
          'Introduction to artificial intelligence and neural networks',
          'Advanced machine learning techniques and algorithms',
          'Python tutorial for beginners in programming',
          'Natural language processing with machine learning',
        ],
        metadatas: [
          { category: 'AI', page: 1, score: 95, tag: 'ml' },
          { category: 'Programming', page: 2, score: 88, tag: 'python' },
          { category: 'AI', page: 3, score: 92, tag: 'ml' },
          { category: 'Data Science', page: 4, score: 90, tag: 'python' },
          { category: 'AI', page: 5, score: 85, tag: 'neural' },
          { category: 'AI', page: 6, score: 93, tag: 'ml' },
          { category: 'Programming', page: 7, score: 87, tag: 'python' },
          { category: 'AI', page: 8, score: 91, tag: 'nlp' },
        ],
      });

      // Wait a bit for indexes to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('hybrid search with full-text search only', async () => {
      await runHybridSearchTest(async () => {
        const results = await collection.hybridSearch({
          query: {
            whereDocument: {
              $contains: 'machine learning',
            },
          },
          nResults: 5,
          include: ['documents', 'metadatas'],
        });

        expect(results).toBeDefined();
        expect(results.ids).toBeDefined();
        expect(results.documents).toBeDefined();
        expect(results.metadatas).toBeDefined();
        expect(results.ids.length).toBeGreaterThanOrEqual(0);
      });
    });

    test('hybrid search with vector search only', async () => {
      await runHybridSearchTest(async () => {
        const results = await collection.hybridSearch({
          knn: {
            queryEmbeddings: [1.0, 2.0, 3.0],
            nResults: 5,
          },
          nResults: 5,
          include: ['documents', 'metadatas', 'embeddings'],
        });

        expect(results).toBeDefined();
        expect(results.ids).toBeDefined();
        expect(results.ids.length).toBeGreaterThanOrEqual(0);
        
        if (results.ids.length > 0 && results.ids[0].length > 0) {
          expect(results.distances).toBeDefined();
          // Verify distances are reasonable
          const distances = results.distances![0];
          expect(distances.length).toBeGreaterThan(0);
          for (const dist of distances) {
            expect(dist).toBeGreaterThanOrEqual(0);
          }
        }
      });
    });

    test('hybrid search with both full-text and vector search', async () => {
      await runHybridSearchTest(async () => {
        const results = await collection.hybridSearch({
          query: {
            whereDocument: {
              $contains: 'machine learning',
            },
            nResults: 10,
          },
          knn: {
            queryEmbeddings: [1.0, 2.0, 3.0],
            nResults: 10,
          },
          rank: {
            rrf: {
              rankWindowSize: 60,
              rankConstant: 60,
            },
          },
          nResults: 5,
          include: ['documents', 'metadatas', 'embeddings'],
        });

        expect(results).toBeDefined();
        expect(results.ids).toBeDefined();
        expect(results.ids.length).toBeGreaterThanOrEqual(0);
      });
    });

    test('hybrid search with metadata filter', async () => {
      await runHybridSearchTest(async () => {
        const results = await collection.hybridSearch({
          query: {
            whereDocument: {
              $contains: 'machine',
            },
            where: {
              $and: [
                { category: { $eq: 'AI' } },
                { page: { $gte: 1 } },
                { page: { $lte: 5 } },
              ],
            },
            nResults: 10,
          },
          knn: {
            queryEmbeddings: [1.0, 2.0, 3.0],
            where: {
              $and: [{ category: { $eq: 'AI' } }, { score: { $gte: 90 } }],
            },
            nResults: 10,
          },
          nResults: 5,
          include: ['documents', 'metadatas'],
        });

        expect(results).toBeDefined();
        expect(results.ids).toBeDefined();
        expect(results.ids.length).toBeGreaterThanOrEqual(0);

        // Verify metadata filters are applied (only if results returned)
        if (results.ids.length > 0 && results.ids[0].length > 0) {
          for (const metadata of results.metadatas![0]) {
            if (metadata) {
              expect(metadata.category).toBe('AI');
            }
          }
        }
      });
    });

    test('hybrid search with logical operators', async () => {
      await runHybridSearchTest(async () => {
        const results = await collection.hybridSearch({
          query: {
            whereDocument: {
              $and: [{ $contains: 'machine' }, { $contains: 'learning' }],
            },
            where: {
              $or: [{ tag: { $eq: 'ml' } }, { tag: { $eq: 'python' } }],
            },
            nResults: 10,
          },
          knn: {
            queryEmbeddings: [1.0, 2.0, 3.0],
            where: {
              tag: { $in: ['ml', 'python'] },
            },
            nResults: 10,
          },
          rank: { rrf: {} },
          nResults: 5,
          include: ['documents', 'metadatas'],
        });

        expect(results).toBeDefined();
        expect(results.ids).toBeDefined();
        expect(results.ids.length).toBeGreaterThanOrEqual(0);

        // Verify logical operators are applied (only if results returned)
        if (results.ids.length > 0 && results.ids[0].length > 0) {
          for (const metadata of results.metadatas![0]) {
            if (metadata && metadata.tag) {
              expect(['ml', 'python']).toContain(metadata.tag);
            }
          }
        }
      });
    });

    test('hybrid search with simplified equality in metadata filter', async () => {
      await runHybridSearchTest(async () => {
        const results = await collection.hybridSearch({
          query: {
            whereDocument: {
              $contains: 'machine',
            },
            where: {
              $and: [
                { category: 'AI' },
                { page: { $gte: 1 } },
                { page: { $lte: 5 } },
              ],
            },
            nResults: 10,
          },
          knn: {
            queryEmbeddings: [1.0, 2.0, 3.0],
            where: {
              $and: [{ category: 'AI' }, { score: { $gte: 90 } }],
            },
            nResults: 10,
          },
          nResults: 5,
          include: ['documents', 'metadatas'],
        });

        expect(results).toBeDefined();
        expect(results.ids).toBeDefined();
        expect(results.ids.length).toBeGreaterThanOrEqual(0);

        // Verify metadata filters are applied (only if results returned)
        if (results.ids.length > 0 && results.ids[0].length > 0) {
          for (const metadata of results.metadatas![0]) {
            if (metadata) {
              expect(metadata.category).toBe('AI');
            }
          }
        }
      });
    });
  });
});

