import { describe, expect, it } from "vitest";

import {
  estadoPrecio,
  montoVigente,
  resolverPrecioVigente,
  type PrecioFormulario,
} from "./precios";

function precio(
  vigenteDesde: string,
  vigenteHasta: string,
  monto: number,
  tipo: "venta" | "compra" = "venta",
): PrecioFormulario {
  return {
    key: `${tipo}-${vigenteDesde}`,
    tipo,
    monto,
    vigenteDesde,
    vigenteHasta,
  };
}

describe("precios de producto", () => {
  it("elige el precio vigente para la fecha de factura", () => {
    const precios = [
      precio("2026-01-01", "2026-06-30", 1000),
      precio("2026-07-01", "", 1500),
    ];

    expect(resolverPrecioVigente(precios, "2026-03-15")?.monto).toBe(1000);
    expect(resolverPrecioVigente(precios, "2026-08-01")?.monto).toBe(1500);
  });

  it("devuelve null si la vigencia terminó", () => {
    const precios = [precio("2026-01-01", "2026-06-30", 1000)];

    expect(resolverPrecioVigente(precios, "2026-07-01")).toBeNull();
  });

  it("toma la última vigencia cuando hay superposición", () => {
    const precios = [
      precio("2026-01-01", "", 1000),
      precio("2026-06-01", "", 1200),
    ];

    expect(resolverPrecioVigente(precios, "2026-07-01")?.monto).toBe(1200);
  });

  it("separa los precios de venta y de compra", () => {
    const precios = [
      precio("2026-01-01", "", 1000, "venta"),
      precio("2026-01-01", "", 700, "compra"),
    ];

    expect(montoVigente(precios, "venta", "2026-07-01")).toBe(1000);
    expect(montoVigente(precios, "compra", "2026-07-01")).toBe(700);
  });

  it("clasifica el estado de cada vigencia", () => {
    expect(estadoPrecio(precio("2026-01-01", "", 1000), "2026-07-01")).toBe(
      "vigente",
    );
    expect(estadoPrecio(precio("2026-08-01", "", 1000), "2026-07-01")).toBe(
      "programado",
    );
    expect(
      estadoPrecio(precio("2026-01-01", "2026-06-30", 1000), "2026-07-01"),
    ).toBe("vencido");
  });

  it("interpreta las fechas ISO que devuelve la API", () => {
    const precios = [
      precio("2026-01-01T00:00:00.000Z", "", 1000),
      precio(
        "2026-07-01T00:00:00.000Z",
        "2026-07-31T00:00:00.000Z",
        1500,
      ),
    ];

    expect(resolverPrecioVigente(precios, "2026-07-01")?.monto).toBe(1500);
    expect(resolverPrecioVigente(precios, "2026-08-01")?.monto).toBe(1000);
    expect(estadoPrecio(precios[1], "2026-07-01")).toBe("vigente");
  });
});
