<div align="center">
<h1>seekdb-js</h1>

[![npm version](https://img.shields.io/npm/v/seekdb.svg)](https://www.npmjs.com/package/seekdb) [![npm downloads](https://img.shields.io/npm/dm/seekdb.svg)](https://www.npmjs.com/package/seekdb) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/oceanbase/seekdb-js/pulls)
<br />

<strong>Vector database SDK for JavaScript/TypeScript with built-in semantic search</strong>
<br />
<em>Works seamlessly with seekdb and OceanBase</em>
</div>

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

| Package                 | Description                             |
| ----------------------- | --------------------------------------- |
| `seekdb`                | Core SDK for seekdb operations          |
| `@seekdb/default-embed` | Local embedding (no API key)            |
| `@seekdb/qwen` ⚠️       | Qwen cloud embedding (**Experimental**) |
| `@seekdb/openai` ⚠️     | OpenAI embedding (**Experimental**)     |
| `@seekdb/jina` 🚧        | Jina multimodal embedding (**WIP**)     |

## Installation

```bash
npm install seekdb
```

- **Embedded mode**: No seekdb server deployment required; use locally after install.
- **Server mode**: Deploy seekdb or OceanBase first; see [official deployment docs](https://www.oceanbase.ai/docs/deploy-overview/).

## Running Modes

The SDK supports two modes; the constructor arguments to `SeekdbClient` determine which is used:

| Mode | Parameter | Description |
| ---- | --------- | ----------- |
| **Embedded** | `path` (database file path) | Runs locally with no separate seekdb server; data is stored in a local file. |
| **Server** | `host` (and `port`, `user`, `password`, etc.) | Connects to a remote seekdb or OceanBase instance. |

You can also use the factory `Client()`: pass `path` for embedded mode, or `host` for server mode; if neither is provided, embedded mode is tried by default (requires the native addon).

## Quick Start

**Server mode** (connect to a deployed seekdb):

```typescript
import { SeekdbClient } from "seekdb";

const client = new SeekdbClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  database: "test",
});

const collection = await client.createCollection({ name: "my_collection" });
await collection.add({
  ids: ["1", "2"],
  documents: ["Hello world", "seekdb is fast"],
});
const results = await collection.query({ queryTexts: "Hello", nResults: 5 });
```

**Embedded mode** (local file, no server):

```typescript
import { SeekdbClient } from "seekdb";

const client = new SeekdbClient({
  path: "./seekdb.db",
  database: "test",
});

const collection = await client.createCollection({ name: "my_collection" });
await collection.add({
  ids: ["1", "2"],
  documents: ["Hello world", "seekdb is fast"],
});
const results = await collection.query({ queryTexts: "Hello", nResults: 5 });
```

## Usage Guide

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
  path: "./seekdb.db",  // database file path
  database: "test",
});
```

**Using the factory** (mode chosen by parameters):

```typescript
import { Client } from "seekdb";

// Embedded mode (explicit path)
const embeddedClient = Client({ path: "/path/to/seekdb.db", database: "test" });

// Embedded mode (default path: seekdb.db in current directory)
const defaultClient = Client({ database: "test" });

// Server mode
const serverClient = Client({
  host: "127.0.0.1",
  port: 2881,
  database: "test",
  user: "root",
  password: "",
});
```

### Create Collection

```typescript
const collection = await client.createCollection({
  name: "my_collection",
});
```

### Add Data

Supports automatic vectorization, no need to calculate vectors manually.

```typescript
await collection.add({
  ids: ["1", "2"],
  documents: ["Hello world", "seekdb is fast"],
  metadatas: [{ category: "test" }, { category: "db" }],
});
```

### Query Data

**Semantic Search**

```typescript
const results = await collection.query({
  queryTexts: "Hello",
  nResults: 5,
});
```

**Hybrid Search (Keyword + Semantic)**

```typescript
const hybridResults = await collection.hybridSearch({
  query: { whereDocument: { $contains: "seekdb" } },
  knn: { queryTexts: ["fast database"] },
  nResults: 5,
});
```

### Embedding Functions

The SDK supports multiple Embedding Functions for generating vectors locally or in the cloud.

#### Default Embedding

Uses a local model (`Xenova/all-MiniLM-L6-v2`) by default. No API Key required. Suitable for quick development and testing.

No configuration is needed to use the default model:

```typescript
const collection = await client.createCollection({
  name: "local_embed_collection",
});
```

For manual import of the built-in model:

```bash
npm install @seekdb/default-embed
```

```typescript
import { DefaultEmbeddingFunction } from "@seekdb/default-embed";

const defaultEmbed = new DefaultEmbeddingFunction({
  // If you encounter download issues, try switching the region to 'intl', defaults to 'cn'
  region: "cn",
});

const collection = await client.createCollection({
  name: "local_embed_collection",
  embeddingFunction: defaultEmbed,
});
```

#### Qwen Embedding

> ⚠️ **Experimental API**: The `QwenEmbeddingFunction` is currently experimental and may change in future versions.

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

> ⚠️ **Experimental API**: The `OpenAIEmbeddingFunction` is currently experimental and may change in future versions.

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

> 🚧 **Under Development**: The `JinaEmbeddingFunction` is under active development. The API may undergo significant changes or breaking updates in future releases.

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

> ⚠️ **Experimental API**: The `registerEmbeddingFunction` and `getEmbeddingFunction` APIs are currently experimental and may change in future versions.

You can also use your own custom embedding function.

First, implement the `EmbeddingFunction` interface:

```typescript
import { EmbeddingFunction, registerEmbeddingFunction } from "seekdb";

class MyCustomEmbedding implements EmbeddingFunction {
  // Name of the embedding function
  readonly name = "my-custom-embed";

  // Initialize your model here
  constructor(private config: any) {}

  // Generate embeddings for the texts
  async generate(texts: string[]): Promise<number[][]> {}

  getConfig() {
    return this.config;
  }
}
```

Then register and use it:

```typescript
// Register the custom embedding function
registerEmbeddingFunction("my-custom-embed", MyCustomEmbedding);

// Instantiate your custom embedding function
const myEmbed = new MyCustomEmbedding({ apiKey: "your-api-key" });

const collection = await client.createCollection({
  name: "custom_embed_collection",
  embeddingFunction: myEmbed,
});
```

### Database Management

Use `SeekdbAdminClient` or the factory `AdminClient()` for database management. In **server mode** you can create, list, and delete databases; in **embedded mode** the same client manages the local database.

**Server mode**:

```typescript
import { SeekdbAdminClient } from "seekdb";

const adminClient = new SeekdbAdminClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  // OceanBase mode requires tenant: "sys"
});

await adminClient.createDatabase("new_database");
const databases = await adminClient.listDatabases();
const db = await adminClient.getDatabase("new_database");
await adminClient.deleteDatabase("new_database");
```

**Using the factory** (embedded vs server chosen by parameters):

```typescript
import { AdminClient } from "seekdb";

// Server mode
const admin = AdminClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
});

// Embedded mode (pass path; returns SeekdbClient for local DB management)
const localAdmin = AdminClient({ path: "./seekdb.db" });
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
