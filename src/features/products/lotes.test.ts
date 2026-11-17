import { describe, expect, it } from "vitest";

import { estadoLote } from "./lotes";

const hoy = new Date(2026, 9, 22);

describe("estadoLote", () => {
  it("marca sin vencimiento cuando falta la fecha", () => {
    expect(estadoLote(null, hoy)).toMatchObject({
      color: "gray",
      texto: "Sin vencimiento",
      vencido: false,
      porVencer: false,
    });
  });

  it("marca los lotes vencidos", () => {
    expect(estadoLote("2026-10-20", hoy)).toMatchObject({
      color: "red",
      texto: "Vencido hace 2 d",
      vencido: true,
    });
  });

  it("considera vencido el lote que vence hoy", () => {
    expect(estadoLote("2026-10-22", hoy)).toMatchObject({
      color: "red",
      texto: "Vence hoy",
      vencido: true,
    });
  });

  it("avisa cuando vence dentro de los próximos 30 días", () => {
    expect(estadoLote("2026-11-21", hoy)).toMatchObject({
      color: "orange",
      texto: "Vence en 30 d",
      porVencer: true,
    });
  });

  it("deja vigente un lote con más de 30 días", () => {
    expect(estadoLote("2026-11-22", hoy)).toMatchObject({
      color: "green",
      texto: "Vigente",
      vencido: false,
      porVencer: false,
    });
  });
});
