# Jina AI Embedding Function for seekdb

> 🚧 **Under Development**: This embedding function is under active development. The API may undergo significant changes or breaking updates in future releases.

This package provides an embedding function using the Jina AI Embeddings API. Jina AI offers high-quality text and multimodal embedding services.

## Installation

```bash
npm install @seekdb/jina
```

## Usage

### Quick Start

```typescript
import { JinaEmbeddingFunction } from "@seekdb/jina";

const jinaEmbed = new JinaEmbeddingFunction({
  apiKeyEnvVar: "JINA_API_KEY", // Environment variable name for the API key (default: `'JINA_API_KEY'`)
});

const collection = await client.createCollection({
  name: "jina_collection",
  embeddingFunction: jinaEmbed,
});
```

## Configuration Options

- **apiKey**: Jina AI API key (optional, defaults to environment variable)
- **apiKeyEnvVar**: Environment variable name for the API key (default: `'JINA_API_KEY'`)
- **modelName**: Model name to use (default: `'jina-clip-v2'`)
- **task**: Task type (optional)
- **lateChunking**: Whether to use late chunking (optional)
- **truncate**: Whether to truncate input (optional)
- **dimensions**: Embedding dimensions (optional)
- **normalized**: Whether to normalize embedding vectors (optional)
- **embeddingType**: Embedding type (optional)

## Getting an API Key

Visit [Jina AI](https://jina.ai/) to sign up and obtain your API key.
