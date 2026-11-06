import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Las pruebas de integración comparten una base PGlite en memoria por archivo.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
