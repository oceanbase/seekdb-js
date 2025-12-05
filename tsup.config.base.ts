import { defineConfig } from "tsup";

export default defineConfig({
  format: ["cjs", "esm"],
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: "dist",
  dts: {
    compilerOptions: {
      skipLibCheck: true,
    },
  },
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".mjs",
    };
  },
});
