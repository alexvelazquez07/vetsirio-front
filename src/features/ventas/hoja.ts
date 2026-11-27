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
  type TicketItemDatos,
  type TicketOrganizacion,
  type TicketVentaDatos,
} from "./ticket";

/* ─────────────────────────────── Tipos y estilos ─────────────────────────────── */

type RGB = [number, number, number];

const MARGEN = 36;
const MARGEN_COMPACTO = 28;
const LADO_LOGO = 60;
const LADO_LOGO_COMPACTO = 38;
const ANCHO_TOTALES = 220;

/**
 * El comprobante de hoja completa es monocromático: sólo el logo conserva sus
 * colores. Todo lo demás se dibuja en negro, gris y blanco para que se vea
 * igual en cualquier impresora, incluso en las que sólo imprimen en escala de
 * grises. No hay rellenos: la jerarquía se logra con grosor de líneas,
 * tipografía y espacios.
 */
const NEGRO: RGB = [0, 0, 0];
const TINTA_SUAVE: RGB = [85, 85, 85];
const LINEA_SUAVE: RGB = [170, 170, 170];

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

/* ─────────────────────────────── Número a letras ─────────────────────────────── */

const UNIDADES = [
  "", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho",
  "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis",
  "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós",
  "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete",
  "veintiocho", "veintinueve",
];
const DECENAS = [
  "", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta",
  "ochenta", "noventa",
];
const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

function menorQueMil(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (centena) partes.push(CENTENAS[centena]);
  if (resto) {
    if (resto < 30) {
      partes.push(UNIDADES[resto]);
    } else {
      const decena = Math.floor(resto / 10);
      const unidad = resto % 10;
      partes.push(
        unidad ? `${DECENAS[decena]} y ${UNIDADES[unidad]}` : DECENAS[decena],
      );
    }
  }
  return partes.join(" ");
}

/** "uno" → "un" y "veintiuno" → "veintiún" cuando precede a "mil"/"millones". */
function apocopar(texto: string): string {
  if (texto.endsWith("veintiuno")) return `${texto.slice(0, -9)}veintiún`;
  if (texto.endsWith("uno")) return `${texto.slice(0, -1)}`;
  return texto;
}

function enteroALetras(n: number): string {
  if (n === 0) return "cero";
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];

  if (millones) {
    partes.push(
      millones === 1
        ? "un millón"
        : `${apocopar(enteroALetras(millones))} millones`,
    );
  }
  if (miles) {
    partes.push(miles === 1 ? "mil" : `${apocopar(menorQueMil(miles))} mil`);
  }
  if (resto) partes.push(menorQueMil(resto));
  return partes.join(" ");
}

function totalEnLetras(moneda: string, valor: unknown): string {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || numero >= 1e12) return "";

  const capitalizar = (texto: string) =>
    texto.charAt(0).toUpperCase() + texto.slice(1);

  if (moneda === "USD") {
    const centavosTotales = Math.round(numero * 100);
    const enteros = Math.floor(centavosTotales / 100);
    const centavos = String(centavosTotales % 100).padStart(2, "0");
    return `Dólares americanos ${enteroALetras(enteros)} con ${centavos}/100.-`;
  }

  const guaranies = Math.round(numero);
  return `Guaraníes ${capitalizar(enteroALetras(guaranies))}.-`;
}

/* ───────────────────────────── Datos del comprobante ───────────────────────────── */

