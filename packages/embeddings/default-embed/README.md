# @seekdb/amazon-bedrock

This package provides a default embedding function using Hugging Face Transformers.js. It runs locally in Node.js without requiring external API calls or API keys.

## Installation

The seekdb SDK includes this package by default - no installation needed for basic usage.

For manual installation:

```bash
npm install @seekdb/default-embed
```

## Usage

### Quick Start (Zero Configuration)

The SDK automatically uses this embedding function when no custom function is specified:

```typescript
const collection = await client.createCollection({
  name: "local_embed_collection",
});
```

For manual import of the built-in model:

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

## Configuration Options

- **region**: Model download region (`'cn'` or `'intl'`, default: `'cn'`)
  - Use `'cn'` for faster downloads in mainland China
  - Use `'intl'` for international regions

## Features

- **No API Key Required**: Runs completely locally without external dependencies
- **Zero Configuration**: Works out of the box with seekdb SDK
- **China-Optimized**: Built-in support for faster model downloads in China
  The default model is suitable for most general-purpose semantic search and RAG applications.
