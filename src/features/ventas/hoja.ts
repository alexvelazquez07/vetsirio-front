import { jsPDF } from "jspdf";

import {
  tamanoHoja,
  type ConfiguracionImpresion,
  type TamanoHojaInfo,
} from "@/features/settings/impresion";
import {
  formatCantidad,
  formatFechaCalendario,
  formatHora,
  formatMilesimas,
  formatMonedaUSD,
} from "@/lib/formato";
import { urlDeArchivo } from "@/services/api";
import {
  ETIQUETAS_METODO,
  tituloComprobante,
  type TicketOrganizacion,
  type TicketVentaDatos,
} from "./ticket";

/* ─────────────────────────────── Tipos y colores ─────────────────────────────── */

type RGB = [number, number, number];

const MARGEN = 36;
const MARGEN_COMPACTO = 28;
const LADO_LOGO = 54;
const LADO_LOGO_COMPACTO = 46;
const ANCHO_TOTALES = 220;

const COLOR_MARCA_DEFECTO: RGB = [13, 158, 135];
const TINTA: RGB = [23, 32, 42];
const TINTA_SUAVE: RGB = [100, 110, 125];
const LINEA: RGB = [219, 224, 230];
const FONDO_SUAVE: RGB = [246, 248, 250];
const BLANCO: RGB = [255, 255, 255];

interface LogoListo {
  dataUrl: string;
  ancho: number;
  alto: number;
}

interface Contexto {
  doc: jsPDF;
  datos: TicketVentaDatos;
  organizacion: TicketOrganizacion;
  configuracion: ConfiguracionImpresion;
  logo: LogoListo | null;
  hoja: TamanoHojaInfo;
  ancho: number;
  alto: number;
  limite: number;
  util: number;
  margen: number;
  compacto: boolean;
  /** Inicio y alto de la zona donde se dibuja la copia actual. */
  zonaBase: number;
  zonaAlto: number;
  color: RGB;
  colorSobreMarca: RGB;
}

/* ───────────────────────────── Datos y utilidades ───────────────────────────── */

function limpio(valor: unknown): string {
  return String(valor ?? "").trim();
}

function tieneValor(valor: unknown): boolean {
  return valor !== null && valor !== undefined && String(valor).trim().length > 0;
}

function unir(partes: unknown[], separador = " · "): string {
  return partes.map(limpio).filter(Boolean).join(separador);
}

function esVerdadero(valor: string | number | null | undefined): boolean {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) && Math.abs(numero) > 0.004;
}

function dinero(
  moneda: string,
  valor: string | number | null | undefined,
): string {
  // jsPDF usa fuentes WinAnsi y no tiene el glifo del guaraní (₲): en el PDF
  // se imprime como "Gs.", que es la forma habitual en Paraguay.
  if (moneda === "USD") return formatMonedaUSD(valor);
  const miles = formatMilesimas(valor);
  return miles ? `Gs. ${miles}` : "";
}

/** Reemplaza símbolos que las fuentes del PDF no pueden dibujar. */
function textoPdf(valor: unknown): string {
  return String(valor ?? "").replace(/₲/g, "Gs.");
}

function colorDesdeHex(hex: string | null | undefined): RGB {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex.trim())) return COLOR_MARCA_DEFECTO;
  const valor = hex.trim().slice(1);
  return [
    parseInt(valor.slice(0, 2), 16),
    parseInt(valor.slice(2, 4), 16),
    parseInt(valor.slice(4, 6), 16),
  ];
}

function luminancia([r, g, b]: RGB): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function colorSobre(color: RGB): RGB {
  return luminancia(color) > 0.62 ? TINTA : BLANCO;
}

/** Recorta un texto con puntos suspensivos para que entre en una celda. */
function recortar(doc: jsPDF, texto: string, ancho: number): string {
  const limpio = textoPdf(texto);
  if (doc.getTextWidth(limpio) <= ancho) return limpio;
  let recortado = limpio;
  while (recortado.length > 1 && doc.getTextWidth(`${recortado}…`) > ancho) {
    recortado = recortado.slice(0, -1);
  }
  return `${recortado}…`;
}

