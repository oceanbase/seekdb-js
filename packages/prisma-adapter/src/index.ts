/**
 * Prisma driver adapter for seekdb Embedded.
 * Use Prisma with seekdb Embedded.
 *
 * @example
 * ```ts
 * import { SeekdbClient } from "seekdb";
 * import { PrismaSeekdb } from "@seekdb/prisma-adapter";
 * import { PrismaClient } from "./generated/prisma";
 *
 * const client = new SeekdbClient({ path: "./seekdb.db", database: "test" });
 * const adapter = new PrismaSeekdb(client);
 * const prisma = new PrismaClient({ adapter });
 * ```
 */

export { PrismaSeekdbAdapterFactory as PrismaSeekdb } from "./adapter.js";
export type { SeekdbClientLike } from "./adapter.js";
