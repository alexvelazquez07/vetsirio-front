import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type { RespuestaPaginada } from "@/types/dominio";

/**
 * Contrato de Caja y Egresos con la API.
 *
 * Los montos llegan como string porque Prisma serializa `Decimal` así; la UI
 * los normaliza con `normalizarANumero`/`formatMoneda`. Nunca se acumulan como
 * `number` en el backend, pero en pantalla sólo se muestran y se comparan.
 */

export const CAJA_POR_PAGINA = 5;
export const EGRESOS_POR_PAGINA = 5;

export type Monto = string | number;

export type EstadoCaja = "abierta" | "cerrada";
export type FiltroEstadoCaja = EstadoCaja | "todas";

export interface UsuarioBasico {
  id: number;
  nombre: string;
  apellido: string;
}

export interface CajaArqueoDetalle {
  id: number;
  denominacion: Monto;
  cantidad: number;
  subtotal: Monto;
  esBillete: boolean;
}

export interface CajaArqueo {
  id: number;
  fecha: string;
  moneda: string;
  montoEsperado: Monto;
  montoContado: Monto;
  diferencia: Monto;
  observaciones: string | null;
  detalles: CajaArqueoDetalle[];
}

export interface CajaSesion {
  id: number;
  fechaApertura: string;
  fechaCierre: string | null;
  moneda: string;
  tipoCambio: Monto | null;
  montoInicial: Monto;
  montoEsperado: Monto | null;
  montoReal: Monto | null;
  diferencia: Monto | null;
  totalIngresosEfectivo: Monto;
  totalEgresosEfectivo: Monto;
  observaciones: string | null;
  estado: EstadoCaja;
  usuarioApertura: UsuarioBasico;
  usuarioCierre: UsuarioBasico | null;
  _count?: {
    ventas: number;
    egresos: number;
    movimientos: number;
  };
  arqueo?: CajaArqueo | null;
}

export interface CajaActual {
  abierta: boolean;
  sesion: CajaSesion | null;
  efectivo: {
    ingresos: Monto;
    egresos: Monto;
    esperado: Monto;
  };
  otrosMedios: {
    ingresos: Monto;
    egresos: Monto;
  };
}

export interface CajaFiltros {
  busqueda?: string;
  pagina?: number;
  estado?: FiltroEstadoCaja;
  desde?: string;
  hasta?: string;
  ordenarPor?: "fecha" | "estado" | "inicial";
  direccion?: "asc" | "desc";
}

export interface AbrirCajaPayload {
  montoInicial?: number;
  observaciones?: string;
}

export interface DetalleArqueoPayload {
  denominacion: number;
  cantidad: number;
  esBillete?: boolean;
}

export interface CerrarCajaPayload {
  montoReal: number;
  detalles?: DetalleArqueoPayload[];
  observaciones?: string;
}

export type TipoEgreso =
  | "compra"
  | "alquiler"
  | "servicios"
  | "impuestos"
  | "pagos"
  | "retiros"
  | "mantenimiento"
  | "salarios"
  | "otros";

export type EstadoEgreso = "registrado" | "anulado";
export type FiltroEstadoEgreso = EstadoEgreso | "todos";

export type MetodoPago =
  | "efectivo"
  | "tarjeta_debito"
  | "tarjeta_credito"
  | "transferencia"
  | "giro"
  | "credito";

export type MonedaEgreso = "PYG" | "USD";

export interface Egreso {
  id: number;
  tipo: TipoEgreso;
  estado: EstadoEgreso;
  concepto: string;
  monto: Monto;
  moneda: string;
  tipoCambio: Monto | null;
  metodoPago: MetodoPago;
  fecha: string;
  comprobanteNum: string | null;
  comprobanteUrl: string | null;
  notas: string | null;
  anuladoEn: string | null;
  anuladoMotivo: string | null;
  creadoEn: string;
  proveedor: {
    id: number;
    razonSocial: string;
    documento: string;
  } | null;
  usuario: UsuarioBasico;
  anuladoPor: UsuarioBasico | null;
  cajaSesion: {
    id: number;
    fechaApertura: string;
    fechaCierre: string | null;
    estado: EstadoCaja;
  };
  facturaCompra: {
    id: number;
    numeroComprobante: string;
  } | null;
  movimientoCaja: {
    id: number;
    monto: Monto;
    afectaEfectivo: boolean;
    metodoPago: MetodoPago;
    fecha: string;
    reversaDeId: number | null;
  } | null;
}

