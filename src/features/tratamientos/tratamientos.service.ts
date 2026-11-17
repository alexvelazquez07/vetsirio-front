import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type {
  Paciente,
  RespuestaPaginada,
  Tratamiento,
} from "@/types/dominio";

export const TRATAMIENTOS_POR_PAGINA = 5;

export type PacienteTratamiento = Pick<
  Paciente,
  "id" | "nombre" | "especie" | "cliente"
>;

export interface TratamientoDosisFormData {
  numeroDosis: number;
  productoId: number | null;
  cantidad: number;
  unidad: string;
  fechaProgramada: string;
  fechaAplicada: string | null;
  administrada: boolean;
  observaciones: string | null;
}

export interface TratamientoFormData {
  pacienteId: number;
  nombre: string;
  descripcion: string | null;
  fechaInicio: string;
  fechaFinPrevista: string | null;
  notas: string | null;
  dosis: TratamientoDosisFormData[];
}

export function useTratamientos({
  busqueda,
  pagina,
  pacienteId,
  incluirInactivos,
}: {
  busqueda: string;
  pagina: number;
  pacienteId?: number;
  incluirInactivos?: boolean;
}) {
  return useQuery({
    queryKey: [
      "tratamientos",
      { busqueda, pagina, pacienteId, incluirInactivos },
    ],
    queryFn: () => {
      const query = new URLSearchParams({
        pagina: String(pagina),
        porPagina: String(TRATAMIENTOS_POR_PAGINA),
      });
      if (busqueda.trim()) query.set("busqueda", busqueda.trim());
      if (pacienteId) query.set("pacienteId", String(pacienteId));
      if (incluirInactivos) query.set("incluirInactivos", "true");
      return http.get<RespuestaPaginada<Tratamiento>>(
        `/tratamientos?${query.toString()}`,
      );
    },
    placeholderData: (anterior) => anterior,
  });
}

export function useTratamientoDetalle(id?: number) {
  return useQuery({
    queryKey: ["tratamientos", "detalle", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador del tratamiento.");
      }
      return http.get<Tratamiento>(`/tratamientos/${id}`);
    },
    enabled: id !== undefined,
  });
}

export function useBuscarPacientesTratamiento(termino: string) {
  return useQuery({
    queryKey: ["tratamientos", "pacientes", termino],
    queryFn: () => {
      const query = new URLSearchParams({ busqueda: termino.trim() });
      return http.get<PacienteTratamiento[]>(
        `/tratamientos/pacientes?${query.toString()}`,
      );
    },
    enabled: termino.trim().length >= 2,
    staleTime: 15_000,
  });
}

export function useCrearTratamiento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: TratamientoFormData) =>
      http.post<Tratamiento>("/tratamientos", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tratamientos"] });
    },
  });
}

export function useActualizarTratamiento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: TratamientoFormData }) =>
      http.patch<Tratamiento>(`/tratamientos/${id}`, datos),
    onSuccess: (tratamiento) => {
      void queryClient.invalidateQueries({ queryKey: ["tratamientos"] });
      queryClient.setQueryData(
        ["tratamientos", "detalle", tratamiento.id],
        tratamiento,
      );
    },
  });
}

export function useDesactivarTratamiento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => http.delete<Tratamiento>(`/tratamientos/${id}`),
    onSuccess: (tratamiento) => {
      void queryClient.invalidateQueries({ queryKey: ["tratamientos"] });
      queryClient.setQueryData(
        ["tratamientos", "detalle", tratamiento.id],
        tratamiento,
      );
    },
  });
}

export function useReactivarTratamiento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      http.post<Tratamiento>(`/tratamientos/${id}/reactivar`),
    onSuccess: (tratamiento) => {
      void queryClient.invalidateQueries({ queryKey: ["tratamientos"] });
      queryClient.setQueryData(
        ["tratamientos", "detalle", tratamiento.id],
        tratamiento,
      );
    },
  });
}