function lineasNegocio(organizacion: TicketOrganizacion): string[] {
  const lineas: string[] = [];

  if (
    organizacion.razonSocial &&
    organizacion.razonSocial !== organizacion.nombre
  ) {
    lineas.push(`Razón social: ${organizacion.razonSocial}`);
  }
  if (organizacion.ruc) lineas.push(`RUC: ${organizacion.ruc}`);
  if (organizacion.actividadEconomica) {
    lineas.push(`Actividad económica: ${organizacion.actividadEconomica}`);
  }
  if (organizacion.nombreRepresentante) {
    lineas.push(`de ${organizacion.nombreRepresentante}`);
  }
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

/**
 * Alícuota de la línea. Las ventas reales traen `porcentajeIva`; para datos de
 * ejemplo o ventas viejas se deduce de los totales del comprobante.
 */
function tasaItem(item: TicketItemDatos, datos: TicketVentaDatos): 0 | 5 | 10 {
  if (item.porcentajeIva !== null && item.porcentajeIva !== undefined) {
    const valor = Number(item.porcentajeIva);
    if (valor === 5) return 5;
    if (valor === 10) return 10;
    if (valor === 0) return 0;
  }

  const hayIva5 = esVerdadero(datos.iva5);
  const hayIva10 = esVerdadero(datos.iva10);
  const hayExenta = esVerdadero(datos.exenta);

  if (hayExenta && !hayIva5 && !hayIva10) return 0;
  if (hayIva5 && !hayIva10) return 5;
  if (hayIva10) return 10;
  return 0;
}

/* ─────────────────────────── Helpers de texto etiquetado ─────────────────────────── */

/**
 * Dibuja "Etiqueta: valor" alineado a la izquierda en `x`, con la etiqueta en
 * gris y el valor en negrita negra. Recorta el valor si no entra.
 */
function campo(
  doc: jsPDF,
  etiqueta: string,
  valor: string,
  x: number,
  y: number,
  anchoMax: number,
  compacto: boolean,
): void {
  const etiquetaTexto = `${etiqueta}: `;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(compacto ? 6.6 : 7.2);
  const anchoEtiqueta = doc.getTextWidth(etiquetaTexto);
  doc.setTextColor(...TINTA_SUAVE);
  doc.text(etiquetaTexto, x, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(compacto ? 7.6 : 8.4);
  doc.setTextColor(...NEGRO);
  doc.text(
    recortar(doc, valor, Math.max(20, anchoMax - anchoEtiqueta)),
    x + anchoEtiqueta,
    y,
  );
}

/** Fila con la etiqueta a la izquierda y el valor pegado a la derecha. */
function filaJustificada(
  doc: jsPDF,
  etiqueta: string,
  valor: string,
  xIzquierda: number,
  xDerecha: number,
  y: number,
  compacto: boolean,
): void {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(compacto ? 6.6 : 7.2);
  doc.setTextColor(...TINTA_SUAVE);
  const anchoEtiqueta = doc.getTextWidth(etiqueta);
  doc.text(etiqueta, xIzquierda, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(compacto ? 7.6 : 8.4);
  doc.setTextColor(...NEGRO);
  doc.text(
    recortar(doc, valor, Math.max(20, xDerecha - xIzquierda - anchoEtiqueta - 6)),
    xDerecha,
    y,
    { align: "right" },
  );
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

  // Numeración sólo cuando un único comprobante ocupa varias hojas.
  const paginas = doc.getNumberOfPages();
  if (paginas > 1 && copias === 1 && !compacto) {
    for (let i = 1; i <= paginas; i += 1) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...TINTA_SUAVE);
      doc.text(`Página ${i} de ${paginas}`, ancho - margen, alto - margen / 2, {
        align: "right",
      });
    }
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
  const { doc, datos, ancho, margen } = ctx;
  const compacto = ctx.compacto;

  ctx.zonaBase = base;
  ctx.zonaAlto = zona;
  ctx.limite = base + zona - (compacto ? 8 : margen);

  let y = base + margen + (compacto ? 3 : 4);
  y = dibujarEncabezado(ctx, y, etiquetaCopia) + (compacto ? 6 : 10);

  const finCliente = dibujarCliente(ctx, y);
  if (finCliente > y) y = finCliente + (compacto ? 7 : 12);

  y = dibujarItems(ctx, y);
  y = dibujarTotalesYPagos(ctx, y);
  dibujarPie(ctx, y);

  if (datos.estado === "ANULADA") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(compacto ? 44 : 64);
    doc.setTextColor(185, 185, 185);
    doc.text("ANULADA", ancho / 2, base + zona / 2 + (compacto ? 0 : 20), {
      align: "center",
      angle: 28,
    });
  }
}

/** Línea punteada para cortar la hoja entre los dos comprobantes. */
function dibujarLineaCorte(ctx: Contexto, yCorte: number): void {
  const { doc, ancho, margen } = ctx;

  doc.setDrawColor(...NEGRO);
  doc.setLineWidth(0.7);
  doc.setLineDashPattern([5, 4], 0);
  doc.line(margen, yCorte, ancho - margen, yCorte);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...TINTA_SUAVE);
  doc.text("corte", ancho / 2, yCorte - 4, { align: "center" });
}

