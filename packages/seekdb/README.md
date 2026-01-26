<div align="center">
<h1>seekdb</h1>

[![npm version](https://img.shields.io/npm/v/seekdb.svg)](https://www.npmjs.com/package/seekdb) [![npm downloads](https://img.shields.io/npm/dm/seekdb.svg)](https://www.npmjs.com/package/seekdb) [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/) [![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/oceanbase/seekdb-js/pulls)
<br />

<strong>Vector database SDK for JavaScript/TypeScript with built-in semantic search</strong>
<br />
<em>Works seamlessly with seekdb and OceanBase</em>

</div>

## Table of contents

[Why seekdb?](#why-seekdb)<br/>
[Installation](#installation)<br/>
[Quick Start](#quick-start)<br/>
[Usage Guide](#usage-guide)<br/>

## Why seekdb?

- **Auto Vectorization** - Automatic embedding generation, no manual vector calculation needed
- **Semantic Search** - Vector-based similarity search for natural language queries
- **Hybrid Search** - Combine keyword matching with semantic search
- **Multiple Embedding Functions** - Built-in support for local and cloud embedding providers
- **TypeScript Native** - Full TypeScript support with complete type definitions

## Installation

> Before using the SDK, you need to deploy seekdb. Please refer to the [official deployment documentation](https://www.oceanbase.ai/docs/deploy-overview/).

```bash
npm install seekdb
```

## Quick Start

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

// 3. Add data (auto-vectorized)
await collection.add({
  ids: ["1", "2"],
  documents: ["Hello world", "seekdb is fast"],
});

// 4. Search
const results = await collection.query({
  queryTexts: "Hello",
  nResults: 5,
});
```

## Usage Guide

### Client Connection

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

The `SeekdbAdminClient` allows you to manage databases (create, list, delete).

```typescript
import { SeekdbAdminClient } from "seekdb";

const adminClient = new SeekdbAdminClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  // Required for OceanBase mode
  // tenant: "sys"
});

// Create a new database
await adminClient.createDatabase("new_database");

// List all databases
const databases = await adminClient.listDatabases();

// Get database info
const db = await adminClient.getDatabase("new_database");

// Delete a database
await adminClient.deleteDatabase("new_database");
```
