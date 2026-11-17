import { describe, expect, it } from "vitest";

import {
  calcularLineaCompra,
  calcularTotalesCompra,
  redondear2,
} from "./purchases.calculo";

describe("cálculos de compras", () => {
  it("calcula una línea con IVA ya incluido en el costo", () => {
    expect(
      calcularLineaCompra({
        cantidad: 2,
        costoUnitario: 1500,
        porcentajeIva: 10,
      }),
    ).toEqual({ subtotal: 2727.27, montoIva: 272.73, total: 3000 });
  });

  it("discrimina IVA 5 %, IVA 10 % y exenta (costos ya con IVA)", () => {
    expect(
      calcularTotalesCompra([
        { cantidad: 1, costoUnitario: 1000, porcentajeIva: 5 },
        { cantidad: 2, costoUnitario: 500, porcentajeIva: 10 },
        { cantidad: 1, costoUnitario: 750, porcentajeIva: 0 },
      ]),
    ).toEqual({
      subtotal: 2611.47,
      iva5: 47.62,
      iva10: 90.91,
      exenta: 750,
      iva: 138.53,
      total: 2750,
    });
  });

  it("redondea recién al final y mantiene coherencia", () => {
    expect(redondear2(10.005)).toBe(10.01);
    expect(
      calcularLineaCompra({
        cantidad: 3,
        costoUnitario: 133.333,
        porcentajeIva: 5,
      }),
    ).toEqual({ subtotal: 380.95, montoIva: 19.05, total: 400 });
  });
});
