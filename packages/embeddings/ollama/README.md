# @seekdb/ollama

Ollama embedding function for SeekDB.

Ollama can run embedding models locally and exposes OpenAI-compatible endpoints for embedding generation. seekdb provides an `OllamaEmbeddingFunction` wrapper that uses the OpenAI-compatible API to generate embeddings from an Ollama server.

## Dependencies and environment

In practice, you typically need:

- Ollama installed and running
- The embedding model pulled locally, for example:
  ```shell
  ollama pull nomic-embed-text
  ```

## Installation

```bash
npm i seekdb @seekdb/ollama
```

## Usage

```typescript
import { OllamaEmbeddingFunction } from "@seekdb/ollama";

const ef = new OllamaEmbeddingFunction({
  url: "http://localhost:11434/v1",
  modelName: "nomic-embed-text",
  // apiKeyEnv: "OLLAMA_API_KEY",
});
```

## Configuration

- **url**: Ollama base URL (default: `"http://localhost:11434/v1"`)
- **modelName**: model name (default: `"nomic-embed-text"`)
- **apiKeyEnv**: API key env var name (default: `"OLLAMA_API_KEY"`, optional)

## Notes

- Make sure Ollama is running and the model is available locally (e.g. `ollama pull nomic-embed-text`).
