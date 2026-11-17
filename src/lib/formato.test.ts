import { describe, expect, it } from "vitest";

import {
  aDosDecimales,
  desenmascararMonto,
  enmascararMonto,
  formatCantidad,
  formatMilesimas,
  formatMoneda,
  formatMonedaDecimal,
  formatPorcentaje,
  formatRuc,
  formatTelefono,
  iniciales,
  normalizarANumero,
} from "./formato";

/**
 * Tests del formato de moneda.
 *
 * El separador de miles del guaraní es el PUNTO, no la coma, y esa es la
 * diferencia entre que una Dueña de veterinaria entienda el número a primera
 * vista o tenga que parsearlo mentalmente. Si alguien cambia esta lógica por
 * la de en-US, estos tests fallan.
 */

describe("formatMilesimas — separador de miles con punto", () => {
  it("agrupa de a tres dígitos", () => {
    expect(formatMilesimas(1500000)).toBe("1.500.000");
    expect(formatMilesimas(999)).toBe("999");
    expect(formatMilesimas(1000)).toBe("1.000");
    expect(formatMilesimas(1001)).toBe("1.001");
  });

  it("usa punto, nunca coma", () => {
    expect(formatMilesimas(1234567)).not.toContain(",");
    expect(formatMilesimas(1234567)).toContain(".");
  });

  it("maneja el cero y los valores vacíos", () => {
    expect(formatMilesimas(0)).toBe("0");
    expect(formatMilesimas(null)).toBe("");
    expect(formatMilesimas(undefined)).toBe("");
    expect(formatMilesimas("")).toBe("");
  });

  it("acepta string numérico", () => {
    expect(formatMilesimas("2500000")).toBe("2.500.000");
  });

  it("coloca el signo antes del número", () => {
    expect(formatMilesimas(-45000)).toBe("-45.000");
  });

  it("redondea en vez de truncar los decimales", () => {
    // El total de una factura se muestra entero: 6666.65 se presenta como 6.667
    expect(formatMilesimas(6666.65)).toBe("6.667");
  });
});

describe("formatMoneda — muestra sin centavos", () => {
  it("antepone el símbolo del guaraní", () => {
    expect(formatMoneda(1500000)).toBe("₲ 1.500.000");
    expect(formatMoneda(0)).toBe("₲ 0");
  });

  it("puede omitir el símbolo", () => {
    expect(formatMoneda(1500000, { conSimbolo: false })).toBe("1.500.000");
  });

  it("nunca muestra centavos, que es lo que se pidió", () => {
    expect(formatMoneda(1500000.75)).not.toContain(",");
    expect(formatMoneda(1500000.75)).toBe("₲ 1.500.001");
  });

  it("devuelve vacío ante valores no numéricos", () => {
    expect(formatMoneda(null)).toBe("");
    expect(formatMoneda("abc")).toBe("");
  });
});

describe("formatMonedaDecimal — con centavos, para balances", () => {
  it("usa coma para los decimales", () => {
    expect(formatMonedaDecimal(6666.65)).toBe("₲ 6.666,65");
    expect(formatMonedaDecimal(1500000.5)).toBe("₲ 1.500.000,50");
  });

  it("mantiene el punto como separador de miles", () => {
    expect(formatMonedaDecimal(1000000)).toContain("1.000.000");
  });
});

describe("enmascararMonto — lo que el usuario ve mientras escribe", () => {
  it("coloca las milesimas en vivo", () => {
    expect(enmascararMonto("1")).toBe("1");
    expect(enmascararMonto("15")).toBe("15");
    expect(enmascararMonto("150")).toBe("150");
    expect(enmascararMonto("1500")).toBe("1.500");
    expect(enmascararMonto("1500000")).toBe("1.500.000");
  });

  it("borra cualquier cosa que no sea dígito", () => {
    // "1a5b0c0d0d0" deja los dígitos 1,5,0,0,0,0: seis, no siete.
    expect(enmascararMonto("abc1d2e3")).toBe("123");
    expect(enmascararMonto("1a5b0c0d0d0")).toBe("150.000");
    expect(enmascararMonto("1a5b0c0d0d0e0")).toBe("1.500.000");
  });

  it("tolera que el usuario ya escriba con puntos", () => {
    // Pegar "1.500.000" debe devolver lo mismo, no "1.500.000000".
    expect(enmascararMonto("1.500.000")).toBe("1.500.000");
  });

  it("ignora los centavos, coherente con la regla del producto", () => {
    expect(enmascararMonto("1.500.000,50")).toBe("1.500.000");
  });

  it("elimina los ceros a la izquierda", () => {
    expect(enmascararMonto("0001500")).toBe("1.500");
    expect(enmascararMonto("0")).toBe("0");
  });

  it("devuelve cadena vacía si no hay dígitos", () => {
    expect(enmascararMonto("")).toBe("");
    expect(enmascararMonto("abc")).toBe("");
  });

  it("limita a 12 dígitos, que es el tope del campo", () => {
    // 19 dígitos entran, sólo se conservan los primeros 12.
    expect(enmascararMonto("1234567890123456789")).toBe("123.456.789.012");
  });
});

