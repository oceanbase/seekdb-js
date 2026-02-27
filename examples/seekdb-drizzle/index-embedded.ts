/**
 * seekdb-js + Drizzle in Embedded mode: no server, use a mysql-proxy callback that runs SQL via client.execute().
 *
 * Run: pnpm install && pnpm run start:embedded
 */
import { SeekdbClient } from "seekdb";
import { drizzle } from "drizzle-orm/mysql-proxy";
import { inArray } from "drizzle-orm";
import { users } from "./schema.js";
import { DEMO_IDS, DEMO_DOCS_EMBEDDED, DEMO_USERS } from "./shared.js";

/** Drizzle mysql-proxy runner from a SeekdbClient (Embedded or Server). */
function getDrizzleProxyRunner(client: SeekdbClient) {
  return async (
    sql: string,
    params: unknown[],
    method: string
  ): Promise<{ rows: unknown[] | unknown[][] }> => {
    const result = await client.execute(sql, params);
    if (result === null) return { rows: method === "get" ? [] : [] };
    const rows = result.map((row) => Object.values(row));
    return { rows: method === "get" ? (rows[0] ?? []) : rows };
  };
}

const COLLECTION_NAME = "seekdb_drizzle_embed_docs";
const DB_PATH = "./seekdb.db";

async function main() {
  const client = new SeekdbClient({ path: DB_PATH, database: "test" });
  const db = drizzle(getDrizzleProxyRunner(client));

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

  await collection.add({
    ids: [...DEMO_IDS],
    documents: [...DEMO_DOCS_EMBEDDED],
  });

  try {
    await db.insert(users).values([...DEMO_USERS]);
  } catch {
    // ignore if already inserted
  }

  const result = await collection.hybridSearch({
    query: { whereDocument: { $contains: "vector" } },
    knn: { queryTexts: ["database"] },
    nResults: 5,
  });
  const resultIds = (result.ids?.flat().filter(Boolean) ?? []) as string[];

  const usersList =
    resultIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, resultIds))
      : [];

  console.log("Embedded: vector result ids:", resultIds);
  console.log("Embedded: users for those ids:", usersList);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
