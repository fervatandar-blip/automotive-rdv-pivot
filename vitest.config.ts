import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "./vitest.server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    // Match Vercel's runtime zone so code that silently depends on the
    // process zone (instead of lib/timezone.ts) fails here, not in prod.
    env: { TZ: "UTC" },
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
