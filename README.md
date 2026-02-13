<div align="center">
<h1>seekdb-js</h1>

[![npm version](https://img.shields.io/npm/v/seekdb.svg)](https://www.npmjs.com/package/seekdb) [![npm downloads](https://img.shields.io/npm/dm/seekdb.svg)](https://www.npmjs.com/package/seekdb) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/oceanbase/seekdb-js/pulls)
<br />

<strong>Vector database SDK for JavaScript/TypeScript with built-in semantic search</strong>
<br />
<em>Works seamlessly with seekdb and OceanBase</em>

</div>

For complete usage, please refer to the official documentation.

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

| Package      | Description                                                                                                 |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `seekdb`     | Core SDK for seekdb operations                                                                              |
| `embeddings` | Several embedding functions we provide, including local default-embed, OpenAI embedding, Ollama, Jina, etc. |

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

- **SeekdbClient**: Pass `path` for embedded mode, or `host` (and port, user, password, etc.) for server mode.
- **AdminClient()**: For admin operations only; pass `path` for embedded or `host` for server. In embedded mode you do not specify a database name.

## Quick Start

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

## Usage Guide

> This section shows the most basic usage. For details, please refer to the [official SDK documentation](https://www.oceanbase.ai/docs/seekdb-js-get-started).

### Client Connection

**Server mode** (seekdb / OceanBase):

```typescript
import { SeekdbClient } from "seekdb";

const client = new SeekdbClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  database: "test",
  // Required for OceanBase mode
  // tenant: "sys",
});
```

**Embedded mode** (local database file):

```typescript
import { SeekdbClient } from "seekdb";

const client = new SeekdbClient({
  path: "./seekdb.db", // database file path
  database: "test",
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

const qwenEF = new QwenEmbeddingFucntion();
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
const qwenEF = new QwenEmbeddingFucntion();
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

### Database Management

Use `AdminClient()` for database management. It returns a `SeekdbClient` instance. In **embedded mode** you only pass `path`; no database name is required.

**Server mode**:

```typescript
import { AdminClient } from "seekdb";

const admin = AdminClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  // OceanBase mode requires tenant: "sys"
});

await admin.createDatabase("new_database");
const databases = await admin.listDatabases();
const db = await admin.getDatabase("new_database");
await admin.deleteDatabase("new_database");
await admin.close();
```

**Embedded mode** (no server):

```typescript
import { AdminClient } from "seekdb";

const admin = AdminClient({ path: "./seekdb.db" });
await admin.createDatabase("new_database");
const databases = await admin.listDatabases();
const db = await admin.getDatabase("new_database");
await admin.deleteDatabase("new_database");
await admin.close();
```

## Examples

Check out the [examples](./examples) directory for complete usage examples:

- [simple-example.ts](./examples/simple-example.ts) - Basic usage
- [complete-example.ts](./examples/complete-example.ts) - All features
- [hybrid-search-example.ts](./examples/hybrid-search-example.ts) - Hybrid search

To run the examples, please refer to the [Run Examples](./DEVELOP.md#run-examples) section.

## Development

See [DEVELOP.md](./DEVELOP.md) for details on development, testing, and contributing.

## License

This package is licensed under [Apache 2.0](./LICENSE).
