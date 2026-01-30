# @seekdb/cohere

Cohere embedding function for SeekDB.

Cohere provides embedding models for semantic search, clustering, and recommendation. seekdb provides a `CohereEmbeddingFunction` wrapper (powered by LiteLLM) to generate Cohere embeddings and use them with seekdb collections.

## Dependencies and authentication

`CohereEmbeddingFunction` calls the Cohere embedding API via LiteLLM. In practice, you typically need:

- A Cohere API key with access to the embedding models you plan to use
- Authentication is usually provided via environment variables (by default, `COHERE_API_KEY`). If you use a different environment variable name, set `api_key_env`.

## Installation

```bash
npm i seekdb @seekdb/cohere
```

## Usage

```typescript
import { CohereEmbeddingFunction } from "@seekdb/cohere";

const ef = new CohereEmbeddingFunction({
  modelName: "embed-english-v3.0",
  inputType: "search_document",
});
```

## Configuration

- **apiKey**: API key (optional; can be provided via env var)
- **apiKeyEnvVar**: API key env var name (default: `"COHERE_API_KEY"`)
- **modelName**: model name (default: `"embed-english-v3.0"`)
- **inputType**: `"search_document" | "search_query" | "classification" | "clustering" | "image"` (default: `"search_document"`)
- **truncate**: `"NONE" | "START" | "END"` (optional)
- **embeddingType**: `"float" | "int8" | "uint8" | "binary" | "ubinary"` (optional)
