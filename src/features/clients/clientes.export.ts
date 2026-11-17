import { strToU8, zipSync } from "fflate";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import type { Cliente } from "@/types/dominio";

const ENCABEZADOS = [
  "Cliente",
  "Documento",
  "Correo",
  "Teléfono",
  "WhatsApp",
  "Ciudad",
  "Barrio",
  "Departamento",
  "Mascotas",
  "Estado",
];

function filasClientes(clientes: Cliente[]): (string | number)[][] {
  return clientes.map((cliente) => [
    cliente.nombreCompleto,
    cliente.documento,
    cliente.email ?? "",
    cliente.telefono ?? "",
    cliente.whatsapp ?? "",
    cliente.ciudad ?? "",
    cliente.barrio ?? "",
    cliente.departamento ?? "",
    cliente._count?.pacientes ?? 0,
    cliente.activo ? "Activo" : "Inactivo",
  ]);
}

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function referenciaColumna(indice: number): string {
  let valor = indice + 1;
  let columna = "";

  while (valor > 0) {
    const resto = (valor - 1) % 26;
    columna = String.fromCharCode(65 + resto) + columna;
    valor = Math.floor((valor - 1) / 26);
  }

  return columna;
}

export function crearLibroExcelClientes(clientes: Cliente[]): Uint8Array {
  const filas = [ENCABEZADOS, ...filasClientes(clientes)];
  const filasXml = filas
    .map((fila, indiceFila) => {
      const numeroFila = indiceFila + 1;
      const celdas = fila
        .map((valor, indiceColumna) => {
          const referencia = `${referenciaColumna(indiceColumna)}${numeroFila}`;

          if (typeof valor === "number") {
            return `<c r="${referencia}"><v>${valor}</v></c>`;
          }

          return `<c r="${referencia}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
        })
        .join("");

      return `<row r="${numeroFila}">${celdas}</row>`;
    })
    .join("");
  const ultimaCelda = `${referenciaColumna(ENCABEZADOS.length - 1)}${filas.length}`;
  const contenidoTipos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

  return zipSync({
    "[Content_Types].xml": strToU8(contenidoTipos),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clientes" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${filasXml}</sheetData><autoFilter ref="A1:${ultimaCelda}"/></worksheet>`,
    ),
  });
}

function nombreArchivo(extension: "xlsx" | "pdf"): string {
  return `clientes-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function descargarClientesExcel(clientes: Cliente[]): void {
  const archivo = crearLibroExcelClientes(clientes);
  const contenido = new Uint8Array(archivo).buffer;
  const blob = new Blob([contenido], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo("xlsx");
  enlace.click();
  URL.revokeObjectURL(url);
}

export function descargarClientesPdf(clientes: Cliente[], busqueda = ""): void {
  crearDocumentoPdfClientes(clientes, busqueda).save(nombreArchivo("pdf"));
}

export function crearDocumentoPdfClientes(
  clientes: Cliente[],
  busqueda = "",
): jsPDF {
  const documento = new jsPDF({ orientation: "landscape" });
  documento.setFontSize(16);
  documento.text("Listado de clientes", 14, 16);
  documento.setFontSize(9);
  documento.text(
    busqueda.trim()
      ? `Filtro de búsqueda: ${busqueda.trim()} · Total: ${clientes.length}`
      : `Total: ${clientes.length} clientes`,
    14,
    23,
  );

  autoTable(documento, {
    head: [ENCABEZADOS],
    body: filasClientes(clientes),
    startY: 29,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 99, 82] },
    alternateRowStyles: { fillColor: [245, 247, 246] },
    margin: { left: 14, right: 14 },
  });

  return documento;
}
