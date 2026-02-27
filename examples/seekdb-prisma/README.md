# seekdb-js + Prisma

Vector/hybrid search with seekdb-js and type-safe relational tables with Prisma.

- **Server mode** (`pnpm start`): same database, two connections (SeekdbClient + PrismaClient via `DATABASE_URL`).
- **Embedded mode** (`pnpm run start:embedded`): use [@seekdb/prisma-adapter](https://www.npmjs.com/package/@seekdb/prisma-adapter) so Prisma runs SQL via `client.execute()` — no MySQL server.

## Prerequisites

- **Server**: seekdb Server or OceanBase (default: `127.0.0.1:2881`). **Embedded**: none (local DB file).
- Node 20+

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to the same host/port/user/password/database as your SeekdbClient (e.g. `mysql://root:@127.0.0.1:2881/test`). (Server mode only; Embedded uses a local DB file.)
2. Generate Prisma client and push schema (Server mode; Embedded creates the table in the script):

   ```bash
   pnpm install
   pnpm db:generate
   pnpm db:push   # Server only
   ```

3. Run (from this directory or from repo root with filter):
   - **Server**: `pnpm start` or `pnpm --filter seekdb-prisma-example run start`
   - **Embedded** (no server): `pnpm run start:embedded` or `pnpm --filter seekdb-prisma-example run start:embedded`

Optional env (Server): `SEEKDB_HOST`, `SEEKDB_PORT`, `SEEKDB_USER`, `SEEKDB_PASSWORD`, `SEEKDB_DATABASE`.

## What it does

1. Connects with `SeekdbClient` and `PrismaClient` to the **same database**.
2. Creates a collection and inserts documents; upserts `User` rows (ids aligned).
3. Runs hybrid search, then queries `User` by result ids with `prisma.user.findMany({ where: { id: { in: ids } } })`.
4. Prints merged-style output.

## Schema

- Relational models are in `schema.prisma`. Vector tables are managed by seekdb Collection API.
