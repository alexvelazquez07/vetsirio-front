import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type { PlanVeterinaria, RespuestaPaginada } from "@/types/dominio";

/**
 * Contrato del panel de administración de VetSirio.
 *
 * Estas rutas son exclusivas del SuperAdmin y operan sobre todas las
 * veterinarias. El backend las protege con `@SoloSuperAdmin`; acá sólo se
 * consume el JSON.
 */

export const SOLICITUDES_POR_PAGINA = 5;

/** El backend limita cualquier listado a 5 filas por página. */
export const VETERINARIAS_POR_PAGINA = 5;

export type EstadoSolicitud =
  | "pendiente"
  | "contactada"
  | "cerrada"
  | "cancelada";

export type FiltroEstadoSolicitud = EstadoSolicitud | "todas";

/** Modalidad de pago del plan. El anual cubre 12 meses con descuento. */
export type ModalidadPlan = "mensual" | "anual";

export interface VeterinariaSolicitud {
  id: number;
  nombreComercial: string;
  razonSocial: string;
  ruc: string;
  email: string;
  telefono: string | null;
  plan: PlanVeterinaria;
  planVenceEn: string | null;
  /** Días de prueba con los que se registró (snapshot). */
  trialDias: number;
  trialInicio: string | null;
  trialFin: string | null;
  activa: boolean;
  suspendidaMotivo: string | null;
}

export interface UsuarioSolicitud {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
}

export interface SolicitudAdmin {
  id: number;
  veterinariaId: number;
  usuarioId: number;
  emailContacto: string;
  whatsapp: string;
  comentario: string | null;
  modalidad: ModalidadPlan;
  precioSnapshot: string;
  moneda: string;
  estado: EstadoSolicitud;
  creadoEn: string;
  atendidaEn: string | null;
  atendidaPor: number | null;
  veterinaria: VeterinariaSolicitud;
  usuario: UsuarioSolicitud | null;
}

export interface FiltrosSolicitudes {
  estado: FiltroEstadoSolicitud;
  busqueda: string;
  pagina: number;
}

export interface ActivarSolicitudPayload {
  id: number;
  meses: number;
  plan?: PlanVeterinaria;
}

export interface RespuestaActivacion {
  mensaje: string;
  plan: string;
  iniciaEn: string;
  planVenceEn: string;
  solicitudId: number;
}

export interface ActualizarSolicitudPayload {
  id: number;
  /** Estado interno de la bandeja. Opcional si se editan los meses. */
  estado?: EstadoSolicitud;
  /** Vigencia en meses desde hoy. Sólo para planes pagos. */
  meses?: number;
}

export interface RespuestaActualizacion {
  mensaje: string;
  estado: EstadoSolicitud;
  planVenceEn: string | null;
}

/** Una clave de `ConfiguracionGlobal` tal como la devuelve `GET /admin/config`. */
export interface ConfiguracionGlobalItem {
  valor: string;
  descripcion: string | null;
  actualizadoEn: string;
  actualizadoPor: string | null;
}

/** Configuración agrupada por categoría (`trial`, `suscripcion`, …). */
export type ConfiguracionGlobal = Record<
  string,
  Record<string, ConfiguracionGlobalItem>
>;

export interface RespuestaSuscripcion {
  mensaje: string;
  precioMensual: number;
  precioAnual: number;
  moneda: string;
}

export interface PreciosSuscripcionPayload {
  precioMensual?: number;
  precioAnual?: number;
}

function construirQuery(filtros: FiltrosSolicitudes): string {
  const query = new URLSearchParams({
    estado: filtros.estado,
    pagina: String(filtros.pagina),
    porPagina: String(SOLICITUDES_POR_PAGINA),
  });

  const busqueda = filtros.busqueda.trim();

  if (busqueda) {
    query.set("busqueda", busqueda);
  }

  return query.toString();
}

export function useSolicitudes(filtros: FiltrosSolicitudes) {
  return useQuery({
    queryKey: ["admin", "solicitudes", filtros],
    queryFn: () =>
      http.get<RespuestaPaginada<SolicitudAdmin>>(
        `/admin/solicitudes?${construirQuery(filtros)}`,
      ),
    placeholderData: (anterior) => anterior,
    staleTime: 15_000,
  });
}

export function useActivarSolicitud() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, meses, plan }: ActivarSolicitudPayload) =>
      http.post<RespuestaActivacion>(`/admin/solicitudes/${id}/activar`, {
        meses,
        plan,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "solicitudes"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "veterinarias"],
      });
    },
  });
}

/** Edita el estado y/o la vigencia de una solicitud ya registrada. */
export function useActualizarSolicitud() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, estado, meses }: ActualizarSolicitudPayload) =>
      http.patch<RespuestaActualizacion>(`/admin/solicitudes/${id}`, {
        estado,
        meses,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "solicitudes"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "veterinarias"],
      });
    },
  });
}

export interface SuspenderVeterinariaPayload {
  veterinariaId: number;
  motivo: string;
}

