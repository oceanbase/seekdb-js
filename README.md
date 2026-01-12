# seekdb

The JavaScript/TypeScript SDK for seekdb, supporting both seekdb Server mode and OceanBase mode.

> This is a monorepo containing the core `seekdb` package and multiple embedding function packages.

## Installation

```bash
npm install seekdb
```

## Basic Usage

### 1. Client Connection

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

### 2. Create Collection

```typescript
const collection = await client.createCollection({
  name: "my_collection",
});
```

### 3. Add Data

Supports automatic vectorization, no need to calculate vectors manually.

```typescript
await collection.add({
  ids: ["1", "2"],
  documents: ["Hello world", "seekdb is fast"],
  metadatas: [{ category: "test" }, { category: "db" }],
});
```

### 4. Query Data

```typescript
// Semantic Search
const results = await collection.query({
  queryTexts: "Hello",
  nResults: 5,
});

// Hybrid Search (Keyword + Semantic)
const hybridResults = await collection.hybridSearch({
  query: { whereDocument: { $contains: "seekdb" } },
  knn: { queryTexts: ["fast database"] },
  nResults: 5,
});
```

## Embedding Function

The SDK supports multiple Embedding Functions for generating vectors locally or in the cloud.

### 1. Default Embedding

Uses a local model (`Xenova/all-MiniLM-L6-v2`) by default. No API Key required. Suitable for quick development and testing.
No configuration is needed to use the default model.

```typescript
const collection = await client.createCollection({
  name: "local_embed_collection",
});
```

We also supports manual import of the built-in model.

First install .

```bash
npm install @seekdb/default-embed
```

Instantiate and use the model in your project.

```typescript
import { DefaultEmbeddingFunction } from "@seekdb/default-embed";

const defaultEmbed = new DefaultEmbeddingFunction({
  // If you encounter download issues, try switching the region, default is 'cn'
  // region: 'intl'
});

const collection = await client.createCollection({
  name: "local_embed_collection",
  embeddingFunction: defaultEmbed,
});
```

### 2. Qwen Embedding

> ⚠️ **Experimental API**: The `QwenEmbeddingFunction` is  currently experimental and may change in future versions.

Uses DashScope's cloud Embedding service (Qwen/Tongyi Qianwen). Suitable for production environments.

First install .

```bash
npm install @seekdb/qwen
```

Instantiate and use the model in your project.

```typescript
import { QwenEmbeddingFunction } from "@seekdb/qwen";

const qwenEmbed = new QwenEmbeddingFunction({
  // Your DashScope API Key, defaults to reading from env var
  apiKey: "sk-...",
  // Optional, defaults to text-embedding-v4
  modelName: "text-embedding-v4",
});

const collection = await client.createCollection({
  name: "qwen_embed_collection",
  embeddingFunction: qwenEmbed,
});
```

### 3. Custom Embedding Function

> ⚠️ **Experimental API**: The `registerEmbeddingFunction` and `getEmbeddingFunction` APIs are currently experimental and may change in future versions.

You can also use your own custom embedding function.

First, implement the `EmbeddingFunction` interface.

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

Then register and use it.

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

## Database Management

The `SeekdbAdminClient` allows you to manage databases (create, list, delete).

```typescript
import { SeekdbAdminClient } from "seekdb";

const adminClient = new SeekdbAdminClient({
  host: "127.0.0.1",
  port: 2881,
  user: "root",
  password: "",
  // Optional: tenant
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

## 📚 Examples

Check out the [examples](./examples) directory for complete usage examples:

- [simple-example.ts](./examples/simple-example.ts) - Basic usage
- [complete-example.ts](./examples/complete-example.ts) - All features
- [hybrid-search-example.ts](./examples/hybrid-search-example.ts) - Hybrid search

Run examples:

```bash
pnpm --filter seekdb-examples run run:simple
```

See [DEVELOP.md](./DEVELOP.md) for more details on development and testing.