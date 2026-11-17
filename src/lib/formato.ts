/**
 * Formato de moneda y números para Paraguay.
 *
 * Tres reglas que rigen todo el sistema:
 *
 *  1. El guaraní se separa con PUNTO, no con coma: ₲ 1.500.000. Ese es el uso
 *     real en Paraguay y es lo que el usuario espera ver. Usar la coma como
 *     separador de miles (como hace en-US) produce una lectura equivocada.
 *
 *  2. Los centavos no circulan. Ningún factura paraguaya muestra ₲ 1.500.000,00.
 *     Por eso se muestra siempre entero, aunque internamente se calcule con
 *     dos decimales.
 *
 *  3. Igual internamente se guardan 2 decimales. El IVA del 5% sobre ₲ 133.333
 *     da ₲ 6.666,65 y redondear en cada línea descuadra el total de la factura.
 *     Se calcula con precisión y se redondea una sola vez, al mostrar.
 */

/** Símbolo del guaraní. */
export const SIMBOLO_GS = "₲";

/** Redondeo a entero para presentación. */
export function aEntero(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.round(valor);
}

/**
 * Coloca el punto cada tres dígitos desde la derecha.
 *
 *   1500000 → "1.500.000"
 *   0       → "0"
 *   -45000  → "-45.000"
 */
export function formatMilesimas(valor: number | string | null | undefined): string {
  const numero = normalizarANumero(valor);

  if (numero === null) return "";

  const negativo = numero < 0;

  // Math.round y no Math.trunc: un total de 6.666,65 debe verse 6.667. Si se
  // trunca, dos facturas pueden mostrar totales que no cuadran con la suma
  // visible de sus líneas, y el dueño empieza a desconfiar del sistema.
  const absoluto = Math.abs(aEntero(numero));
  const conSeparador = String(absoluto).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return negativo ? `-${conSeparador}` : conSeparador;
}

/**
 * Monto con símbolo: "₲ 1.500.000".
 * Es el formato por defecto para cualquier cifra de dinero en pantalla.
 */
export function formatMoneda(
  valor: number | string | null | undefined,
  opciones: { conSimbolo?: boolean; espacios?: boolean } = {},
): string {
  const { conSimbolo = true, espacios = true } = opciones;
  const numero = normalizarANumero(valor);

  if (numero === null) return "";

  const milesimas = formatMilesimas(aEntero(numero));
  const separador = espacios ? " " : "";

  return conSimbolo ? `${SIMBOLO_GS}${separador}${milesimas}` : milesimas;
}

