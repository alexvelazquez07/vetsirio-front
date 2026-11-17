import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * Configuración global de las pruebas.
 *
 * Este archivo se carga en los dos entornos (node y jsdom), así que todo lo que
 * toque al DOM va guardado: las pruebas de formato de moneda corren en node y
 * `window` no existe ahí.
 */
const hayDOM = typeof window !== "undefined";

if (hayDOM) {
  // jsdom no implementa matchMedia y Chakra lo consulta para detectar el
  // esquema de color. Sin el stub, cualquier componente de Chakra revienta.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });

  // ResizeObserver tampoco existe y lo usan popovers y el menú lateral para
  // medir el viewport.
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  globalThis.ResizeObserver =
    globalThis.ResizeObserver ?? (ResizeObserverMock as never);

  // La paginación hace scroll al cambiar de página; jsdom no lo implementa.
  window.scrollTo = vi.fn();

  afterEach(() => {
    cleanup();
  });
}