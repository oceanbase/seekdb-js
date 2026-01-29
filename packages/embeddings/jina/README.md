# @seekdb/jina

Jina embedding function for SeekDB.

Jina AI provides embedding models for semantic search and related retrieval tasks. seekdb provides a `JinaEmbeddingFunction` wrapper (powered by LiteLLM) to generate Jina embeddings and use them with seekdb collections.

## Dependencies and authentication

`JinaEmbeddingFunction` calls the Jina embedding API via LiteLLM. In practice, you typically need:

- A Jina API key with access to the embedding models you plan to use
- Authentication is usually provided via environment variables (by default, `JINA_API_KEY`). If you use a different environment variable name, set `api_key_env`.

## Installation

```bash
npm i seekdb @seekdb/jina
```

## Usage

```typescript
import { JinaEmbeddingFunction } from "@seekdb/jina";

const ef = new JinaEmbeddingFunction({
  modelName: "jina-clip-v2",
  // apiKeyEnvVar: "JINA_API_KEY",
});
```

## Configuration

- **apiKey**: API key (optional; can be provided via env var)
- **apiKeyEnvVar**: API key env var name (default: `"JINA_API_KEY"`)
- **modelName**: model name (default: `"jina-clip-v2"`)
