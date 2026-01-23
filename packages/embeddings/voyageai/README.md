# @seekdb/voyageai

VoyageAI embedding function for SeekDB.

## Installation

```bash
npm install @seekdb/voyageai
```

## Usage

```typescript
import '@seekdb/voyageai';
import { getEmbeddingFunction } from 'seekdb';

const ef = await getEmbeddingFunction('voyageai', {
  api_key_env_var: 'VOYAGE_API_KEY',
  model_name: 'voyage-3',
  truncation: true,
});

const embeddings = await ef.generate(['hello world']);
```
