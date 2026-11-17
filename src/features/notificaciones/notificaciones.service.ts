import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";

/**
 * Contrato de la bandeja de notificaciones con la API.
 *
 * El backend devuelve las últimas 30 y el total de no leídas en la misma
 * respuesta: la campanita necesita el contador antes de abrir el panel, y una
 * segunda petición sólo para el badge duplicaría el trabajo en cada refresco.
 */

export const CLAVE_NOTIFICACIONES = ["notificaciones"] as const;

export type TipoNotificacion = "info" | "exito" | "alerta" | "error";

export interface Notificacion {
  id: number;
  /** Null cuando el aviso es para todo el equipo de la veterinaria. */
  usuarioId: number | null;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  /** Ruta interna a la que lleva el aviso, si tiene una. */
  url: string | null;
  leida: boolean;
  leidaEn: string | null;
  creadoEn: string;
}

export interface RespuestaNotificaciones {
  items: Notificacion[];
  noLeidas: number;
}

/** Cada minuto alcanza: las notificaciones no son datos de tiempo real. */
const REFRESCO_MS = 60_000;

export function useNotificaciones() {
  return useQuery({
    queryKey: CLAVE_NOTIFICACIONES,
    queryFn: () => http.get<RespuestaNotificaciones>("/notificaciones"),
    staleTime: 30_000,
    refetchInterval: REFRESCO_MS,
    refetchOnWindowFocus: true,
    // Sin sesión la campanita no se muestra; si el endpoint falla, es mejor
    // dejar el badge anterior que romper toda la barra superior.
    retry: 1,
  });
}

/**
 * Marca una notificación como leída de forma optimista.
 *
 * El badge y el punto de "no leída" tienen que responder al primer clic: si
 * esperáramos el viaje al servidor, el panel se cerraría (o navegaría) con el
 * contador todavía intacto y parecería que el clic no hizo nada.
 */
export function useMarcarNotificacionLeida() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.patch<{ id: number; leida: boolean }>(`/notificaciones/${id}/leer`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: CLAVE_NOTIFICACIONES });

      const anterior = queryClient.getQueryData<RespuestaNotificaciones>(CLAVE_NOTIFICACIONES);

      if (anterior) {
        const estabaSinLeer = anterior.items.some((item) => item.id === id && !item.leida);

        queryClient.setQueryData<RespuestaNotificaciones>(CLAVE_NOTIFICACIONES, {
          items: anterior.items.map((item) =>
            item.id === id
              ? { ...item, leida: true, leidaEn: new Date().toISOString() }
              : item,
          ),
          noLeidas: Math.max(0, anterior.noLeidas - (estabaSinLeer ? 1 : 0)),
        });
      }

      return { anterior };
    },
    onError: (_error, _id, contexto) => {
      if (contexto?.anterior) {
        queryClient.setQueryData(CLAVE_NOTIFICACIONES, contexto.anterior);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_NOTIFICACIONES });
    },
  });
}

/** Vacía el contador de una vez, con el mismo criterio optimista. */
export function useMarcarTodasLeidas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      http.patch<{ actualizadas: number }>("/notificaciones/leer-todas"),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: CLAVE_NOTIFICACIONES });

      const anterior = queryClient.getQueryData<RespuestaNotificaciones>(CLAVE_NOTIFICACIONES);

      if (anterior) {
        queryClient.setQueryData<RespuestaNotificaciones>(CLAVE_NOTIFICACIONES, {
          items: anterior.items.map((item) => ({
            ...item,
            leida: true,
            leidaEn: item.leidaEn ?? new Date().toISOString(),
          })),
          noLeidas: 0,
        });
      }

      return { anterior };
    },
    onError: (_error, _variables, contexto) => {
      if (contexto?.anterior) {
        queryClient.setQueryData(CLAVE_NOTIFICACIONES, contexto.anterior);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_NOTIFICACIONES });
    },
  });
}
