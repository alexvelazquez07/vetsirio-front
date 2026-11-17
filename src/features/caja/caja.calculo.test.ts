import { describe, expect, it } from "vitest";

import {
  calcularDiferencia,
  estadoDiferencia,
  redondear2,
  sumarDetallesArqueo,
} from "./caja.calculo";

describe("cálculos de caja", () => {
  it("suma el desglose de billetes y monedas", () => {
    expect(
      sumarDetallesArqueo([
        { denominacion: 100000, cantidad: 2 },
        { denominacion: 50000, cantidad: 3 },
        { denominacion: 500, cantidad: 4 },
      ]),
    ).toBe(352000);
  });

  it("ignora cantidades negativas y redondea a dos decimales", () => {
    expect(
      sumarDetallesArqueo([
        { denominacion: 1000, cantidad: -2 },
        { denominacion: 100, cantidad: 1 },
      ]),
    ).toBe(100);
  });

  it("calcula la diferencia con signo: negativa es faltante", () => {
    expect(calcularDiferencia(950000, 1000000)).toBe(-50000);
    expect(calcularDiferencia(1050000, 1000000)).toBe(50000);
    expect(calcularDiferencia(1000000, 1000000)).toBe(0);
  });

  it("clasifica el estado del arqueo", () => {
    expect(estadoDiferencia(0)).toBe("cuadrada");
    expect(estadoDiferencia(1500)).toBe("sobrante");
    expect(estadoDiferencia(-1500)).toBe("faltante");
  });

  it("redondea de forma coherente", () => {
    expect(redondear2(10.005)).toBe(10.01);
  });
});
