/**
 * seekdb-js + Prisma in Embedded mode: use @seekdb/prisma-adapter so Prisma runs SQL via client.execute().
 *
 * Prerequisites: Node 20+ (for seekdb embedded). No server required.
 * Run: pnpm install && pnpm db:generate && pnpm run start:embedded
 */
import { SeekdbClient } from "seekdb";
import { PrismaSeekdb } from "@seekdb/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { DEMO_IDS, DEMO_DOCS_EMBEDDED, DEMO_USERS } from "./shared.js";

const COLLECTION_NAME = "seekdb_prisma_embed_docs";
const DB_PATH = "./seekdb.db";

async function main() {
  const client = new SeekdbClient({ path: DB_PATH, database: "test" });
  const adapter = new PrismaSeekdb(client);
  const prisma = new PrismaClient({ adapter });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS User (
      id VARCHAR(191) NOT NULL,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NULL,
      PRIMARY KEY (id)
    )
  `);

  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
  });

  await collection.add({
    ids: [...DEMO_IDS],
    documents: [...DEMO_DOCS_EMBEDDED],
  });

  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: user,
      update: {},
    });
  }

  const result = await collection.hybridSearch({
    query: { whereDocument: { $contains: "vector" } },
    knn: { queryTexts: ["database"] },
    nResults: 5,
  });
  const resultIds = (result.ids?.flat().filter(Boolean) ?? []) as string[];

  const users =
    resultIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: resultIds } } })
      : [];

  console.log("Embedded: vector result ids:", resultIds);
  console.log("Embedded: users for those ids:", users);

  await prisma.$disconnect();
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
