# @seekdb/sentence-transformer

Sentence Transformer embedding function for SeekDB.

Sentence Transformer is a deep learning framework designed to convert sentences, phrases, or short passages into high-dimensional vectors (also called embeddings). Its core idea is that semantically similar sentences should be close to each other in the vector space, while semantically different sentences should be far apart, so you can measure semantic similarity by computing cosine similarity or Euclidean distance between vectors. The framework is built on powerful pre-trained Transformer models (such as BERT and RoBERTa) and uses pooling strategies (e.g., mean pooling, CLS pooling) to aggregate token vectors into a fixed-size sentence-level vector. It is widely used in semantic search, text clustering, sentence classification, information retrieval, and retrieval-augmented generation (RAG) scenarios.

## Authentication (ADC)

- The `sentence-transformer` library wraps core capabilities such as model loading and encoding.
- Sentence Transformer typically runs locally. When you use a specified model for the first time, its pre-trained weights are automatically downloaded from the Hugging Face Hub and cached locally, without requiring any additional API key authentication.

## Installation

```bash
npm i seekdb @seekdb/sentence-transformer
```

## Usage

```typescript
import { SentenceTransformerEmbeddingFunction } from "@seekdb/sentence-transformer";

const ef = new SentenceTransformerEmbeddingFunction({
  modelName: "Xenova/all-MiniLM-L6-v2",
  device: "cpu",
  normalizeEmbeddings: false,
});
```

## Configuration

- **modelName**: model name (default: `"Xenova/all-MiniLM-L6-v2"`)
- **device**: device (default: `"cpu"`)
- **normalizeEmbeddings**: normalize output vectors (default: `false`)
- **extra**: extra pipeline options (optional; JSON-serializable)
