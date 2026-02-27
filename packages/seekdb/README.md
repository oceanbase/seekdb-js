<div align="center">
<h1>seekdb</h1>

[![npm version](https://img.shields.io/npm/v/seekdb.svg)](https://www.npmjs.com/package/seekdb) [![npm downloads](https://img.shields.io/npm/dm/seekdb.svg)](https://www.npmjs.com/package/seekdb) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/oceanbase/seekdb-js/pulls)
<br />

<strong>Vector database SDK for JavaScript/TypeScript with built-in semantic search</strong>
<br />
<em>Works seamlessly with seekdb and OceanBase</em>

</div>

For complete usage, please refer to the official documentation.

## Table of contents

[Why seekdb?](#why-seekdb)<br/>
[Installation](#installation)<br/>
[Quick Start](#quick-start)<br/>
[Usage Guide](#usage-guide)<br/>
[Execute raw SQL](#execute-raw-sql)<br/>
[Vector search + relational tables](#vector-search--relational-tables)<br/>
[Integration with ORM](#integration-with-orm)<br/>
[Database Management](#database-management)<br/>

## Why seekdb?

- **MySQL compatible** - seekdb is MySQL-compatible (Server and Embedded). Use standard MySQL SQL with `client.execute()`; the same SQL and schema work in both modes.
- **Auto Vectorization** - Automatic embedding generation, no manual vector calculation needed
- **Semantic Search** - Vector-based similarity search for natural language queries
- **Hybrid Search** - Combine keyword matching with semantic search
- **Multiple Embedding Functions** - Built-in support for local and cloud embedding providers
- **TypeScript Native** - Full TypeScript support with complete type definitions

## Installation

```bash
npm install seekdb @seekdb/default-embed
```

- **Embedded mode**: No server required; use locally. Native addon is loaded on first use (optional dependency or on-demand download). Data is stored under the `path` you provide (e.g. `./seekdb.db`).
- **Server mode**: Deploy seekdb or OceanBase first; see [official deployment documentation](https://www.oceanbase.ai/docs/deploy-overview/). OceanBase is compatible with seekdb (its distributed, multi-tenant, etc. version); seekdb-js supports OceanBase in server mode—use the same API and pass `tenant` when connecting to OceanBase (see [OceanBase mode](#oceanbase-mode-server-with-tenant) below).

## Quick Start

**Embedded mode** (local file, no server):

```typescript
import { SeekdbClient } from "seekdb";

// 1. Connect
const client = new SeekdbClient({
  path: "./seekdb.db",
  database: "test",
});

// 2. Create collection
const collection = await client.createCollection({ name: "my_collection" });

// 3. Add data (auto-vectorized using @seekdb/default-embed)
await collection.add({
  ids: ["1", "2"],
  documents: ["Hello world", "seekdb is fast"],
});

// 4. Search
const results = await collection.query({
  queryTexts: "Hello",
  nResults: 5,
});

console.log("query results", results);
```

**Server mode** (connect to a deployed seekdb):

```typescript
import { SeekdbClient } from "seekdb";

// 1. Connect
const client = new SeekdbClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  database: "test",
});

// 2. Create collection
const collection = await client.createCollection({ name: "my_collection" });

// 3. Add data (auto-vectorized using @seekdb/default-embed)
await collection.add({
  ids: ["1", "2"],
  documents: ["Hello world", "seekdb is fast"],
});

// 4. Search
const results = await collection.query({
  queryTexts: "Hello",
  nResults: 5,
});

console.log("query results", results);
```

## Usage Guide

> This section shows the most basic usage. For details, please refer to the [official SDK documentation](https://www.oceanbase.ai/docs/seekdb-js-get-started).

### Client Connection

**Embedded mode**:

```typescript
import { SeekdbClient } from "seekdb";

const client = new SeekdbClient({
  path: "./seekdb.db",
  database: "test",
});
```

**Server mode** (seekdb):

```typescript
import { SeekdbClient } from "seekdb";

const client = new SeekdbClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  database: "test",
});
```

**OceanBase mode** (server with tenant): OceanBase is compatible with seekdb (distributed, multi-tenant, etc.). Use the same server-mode connection; when the backend is OceanBase, pass `tenant` (e.g. `"sys"` or your tenant name):

```typescript
const client = new SeekdbClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  database: "test",
  tenant: "sys", // or your OceanBase tenant
});
```

### Create Collection

If you don't specify an embedding function, the default embedding function will be used for vectorization. Please install `@seekdb/default-embed`.

```bash
npm install @seekdb/default-embed
```

```typescript
const collection = await client.createCollection({
  name: "my_collection",
});
```

If you need to use a specific embedding function, you can install and use the embedding functions we provide, or implement your own. For details, please refer to the [official SDK documentation](https://www.oceanbase.ai/docs/seekdb-js-get-started).

Take `@seekdb/qwen` as an example:

```bash
npm install @seekdb/qwen
```

```typescript
import { QwenEmbeddingFunction } from "@seekdb/qwen";

const qwenEF = new QwenEmbeddingFunction();
const collection = await client.createCollection({
  name: "my_collection",
  embeddingFunction: qwenEF,
});
```

If you don't need an embedding function, set `embeddingFunction` to `null`.

```typescript
const collection = await client.createCollection({
  name: "my_collection",
  embeddingFunction: null,
});
```

### Add Data

The embedding function defined in `createCollection` is used automatically for vectorization. No need to set it again.

```typescript
await collection.add({
  ids: ["1", "2"],
  documents: ["Hello world", "seekdb is fast"],
  metadatas: [{ category: "test" }, { category: "db" }],
});
```

You can also pass a vector or an array of vectors directly.

```typescript
const qwenEF = new QwenEmbeddingFunction();
await collection.add({
  ids: ["1", "2"],
  documents: ["Hello world", "seekdb is fast"],
  metadatas: [{ category: "test" }, { category: "db" }],
  embeddings: [
    [0.1, 0.2, 0.3],
    [0.2, 0.3, 0.4],
  ],
});
```

### Query Data

**Get Data**

The `get() `method is used to retrieve documents from a collection without performing vector similarity search.

```typescript
const results = await collection.get({
  ids: ["1", "2"],
});
```

**Semantic Search**

The `query()` method is used to execute vector similarity search to find documents most similar to the query vector.

The embedding function defined in `createCollection` is used automatically for vectorization. No need to set it again.

```typescript
const results = await collection.query({
  queryTexts: "Hello",
  nResults: 5,
});
```

You can also pass a vector or an array of vectors directly.

```typescript
const results = await collection.query({
  queryEmbeddings: [
    [0.1, 0.2, 0.3],
    [0.2, 0.3, 0.4],
  ],
  nResults: 5,
});
```

**Hybrid Search (Keyword + Semantic)**

The `hybridSearch()` combines full-text search and vector similarity search with ranking.

```typescript
const hybridResults = await collection.hybridSearch({
  query: { whereDocument: { $contains: "seekdb" } },
  knn: { queryTexts: ["fast database"] },
  nResults: 5,
});
```

You can also pass a vector or an array of vectors directly.

```typescript
const hybridResults = await collection.hybridSearch({
  query: { whereDocument: { $contains: "seekdb" } },
  knn: {
    queryEmbeddings: [
      [0.1, 0.2, 0.3],
      [0.2, 0.3, 0.4],
    ],
  },
  nResults: 5,
});
```

### Embedding Functions

The SDK supports multiple Embedding Functions for generating vectors locally or in the cloud.

For complete usage, please refer to the official documentation.

#### Default Embedding

Uses a local model (`Xenova/all-MiniLM-L6-v2`) by default. No API Key required. Suitable for quick development and testing.

No configuration is needed to use the default model.

First install the built-in model:

```bash
npm install @seekdb/default-embed
```

Then use it as-is; it will auto-vectorize:

```typescript
const collection = await client.createCollection({
  name: "local_embed_collection",
});
```

#### Qwen Embedding

Uses DashScope's cloud Embedding service (Qwen/Tongyi Qianwen). Suitable for production environments.

```bash
npm install @seekdb/qwen
```

```typescript
import { QwenEmbeddingFunction } from "@seekdb/qwen";

const qwenEmbed = new QwenEmbeddingFunction({
  // Your DashScope environment variable name, defaults to 'DASHSCOPE_API_KEY'
  apiKeyEnvVar: 'DASHSCOPE_API_KEY'
  // Optional, defaults to 'text-embedding-v4'
  modelName: "text-embedding-v4",
});

const collection = await client.createCollection({
  name: "qwen_embed_collection",
  embeddingFunction: qwenEmbed,
});
```

#### OpenAI Embedding

Uses OpenAI's embedding API. Suitable for production environments with OpenAI integration.

```bash
npm install @seekdb/openai
```

```typescript
import { OpenAIEmbeddingFunction } from "@seekdb/openai";

const openaiEmbed = new OpenAIEmbeddingFunction({
  // Your openai environment variable name, defaults to 'OPENAI_API_KEY'
  apiKeyEnvVar: 'OPENAI_API_KEY'
  // Optional, defaults to 'text-embedding-3-small'
  modelName: "text-embedding-3-small",
});

const collection = await client.createCollection({
  name: "openai_embed_collection",
  embeddingFunction: openaiEmbed,
});
```

#### Jina Embedding

Uses Jina AI's embedding API. Supports multimodal embeddings.

```bash
npm install @seekdb/jina
```

```typescript
import { JinaEmbeddingFunction } from "@seekdb/jina";

const jinaEmbed = new JinaEmbeddingFunction({
  // Your jina environment variable name, defaults to 'JINA_API_KEY'
  apiKeyEnvVar: 'JINA_API_KEY'
  // Optional, defaults to jina-clip-v2
  modelName: "jina-clip-v2",
});

const collection = await client.createCollection({
  name: "jina_embed_collection",
  embeddingFunction: jinaEmbed,
});
```

#### Custom Embedding Function

You can also use your own custom embedding function.

First, implement the `EmbeddingFunction` interface:

```typescript
import type { EmbeddingFunction } from "seekdb";
import { registerEmbeddingFunction } from "seekdb";

interface MyCustomEmbeddingConfig {
  apiKeyEnv: string;
}
class MyCustomEmbeddingFunction implements EmbeddingFunction {
  // The name of the `embeddingFunction`, must be unique.
  readonly name = "my_custom_embedding";
  private apiKeyEnv: string;
  dimension: number;
  constructor(config: MyCustomEmbeddingConfig) {
    this.apiKeyEnv = config.apiKeyEnv;
    this.dimension = 384;
  }
  // Implement your vector generation code here
  async generate(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    return embeddings;
  }
  // The configuration of the current `embeddingFunction` instance, used to restore this instance
  getConfig(): MyCustomEmbeddingConfig {
    return {
      apiKeyEnv: this.apiKeyEnv,
    };
  }
  // Create a new instance of the current `embeddingFunction` based on the provided configuration
  static buildFromConfig(config: MyCustomEmbeddingConfig): EmbeddingFunction {
    return new MyCustomEmbeddingFunction(config);
  }
}

// Register the constructor
registerEmbeddingFunction("my_custom_embedding", MyCustomEmbeddingFunction);
```

Then use it:

```typescript
const customEmbed = new MyCustomEmbeddingFunction({
  apiKeyEnv: "MY_CUSTOM_API_KEY_ENV",
});
const collection = await client.createCollection({
  name: "custom_embed_collection",
  configuration: {
    dimension: 384,
    distance: "cosine",
  },
  embeddingFunction: customEmbed,
});
```

### Execute raw SQL

The client supports executing raw SQL in the current database/session (both embedded and server mode). Returns rows as an array of objects (or `null` when there is no result set).

```typescript
const rows = await client.execute("SELECT 1 AS one");
// rows: [{ one: 1 }] or null

const rows2 = await client.execute(
  "SELECT * FROM information_schema.tables LIMIT ?",
  [5]
);
```

### Vector search + relational tables

You can combine vector (or hybrid) search with relational tables: run `collection.query()` or `collection.hybridSearch()` to get `ids`, then query your relational table by those ids. For type-safe relational queries, prefer an ORM (see [Integration with ORM](#integration-with-orm)); here is a raw-SQL recipe.

**Recipe**

1. Get ids (and optional metadata) from vector/hybrid search.
2. Query the relational table with `client.execute()`. For `WHERE id IN (...)` with MySQL/mysql2, use parameterized placeholders to avoid SQL injection: one `?` per id and pass the ids array as params.

**Example (TypeScript)** — hybrid search, then fetch users by id and merge:

```typescript
const client = new SeekdbClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  database: "test",
});
const collection = await client.getCollection({ name: "my_collection" });

// 1. Hybrid search → get ids
const hybridResult = await collection.hybridSearch({
  query: { whereDocument: { $contains: "seekdb" } },
  knn: { queryTexts: ["fast database"] },
  nResults: 5,
});
const ids = hybridResult.ids?.flat().filter(Boolean) ?? []; // e.g. string[]

// 2. Query relational table by ids (parameterized)
type UserRow = { id: string; name: string };
let users: UserRow[] = [];
if (ids.length > 0) {
  const placeholders = ids.map(() => "?").join(",");
  const rows = await client.execute(
    `SELECT id, name FROM users WHERE id IN (${placeholders})`,
    ids
  );
  users = (rows ?? []) as UserRow[];
}

// 3. Merge: e.g. map ids to (vector result + user row)
const merged = ids.map((id) => ({
  id,
  user: users.find((u) => u.id === id) ?? null,
}));
```

**Transactions**: There is no explicit transaction API on the client. For transactions that span both vector and relational operations, use a separate mysql2 connection (same DB config) and run `beginTransaction()` / `commit()` / `rollback()` on that connection (see [Integration with ORM](#integration-with-orm)).

### Integration with ORM

Use seekdb-js for vector/full-text/hybrid search and an ORM (Drizzle or Prisma) for type-safe relational tables. seekdb is **MySQL-compatible** in both Server and Embedded mode. **Drizzle**: in Server mode create a mysql2 connection with the same DB config and pass it to `drizzle-orm/mysql2` (same database, two connections); in **Embedded mode** use `drizzle-orm/mysql-proxy` with a callback that calls `client.execute()` and maps to `{ rows }` (see `examples/seekdb-drizzle/index-embedded.ts`). **Prisma**: in Server mode use DATABASE_URL (same database, two connections); in **Embedded mode** use the [@seekdb/prisma-adapter](https://www.npmjs.com/package/@seekdb/prisma-adapter) so Prisma runs SQL via `client.execute()` (see `examples/seekdb-prisma/index-embedded.ts`).

#### With Drizzle (Server: same DB two connections; Embedded: mysql-proxy)

**Server mode**: Create a mysql2 connection with the same host/port/user/password/database as SeekdbClient and pass it to Drizzle (same database, two connections):

```typescript
import { createConnection } from "mysql2/promise";
import { SeekdbClient } from "seekdb";
import { drizzle } from "drizzle-orm/mysql2";
import { inArray } from "drizzle-orm";
import { users } from "./schema"; // your relational table (mysqlTable), no vector tables

const dbConfig = {
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  database: "test",
};

const client = new SeekdbClient(dbConfig);
const conn = await createConnection(dbConfig);
const db = drizzle(conn);

const collection = await client.getCollection({ name: "docs" });
const result = await collection.hybridSearch({
  query: { whereDocument: { $contains: "seekdb" } },
  knn: { queryTexts: ["database"] },
  nResults: 5,
});
const ids = result.ids?.flat().filter(Boolean) ?? [];

const usersList = await db.select().from(users).where(inArray(users.id, ids));

// when done: await conn.end(); await client.close();
```

**Embedded mode**: Use Drizzle's mysql-proxy driver with a callback that runs SQL via `client.execute()` and maps results to `{ rows }`. See `examples/seekdb-drizzle/index-embedded.ts` for a full runnable sample.

- Schema: define only **relational tables** with `mysqlTable`; vector tables are managed by seekdb Collection.
- See `examples/seekdb-drizzle/` for a runnable sample.

#### With Prisma (same database, two connections)

Use **same database, two connections**: one SeekdbClient, one PrismaClient (via `DATABASE_URL`). Vector search with seekdb, then query relational by ids with Prisma.

```typescript
import { SeekdbClient } from "seekdb";
import { PrismaClient } from "@prisma/client";

const client = new SeekdbClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  database: "test",
});

const prisma = new PrismaClient(); // uses DATABASE_URL="mysql://root:@127.0.0.1:2881/test"

const collection = await client.getCollection({ name: "docs" });
const result = await collection.hybridSearch({
  query: { whereDocument: { $contains: "seekdb" } },
  knn: { queryTexts: ["database"] },
  nResults: 5,
});
const ids = result.ids?.flat().filter(Boolean) ?? [];

const users = await prisma.user.findMany({
  where: { id: { in: ids } },
});

// merge vector results with users as needed
await client.close();
await prisma.$disconnect();
```

- Set `DATABASE_URL` to the same host/port/user/password/database as SeekdbClient (e.g. `mysql://user:password@host:port/database`). For OceanBase tenant, see your Prisma/MySQL docs.
- **Embedded mode**: use the [@seekdb/prisma-adapter](https://www.npmjs.com/package/@seekdb/prisma-adapter) and `PrismaClient({ adapter })` so Prisma runs SQL via `client.execute()`; run `pnpm run start:embedded` in `examples/seekdb-prisma/`.
- See `examples/seekdb-prisma/` for runnable samples (Server and Embedded).

### Database Management

Use `AdminClient()` for database management. It returns a `SeekdbClient` instance. In **embedded mode** you only pass `path`; no database name is required.

**Embedded mode** (local database file):

```typescript
import { AdminClient } from "seekdb";

const admin = AdminClient({ path: "./seekdb.db" });
await admin.createDatabase("new_database");
const databases = await admin.listDatabases();
const db = await admin.getDatabase("new_database");
await admin.deleteDatabase("new_database");
await admin.close();
```

**Server mode** (seekdb):

```typescript
import { AdminClient } from "seekdb";

const admin = AdminClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
});

await admin.createDatabase("new_database");
const databases = await admin.listDatabases();
const db = await admin.getDatabase("new_database");
await admin.deleteDatabase("new_database");
await admin.close();
```

**OceanBase mode** (server mode with tenant): add `tenant` (e.g. `"sys"` or your tenant name) to the config:

```typescript
const admin = AdminClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  tenant: "sys", // or your OceanBase tenant
});

await admin.createDatabase("new_database");
const databases = await admin.listDatabases();
const db = await admin.getDatabase("new_database");
await admin.deleteDatabase("new_database");
await admin.close();
```
