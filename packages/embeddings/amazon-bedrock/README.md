# @seekdb/amazon-bedrock

Amazon Bedrock embedding function for SeekDB.

Amazon Bedrock is a managed foundation model platform on AWS. seekdb provides an `AmazonBedrockEmbeddingFunction` wrapper so you can generate embeddings via Bedrock and use them with seekdb collections.

## Dependencies and authentication

- An AWS account with Bedrock enabled and permission to invoke the target embedding model

## Installation

```bash
npm i seekdb @seekdb/amazon-bedrock
```

## Usage

```typescript
import { AmazonBedrockEmbeddingFunction } from "@seekdb/amazon-bedrock";

const ef = new AmazonBedrockEmbeddingFunction({
  region: "us-east-1",
  modelName: "amazon.titan-embed-text-v2",
});
```

## Configuration

- **apiKey**: API key (optional; can be provided via env var)
- **apiKeyEnv**: API key env var name (default: `"AMAZON_BEDROCK_API_KEY"`)
- **region**: AWS region (required, e.g. `"us-east-1"`)
- **modelName**: model name (default: `"amazon.titan-embed-text-v2"`)
