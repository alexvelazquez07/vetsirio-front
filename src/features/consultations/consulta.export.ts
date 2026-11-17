import { jsPDF } from "jspdf";

import { urlDeArchivo } from "@/services/api";
import type { Consulta, Veterinaria } from "@/types/dominio";

/* ───────────────────────────────── Constantes ───────────────────────────────── */

type RGB = [number, number, number];

/**
 * Campos opcionales de la veterinaria que el PDF usa si existen.
 * Si tu tipo `Veterinaria` ya los define, esto no cambia nada; si no, evita
 * errores de TypeScript. Cuando los agregues al tipo original, podés borrar esto.
 */
type VeterinariaPdf = Veterinaria & {
  email?: string | null;
  sitioWeb?: string | null;
  barrio?: string | null;
  ciudad?: string | null;
  registroProfesional?: string | null;
  colorPrimario?: string | null;
};

const MARGEN = 40;
const ALTO_PIE = 36;
const LADO_LOGO = 56;

const COLOR_MARCA_DEFECTO: RGB = [18, 52, 86];
const TINTA: RGB = [31, 41, 55];
const TINTA_SUAVE: RGB = [100, 110, 125];
const BLANCO: RGB = [255, 255, 255];
const LINEA: RGB = [216, 221, 228];
const FONDO_SUAVE: RGB = [245, 247, 250];

interface Contexto {
  doc: jsPDF;
  y: number;
  anchoPagina: number;
  altoPagina: number;
  anchoUtil: number;
  color: RGB;
  colorSobreMarca: RGB;
  veterinaria?: VeterinariaPdf | null;
  consulta: Consulta;
}

interface LogoListo {
  dataUrl: string;
  ancho: number;
  alto: number;
}

/* ──────────────────────────── Utilidades de datos ──────────────────────────── */

/** true si el valor existe y no es sólo espacios. El número 0 cuenta como valor. */
function tieneValor(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false;
  return String(valor).trim().length > 0;
}

function limpio(valor: unknown): string {
  return tieneValor(valor) ? String(valor).trim() : "";
}

function unir(partes: unknown[], separador = " · "): string {
  return partes.map(limpio).filter(Boolean).join(separador);
}

function fechaLarga(fecha: string): string {
  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return "";
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(valor);
}

function fechaParaArchivo(fecha: string): string {
  const valor = new Date(fecha);
  return (Number.isNaN(valor.getTime()) ? new Date() : valor).toISOString().slice(0, 10);
}

function formatearTelefono(numero: string | null | undefined): string {
  return (numero ?? "").replace(/[^0-9+]/g, "");
}

function nombreResponsable(consulta: Consulta): string {
  const responsable = consulta.paciente?.cliente;
  if (!responsable) return "";
  return (
    unir([responsable.nombres, responsable.apellidos], " ") ||
    limpio(responsable.razonSocial) ||
    limpio(responsable.documento)
  );
}

function nombreVeterinario(consulta: Consulta): string {
  return unir([consulta.veterinario?.nombre, consulta.veterinario?.apellido], " ");
}

function slug(texto: string): string {
  return (
    texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "paciente"
  );
}

/* ─────────────────────────────────── Color ─────────────────────────────────── */

function hexARgb(hex: string | null | undefined): RGB | null {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex.trim())) return null;
  const limpioHex = hex.trim().slice(1);
  return [
    parseInt(limpioHex.slice(0, 2), 16),
    parseInt(limpioHex.slice(2, 4), 16),
    parseInt(limpioHex.slice(4, 6), 16),
  ];
}

/** Luminancia relativa aproximada (0 = oscuro, 1 = claro). */
function luminancia([r, g, b]: RGB): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/* ───────────────────────────────────── Logo ───────────────────────────────────── */

