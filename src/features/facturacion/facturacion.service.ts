import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type { RespuestaPaginada } from "@/types/dominio";

export const FACTURACION_POR_PAGINA = 5;

export type TipoDocumentoFiscal =
  | "ticket"
  | "factura"
  | "factura_credito_fiscal"
  | "nota_credito"
  | "nota_debito";

export type EstadoSifen =
  | "no_aplica"
  | "pendiente"
  | "aceptado"
  | "rechazado"
  | "anulado";

export type EstadoComprobante = "todas" | "vigentes" | "pendientes" | "anuladas";

export type EstadoComprobanteFiscal = "PENDIENTE" | "ACTIVA" | "ANULADA";

export type MonedaFiscal = "PYG" | "USD";

export interface EstadoTimbradoFiscal {
  timbrado: boolean;
  vencido: boolean;
  puedeEmitirFactura: boolean;
  puedeEmitirTicket: boolean;
  motivo: string | null;
}

export interface TimbradoFiscal {
  timbradoNro: string | null;
  timbradoFechaInicio: string | null;
  timbradoFechaVencimiento: string | null;
  puntoVenta: string;
  establecimiento: string;
  correlativoActual: number;
  siguienteNumero: number;
  emitirTicketSinTimbrado: boolean;
  estadoTimbrado: EstadoTimbradoFiscal;
}

export interface ComprobanteFiscal {
  id: number;
  numero: string;
  numeroComprobante: string;
  timbrado: string | null;
  establecimiento: string | null;
  puntoVenta: string | null;
  puntoExpedicion: string | null;
  tipoDocumento: TipoDocumentoFiscal;
  tipoComprobante: TipoDocumentoFiscal;
  condicionPago: "contado" | "credito";
  moneda: MonedaFiscal;
  fechaEmision: string;
  fechaVencimiento: string | null;
  subtotal: string | number;
  descuento: string | number;
  iva5: string | number;
  iva10: string | number;
  exenta: string | number;
  IVA: string | number;
  total: string | number;
  estado: EstadoComprobanteFiscal;
  anulada: boolean;
  anuladaEn: string | null;
  anuladaMotivo: string | null;
  archivoUrl: string | null;
  cdcId: string | null;
  estadoSifen: EstadoSifen;
  hashDocumento: string | null;
  observaciones?: string | null;
  creadoEn: string;
  cliente: {
    id: number;
    documento: string | null;
    razonSocial: string | null;
    nombres?: string | null;
    apellidos?: string | null;
    nombreCompleto?: string | null;
    telefono?: string | null;
  } | null;
  usuario: { id: number; nombre: string; apellido: string };
  items?: ComprobanteItem[];
  pagos?: PagoComprobante[];
  pagado?: string | number;
  saldo?: string | number;
  _count?: { items: number };
}

export interface ComprobanteItem {
  id: number;
  descripcion: string;
  codigo: string | null;
  unidadMedida: string | null;
  cantidad: string | number;
  precioUnitario: string | number;
  costoUnitario?: string | number;
  descuento: string | number;
  porcentajeIva: number;
  subtotal: string | number;
  montoIva: string | number;
  total: string | number;
}

export interface PagoComprobante {
  id: number;
  metodo: string;
  monto: string | number;
  referencia: string | null;
  recibidoEn: string;
}

export interface ResumenFacturacion {
  periodo: { desde: string; hasta: string };
  timbrado: TimbradoFiscal;
  comprobantes: {
    total: number;
    vigentes: number;
    pendientes: number;
    anuladas: number;
    facturas: number;
    tickets: number;
    notasCredito: number;
    notasDebito: number;
  };
  porTipoDocumento: Array<{
    tipoDocumento: TipoDocumentoFiscal;
    cantidad: number;
  }>;
  porEstadoSifen: Array<{ estado: EstadoSifen; cantidad: number }>;
  porMoneda: Array<{
    moneda: MonedaFiscal;
    cantidad: number;
    total: number;
    iva: number;
    iva5: number;
    iva10: number;
    exenta: number;
  }>;
}

export interface FiltrosComprobantes {
  busqueda?: string;
  pagina?: number;
  tipoDocumento?: TipoDocumentoFiscal;
  estadoSifen?: EstadoSifen;
  estado?: EstadoComprobante;
  desde?: string;
  hasta?: string;
  clienteId?: number;
  ordenarPor?: "fecha" | "numero" | "total" | "cliente" | "recientes";
  direccion?: "asc" | "desc";
}

export interface PeriodoFacturacion {
  desde?: string;
  hasta?: string;
}

export interface TimbradoPayload {
  timbradoNro?: string;
  timbradoFechaInicio?: string | null;
  timbradoFechaVencimiento?: string | null;
  puntoVenta?: string;
  establecimiento?: string;
  emitirTicketSinTimbrado?: boolean;
}

function construirQuery(filtros: FiltrosComprobantes): string {
  const {
    busqueda = "",
    pagina = 1,
    tipoDocumento,
    estadoSifen,
    estado = "todas",
    desde,
    hasta,
    clienteId,
    ordenarPor = "fecha",
    direccion = "desc",
  } = filtros;

  const query = new URLSearchParams({
    pagina: String(pagina),
    porPagina: String(FACTURACION_POR_PAGINA),
    ordenarPor,
    direccion,
    estado,
  });

  if (busqueda.trim()) query.set("busqueda", busqueda.trim());
  if (tipoDocumento) query.set("tipoDocumento", tipoDocumento);
  if (estadoSifen) query.set("estadoSifen", estadoSifen);
  if (desde) query.set("desde", desde);
  if (hasta) query.set("hasta", hasta);
  if (clienteId) query.set("clienteId", String(clienteId));

  return query.toString();
}

export function useComprobantesFiscales(filtros: FiltrosComprobantes = {}) {
  return useQuery({
    queryKey: ["facturacion", "comprobantes", filtros],
    queryFn: () =>
      http.get<RespuestaPaginada<ComprobanteFiscal>>(
        `/facturacion/comprobantes?${construirQuery(filtros)}`,
      ),
    placeholderData: (anterior) => anterior,
  });
}

export function useComprobanteFiscal(id?: number) {
  return useQuery({
    queryKey: ["facturacion", "comprobante", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador del comprobante.");
      }
      return http.get<ComprobanteFiscal>(`/facturacion/comprobantes/${id}`);
    },
    enabled: id !== undefined,
  });
}

export function useResumenFacturacion(periodo: PeriodoFacturacion = {}) {
  const query = new URLSearchParams();
  if (periodo.desde) query.set("desde", periodo.desde);
  if (periodo.hasta) query.set("hasta", periodo.hasta);

  const sufijo = query.toString();

  return useQuery({
    queryKey: ["facturacion", "resumen", sufijo],
    queryFn: () =>
      http.get<ResumenFacturacion>(
        `/facturacion/resumen${sufijo ? `?${sufijo}` : ""}`,
      ),
  });
}

export function useTimbradoFiscal() {
  return useQuery({
    queryKey: ["facturacion", "timbrado"],
    queryFn: () => http.get<TimbradoFiscal>("/facturacion/timbrado"),
  });
}

export function useActualizarTimbrado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: TimbradoPayload) =>
      http.patch<TimbradoFiscal>("/facturacion/timbrado", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["facturacion"] });
      // El siguiente número y la habilitación para facturar también alimentan
      // la pantalla de Ventas.
      void queryClient.invalidateQueries({ queryKey: ["ventas"] });
      void queryClient.invalidateQueries({ queryKey: ["configuracion"] });
    },
  });
}