function lineasNegocio(organizacion: TicketOrganizacion): string[] {
  const lineas: string[] = [];
  if (
    organizacion.razonSocial &&
    organizacion.razonSocial !== organizacion.nombre
  ) {
    lineas.push(organizacion.razonSocial);
  }
  if (organizacion.ruc) lineas.push(`RUC ${organizacion.ruc}`);
  if (organizacion.direccion) lineas.push(organizacion.direccion);

  const contacto = unir([
    organizacion.telefono ? `Tel. ${organizacion.telefono}` : "",
    organizacion.email,
  ]);
  if (contacto) lineas.push(contacto);

  return lineas;
}

function filasComprobante(
  datos: TicketVentaDatos,
  organizacion: TicketOrganizacion,
  configuracion: ConfiguracionImpresion,
): [string, string][] {
  if (!configuracion.mostrarDatosFiscales) return [];

  const filas: [string, string][] = [
    ["Comprobante", datos.numeroComprobante],
    [
      "Fecha",
      `${formatFechaCalendario(datos.fechaEmision)} ${formatHora(datos.fechaEmision)}`,
    ],
  ];

  if (datos.timbrado) filas.push(["Timbrado", datos.timbrado]);
  if (datos.timbrado && organizacion.timbradoVencimiento) {
    filas.push([
      "Vto. timbrado",
      formatFechaCalendario(organizacion.timbradoVencimiento),
    ]);
  }
  if (datos.establecimiento || datos.puntoExpedicion) {
    filas.push([
      "Establecimiento",
      `${datos.establecimiento ?? "001"}-${datos.puntoExpedicion ?? "001"}`,
    ]);
  }
  if (datos.condicionPago) {
    filas.push([
      "Condición",
      datos.condicionPago === "credito" ? "Crédito" : "Contado",
    ]);
  }
  if (configuracion.mostrarVendedor && datos.vendedor) {
    filas.push(["Vendedor", datos.vendedor]);
  }

  return filas;
}

/* ─────────────────────────────────── Logo ─────────────────────────────────── */

/**
 * Descarga el logo y lo convierte a PNG con un canvas. Igual que en las fichas
 * de consulta: así acepta WEBP, AVIF o GIF aunque jsPDF no los entienda.
 */
async function cargarLogo(url?: string | null): Promise<LogoListo | null> {
  if (!url) return null;
  const urlResuelta = urlDeArchivo(url);
  if (!urlResuelta) return null;

  let urlLocal = "";
  try {
    const respuesta = await fetch(urlResuelta);
    if (!respuesta.ok) return null;
    urlLocal = URL.createObjectURL(await respuesta.blob());

    const imagen = await new Promise<HTMLImageElement>((resolver, rechazar) => {
      const elemento = new Image();
      elemento.onload = () => resolver(elemento);
      elemento.onerror = () => rechazar(new Error("No se pudo leer el logo."));
      elemento.src = urlLocal;
    });

    const maximo = 512;
    const escala = Math.min(
      1,
      maximo / Math.max(imagen.naturalWidth, imagen.naturalHeight),
    );
    const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
    const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const contexto = lienzo.getContext("2d");
    if (!contexto) return null;
    contexto.drawImage(imagen, 0, 0, ancho, alto);

    return { dataUrl: lienzo.toDataURL("image/png"), ancho, alto };
  } catch {
    return null;
  } finally {
    if (urlLocal) URL.revokeObjectURL(urlLocal);
  }
}

/* ─────────────────────────────── Documento PDF ─────────────────────────────── */

/**
 * Genera el comprobante en PDF para el modo autoimpresor de hoja completa.
 *
 * Se dibuja con jsPDF (no con HTML) porque el resultado tiene que ser un PDF
 * real: se imprime igual en cualquier impresora y se puede archivar o enviar.
 * La vista previa de la configuración muestra este mismo PDF, así que lo que
 * se ve en pantalla es exactamente lo que sale en papel.
 */
