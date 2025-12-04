import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vitestConfigBase from "../../../vitest.config.base.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ...vitestConfigBase,
  resolve: {
    alias: {
      "seekdb-js": resolve(__dirname, "../../seekdb/src/index.ts"),
    },
  },
});