export interface EgresoFiltros {
  busqueda?: string;
  pagina?: number;
  estado?: FiltroEstadoEgreso;
  tipo?: TipoEgreso;
  metodoPago?: MetodoPago;
  proveedorId?: number;
  desde?: string;
  hasta?: string;
  ordenarPor?: "fecha" | "monto";
  direccion?: "asc" | "desc";
}

export interface EgresoPayload {
  tipo: TipoEgreso;
  concepto: string;
  monto: number;
  metodoPago?: MetodoPago;
  moneda?: MonedaEgreso;
  tipoCambio?: number;
  fecha?: string;
  comprobanteNum?: string;
  notas?: string;
  proveedorId?: number;
  facturaCompraId?: number;
}

export const ETIQUETAS_TIPO_EGRESO: Record<TipoEgreso, string> = {
  compra: "Compra",
  alquiler: "Alquiler",
  servicios: "Servicios",
  impuestos: "Impuestos",
  pagos: "Pagos",
  retiros: "Retiros",
  mantenimiento: "Mantenimiento",
  salarios: "Salarios",
  otros: "Otros",
};

export const ETIQUETAS_METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  tarjeta_debito: "Tarjeta débito",
  tarjeta_credito: "Tarjeta crédito",
  transferencia: "Transferencia",
  giro: "Giro",
  credito: "Crédito",
};

function construirQueryCaja(filtros: CajaFiltros): string {
  const {
    busqueda = "",
    pagina = 1,
    estado = "todas",
    desde,
    hasta,
    ordenarPor = "fecha",
    direccion = "desc",
  } = filtros;

  const query = new URLSearchParams({
    pagina: String(pagina),
    porPagina: String(CAJA_POR_PAGINA),
    ordenarPor,
    direccion,
    estado,
  });

  if (busqueda.trim()) query.set("busqueda", busqueda.trim());
  if (desde) query.set("desde", desde);
  if (hasta) query.set("hasta", hasta);

  return query.toString();
}

function construirQueryEgresos(filtros: EgresoFiltros): string {
  const {
    busqueda = "",
    pagina = 1,
    estado = "todos",
    tipo,
    metodoPago,
    proveedorId,
    desde,
    hasta,
    ordenarPor = "fecha",
    direccion = "desc",
  } = filtros;

  const query = new URLSearchParams({
    pagina: String(pagina),
    porPagina: String(EGRESOS_POR_PAGINA),
    ordenarPor,
    direccion,
    estado,
  });

  if (busqueda.trim()) query.set("busqueda", busqueda.trim());
  if (tipo) query.set("tipo", tipo);
  if (metodoPago) query.set("metodoPago", metodoPago);
  if (proveedorId) query.set("proveedorId", String(proveedorId));
  if (desde) query.set("desde", desde);
  if (hasta) query.set("hasta", hasta);

  return query.toString();
}

/** Estado de la caja abierta. Con la caja cerrada devuelve `abierta: false`. */
export function useCajaActual() {
  return useQuery({
    queryKey: ["caja", "actual"],
    queryFn: () => http.get<CajaActual>("/caja/actual"),
    staleTime: 15_000,
  });
}

export function useCajas(filtros: CajaFiltros = {}) {
  return useQuery({
    queryKey: ["caja", "historial", filtros],
    queryFn: () =>
      http.get<RespuestaPaginada<CajaSesion>>(
        `/caja?${construirQueryCaja(filtros)}`,
      ),
    placeholderData: (anterior) => anterior,
  });
}

export function useAbrirCaja() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: AbrirCajaPayload) =>
      http.post<CajaSesion>("/caja/apertura", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["caja"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCerrarCaja() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: CerrarCajaPayload) =>
      http.post<CajaSesion>("/caja/cierre", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["caja"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useEgresos(filtros: EgresoFiltros = {}) {
  return useQuery({
    queryKey: ["caja", "egresos", filtros],
    queryFn: () =>
      http.get<RespuestaPaginada<Egreso>>(
        `/caja/egresos?${construirQueryEgresos(filtros)}`,
      ),
    placeholderData: (anterior) => anterior,
  });
}

export function useCrearEgreso() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: EgresoPayload) =>
      http.post<Egreso>("/caja/egresos", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["caja"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useAnularEgreso() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      http.post<Egreso>(`/caja/egresos/${id}/anular`, { motivo }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["caja"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