/**
 * Descarga el logo y lo convierte a PNG con un canvas. Así funciona con cualquier
 * formato que acepte el navegador (WEBP, AVIF, GIF…) y se conservan las
 * proporciones reales de la imagen.
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
      const el = new Image();
      el.onload = () => resolver(el);
      el.onerror = () => rechazar(new Error("No se pudo leer el logo."));
      el.src = urlLocal;
    });

    const maximo = 512;
    const escala = Math.min(1, maximo / Math.max(imagen.naturalWidth, imagen.naturalHeight));
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

/* ──────────────────────────── Paginación y texto ──────────────────────────── */

/** Si no cabe `alto` en la página actual, abre una nueva con cabecera compacta. */
function asegurarEspacio(ctx: Contexto, alto: number): void {
  const limite = ctx.altoPagina - ALTO_PIE - 12;
  if (ctx.y + alto <= limite) return;

  ctx.doc.addPage();
  dibujarCabeceraCompacta(ctx);
}

function escribirParrafo(
  ctx: Contexto,
  texto: string,
  opciones: {
    x?: number;
    ancho?: number;
    tamano?: number;
    estilo?: "normal" | "bold";
    color?: RGB;
    interlineado?: number;
  } = {},
): void {
  const { doc } = ctx;
  const x = opciones.x ?? MARGEN;
  const ancho = opciones.ancho ?? ctx.anchoUtil;
  const tamano = opciones.tamano ?? 10;
  const interlineado = opciones.interlineado ?? tamano * 1.45;

  doc.setFont("helvetica", opciones.estilo ?? "normal");
  doc.setFontSize(tamano);
  const lineas: string[] = doc.splitTextToSize(texto, ancho);

  for (const linea of lineas) {
    asegurarEspacio(ctx, interlineado);
    // Se reaplica el estilo porque una cabecera nueva lo modifica.
    doc.setFont("helvetica", opciones.estilo ?? "normal");
    doc.setFontSize(tamano);
    doc.setTextColor(...(opciones.color ?? TINTA));
    doc.text(linea, x, ctx.y + tamano);
    ctx.y += interlineado;
  }
}

function tituloSeccion(ctx: Contexto, titulo: string): void {
  asegurarEspacio(ctx, 44);
  const { doc } = ctx;
  ctx.y += 8;

  doc.setFillColor(...ctx.color);
  doc.roundedRect(MARGEN, ctx.y, 3, 14, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...TINTA);
  doc.text(titulo, MARGEN + 11, ctx.y + 11);

  ctx.y += 22;
}

/** Campo con etiqueta pequeña y texto debajo. Si no hay valor, no se dibuja nada. */
function campoTexto(ctx: Contexto, etiqueta: string, valor: unknown): boolean {
  if (!tieneValor(valor)) return false;
  asegurarEspacio(ctx, 30);

  escribirParrafo(ctx, etiqueta, {
    tamano: 8.5,
    estilo: "bold",
    color: TINTA_SUAVE,
    interlineado: 12,
  });
  escribirParrafo(ctx, limpio(valor), { tamano: 10, interlineado: 14 });
  ctx.y += 6;
  return true;
}

/* ───────────────────────────────── Cabeceras ───────────────────────────────── */