/**
 * Encabezado: a la izquierda, el logo junto a los datos del emisor (alineados
 * a la izquierda); a la derecha, un recuadro con el tipo de comprobante, su
 * número destacado y los datos legales. Una regla gruesa cierra el apartado.
 */
function dibujarEncabezado(
  ctx: Contexto,
  yInicio: number,
  etiquetaCopia: string | null,
): number {
  const { doc, organizacion, margen, util, datos } = ctx;
  const compacto = ctx.compacto;
  const separacion = compacto ? 12 : 18;
  const relleno = compacto ? 6 : 9;
  const anchoDerecha = Math.round(util * 0.4);
  const anchoIzquierda = util - anchoDerecha - separacion;
  const xDerecha = margen + anchoIzquierda + separacion;
  const centroDerecha = xDerecha + anchoDerecha / 2;

  // ── Lado izquierdo: logo + datos del negocio ──
  const lado = compacto ? LADO_LOGO_COMPACTO : LADO_LOGO;
  const ladoLogo = ctx.logo ? lado : 0;
  const huecoLogo = ladoLogo ? ladoLogo + (compacto ? 8 : 12) : 0;
  const anchoTexto = anchoIzquierda - huecoLogo;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(compacto ? 12.5 : 16);
  const nombre = textoPdf(limpio(organizacion.nombre) || "Veterinaria");
  const lineasNombre = (doc.splitTextToSize(nombre, anchoTexto) as string[]).slice(
    0,
    2,
  );
  const altoNombre = compacto ? 12 : 17;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(compacto ? 6.8 : 7.8);
  const lineasInfo: string[] = [];
  for (const linea of lineasNegocio(organizacion)) {
    lineasInfo.push(
      ...(doc.splitTextToSize(textoPdf(linea), anchoTexto) as string[]),
    );
  }
  const altoInfo = compacto ? 7.8 : 9.2;

  const altoTextoIzquierda =
    lineasNombre.length * altoNombre +
    (compacto ? 2 : 4) +
    lineasInfo.length * altoInfo;
  const altoIzquierda = Math.max(ladoLogo, altoTextoIzquierda);

  // ── Lado derecho: recuadro del comprobante ──
  const filas = filasComprobante(datos, organizacion, ctx.configuracion).filter(
    ([etiqueta]) => etiqueta !== "Comprobante",
  );
  const mostrarNumero =
    ctx.configuracion.mostrarDatosFiscales && tieneValor(datos.numeroComprobante);

  const titulo = tituloComprobante(datos);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(compacto ? 9.6 : 11.5);
  const lineasTitulo = (
    doc.splitTextToSize(titulo, anchoDerecha - relleno * 2) as string[]
  ).slice(0, 2);
  const altoTitulo = compacto ? 11 : 14;
  const altoEtiquetaCopia = etiquetaCopia ? (compacto ? 8 : 9) : 0;
  const altoNumero = mostrarNumero ? (compacto ? 14 : 18) : 0;
  const altoFilaLegal = compacto ? 9.5 : 12;

  const altoDerecha =
    relleno * 2 +
    lineasTitulo.length * altoTitulo +
    altoEtiquetaCopia +
    altoNumero +
    (filas.length ? (compacto ? 4 : 6) + filas.length * altoFilaLegal : 0);

  const altoCaja = Math.max(altoDerecha, altoIzquierda);

  // Recuadro del comprobante.
  doc.setDrawColor(...NEGRO);
  doc.setLineWidth(1);
  doc.roundedRect(xDerecha, yInicio, anchoDerecha, altoCaja, 3, 3, "S");

  // Contenido izquierdo, centrado verticalmente respecto al recuadro.
  const yBloque = yInicio + (altoCaja - altoIzquierda) / 2;

  if (ctx.logo) {
    const escala = Math.min(lado / ctx.logo.ancho, lado / ctx.logo.alto);
    const anchoLogo = ctx.logo.ancho * escala;
    const altoLogo = ctx.logo.alto * escala;
    doc.addImage(
      ctx.logo.dataUrl,
      "PNG",
      margen + (lado - anchoLogo) / 2,
      yBloque + (altoIzquierda - altoLogo) / 2,
      anchoLogo,
      altoLogo,
    );
  }

  const xTexto = margen + huecoLogo;
  let yIzquierda = yBloque + (altoIzquierda - altoTextoIzquierda) / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(compacto ? 12.5 : 16);
  doc.setTextColor(...NEGRO);
  for (const linea of lineasNombre) {
    yIzquierda += altoNombre;
    doc.text(linea, xTexto, yIzquierda);
  }

  yIzquierda += compacto ? 2 : 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(compacto ? 6.8 : 7.8);
  doc.setTextColor(...TINTA_SUAVE);
  for (const linea of lineasInfo) {
    yIzquierda += altoInfo;
    doc.text(linea, xTexto, yIzquierda);
  }

  // Contenido derecho.
  let yDerecha = yInicio + relleno;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(compacto ? 9.6 : 11.5);
  doc.setTextColor(...NEGRO);
  for (const linea of lineasTitulo) {
    yDerecha += altoTitulo;
    doc.text(linea, centroDerecha, yDerecha, { align: "center" });
  }

  if (etiquetaCopia) {
    yDerecha += altoEtiquetaCopia;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(compacto ? 6.4 : 6.9);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text(etiquetaCopia, centroDerecha, yDerecha, { align: "center" });
  }

  if (mostrarNumero) {
    yDerecha += altoNumero;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(compacto ? 10.5 : 13);
    doc.setTextColor(...NEGRO);
    doc.text(`N° ${limpio(datos.numeroComprobante)}`, centroDerecha, yDerecha - 3, {
      align: "center",
    });
  }

  if (filas.length) {
    const yRegla = yDerecha + (compacto ? 1 : 2);
    doc.setDrawColor(...LINEA_SUAVE);
    doc.setLineWidth(0.5);
    doc.line(xDerecha + relleno, yRegla, xDerecha + anchoDerecha - relleno, yRegla);

    yDerecha += compacto ? 4 : 6;
    for (const [etiqueta, valor] of filas) {
      yDerecha += altoFilaLegal;
      filaJustificada(
        doc,
        etiqueta,
        valor,
        xDerecha + relleno,
        xDerecha + anchoDerecha - relleno,
        yDerecha - 2,
        compacto,
      );
    }
  }

  // Regla gruesa que cierra el encabezado.
  const yRegla = yInicio + altoCaja + (compacto ? 5 : 8);
  doc.setDrawColor(...NEGRO);
  doc.setLineWidth(1.6);
  doc.line(margen, yRegla, margen + util, yRegla);

  return yRegla;
}

