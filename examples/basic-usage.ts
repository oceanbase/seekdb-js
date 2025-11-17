/**
 * Basic usage example for SeekDB Node.js SDK
 */

import { SeekDBClient } from '../src/index.js';

async function main() {
  // Create client - Server mode
  const client = new SeekDBClient({
    host: '127.0.0.1',
    port: 2881,
    tenant: 'sys',
    database: 'test',
    user: 'root',
    password: '',
  });

  try {
    // Create a collection
    const collection = await client.createCollection({
      name: 'my_collection',
      configuration: {
        dimension: 128,
        distance: 'cosine',
      },
    });

    console.log(`Created collection: ${collection.name}, dimension: ${collection.dimension}`);

    // Add some data (user must provide embeddings manually)
    await collection.add({
      ids: ['id1', 'id2', 'id3'],
      documents: ['Document 1', 'Document 2', 'Document 3'],
      embeddings: [
        Array.from({ length: 128 }, () => Math.random()),
        Array.from({ length: 128 }, () => Math.random()),
        Array.from({ length: 128 }, () => Math.random()),
      ],
      metadatas: [
        { category: 'A', score: 95 },
        { category: 'B', score: 88 },
        { category: 'A', score: 92 },
      ],
    });

    console.log('Added 3 documents');

    // Update data
    await collection.update({
      ids: 'id1',
      metadatas: { category: 'A', score: 98 },
    });

    console.log('Updated id1');

    // Upsert data (insert or update)
    await collection.upsert({
      ids: ['id1', 'id4'], // id1 exists, id4 is new
      documents: ['Updated Doc 1', 'New Doc 4'],
      embeddings: [
        Array.from({ length: 128 }, () => Math.random()),
        Array.from({ length: 128 }, () => Math.random()),
      ],
      metadatas: [
        { category: 'A', score: 99 },
        { category: 'C', score: 85 },
      ],
    });

    console.log('Upserted data');

    // Get data
    const results = await collection.get({
      ids: ['id1', 'id2'],
      include: ['documents', 'metadatas'],
    });

    console.log('Retrieved data:', results);

    // Vector similarity query
    const queryVector = Array.from({ length: 128 }, () => Math.random());
    const queryResults = await collection.query({
      queryEmbeddings: queryVector,
      nResults: 3,
      include: ['documents', 'metadatas', 'distances'],
    });

    console.log('Query results:', queryResults);

    // Delete specific items
    await collection.delete({
      ids: 'id2',
    });

    console.log('Deleted id2');

    // Count items
    const count = await collection.count();
    console.log(`Collection has ${count} items`);

    // Peek at first few items
    const preview = await collection.peek(5);
    console.log('Preview:', preview);

    // List collections
    const collections = await client.listCollections();
    console.log('All collections:', collections);

    // Delete collection
    await client.deleteCollection('my_collection');
    console.log('Collection deleted');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
