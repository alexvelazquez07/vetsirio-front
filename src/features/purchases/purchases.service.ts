import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type {
  Producto,
  Proveedor,
  RespuestaPaginada,
} from "@/types/dominio";
import type { PorcentajeIvaCompra } from "./purchases.calculo";

export const COMPRAS_POR_PAGINA = 5;

export type TipoComprobanteCompra = "factura" | "factura_credito_fiscal";

export type CondicionPagoCompra = "contado" | "credito";
export type MonedaCompra = "PYG" | "USD";
export type EstadoFacturaCompra = "PENDIENTE" | "ACTIVA" | "ANULADA";
export type EstadoCompra = "todas" | "pendientes" | "activas" | "anuladas";

export interface CompraItem {
  id: number;
  productoId: number | null;
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
  } | null;
  lote?: {
    id: number;
    codigoLote: string;
    fechaVencimiento: string | null;
    cantidadActual: string | number;
  } | null;
}

export interface Compra {
  id: number;
  numero: string;
  numeroComprobante: string;
  timbrado: string;
  establecimiento?: string;
  puntoExpedicion?: string;
  tipoComprobante: TipoComprobanteCompra;
  condicionPago: CondicionPagoCompra;
  moneda: MonedaCompra;
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
  estado: EstadoFacturaCompra;
  anulada: boolean;
  anuladaEn?: string | null;
  anuladaMotivo?: string | null;
  creadoEn: string;
  proveedor: Proveedor;
  proveedorNombre?: string;
  usuario: { id: number; nombre: string; apellido: string };
  items?: CompraItem[];
  _count?: { items: number };
}

export interface CompraResumen {
  periodo: { desde: string; hasta: string };
  activas: number;
  pendientes: number;
  anuladas: number;
  porMoneda: Array<{
    moneda: MonedaCompra;
    compras: number;
    total: number;
    iva: number;
    iva5: number;
    iva10: number;
    exenta: number;
  }>;
}

export interface CompraFiltros {
  busqueda?: string;
  pagina?: number;
  estado?: EstadoCompra;
  desde?: string;
  hasta?: string;
  proveedorId?: number;
  ordenarPor?: "fecha" | "numero" | "proveedor" | "total" | "recientes";
  direccion?: "asc" | "desc";
}

export interface CompraItemPayload {
  productoId: number;
  cantidad: number;
  costoUnitario: number;
  porcentajeIva: PorcentajeIvaCompra;
  descripcion?: string;
  codigoLote?: string;
  fechaVencimiento?: string;
}

export interface CompraPayload {
  proveedorId: number;
  timbrado: string;
  establecimiento: string;
  puntoExpedicion: string;
  numero: string;
  tipoComprobante: TipoComprobanteCompra;
  fechaEmision: string;
  fechaVencimiento?: string;
  condicionPago: CondicionPagoCompra;
  moneda: MonedaCompra;
  tipoCambio?: number;
  estado?: Exclude<EstadoFacturaCompra, "ANULADA">;
  items: CompraItemPayload[];
  archivoUrl?: string;
  observaciones?: string;
}

function construirQuery(filtros: CompraFiltros): string {
  const {
    busqueda = "",
    pagina = 1,
    estado = "todas",
    desde,
    hasta,
    proveedorId,
    ordenarPor = "fecha",
    direccion = "desc",
  } = filtros;

  const query = new URLSearchParams({
    pagina: String(pagina),
    porPagina: String(COMPRAS_POR_PAGINA),
    ordenarPor,
    direccion,
    estado,
  });

  if (busqueda.trim()) query.set("busqueda", busqueda.trim());
  if (desde) query.set("desde", desde);
  if (hasta) query.set("hasta", hasta);
  if (proveedorId) query.set("proveedorId", String(proveedorId));

  return query.toString();
}

export function useCompras(filtros: CompraFiltros = {}) {
  return useQuery({
    queryKey: ["compras", filtros],
    queryFn: () =>
      http.get<RespuestaPaginada<Compra>>(`/compras?${construirQuery(filtros)}`),
    placeholderData: (anterior) => anterior,
  });
}

export function useCompraDetalle(id?: number) {
  return useQuery({
    queryKey: ["compras", "detalle", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador de la compra.");
      }
      return http.get<Compra>(`/compras/${id}`);
    },
    enabled: id !== undefined,
  });
}

export function useComprasResumen() {
  return useQuery({
    queryKey: ["compras", "resumen"],
    queryFn: () => http.get<CompraResumen>("/compras/resumen"),
  });
}

export function useBuscarProductosCompra(
  termino: string,
  activo = true,
  excluirIds: number[] = [],
  porPagina = 5,
) {
  return useQuery({
    queryKey: ["productos", "buscar-compra", termino, excluirIds, porPagina],
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

export async function buscarProductoPorCodigo(codigo: string): Promise<Producto | null> {
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

export function useCrearCompra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: CompraPayload) => http.post<Compra>("/compras", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compras"] });
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["proveedores"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

/**
 * Activa una compra PENDIENTE: ingresa el stock de sus ítems.
 *
 * Requiere que el backend exponga `POST /compras/:id/activar` y responda
 * `{ mensaje }`. Si tu ruta es otra, ajustá sólo la URL de `mutationFn`.
 */
export function useActivarCompra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.post<{ mensaje: string }>(`/compras/${id}/activar`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compras"] });
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useAnularCompra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo: string }) =>
      http.post<{ mensaje: string }>(`/compras/${id}/anular`, { motivo }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compras"] });
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useEliminarCompra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.delete<{ mensaje: string }>(`/compras/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compras"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}