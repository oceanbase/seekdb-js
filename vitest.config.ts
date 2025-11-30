import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "seekdb-node-sdk": resolve(__dirname, "packages/seekdb/src/index.ts"),
    },
  },
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
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,

    // disable file parallelism, ensure stability
    fileParallelism: false,

    // set single thread mode for testing
    maxConcurrency: 1,

    // ensure normal exit even if tests fail
    bail: 0,
  },
});
