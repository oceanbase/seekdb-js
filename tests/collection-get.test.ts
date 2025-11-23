/**
 * Collection get tests - testing collection.get() interface for Server mode
 * Supports configuring connection parameters via environment variables
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { SeekDBClient } from '../src/client.js';
import { Collection } from '../src/collection.js';
import { TEST_CONFIG, generateCollectionName } from './test-utils.js';

describe('Collection Get Operations', () => {
  let client: SeekDBClient;

  beforeAll(async () => {
    client = new SeekDBClient(TEST_CONFIG);
  });

  afterAll(async () => {
    await client.close();
  });

  describe('Server Mode Collection Get', () => {
    let collection: Collection;
    let collectionName: string;
    let insertedIds: string[];

    beforeAll(async () => {
      collectionName = generateCollectionName('test_get');
      collection = await client.createCollection({
        name: collectionName,
        configuration: { dimension: 3, distance: 'l2' },
        embeddingFunction: null,
      });

      // Insert test data
      insertedIds = ['id1', 'id2', 'id3', 'id4', 'id5'];
      await collection.add({
        ids: insertedIds,
        embeddings: [
          [1.0, 2.0, 3.0],
          [2.0, 3.0, 4.0],
          [1.1, 2.1, 3.1],
          [2.1, 3.1, 4.1],
          [1.2, 2.2, 3.2],
        ],
        documents: [
          'This is a test document about machine learning',
          'Python programming tutorial for beginners',
          'Advanced machine learning algorithms',
          'Data science with Python',
          'Introduction to neural networks',
        ],
        metadatas: [
          { category: 'AI', score: 95, tag: 'ml' },
          { category: 'Programming', score: 88, tag: 'python' },
          { category: 'AI', score: 92, tag: 'ml' },
          { category: 'Data Science', score: 90, tag: 'python' },
          { category: 'AI', score: 85, tag: 'neural' },
        ],
      });
    });

    afterAll(async () => {
      try {
        await client.deleteCollection(collectionName);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('get by single ID', async () => {
      const results = await collection.get({ ids: insertedIds[0] });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(1);
    });

    test('get by multiple IDs', async () => {
      const results = await collection.get({ ids: insertedIds.slice(0, 2) });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(2);
    });

    test('get with metadata filter', async () => {
      const results = await collection.get({
        where: { category: { $eq: 'AI' } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);
    });

    test('get with metadata filter using comparison operators', async () => {
      const results = await collection.get({
        where: { score: { $gte: 90 } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);
    });

    test('get with combined metadata filters', async () => {
      const results = await collection.get({
        where: { category: { $eq: 'AI' }, score: { $gte: 90 } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test('get with document filter', async () => {
      const results = await collection.get({
        whereDocument: { $contains: 'Python' },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test('get with $in operator', async () => {
      const results = await collection.get({
        where: { tag: { $in: ['ml', 'python'] } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test('get with limit and offset', async () => {
      const results = await collection.get({ limit: 2, offset: 1 });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(2);
    });

    test('get with include parameter', async () => {
      const results = await collection.get({
        ids: insertedIds.slice(0, 2),
        include: ['documents', 'metadatas', 'embeddings'],
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.documents).toBeDefined();
      expect(results.metadatas).toBeDefined();
      expect(results.embeddings).toBeDefined();
      expect(results.ids.length).toBe(2);
    });

    test('get by multiple IDs returns dict format', async () => {
      const results = await collection.get({ ids: insertedIds.slice(0, 3) });
      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeLessThanOrEqual(3);
    });

    test('single ID returns dict format', async () => {
      const results = await collection.get({ ids: insertedIds[0] });
      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBe(1);
    });

    test('get with filters returns dict format', async () => {
      const results = await collection.get({
        where: { category: { $eq: 'AI' } },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(typeof results).toBe('object');
      expect(results.ids).toBeDefined();
    });

    test('get with logical operators ($or)', async () => {
      const results = await collection.get({
        where: {
          $or: [{ category: 'AI' }, { tag: 'python' }],
        },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test('get with combined filters (where + whereDocument)', async () => {
      const results = await collection.get({
        where: { category: { $eq: 'AI' } },
        whereDocument: { $contains: 'machine' },
        limit: 10,
      });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
    });

    test('get all data without filters', async () => {
      const results = await collection.get({ limit: 100 });
      expect(results).toBeDefined();
      expect(results.ids).toBeDefined();
      expect(results.ids.length).toBeGreaterThan(0);
    });
  });
});

