import { describe, expect, it } from "vitest";

import {
  IMPRESION_POR_DEFECTO,
  normalizarConfiguracionImpresion,
} from "@/features/settings/impresion";
import {
  construirCuerpoTicket,
  type TicketOrganizacion,
  type TicketVentaDatos,
} from "./ticket";

const organizacion: TicketOrganizacion = {
  nombre: "Veterinaria San Roque",
  razonSocial: "San Roque S.A.",
  ruc: "80012345-6",
  direccion: "Av. Mcal. López 123",
  telefono: "0981 123 456",
  timbrado: "12345678",
  establecimiento: "001",
  puntoVenta: "001",
};

const venta: TicketVentaDatos = {
  numeroComprobante: "001-001-0000157",
  fechaEmision: "2026-11-13T12:30:00.000Z",
  tipoComprobante: "factura",
  timbrado: "12345678",
  moneda: "PYG",
  condicionPago: "contado",
  estado: "ACTIVA",
  cliente: { nombre: "María González", documento: "1.234.567-8" },
  vendedor: "Dr. Juan Pérez",
  items: [
    {
      descripcion: "Consulta clínica general",
      cantidad: 1,
      precioUnitario: 150000,
      total: 150000,
    },
  ],
  subtotal: 136364,
  iva10: 13636,
  total: 150000,
  pagos: [{ metodo: "efectivo", monto: 150000 }],
};

function config(extra: Partial<typeof IMPRESION_POR_DEFECTO> = {}) {
  return { ...IMPRESION_POR_DEFECTO, ...extra };
}

describe("configuración de impresión", () => {
  it("usa los valores por defecto cuando el backend devuelve null", () => {
    expect(normalizarConfiguracionImpresion(null)).toEqual(IMPRESION_POR_DEFECTO);
    expect(normalizarConfiguracionImpresion({})).toEqual(IMPRESION_POR_DEFECTO);
  });

  it("corrige formatos y copias fuera de rango", () => {
    const resultado = normalizarConfiguracionImpresion({
      formato: "a4",
      copias: 99,
      autoImprimir: true,
      mensajePie: "x".repeat(300),
    });

    expect(resultado.formato).toBe("ticket_80");
    expect(resultado.copias).toBe(3);
    expect(resultado.autoImprimir).toBe(true);
    expect(resultado.mensajePie).toHaveLength(160);
  });
});

describe("ticket de venta", () => {
  it("incluye los datos del negocio, el cliente y el total", () => {
    const html = construirCuerpoTicket(venta, organizacion, config());

    expect(html).toContain("Veterinaria San Roque");
    expect(html).toContain("RUC 80012345-6");
    expect(html).toContain("FACTURA DE VENTA");
    expect(html).toContain("María González");
    expect(html).toContain("150.000");
    expect(html).toContain("Efectivo");
  });

  it("oculta las secciones desactivadas", () => {
    const html = construirCuerpoTicket(
      venta,
      organizacion,
      config({
        mostrarCliente: false,
        mostrarPagos: false,
        mostrarDesgloseIva: false,
        mostrarDatosFiscales: false,
      }),
    );

    expect(html).not.toContain("María González");
    expect(html).not.toContain("Efectivo");
    expect(html).not.toContain("IVA 10 %");
    expect(html).not.toContain("Timbrado");
    expect(html).toContain("TOTAL");
  });

  it("escapa el HTML del mensaje al pie", () => {
    const html = construirCuerpoTicket(
      venta,
      organizacion,
      config({ mensajePie: '<script>alert("x")</script>' }),
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("marca el comprobante como no fiscal cuando no hay timbrado", () => {
    const html = construirCuerpoTicket(
      { ...venta, timbrado: null, tipoComprobante: "ticket" },
      { ...organizacion, timbrado: null },
      config(),
    );

    expect(html).toContain("TICKET DE VENTA");
    expect(html).toContain("Documento no válido como factura");
  });

  it("superpone la marca de anulada", () => {
    const html = construirCuerpoTicket(
      { ...venta, estado: "ANULADA" },
      organizacion,
      config(),
    );

    expect(html).toContain("ANULADA");
  });
});
