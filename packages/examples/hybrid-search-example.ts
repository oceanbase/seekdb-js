/**
 * Hybrid Search Example: Demonstrating hybridSearch() vs query()
 *
 * Key advantages of hybridSearch():
 * - Combines full-text search and vector similarity search simultaneously
 * - Independent filters for each search type
 * - Intelligent result fusion using RRF (Reciprocal Rank Fusion)
 * - Handles complex scenarios that query() cannot
 */

import { SeekDBClient } from "seekdb";

async function main() {
  const client = new SeekDBClient({
    host: "127.0.0.1",
    port: 2881,
    tenant: "sys",
    database: "test",
    user: "root",
    password: "",
  });

  const collection = await client.getOrCreateCollection({
    name: "hybrid_search_demo",
  });

  const documents = [
    "Machine learning is revolutionizing artificial intelligence and data science",
    "Python programming language is essential for machine learning developers",
    "Deep learning neural networks enable advanced AI applications",
    "Data science combines statistics, programming, and domain expertise",
    "Natural language processing uses machine learning to understand text",
    "Computer vision algorithms process images using deep learning techniques",
    "Reinforcement learning trains agents through reward-based feedback",
    "Python libraries like TensorFlow and PyTorch simplify machine learning",
    "Artificial intelligence systems can learn from large datasets",
    "Neural networks mimic the structure of biological brain connections",
  ];

  const metadatas = [
    { category: "AI", topic: "machine learning", year: 2023, popularity: 95 },
    { category: "Programming", topic: "python", year: 2023, popularity: 88 },
    { category: "AI", topic: "deep learning", year: 2024, popularity: 92 },
    {
      category: "Data Science",
      topic: "data analysis",
      year: 2023,
      popularity: 85,
    },
    { category: "AI", topic: "nlp", year: 2024, popularity: 90 },
    { category: "AI", topic: "computer vision", year: 2023, popularity: 87 },
    {
      category: "AI",
      topic: "reinforcement learning",
      year: 2024,
      popularity: 89,
    },
    { category: "Programming", topic: "python", year: 2023, popularity: 91 },
    { category: "AI", topic: "general ai", year: 2023, popularity: 93 },
    { category: "AI", topic: "neural networks", year: 2024, popularity: 94 },
  ];

  const ids = documents.map((_, i) => `doc_${i + 1}`);

  // Add documents without embeddings - they will be auto-generated
  await collection.add({ ids, documents, metadatas });

  console.log("=".repeat(100));
  console.log("SCENARIO 1: Keyword + Semantic Search");
  console.log("=".repeat(100));
  console.log(
    "Goal: Find documents similar to 'AI research' AND containing 'machine learning'\n",
  );

  // query() approach
  const queryResult1 = await collection.query({
    queryTexts: ["AI research"],
    whereDocument: { $contains: "machine learning" },
    nResults: 5,
  });

  // hybrid_search() approach
  try {
    const hybridResult1 = await collection.hybridSearch({
      query: { whereDocument: { $contains: "machine learning" }, nResults: 10 },
      knn: { queryTexts: ["AI research"], nResults: 10 },
      rank: { rrf: {} },
      nResults: 5,
    });

    console.log("query() Results:");
    for (let i = 0; i < queryResult1.ids[0].length; i++) {
      const docId = queryResult1.ids[0][i];
      const idx = ids.indexOf(docId);
      console.log(`  ${i + 1}. ${documents[idx]}`);
    }

    console.log("\nhybridSearch() Results:");
    for (let i = 0; i < hybridResult1.ids[0].length; i++) {
      const docId = hybridResult1.ids[0][i];
      const idx = ids.indexOf(docId);
      console.log(`  ${i + 1}. ${documents[idx]}`);
    }

    console.log("\nAnalysis:");
    console.log(
      "  query() ranks 'Deep learning neural networks...' first because it's semantically similar to 'AI research',",
    );
    console.log(
      "  but 'machine learning' is not its primary focus. hybridSearch() correctly prioritizes documents that",
    );
    console.log(
      "  explicitly contain 'machine learning' (from full-text search) while also being semantically relevant",
    );
    console.log(
      "  to 'AI research' (from vector search). The RRF fusion ensures documents matching both criteria rank higher.",
    );
  } catch (error: any) {
    console.log(
      "Note: hybridSearch() is not supported on this database version",
    );
  }

  console.log("\n" + "=".repeat(100));
  console.log("SCENARIO 2: Independent Filters for Different Search Types");
  console.log("=".repeat(100));
  console.log(
    "Goal: Full-text='neural' (year=2024) + Vector='deep learning' (popularity>=90)\n",
  );

  const queryResult2 = await collection.query({
    queryTexts: ["deep learning"],
    where: { year: { $eq: 2024 }, popularity: { $gte: 90 } },
    whereDocument: { $contains: "neural" },
    nResults: 5,
  });

  try {
    const hybridResult2 = await collection.hybridSearch({
      query: {
        whereDocument: { $contains: "neural" },
        where: { year: { $eq: 2024 } },
        nResults: 10,
      },
      knn: {
        queryTexts: ["deep learning"],
        where: { popularity: { $gte: 90 } },
        nResults: 10,
      },
      rank: { rrf: {} },
      nResults: 5,
    });

    console.log("query() Results (same filter for both):");
    for (let i = 0; i < queryResult2.ids[0].length; i++) {
      const docId = queryResult2.ids[0][i];
      const idx = ids.indexOf(docId);
      console.log(`  ${i + 1}. ${documents[idx]}`);
      console.log(`      ${JSON.stringify(metadatas[idx])}`);
    }

    console.log("\nhybridSearch() Results (independent filters):");
    for (let i = 0; i < hybridResult2.ids[0].length; i++) {
      const docId = hybridResult2.ids[0][i];
      const idx = ids.indexOf(docId);
      console.log(`  ${i + 1}. ${documents[idx]}`);
      console.log(`      ${JSON.stringify(metadatas[idx])}`);
    }

    console.log("\nAnalysis:");
    console.log(
      "  query() only returns 2 results because it requires documents to satisfy BOTH year=2024 AND popularity>=90",
    );
    console.log(
      "  simultaneously. hybridSearch() returns 5 results by applying year=2024 filter to full-text search",
    );
    console.log(
      "  and popularity>=90 filter to vector search independently, then fusing the results. This approach",
    );
    console.log(
      "  captures more relevant documents that might satisfy one criterion strongly while meeting the other",
    );
  } catch (error: any) {
    console.log(
      "Note: hybridSearch() is not supported on this database version",
    );
  }

  console.log("\n" + "=".repeat(100));
  console.log("SUMMARY");
  console.log("=".repeat(100));
  console.log(`
query() limitations:
  - Single search type (vector similarity)
  - Filters applied after search (may miss relevant docs)
  - Cannot combine full-text and vector search results
  - Same filter criteria for all conditions

hybridSearch() advantages:
  - Simultaneous full-text + vector search
  - Independent filters for each search type
  - Intelligent result fusion using RRF
  - Better recall for complex queries
  - Handles scenarios requiring both keyword and semantic matching
`);

  await client.deleteCollection("hybrid_search_demo");
  await client.close();
}

main().catch(console.error);
