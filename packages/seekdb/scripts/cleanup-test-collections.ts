import { SeekDBClient } from "../src/index.js";

async function cleanup() {
  const client = new SeekDBClient({
    host: process.env.SERVER_HOST || "127.0.0.1",
    port: parseInt(process.env.SERVER_PORT || "2881"),
    user: process.env.SERVER_USER || "root",
    password: process.env.SERVER_PASSWORD || "",
    database: process.env.SERVER_DATABASE || "test",
    tenant: process.env.SERVER_TENANT || "sys",
  });

  console.log("Connecting to database...");

  try {
    const collections = await client.listCollections();
    console.log(`Found ${collections.length} collections.`);

    for (const collection of collections) {
      if (
        collection.name.startsWith("test_") ||
        collection.name.startsWith("quickstart_")
      ) {
        console.log(`Deleting collection: ${collection.name}`);
        try {
          await client.deleteCollection(collection.name);
        } catch (error) {
          console.error(`Failed to delete ${collection.name}:`, error);
        }
      }
    }
    console.log("Cleanup complete.");
  } catch (error) {
    console.error("Error during cleanup:", error);
  } finally {
    await client.close();
  }
}

cleanup();
