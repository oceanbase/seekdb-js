# BM25 Embedding Function Guide

The BM25 (Best Matching 25) embedding function is a sparse embedding implementation that uses the BM25 ranking algorithm to convert text into sparse vectors for efficient full-text search.

## Overview

BM25 is a probabilistic information retrieval function that ranks documents based on query terms appearing in the document. It's widely used in search engines and document retrieval systems.

**Key Features:**

- Sparse vector output (high-dimensional, mostly zeros)
- Term frequency-based representation
- Document length normalization
- Stopword filtering
- Stemming support (Snowball)

## Installation

```bash
npm install @seekdb/bm25
```

## Basic Usage

```typescript
import { SeekdbClient, SparseVectorIndexConfig, K } from "seekdb";
import { Bm25EmbeddingFunction } from "@seekdb/bm25";

const client = new SeekdbClient({
  path: "./seekdb.db",
  database: "test",
});

// Create BM25 embedding function
const bm25 = new Bm25EmbeddingFunction();

// Create collection with BM25 index
const collection = await client.createCollection({
  name: "bm25_collection",
  schema: {
    sparseVectorIndex: new SparseVectorIndexConfig({
      sourceKey: K.DOCUMENT,
      embeddingFunction: bm25,
    }),
  },
});

// Add documents - auto-vectorized
await collection.add({
  ids: ["1", "2", "3"],
  documents: [
    "Machine learning is transforming artificial intelligence",
    "Python programming language is popular",
    "Vector databases enable semantic search",
  ],
});

// Search
const results = await collection.query({
  queryTexts: "artificial intelligence",
  queryKey: "sparseEmbedding",
  nResults: 3,
});
```

## Configuration Parameters

### Constructor Options

```typescript
interface Bm25EmbeddingArgs {
  k?: number; // Term frequency parameter (default: 1.2)
  b?: number; // Document length parameter (default: 0.75)
  avgDocLength?: number; // Average document length (default: 256)
  tokenMaxLength?: number; // Maximum token length (default: 40)
  stopwords?: string[]; // Custom stopwords (optional)
}
```

#### `k` (Term Frequency Saturation)

Controls how quickly term frequency saturates:

- **Range:** (0, +∞)
- **Default:** 1.2
- **Effect:**
  - Higher `k`: Less saturation, term frequency has more impact
  - Lower `k`: More saturation, diminishing returns for repeated terms

```typescript
// For documents where term frequency is important (e.g., product descriptions)
const bm25HighK = new Bm25EmbeddingFunction({ k: 1.5 });

// For documents where term presence matters more than frequency
const bm25LowK = new Bm25EmbeddingFunction({ k: 1.0 });
```

#### `b` (Document Length Normalization)

Controls how much document length affects ranking:

- **Range:** [0, 1]
- **Default:** 0.75
- **Effect:**
  - `b = 0`: Ignore document length
  - `b = 1`: Fully normalize by document length
  - Higher `b`: Longer documents get penalized more

```typescript
// For short documents (tweets, titles) - reduce length penalty
const bm25ShortDocs = new Bm25EmbeddingFunction({ b: 0.3 });

// For long documents (articles, books) - apply length normalization
const bm25LongDocs = new Bm25EmbeddingFunction({ b: 0.9 });
```

#### `avgDocLength` (Average Document Length)

Used for document length normalization:

- **Range:** (0, +∞)
- **Default:** 256
- **Effect:** Sets the "average" document length for normalization

```typescript
// For Twitter data
const bm25Twitter = new Bm25EmbeddingFunction({
  avgDocLength: 30,
});

// For blog posts
const bm25Blogs = new Bm25EmbeddingFunction({
  avgDocLength: 500,
});

// For research papers
const bm25Papers = new Bm25EmbeddingFunction({
  avgDocLength: 5000,
});
```

#### `tokenMaxLength` (Maximum Token Length)

Filters tokens longer than this limit:

- **Range:** (0, +∞)
- **Default:** 40
- **Effect:** Excludes very long tokens (often URLs, special strings)

```typescript
// For social media with hashtags/mentions
const bm25Social = new Bm25EmbeddingFunction({
  tokenMaxLength: 20,
});

// For technical documents with long identifiers
const bm25Tech = new Bm25EmbeddingFunction({
  tokenMaxLength: 100,
});
```

#### `stopwords` (Custom Stopwords)

Words to exclude from tokenization:

