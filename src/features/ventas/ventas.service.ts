import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type {
  Producto,
  RespuestaPaginada,
  Servicio,
} from "@/types/dominio";
import type { PorcentajeIvaVenta } from "./ventas.calculo";

export const VENTAS_POR_PAGINA = 5;

export type TipoComprobanteVenta = "factura" | "factura_credito_fiscal";

export type CondicionPagoVenta = "contado" | "credito";
export type MonedaVenta = "PYG" | "USD";

export type EstadoFacturaVenta = "PENDIENTE" | "ACTIVA" | "ANULADA";
export type EstadoVenta = "todas" | "pendientes" | "activas" | "anuladas";

/** Medios con los que entra el dinero. `credito` no es un pago. */
export type MetodoPagoVenta =
  | "efectivo"
  | "tarjeta_debito"
  | "tarjeta_credito"
  | "transferencia"
  | "giro";

export interface PagoVentaPayload {
  metodo: MetodoPagoVenta;
  monto: number;
  referencia?: string;
}

export interface PagoVenta {
  id: number;
  metodo: MetodoPagoVenta;
  monto: string | number;
  referencia: string | null;
  recibidoEn: string;
}

export interface VentaItem {
  id: number;
  productoId: number | null;
  servicioId?: number | null;
  loteId: number | null;
  descripcion: string;
  codigo: string | null;
  unidadMedida: string | null;
  cantidad: string | number;
  costoUnitario: string | number;
  porcentajeIva: number;
  subtotal: string | number;
  montoIva: string | number;
  total: string | number;
  producto?: {
    id: number;
    codigo: string;
    nombre: string;
    unidadMedida: string;
    /** Stock actual del producto al consultar la venta (no el histórico de la venta). */
    stockActual?: string | number;
  } | null;
  servicio?: {
    id: number;
    codigo: string | null;
    nombre: string;
  } | null;
  lote?: {
    id: number;
    codigoLote: string;
    fechaVencimiento: string | null;
    cantidadActual: string | number;
  } | null;
}

export interface Venta {
  id: number;
  numero: string;
  numeroComprobante: string;
  timbrado: string;
  establecimiento?: string;
  puntoExpedicion?: string;
  tipoComprobante: TipoComprobanteVenta;
  condicionPago: CondicionPagoVenta;
  moneda: MonedaVenta;
  tipoCambio?: string | number | null;
  fechaEmision: string;
  fechaVencimiento: string | null;
  proveedorDocumento?: string;
  proveedorRazonSocial?: string;
  proveedorDireccion?: string | null;
  proveedorTelefono?: string | null;
  proveedorEmail?: string | null;
  subtotal: string | number;
  iva5?: string | number;
  iva10?: string | number;
  exenta?: string | number;
  IVA: string | number;
  total: string | number;
  archivoUrl: string | null;
  observaciones?: string | null;
  estado: EstadoFacturaVenta;
  anulada: boolean;
  anuladaEn?: string | null;
  anuladaMotivo?: string | null;
  creadoEn: string;
  cliente: {
    id: number;
    documento: string;
    razonSocial: string;
    nombreFantasia: string | null;
    /** Nombre listo para mostrar, calculado por el backend. */
    nombreCompleto?: string;
    telefono?: string | null;
  };
  usuario: { id: number; nombre: string; apellido: string };
  items?: VentaItem[];
  pagos?: PagoVenta[];
  /** Suma de los pagos y lo que falta cobrar; los calcula el backend. */
  pagado?: string | number;
  saldo?: string | number;
  _count?: { items: number };
}

export interface VentaResumen {
  periodo: { desde: string; hasta: string };
  activas: number;
  pendientes: number;
  anuladas: number;
  porMoneda: Array<{
    moneda: MonedaVenta;
    compras: number;
    total: number;
    iva: number;
    iva5: number;
    iva10: number;
    exenta: number;
  }>;
}

export interface VentaFiltros {
  busqueda?: string;
  pagina?: number;
  estado?: EstadoVenta;
  desde?: string;
  hasta?: string;
  clienteId?: number;
  ordenarPor?: "fecha" | "numero" | "cliente" | "total" | "recientes";
  direccion?: "asc" | "desc";
}

export type TipoItemVenta = "producto" | "servicio";

