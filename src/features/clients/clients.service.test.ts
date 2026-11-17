import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("@/services/api", () => ({
  ApiError: class ApiError extends Error {},
  http: { get: mockGet },
}));

import {
  obtenerClientesParaExportar,
  obtenerProveedoresParaExportar,
} from "./clients.service";

describe("obtenerClientesParaExportar", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  describe("obtenerProveedoresParaExportar", () => {
    beforeEach(() => {
      mockGet.mockReset();
    });

    it("reúne todas las páginas respetando búsqueda e inclusión de inactivos", async () => {
      mockGet.mockImplementation(async (url: string) => {
        const query = new URLSearchParams(url.split("?")[1]);
        const pagina = Number(query.get("pagina"));
        const inicio = (pagina - 1) * 5;
        const cantidad = Math.min(12 - inicio, 5);

        return {
          items: Array.from({ length: cantidad }, (_, indice) => ({
            id: inicio + indice + 1,
          })),
          total: 12,
          pagina,
          porPagina: 5,
          totalPaginas: 3,
        };
      });

      const proveedores = await obtenerProveedoresParaExportar("LabSur", true);

      expect(proveedores.map((proveedor) => proveedor.id)).toEqual(
        Array.from({ length: 12 }, (_, indice) => indice + 1),
      );
      expect(mockGet).toHaveBeenCalledTimes(3);
      for (const [url] of mockGet.mock.calls) {
        const query = new URLSearchParams(String(url).split("?")[1]);
        expect(query.get("porPagina")).toBe("5");
        expect(query.get("incluirInactivos")).toBe("true");
        expect(query.get("ordenarPor")).toBe("recientes");
        expect(query.get("busqueda")).toBe("LabSur");
      }
    });
  });

  it("reúne todos los resultados, incluyendo inactivos, consultando páginas de cinco", async () => {
    mockGet.mockImplementation(async (url: string) => {
      const query = new URLSearchParams(url.split("?")[1]);
      const pagina = Number(query.get("pagina"));
      const total = 12;
      const inicio = (pagina - 1) * 5;
      const cantidad = Math.min(5, total - inicio);

      return {
        items: Array.from({ length: cantidad }, (_, indice) => ({
          id: inicio + indice + 1,
        })),
        total,
        pagina,
        porPagina: 5,
        totalPaginas: 3,
      };
    });

    const clientes = await obtenerClientesParaExportar("María");

    expect(clientes.map((cliente) => cliente.id)).toEqual(
      Array.from({ length: 12 }, (_, indice) => indice + 1),
    );
    expect(mockGet).toHaveBeenCalledTimes(3);
    for (const [url] of mockGet.mock.calls) {
      const query = new URLSearchParams(String(url).split("?")[1]);
      expect(query.get("porPagina")).toBe("5");
      expect(query.get("incluirInactivos")).toBe("true");
      expect(query.get("busqueda")).toBe("María");
    }
  });
});