/** Monto en dólares con dos decimales: "US$ 1.500,50". */
export function formatMonedaUSD(
  valor: number | string | null | undefined,
): string {
  const numero = normalizarANumero(valor);

  if (numero === null) return "";

  return `US$ ${numero.toLocaleString("es-PY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Monto con los centavos, para las pocas pantallas donde hace falta:
 * nóminas, balances o detalle de cálculo.
 *
 *   6666.65 → "₲ 6.666,65"
 */
export function formatMonedaDecimal(
  valor: number | string | null | undefined,
  decimales = 2,
): string {
  const numero = normalizarANumero(valor);

  if (numero === null) return "";

  const negativo = numero < 0;
  const fijo = Math.abs(numero).toFixed(decimales);
  const [entero, decimal] = fijo.split(".");

  const conMiles = String(Number(entero)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cuerpo = decimal ? `${conMiles},${decimal}` : conMiles;

  return `${negativo ? "-" : ""}${SIMBOLO_GS} ${cuerpo}`;
}

/**
 * Números con decimales de cantidad (litros, kilos, unidades).
 * Aquí sí la coma es decimal, porque "1,5 kg" se lee correctamente.
 */
export function formatCantidad(valor: number | string | null | undefined, decimales = 2): string {
  const numero = normalizarANumero(valor);

  if (numero === null) return "";

  return numero.toLocaleString("es-PY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  });
}

export function formatPorcentaje(valor: number | string | null | undefined, decimales = 1): string {
  const numero = normalizarANumero(valor);

  if (numero === null) return "";

  return `${numero.toLocaleString("es-PY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  })}%`;
}

// ============================================================================
//  ENTRADA DE MONTOS
// ============================================================================

/**
 * Deja pasar únicamente dígitos mientras el usuario escribe, y coloca las
 * milesimas en vivo.
 *
 * Es la función que hace que escribir "1500000" muestre "1.500.000" en el
 * campo. Se aplica en cada pulsación de tecla, no al salir del campo: si se
 * formateara al blur, el usuario vería el texto plano mientras escribe.
 *
 * Decisión: se ignoran los centavos. Si el usuario pega o escribe "1.500.000,50"
 * se queda con 1500000. Es coherente con la regla de que los centavos no
 * circulan, y evita tener que manejar un estado de "pendiente" en el formulario.
 */
export function enmascararMonto(entrada: string): string {
  // Si el usuario pega o escribe con centavos ("1.500.000,50"), se descarta
  // la parte decimal. Los centavos no circulan en Paraguay y conservarlos
  // convertiría el monto en 150000050, un millón de veces más grande.
  const sinDecimales = entrada.includes(",")
    ? entrada.slice(0, entrada.lastIndexOf(","))
    : entrada;

  let soloDigitos = sinDecimales.replace(/\D/g, "");

  if (soloDigitos === "") return "";

  // Los ceros a la izquierda se quitan ANTES de agrupar. Si se quitaran
  // después, "0001500" ya agrupado es "0.001.500" y el patrón de ceros ya no
  // coincide porque el primer carácter va seguido de un punto.
  soloDigitos = soloDigitos.replace(/^0+/, "");
  if (soloDigitos === "") return "0";

  // Se limitan los 12 dígitos: alcanza para 999.999.999.999 guaraníes,
  // muy por encima de cualquier veterinaria, y evita valores absurdos.
  const recortado = soloDigitos.slice(0, 12);

  return recortado.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Convierte lo que el usuario escribió en el número real.
 *
 *   "1.500.000" → 1500000
 *   ""          → null  (campo vacío, no cero: la diferencia importa al validar)
 */
export function desenmascararMonto(entrada: string): number | null {
  const soloDigitos = entrada.replace(/\D/g, "");

  if (soloDigitos === "") return null;

  const numero = Number.parseInt(soloDigitos, 10);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Redondea a los decimales de manejo interno (2) para que lo que viaja al
 * backend coincida con lo que se ve en pantalla.
 */
export function aDosDecimales(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

// ============================================================================
//  FECHAS
// ============================================================================

const FECHA_CORTA = new Intl.DateTimeFormat("es-PY", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Asuncion",
});

const FECHA_HORA = new Intl.DateTimeFormat("es-PY", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Asuncion",
});

const FECHA_LARGA = new Intl.DateTimeFormat("es-PY", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Asuncion",
});

/**
 * Fechas siempre en zona America/Asuncion.
 *
 * No es un detalle: el servidor puede correr en UTC y el usuario en Asunción.
 * Sin fijar la zona, una cita agendada para las 14:00 se ve como las 10:00.
 */
export function formatFecha(fecha: string | Date | null | undefined): string {
  const d = aFecha(fecha);
  return d ? FECHA_CORTA.format(d) : "";
}

/**
 * Fecha calendario sin conversión de zona horaria.
 *
 * Las columnas `@db.Date` llegan como "2026-10-22" o como medianoche UTC. Si
 * se formatean como instantes, en Paraguay pueden mostrar el día anterior.
 */
export function formatFechaCalendario(
  fecha: string | Date | null | undefined,
): string {
  if (!fecha) return "";

  const texto = fecha instanceof Date ? fecha.toISOString() : fecha;
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (!coincidencia) return formatFecha(fecha);

  const [, anio, mes, dia] = coincidencia;
  return `${dia}/${mes}/${anio}`;
}

export function formatFechaHora(fecha: string | Date | null | undefined): string {
  const d = aFecha(fecha);
  return d ? FECHA_HORA.format(d) : "";
}

export function formatFechaLarga(fecha: string | Date | null | undefined): string {
  const d = aFecha(fecha);
  return d ? capitalizar(FECHA_LARGA.format(d)) : "";
}

export function formatHora(fecha: string | Date | null | undefined): string {
  const d = aFecha(fecha);
  if (!d) return "";

  return new Intl.DateTimeFormat("es-PY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Asuncion",
  }).format(d);
}

/** "hace 5 min", "hace 2 h", "ayer". Más legible que una fecha cruda en listas. */
export function formatTiempoRelativo(fecha: string | Date | null | undefined): string {
  const d = aFecha(fecha);
  if (!d) return "";

  const diferenciaMin = Math.round((Date.now() - d.getTime()) / 60000);

  if (diferenciaMin < 1) return "recién";
  if (diferenciaMin < 60) return `hace ${diferenciaMin} min`;

  const diferenciaHoras = Math.round(diferenciaMin / 60);
  if (diferenciaHoras < 24) return `hace ${diferenciaHoras} h`;

  const diferenciaDias = Math.round(diferenciaHoras / 24);
  if (diferenciaDias === 1) return "ayer";
  if (diferenciaDias < 30) return `hace ${diferenciaDias} días`;

  return formatFecha(d);
}

/** Convierte a fecha válida o null. Rechaza lo que no se pueda interpretar. */
export function aFecha(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;

  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ============================================================================
//  UTILIDADES
// ============================================================================

/**
 * Acepta number o string numérico y devuelve number.
 *
 * Prisma devuelve los Decimal como string para no perder precisión, así que
 * este es el puente entre lo que llega de la API y lo que espera un input.
 */
export function normalizarANumero(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  const tieneComa = valor.includes(",");

  let normalizado: string;

  if (tieneComa) {
    // Hay coma: es el separador decimal y todos los puntos son de miles.
    // "1.500.000,50" → 1500000.50
    normalizado = valor.replace(/\./g, "").replace(",", ".");
  } else if ((valor.match(/\./g) ?? []).length > 1) {
    // Varios puntos: todos son de miles. "1.500.000" → 1500000
    normalizado = valor.replace(/\./g, "");
  } else {
    // Un solo punto es ambiguo: puede ser miles o decimal.
    // "1500.50"  → decimal, porque tras el punto hay 2 dígitos.
    // "1.500"    → miles, porque tras el punto hay exactamente 3.
    const partes = valor.split(".");
    const decimales = partes[1] ?? "";

    const esSeparadorDeMiles =
      partes.length === 2 &&
      decimales.length === 3 &&
      partes[0].length >= 1 &&
      partes[0].length <= 3 &&
      !partes[0].startsWith("0");

    normalizado = esSeparadorDeMiles
      ? valor.replace(/\./g, "")
      : valor;
  }

  const numero = Number.parseFloat(normalizado);

  return Number.isFinite(numero) ? numero : null;
}

export function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Iniciales para el avatar: "María González" → "MG". */
export function iniciales(nombre: string | null | undefined): string {
  if (!nombre) return "?";

  const partes = nombre.trim().split(/\s+/).filter(Boolean);

  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();

  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Deja sólo dígitos, para enviar por query params: RUC, cédula, teléfono. */
export function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** Formatea un RUC con guiones: "12345678" → "1.234.567-8". */
export function formatRuc(ruc: string | null | undefined): string {
  const d = soloDigitos(ruc ?? "");
  if (d.length !== 8 && d.length !== 11) return ruc ?? "";

  // Cédula de 8 dígitos: X.XXX.XXX-X  (1.234.567-8)
  if (d.length === 8) {
    return `${d[0]}.${d.slice(1, 4)}.${d.slice(4, 7)}-${d[7]}`;
  }

  // RUC de 11 dígitos: XXX.XXX.XXX-X  (800.123.456-7)
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 10)}-${d[10]}`;
}

/** Teléfono paraguayo visible: "0981123456" → "0981 123 456". */
export function formatTelefono(telefono: string | null | undefined): string {
  const d = soloDigitos(telefono ?? "");
  if (d.length === 10) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return telefono ?? "";
}