/**
 * Corta el acceso de una veterinaria al instante. El motivo es obligatorio y
 * el cliente lo lee en la app, por eso no alcanza con un booleano.
 */
export function useSuspenderVeterinaria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ veterinariaId, motivo }: SuspenderVeterinariaPayload) =>
      http.post<{ mensaje: string }>(
        `/admin/veterinarias/${veterinariaId}/suspender`,
        { motivo },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "solicitudes"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "veterinarias"],
      });
    },
  });
}

/** Devuelve el acceso a una veterinaria suspendida. */
export function useReactivarVeterinaria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (veterinariaId: number) =>
      http.post<{ mensaje: string }>(
        `/admin/veterinarias/${veterinariaId}/reactivar`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "solicitudes"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "veterinarias"],
      });
    },
  });
}

/** Configuración global de la plataforma, agrupada por categoría. */
export function useConfigAdmin() {
  return useQuery({
    queryKey: ["admin", "config"],
    queryFn: () => http.get<ConfiguracionGlobal>("/admin/config"),
    staleTime: 30_000,
  });
}

/** Cambia los precios del plan, en guaraníes. */
export function useActualizarSuscripcion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (precios: PreciosSuscripcionPayload) =>
      http.patch<RespuestaSuscripcion>("/admin/config/suscripcion", precios),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "config"] });
      // El precio también se muestra en /suscripcion y en Configuración.
      void queryClient.invalidateQueries({ queryKey: ["suscripcion"] });
      void queryClient.invalidateQueries({ queryKey: ["configuracion"] });
    },
  });
}

export interface TrialGlobalPayload {
  /** Días de prueba para las veterinarias que se registren desde ahora. */
  diasTrial: number;
  /** Días de antelación con los que el sistema avisa al cliente. */
  diasAviso: number;
}

export interface RespuestaTrialGlobal {
  mensaje: string;
  diasTrialPorDefecto: number;
  trialAvisoDias: number;
}

/**
 * Cambia los días de prueba por defecto de toda la plataforma.
 *
 * No toca los trials ya arrancados: cada veterinaria guarda el snapshot de días
 * con el que se registró. Para cambiar una cuenta puntual está
 * `useActualizarTrialVeterinaria`.
 */
export function useActualizarTrialGlobal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TrialGlobalPayload) =>
      http.patch<RespuestaTrialGlobal>("/admin/config/trial", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "config"] });
    },
  });
}

export interface TrialVeterinariaPayload {
  veterinariaId: number;
  diasTrial: number;
}

export interface RespuestaTrialVeterinaria {
  mensaje: string;
  trialDias: number;
  trialInicio: string;
  trialFin: string;
}

/**
 * Fija los días de prueba de una veterinaria concreta.
 *
 * Sólo aplica a cuentas en trial: si ya compró un plan, el período de prueba
 * dejó de existir y la fecha relevante es la del plan.
 */
export function useActualizarTrialVeterinaria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ veterinariaId, diasTrial }: TrialVeterinariaPayload) =>
      http.patch<RespuestaTrialVeterinaria>(
        `/admin/veterinarias/${veterinariaId}/trial`,
        { diasTrial },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "solicitudes"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "veterinarias"],
      });
      // El vencimiento del trial se muestra en la sesión del cliente.
      void queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

/** Estado de suscripción calculado por el backend para el panel global. */
export interface EstadoSuscripcionAdmin {
  plan: PlanVeterinaria;
  enTrial: boolean;
  suspendida: boolean;
  expirado: boolean;
  diasRestantes: number | null;
  motivoBloqueo: string | null;
}

/** Fila del listado de veterinarias del panel global. */
export interface VeterinariaAdmin {
  id: number;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  email: string;
  telefono: string | null;
  plan: PlanVeterinaria;
  trialDias: number;
  trialInicio: string | null;
  trialFin: string | null;
  planVenceEn: string | null;
  activa: boolean;
  suspendidaMotivo: string | null;
  maxUsuarios: number;
  creadoEn: string;
  ultimaActividadEn: string | null;
  estadoSuscripcion: EstadoSuscripcionAdmin;
}

export interface FiltrosVeterinariasAdmin {
  busqueda: string;
  pagina: number;
}

/**
 * Veterinarias en período de prueba.
 *
 * Filtra por `plan=trial` a propósito: esta lista sirve para ajustar plazos de
 * prueba, no para administrar clientes con plan pago.
 */
export function useVeterinariasEnTrial({
  busqueda,
  pagina,
}: FiltrosVeterinariasAdmin) {
  return useQuery({
    queryKey: ["admin", "veterinarias", { busqueda, pagina }],
    queryFn: () => {
      const query = new URLSearchParams({
        plan: "trial",
        pagina: String(pagina),
        porPagina: String(VETERINARIAS_POR_PAGINA),
      });

      const texto = busqueda.trim();

      if (texto) {
        query.set("busqueda", texto);
      }

      return http.get<RespuestaPaginada<VeterinariaAdmin>>(
        `/admin/veterinarias?${query.toString()}`,
      );
    },
    placeholderData: (anterior) => anterior,
    staleTime: 15_000,
  });
}