export async function crearDocumentoHoja(
  datos: TicketVentaDatos,
  organizacion: TicketOrganizacion,
  configuracion: ConfiguracionImpresion,
): Promise<jsPDF> {
  const hoja = tamanoHoja(configuracion.tamanoHoja);
  const doc = new jsPDF({ unit: "pt", format: hoja.jsPdf, orientation: "portrait" });
  const logo = configuracion.mostrarLogo
    ? await cargarLogo(organizacion.logoUrl)
    : null;

  const color = colorDesdeHex(organizacion.colorPrimario);
  const copias = Math.min(
    3,
    Math.max(1, Math.trunc(Number(configuracion.copias) || 1)),
  );
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();
  const compacto = configuracion.mediaHoja;
  const margen = compacto ? MARGEN_COMPACTO : MARGEN;

  const contexto: Contexto = {
    doc,
    datos,
    organizacion,
    configuracion,
    logo,
    hoja,
    ancho,
    alto,
    limite: alto - margen,
    util: ancho - margen * 2,
    margen,
    compacto,
    zonaBase: 0,
    zonaAlto: alto,
    color,
    colorSobreMarca: colorSobre(color),
  };

  doc.setProperties({
    title: `Comprobante ${datos.numeroComprobante}`,
    subject: `Comprobante de venta ${datos.numeroComprobante}`,
    author: organizacion.nombre || "Veterinaria",
    creator: "VetSirio",
  });

  for (let copia = 0; copia < copias; copia += 1) {
    if (copia > 0) doc.addPage(hoja.jsPdf, "portrait");
    dibujarPagina(contexto);
  }

  return doc;
}

/**
 * Dibuja una página completa. En media hoja la página se divide en dos zonas:
 * la superior para el original y, si está activado el duplicado, la inferior
 * para una copia idéntica.
 */
function dibujarPagina(ctx: Contexto): void {
  if (!ctx.configuracion.mediaHoja) {
    dibujarCopia(ctx, 0, ctx.alto, null);
    return;
  }

  const zona = ctx.alto / 2;
  if (ctx.configuracion.duplicadoMediaHoja) {
    dibujarCopia(ctx, 0, zona, "ORIGINAL");
    dibujarCopia(ctx, zona, zona, "DUPLICADO");
    dibujarLineaCorte(ctx, zona);
    return;
  }

  dibujarCopia(ctx, 0, zona, null);
  dibujarLineaCorte(ctx, zona);
}

/** Dibuja un comprobante dentro de la zona indicada de la página. */
function dibujarCopia(
  ctx: Contexto,
  base: number,
  zona: number,
  etiquetaCopia: string | null,
): void {
  const { doc, datos, organizacion, configuracion, ancho, margen } = ctx;
  const compacto = ctx.compacto;

  ctx.zonaBase = base;
  ctx.zonaAlto = zona;
  ctx.limite = base + zona - (compacto ? 8 : margen);

  // Barra de marca al inicio de cada copia. En el duplicado también separa
  // visualmente la mitad superior de la inferior.
  doc.setFillColor(...ctx.color);
  doc.rect(0, base, ancho, compacto ? 4 : 5, "F");

  let y = base + margen + (compacto ? 3 : 4);
  y = dibujarCabecera(ctx, y) + (compacto ? 8 : 18);

  // Cliente y datos fiscales van en una sola banda compacta; el título del
  // comprobante queda dentro de la banda, a la derecha.
  const filas = filasComprobante(datos, organizacion, configuracion);
  y = dibujarFicha(ctx, y, filas, etiquetaCopia) + (compacto ? 8 : 16);

  y = dibujarItems(ctx, y);
  y = dibujarTotalesYPagos(ctx, y);
  dibujarPie(ctx, y);

  if (datos.estado === "ANULADA") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(compacto ? 44 : 64);
    doc.setTextColor(225, 175, 175);
    doc.text("ANULADA", ancho / 2, base + zona / 2 + (compacto ? 0 : 20), {
      align: "center",
      angle: 28,
    });
  }
}

