# seekdb-js

The Node.js client SDK for SeekDB, supporting both SeekDB Server mode and OceanBase mode.

## Installation

```bash
npm install seekdb-js
```

## Basic Usage

### 1. Client Connection

```typescript
import { SeekDBClient } from "seekdb-js";

const client = new SeekDBClient({
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
  documents: ["Hello world", "SeekDB is fast"],
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
  query: { whereDocument: { $contains: "SeekDB" } },
  knn: { queryTexts: ["fast database"] },
  nResults: 5
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

Supports manual import of the built-in model.

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

Uses DashScope's cloud Embedding service (Qwen/Tongyi Qianwen). Suitable for production environments.

```typescript
import { QwenEmbeddingFunction } from "@seekdb/qwen";

const qwenEmbed = new QwenEmbeddingFunction({
  // Your DashScope API Key, defaults to reading from env var
  apiKey: "sk-...", 
  // Optional, defaults to text-embedding-v4
  modelName: "text-embedding-v4" 
});

const collection = await client.createCollection({
  name: "qwen_embed_collection",
  embeddingFunction: qwenEmbed,
});
```