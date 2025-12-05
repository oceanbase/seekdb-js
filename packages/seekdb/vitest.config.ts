import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vitestConfigBase from "../../vitest.config.base.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...vitestConfigBase,
  resolve: {
    alias: {
      "seekdb": resolve(__dirname, "./src/index.ts"),
      "@seekdb/default-embed": resolve(
        __dirname,
        "../embeddings/default-embed/index.ts",
      ),
    },
  },
});