/** Línea punteada para cortar la hoja entre los dos comprobantes. */
function dibujarLineaCorte(ctx: Contexto, yCorte: number): void {
  const { doc, ancho, margen } = ctx;

  doc.setDrawColor(...TINTA_SUAVE);
  doc.setLineWidth(0.7);
  doc.setLineDashPattern([5, 4], 0);
  doc.line(margen, yCorte, ancho - margen, yCorte);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...TINTA_SUAVE);
  doc.text("corte", ancho / 2, yCorte - 4, { align: "center" });
}

/** Cabecera con el negocio a la izquierda y el logo a la derecha. */
function dibujarCabecera(ctx: Contexto, yInicio: number): number {
  const { doc, organizacion, margen } = ctx;
  const compacto = ctx.compacto;
  const lado = compacto ? LADO_LOGO_COMPACTO : LADO_LOGO;
  const ladoLogo = ctx.logo ? lado : 0;
  const anchoTexto = ctx.util - (ladoLogo ? ladoLogo + 20 : 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(compacto ? 13.5 : 16);
  doc.setTextColor(...TINTA);

  const nombre = textoPdf(limpio(organizacion.nombre) || "Veterinaria");
  const lineasNombre = (
    doc.splitTextToSize(nombre, anchoTexto) as string[]
  ).slice(0, 2);

  const altoNombre = compacto ? 12.5 : 15;

  let y = yInicio;
  for (const linea of lineasNombre) {
    y += altoNombre;
    doc.text(linea, margen, y);
  }
  y += compacto ? 1.5 : 3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(compacto ? 7.2 : 8.4);
  doc.setTextColor(...TINTA_SUAVE);

  const lineasInfo: string[] = [];
  for (const linea of lineasNegocio(organizacion)) {
    lineasInfo.push(
      ...(doc.splitTextToSize(textoPdf(linea), anchoTexto) as string[]),
    );
  }
  for (const linea of lineasInfo) {
    y += compacto ? 8.8 : 11;
    doc.text(linea, margen, y);
  }

  const altoTexto = y - yInicio;
  const altoCabecera = Math.max(altoTexto, ladoLogo);

  if (ctx.logo) {
    const x = ctx.ancho - margen - lado;
    const yLogo = yInicio;
    doc.setFillColor(...FONDO_SUAVE);
    doc.roundedRect(x, yLogo, lado, lado, 7, 7, "F");

    const interior = lado - 8;
    const escala = Math.min(
      interior / ctx.logo.ancho,
      interior / ctx.logo.alto,
    );
    const ancho = ctx.logo.ancho * escala;
    const alto = ctx.logo.alto * escala;
    doc.addImage(
      ctx.logo.dataUrl,
      "PNG",
      x + (lado - ancho) / 2,
      yLogo + (lado - alto) / 2,
      ancho,
      alto,
    );
  }

  const yLinea = yInicio + altoCabecera + (compacto ? 4 : 8);
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.8);
  doc.line(margen, yLinea, ctx.ancho - margen, yLinea);

  return yLinea;
}

/**
 * Banda compacta con el cliente y los datos del comprobante.
 *
 * Antes eran dos cajas grandes con bastante aire. Acá el cliente va a la
 * izquierda y los datos fiscales se reparten en dos columnas a la derecha, así
 * la ficha ocupa la mitad de alto y deja más lugar para los ítems.
 */
