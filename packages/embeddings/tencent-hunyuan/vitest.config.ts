import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vitestConfigBase from "../../../vitest.config.base.ts";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({
  path: resolve(__dirname, ".env"),
});

export default defineConfig({
  ...vitestConfigBase,
  resolve: {
    alias: {
      seekdb: resolve(__dirname, "../../seekdb/src/index.ts"),
      "@seekdb/common": resolve(__dirname, "../common/index.ts"),
      "@seekdb/openai": resolve(__dirname, "../openai/index.ts"),
    },
  },
});
