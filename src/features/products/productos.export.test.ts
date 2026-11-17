import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import type { Producto } from "@/types/dominio";
import {
  crearDocumentoPdfProductos,
  crearLibroExcelProductos,
} from "./productos.export";

const producto: Producto = {
  id: 7,
  codigo: "MED-001",
  nombre: "Ivermectina & Solución",
  descripcion: null,
  codigoBarras: "7841234567890",
  codigoSifen: null,
  marca: "VetSirio",
  laboratorio: null,
  principioActivo: "Ivermectina",
  concentracion: "1%",
  presentacion: "Frasco 100 ml",
  especieDestino: "Perros y gatos",
  registroSenacsa: null,
  ubicacion: "Depósito A",
  unidadMedida: "frasco",
  precioVenta: 85000,
  precioCosto: 52000,
  porcentajeIva: 10,
  stockActual: 2,
  stockMinimo: 5,
  esMedicamento: true,
  esControlado: false,
  requiereReceta: true,
  requiereLote: true,
  activo: false,
  fotoUrl: null,
  creadoEn: "2026-10-16T12:00:00.000Z",
  categoria: { id: 3, nombre: "Antiparasitarios" },
  proveedor: {
    id: 4,
    razonSocial: "Agro Vet S.A.",
    nombreFantasia: "Agro & Vet",
  },
};

describe("exportación de productos a Excel", () => {
  it("genera un libro XLSX válido con stock, precios y estado", () => {
    const contenido = unzipSync(crearLibroExcelProductos([producto]));
    const hoja = strFromU8(contenido["xl/worksheets/sheet1.xml"]);

    expect(Object.keys(contenido)).toEqual(
      expect.arrayContaining([
        "[Content_Types].xml",
        "_rels/.rels",
        "xl/workbook.xml",
        "xl/worksheets/sheet1.xml",
      ]),
    );
    expect(hoja).toContain("SKU");
    expect(hoja).toContain("Categoría");
    expect(hoja).toContain("MED-001");
    expect(hoja).toContain("Ivermectina &amp; Solución");
    expect(hoja).toContain("Antiparasitarios");
    expect(hoja).toContain("Stock bajo");
    expect(hoja).toContain("Agro &amp; Vet");
    expect(hoja).not.toContain("31/03/2027");
    expect(hoja).toContain("Inactivo");
    expect(hoja).toContain('<autoFilter ref="A1:N2"/>');
  });
});

describe("exportación de productos a PDF", () => {
  it("crea un documento PDF con el filtro aplicado", () => {
    const documento = crearDocumentoPdfProductos([producto], "Ivermectina");
    const contenido = documento.output();

    expect(contenido).toContain("%PDF-");
    expect(documento.getNumberOfPages()).toBe(1);
  });
});
