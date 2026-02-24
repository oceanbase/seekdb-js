import { defineConfig } from "tsup";
import baseConfig from "../../tsup.config.base";

export default defineConfig({
  ...baseConfig,
  entry: ["src/index.ts"],
  esbuildOptions(options, context) {
    if (context.format === "cjs") {
      options.define = { ...options.define, "import.meta.url": "__filename" };
    }
  },
});