/**
 * Datos del cliente en un recuadro tipo formulario: nombre y documento en la
 * primera fila; dirección y teléfono en la segunda.
 */
function dibujarCliente(ctx: Contexto, yInicio: number): number {
  const { doc, datos, configuracion, margen, util } = ctx;

  if (!configuracion.mostrarCliente || !datos.cliente) return yInicio;

  const compacto = ctx.compacto;
  const relleno = compacto ? 7 : 9;
  const altoFila = compacto ? 11.5 : 15;

  const nombre = limpio(datos.cliente.nombre) || "Consumidor final";
  const documento =
    configuracion.mostrarDocumentoCliente && tieneValor(datos.cliente.documento)
      ? limpio(datos.cliente.documento)
      : "";
  const direccion = unir([
    datos.cliente.direccion,
    datos.cliente.ciudad,
    datos.cliente.departamento,
  ]);
  const telefono = limpio(datos.cliente.telefono);
  const haySegundaFila = Boolean(direccion || telefono);

  const filas = haySegundaFila ? 2 : 1;
  const altoCaja = relleno * 2 + filas * altoFila - (compacto ? 2 : 3);

  doc.setDrawColor(...NEGRO);
  doc.setLineWidth(0.8);
  doc.roundedRect(margen, yInicio, util, altoCaja, 3, 3, "S");

  const anchoIzquierda = util * 0.62;
  const xIzquierda = margen + relleno;
  const xDerecha = margen + anchoIzquierda + relleno;
  const anchoDer = util - anchoIzquierda - relleno * 2;

  const y1 = yInicio + relleno + altoFila * 0.7;
  campo(doc, "Cliente", nombre, xIzquierda, y1, anchoIzquierda - relleno, compacto);
  if (documento) {
    campo(doc, "RUC / C.I.", documento, xDerecha, y1, anchoDer, compacto);
  }

  if (haySegundaFila) {
    const ySeparador = yInicio + relleno + altoFila - (compacto ? 1 : 2);
    doc.setDrawColor(...LINEA_SUAVE);
    doc.setLineWidth(0.4);
    doc.line(margen + relleno, ySeparador, margen + util - relleno, ySeparador);

    const y2 = y1 + altoFila;
    if (direccion) {
      campo(doc, "Dirección", direccion, xIzquierda, y2, anchoIzquierda - relleno, compacto);
    }
    if (telefono) {
      campo(doc, "Teléfono", telefono, xDerecha, y2, anchoDer, compacto);
    }
  }

  return yInicio + altoCaja;
}

