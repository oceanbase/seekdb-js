<div align="center">
<h1>seekdb-js</h1>

[![npm version](https://img.shields.io/npm/v/seekdb.svg)](https://www.npmjs.com/package/seekdb) [![npm downloads](https://img.shields.io/npm/dm/seekdb.svg)](https://www.npmjs.com/package/seekdb) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/oceanbase/seekdb-js/pulls)
<br />

<strong>Vector database SDK for JavaScript/TypeScript with built-in semantic search</strong>
<br />
<em>Works seamlessly with seekdb and OceanBase</em>

</div>

For complete usage, see the official documentation.

## Table of contents

[Why seekdb-js?](#why-seekdb-js)<br/>
[Packages](#packages)<br/>
[Installation](#installation)<br/>
[Running Modes](#running-modes)<br/>
[Quick Start](#quick-start)<br/>
[Usage Guide](#usage-guide)<br/>
[Examples](#examples)<br/>
[Development](#development)<br/>
[License](#license)<br/>

## Why seekdb-js?

- **Auto Vectorization** - Automatic embedding generation, no manual vector calculation needed
- **Semantic Search** - Vector-based similarity search for natural language queries
- **Hybrid Search** - Combine keyword matching with semantic search
- **Multiple Embedding Functions** - Built-in support for local and cloud embedding providers
- **TypeScript Native** - Full TypeScript support with complete type definitions

## Packages

This is a monorepo containing:

| Package                  | Description                                                                 |
| ------------------------ | --------------------------------------------------------------------------- |
| `seekdb`                 | Core SDK for seekdb operations                                              |
| `@seekdb/default-embed`  | Local embedding function using Xenova/all-MiniLM-L6-v2 model (default)      |
| `@seekdb/qwen`           | DashScope/Tongyi Qianwen cloud embedding service                            |
| `@seekdb/openai`         | OpenAI cloud embedding service                                              |
| `@seekdb/jina`           | Jina AI multimodal embedding service                                        |
| `@seekdb/bm25`           | BM25 sparse embedding function for efficient text-based keyword search      |
| `@seekdb/prisma-adapter` | Prisma driver adapter for seekdb Embedded (use Prisma with seekdb Embedded) |

## Installation

```bash
npm install seekdb @seekdb/default-embed
```

- **Embedded mode**: No seekdb server deployment required; use locally after install.
- **Server mode**: Deploy seekdb or OceanBase first; see [official deployment docs](https://www.oceanbase.ai/docs/deploy-overview/).

## Running Modes

The SDK supports two modes; the constructor arguments to `SeekdbClient` determine which is used. For database management (create/list/get/delete database), use `AdminClient()` which returns a `SeekdbClient` instance.

| Mode         | Parameter                                     | Description                                                                                                                                         |
| ------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Embedded** | `path` (database directory path)              | Runs locally with no separate seekdb server; data is stored under the given path (e.g. `./seekdb.db`). Requires native addon `@seekdb/js-bindings`. |
| **Server**   | `host` (and `port`, `user`, `password`, etc.) | Connects to a remote seekdb or OceanBase instance.                                                                                                  |

**OceanBase and seekdb**: OceanBase is compatible with seekdb and can be understood as its distributed, multi-tenant, etc. version. seekdb-js therefore supports **OceanBase server mode** with the same API: use the same `SeekdbClient` / `AdminClient` and connection parameters; when connecting to OceanBase, additionally pass `tenant` (e.g. `"sys"` or your tenant name). See [OceanBase mode](#oceanbase-mode-server-mode-with-tenant) below.

- **SeekdbClient**: Pass `path` for embedded mode, or `host` (and port, user, password, etc.) for server mode.
- **AdminClient()**: For admin operations only; pass `path` for embedded or `host` for server. In embedded mode you do not specify a database name.

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
const results = await collection.query({ queryTexts: "Hello", nResults: 5 });
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
const results = await collection.query({ queryTexts: "Hello", nResults: 5 });
console.log("query results", results);
```

## Usage Guide

This section covers basic usage. See the [official SDK documentation](https://www.oceanbase.ai/docs/seekdb-js-get-started) for full details.

### Client Connection

**Embedded mode** (local database file):

```typescript
import { SeekdbClient } from "seekdb";

const client = new SeekdbClient({
  path: "./seekdb.db", // database file path
  database: "test",
});
```

**Server mode**:

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

**OceanBase mode** (server mode with tenant): OceanBase is compatible with seekdb (distributed, multi-tenant, etc.). Use the same server-mode connection; when the backend is OceanBase, pass `tenant` (e.g. `"sys"` or your tenant name):

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

You can create a collection without any configuration; the default embedding function will be used for vectorization. Ensure `@seekdb/default-embed` is installed first.

```typescript
const collection = await client.createCollection({
  name: "my_collection",
});
```

#### Schema API

A schema defines which indexes are available on a collection:

- **FulltextIndexConfig** - For keyword-based full-text search
- **VectorIndexConfig** - For dense vector similarity search
- **SparseVectorIndexConfig** - For sparse vector similarity search

Examples for creating the three index types:

**FulltextIndexConfig**

```typescript
const schema = new Schema({
  fulltextIndex: new FulltextIndexConfig("ik", { ik_mode: "smart" }),
});
const collection = await client.createCollection({
  name: "ft_collection",
  schema,
});
```

**VectorIndexConfig**

If you do not set `embeddingFunction`, the default embedding function is used. Ensure `@seekdb/default-embed` is installed.

```typescript
const schema = new Schema({
  vectorIndex: new VectorIndexConfig({
    hnsw: { dimension: 384, distance: "cosine" },
  }),
});
const collection = await client.createCollection({
  name: "vec_collection",
  schema,
});
```

To use a custom embedding function, install one of the provided packages or implement your own. See the [official SDK documentation](https://www.oceanbase.ai/docs/seekdb-js-get-started) for details.

Take `@seekdb/qwen` as an example:

```bash
npm install @seekdb/qwen
```

```typescript
import { QwenEmbeddingFunction } from "@seekdb/qwen";

const qwenEF = new QwenEmbeddingFunction();

const schema = new Schema({
  vectorIndex: new VectorIndexConfig({
    hnsw: { dimension: 384, distance: "cosine" },
    embeddingFunction: qwenEF,
  }),
});

const collection = await client.createCollection({
  name: "my_collection",
  schema,
});
```

If you don't need an embedding function, set `embeddingFunction` to `null`.

```typescript
const schema = new Schema({
  vectorIndex: new VectorIndexConfig({
    hnsw: { dimension: 384, distance: "cosine" },
    embeddingFunction: null,
  }),
});
const collection = await client.createCollection({
  name: "vec_collection",
  schema,
});
```

**SparseVectorIndexConfig**

You can use the provided `@seekdb/bm25` as the sparse embedding function or implement your own.

```bash
npm install @seekdb/bm25
```

```typescript
import { Bm25EmbeddingFunction } from "@seekdb/bm25";
import { K } from "seekdb";

const schema = new Schema({
  sparseVectorIndex: new SparseVectorIndexConfig({
    sourceKey: K.DOCUMENT,
    embeddingFunction: new Bm25EmbeddingFunction(),
  }),
});

const collection = await client.createCollection({
  name: "sparse_collection",
  schema,
});
```

### Add Data

The embedding function defined in `Schema` is used automatically for vectorization. No need to set it again.

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

The embedding function defined in `Schema` is used automatically for vectorization. No need to set it again.

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

Specify `queryKey` to run sparse vector search. If a sparse embedding function is defined, `queryTexts` will be vectorized automatically.

```typescript
import
import { K } from "seekdb";

const results = await collection.query({
  queryTexts: "artificial intelligence",
  // Use sparse vector index, default by K.DOCUMENT
  queryKey: K.DOCUMENT,
  nResults: 3,
});
```

You can also supply your own sparse vectors for search.

```typescript
const queryVector: SparseVector = { 1234: 0.5, 5678: 0.8 };

const results = await collection.query({
  queryEmbeddings: queryVector,
  queryKey: "sparseEmbedding",
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

For complete usage, see the official documentation.

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

### BM25 Sparse Embedding

BM25 (Best Matching 25) is a sparse embedding function that uses term frequency and document length normalization for efficient text search. It's particularly useful for keyword-based search scenarios.

```bash
npm install @seekdb/bm25
```

```typescript
import { SeekdbClient, Schema, SparseVectorIndexConfig, K } from "seekdb";
import { Bm25EmbeddingFunction } from "@seekdb/bm25";

const bm25 = new Bm25EmbeddingFunction({
  k: 1.2, // Term frequency saturation
  b: 0.75, // Document length normalization
  avgDocLength: 256, // Average document length
  tokenMaxLength: 40, // Maximum token length
  stopwords: ["a", "an", "the"], // Custom stopwords
});

const collection = await client.createCollection({
  name: "bm25_collection",
  schema: new Schema({
    sparseVectorIndex: new SparseVectorIndexConfig({
      sourceKey: K.DOCUMENT,
      embeddingFunction: bm25,
    }),
  }),
});
```

For more details, see [BM25 Embedding Guide](./docs/bm25-embedding-guide.md).

#### Custom Sparse Embedding Function

Implement your own sparse embedding function:

```typescript
import {
  SparseEmbeddingFunction,
  SparseVector,
  registerSparseEmbeddingFunction,
  EmbeddingConfig,
} from "seekdb";

interface MySparseConfig {
  vocabSize: number;
}

class MySparseEmbeddingFunction implements SparseEmbeddingFunction {
  readonly name = "my_sparse";
  private vocabSize: number;

  constructor(config: MySparseConfig) {
    this.vocabSize = config.vocabSize;
  }

  // Implement your vector generation code here
  async generate(texts: string[]): Promise<SparseVector[]> {
    const embeddings: number[][] = [];
    return embeddings;
  }

  // Generate sparse vectors for queries (can be different)
  async generateForQueries(texts: string[]): Promise<SparseVector[]> {
    return this.generate(texts);
  }

  // Return configuration for persistence
  getConfig(): EmbeddingConfig {
    return { vocabSize: this.vocabSize };
  }

  // Static factory method
  static buildFromConfig(config: EmbeddingConfig): SparseEmbeddingFunction {
    return new MySparseEmbeddingFunction(config as MySparseConfig);
  }
}

// Register the function
registerSparseEmbeddingFunction("my_sparse", MySparseEmbeddingFunction);

// Use it
const collection = await client.createCollection({
  name: "my_sparse_collection",
  schema: {
    sparseVectorIndex: new SparseVectorIndexConfig({
      sourceKey: K.DOCUMENT,
      embeddingFunction: new MySparseEmbeddingFunction({ vocabSize: 100000 }),
    }),
  },
});
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

**Server mode**:

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

## Examples

Check out the [examples](./examples) directory for complete usage examples:

**Basic examples** (root `examples/`):

- [simple-example.ts](./examples/simple-example.ts) - Basic usage
- [complete-example.ts](./examples/complete-example.ts) - All features
- [hybrid-search-example.ts](./examples/hybrid-search-example.ts) - Hybrid search

**ORM integration** (vector + relational tables):

- [seekdb-drizzle](./examples/seekdb-drizzle) - Drizzle ORM (Server: same DB two connections; Embedded: mysql-proxy)
- [seekdb-prisma](./examples/seekdb-prisma) - Prisma ORM (Server: DATABASE_URL; Embedded: [@seekdb/prisma-adapter](https://www.npmjs.com/package/@seekdb/prisma-adapter))

To run the examples, see [Run Examples](./DEVELOP.md#run-examples) in the development guide.

## Development

See [DEVELOP.md](./DEVELOP.md) for details on development, testing, and contributing.

## License

This package is licensed under [Apache 2.0](./LICENSE).
