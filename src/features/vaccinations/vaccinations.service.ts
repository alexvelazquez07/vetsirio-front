import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type { Paciente, RespuestaPaginada, Vacunacion } from "@/types/dominio";

export const VACUNACIONES_POR_PAGINA = 5;

export type PacienteVacunacion = Pick<
  Paciente,
  "id" | "nombre" | "especie" | "cliente"
>;

export interface VacunacionFormData {
  pacienteId: number;
  nombreVacuna: string;
  lote: string | null;
  fechaAplicacion: string;
  fechaProxima: string | null;
  via: string | null;
  loteVenceEn: string | null;
  certificadoUrl: string | null;
}

export function useVacunaciones({
  busqueda,
  pagina,
  pacienteId,
}: {
  busqueda: string;
  pagina: number;
  pacienteId?: number;
}) {
  return useQuery({
    queryKey: ["vacunaciones", { busqueda, pagina, pacienteId }],
    queryFn: () => {
      const query = new URLSearchParams({
        pagina: String(pagina),
        porPagina: String(VACUNACIONES_POR_PAGINA),
      });
      if (busqueda.trim()) query.set("busqueda", busqueda.trim());
      if (pacienteId) query.set("pacienteId", String(pacienteId));
      return http.get<RespuestaPaginada<Vacunacion>>(
        `/vacunaciones?${query.toString()}`,
      );
    },
    placeholderData: (anterior) => anterior,
  });
}

export function useVacunacionDetalle(id?: number) {
  return useQuery({
    queryKey: ["vacunaciones", "detalle", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador de la vacunación.");
      }
      return http.get<Vacunacion>(`/vacunaciones/${id}`);
    },
    enabled: id !== undefined,
  });
}

export function useBuscarPacientesVacunacion(termino: string) {
  return useQuery({
    queryKey: ["vacunaciones", "pacientes", termino],
    queryFn: () => {
      const query = new URLSearchParams({ q: termino.trim() });
      return http.get<PacienteVacunacion[]>(
        `/vacunaciones/pacientes?${query.toString()}`,
      );
    },
    enabled: termino.trim().length >= 2,
    staleTime: 15_000,
  });
}

export function useCrearVacunacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: VacunacionFormData) =>
      http.post<Vacunacion>("/vacunaciones", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vacunaciones"] });
      void queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });
}

export function useActualizarVacunacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: VacunacionFormData }) =>
      http.patch<Vacunacion>(`/vacunaciones/${id}`, datos),
    onSuccess: (vacunacion) => {
      void queryClient.invalidateQueries({ queryKey: ["vacunaciones"] });
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
      queryClient.setQueryData(
        ["vacunaciones", "detalle", vacunacion.id],
        vacunacion,
      );
    },
  });
}
