/**
 * Cálculos puros de Caja.
 *
 * El backend es la autoridad final: recalcula el esperado y la diferencia al
 * cerrar. Estas funciones existen para que el usuario vea el descuadre mientras
 * carga el arqueo, sin esperar el viaje al servidor.
 */

export interface DetalleArqueoCalculo {
  denominacion: number;
  cantidad: number;
}

export interface DenominacionArqueo {
  valor: number;
  esBillete: boolean;
}

/** Denominaciones vigentes en guaraníes, de mayor a menor. */
export const DENOMINACIONES_PYG: DenominacionArqueo[] = [
  { valor: 100000, esBillete: true },
  { valor: 50000, esBillete: true },
  { valor: 20000, esBillete: true },
  { valor: 10000, esBillete: true },
  { valor: 5000, esBillete: true },
  { valor: 2000, esBillete: true },
  { valor: 1000, esBillete: true },
  { valor: 500, esBillete: false },
  { valor: 100, esBillete: false },
  { valor: 50, esBillete: false },
];

export function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Suma el desglose de billetes y monedas del arqueo. */
export function sumarDetallesArqueo(detalles: DetalleArqueoCalculo[]): number {
  return redondear2(
    detalles.reduce(
      (total, detalle) =>
        total + detalle.denominacion * Math.max(0, detalle.cantidad),
      0,
    ),
  );
}

/** Negativo = faltante; positivo = sobrante; cero = cuadrado. */
export function calcularDiferencia(contado: number, esperado: number): number {
  return redondear2(contado - esperado);
}

export type EstadoDiferencia = "cuadrada" | "sobrante" | "faltante";

export function estadoDiferencia(diferencia: number): EstadoDiferencia {
  if (redondear2(diferencia) === 0) return "cuadrada";
  return diferencia > 0 ? "sobrante" : "faltante";
}

/** Fecha de hoy en formato AAAA-MM-DD, sin desplazamiento de zona horaria. */
export function fechaHoyCalendario(): string {
  const ahora = new Date();
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
