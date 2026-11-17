import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type { EstadoSuscripcion } from "@/types/dominio";

/**
 * Contrato de la pantalla /suscripcion.
 *
 * El precio y el estado salen del backend: el frontend no calcula ni inventa
 * montos. La solicitud no activa el plan, sólo avisa al equipo de VetSirio.
 */

export type ModalidadPlan = "mensual" | "anual";

export interface SolicitudPlan {
  id: number;
  whatsapp: string;
  emailContacto: string;
  comentario: string | null;
  modalidad: ModalidadPlan;
  precioSnapshot: string;
  moneda: string;
  estado: "pendiente" | "contactada" | "cerrada" | "cancelada";
  creadoEn: string;
  /** Cuándo empieza a regir el plan pedido, si el actual sigue vigente. */
  iniciaEn: string;
}

export interface ResumenSuscripcion {
  precioMensual: string | null;
  precioAnual: string | null;
  moneda: string;
  estadoSuscripcion: EstadoSuscripcion;
  solicitudPendiente: SolicitudPlan | null;
}

export interface SolicitarPlanPayload {
  whatsapp: string;
  emailContacto: string;
  comentario?: string;
  /** Por defecto el backend asume mensual. */
  modalidad?: ModalidadPlan;
}

export interface RespuestaSolicitudPlan {
  mensaje: string;
  solicitudId: number;
  yaExistente: boolean;
}

export function useSuscripcion() {
  return useQuery({
    queryKey: ["suscripcion"],
    queryFn: () => http.get<ResumenSuscripcion>("/suscripcion"),
    staleTime: 30_000,
  });
}

export function useSolicitarPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: SolicitarPlanPayload) =>
      http.post<RespuestaSolicitudPlan>("/suscripcion/solicitud", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["suscripcion"] });
      // El banner y el estado del plan también dependen de esto.
      void queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}
