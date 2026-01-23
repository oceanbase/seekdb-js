# @seekdb/sentence-transformer

Sentence Transformer embedding function for SeekDB.

## Installation

```bash
npm install @seekdb/sentence-transformer
```

## Usage

```typescript
import '@seekdb/sentence-transformer';
import { getEmbeddingFunction } from 'seekdb';

const ef = await getEmbeddingFunction('sentence-transformer', {
  model_name: 'all-MiniLM-L6-v2',
  device: 'cpu',
  normalize_embeddings: false,
});

const embeddings = await ef.generate(['hello world']);
```
