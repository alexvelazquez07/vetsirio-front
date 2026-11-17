import { describe, expect, it } from "vitest";

import {
  IMPRESION_POR_DEFECTO,
  normalizarConfiguracionImpresion,
} from "@/features/settings/impresion";
import { crearDocumentoHoja } from "./hoja";
import type { TicketOrganizacion, TicketVentaDatos } from "./ticket";

const organizacion: TicketOrganizacion = {
  nombre: "Veterinaria San Roque",
  razonSocial: "San Roque S.A.",
  ruc: "80012345-6",
  direccion: "Av. Mcal. López 123",
  telefono: "0981 123 456",
  email: "hola@sanroque.com.py",
  timbrado: "12345678",
  establecimiento: "001",
  puntoVenta: "001",
  colorPrimario: "#0D9E87",
};

const venta: TicketVentaDatos = {
  numeroComprobante: "001-001-0000157",
  fechaEmision: "2026-11-13T12:30:00.000Z",
  tipoComprobante: "factura",
  timbrado: "12345678",
  establecimiento: "001",
  puntoExpedicion: "001",
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
    {
      descripcion: "Alimento balanceado 3 kg",
      cantidad: 2,
      precioUnitario: 65000,
      total: 130000,
    },
  ],
  subtotal: 327273,
  iva10: 32727,
  total: 360000,
  pagos: [
    { metodo: "efectivo", monto: 200000 },
    { metodo: "transferencia", monto: 160000 },
  ],
};

const configuracion = (extra: Partial<typeof IMPRESION_POR_DEFECTO> = {}) => ({
  ...IMPRESION_POR_DEFECTO,
  formato: "hoja" as const,
  ...extra,
});

describe("configuración de hoja completa", () => {
  it("normaliza el formato, el tamaño y la media hoja", () => {
    const resultado = normalizarConfiguracionImpresion({
      formato: "hoja",
      tamanoHoja: "carta",
      mediaHoja: true,
      duplicadoMediaHoja: true,
    });

    expect(resultado.formato).toBe("hoja");
    expect(resultado.tamanoHoja).toBe("carta");
    expect(resultado.mediaHoja).toBe(true);
    expect(resultado.duplicadoMediaHoja).toBe(true);
  });

  it("cae a A4 y hoja completa con valores desconocidos", () => {
    const resultado = normalizarConfiguracionImpresion({
      formato: "hoja",
      tamanoHoja: "oficio",
      mediaHoja: "sí",
    });

    expect(resultado.tamanoHoja).toBe("a4");
    expect(resultado.mediaHoja).toBe(false);
  });
});

describe("PDF de hoja completa", () => {
  it("genera una página por copia", async () => {
    const pdf = await crearDocumentoHoja(venta, organizacion, configuracion());

    expect(pdf.getNumberOfPages()).toBe(1);
    expect(pdf.output("blob").size).toBeGreaterThan(0);
  });

  it("genera varias páginas cuando se piden copias", async () => {
    const pdf = await crearDocumentoHoja(
      venta,
      organizacion,
      configuracion({ copias: 2 }),
    );

    expect(pdf.getNumberOfPages()).toBe(2);
  });

  it("usa el tamaño Carta cuando está configurado", async () => {
    const pdf = await crearDocumentoHoja(
      venta,
      organizacion,
      configuracion({ tamanoHoja: "carta" }),
    );

    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(612, 0);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(792, 0);
  });

  it("entra en media hoja con una venta típica", async () => {
    const pdf = await crearDocumentoHoja(
      {
        ...venta,
        items: [
          ...venta.items,
          {
            descripcion: "Vacuna antirrábica",
            cantidad: 1,
            precioUnitario: 80000,
            total: 80000,
          },
        ],
        estado: "ANULADA",
      },
      organizacion,
      configuracion({ mediaHoja: true }),
    );

    expect(pdf.getNumberOfPages()).toBe(1);
  });

  it("entra en media hoja Carta con una venta típica", async () => {
    const pdf = await crearDocumentoHoja(
      venta,
      organizacion,
      configuracion({ mediaHoja: true, tamanoHoja: "carta" }),
    );

    expect(pdf.getNumberOfPages()).toBe(1);
  });

  it("imprime original y duplicado en la misma hoja", async () => {
    const pdf = await crearDocumentoHoja(
      venta,
      organizacion,
      configuracion({ mediaHoja: true, duplicadoMediaHoja: true }),
    );

    expect(pdf.getNumberOfPages()).toBe(1);
  });

  it("entra en media hoja con 10 ítems", async () => {
    const items = Array.from({ length: 10 }, (_, indice) => ({
      descripcion: `Servicio veterinario ${indice + 1} con detalle`,
      cantidad: 1,
      precioUnitario: 50000,
      total: 50000,
    }));

    const pdf = await crearDocumentoHoja(
      { ...venta, items, total: 500000 },
      organizacion,
      configuracion({ mediaHoja: true }),
    );

    expect(pdf.getNumberOfPages()).toBe(1);
  });

  it("entra en media hoja con 10 ítems y duplicado", async () => {
    const items = Array.from({ length: 10 }, (_, indice) => ({
      descripcion: `Servicio veterinario ${indice + 1} con detalle`,
      cantidad: 1,
      precioUnitario: 50000,
      total: 50000,
    }));

    const pdf = await crearDocumentoHoja(
      { ...venta, items, total: 500000 },
      organizacion,
      configuracion({ mediaHoja: true, duplicadoMediaHoja: true }),
    );

    expect(pdf.getNumberOfPages()).toBe(1);
  });
});
