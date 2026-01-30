/**
 * seekdb SDK - Entry point
 */

export { SeekdbClient } from "./client.js";
export { SeekdbAdminClient } from "./client-admin.js";
export { Collection } from "./collection.js";
export { Database, OBDatabase } from "./database.js";
export {
  registerEmbeddingFunction,
  getEmbeddingFunction,
} from "./embedding-function.js";

// Factory functions for smart client creation
export { Client, AdminClient } from "./factory.js";

export * from "./errors.js";
export * from "./types.js";
export {
  DEFAULT_VECTOR_DIMENSION,
  DEFAULT_DISTANCE_METRIC,
  DEFAULT_TENANT,
  DEFAULT_DATABASE,
  DEFAULT_PORT,
  DEFAULT_USER,
  DEFAULT_CHARSET,
} from "./utils.js";