function dibujarCabeceraCompacta(ctx: Contexto): void {
  const { doc, anchoPagina } = ctx;
  const alto = 30;

  doc.setFillColor(...ctx.color);
  doc.rect(0, 0, anchoPagina, alto, "F");

  const nombreClinica = limpio(ctx.veterinaria?.nombreComercial) || limpio(ctx.veterinaria?.razonSocial);
  doc.setTextColor(...ctx.colorSobreMarca);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  if (nombreClinica) doc.text(nombreClinica, MARGEN, 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const detalle = unir(["Ficha de consulta", limpio(ctx.consulta.paciente?.nombre)]);
  doc.text(detalle, anchoPagina - MARGEN, 19, { align: "right" });

  ctx.y = alto + 22;
}

function dibujarCabeceraCompleta(ctx: Contexto, logo: LogoListo | null): void {
  const { doc, anchoPagina, veterinaria } = ctx;

  const nombreClinica = limpio(veterinaria?.nombreComercial) || limpio(veterinaria?.razonSocial) || "Veterinaria";
  const anchoTexto = anchoPagina - MARGEN * 2 - LADO_LOGO - 16;

  // Cada línea de contacto se arma sólo con los datos que existen.
  const telefono = formatearTelefono(veterinaria?.telefono);
  const whatsapp = formatearTelefono(veterinaria?.whatsapp);
  const lineasInfo: string[] = [];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);

  const direccion = unir([veterinaria?.direccion, veterinaria?.barrio, veterinaria?.ciudad]);
  if (direccion) lineasInfo.push(...(doc.splitTextToSize(direccion, anchoTexto) as string[]));

  const contacto = unir([
    telefono && `Tel: ${telefono}`,
    whatsapp && `WhatsApp: ${whatsapp}`,
    veterinaria?.email,
    veterinaria?.sitioWeb,
  ]);
  if (contacto) lineasInfo.push(...(doc.splitTextToSize(contacto, anchoTexto) as string[]));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const lineasNombre = (doc.splitTextToSize(nombreClinica, anchoTexto) as string[]).slice(0, 2);

  const altoCabecera = Math.max(
    88,
    22 + lineasNombre.length * 22 + (lineasInfo.length ? 6 + lineasInfo.length * 12 : 0) + 18,
  );

  doc.setFillColor(...ctx.color);
  doc.rect(0, 0, anchoPagina, altoCabecera, "F");

  // Nombre
  doc.setTextColor(...ctx.colorSobreMarca);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  let y = 22 + 14;
  for (const linea of lineasNombre) {
    doc.text(linea, MARGEN, y);
    y += 22;
  }

  // Datos de contacto (sólo los que existen)
  if (lineasInfo.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    y -= 8;
    for (const linea of lineasInfo) {
      doc.text(linea, MARGEN, y);
      y += 12;
    }
  }

  // Logo o iniciales dentro de un recuadro blanco
  const x = anchoPagina - MARGEN - LADO_LOGO;
  const yLogo = (altoCabecera - LADO_LOGO) / 2;
  doc.setFillColor(...BLANCO);
  doc.roundedRect(x, yLogo, LADO_LOGO, LADO_LOGO, 10, 10, "F");

  if (logo) {
    const interior = LADO_LOGO - 10;
    const escala = Math.min(interior / logo.ancho, interior / logo.alto);
    const w = logo.ancho * escala;
    const h = logo.alto * escala;
    doc.addImage(logo.dataUrl, "PNG", x + (LADO_LOGO - w) / 2, yLogo + (LADO_LOGO - h) / 2, w, h);
  } else {
    const iniciales = nombreClinica.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "V";
    doc.setTextColor(...(luminancia(ctx.color) > 0.6 ? TINTA : ctx.color));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(iniciales, x + LADO_LOGO / 2, yLogo + LADO_LOGO / 2 + 7, { align: "center" });
  }

  ctx.y = altoCabecera + 24;
}

/* ───────────────────────────────── Secciones ───────────────────────────────── */

function dibujarTituloDocumento(ctx: Contexto): void {
  const { doc, anchoPagina, consulta } = ctx;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...TINTA);
  doc.text("Ficha de consulta médica", MARGEN, ctx.y + 14);

  const fecha = fechaLarga(consulta.fecha);
  if (fecha) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text(fecha, anchoPagina - MARGEN, ctx.y + 13, { align: "right" });
  }

  ctx.y += 32;
}

