# @seekdb/ollama

Ollama embedding function for SeekDB.

## Installation

```bash
npm install @seekdb/ollama
```

## Usage

```typescript
import '@seekdb/ollama';
import { getEmbeddingFunction } from 'seekdb';

const ef = await getEmbeddingFunction('ollama', {
  url: 'http://localhost:11434',
  model_name: 'all-minilm-l6-v2',
});

const embeddings = await ef.generate(['hello world']);
```