- **Default:** Common English stopwords (a, an, the, is, etc.)
- **Effect:** Removes low-information words

```typescript
// Add custom stopwords
const bm25Custom = new Bm25EmbeddingFunction({
  stopwords: [
    "please",
    "thank",
    "regards", // Email signatures
    "click",
    "here",
    "now", // Spam-like words
  ],
});

// Use only custom stopwords (disable defaults)
const bm25NoStopwords = new Bm25EmbeddingFunction({
  stopwords: [],
});
```

### Default Stopwords

The following stopwords are filtered by default:

```
a, an, and, are, as, at, be, by, for, from, has, he, in, is, it,
its, of, on, that, the, to, was, were, will, with
```

## Text Processing Pipeline

BM25 applies the following text processing steps:

1. **Lowercase conversion** - Convert to lowercase
2. **Alphanumeric filtering** - Keep only letters, numbers, underscores, spaces
3. **Whitespace tokenization** - Split on whitespace
4. **Stopword removal** - Filter out stopwords
5. **Length filtering** - Remove tokens exceeding `tokenMaxLength`
6. **Stemming** - Apply Snowball English stemmer
7. **Hashing** - Convert tokens to integer hash values
8. **BM25 scoring** - Apply BM25 formula

```typescript
// Input text
const text = "Machine learning is transforming artificial intelligence";

// After processing
// Tokens: ["machin", "learn", "transform", "artifici", "intellig"]

// Sparse vector
{ 1234567: 0.8, 2345678: 0.5, 3456789: 0.6, ... }
```

## BM25 Formula

The BM25 score for a document `D` given a query `Q` is:

```
score(D, Q) = sum over t in Q of IDF(t) * (f(t, D) * (k + 1)) / (f(t, D) + k * (1 - b + b * |D| / avgdl))

Where:
- t = term in query
- D = document
- f(t, D) = frequency of term t in document D
- |D| = length of document D (in tokens)
- avgdl = average document length in collection
- k = term frequency saturation parameter
- b = document length normalization parameter
- IDF(t) = inverse document frequency of term t
```

### Inverse Document Frequency (IDF)

```
IDF(t) = log((N - df(t) + 0.5) / (df(t) + 0.5))

Where:
- N = total number of documents
- df(t) = number of documents containing term t
```

**Note:** The current implementation computes BM25 scores per-document (not per-collection). The IDF component is simplified for single-document processing. For collection-wide IDF, you'd need to maintain term frequency statistics.

## Implementation Details

### Hashing

BM25 uses Murmur3 hash to convert stemmed tokens to integer keys:

```typescript
const token = "learning";
const hash = murmur3(token); // e.g., 1234567890
```

This allows sparse vectors to use integer keys while supporting unlimited vocabulary.

### Stemming

Snowball English stemmer is used for morphological normalization:

```
running -> run
running -> run
studies -> studi
```

### Tokenization

Simple whitespace tokenization with preprocessing:

```typescript
// Input: "Hello, World! How are you?"
// Processed: "hello world how are you"
// Tokens: ["hello", "world", "how", "are", "you"]
```

## Usage Patterns

### Short Documents (Social Media)

```typescript
const bm25Twitter = new Bm25EmbeddingFunction({
  k: 1.5,           // Less saturation, freq matters
  b: 0.3,           // Less length normalization
  avgDocLength: 30,   // Short documents
  tokenMaxLength: 20,  # Short tokens
  stopwords: ["rt", "via"]  # Remove retweets
});
```

### Long Documents (Articles, Papers)

```typescript
const bm25Articles = new Bm25EmbeddingFunction({
  k: 1.0,           # More saturation, presence matters
  b: 0.9,           # More length normalization
  avgDocLength: 1000, # Long documents
  tokenMaxLength: 40   # Standard token length
});
```

### Product Catalogs

```typescript
const bm25Products = new Bm25EmbeddingFunction({
  k: 1.2,
  b: 0.5,           # Moderate length normalization
  avgDocLength: 150,
  stopwords: [
    "product", "item", "sku",  # Catalog-specific
    "please", "click", "buy"  # Marketing fluff
  ]
});
```

### Code Search

```typescript
const bm25Code = new Bm25EmbeddingFunction({
  k: 1.0,
  b: 0.5,
  avgDocLength: 200,
  tokenMaxLength: 100,  # Allow long identifiers
  stopwords: ["var", "let", "const", "function"]  # Remove keywords
});
```