describe("desenmascararMonto — lo que viaja a la API", () => {
  it("revierte la máscara", () => {
    expect(desenmascararMonto("1.500.000")).toBe(1500000);
    expect(desenmascararMonto("999")).toBe(999);
    expect(desenmascararMonto("0")).toBe(0);
  });

  it("devuelve null ante campo vacío, no cero", () => {
    // La diferencia importa: null significa "no informado", 0 significa
    // "vale cero". Confundirlos hace que un total opcional se vuelva 0.
    expect(desenmascararMonto("")).toBeNull();
  });

  it("hace el viaje completo ida y vuelta", () => {
    for (const monto of [1, 999, 1000, 1500000, 250000000]) {
      expect(desenmascararMonto(enmascararMonto(String(monto)))).toBe(monto);
    }
  });
});

describe("aDosDecimales — redondeo contable", () => {
  it("redondea a dos decimales evitando el error binario", () => {
    // 1.005 * 100 da 100.49999999999999 en coma flotante.
    expect(aDosDecimales(1.005)).toBe(1.01);
    expect(aDosDecimales(0.1 + 0.2)).toBe(0.3);
    expect(aDosDecimales(6666.655)).toBe(6666.66);
  });
});

describe("normalizarANumero — puente con Prisma", () => {
  it("acepta el string que devuelve Prisma para los Decimal", () => {
    expect(normalizarANumero("1500.50")).toBe(1500.5);
  });

  it("interpreta el formato con puntos de miles", () => {
    expect(normalizarANumero("1.500.000")).toBe(1500000);
  });

  it("interpreta el formato con coma decimal", () => {
    expect(normalizarANumero("6.666,65")).toBe(6666.65);
  });

  it("devuelve null ante basura", () => {
    expect(normalizarANumero("abc")).toBeNull();
    expect(normalizarANumero(null)).toBeNull();
  });
});

describe("formatCantidad y formatPorcentaje", () => {
  it("usa coma decimal porque son unidades, no dinero", () => {
    expect(formatCantidad(1.5)).toBe("1,5");
    expect(formatCantidad(0.25)).toBe("0,25");
  });

  it("formatea porcentajes", () => {
    expect(formatPorcentaje(5)).toBe("5%");
    expect(formatPorcentaje(12.34)).toBe("12,3%");
  });
});

describe("identidades y documentos", () => {
  it("genera iniciales para el avatar", () => {
    expect(iniciales("María González")).toBe("MG");
    expect(iniciales("Ana")).toBe("AN");
    expect(iniciales("Ana María Lopez Ramirez")).toBe("AR");
    expect(iniciales("")).toBe("?");
  });

  it("formatea la cédula de 8 dígitos como X.XXX.XXX-X", () => {
    expect(formatRuc("12345678")).toBe("1.234.567-8");
  });

  it("formatea el RUC de 11 dígitos como XXX.XXX.XXXX-X", () => {
    expect(formatRuc("80012345678")).toBe("800.123.4567-8");
  });

  it("deja intacto lo que no es un documento válido", () => {
    // Un RUC de 10 dígitos no existe: devolverlo tal cual es más honesto
    // que inventarle un formato.
    expect(formatRuc("8001234567")).toBe("8001234567");
    expect(formatRuc("abc")).toBe("abc");
    expect(formatRuc(null)).toBe("");
  });

  it("agrupa el teléfono paraguayo", () => {
    expect(formatTelefono("0981123456")).toBe("0981 123 456");
  });
});