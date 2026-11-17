import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";

import {
  crearLibroExcelClientes,
  crearDocumentoPdfClientes,
} from "./clientes.export";
import type { Cliente } from "@/types/dominio";

const cliente: Cliente = {
  id: 12,
  documento: "8001234-5",
  tipoDocumento: "ruc",
  cedula: null,
  ruc: "8001234-5",
  pasaporte: null,
  nombres: "María & José",
  apellidos: "Gómez",
  razonSocial: null,
  email: "maria@example.com",
  telefono: "0981123456",
  whatsapp: "0981987654",
  direccion: null,
  departamento: "Central",
  ciudad: "San Lorenzo",
  barrio: "Centro",
  notas: null,
  activo: false,
  creadoEn: "2026-10-16T12:00:00.000Z",
  nombreCompleto: "María & José Gómez",
  _count: { pacientes: 2, ventas: 4 },
};

describe("exportación de clientes a Excel", () => {
  it("genera un libro XLSX válido con datos y estado de todos los clientes", () => {
    const contenido = unzipSync(crearLibroExcelClientes([cliente]));
    const hoja = strFromU8(contenido["xl/worksheets/sheet1.xml"]);

    expect(Object.keys(contenido)).toEqual(
      expect.arrayContaining([
        "[Content_Types].xml",
        "_rels/.rels",
        "xl/workbook.xml",
        "xl/worksheets/sheet1.xml",
      ]),
    );
    expect(hoja).toContain("Cliente");
    expect(hoja).toContain("Documento");
    expect(hoja).toContain("maria@example.com");
    expect(hoja).toContain("San Lorenzo");
    expect(hoja).toContain("Inactivo");
    expect(hoja).toContain("María &amp; José Gómez");
    expect(hoja).toContain('<autoFilter ref="A1:J2"/>');
  });
});

describe("exportación de clientes a PDF", () => {
  it("crea un documento PDF con los datos y el filtro aplicado", () => {
    const documento = crearDocumentoPdfClientes([cliente], "María");
    const contenido = documento.output();

    expect(contenido).toContain("%PDF-");
    expect(documento.getNumberOfPages()).toBe(1);
  });
});
