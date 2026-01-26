A convenient embedding function for Amazon Bedrock embedding models.
For more information about Amazon Bedrock models, see
https://docs.aws.amazon.com/bedrock/

This embedding function runs remotely on Amazon Bedrock's servers.
To generate an API key, visit:
https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-generate.html
Example:

```typescript
import { Client } from "seekdb";
import { BedrockEmbeddingFunction } from "@seekdb/embeddings-amazon-bedrock";
const ef = new BedrockEmbeddingFunction({
  apiKey: "your-api-key",
  region: "us-east-1",
  modelName: "amazon.titan-embed-text-v2",
});
const client = new Client({ path: "./seekdb.db" });
const collection = await client.createCollection({
  name: "my_collection",
  embeddingFunction: ef,
});
await collection.add({
  ids: ["1", "2"],
  documents: ["Hello world", "How are you?"],
  metadatas: [{ id: 1 }, { id: 2 }],
});
const results = await collection.query({
  queryTexts: ["How are you?"],
  nResults: 1,
});
```
