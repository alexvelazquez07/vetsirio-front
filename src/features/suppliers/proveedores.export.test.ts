import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  crearDocumentoPdfProveedores,
  crearLibroExcelProveedores,
} from "./proveedores.export";
import type { Proveedor } from "@/types/dominio";

const proveedor: Proveedor = {
  id: 12,
  documento: "80012345",
  razonSocial: "Laboratorios & Distribuidora S.A.",
  nombreFantasia: "LabSur",
  email: "pedidos@example.com",
  telefono: "0211234567",
  direccion: "Av. Central 123",
  departamento: "Central",
  ciudad: "San Lorenzo",
  barrio: "Centro",
  contactoNombre: "Ana Ramírez",
  notas: null,
  activo: false,
  _count: { productos: 5, facturasCompra: 2, egresos: 0 },
};

describe("exportación de proveedores a Excel", () => {
  it("genera un libro XLSX válido con datos, cantidades y estado", () => {
    const contenido = unzipSync(crearLibroExcelProveedores([proveedor]));
    const hoja = strFromU8(contenido["xl/worksheets/sheet1.xml"]);

    expect(Object.keys(contenido)).toContain("xl/worksheets/sheet1.xml");
    expect(hoja).toContain("Proveedor");
    expect(hoja).toContain("pedidos@example.com");
    expect(hoja).toContain("San Lorenzo");
    expect(hoja).toContain("Inactivo");
    expect(hoja).toContain("Laboratorios &amp; Distribuidora S.A.");
    expect(hoja).toContain('<autoFilter ref="A1:K2"/>');
  });
});

describe("exportación de proveedores a PDF", () => {
  it("crea un PDF válido con el listado", () => {
    const documento = crearDocumentoPdfProveedores([proveedor], "LabSur");

    expect(documento.output()).toContain("%PDF-");
    expect(documento.getNumberOfPages()).toBe(1);
  });
});
