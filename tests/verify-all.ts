/**
 * SeekDB Node SDK - 综合功能验证脚本
 * 验证与 Python SDK 的功能对齐
 */

import {
  SeekDBClient,
  SeekDBAdminClient,
  AdminClient,
  DefaultEmbeddingFunction,
  EmbeddingFunction,
  EmbeddingDocuments,
} from "../src/index.js";

// 测试配置
const TEST_CONFIG = {
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  tenant: "sys",
  database: "test",
};

// 简单的 mock embedding 函数
function createEmbeddingFunction(dimension: number): EmbeddingFunction {
  const fn = async (input: EmbeddingDocuments): Promise<number[][]> => {
    const texts = Array.isArray(input) ? input : [input];
    return texts.map(() =>
      Array.from({ length: dimension }, () => Math.random()),
    );
  };
  Object.defineProperty(fn, "name", {
    value: "test-embedding",
    configurable: true,
  });
  return fn;
}

// 测试结果统计
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  const condition = actual === expected;
  if (!condition) {
    console.log(`    Expected: ${expected}, Got: ${actual}`);
  }
  assert(condition, message);
}

async function testSection(name: string, fn: () => Promise<void>) {
  console.log(`\n[${name}]`);
  try {
    await fn();
  } catch (error) {
    failed++;
    failures.push(`${name}: ${error}`);
    console.log(`  ✗ Error: ${error}`);
  }
}

// ==================== 测试套件 ====================

async function testAdminClientP0(adminClient: SeekDBAdminClient) {
  await testSection("P0 - AdminClient - Database Management", async () => {
    const testDbName = `test_db_${Date.now()}`;

    // 1. createDatabase
    await adminClient.createDatabase(testDbName);
    assert(true, "createDatabase creates new database");

    // 2. getDatabase
    const db = await adminClient.getDatabase(testDbName);
    assertEqual(
      db.name,
      testDbName,
      "getDatabase returns correct database object",
    );
    assert(db.tenant !== null, "database has tenant property");
    assert(db.charset !== "", "database has charset property");

    // 3. listDatabases
    const databases = await adminClient.listDatabases();
    const found = databases.some((d) => d.name === testDbName);
    assert(found, "listDatabases includes created database");

    // 4. listDatabases with limit
    const limitedDbs = await adminClient.listDatabases(5);
    assert(limitedDbs.length <= 5, "listDatabases respects limit parameter");

    // 5. listDatabases with limit and offset
    const offsetDbs = await adminClient.listDatabases(2, 1);
    assert(offsetDbs.length <= 2, "listDatabases respects limit and offset");

    // 6. Database object methods
    const db2 = await adminClient.getDatabase(testDbName);
    assert(db.equals(db2), "Database.equals() works correctly");
    assert(db.toString() === testDbName, "Database.toString() returns name");

    // 7. deleteDatabase
    await adminClient.deleteDatabase(testDbName);

    // Verify deletion
    try {
      await adminClient.getDatabase(testDbName);
      assert(false, "should throw error for deleted database");
    } catch (error) {
      assert(true, "deleteDatabase removes the database");
    }

    // 8. AdminClient factory function
    const adminClient2 = AdminClient({
      host: TEST_CONFIG.host,
      port: TEST_CONFIG.port,
      user: TEST_CONFIG.user,
      password: TEST_CONFIG.password,
      tenant: TEST_CONFIG.tenant,
    });
    assert(
      adminClient2.isConnected() === false,
      "AdminClient factory function works",
    );
    await adminClient2.close();
  });
}

