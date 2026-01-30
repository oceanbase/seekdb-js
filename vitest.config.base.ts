import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";

// Load .env file from package directory or root directory
config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), ".env"),
});

export default {
  test: {
    // use threads mode
    pool: "threads",
    poolOptions: {
      threads: {
        // use single thread mode
        singleThread: true,
        // disable isolation to avoid worker termination problem
        isolate: false,
      },
    },

    // set timeout
    testTimeout: 60000,
    hookTimeout: 60000,
    teardownTimeout: 30000,

    // disable file parallelism, ensure stability
    fileParallelism: false,

    // set single thread mode for testing
    maxConcurrency: 1,

    // ensure normal exit even if tests fail
    bail: 0,

    // sequence tests to ensure proper cleanup between test files
    sequence: {
      concurrent: false,
      shuffle: false,
    },

    // Use basic reporter to reduce duplicate output
    // This prevents the verbose real-time progress updates that appear as duplicates
    reporter: ["basic"],
  },
};