## Configuration Validation

The BM25 embedding function validates its configuration:

```typescript
import { SeekdbValueError } from "seekdb";

// Valid configurations
const bm25 = new Bm25EmbeddingFunction({
  k: 1.2, // OK
  b: 0.75, // OK
  avgDocLength: 256, // OK
  tokenMaxLength: 40, // OK
});

// Invalid configurations - these throw SeekdbValueError
const invalid1 = new Bm25EmbeddingFunction({
  k: -1.0, // Error: k must be positive
});

const invalid2 = new Bm25EmbeddingFunction({
  b: 1.5, // Error: b must be in [0, 1]
});

const invalid3 = new Bm25EmbeddingFunction({
  avgDocLength: 0, // Error: avgDocLength must be positive
});

const invalid4 = new Bm25EmbeddingFunction({
  tokenMaxLength: -5, // Error: tokenMaxLength must be positive
});
```

## Static Methods

### `validateConfig(config)`

Validate configuration before creating an instance:

```typescript
import { Bm25EmbeddingFunction } from "@seekdb/bm25";

const config = {
  k: 1.2,
  b: 0.75,
  avg_doc_length: 256,
  token_max_length: 40,
};

try {
  Bm25EmbeddingFunction.validateConfig(config);
  console.log("Configuration is valid");
} catch (error) {
  console.error("Invalid configuration:", error);
}
```

### `buildFromConfig(config)`

Create an instance from a configuration object:

```typescript
const config = {
  k: 1.2,
  b: 0.75,
  avg_doc_length: 256,
  token_max_length: 40,
  stopwords: ["a", "an", "the"],
};

const bm25 = Bm25EmbeddingFunction.buildFromConfig(config);
```

**Note:** Configuration keys use snake_case for `buildFromConfig`:

- `avgDocLength` → `avg_doc_length`
- `tokenMaxLength` → `token_max_length`

## Configuration Management

The BM25 embedding function supports configuration updates:

```typescript
import { Bm25EmbeddingFunction } from "@seekdb/bm25";

const bm25 = new Bm25EmbeddingFunction({
  k: 1.2,
  b: 0.75,
});

// Validate configuration updates
bm25.validateConfigUpdate({
  k: 1.5, // Allowed
  b: 0.8, // Allowed
  avg_doc_length: 300, // Allowed
});

// This will throw
bm25.validateConfigUpdate({
  unknown_param: "value", // Not allowed
});
```

Mutable configuration keys:

- `k`
- `b`
- `avg_doc_length`
- `token_max_length`
- `stopwords`

## Complete Example

