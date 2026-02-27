# seekdb-js + Drizzle

Vector/hybrid search with seekdb-js and type-safe relational tables with Drizzle ORM.

- **Server mode**: same database, two connections — create a mysql2 connection with the same config and pass to `drizzle-orm/mysql2`.
- **Embedded mode**: in-process via a mysql-proxy callback (see `getDrizzleProxyRunner` in `index-embedded.ts`) + `drizzle-orm/mysql-proxy` (no server required).

## Prerequisites

- **Server**: seekdb Server or OceanBase (default: `127.0.0.1:2881`).
- **Embedded**: Node 20+ only (native addon loaded on first use).

## Run

**Server mode** (default):

```bash
pnpm install
pnpm start
# or from repo root: pnpm --filter seekdb-drizzle-example run start
```

**Embedded mode** (local DB file, no server):

```bash
pnpm install
pnpm run start:embedded
# or from repo root: pnpm --filter seekdb-drizzle-example run start:embedded
```

Optional env (Server): `SEEKDB_HOST`, `SEEKDB_PORT`, `SEEKDB_USER`, `SEEKDB_PASSWORD`, `SEEKDB_DATABASE`.

## What it does

1. **Server**: `SeekdbClient` with host/port; create a separate mysql2 connection (same config) and pass to `drizzle(conn)`.
2. **Embedded**: `SeekdbClient` with `path`; get proxy runner and pass to `drizzle(run)` (mysql-proxy).
3. Creates a collection and inserts documents; creates a `users` table and inserts rows (ids aligned).
4. Runs hybrid search, then queries `users` by result ids with Drizzle `inArray()`.
5. Prints merged-style output.

## Schema

- Relational tables are defined in `schema.ts` (Drizzle `mysqlTable`). Vector tables are managed by seekdb Collection API.
