/**
 * SeekDB SDK - Entry point
 */

export { SeekDBClient } from './client.js';
export { Collection } from './collection.js';
export { FilterBuilder } from './filters.js';

export * from './errors.js';
export * from './types.js';
export {
  DEFAULT_VECTOR_DIMENSION,
  DEFAULT_DISTANCE_METRIC,
  DEFAULT_TENANT,
  DEFAULT_DATABASE,
  DEFAULT_PORT,
  DEFAULT_USER,
  DEFAULT_CHARSET,
} from './utils.js';