```typescript
import { SeekdbClient, SparseVectorIndexConfig, K } from "seekdb";
import { Bm25EmbeddingFunction } from "@seekdb/bm25";

async function bm25Example() {
  // 1. Create client
  const client = new SeekdbClient({
    path: "./seekdb.db",
    database: "test"
  });

  // 2. Configure BM25 for technical articles
  const bm25 = new Bm25EmbeddingFunction({
    k: 1.2,              // Standard term frequency saturation
    b: 0.75,             # Standard length normalization
    avgDocLength: 200,    # Average article length
    tokenMaxLength: 40,   # Standard token length
    stopwords: [
      "the", "a", "an", "and", "or", "but",  # Basic stopwords
      "please", "thank", "regards",           # Email signatures
      "click", "here", "now", "download"     # Marketing fluff
    ]
  });

  console.log("BM25 configuration:", bm25.getConfig());

  // 3. Create collection
  const collection = await client.createCollection({
    name: "tech_articles",
    schema: {
      sparseVectorIndex: new SparseVectorIndexConfig({
        sourceKey: K.DOCUMENT,
        embeddingFunction: bm25,
        prune: true,            # Remove small values
        refine: true,           # Refine search results
        drop_ratio_build: 0.5,  # Drop 50% of smallest values
        drop_ratio_search: 0.3  # Drop 30% during search
      })
    }
  });

  // 4. Add articles
  const articles = [
    {
      id: "1",
      title: "Introduction to Machine Learning",
      content: "Machine learning is a subset of artificial intelligence that enables systems to learn from data without explicit programming."
    },
    {
      id: "2",
      title: "Python for Data Science",
      content: "Python is a powerful programming language widely used for data analysis, machine learning, and scientific computing."
    },
    {
      id: "3",
      title: "Vector Databases Explained",
      content: "Vector databases store data as embeddings and enable similarity search for AI applications including RAG and recommendations."
    },
    {
      id: "4",
      title: "Deep Learning with Neural Networks",
      content: "Deep learning uses neural networks with multiple layers to learn hierarchical representations of data."
    },
    {
      id: "5",
      title: "Natural Language Processing",
      content: "NLP enables computers to understand and generate human language using techniques like tokenization and transformers."
    }
  ];

  await collection.add({
    ids: articles.map(a => a.id),
    documents: articles.map(a => `${a.title}. ${a.content}`),
    metadatas: articles.map(a => ({
      title: a.title,
      category: "Technology"
    }))
  });

  console.log(`Added ${articles.length} articles`);

  // 5. Search examples
  const queries = [
    "artificial intelligence and machine learning",
    "Python programming language",
    "neural networks",
    "data science",
    "language understanding"
  ];

  for (const query of queries) {
    const results = await collection.query({
      queryTexts: query,
      queryKey: "sparseEmbedding",
      nResults: 3,
      include: ["documents", "metadatas", "distances"]
    });

    console.log(`\nQuery: "${query}"`);
    console.log("Results:");
    for (let i = 0; i < results.ids[0].length; i++) {
      console.log(`  ${i + 1}. ${results.metadatas?.[0]?.[i]?.title}`);
      console.log(`     Score: ${results.distances?.[0]?.[i]?.toFixed(4)}`);
    }
  }

  // 6. Demonstrate parameter effects
  console.log("\n\nDemonstrating parameter effects:");

  // High k (less saturation) - favors repeated terms
  const bm25HighK = new Bm25EmbeddingFunction({ k: 2.0, b: 0.75 });
  console.log("\nHigh k (2.0) - less saturation:");
  console.log(await testQuery(collection, "machine learning machine", bm25HighK));

  // Low k (more saturation) - favors term presence
  const bm25LowK = new Bm25EmbeddingFunction({ k: 0.8, b: 0.75 });
  console.log("\nLow k (0.8) - more saturation:");
  console.log(await testQuery(collection, "machine learning machine", bm25LowK));

  // High b (more length normalization)
  const bm25HighB = new Bm25EmbeddingFunction({ k: 1.2, b: 0.9 });
  console.log("\nHigh b (0.9) - more length normalization:");
  console.log(await testQuery(collection, "machine learning", bm25HighB));

  // Low b (less length normalization)
  const bm25LowB = new Bm25EmbeddingFunction({ k: 1.2, b: 0.3 });
  console.log("\nLow b (0.3) - less length normalization:");
  console.log(await testQuery(collection, "machine learning", bm25LowB));

  // Cleanup
  await client.deleteCollection("tech_articles");
  await client.close();
}

async function testQuery(
  collection: any,
  query: string,
  embedding: any
): Promise<string> {
  // This is for demonstration - in practice, you'd create separate collections
  // or use a different query approach
  return `Query: "${query}" with k=${embedding.k}, b=${embedding.b}`;
}

bm25Example().catch(console.error);
```

## Comparison with Dense Embeddings

| Aspect               | BM25 (Sparse)            | Dense Embeddings       |
| -------------------- | ------------------------ | ---------------------- |
| **Representation**   | Term-based (tokens)      | Semantic (neural)      |
| **Dimension**        | Very high (millions)     | Low (128-1536)         |
| **Training**         | None (rule-based)        | Requires training      |
| **Memory**           | Compact (non-zeros only) | Fixed per vector       |
| **Interpretability** | High (see which terms)   | Low (black box)        |
| **Best For**         | Exact keyword matching   | Semantic similarity    |
| **Cross-lingual**    | No                       | Yes (with right model) |

## Best Practices

1. **Tune for your data:**
   - Experiment with `k` and `b` on your specific dataset
   - Use validation data to find optimal parameters

2. **Customize stopwords:**
   - Add domain-specific stopwords
   - Consider removing common terms in your domain

3. **Set appropriate document length:**
   - Use actual average from your data
   - Recalculate when adding significantly different content

4. **Combine with other methods:**
   - Use hybrid search with dense vectors for semantic search
   - Combine with full-text search for exact matching

5. **Monitor performance:**
   - Check query latency with different parameters
   - Adjust `drop_ratio_build` and `drop_ratio_search` as needed

## License

BM25 embedding function is part of SeekDB and licensed under Apache 2.0.

The Snowball stemmer is licensed under BSD 3-Clause.