function dibujarTarjetaPaciente(ctx: Contexto): void {
  const { doc, consulta } = ctx;

  const datos: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Especie", valor: limpio(consulta.paciente?.especie?.nombre) },
    { etiqueta: "Responsable", valor: nombreResponsable(consulta) },
    { etiqueta: "Veterinario", valor: nombreVeterinario(consulta) },
  ].filter((dato) => dato.valor);

  const nombre = limpio(consulta.paciente?.nombre) || "Paciente";
  const columnas = 2;
  const anchoColumna = (ctx.anchoUtil - 32) / columnas;
  const filas = Math.ceil(datos.length / columnas);
  const alto = 20 + 22 + filas * 32 + (filas ? 6 : 0);

  asegurarEspacio(ctx, alto + 8);

  doc.setFillColor(...FONDO_SUAVE);
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.8);
  doc.roundedRect(MARGEN, ctx.y, ctx.anchoUtil, alto, 8, 8, "FD");

  doc.setFillColor(...ctx.color);
  doc.roundedRect(MARGEN, ctx.y, 4, alto, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA_SUAVE);
  doc.text("Paciente", MARGEN + 18, ctx.y + 20);

  doc.setFontSize(15);
  doc.setTextColor(...TINTA);
  doc.text(nombre, MARGEN + 18, ctx.y + 38);

  datos.forEach((dato, indice) => {
    const columna = indice % columnas;
    const fila = Math.floor(indice / columnas);
    const x = MARGEN + 18 + columna * anchoColumna;
    const y = ctx.y + 58 + fila * 32;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text(dato.etiqueta, x, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TINTA);
    const [primera] = doc.splitTextToSize(dato.valor, anchoColumna - 8) as string[];
    doc.text(primera, x, y + 13);
  });

  ctx.y += alto + 10;
}

function dibujarSignosVitales(ctx: Contexto): boolean {
  const { doc, consulta } = ctx;

  const signos = [
    { etiqueta: "Peso", valor: consulta.pesoKg, unidad: "kg" },
    { etiqueta: "Temperatura", valor: consulta.temperatura, unidad: "°C" },
    { etiqueta: "Frec. cardíaca", valor: consulta.frecuenciaCardiaca, unidad: "lpm" },
    { etiqueta: "Frec. respiratoria", valor: consulta.frecuenciaRespiratoria, unidad: "rpm" },
  ].filter((signo) => tieneValor(signo.valor));

  if (signos.length === 0) return false;

  const columnas = 4;
  const hueco = 8;
  const anchoCaja = (ctx.anchoUtil - hueco * (columnas - 1)) / columnas;
  const altoCaja = 38;
  const filas = Math.ceil(signos.length / columnas);

  asegurarEspacio(ctx, filas * (altoCaja + hueco));

  signos.forEach((signo, indice) => {
    const columna = indice % columnas;
    const fila = Math.floor(indice / columnas);
    const x = MARGEN + columna * (anchoCaja + hueco);
    const y = ctx.y + fila * (altoCaja + hueco);

    doc.setFillColor(...FONDO_SUAVE);
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, anchoCaja, altoCaja, 6, 6, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text(signo.etiqueta, x + 10, y + 14);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...TINTA);
    doc.text(`${limpio(signo.valor)} ${signo.unidad}`, x + 10, y + 30);
  });

  ctx.y += filas * (altoCaja + hueco) + 2;
  return true;
}