export interface VentaItemPayload {
  tipoItem: TipoItemVenta;
  productoId: number | null;
  servicioId: number | null;
  cantidad: number;
  costoUnitario: number;
  porcentajeIva: PorcentajeIvaVenta;
  descripcion?: string;
  codigoLote?: string;
  fechaVencimiento?: string;
}

export interface VentaPayload {
  clienteId: number;
  /** Datos fiscales opcionales: el backend los toma de la configuración si no se envían. */
  timbrado?: string;
  establecimiento?: string;
  puntoExpedicion?: string;
  numero?: string;
  tipoComprobante: TipoComprobanteVenta;
  fechaEmision: string;
  fechaVencimiento?: string;
  condicionPago: CondicionPagoVenta;
  moneda: MonedaVenta;
  tipoCambio?: number;
  estado?: Exclude<EstadoFacturaVenta, "ANULADA">;
  items: VentaItemPayload[];
  /**
   * Cobro de la venta. Opcional: si se omite, la venta se emite sin mover la
   * caja y el cobro se registra después con `POST /ventas/:id/pagos`.
   */
  pagos?: PagoVentaPayload[];
  archivoUrl?: string;
  observaciones?: string;
}

export interface DatosFiscalesVenta {
  numero: number;
  timbrado: string | null;
  puntoExpedicion: string;
  establecimiento: string;
  puedeEmitirFactura: boolean;
  timbradoVencido: boolean;
  motivo: string | null;
}

function construirQuery(filtros: VentaFiltros): string {
  const {
    busqueda = "",
    pagina = 1,
    estado = "todas",
    desde,
    hasta,
    clienteId,
    ordenarPor = "fecha",
    direccion = "desc",
  } = filtros;

  const query = new URLSearchParams({
    pagina: String(pagina),
    porPagina: String(VENTAS_POR_PAGINA),
    ordenarPor,
    direccion,
    estado,
  });

  if (busqueda.trim()) query.set("busqueda", busqueda.trim());
  if (desde) query.set("desde", desde);
  if (hasta) query.set("hasta", hasta);
  if (clienteId) query.set("clienteId", String(clienteId));

  return query.toString();
}

export function useVentas(filtros: VentaFiltros = {}) {
  return useQuery({
    queryKey: ["ventas", filtros],
    queryFn: () =>
      http.get<RespuestaPaginada<Venta>>(`/ventas?${construirQuery(filtros)}`),
    placeholderData: (anterior) => anterior,
  });
}

export function useVentaDetalle(id?: number) {
  return useQuery({
    queryKey: ["ventas", "detalle", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador de la venta.");
      }
      return http.get<Venta>(`/ventas/${id}`);
    },
    enabled: id !== undefined,
  });
}

/**
 * Trae una venta puntual fuera de React Query.
 *
 * La usa la autoimpresión después de activar una venta: el endpoint de
 * activación responde solo un mensaje y la impresora necesita el detalle
 * completo (ítems, pagos y datos fiscales).
 */
export async function obtenerVenta(id: number): Promise<Venta> {
  return http.get<Venta>(`/ventas/${id}`);
}

export function useVentasResumen() {
  return useQuery({
    queryKey: ["ventas", "resumen"],
    queryFn: () => http.get<VentaResumen>("/ventas/resumen"),
  });
}

/**
 * Obtiene el siguiente número de factura y los datos fiscales de la
 * veterinaria (timbrado, punto de expedición, establecimiento), para mostrar
 * al usuario antes de crear una venta. No incrementa el correlativo.
 */
export function useSiguienteNumeroVenta() {
  return useQuery<DatosFiscalesVenta>({
    queryKey: ["ventas", "siguiente-numero"],
    queryFn: () => http.get<DatosFiscalesVenta>("/ventas/siguiente-numero"),
  });
}

export function useBuscarProductosVenta(
  termino: string,
  activo = true,
  excluirIds: number[] = [],
  porPagina = 5,
) {
  return useQuery({
    queryKey: ["productos", "buscar-venta", termino, excluirIds, porPagina],
    queryFn: () => {
      const query = new URLSearchParams({
        busqueda: termino.trim(),
        porPagina: String(porPagina),
        ordenarPor: "nombre",
        direccion: "asc",
      });

      return http.get<RespuestaPaginada<Producto>>(
        `/productos?${query.toString()}`,
      );
    },
    enabled: termino.trim().length > 1 && activo,
    staleTime: 15_000,
    select: (respuesta) => ({
      ...respuesta,
      items: respuesta.items.filter(
        (producto) => !excluirIds.includes(producto.id),
      ),
    }),
  });
}

