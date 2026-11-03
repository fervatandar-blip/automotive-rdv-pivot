import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // tsconfig keeps JSX for Next to compile; tests need it compiled here.
  esbuild: { jsx: "automatic" },
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
    // .tsx for server-rendered component tests (renderToStaticMarkup).
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
