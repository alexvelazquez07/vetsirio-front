/**
 * Configuración de impresión de comprobantes.
 *
 * Se guarda como JSON dentro de la veterinaria porque es una preferencia del
 * negocio, no del navegador: si mañana alguien imprime desde otra computadora
 * tiene que encontrar el mismo formato, el mismo ancho de papel y el mismo
 * mensaje al pie.
 */

export type FormatoImpresion = "ticket_80" | "ticket_58" | "hoja";

/** Tamaño de papel para el modo autoimpresor de hoja completa. */
export type TamanoHoja = "a4" | "carta";

export interface ConfiguracionImpresion {
  /** Papel térmico o hoja completa. */
  formato: FormatoImpresion;
  /** Sólo aplica a `formato: "hoja"`. */
  tamanoHoja: TamanoHoja;
  /**
   * Aprovecha la mitad superior de la hoja y deja una línea de corte.
   * Sólo aplica a `formato: "hoja"`.
   */
  mediaHoja: boolean;
  /**
   * Con `mediaHoja`, imprime el original arriba y una copia idéntica abajo,
   * usando las dos mitades de la hoja. Sólo aplica a `formato: "hoja"`.
   */
  duplicadoMediaHoja: boolean;
  /** Imprime solo al activar (emitir) una venta. */
  autoImprimir: boolean;
  /** Copias que se envían a la impresora. */
  copias: number;
  mostrarLogo: boolean;
  mostrarCliente: boolean;
  mostrarDocumentoCliente: boolean;
  mostrarDatosFiscales: boolean;
  mostrarDesgloseIva: boolean;
  mostrarPagos: boolean;
  mostrarVendedor: boolean;
  /** Texto libre al final del comprobante. */
  mensajePie: string;
}

export interface FormatoImpresionInfo {
  valor: FormatoImpresion;
  etiqueta: string;
  detalle: string;
  anchoMm: number;
  anchoPx: number;
}

export interface TamanoHojaInfo {
  valor: TamanoHoja;
  etiqueta: string;
  detalle: string;
  /** Formato que entiende jsPDF. */
  jsPdf: "a4" | "letter";
  anchoMm: number;
  altoMm: number;
}

export const FORMATOS_IMPRESION: FormatoImpresionInfo[] = [
  {
    valor: "ticket_80",
    etiqueta: "Ticket 80 mm",
    detalle: "Impresora térmica estándar",
    anchoMm: 80,
    anchoPx: 302,
  },
  {
    valor: "ticket_58",
    etiqueta: "Ticket 58 mm",
    detalle: "Impresora portátil o de mostrador",
    anchoMm: 58,
    anchoPx: 219,
  },
  {
    valor: "hoja",
    etiqueta: "Hoja completa (A4 / Carta)",
    detalle: "Autoimpresor, PDF para láser o inyección",
    anchoMm: 210,
    anchoPx: 794,
  },
];

export const TAMANOS_HOJA: TamanoHojaInfo[] = [
  {
    valor: "a4",
    etiqueta: "A4",
    detalle: "210 × 297 mm",
    jsPdf: "a4",
    anchoMm: 210,
    altoMm: 297,
  },
  {
    valor: "carta",
    etiqueta: "Carta",
    detalle: "216 × 279 mm",
    jsPdf: "letter",
    anchoMm: 216,
    altoMm: 279,
  },
];

export const MENSAJE_PIE_POR_DEFECTO = "¡Gracias por su preferencia!";

export const IMPRESION_POR_DEFECTO: ConfiguracionImpresion = {
  formato: "ticket_80",
  tamanoHoja: "a4",
  mediaHoja: false,
  duplicadoMediaHoja: false,
  autoImprimir: false,
  copias: 1,
  mostrarLogo: true,
  mostrarCliente: true,
  mostrarDocumentoCliente: true,
  mostrarDatosFiscales: true,
  mostrarDesgloseIva: true,
  mostrarPagos: true,
  mostrarVendedor: true,
  mensajePie: MENSAJE_PIE_POR_DEFECTO,
};

export function formatoImpresion(formato: FormatoImpresion): FormatoImpresionInfo {
  return (
    FORMATOS_IMPRESION.find((item) => item.valor === formato) ??
    FORMATOS_IMPRESION[0]
  );
}

/** true cuando el comprobante se genera como PDF de hoja completa. */
export function esFormatoHoja(formato: FormatoImpresion): boolean {
  return formato === "hoja";
}

export function tamanoHoja(valor: TamanoHoja): TamanoHojaInfo {
  return TAMANOS_HOJA.find((item) => item.valor === valor) ?? TAMANOS_HOJA[0];
}

/**
 * Normaliza lo que llega del backend.
 *
 * El JSON puede venir vacío (veterinaria nueva), con un formato desconocido
 * (versión vieja de la UI) o con tipos cambiados. En todos esos casos se cae
 * al valor por defecto, para que la vista previa nunca quede en blanco.
 */
export function normalizarConfiguracionImpresion(
  valor: unknown,
): ConfiguracionImpresion {
  if (!valor || typeof valor !== "object") {
    return { ...IMPRESION_POR_DEFECTO };
  }

  const datos = valor as Record<string, unknown>;
  const formato: FormatoImpresion =
    datos.formato === "ticket_58" || datos.formato === "hoja"
      ? datos.formato
      : "ticket_80";
  const tamano: TamanoHoja = datos.tamanoHoja === "carta" ? "carta" : "a4";
  const copias = Number(datos.copias);

  return {
    formato,
    tamanoHoja: tamano,
    mediaHoja: booleano(datos.mediaHoja, IMPRESION_POR_DEFECTO.mediaHoja),
    duplicadoMediaHoja: booleano(
      datos.duplicadoMediaHoja,
      IMPRESION_POR_DEFECTO.duplicadoMediaHoja,
    ),
    autoImprimir:
      typeof datos.autoImprimir === "boolean"
        ? datos.autoImprimir
        : IMPRESION_POR_DEFECTO.autoImprimir,
    copias: Number.isFinite(copias)
      ? Math.min(3, Math.max(1, Math.trunc(copias)))
      : IMPRESION_POR_DEFECTO.copias,
    mostrarLogo: booleano(datos.mostrarLogo, IMPRESION_POR_DEFECTO.mostrarLogo),
    mostrarCliente: booleano(
      datos.mostrarCliente,
      IMPRESION_POR_DEFECTO.mostrarCliente,
    ),
    mostrarDocumentoCliente: booleano(
      datos.mostrarDocumentoCliente,
      IMPRESION_POR_DEFECTO.mostrarDocumentoCliente,
    ),
    mostrarDatosFiscales: booleano(
      datos.mostrarDatosFiscales,
      IMPRESION_POR_DEFECTO.mostrarDatosFiscales,
    ),
    mostrarDesgloseIva: booleano(
      datos.mostrarDesgloseIva,
      IMPRESION_POR_DEFECTO.mostrarDesgloseIva,
    ),
    mostrarPagos: booleano(
      datos.mostrarPagos,
      IMPRESION_POR_DEFECTO.mostrarPagos,
    ),
    mostrarVendedor: booleano(
      datos.mostrarVendedor,
      IMPRESION_POR_DEFECTO.mostrarVendedor,
    ),
    mensajePie:
      typeof datos.mensajePie === "string"
        ? datos.mensajePie.slice(0, 160)
        : IMPRESION_POR_DEFECTO.mensajePie,
  };
}

function booleano(valor: unknown, porDefecto: boolean): boolean {
  return typeof valor === "boolean" ? valor : porDefecto;
}
