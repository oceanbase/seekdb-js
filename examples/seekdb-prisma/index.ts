/**
 * seekdb-js + Prisma: vector/hybrid search with type-safe relational tables (same database, two connections).
 *
 * Prerequisites:
 * - seekdb Server or OceanBase running (e.g. 127.0.0.1:2881).
 * - Copy .env.example to .env and set DATABASE_URL to the same database as SeekdbClient.
 * - Run: pnpm install && pnpm db:generate && pnpm db:push && pnpm start
 */
import { SeekdbClient } from "seekdb";
import { PrismaClient } from "@prisma/client";
import { DEMO_IDS, DEMO_DOCS, DEMO_USERS } from "./shared.js";

const COLLECTION_NAME = "seekdb_prisma_docs";

async function main() {
  const client = new SeekdbClient({
    host: process.env.SEEKDB_HOST ?? "127.0.0.1",
    port: parseInt(process.env.SEEKDB_PORT ?? "2881", 10),
    user: process.env.SEEKDB_USER ?? "root",
    password: process.env.SEEKDB_PASSWORD ?? "",
    database: process.env.SEEKDB_DATABASE ?? "test",
  });

  const prisma = new PrismaClient();
  const collection = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
  });

  await collection.add({ ids: [...DEMO_IDS], documents: [...DEMO_DOCS] });

  for (const user of DEMO_USERS) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: user,
      update: {},
    });
  }

  const result = await collection.hybridSearch({
    query: { whereDocument: { $contains: "vector" } },
    knn: { queryTexts: ["database search"] },
    nResults: 5,
  });
  const resultIds = (result.ids?.flat().filter(Boolean) ?? []) as string[];

  // Relational query by ids (type-safe)
  const users =
    resultIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: resultIds } } })
      : [];

  console.log("Vector/hybrid search result ids:", resultIds);
  console.log("Relational users for those ids:", users);

  await client.close();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
