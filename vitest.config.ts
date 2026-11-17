import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Configuración de Vitest.
 *
 * El entorno es jsdom para todo. Podría-se dejar la lógica pura en node con
 * `environmentMatchGlobs`, pero esa opción fue removida en Vitest 5 y el reemplazo
 * (`projects`) agrega configuración por el beneficio de aceleración de unos
 * milisegundos en 34 tests. No compensa la complejidad.
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  test: {
    globals: true,
    environment: "jsdom",
    testTimeout: 30000,

    setupFiles: ["./src/test/setup.ts"],

    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.spec.ts"],

    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      // Los snippets los genera la CLI de Chakra: no son código nuestro y
      // probarlos no aporta nada sobre nuestro comportamiento.
      exclude: [
        "src/generated/**",
        "src/components/ui/**",
        "src/test/**",
        "src/**/*.d.ts",
        "src/main.tsx",
      ],
    },
  },
});