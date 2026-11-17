import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

/**
 * Configuración de Vite.
 *
 * El alias `@` evita imports relativos largos como
 * `../../../../components/layout/PageHeader`. Es el mismo alias que usa
 * tsconfig.json: si los dos no coinciden, el editor resuelve una ruta y el
 * bundler otra.
 */
export default defineConfig(({ mode }) => ({
  // En producción el front se sirve en https://signiasoft.com/vetsirio/.
  // Vite necesita saberlo para reescribir los assets de index.html
  // (`/assets/...` -> `/vetsirio/assets/...`); sin esto el navegador pide los
  // archivos en la raíz del dominio y da 404.
  // En desarrollo queda en "/" para no cambiar `npm run dev`.
  base: mode === "production" ? "/vetsirio/" : "/",

  plugins: [react()],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  server: {
    port: 5173,
    // El backend corre en otro puerto, así que el proxy evita CORS y hace que
    // las cookies de sesión funcionen igual que en producción detrás de Nginx.
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: "dist",
    sourcemap: false,
    // Se separa el vendor para que un cambio en el código de la app no
    // invalide el chunk de librerías, que es el que no cambia seguido.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;

          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) {
            return "react";
          }

          if (/[\\/]node_modules[\\/](@chakra-ui|@ark-ui|@emotion|react-icons)[\\/]/.test(id)) {
            return "chakra";
          }

          if (/[\\/]node_modules[\\/](@tanstack)[\\/]/.test(id)) {
            return "datos";
          }

          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
}));