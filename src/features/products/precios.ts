import type { ProductoPrecio, TipoPrecioProducto } from "@/types/dominio";

/** Fila editable de la grilla de precios del formulario de producto. */
export interface PrecioFormulario {
  key: string;
  id?: number;
  tipo: TipoPrecioProducto;
  monto: number | null;
  vigenteDesde: string;
  vigenteHasta: string;
}

export interface PrecioConVigencia {
  vigenteDesde: string;
  vigenteHasta?: string | null;
  monto: string | number | null;
}

let secuencia = 0;

export function fechaHoyCalendario(): string {
  const ahora = new Date();
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function soloFecha(valor?: string | null): string {
  return valor ? valor.slice(0, 10) : "";
}

export function nuevoPrecio(tipo: TipoPrecioProducto): PrecioFormulario {
  secuencia += 1;

  return {
    key: `precio-nuevo-${secuencia}`,
    tipo,
    monto: null,
    vigenteDesde: fechaHoyCalendario(),
    vigenteHasta: "",
  };
}

export function precioDesdeProducto(precio: ProductoPrecio): PrecioFormulario {
  return {
    key: `precio-${precio.id}`,
    id: precio.id,
    tipo: precio.tipo,
    monto: Number(precio.monto),
    vigenteDesde: soloFecha(precio.vigenteDesde),
    vigenteHasta: soloFecha(precio.vigenteHasta),
  };
}

/**
 * Precio cuya vigencia cubre la fecha. Si hay vigencias superpuestas gana la
 * de inicio más reciente, igual que en el backend.
 */
export function resolverPrecioVigente<T extends PrecioConVigencia>(
  precios: T[],
  fecha: string,
): T | null {
  const dia = soloFecha(fecha);
  const vigentes = precios.filter((precio) => {
    if (precio.monto === null || precio.monto === "") return false;
    const desde = soloFecha(precio.vigenteDesde);
    const hasta = soloFecha(precio.vigenteHasta);
    if (!desde || desde > dia) return false;
    return !hasta || hasta >= dia;
  });

  vigentes.sort((a, b) =>
    soloFecha(b.vigenteDesde).localeCompare(soloFecha(a.vigenteDesde)),
  );

  return vigentes[0] ?? null;
}

export function precioVigenteDe(
  precios: Array<PrecioFormulario | ProductoPrecio>,
  tipo: TipoPrecioProducto,
  fecha = fechaHoyCalendario(),
): PrecioFormulario | ProductoPrecio | null {
  return resolverPrecioVigente(
    precios.filter((precio) => precio.tipo === tipo),
    fecha,
  );
}

export function montoVigente(
  precios: Array<PrecioFormulario | ProductoPrecio>,
  tipo: TipoPrecioProducto,
  fecha = fechaHoyCalendario(),
): number {
  const precio = precioVigenteDe(precios, tipo, fecha);
  return precio ? Number(precio.monto) : 0;
}

export type EstadoPrecio = "vigente" | "programado" | "vencido" | "sin_fecha";

export function estadoPrecio(
  precio: Pick<PrecioFormulario, "vigenteDesde" | "vigenteHasta">,
  fecha = fechaHoyCalendario(),
): EstadoPrecio {
  const dia = soloFecha(fecha);
  const desde = soloFecha(precio.vigenteDesde);
  const hasta = soloFecha(precio.vigenteHasta);

  if (!desde) return "sin_fecha";
  if (desde > dia) return "programado";
  if (hasta && hasta < dia) return "vencido";
  return "vigente";
}