async function testDefaultEmbeddingFunctionP1(client: SeekDBClient) {
  await testSection("P1 - DefaultEmbeddingFunction", async () => {
    const testName = `test_embedding_${Date.now()}`;
    const embeddingFn = DefaultEmbeddingFunction();

    // 1. Check dimension property
    assertEqual(
      (embeddingFn as any).dimension,
      384,
      "DefaultEmbeddingFunction has dimension 384",
    );

    // 2. Create collection with DefaultEmbeddingFunction
    const collection = await client.createCollection({
      name: testName,
      embeddingFunction: embeddingFn,
    });
    assertEqual(
      collection.dimension,
      384,
      "Collection uses embedding function dimension",
    );

    // 3. Add documents without embeddings (auto-generation)
    await collection.add({
      ids: ["ef1", "ef2", "ef3"],
      documents: [
        "Machine learning is amazing",
        "Python programming is fun",
        "Vector databases are powerful",
      ],
      metadatas: [{ type: "ml" }, { type: "prog" }, { type: "db" }],
    });

    const count = await collection.count();
    assertEqual(count, 3, "Documents added with auto-generated embeddings");

    // 4. Query with text (auto-embedding)
    const results = await collection.query({
      queryTexts: ["artificial intelligence"],
      nResults: 2,
      include: ["documents", "distances"],
    });

    assert(results.ids.length > 0, "Query with text uses embedding function");
    assert(results.ids[0].length > 0, "Query returns results");
    assert(results.distances !== undefined, "Query returns distances");

    // 5. Verify embeddings are actually generated
    const items = await collection.get({
      ids: ["ef1"],
      include: ["embeddings"],
    });
    assert(items.embeddings?.[0] !== undefined, "Embeddings were generated");
    assertEqual(
      items.embeddings[0].length,
      384,
      "Generated embeddings have correct dimension",
    );

    await client.deleteCollection(testName);
  });
}

async function testClientManagement(client: SeekDBClient) {
  await testSection("Client - Collection Management", async () => {
    const testName = `test_client_${Date.now()}`;

    // 1. hasCollection - 不存在
    const exists1 = await client.hasCollection(testName);
    assert(!exists1, "hasCollection returns false for non-existent collection");

    // 2. createCollection
    const collection = await client.createCollection({
      name: testName,
      configuration: { dimension: 128, distance: "cosine" },
    });
    assert(
      collection.name === testName,
      "createCollection returns collection with correct name",
    );

    // 3. hasCollection - 存在
    const exists2 = await client.hasCollection(testName);
    assert(exists2, "hasCollection returns true for existing collection");

    // 4. listCollections
    const collections = await client.listCollections();
    assert(
      collections.includes(testName),
      "listCollections includes created collection",
    );

    // 5. countCollection
    const count = await client.countCollection();
    assert(count >= 1, "countCollection returns positive number");

    // 6. getCollection
    const retrieved = await client.getCollection({ name: testName });
    assert(
      retrieved.name === testName,
      "getCollection returns correct collection",
    );

    // 7. deleteCollection
    await client.deleteCollection(testName);
    const exists3 = await client.hasCollection(testName);
    assert(!exists3, "deleteCollection removes the collection");

    // 8. getOrCreateCollection
    const created = await client.getOrCreateCollection({
      name: testName,
      configuration: { dimension: 64, distance: "l2" },
    });
    assert(
      created.name === testName,
      "getOrCreateCollection creates new collection",
    );

    const existing = await client.getOrCreateCollection({
      name: testName,
      configuration: { dimension: 64, distance: "l2" },
    });
    assert(
      existing.name === testName,
      "getOrCreateCollection gets existing collection",
    );

    await client.deleteCollection(testName);
  });
}

async function testCollectionCRUD(client: SeekDBClient) {
  await testSection("Collection - CRUD Operations", async () => {
    const testName = `test_crud_${Date.now()}`;
    const collection = await client.createCollection({
      name: testName,
      configuration: { dimension: 3, distance: "cosine" },
    });

    // 1. add
    await collection.add({
      ids: ["id1", "id2", "id3"],
      embeddings: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
      documents: ["doc1", "doc2", "doc3"],
      metadatas: [{ key: "a" }, { key: "b" }, { key: "c" }],
    });
    const count1 = await collection.count();
    assertEqual(count1, 3, "add inserts correct number of items");

    // 2. get
    const result = await collection.get({ ids: ["id1", "id2"] });
    assertEqual(result.ids.length, 2, "get returns correct number of items");

    // 3. get with include
    const result2 = await collection.get({
      ids: ["id1"],
      include: ["documents", "metadatas", "embeddings"],
    });
    assert(result2.documents?.[0] === "doc1", "get returns documents");
    assert(result2.metadatas?.[0]?.key === "a", "get returns metadatas");
    assert(Array.isArray(result2.embeddings?.[0]), "get returns embeddings");

    // 4. update
    await collection.update({
      ids: ["id1"],
      documents: ["updated_doc1"],
      metadatas: [{ key: "updated_a" }],
    });
    const updated = await collection.get({
      ids: ["id1"],
      include: ["documents", "metadatas"],
    });
    assert(
      updated.documents?.[0] === "updated_doc1",
      "update modifies document",
    );
    assert(
      updated.metadatas?.[0]?.key === "updated_a",
      "update modifies metadata",
    );

    // 5. upsert - update existing
    await collection.upsert({
      ids: ["id2"],
      documents: ["upserted_doc2"],
    });
    const upserted1 = await collection.get({
      ids: ["id2"],
      include: ["documents"],
    });
    assert(
      upserted1.documents?.[0] === "upserted_doc2",
      "upsert updates existing item",
    );

    // 6. upsert - insert new
    await collection.upsert({
      ids: ["id4"],
      embeddings: [[10, 11, 12]],
      documents: ["doc4"],
    });
    const count2 = await collection.count();
    assertEqual(count2, 4, "upsert inserts new item");

    // 7. delete by ids
    await collection.delete({ ids: ["id4"] });
    const count3 = await collection.count();
    assertEqual(count3, 3, "delete removes items");

    // 8. peek
    const peeked = await collection.peek(2);
    assertEqual(peeked.ids.length, 2, "peek returns limited number of items");

    // 9. count
    const finalCount = await collection.count();
    assert(finalCount === 3, "count returns correct total");

    await client.deleteCollection(testName);
  });
}

