import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("@/services/api", () => ({
  ApiError: class ApiError extends Error {},
  http: { get: mockGet },
}));

import { buscarProductoPorCodigo } from "./purchases.service";

function respuesta(items: Array<{ id: number; codigo: string }>) {
  return {
    items,
    total: items.length,
    pagina: 1,
    porPagina: 5,
    totalPaginas: 1,
  };
}

describe("buscarProductoPorCodigo", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("encuentra el SKU exacto aunque se escriba en minúsculas", async () => {
    mockGet.mockResolvedValue(
      respuesta([
        { id: 1, codigo: "MED-01" },
        { id: 2, codigo: "MED-010" },
      ]),
    );

    const producto = await buscarProductoPorCodigo(" med-01 ");

    expect(producto).toMatchObject({ id: 1, codigo: "MED-01" });
    const [url] = mockGet.mock.calls[0];
    const query = new URLSearchParams(String(url).split("?")[1]);
    expect(query.get("busqueda")).toBe("MED-01");
    expect(query.get("porPagina")).toBe("5");
  });

  it("no confunde un código que sólo contiene el SKU buscado", async () => {
    mockGet.mockResolvedValue(respuesta([{ id: 2, codigo: "MED-010" }]));

    await expect(buscarProductoPorCodigo("MED-01")).resolves.toBeNull();
  });

  it("no consulta la API cuando el SKU está vacío", async () => {
    await expect(buscarProductoPorCodigo("   ")).resolves.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });
});
