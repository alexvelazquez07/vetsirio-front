/**
 * Helpers puros de la pantalla de recuperación de contraseña.
 *
 * El contador se calcula siempre desde la fecha absoluta que devuelve el
 * backend y no restando un segundo por tick: si la pestaña se suspende o el
 * reloj del equipo se atrasa, un contador acumulativo se desfasa y muestra un
 * tiempo que no es el real.
 */

/** Segundos que hay que esperar antes de poder pedir otro código. */
export const SEGUNDOS_ESPERA_REENVIO = 30;

/** Debajo de este tiempo el contador pasa a estado de aviso. */
export const MS_AVISO = 2 * 60 * 1000;

/** Debajo de este tiempo el contador pasa a estado crítico. */
export const MS_CRITICO = 30 * 1000;

export type EstadoTiempo = "normal" | "aviso" | "critico" | "vencido";

/**
 * Milisegundos que faltan para `expiraEn`.
 *
 * Devuelve 0 si la fecha falta, no se puede interpretar o ya pasó. Nunca
 * devuelve un número negativo para que la UI no tenga que defenderse.
 */
export function calcularMsRestantes(
  expiraEn: string | null | undefined,
  ahora: number = Date.now(),
): number {
  if (!expiraEn) return 0;

  const fin = new Date(expiraEn).getTime();

  if (Number.isNaN(fin)) return 0;

  return Math.max(0, fin - ahora);
}

/**
 * Formatea milisegundos como `mm:ss`.
 *
 * Se redondea hacia arriba: con 400 ms restantes todavía se muestra `00:01`,
 * y sólo aparece `00:00` cuando de verdad venció.
 */
export function formatearCuentaRegresiva(msRestantes: number): string {
  const totalSegundos = Math.max(0, Math.ceil(msRestantes / 1000));
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;

  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;
}

/** Porcentaje de tiempo que queda, acotado entre 0 y 100. */
export function porcentajeRestante(msRestantes: number, msTotal: number): number {
  if (msTotal <= 0) return 0;

  return Math.min(100, Math.max(0, (msRestantes / msTotal) * 100));
}

/** Clasifica el tiempo restante para elegir color y mensajes. */
export function estadoDelTiempo(msRestantes: number): EstadoTiempo {
  if (msRestantes <= 0) return "vencido";
  if (msRestantes <= MS_CRITICO) return "critico";
  if (msRestantes <= MS_AVISO) return "aviso";

  return "normal";
}

/** Un código completo son exactamente seis dígitos. */
export function esCodigoCompleto(codigo: string): boolean {
  return /^\d{6}$/.test(codigo);
}

/**
 * Enmascara el correo para mostrarlo en pantalla sin exponerlo entero.
 *
 * `ana@veterinaria.com` → `a***a@veterinaria.com`. Se conserva el dominio para
 * que la persona reconozca la casilla, pero no la parte local completa.
 */
export function enmascararEmail(email: string): string {
  const limpio = email.trim();
  const arroba = limpio.lastIndexOf("@");

  if (arroba <= 0 || arroba === limpio.length - 1) return limpio;

  const local = limpio.slice(0, arroba);
  const dominio = limpio.slice(arroba + 1);

  if (local.length === 1) {
    return `***@${dominio}`;
  }

  return `${local[0]}***${local[local.length - 1]}@${dominio}`;
}

/**
 * Segundos que faltan para poder reenviar el código.
 *
 * Se calcula desde el último envío y no desde un contador que baja: así el
 * botón no queda habilitado antes de tiempo si el navegador suspende la
 * pestaña.
 */
export function segundosParaReenviar(
  ultimoEnvioMs: number | null,
  ahora: number = Date.now(),
  esperaSegundos: number = SEGUNDOS_ESPERA_REENVIO,
): number {
  if (!ultimoEnvioMs) return 0;

  const restante = ultimoEnvioMs + esperaSegundos * 1000 - ahora;

  return Math.max(0, Math.ceil(restante / 1000));
}
