import { useQuery } from "@tanstack/react-query";

import type { EstadoCita } from "@/features/agenda/agenda.service";
import { http } from "@/services/api";

/**
 * Contrato del panel de inicio con la API.
 *
 * El backend arma todo en un solo request y deja en `null` los bloques que el
 * rol no puede ver. Así el frontend no tiene que hacer cinco consultas ni
 * mostrar secciones que después responderían 403.
 */

export type MontoPanel = string | number;

export interface CitaPanel {
  id: number;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoCita;
  motivo: string;
  motivoCita: { id: number; nombre: string; color: string } | null;
  paciente: {
    id: number;
    nombre: string;
    cliente: {
      id: number;
      nombres: string | null;
      apellidos: string | null;
      razonSocial: string | null;
      telefono: string | null;
    } | null;
  };
  veterinario: { id: number; nombre: string; apellido: string } | null;
}

export interface CitasPanel {
  total: number;
  porAtender: number;
  atendidas: number;
  proximas: CitaPanel[];
}

export type EstadoVentaPanel = "PENDIENTE" | "ACTIVA" | "ANULADA";

export interface VentaPanel {
  id: number;
  numeroComprobante: string;
  tipoDocumento: string;
  fecha: string;
  total: MontoPanel;
  moneda: string;
  estado: EstadoVentaPanel;
  anulada: boolean;
  cliente: { id: number; nombreCompleto: string | null } | null;
}

export interface VentasPanel {
  hoy: {
    cantidad: number;
    totales: Array<{
      moneda: string;
      cantidad: number;
      total: MontoPanel;
    }>;
  };
  recientes: VentaPanel[];
}

export type CajaPanel =
  | { abierta: false }
  | {
      abierta: true;
      moneda: string;
      fechaApertura: string;
      montoInicial: MontoPanel;
      ingresos: MontoPanel;
      egresos: MontoPanel;
      esperado: MontoPanel;
    };

export interface LoteCritico {
  id: number;
  codigoLote: string;
  cantidadActual: MontoPanel;
  fechaVencimiento: string;
  diasRestantes: number;
  vencido: boolean;
  producto: {
    id: number;
    codigo: string;
    nombre: string;
    unidadMedida: string;
  };
}

export interface ProductoBajoStock {
  id: number;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  stockActual: MontoPanel;
  stockMinimo: MontoPanel;
}

export interface InventarioPanel {
  porVencer: number;
  vencidos: number;
  bajoStock: number;
  agotados: number;
  lotesCriticos: LoteCritico[];
  productosBajoStock: ProductoBajoStock[];
}

export interface PanelDashboard {
  generadoEn: string;
  citas: CitasPanel | null;
  ventas: VentasPanel | null;
  caja: CajaPanel | null;
  inventario: InventarioPanel | null;
}

/**
 * La clave `["dashboard"]` es la que ya invalidan ventas, productos, caja,
 * clientes y agenda después de cada mutación.
 */
export function usePanelDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => http.get<PanelDashboard>("/panel"),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
