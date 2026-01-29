# @seekdb/voyageai

Voyage AI embedding function for SeekDB.

VoyageAI EmbeddingFunction is one of SeekDB’s embedding adapters designed to support a diverse AI ecosystem. As an AI-native hybrid search database, SeekDB’s core strength lies in providing unified storage and retrieval for vectors, full-text, structured, and semi-structured data. With embedding functions like this, developers can easily call external, high-quality embedding services (such as VoyageAI) to inject powerful semantic understanding into SeekDB, enabling more accurate RAG systems, agent memory stores, and related applications.

## Installation

```bash
npm i seekdb @seekdb/voyageai
```

## Usage

```typescript
import { VoyageAIEmbeddingFunction } from "@seekdb/voyageai";

const ef = new VoyageAIEmbeddingFunction({
  modelName: "voyage-4-large",
  // inputType: "document",
  // truncation: true,
});
```

## Configuration

- **apiKey**: API key (optional; can be provided via env var)
- **apiKeyEnvVar**: API key env var name (default: `"VOYAGE_API_KEY"`)
- **modelName**: model name (default: `"voyage-4-large"`)
- **inputType**: Voyage input type (optional)
- **truncation**: truncate inputs (optional)