function dibujarPrescripciones(ctx: Contexto): void {
  const { doc } = ctx;
  const prescripciones = (ctx.consulta.prescripciones ?? []).filter((p) => tieneValor(p.medicamento));
  if (prescripciones.length === 0) return;

  tituloSeccion(ctx, "Recetas e indicaciones");

  const anchoTexto = ctx.anchoUtil - 28;

  for (const prescripcion of prescripciones) {
    const titulo = unir([prescripcion.medicamento, prescripcion.presentacion]);
    const detalle = unir([
      tieneValor(prescripcion.dosis) && `Dosis: ${limpio(prescripcion.dosis)}`,
      tieneValor(prescripcion.frecuencia) && `Frecuencia: ${limpio(prescripcion.frecuencia)}`,
      tieneValor(prescripcion.duracion) && `Duración: ${limpio(prescripcion.duracion)}`,
    ]);
    const indicaciones = limpio(prescripcion.indicaciones);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const lineasTitulo = doc.splitTextToSize(titulo, anchoTexto) as string[];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const lineasDetalle = detalle ? (doc.splitTextToSize(detalle, anchoTexto) as string[]) : [];
    const lineasIndicaciones = indicaciones
      ? (doc.splitTextToSize(indicaciones, anchoTexto) as string[])
      : [];

    const alto =
      18 +
      lineasTitulo.length * 14 +
      lineasDetalle.length * 13 +
      (lineasIndicaciones.length ? 4 + lineasIndicaciones.length * 13 : 0);

    asegurarEspacio(ctx, alto + 8);

    doc.setFillColor(...FONDO_SUAVE);
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.8);
    doc.roundedRect(MARGEN, ctx.y, ctx.anchoUtil, alto, 6, 6, "FD");
    doc.setFillColor(...ctx.color);
    doc.roundedRect(MARGEN, ctx.y, 3, alto, 1.5, 1.5, "F");

    let y = ctx.y + 17;
    const x = MARGEN + 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...TINTA);
    for (const linea of lineasTitulo) {
      doc.text(linea, x, y);
      y += 14;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...TINTA);
    for (const linea of lineasDetalle) {
      doc.text(linea, x, y);
      y += 13;
    }

    if (lineasIndicaciones.length) {
      y += 4;
      doc.setTextColor(...TINTA_SUAVE);
      for (const linea of lineasIndicaciones) {
        doc.text(linea, x, y);
        y += 13;
      }
    }

    ctx.y += alto + 8;
  }
}



function dibujarFirma(ctx: Contexto): void {
  const nombre = nombreVeterinario(ctx.consulta);
  if (!nombre) return;

  asegurarEspacio(ctx, 90);
  const { doc } = ctx;
  ctx.y += 44;

  doc.setDrawColor(...TINTA_SUAVE);
  doc.setLineWidth(0.8);
  doc.line(MARGEN, ctx.y, MARGEN + 190, ctx.y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TINTA);
  doc.text(nombre, MARGEN, ctx.y + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA_SUAVE);
  const registro = limpio(ctx.veterinaria?.registroProfesional);
  doc.text(registro ? `Médico veterinario · ${registro}` : "Médico veterinario", MARGEN, ctx.y + 28);

  ctx.y += 34;
}

/** Pie con datos de la clínica y numeración, en todas las páginas. */
function dibujarPies(ctx: Contexto): void {
  const { doc, anchoPagina, altoPagina, veterinaria } = ctx;
  const total = doc.getNumberOfPages();

  const texto = unir([
    veterinaria?.razonSocial,
    veterinaria?.ruc && `RUC ${limpio(veterinaria.ruc)}`,
  ]);

  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    const yLinea = altoPagina - ALTO_PIE + 8;

    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.8);
    doc.line(MARGEN, yLinea, anchoPagina - MARGEN, yLinea);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TINTA_SUAVE);

    if (texto) {
      doc.text(texto, MARGEN, yLinea + 14, { maxWidth: ctx.anchoUtil - 80 });
    }
    doc.text(`Página ${pagina} de ${total}`, anchoPagina - MARGEN, yLinea + 14, { align: "right" });
  }
}

/* ──────────────────────────────── API pública ──────────────────────────────── */

