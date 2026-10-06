import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    env: {
      DATA_MODE: "mock",
      NEXTAUTH_SECRET: "test-secret-not-used-in-production",
    },
  },
});
