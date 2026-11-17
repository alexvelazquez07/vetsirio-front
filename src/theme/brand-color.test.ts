import { describe, expect, it } from "vitest";

import { aplicarColorDeMarca, crearEscalaMarca } from "./brand-color";

describe("crearEscalaMarca", () => {
  it("usa el color elegido como tono 500 y deriva tonos claros y oscuros", () => {
    const escala = crearEscalaMarca("#FF0000");

    expect(escala[50]).toBe("#FFEBEB");
    expect(escala[500]).toBe("#FF0000");
    expect(escala[900]).toBe("#610000");
  });

  it("usa el color de marca predeterminado si el valor no es hexadecimal válido", () => {
    expect(crearEscalaMarca("rojo")[500]).toBe("#0D9E87");
  });

  it("aplica la escala al tema Chakra del documento", () => {
    aplicarColorDeMarca("#2E90FA");

    expect(
      document.documentElement.style.getPropertyValue("--chakra-colors-brand-500"),
    ).toBe("#2E90FA");
    expect(
      document.documentElement.style.getPropertyValue("--chakra-colors-brand-700"),
    ).toBe(crearEscalaMarca("#2E90FA")[700]);
  });
});