function dibujarFicha(
  ctx: Contexto,
  y: number,
  filas: [string, string][],
  etiquetaCopia: string | null,
): number {
  const { doc, datos, configuracion, util, margen } = ctx;
  const compacto = ctx.compacto;

  const mostrarCliente = configuracion.mostrarCliente && !!datos.cliente;
  const nombre = mostrarCliente
    ? textoPdf(limpio(datos.cliente?.nombre))
    : "";
  const documento =
    mostrarCliente &&
    configuracion.mostrarDocumentoCliente &&
    tieneValor(datos.cliente?.documento)
      ? textoPdf(`RUC / C.I. ${limpio(datos.cliente?.documento)}`)
      : "";

  // Sin cliente ni datos fiscales al menos queda el título del comprobante.
  if (!mostrarCliente && filas.length === 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(compacto ? 11 : 13);
    doc.setTextColor(...ctx.color);
    const titulo = tituloComprobante(datos);
    doc.text(
      etiquetaCopia ? `${titulo} · ${etiquetaCopia}` : titulo,
      margen,
      y + (compacto ? 9 : 12),
    );
    return y + (compacto ? 16 : 22);
  }

  const hayFiscal = filas.length > 0;
  const separacion = compacto ? 12 : 16;
  const anchoCliente = mostrarCliente && hayFiscal ? util * 0.4 : util;
  const xFiscal =
    margen + (mostrarCliente && hayFiscal ? anchoCliente + separacion : 0);
  const anchoFiscal = hayFiscal
    ? util - (mostrarCliente && hayFiscal ? anchoCliente + separacion : 0)
    : 0;

  // Los datos fiscales se parten en dos columnas para ganar alto.
  const mitad = Math.ceil(filas.length / 2);
  const columnas = hayFiscal
    ? [filas.slice(0, mitad), filas.slice(mitad)]
    : [[], []];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(compacto ? 9.4 : 10);
  const lineasNombre = nombre
    ? (doc.splitTextToSize(nombre, anchoCliente - 20) as string[]).slice(0, 2)
    : [];

  const filaAlto = compacto ? 10 : 12.5;
  const altoEtiqueta = compacto ? 12 : 15;
  const relleno = compacto ? 6 : 9;
  const altoNombre = lineasNombre.length * (compacto ? 10.5 : 12);
  const altoDocumento = documento ? (compacto ? 9.5 : 12) : 0;
  const altoContenido = Math.max(
    altoNombre + altoDocumento,
    Math.max(columnas[0].length, columnas[1].length) * filaAlto,
    10,
  );
  const altoBanda = altoEtiqueta + altoContenido + relleno;

  const radio = compacto ? 5 : 6;
  doc.setFillColor(...FONDO_SUAVE);
  doc.roundedRect(margen, y, util, altoBanda, radio, radio, "F");
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.7);
  doc.roundedRect(margen, y, util, altoBanda, radio, radio, "S");

  // Etiqueta de la izquierda y título del comprobante a la derecha.
  const yEtiqueta = y + (compacto ? 10 : 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(compacto ? 6.6 : 7);
  doc.setTextColor(...TINTA_SUAVE);
  if (mostrarCliente) doc.text("CLIENTE", margen + 10, yEtiqueta);

  doc.setFontSize(compacto ? 8.4 : 9);
  doc.setTextColor(...ctx.color);
  const titulo = tituloComprobante(datos);
  doc.text(etiquetaCopia ? `${titulo} · ${etiquetaCopia}` : titulo, margen + util - 10, yEtiqueta, {
    align: "right",
  });

  let yCliente = y + altoEtiqueta + (compacto ? 7.5 : 9);
  if (lineasNombre.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(compacto ? 9.4 : 10);
    doc.setTextColor(...TINTA);
    for (const linea of lineasNombre) {
      doc.text(linea, margen + 10, yCliente);
      yCliente += compacto ? 10.5 : 12;
    }
  }

  if (documento) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(compacto ? 7.6 : 8);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text(documento, margen + 10, yCliente);
  }

  if (hayFiscal) {
    // Separador vertical entre el cliente y los datos fiscales.
    if (mostrarCliente) {
      doc.setDrawColor(...LINEA);
      doc.setLineWidth(0.6);
      doc.line(
        margen + anchoCliente + 2,
        y + altoEtiqueta - 2,
        margen + anchoCliente + 2,
        y + altoBanda - relleno + 2,
      );
    }

    // 10 pt de respiro a la derecha para que los valores no toquen el borde.
    const anchoColumna = (anchoFiscal - separacion - 10) / 2;
    const yBase = y + altoEtiqueta + (compacto ? 6.5 : 8);

    columnas.forEach((columna, indice) => {
      const x = xFiscal + indice * (anchoColumna + separacion);
      let yFila = yBase;

      for (const [etiqueta, valor] of columna) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(compacto ? 6.6 : 7);
        doc.setTextColor(...TINTA_SUAVE);
        doc.text(etiqueta, x, yFila);
        const anchoEtiqueta = doc.getTextWidth(etiqueta);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(compacto ? 7.4 : 7.8);
        doc.setTextColor(...TINTA);
        doc.text(
          recortar(doc, valor, anchoColumna - anchoEtiqueta - 6),
          x + anchoColumna,
          yFila,
          { align: "right" },
        );

        yFila += filaAlto;
      }
    });
  }

  return y + altoBanda;
}

