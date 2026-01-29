# Qwen Embedding Function for seekdb

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
  modelName: "text-embedding-v4",
});
```

## Configuration Options

- **apiKey**: DashScope API key (optional, defaults to environment variable)
- **apiKeyEnvVar**: Environment variable name for the API key (default: `'DASHSCOPE_API_KEY'`)
- **modelName**: Model name to use (default: `'text-embedding-v4'`)
- **dimensions**: Embedding dimensions (default: `1024`)
- **region**: API region, either `'cn'` (China) or `'intl'` (International) (default: `'cn'`)
