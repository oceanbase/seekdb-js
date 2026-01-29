# @seekdb/google-vertex

Google Vertex AI embedding function for SeekDB.

Google Vertex AI provides text embedding models. seekdb provides a `GoogleVertexEmbeddingFunction` wrapper so you can generate embeddings via Vertex AI and use them with seekdb collections.

## Authentication (ADC)

`GoogleVertexEmbeddingFunction` calls the Vertex AI embedding API via the Google Cloud SDK. In practice, you typically need:

- A Google Cloud project with Vertex AI enabled and permission to invoke embedding models
- Google Application Default Credentials (ADC) configured for your environment

## Installation

```bash
npm i seekdb @seekdb/google-vertex
```

## Usage

```typescript
import { GoogleVertexEmbeddingFunction } from "@seekdb/google-vertex";

const ef = new GoogleVertexEmbeddingFunction({
  projectId: "your-gcp-project-id",
  modelName: "textembedding-gecko",
});
```

## Configuration

- **projectId**: GCP project id (required)
- **location**: Vertex AI location (default: `"us-central1"`)
- **modelName**: model name (default: `"textembedding-gecko"`)
