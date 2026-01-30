# @seekdb/tencent-hunyuan

Tencent Hunyuan embedding function for SeekDB.

Tencent Hunyuan is a large language model fully developed in-house by Tencent across the entire stack, delivering excellent performance in high-quality content creation, mathematical and logical reasoning, code generation, and multi-turn conversations. Its Embedding API (GetEmbedding) is part of the Tencent Hunyuan model API suite, converting input text into high-quality 1024-dimensional vector representations and providing strong semantic understanding for building applications such as RAG systems and agent memory stores.

## Installation

```bash
npm i seekdb @seekdb/tencent-hunyuan
```

## Usage

```typescript
import { TencentHunyuanEmbeddingFunction } from "@seekdb/tencent-hunyuan";

const ef = new TencentHunyuanEmbeddingFunction({
  modelName: "hunyuan-embedding",
});
```

## Configuration

- **api_key_env**：API Key 所在的环境变量名，默认是 `HUNYUAN_API_KEY`。
- **modelName**: model name (default: `"hunyuan-embedding"`)
