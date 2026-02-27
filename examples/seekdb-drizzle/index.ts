/**
 * seekdb-js + Drizzle: vector/hybrid search with type-safe relational tables (same DB, two connections).
 *
 * Prerequisites: seekdb Server or OceanBase running (e.g. host 127.0.0.1, port 2881).
 * Run: pnpm install && pnpm start
 */
import { createConnection } from "mysql2/promise";
import { SeekdbClient } from "seekdb";
import { drizzle } from "drizzle-orm/mysql2";
import { inArray } from "drizzle-orm";
import { users } from "./schema.js";
import { DEMO_IDS, DEMO_DOCS, DEMO_USERS } from "./shared.js";

const COLLECTION_NAME = "seekdb_drizzle_docs";

async function main() {
  const dbConfig = {
    host: process.env.SEEKDB_HOST ?? "127.0.0.1",
    port: parseInt(process.env.SEEKDB_PORT ?? "2881", 10),
    user: process.env.SEEKDB_USER ?? "root",
    password: process.env.SEEKDB_PASSWORD ?? "",
    database: process.env.SEEKDB_DATABASE ?? "test",
  };

  const client = new SeekdbClient(dbConfig);
  const conn = await createConnection(dbConfig);
  const db = drizzle(conn);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255)
    )
  `);

  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
  });

  await collection.add({ ids: [...DEMO_IDS], documents: [...DEMO_DOCS] });

  try {
    await db.insert(users).values([...DEMO_USERS]);
  } catch {
    // ignore if already inserted (e.g. re-run)
  }

  // Hybrid search → get ids
  const result = await collection.hybridSearch({
    query: { whereDocument: { $contains: "vector" } },
    knn: { queryTexts: ["database search"] },
    nResults: 5,
  });
  const resultIds = (result.ids?.flat().filter(Boolean) ?? []) as string[];

  // Type-safe relational query by ids
  const usersList =
    resultIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, resultIds))
      : [];

  console.log("Vector/hybrid search result ids:", resultIds);
  console.log("Relational users for those ids:", usersList);

  await conn.end();
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
