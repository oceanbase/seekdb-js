import { defineConfig } from "tsup";

export default defineConfig({
  format: ["cjs", "esm"],
  splitting: false,
  sourcemap: true,
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