export async function crearDocumentoPdfConsulta(
  consulta: Consulta,
  veterinaria?: Veterinaria | null,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const anchoPagina = doc.internal.pageSize.getWidth();
  const altoPagina = doc.internal.pageSize.getHeight();

  // El color de marca se toma de la configuración si existe y es válido.
  const vet = veterinaria as VeterinariaPdf | null | undefined;
  const color = hexARgb(vet?.colorPrimario) ?? COLOR_MARCA_DEFECTO;

  const ctx: Contexto = {
    doc,
    y: 0,
    anchoPagina,
    altoPagina,
    anchoUtil: anchoPagina - MARGEN * 2,
    color,
    colorSobreMarca: luminancia(color) > 0.6 ? TINTA : BLANCO,
    veterinaria: vet,
    consulta,
  };

  doc.setProperties({
    title: `Ficha de consulta - ${limpio(consulta.paciente?.nombre) || "paciente"}`,
    subject: "Ficha de consulta médica",
    author: limpio(veterinaria?.nombreComercial) || limpio(veterinaria?.razonSocial) || "Veterinaria",
  });

  const logo = await cargarLogo(veterinaria?.logoUrl);

  dibujarCabeceraCompleta(ctx, logo);
  dibujarTituloDocumento(ctx);
  dibujarTarjetaPaciente(ctx);

  // Cada sección sólo aparece si tiene al menos un dato cargado.
  const hayMotivo = tieneValor(consulta.motivoConsulta) || tieneValor(consulta.sintomas);
  if (hayMotivo) {
    tituloSeccion(ctx, "Motivo de consulta");
    campoTexto(ctx, "Motivo", consulta.motivoConsulta);
    campoTexto(ctx, "Síntomas", consulta.sintomas);
  }

  const hayVitales = [
    consulta.pesoKg,
    consulta.temperatura,
    consulta.frecuenciaCardiaca,
    consulta.frecuenciaRespiratoria,
  ].some(tieneValor);
  if (tieneValor(consulta.examenFisico) || hayVitales) {
    tituloSeccion(ctx, "Examen físico");
    if (hayVitales) {
      dibujarSignosVitales(ctx);
      ctx.y += 4;
    }
    campoTexto(ctx, "Hallazgos", consulta.examenFisico);
  }

  const hayDiagnostico = [
    consulta.diagnostico,
    consulta.tratamientoIndicado,
    consulta.observaciones,
  ].some(tieneValor);
  if (hayDiagnostico) {
    tituloSeccion(ctx, "Diagnóstico y tratamiento");
    campoTexto(ctx, "Diagnóstico", consulta.diagnostico);
    campoTexto(ctx, "Tratamiento indicado", consulta.tratamientoIndicado);
    campoTexto(ctx, "Observaciones", consulta.observaciones);
  }

  dibujarPrescripciones(ctx);

  dibujarFirma(ctx);
  dibujarPies(ctx);

  return doc;
}

export async function descargarConsultaPdf(
  consulta: Consulta,
  veterinaria?: Veterinaria | null,
): Promise<void> {
  const nombreArchivo = `ficha-consulta-${slug(consulta.paciente?.nombre ?? "")}-${fechaParaArchivo(consulta.fecha)}.pdf`;
  const documento = await crearDocumentoPdfConsulta(consulta, veterinaria);
  documento.save(nombreArchivo);
}

/** Deja sólo dígitos y agrega el prefijo de Paraguay a números locales (0981… → 595981…). */
function normalizarNumeroWhatsapp(numero: string | null | undefined): string {
  const digitos = (numero ?? "").replace(/\D/g, "");
  if (digitos.startsWith("00")) return digitos.slice(2);
  if (digitos.startsWith("0")) return `595${digitos.slice(1)}`;
  return digitos;
}

/**
 * Abre WhatsApp con el mensaje armado.
 * Si se pasa `telefonoDestino` (por ejemplo el del responsable del paciente) se
 * usa ese número; si no, se mantiene el comportamiento anterior.
 */
export function abrirWhatsappConsulta(
  texto: string,
  veterinaria?: Veterinaria | null,
  telefonoDestino?: string | null,
): void {
  const mensaje = encodeURIComponent(
    limpio(texto) || "Hola, te compartimos la ficha de consulta médica.",
  );
  const numero = normalizarNumeroWhatsapp(telefonoDestino) || normalizarNumeroWhatsapp(veterinaria?.whatsapp);
  const url = numero
    ? `https://wa.me/${numero}?text=${mensaje}`
    : `https://wa.me/?text=${mensaje}`;

  window.open(url, "_blank", "noopener,noreferrer");
}