function dibujarItems(ctx: Contexto, yInicio: number): number {
  const { doc, datos, margen } = ctx;
  const compacto = ctx.compacto;
  const anchoCantidad = 42;
  const anchoUnitario = 82;
  const anchoTotal = 82;
  const anchoDescripcion =
    ctx.util - anchoCantidad - anchoUnitario - anchoTotal;
  const altoEncabezado = compacto ? 14 : 22;
  const totalFilas = datos.items.length;

  // El alto de cada fila se calcula con el espacio que sobra después de
  // reservar totales y pie. Así una venta de 10 ítems entra en media hoja sin
  // empujar el total fuera de la zona.
  const reserva = reservaInferior(ctx);
  const disponible = Math.max(
    0,
    ctx.limite - yInicio - altoEncabezado - reserva,
  );
  const altoBase = totalFilas
    ? Math.max(
        compacto ? 12 : 15,
        Math.min(compacto ? 17 : 20, disponible / totalFilas),
      )
    : compacto
      ? 17
      : 20;
  const interlineado = Math.max(8.5, altoBase - 3.5);
  const baseTexto = Math.min(altoBase - 4, compacto ? 10 : 12);

  let y = yInicio;

  const encabezado = () => {
    doc.setFillColor(...ctx.color);
    doc.rect(margen, y, ctx.util, altoEncabezado, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(compacto ? 7.4 : 8);
    doc.setTextColor(...ctx.colorSobreMarca);
    const baseTitulo = y + (compacto ? 11 : 14);
    doc.text("Cant.", margen + 8, baseTitulo);
    doc.text("Descripción", margen + anchoCantidad + 8, baseTitulo);
    doc.text(
      "P. unitario",
      margen + anchoCantidad + anchoDescripcion + anchoUnitario - 8,
      baseTitulo,
      { align: "right" },
    );
    doc.text("Total", margen + ctx.util - 8, baseTitulo, {
      align: "right",
    });

    y += altoEncabezado;
  };

  encabezado();

  if (totalFilas === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(compacto ? 8.2 : 8.8);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text("Sin ítems", margen + 8, y + baseTexto);
    y += compacto ? 18 : 24;
  }

  datos.items.forEach((item, indice) => {
    const cantidad = Number(item.cantidad) || 1;
    const unitario =
      item.precioUnitario ?? (Number(item.total) || 0) / cantidad;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(compacto ? 8.2 : 8.8);
    // En media hoja con muchos ítems la descripción va en una sola línea: así
    // una venta de 10 líneas no empuja los totales fuera de la mitad de la hoja.
    const maxLineas = compacto ? (totalFilas > 5 ? 1 : 2) : 3;
    let lineas = (
      doc.splitTextToSize(
        textoPdf(item.descripcion),
        anchoDescripcion - 12,
      ) as string[]
    ).slice(0, maxLineas);
    if (maxLineas === 1 && lineas.length === 1) {
      lineas = [recortar(doc, lineas[0], anchoDescripcion - 12)];
    }
    const altoFila =
      lineas.length <= 1
        ? altoBase
        : Math.max(
            altoBase,
            lineas.length * interlineado + (compacto ? 4 : 6),
          );

    if (y + altoFila > ctx.limite && !ctx.configuracion.mediaHoja) {
      doc.addPage(ctx.hoja.jsPdf, "portrait");
      y = ctx.margen;
      encabezado();
    }

    if (indice % 2 === 1) {
      doc.setFillColor(...FONDO_SUAVE);
      doc.rect(margen, y, ctx.util, altoFila, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(compacto ? 8.2 : 8.8);
    doc.setTextColor(...TINTA);
    doc.text(formatCantidad(item.cantidad), margen + 8, y + baseTexto);
    doc.text(lineas, margen + anchoCantidad + 8, y + baseTexto);
    doc.text(
      dinero(datos.moneda, unitario),
      margen + anchoCantidad + anchoDescripcion + anchoUnitario - 8,
      y + baseTexto,
      { align: "right" },
    );
    doc.text(
      dinero(datos.moneda, item.total),
      margen + ctx.util - 8,
      y + baseTexto,
      { align: "right" },
    );

    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.5);
    doc.line(margen, y + altoFila, margen + ctx.util, y + altoFila);

    y += altoFila;
  });

  return y;
}

/** Medidas compartidas entre el layout de ítems y el bloque de totales. */
function medidasTotales(ctx: Contexto) {
  const { datos, configuracion } = ctx;
  const compacto = ctx.compacto;

  const filas: [string, string][] = [];
  if (configuracion.mostrarDesgloseIva) {
    if (esVerdadero(datos.subtotal)) {
      filas.push(["Subtotal", dinero(datos.moneda, datos.subtotal)]);
    }
    if (esVerdadero(datos.iva5)) {
      filas.push(["IVA 5 %", dinero(datos.moneda, datos.iva5)]);
    }
    if (esVerdadero(datos.iva10)) {
      filas.push(["IVA 10 %", dinero(datos.moneda, datos.iva10)]);
    }
    if (esVerdadero(datos.exenta)) {
      filas.push(["Exenta", dinero(datos.moneda, datos.exenta)]);
    }
  }

  const pagos =
    configuracion.mostrarPagos && datos.pagos ? datos.pagos : [];

  const filaAlto = compacto ? 11 : 14;
  const altoCaja = compacto ? 26 : 34;
  const altoTotales = filas.length * filaAlto + altoCaja;
  const altoPagos = pagos.length
    ? (compacto ? 16 : 22) + pagos.length * filaAlto
    : 0;

  return {
    filas,
    pagos,
    filaAlto,
    altoCaja,
    altoPagos,
    altoBloque: Math.max(altoTotales, altoPagos),
  };
}

/** Espacio que hay que dejar libre debajo de los ítems. */
function reservaInferior(ctx: Contexto): number {
  const { altoBloque } = medidasTotales(ctx);
  const compacto = ctx.compacto;
  const conMensaje = ctx.configuracion.mensajePie.trim().length > 0;
  return (
    altoBloque +
    (compacto ? 34 : 52) +
    (conMensaje ? (compacto ? 10 : 15) : 0)
  );
}

function dibujarTotalesYPagos(ctx: Contexto, yInicio: number): number {
  const { doc, datos, margen } = ctx;
  const compacto = ctx.compacto;
  const { filas, pagos, filaAlto, altoCaja, altoBloque } =
    medidasTotales(ctx);

  const xTotales = ctx.ancho - margen - ANCHO_TOTALES;

  let y = yInicio + (compacto ? 8 : 14);
  if (y + altoBloque > ctx.limite && !ctx.configuracion.mediaHoja) {
    doc.addPage(ctx.hoja.jsPdf, "portrait");
    y = ctx.margen;
  }

  if (pagos.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text("PAGOS", margen, y + 8);

    let yPago = y + (compacto ? 16 : 22);
    for (const pago of pagos) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(compacto ? 8 : 8.6);
      doc.setTextColor(...TINTA_SUAVE);
      doc.text(
        textoPdf(ETIQUETAS_METODO[pago.metodo] ?? pago.metodo),
        margen,
        yPago,
      );

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...TINTA);
      doc.text(
        dinero(datos.moneda, pago.monto),
        xTotales - 20,
        yPago,
        { align: "right" },
      );
      yPago += filaAlto;
    }
  }

  let yTotal = y + 8;
  for (const [etiqueta, valor] of filas) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(compacto ? 8.2 : 8.8);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text(etiqueta, xTotales, yTotal);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TINTA);
    doc.text(valor, ctx.ancho - margen, yTotal, { align: "right" });
    yTotal += filaAlto;
  }

  doc.setFillColor(...ctx.color);
  doc.roundedRect(xTotales, yTotal - 7, ANCHO_TOTALES, altoCaja, 4, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(compacto ? 9.4 : 10);
  doc.setTextColor(...ctx.colorSobreMarca);
  doc.text("TOTAL", xTotales + 10, yTotal + (compacto ? 6.5 : 8));

  doc.setFontSize(compacto ? 10.6 : 11.5);
  doc.text(
    dinero(datos.moneda, datos.total),
    ctx.ancho - margen - 10,
    yTotal + (compacto ? 6.5 : 8),
    { align: "right" },
  );

  return yTotal + altoCaja;
}