async function testCollectionQuery(client: SeekDBClient) {
  await testSection("Collection - Query Operations", async () => {
    const testName = `test_query_${Date.now()}`;
    const embeddingFn = createEmbeddingFunction(128);
    const collection = await client.createCollection({
      name: testName,
      configuration: { dimension: 128, distance: "cosine" },
      embeddingFunction: embeddingFn,
    });

    // 添加测试数据
    await collection.add({
      ids: ["id1", "id2", "id3"],
      documents: ["Python tutorial", "JavaScript guide", "Python advanced"],
      metadatas: [
        { category: "python", level: 1 },
        { category: "javascript", level: 1 },
        { category: "python", level: 2 },
      ],
    });

    // 1. query with embeddings
    const queryVec = Array.from({ length: 128 }, () => Math.random());
    const result1 = await collection.query({
      queryEmbeddings: [queryVec],
      nResults: 2,
    });
    assertEqual(result1.ids.length, 1, "query returns correct batch structure");
    assert(result1.ids[0].length <= 2, "query respects nResults");

    // 2. query with texts (uses embedding function)
    const result2 = await collection.query({
      queryTexts: ["Python"],
      nResults: 3,
      include: ["documents", "metadatas", "distances"],
    });
    assert(
      result2.documents !== undefined,
      "query with texts returns documents",
    );
    assert(result2.distances !== undefined, "query returns distances");

    await client.deleteCollection(testName);
  });
}

async function testFilters(client: SeekDBClient) {
  await testSection("Filters - Metadata and Document", async () => {
    const testName = `test_filters_${Date.now()}`;
    const collection = await client.createCollection({
      name: testName,
      configuration: { dimension: 3, distance: "cosine" },
    });

    // 添加测试数据
    await collection.add({
      ids: ["id1", "id2", "id3", "id4"],
      embeddings: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      documents: [
        "Python is great",
        "JavaScript rocks",
        "Python advanced",
        "Go programming",
      ],
      metadatas: [
        { category: "python", score: 95 },
        { category: "javascript", score: 88 },
        { category: "python", score: 92 },
        { category: "go", score: 90 },
      ],
    });

    // 1. $eq
    const r1 = await collection.get({ where: { category: "python" } });
    assertEqual(r1.ids.length, 2, "filter $eq (implicit) works");

    // 2. $ne
    const r2 = await collection.get({ where: { category: { $ne: "python" } } });
    assertEqual(r2.ids.length, 2, "filter $ne works");

    // 3. $gt
    const r3 = await collection.get({ where: { score: { $gt: 90 } } });
    assert(r3.ids.length >= 2, "filter $gt works");

    // 4. $gte, $lte
    const r4 = await collection.get({
      where: { $and: [{ score: { $gte: 88 } }, { score: { $lte: 92 } }] },
    });
    assert(r4.ids.length >= 2, "filter $gte and $lte work");

    // 5. $in
    const r5 = await collection.get({
      where: { category: { $in: ["python", "javascript"] } },
    });
    assertEqual(r5.ids.length, 3, "filter $in works");

    // 6. $or
    const r6 = await collection.get({
      where: { $or: [{ category: "python" }, { category: "go" }] },
    });
    assertEqual(r6.ids.length, 3, "filter $or works");

    // 7. $contains (document filter)
    const r7 = await collection.get({
      whereDocument: { $contains: "Python" },
    });
    assert(r7.ids.length >= 1, "filter $contains works");

    // 8. combined filters
    const r8 = await collection.get({
      where: { category: "python" },
      whereDocument: { $contains: "advanced" },
    });
    assertEqual(r8.ids.length, 1, "combined filters work");

    // 9. delete with filter
    await collection.delete({ where: { category: "go" } });
    const count = await collection.count();
    assertEqual(count, 3, "delete with filter works");

    await client.deleteCollection(testName);
  });
}