export async function buscarProductoPorCodigoVenta(codigo: string): Promise<Producto | null> {
  const codigoNormalizado = codigo.trim().toUpperCase();
  if (!codigoNormalizado) return null;

  const query = new URLSearchParams({
    busqueda: codigoNormalizado,
    porPagina: "5",
    ordenarPor: "codigo",
    direccion: "asc",
  });
  const respuesta = await http.get<RespuestaPaginada<Producto>>(
    `/productos?${query.toString()}`,
  );

  return (
    respuesta.items.find(
      (producto) => producto.codigo.trim().toUpperCase() === codigoNormalizado,
    ) ?? null
  );
}

export function useBuscarServiciosVenta(
  termino: string,
  activo = true,
  excluirIds: number[] = [],
  porPagina = 5,
) {
  const busqueda = termino.trim();

  return useQuery({
    queryKey: ["servicios", "buscar-venta", busqueda, excluirIds, porPagina],
    queryFn: () => {
      const query = new URLSearchParams({
        porPagina: String(porPagina),
        ordenarPor: "nombre",
        direccion: "asc",
      });
      if (busqueda) query.set("busqueda", busqueda);

      return http.get<RespuestaPaginada<Servicio>>(
        `/servicios?${query.toString()}`,
      );
    },
    enabled: activo,
    staleTime: 15_000,
    select: (respuesta) => ({
      ...respuesta,
      items: respuesta.items.filter(
        (servicio) =>
          servicio.activo !== false && !excluirIds.includes(servicio.id),
      ),
    }),
  });
}

export async function buscarServicioPorCodigoVenta(
  codigo: string,
): Promise<Servicio | null> {
  const codigoNormalizado = codigo.trim().toUpperCase();
  if (!codigoNormalizado) return null;

  const query = new URLSearchParams({
    busqueda: codigoNormalizado,
    porPagina: "5",
    ordenarPor: "nombre",
    direccion: "asc",
  });
  const respuesta = await http.get<RespuestaPaginada<Servicio>>(
    `/servicios?${query.toString()}`,
  );

  return (
    respuesta.items.find((servicio) => {
      const codigoServicio = servicio.codigo?.trim().toUpperCase();
      const nombre = servicio.nombre.trim().toUpperCase();
      return codigoServicio === codigoNormalizado || nombre === codigoNormalizado;
    }) ?? null
  );
}

export function useCrearVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: VentaPayload) => http.post<Venta>("/ventas", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ventas"] });
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["servicios"] });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Actualiza una venta PENDIENTE sin cambiar su número ni timbrado.
 *
 * El backend reemplaza los ítems y recalcula los totales; si el stock alcanza,
 * la venta puede quedar ACTIVA en la misma operación.
 */
export function useActualizarVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: VentaPayload }) =>
      http.put<Venta>(`/ventas/${id}`, datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ventas"] });
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["servicios"] });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Anula una venta ACTIVA: cancela la factura y revierte stock.
 *
 * Requiere que el backend exponga `POST /ventas/:id/anular` y responda
 * `{ mensaje }`. Si tu ruta es otra, ajustá sólo la URL de `mutationFn`.
 */
export function useAnularVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      http.post<{ mensaje: string }>(`/ventas/${id}/anular`, { motivo }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ventas"] });
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Activa una venta PENDIENTE: ingresa el stock de sus ítems.
 *
 * Requiere que el backend exponga `POST /ventas/:id/activar` y responda
 * `{ mensaje }`. Si tu ruta es otra, ajustá sólo la URL de `mutationFn`.
 */
export function useActivarVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.post<{ mensaje: string }>(`/ventas/${id}/activar`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ventas"] });
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useEliminarVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.delete<{ mensaje: string }>(`/ventas/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ventas"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Cobra una venta ya emitida (crédito o cobro posterior).
 *
 * El backend exige caja abierta y devuelve la venta con `pagado` y `saldo`
 * actualizados. Se invalidan ventas y caja porque el pago entra al libro.
 */
export function useRegistrarPagoVenta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, pago }: { id: number; pago: PagoVentaPayload }) =>
      http.post<Venta>(`/ventas/${id}/pagos`, pago),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ventas"] });
      void queryClient.invalidateQueries({ queryKey: ["caja"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}