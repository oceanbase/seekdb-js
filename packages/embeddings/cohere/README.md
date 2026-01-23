# @seekdb/cohere

Cohere embedding function for SeekDB.

## Installation

```bash
npm install @seekdb/cohere
```

## Usage

```typescript
import '@seekdb/cohere';
import { getEmbeddingFunction } from 'seekdb';

const ef = await getEmbeddingFunction('cohere', {
  api_key_env_var: 'COHERE_API_KEY',
  model_name: 'embed-english-v3.0',
  input_type: 'search_document',
});

const embeddings = await ef.generate(['hello world']);
```
