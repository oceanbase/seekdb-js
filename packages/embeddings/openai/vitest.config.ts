import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "dotenv";
import vitestConfigBase from "../../../vitest.config.base.ts";

// Load .env file from package directory or root directory
config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"),
});

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...vitestConfigBase,
  resolve: {
    alias: {
      "seekdb-node-sdk": resolve(__dirname, "../../seekdb/src/index.ts"),
      "@seekdb/common": resolve(__dirname, "../common/index.ts"),
    },
  },
});
