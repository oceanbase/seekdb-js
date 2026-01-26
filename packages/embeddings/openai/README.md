# OpenAI Embedding Function for seekdb

> ⚠️ **Experimental API**: This embedding function is currently experimental and may change in future versions.

This package provides an embedding function using the OpenAI Embeddings API. OpenAI offers high-quality text embedding models that can convert text into dense vector representations.

## Installation

```bash
npm install @seekdb/openai
```

## Usage

### Quick Start

```typescript
import { OpenAIEmbeddingFunction } from "@seekdb/openai";

const openaiEmbed = new OpenAIEmbeddingFunction({
  apiKeyEnvVar: "OPENAI_API_KEY", // Environment variable name for the API key (default: 'OPENAI_API_KEY')
});

const collection = await client.createCollection({
  name: "openai_collection",
  embeddingFunction: openaiEmbed,
});
```

## Configuration Options

- **apiKey**: OpenAI API key (optional, defaults to environment variable)
- **apiKeyEnvVar**: Environment variable name for the API key (default: `'OPENAI_API_KEY'`)
- **modelName**: Model name to use (default: `'text-embedding-3-small'`)
- **dimensions**: Embedding dimensions (optional)
- **organizationId**: OpenAI organization ID (optional, defaults to environment variable `OPENAI_ORG_ID`)
- **baseURL**: Custom base URL for OpenAI API (optional)

## Getting an API Key

Visit [OpenAI Platform](https://platform.openai.com/) to sign up and obtain your API key.