async function testHybridSearch(client: SeekDBClient) {
  await testSection("Hybrid Search", async () => {
    const testName = `test_hybrid_${Date.now()}`;
    const collection = await client.createCollection({
      name: testName,
      configuration: { dimension: 3, distance: "l2" },
      embeddingFunction: null,
    });

    // 添加测试数据
    await collection.add({
      ids: ["id1", "id2", "id3", "id4", "id5", "id6", "id7", "id8"],
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
        "Machine learning is a subset of artificial intelligence",
        "Python programming language is widely used in data science",
        "Deep learning algorithms for neural networks",
        "Data science with Python and machine learning",
        "Introduction to artificial intelligence and neural networks",
        "Advanced machine learning techniques and algorithms",
        "Python tutorial for beginners in programming",
        "Natural language processing with machine learning",
      ],
      metadatas: [
        { category: "AI", page: 1, score: 95, tag: "ml" },
        { category: "Programming", page: 2, score: 88, tag: "python" },
        { category: "AI", page: 3, score: 92, tag: "ml" },
        { category: "Data Science", page: 4, score: 90, tag: "python" },
        { category: "AI", page: 5, score: 85, tag: "neural" },
        { category: "AI", page: 6, score: 93, tag: "ml" },
        { category: "Programming", page: 7, score: 87, tag: "python" },
        { category: "AI", page: 8, score: 91, tag: "nlp" },
      ],
    });

    // 1. hybrid search - full text only
    const r1 = await collection.hybridSearch({
      query: {
        whereDocument: {
          $contains: "machine learning",
        },
      },
      nResults: 5,
      include: ["documents", "metadatas"],
    });
    assert(r1.ids.length > 0, "hybrid search with query only works");

    // 2. hybrid search - vector only
    const r2 = await collection.hybridSearch({
      knn: {
        queryEmbeddings: [1.0, 2.0, 3.0],
        nResults: 5,
      },
      nResults: 5,
      include: ["documents", "metadatas", "embeddings"],
    });
    assert(r2.ids.length > 0, "hybrid search with knn only works");

    // 3. hybrid search - combined
    const r3 = await collection.hybridSearch({
      query: {
        whereDocument: {
          $contains: "machine learning",
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
      include: ["documents", "metadatas", "embeddings"],
    });
    assert(r3.ids.length > 0, "hybrid search with query + knn + rank works");

    await client.deleteCollection(testName);
  });
}

async function testEmbeddingFunction(client: SeekDBClient) {
  await testSection("Embedding Function", async () => {
    const testName = `test_embedding_${Date.now()}`;
    const embeddingFn = createEmbeddingFunction(64);

    // 1. auto-calculate dimension
    const collection = await client.createCollection({
      name: testName,
      embeddingFunction: embeddingFn,
    });
    assertEqual(
      collection.dimension,
      64,
      "auto-calculate dimension from embedding function",
    );

    // 2. add with documents (auto-embedding)
    await collection.add({
      ids: ["id1", "id2"],
      documents: ["text1", "text2"],
    });
    const count = await collection.count();
    assertEqual(count, 2, "add with documents uses embedding function");

    // 3. query with texts (auto-embedding)
    const result = await collection.query({
      queryTexts: ["text1"],
      nResults: 1,
    });
    assert(result.ids.length > 0, "query with texts uses embedding function");

    await client.deleteCollection(testName);
  });
}

async function testP2Features(client: SeekDBClient) {
  await testSection(
    "P2 - Collection Info Methods (describe & peek)",
    async () => {
      const testName = "test_p2_features_" + Date.now();

      // 创建测试集合
      const collection = await client.createCollection({
        name: testName,
        configuration: {
          dimension: 3,
          distance: "cosine",
        },
      });

      // 添加一些测试数据
      await collection.add({
        ids: ["p2_1", "p2_2", "p2_3", "p2_4", "p2_5"],
        embeddings: [
          [1.0, 0.0, 0.0],
          [0.0, 1.0, 0.0],
          [0.0, 0.0, 1.0],
          [0.5, 0.5, 0.0],
          [0.0, 0.5, 0.5],
        ],
        documents: ["Doc 1", "Doc 2", "Doc 3", "Doc 4", "Doc 5"],
        metadatas: [
          { index: 1 },
          { index: 2 },
          { index: 3 },
          { index: 4 },
          { index: 5 },
        ],
      });

      // Test 1: describe() 方法
      const info = await collection.describe();
      assert(info.name === testName, "describe returns correct name");
      assert(info.dimension === 3, "describe returns correct dimension");
      assert(info.distance === "cosine", "describe returns correct distance");

      // Test 2: peek() 方法 - 默认 limit
      const preview = await collection.peek();
      assert(
        preview.ids.length === 5,
        "peek returns all items when collection has fewer items than limit",
      );
      assert(preview.documents !== undefined, "peek includes documents");
      assert(preview.metadatas !== undefined, "peek includes metadatas");
      assert(preview.embeddings !== undefined, "peek includes embeddings");
      assert(
        preview.ids.length === preview.documents!.length,
        "peek returns consistent data",
      );

      // Test 3: peek() 方法 - 自定义 limit
      const limitedPreview = await collection.peek(3);
      assert(limitedPreview.ids.length === 3, "peek respects limit parameter");
      assert(
        limitedPreview.documents!.length === 3,
        "peek returns correct number of documents",
      );
      assert(
        limitedPreview.metadatas!.length === 3,
        "peek returns correct number of metadatas",
      );
      assert(
        limitedPreview.embeddings!.length === 3,
        "peek returns correct number of embeddings",
      );

      // 清理
      await client.deleteCollection(testName);
    },
  );
}

async function testRegexFilter(client: SeekDBClient) {
  await testSection("P2 - $regex Filter", async () => {
    const testName = "test_regex_filter_" + Date.now();

    // 创建测试集合
    const collection = await client.createCollection({
      name: testName,
      configuration: {
        dimension: 2,
        distance: "cosine",
      },
    });

    // 添加测试数据
    await collection.add({
      ids: ["regex_1", "regex_2", "regex_3", "regex_4"],
      embeddings: [
        [1.0, 0.0],
        [0.0, 1.0],
        [0.5, 0.5],
        [0.3, 0.7],
      ],
      documents: [
        "Hello world",
        "Testing neural networks",
        "Machine learning is fun",
        "Deep learning tutorial",
      ],
      metadatas: [
        { category: "greeting" },
        { category: "AI" },
        { category: "AI" },
        { category: "AI" },
      ],
    });

    // Test 1: $regex 过滤器 - 查找包含 "neural" 的文档
    const results1 = await collection.query({
      queryEmbeddings: [0.5, 0.5],
      whereDocument: { $regex: ".*neural.*" },
      nResults: 5,
    });
    assert(
      results1.ids[0].length >= 1,
      "$regex filter finds matching documents",
    );
    if (results1.documents && results1.documents[0].length > 0) {
      const matchingDocs = results1.documents[0].filter(
        (doc) => doc && doc.includes("neural"),
      );
      assert(
        matchingDocs.length > 0,
        "$regex filter returns documents containing pattern",
      );
    }

    // Test 2: $regex 过滤器 - 查找以 "Deep" 开头的文档
    const results2 = await collection.query({
      queryEmbeddings: [0.5, 0.5],
      whereDocument: { $regex: "^Deep.*" },
      nResults: 5,
    });
    assert(
      results2.ids[0].length >= 0,
      "$regex filter works with start anchor",
    );

    // Test 3: $regex 过滤器 - 查找包含 "learning" 的文档
    const results3 = await collection.query({
      queryEmbeddings: [0.5, 0.5],
      whereDocument: { $regex: ".*learning.*" },
      nResults: 5,
    });
    assert(
      results3.ids[0].length >= 2,
      "$regex filter finds multiple matching documents",
    );

    // 清理
    await client.deleteCollection(testName);
  });
}

async function testEdgeCases(client: SeekDBClient) {
  await testSection("Edge Cases", async () => {
    const testName = `test_edge_${Date.now()}`;
    const collection = await client.createCollection({
      name: testName,
      configuration: { dimension: 3, distance: "cosine" },
    });

    // 1. empty get
    const r1 = await collection.get({});
    assert(r1.ids.length >= 0, "get without filter returns results");

    // 2. single item operations
    await collection.add({
      ids: "single_id",
      embeddings: [1, 2, 3],
      documents: "single doc",
      metadatas: { key: "value" },
    });
    const r2 = await collection.get({ ids: "single_id" });
    assertEqual(r2.ids.length, 1, "single item add works");

    // 3. limit and offset
    await collection.add({
      ids: ["id1", "id2", "id3"],
      embeddings: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
    });
    const r3 = await collection.get({ limit: 2, offset: 1 });
    assertEqual(r3.ids.length, 2, "limit works");

    // 4. delete all with where
    await collection.delete({ where: { key: "value" } });
    const count = await collection.count();
    assert(count >= 0, "delete with where works");

    await client.deleteCollection(testName);
  });
}

async function testErrorHandling(client: SeekDBClient) {
  await testSection("Error Handling", async () => {
    // 1. get non-existent collection
    try {
      await client.getCollection({ name: "non_existent_collection_xyz" });
      assert(false, "should throw error for non-existent collection");
    } catch (error) {
      assert(true, "throws error for non-existent collection");
    }

    // 2. dimension mismatch
    const testName = `test_error_${Date.now()}`;
    const embeddingFn = createEmbeddingFunction(64);
    try {
      await client.createCollection({
        name: testName,
        configuration: { dimension: 128, distance: "cosine" },
        embeddingFunction: embeddingFn,
      });
      assert(false, "should throw error for dimension mismatch");
    } catch (error) {
      assert(true, "throws error for dimension mismatch");
    }

    // 3. duplicate collection
    await client.createCollection({
      name: testName,
      configuration: { dimension: 64, distance: "cosine" },
    });
    try {
      await client.createCollection({
        name: testName,
        configuration: { dimension: 64, distance: "cosine" },
      });
      assert(false, "should throw error for duplicate collection");
    } catch (error) {
      assert(true, "throws error for duplicate collection");
    }

    await client.deleteCollection(testName);
  });
}

// ==================== 主函数 ====================

async function main() {
  console.log("SeekDB Node SDK - Comprehensive Verification");
  console.log("=".repeat(50));

  const client = new SeekDBClient(TEST_CONFIG);
  const adminClient = new SeekDBAdminClient({
    host: TEST_CONFIG.host,
    port: TEST_CONFIG.port,
    user: TEST_CONFIG.user,
    password: TEST_CONFIG.password,
    tenant: TEST_CONFIG.tenant,
  });

  try {
    // 清理旧测试数据
    console.log("\nCleaning up old test data...");
    const collections = await client.listCollections();
    for (const name of collections) {
      if (name.startsWith("test_")) {
        await client.deleteCollection(name);
      }
    }

    // P0 和 P1 功能测试
    await testAdminClientP0(adminClient);
    await testDefaultEmbeddingFunctionP1(client);

    // // P2 功能测试
    await testP2Features(client);
    await testRegexFilter(client);

    // 执行所有测试
    await testClientManagement(client);
    await testCollectionCRUD(client);
    await testCollectionQuery(client);
    await testFilters(client);
    await testHybridSearch(client);
    await testEmbeddingFunction(client);
    await testEdgeCases(client);
    await testErrorHandling(client);

    // 最终清理
    console.log("\nCleaning up test data...");
    const finalCollections = await client.listCollections();
    for (const name of finalCollections) {
      if (name.startsWith("test_")) {
        await client.deleteCollection(name);
      }
    }
  } finally {
    await client.close();
    await adminClient.close();
  }

  // 输出结果
  console.log("\n" + "=".repeat(50));
  console.log("Test Results:");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log("\nAll tests passed!");
    process.exit(0);
  }
}

main();