function dibujarPie(ctx: Contexto, yInicio: number): void {
  const { doc, datos, configuracion, util } = ctx;
  const compacto = ctx.compacto;
  const mensaje = configuracion.mensajePie.trim();
  const esTicket = tituloComprobante(datos) === "TICKET DE VENTA";

  const altoPie =
    (mensaje ? 14 : 0) + (esTicket ? 12 : 0) + (mensaje ? 0 : 4);
  let y = yInicio + (compacto ? 8 : 16);

  if (y + altoPie > ctx.limite && !ctx.configuracion.mediaHoja) {
    doc.addPage(ctx.hoja.jsPdf, "portrait");
    y = ctx.margen;
  }

  if (mensaje) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(compacto ? 8 : 8.6);
    doc.setTextColor(...TINTA_SUAVE);
    const lineas = doc.splitTextToSize(
      textoPdf(mensaje),
      util,
    ) as string[];
    doc.text(lineas, ctx.ancho / 2, y, { align: "center" });
    y += lineas.length * (compacto ? 10 : 11);
  }

  if (esTicket) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text("Documento no válido como factura", ctx.ancho / 2, y + 6, {
      align: "center",
    });
  }
}

/* ─────────────────────────────── API pública ─────────────────────────────── */

/** Genera el PDF y abre el diálogo de impresión del navegador. */
export async function imprimirHoja(
  datos: TicketVentaDatos,
  organizacion: TicketOrganizacion,
  configuracion: ConfiguracionImpresion,
): Promise<void> {
  const pdf = await crearDocumentoHoja(datos, organizacion, configuracion);
  imprimirPdf(pdf.output("blob"));
}