function dibujarItems(ctx: Contexto, yInicio: number): number {
  const { doc, datos, margen } = ctx;
  const compacto = ctx.compacto;
  const anchoCantidad = compacto ? 24 : 30;
  const anchoCodigo = compacto ? 50 : 62;
  const anchoUnitario = compacto ? 56 : 68;
  const anchoTasa = compacto ? 38 : 48;
  const anchoDescripcion =
    ctx.util -
    anchoCantidad -
    anchoCodigo -
    anchoUnitario -
    anchoTasa * 3;
  const altoEncabezado = compacto ? 14 : 21;
  const totalFilas = datos.items.length;

  const xCodigo = margen;
  const xCantidad = xCodigo + anchoCodigo;
  const xDescripcion = xCantidad + anchoCantidad;
  const xUnitario = xDescripcion + anchoDescripcion + anchoUnitario;
  const xExenta = xUnitario + anchoTasa;
  const xCinco = xExenta + anchoTasa;
  const xDiez = xCinco + anchoTasa;

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
        compacto ? 10.5 : 15,
        Math.min(compacto ? 15 : 20, disponible / totalFilas),
      )
    : compacto
      ? 15
      : 20;
  const interlineado = Math.max(8, altoBase - 3);
  const baseTexto = Math.min(altoBase - 3.5, compacto ? 8.5 : 12);

  let y = yInicio;

  const encabezado = () => {
    // Regla superior gruesa y regla inferior fina: sin cajas ni rellenos.
    doc.setDrawColor(...NEGRO);
    doc.setLineWidth(1);
    doc.line(margen, y, margen + ctx.util, y);
    doc.setLineWidth(0.5);
    doc.line(margen, y + altoEncabezado, margen + ctx.util, y + altoEncabezado);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(compacto ? 6.8 : 7.5);
    doc.setTextColor(...NEGRO);
    const baseTitulo = y + (compacto ? 9.8 : 14);
    doc.text("CÓDIGO", xCodigo + 5, baseTitulo);
    doc.text("CANT.", xCantidad + 5, baseTitulo);
    doc.text("DESCRIPCIÓN", xDescripcion + 5, baseTitulo);
    doc.text("P. UNITARIO", xUnitario - 5, baseTitulo, { align: "right" });
    doc.text("EXENTA", xExenta - 5, baseTitulo, { align: "right" });
    doc.text("5%", xCinco - 5, baseTitulo, { align: "right" });
    doc.text("10%", xDiez - 5, baseTitulo, { align: "right" });

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

  datos.items.forEach((item) => {
    const cantidad = Number(item.cantidad) || 1;
    const unitario =
      item.precioUnitario ?? (Number(item.total) || 0) / cantidad;
    const tasa = tasaItem(item, datos);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(compacto ? 8.2 : 8.8);
    // En media hoja con muchos ítems la descripción va en una sola línea: así
    // una venta de 10 líneas no empuja los totales fuera de la mitad de la hoja.
    const maxLineas = compacto ? (totalFilas > 5 ? 1 : 2) : 3;
    let lineas = (
      doc.splitTextToSize(
        textoPdf(item.descripcion),
        anchoDescripcion - 10,
      ) as string[]
    ).slice(0, maxLineas);
    if (maxLineas === 1 && lineas.length === 1) {
      lineas = [recortar(doc, lineas[0], anchoDescripcion - 10)];
    }
    const altoFila =
      lineas.length <= 1
        ? altoBase
        : Math.max(
            altoBase,
            lineas.length * interlineado + (compacto ? 3 : 6),
          );

    if (y + altoFila > ctx.limite && !ctx.configuracion.mediaHoja) {
      doc.addPage(ctx.hoja.jsPdf, "portrait");
      y = ctx.margen;
      encabezado();
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(compacto ? 8.2 : 8.8);
    doc.setTextColor(...NEGRO);

    const codigo = limpio(item.codigo);
    if (codigo) {
      doc.setTextColor(...TINTA_SUAVE);
      doc.text(
        recortar(doc, codigo, anchoCodigo - 10),
        xCodigo + 5,
        y + baseTexto,
      );
      doc.setTextColor(...NEGRO);
    }

    doc.text(formatCantidad(item.cantidad), xCantidad + 5, y + baseTexto);

    doc.text(lineas, xDescripcion + 5, y + baseTexto);
    doc.text(
      dinero(datos.moneda, unitario),
      xUnitario - 5,
      y + baseTexto,
      { align: "right" },
    );

    // El importe de la línea va en la columna de su alícuota: exenta, 5 % o
    // 10 %. No hay columna "Total": el total de la venta está en el resumen.
    const valorTasa = dinero(datos.moneda, item.total);
    doc.setFont("helvetica", "bold");
    if (tasa === 0) {
      doc.text(valorTasa, xExenta - 5, y + baseTexto, { align: "right" });
    } else if (tasa === 5) {
      doc.text(valorTasa, xCinco - 5, y + baseTexto, { align: "right" });
    } else {
      doc.text(valorTasa, xDiez - 5, y + baseTexto, { align: "right" });
    }

    doc.setDrawColor(...LINEA_SUAVE);
    doc.setLineWidth(0.4);
    doc.line(margen, y + altoFila, margen + ctx.util, y + altoFila);

    y += altoFila;
  });

  // Cierre de la tabla.
  doc.setDrawColor(...NEGRO);
  doc.setLineWidth(0.8);
  doc.line(margen, y, margen + ctx.util, y);

  return y;
}

/** Medidas compartidas entre el layout de ítems y el bloque de totales. */
function medidasTotales(ctx: Contexto) {
  const { doc, datos, configuracion } = ctx;
  const compacto = ctx.compacto;

  const filas: [string, string][] = [];
  if (configuracion.mostrarDesgloseIva) {
    if (esVerdadero(datos.subtotal)) {
      filas.push(["Subtotal", dinero(datos.moneda, datos.subtotal)]);
    }
    if (esVerdadero(datos.exenta)) {
      filas.push(["Exenta", dinero(datos.moneda, datos.exenta)]);
    }
  }

  const pagos =
    configuracion.mostrarPagos && datos.pagos ? datos.pagos : [];

  const filaAlto = compacto ? 9.5 : 14;
  const altoCaja = compacto ? 24 : 36;
  const altoEtiqueta = compacto ? 10 : 12;
  const separacionBloques = compacto ? 5 : 8;
  const altoTotales = 5 + filas.length * filaAlto + altoCaja;

  // Columna izquierda: total en letras y pagos.
  const anchoIzquierda = ctx.util - ANCHO_TOTALES - 16;
  const letras = totalEnLetras(datos.moneda, datos.total);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(compacto ? 7.6 : 8.2);
  const lineasLetras = letras
    ? (doc.splitTextToSize(textoPdf(letras), anchoIzquierda) as string[]).slice(0, 3)
    : [];
  const altoLineaLetras = compacto ? 9 : 10.5;
  const altoLetras = lineasLetras.length
    ? altoEtiqueta + lineasLetras.length * altoLineaLetras + 2
    : 0;
  const altoPagos = pagos.length
    ? separacionBloques + altoEtiqueta + pagos.length * filaAlto
    : 0;
  const altoIzquierda = altoLetras + altoPagos;

  // Liquidación del IVA (norma paraguaya): 5 %, 10 % y total.
  const mostrarLiquidacion =
    configuracion.mostrarDesgloseIva &&
    (esVerdadero(datos.iva5) || esVerdadero(datos.iva10));
  const altoLiquidacion = mostrarLiquidacion ? (compacto ? 14 : 18) : 0;
  const separacionLiquidacion = mostrarLiquidacion ? (compacto ? 5 : 9) : 0;

  const altoBloque = Math.max(altoTotales, altoIzquierda);

  return {
    filas,
    pagos,
    filaAlto,
    altoCaja,
    altoEtiqueta,
    separacionBloques,
    anchoIzquierda,
    lineasLetras,
    altoLineaLetras,
    altoLetras,
    mostrarLiquidacion,
    altoLiquidacion,
    separacionLiquidacion,
    altoBloque,
    altoCompleto: altoBloque + separacionLiquidacion + altoLiquidacion,
  };
}

/** Espacio que hay que dejar libre debajo de los ítems. */
function reservaInferior(ctx: Contexto): number {
  const { altoCompleto } = medidasTotales(ctx);
  const compacto = ctx.compacto;
  const conMensaje = ctx.configuracion.mensajePie.trim().length > 0;
  return (
    altoCompleto +
    (compacto ? 34 : 52) +
    (conMensaje ? (compacto ? 10 : 15) : 0)
  );
}

function dibujarTotalesYPagos(ctx: Contexto, yInicio: number): number {
  const { doc, datos, margen, util } = ctx;
  const compacto = ctx.compacto;
  const medidas = medidasTotales(ctx);
  const { filas, pagos, filaAlto, altoCaja, altoEtiqueta, separacionBloques } =
    medidas;

  const xTotales = ctx.ancho - margen - ANCHO_TOTALES;

  let y = yInicio + (compacto ? 8 : 14);
  if (y + medidas.altoCompleto > ctx.limite && !ctx.configuracion.mediaHoja) {
    doc.addPage(ctx.hoja.jsPdf, "portrait");
    y = ctx.margen;
  }

  // ── Izquierda: total en letras ──
  let yIzquierda = y;
  if (medidas.lineasLetras.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text("TOTAL EN LETRAS", margen, yIzquierda + altoEtiqueta - 3);
    yIzquierda += altoEtiqueta - 1;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(compacto ? 7.6 : 8.2);
    doc.setTextColor(...NEGRO);
    for (const linea of medidas.lineasLetras) {
      yIzquierda += medidas.altoLineaLetras;
      doc.text(linea, margen, yIzquierda - 2);
    }
    yIzquierda = y + medidas.altoLetras;
  }

  // ── Izquierda: pagos ──
  if (pagos.length > 0) {
    const yPagos = yIzquierda + separacionBloques;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text("PAGOS", margen, yPagos + altoEtiqueta - 3);

    const xMonto = margen + medidas.anchoIzquierda;
    let yPago = yPagos + altoEtiqueta + filaAlto - 3;
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
      doc.setTextColor(...NEGRO);
      doc.text(dinero(datos.moneda, pago.monto), xMonto, yPago, {
        align: "right",
      });
      yPago += filaAlto;
    }
  }

  // ── Derecha: subtotales y total ──
  let yTotal = y + 8;
  for (const [etiqueta, valor] of filas) {
    filaJustificada(
      doc,
      etiqueta,
      valor,
      xTotales + 4,
      ctx.ancho - margen - 4,
      yTotal,
      compacto,
    );
    yTotal += filaAlto;
  }

  // El total general se enmarca con doble borde negro (sin relleno).
  const yCaja = yTotal - 3;
  doc.setDrawColor(...NEGRO);
  doc.setLineWidth(1.3);
  doc.rect(xTotales, yCaja, ANCHO_TOTALES, altoCaja, "S");
  doc.setLineWidth(0.4);
  doc.rect(xTotales + 2.4, yCaja + 2.4, ANCHO_TOTALES - 4.8, altoCaja - 4.8, "S");

  const tamanoTotal = compacto ? 11 : 13;
  const baseTotal = yCaja + altoCaja / 2 + tamanoTotal * 0.35;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(compacto ? 8.4 : 9.2);
  doc.setTextColor(...NEGRO);
  doc.text("TOTAL A PAGAR", xTotales + 12, baseTotal - 0.5);

  doc.setFontSize(tamanoTotal);
  doc.text(dinero(datos.moneda, datos.total), ctx.ancho - margen - 12, baseTotal, {
    align: "right",
  });

  // ── Liquidación del IVA ──
  if (medidas.mostrarLiquidacion) {
    const yLiq = y + medidas.altoBloque + medidas.separacionLiquidacion;
    doc.setDrawColor(...LINEA_SUAVE);
    doc.setLineWidth(0.5);
    doc.line(margen, yLiq, margen + util, yLiq);
    doc.line(
      margen,
      yLiq + medidas.altoLiquidacion,
      margen + util,
      yLiq + medidas.altoLiquidacion,
    );

    const base = yLiq + medidas.altoLiquidacion / 2 + (compacto ? 2.6 : 3);
    const iva5 = Number(datos.iva5) || 0;
    const iva10 = Number(datos.iva10) || 0;
    const totalIva = iva5 + iva10;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(compacto ? 6.4 : 6.9);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text("LIQUIDACIÓN DEL IVA", margen + 4, base);

    const ancho = util * 0.22;
    campo(doc, "(5%)", dinero(datos.moneda, iva5) || "0", margen + util * 0.3, base, ancho, compacto);
    campo(doc, "(10%)", dinero(datos.moneda, iva10) || "0", margen + util * 0.52, base, ancho, compacto);
    campo(doc, "Total IVA", dinero(datos.moneda, totalIva) || "0", margen + util * 0.74, base, util * 0.26 - 4, compacto);
  }

  return y + medidas.altoCompleto;
}

function dibujarPie(ctx: Contexto, yInicio: number): void {
  const { doc, datos, configuracion, util, margen } = ctx;
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
    doc.setDrawColor(...LINEA_SUAVE);
    doc.setLineWidth(0.4);
    doc.line(margen, y - (compacto ? 3 : 6), margen + util, y - (compacto ? 3 : 6));

    doc.setFont("helvetica", "normal");
    doc.setFontSize(compacto ? 8 : 8.6);
    doc.setTextColor(...TINTA_SUAVE);
    const lineas = doc.splitTextToSize(
      textoPdf(mensaje),
      util,
    ) as string[];
    doc.text(lineas, ctx.ancho / 2, y + (compacto ? 4 : 6), { align: "center" });
    y += lineas.length * (compacto ? 10 : 11);
  }

  if (esTicket) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text("DOCUMENTO NO VÁLIDO COMO FACTURA", ctx.ancho / 2, y + 8, {
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