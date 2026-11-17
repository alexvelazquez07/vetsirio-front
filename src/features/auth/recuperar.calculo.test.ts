import { describe, expect, it } from "vitest";

import {
  calcularMsRestantes,
  enmascararEmail,
  esCodigoCompleto,
  estadoDelTiempo,
  formatearCuentaRegresiva,
  porcentajeRestante,
  segundosParaReenviar,
} from "./recuperar.calculo";

describe("recuperar.calculo", () => {
  describe("calcularMsRestantes", () => {
    const ahora = new Date("2026-11-05T12:00:00.000Z").getTime();

    it("calcula desde la fecha absoluta del backend", () => {
      const expiraEn = new Date(ahora + 9 * 60 * 1000).toISOString();

      expect(calcularMsRestantes(expiraEn, ahora)).toBe(9 * 60 * 1000);
    });

    it("nunca devuelve negativos", () => {
      const expiraEn = new Date(ahora - 5000).toISOString();

      expect(calcularMsRestantes(expiraEn, ahora)).toBe(0);
    });

    it("devuelve 0 si falta la fecha o es inválida", () => {
      expect(calcularMsRestantes(null, ahora)).toBe(0);
      expect(calcularMsRestantes(undefined, ahora)).toBe(0);
      expect(calcularMsRestantes("no-es-una-fecha", ahora)).toBe(0);
    });
  });

  describe("formatearCuentaRegresiva", () => {
    it("muestra minutos y segundos con dos dígitos", () => {
      expect(formatearCuentaRegresiva(10 * 60 * 1000)).toBe("10:00");
      expect(formatearCuentaRegresiva(61 * 1000)).toBe("01:01");
      expect(formatearCuentaRegresiva(5000)).toBe("00:05");
    });

    it("redondea hacia arriba para no mostrar 00:00 antes de tiempo", () => {
      expect(formatearCuentaRegresiva(400)).toBe("00:01");
      expect(formatearCuentaRegresiva(0)).toBe("00:00");
      expect(formatearCuentaRegresiva(-1000)).toBe("00:00");
    });
  });

  describe("porcentajeRestante", () => {
    it("calcula el porcentaje del tiempo total", () => {
      expect(porcentajeRestante(5 * 60 * 1000, 10 * 60 * 1000)).toBe(50);
    });

    it("acota entre 0 y 100", () => {
      expect(porcentajeRestante(20 * 60 * 1000, 10 * 60 * 1000)).toBe(100);
      expect(porcentajeRestante(-1, 10 * 60 * 1000)).toBe(0);
      expect(porcentajeRestante(1000, 0)).toBe(0);
    });
  });

  describe("estadoDelTiempo", () => {
    it("marca aviso bajo 2 minutos y crítico bajo 30 segundos", () => {
      expect(estadoDelTiempo(3 * 60 * 1000)).toBe("normal");
      expect(estadoDelTiempo(2 * 60 * 1000)).toBe("aviso");
      expect(estadoDelTiempo(31 * 1000)).toBe("aviso");
      expect(estadoDelTiempo(30 * 1000)).toBe("critico");
      expect(estadoDelTiempo(1)).toBe("critico");
      expect(estadoDelTiempo(0)).toBe("vencido");
    });
  });

  describe("esCodigoCompleto", () => {
    it("acepta sólo seis dígitos", () => {
      expect(esCodigoCompleto("042731")).toBe(true);
      expect(esCodigoCompleto("12345")).toBe(false);
      expect(esCodigoCompleto("1234567")).toBe(false);
      expect(esCodigoCompleto("12a456")).toBe(false);
      expect(esCodigoCompleto("")).toBe(false);
    });
  });

  describe("enmascararEmail", () => {
    it("conserva la primera y la última letra y el dominio", () => {
      expect(enmascararEmail("ana@veterinaria.com")).toBe("a***a@veterinaria.com");
      expect(enmascararEmail("  arichard.1190@gmail.com  ")).toBe(
        "a***0@gmail.com",
      );
    });

    it("no rompe con valores incompletos", () => {
      expect(enmascararEmail("a@x.com")).toBe("***@x.com");
      expect(enmascararEmail("sin-arroba")).toBe("sin-arroba");
      expect(enmascararEmail("")).toBe("");
    });
  });

  describe("segundosParaReenviar", () => {
    const ahora = 1_000_000;

    it("devuelve los segundos que faltan desde el último envío", () => {
      expect(segundosParaReenviar(ahora, ahora)).toBe(30);
      expect(segundosParaReenviar(ahora - 10_000, ahora)).toBe(20);
    });

    it("devuelve 0 cuando ya se puede reenviar", () => {
      expect(segundosParaReenviar(ahora - 30_000, ahora)).toBe(0);
      expect(segundosParaReenviar(ahora - 60_000, ahora)).toBe(0);
      expect(segundosParaReenviar(null, ahora)).toBe(0);
    });
  });
});
