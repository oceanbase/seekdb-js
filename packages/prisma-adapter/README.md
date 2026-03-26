# @seekdb/prisma-adapter

Prisma driver adapter for **seekdb Embedded**. Use Prisma with seekdb Embedded.

- **Provider**: `mysql` (seekdb is MySQL-compatible)
- **Use case**: Vector/hybrid search with seekdb Collection API + type-safe relational tables with Prisma, all in one embedded database file.

## Requirements

- Node.js ≥ 18
- Prisma ≥ 6 (driver adapters supported; no preview flag needed in 6.19+)
- seekdb **Embedded** client (created with `path` and `database`, not `host`/`port`)

## Installation

```bash
npm install @seekdb/prisma-adapter seekdb @prisma/client
# or
pnpm add @seekdb/prisma-adapter seekdb @prisma/client
```

## Schema

In your `schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id    String  @id
  name  String
  email String?
}
```

Use `provider = "mysql"` so Prisma generates MySQL-compatible SQL. `DATABASE_URL` can be a placeholder when using the adapter (e.g. `mysql://localhost/ignored`).

## Usage

```typescript
import { SeekdbClient } from "seekdb";
import { PrismaSeekdb } from "@seekdb/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const client = new SeekdbClient({
  path: "./seekdb.db",
  database: "test",
});

const adapter = new PrismaSeekdb(client);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.user.create({
    data: { id: "1", name: "Alice", email: "alice@example.com" },
  });
  const users = await prisma.user.findMany();
  console.log(users);
  await prisma.$disconnect();
}

main();
```

- Create tables with `prisma db push` or migrations (run against the same embedded DB; use a small script that uses the adapter to run migrations).
- Do **not** call `client.close()` before you are done with Prisma; the adapter uses the same client. Call `prisma.$disconnect()` then `client.close()` when shutting down.

## Transactions

The adapter supports `prisma.$transaction(...)`. It runs `START TRANSACTION` / `COMMIT` / `ROLLBACK` via `client.execute()`. Behavior depends on seekdb Embedded supporting these statements.

## Server mode

For seekdb **Server** (or OceanBase), use Prisma with `DATABASE_URL` (same database, two connections). This adapter is only for **Embedded** mode.

## License

Apache-2.0
