/**
 * SeekDB SDK - Entry point
 */

export { SeekDBClient } from "./client.js";
export { SeekDBAdminClient } from "./admin-client.js";
export { InternalClient } from "./internal-client.js";
export { Collection } from "./collection.js";
export { Database } from "./database.js";
export {
  registerEmbeddingFunction,
  getEmbeddingFunction,
} from "./embedding-function.js";

export type {
  IEmbeddingFunction,
  EmbeddingConfig,
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
