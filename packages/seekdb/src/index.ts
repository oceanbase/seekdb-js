/**
 * SeekDB SDK - Entry point
 */

export { SeekDBClient } from "./client.js";
export { SeekDBAdminClient, AdminClient } from "./admin-client.js";
export { Collection } from "./collection.js";
export { FilterBuilder } from "./filters.js";
export { Database } from "./database.js";
export {
  IEmbeddingFunction,
  registerEmbeddingFunction,
  EmbeddingConfig,
  getEmbeddingFunction,
} from "./embedding-function.js";

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