/** Genera y descarga el PDF, para archivar o enviar por correo. */
export async function descargarHoja(
  datos: TicketVentaDatos,
  organizacion: TicketOrganizacion,
  configuracion: ConfiguracionImpresion,
): Promise<void> {
  const pdf = await crearDocumentoHoja(datos, organizacion, configuracion);
  const nombre = (datos.numeroComprobante || "comprobante")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  pdf.save(`${nombre || "comprobante"}.pdf`);
}

/**
 * Imprime un PDF con un iframe oculto. Además del ticket térmico, el modo
 * autoimpresor tiene que imprimir sin abrir una pestaña nueva.
 */
function imprimirPdf(blob: Blob): void {
  if (typeof document === "undefined") return;

  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";

  const limpiar = () => {
    window.setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };

  iframe.onload = () => {
    window.setTimeout(() => {
      try {
        const ventana = iframe.contentWindow;
        if (!ventana) throw new Error("No se pudo abrir el PDF para imprimir.");
        ventana.focus();
        ventana.print();
      } catch {
        // Si el visor del PDF bloquea la impresión, se abre en una pestaña
        // para que el usuario pueda imprimirlo desde ahí.
        window.open(url, "_blank", "noopener,noreferrer");
      } finally {
        limpiar();
      }
    }, 350);
  };

  iframe.src = `${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
  document.body.appendChild(iframe);
}
