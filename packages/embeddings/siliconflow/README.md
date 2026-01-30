# @seekdb/siliconflow

Siliconflow embedding function for SeekDB.

SiliconFlow is a one-stop cloud service platform that brings together a wide range of leading open-source large models. Its Embedding service offers a suite of high-performance semantic vector models, widely used in retrieval-augmented generation (RAG) for LLMs, search, recommendations, and other scenarios. Models on the platform—such as the BGE family and the Qwen Embedding family—provide strong semantic representation capabilities, and some models (e.g., Qwen3-Embedding) also support flexible output dimensions to balance accuracy and storage cost.

## Installation

```bash
npm i seekdb @seekdb/siliconflow
```

## Usage

```typescript
import { SiliconFlowEmbeddingFunction } from "@seekdb/siliconflow";

const ef = new SiliconFlowEmbeddingFunction({
  modelName: "BAAI/bge-large-zh-v1.5",
});
```

## Configuration

- **api_key_env**：API Key 所在的环境变量名，默认是 `SILICONFLOW_API_KEY`。
- **modelName**: model name (default: `"BAAI/bge-large-zh-v1.5"`)
