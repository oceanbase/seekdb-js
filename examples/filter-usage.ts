/**
 * Example: Using where and whereDocument filters
 */

import { SeekDBClient } from '../src/index.js';

async function main() {
  // Create client
  const client = new SeekDBClient({
    host: 'localhost',
    port: 2881,
    tenant: 'sys',
    database: 'test',
    user: 'root',
    password: '',
  });

  // Create or get collection
  const collection = await client.createCollection({
    name: 'filter_test',
    configuration: {
      dimension: 3,
      distance: 'l2',
    },
  });

  // Add test data
  await collection.add({
    ids: ['doc1', 'doc2', 'doc3', 'doc4', 'doc5'],
    documents: [
      'Python programming guide',
      'JavaScript tutorial for beginners',
      'Advanced TypeScript patterns',
      'Python machine learning basics',
      'Node.js best practices',
    ],
    metadatas: [
      { category: 'programming', language: 'python', difficulty: 'beginner', page: 5 },
      { category: 'programming', language: 'javascript', difficulty: 'beginner', page: 10 },
      { category: 'programming', language: 'typescript', difficulty: 'advanced', page: 15 },
      { category: 'ml', language: 'python', difficulty: 'intermediate', page: 20 },
      { category: 'programming', language: 'javascript', difficulty: 'advanced', page: 25 },
    ],
    embeddings: [
      [1.0, 2.0, 3.0],
      [2.0, 3.0, 4.0],
      [3.0, 4.0, 5.0],
      [4.0, 5.0, 6.0],
      [5.0, 6.0, 7.0],
    ],
  });

  console.log('\n📊 Test data added successfully\n');

  // ==================== Metadata Filter Examples ====================

  console.log('=== Metadata Filter Examples ===\n');

  // 1. Simple equality filter
  console.log('1. Get all Python documents:');
  const pythonDocs = await collection.get({
    where: { language: 'python' },
  });
  console.log(`   Found ${pythonDocs.ids.length} documents:`, pythonDocs.ids);

  // 2. Comparison operators
  console.log('\n2. Get documents with page >= 15:');
  const highPageDocs = await collection.get({
    where: { page: { $gte: 15 } },
  });
  console.log(`   Found ${highPageDocs.ids.length} documents:`, highPageDocs.ids);

  // 3. Range query
  console.log('\n3. Get documents with page between 10 and 20:');
  const rangePageDocs = await collection.get({
    where: {
      $and: [
        { page: { $gte: 10 } },
        { page: { $lte: 20 } },
      ],
    },
  });
  console.log(`   Found ${rangePageDocs.ids.length} documents:`, rangePageDocs.ids);

  // 4. $in operator
  console.log('\n4. Get documents with language in [python, javascript]:');
  const multiLangDocs = await collection.get({
    where: { language: { $in: ['python', 'javascript'] } },
  });
  console.log(`   Found ${multiLangDocs.ids.length} documents:`, multiLangDocs.ids);

  // 5. $ne (not equal) operator
  console.log('\n5. Get non-beginner documents:');
  const nonBeginnerDocs = await collection.get({
    where: { difficulty: { $ne: 'beginner' } },
  });
  console.log(`   Found ${nonBeginnerDocs.ids.length} documents:`, nonBeginnerDocs.ids);

  // 6. Complex AND condition
  console.log('\n6. Get advanced programming documents:');
  const advancedProgramming = await collection.get({
    where: {
      $and: [
        { category: 'programming' },
        { difficulty: 'advanced' },
      ],
    },
  });
  console.log(`   Found ${advancedProgramming.ids.length} documents:`, advancedProgramming.ids);

  // 7. OR condition
  console.log('\n7. Get beginner OR intermediate documents:');
  const easyDocs = await collection.get({
    where: {
      $or: [
        { difficulty: 'beginner' },
        { difficulty: 'intermediate' },
      ],
    },
  });
  console.log(`   Found ${easyDocs.ids.length} documents:`, easyDocs.ids);

  // ==================== Document Filter Examples ====================

  console.log('\n=== Document Filter Examples ===\n');

  // 8. $contains (full-text search)
  console.log('8. Search documents containing "Python":');
  const pythonTextDocs = await collection.get({
    whereDocument: { $contains: 'Python' },
  });
  console.log(`   Found ${pythonTextDocs.ids.length} documents:`, pythonTextDocs.ids);

  // 9. $regex pattern matching
  console.log('\n9. Search documents matching regex "^.*Script.*$":');
  const scriptDocs = await collection.get({
    whereDocument: { $regex: '^.*Script.*$' },
  });
  console.log(`   Found ${scriptDocs.ids.length} documents:`, scriptDocs.ids);

  // ==================== Combined Filters ====================

  console.log('\n=== Combined Filters ===\n');

  // 10. Combine metadata and document filters
  console.log('10. Get beginner documents containing "Python":');
  const beginnerPython = await collection.get({
    where: { difficulty: 'beginner' },
    whereDocument: { $contains: 'Python' },
  });
  console.log(`   Found ${beginnerPython.ids.length} documents:`, beginnerPython.ids);

  // ==================== Filter with Query ====================

  console.log('\n=== Vector Query with Filters ===\n');

  // 11. Vector query with metadata filter
  console.log('11. Query similar to [3.0, 4.0, 5.0] with category=programming:');
  const filteredQuery = await collection.query({
    queryEmbeddings: [[3.0, 4.0, 5.0]],
    nResults: 3,
    where: { category: 'programming' },
  });
  console.log(`   Found ${filteredQuery.ids[0].length} results:`, filteredQuery.ids[0]);
  console.log(`   Distances:`, filteredQuery.distances![0]);

  // ==================== Delete with Filters ====================

  console.log('\n=== Delete with Filters ===\n');

  // 12. Delete documents with metadata filter
  console.log('12. Delete documents with difficulty=beginner:');
  await collection.delete({
    where: { difficulty: 'beginner' },
  });

  const remainingCount = await collection.count();
  console.log(`   Remaining documents: ${remainingCount}`);

  // Cleanup
  await client.deleteCollection('filter_test');
  await client.close();

  console.log('\n✅ All filter examples completed!');
}

main().catch(console.error);
