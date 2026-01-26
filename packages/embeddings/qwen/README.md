# Qwen Embedding Function for seekdb

> ⚠️ **Experimental API**: This embedding function is currently experimental and may change in future versions.

This package provides an embedding function using the Alibaba Cloud DashScope Qwen Embeddings API. Qwen offers high-quality text embedding models that can convert text into dense vector representations, with support for both China and international regions.

## Installation

```bash
npm install @seekdb/qwen
```

## Usage

### Quick Start

```typescript
import { QwenEmbeddingFunction } from "@seekdb/qwen";

const qwenEmbed = new QwenEmbeddingFunction({
  apiKeyEnvVar: "DASHSCOPE_API_KEY", // Environment variable name for the API key (default: 'DASHSCOPE_API_KEY')
  region: "cn", // or "intl" for international region
});

const collection = await client.createCollection({
  name: "qwen_collection",
  embeddingFunction: qwenEmbed,
});
```

## Configuration Options

- **apiKey**: DashScope API key (optional, defaults to environment variable)
- **apiKeyEnvVar**: Environment variable name for the API key (default: `'DASHSCOPE_API_KEY'`)
- **modelName**: Model name to use (default: `'text-embedding-v4'`)
- **dimensions**: Embedding dimensions (default: `1024`)
- **region**: API region, either `'cn'` (China) or `'intl'` (International) (default: `'cn'`)

## Getting an API Key

Visit [Alibaba Cloud DashScope](https://dashscope.aliyun.com/) to sign up and obtain your API key.
