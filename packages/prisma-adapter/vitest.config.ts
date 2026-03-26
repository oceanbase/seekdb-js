import { defineConfig } from "vitest/config";
import vitestConfigBase from "../../vitest.config.base.ts";

export default defineConfig({
  ...vitestConfigBase,
  test: {
    ...vitestConfigBase.test,
    testTimeout: 10000,
    hookTimeout: 5000,
  },
});
