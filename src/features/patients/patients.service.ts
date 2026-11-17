import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http, urlDeArchivo } from "@/services/api";
import type { Paciente, RespuestaPaginada } from "@/types/dominio";

export const PACIENTES_POR_PAGINA = 5;

export const urlFotoPaciente = urlDeArchivo;

export interface EspeciePaciente {
  id: number;
  nombre: string;
  icono: string | null;
}

export interface PacienteFormData {
  clienteId: number;
  especieId: number;
  nombre: string;
  raza: string | null;
  sexo: "macho" | "hembra" | null;
  fechaNacimiento: string | null;
  edadAnios: number | null;
  pesoKg: number | null;
  color: string | null;
  chipId: string | null;
  fotoUrl: string | null;
  esterilizado: boolean;
  desparasitado: boolean;
  alergias: string | null;
  notas: string | null;
  activo: boolean;
}

export function usePacientes({
  busqueda,
  pagina,
  incluirInactivos = false,
}: {
  busqueda: string;
  pagina: number;
  incluirInactivos?: boolean;
}) {
  return useQuery({
    queryKey: ["pacientes", { busqueda, pagina, incluirInactivos }],
    queryFn: () => {
      const query = new URLSearchParams({
        pagina: String(pagina),
        porPagina: String(PACIENTES_POR_PAGINA),
      });
      if (busqueda.trim()) query.set("busqueda", busqueda.trim());
      if (incluirInactivos) query.set("incluirInactivos", "true");
      return http.get<RespuestaPaginada<Paciente>>(
        `/pacientes?${query.toString()}`,
      );
    },
    placeholderData: (anterior) => anterior,
  });
}

export function usePacienteDetalle(id?: number) {
  return useQuery({
    queryKey: ["pacientes", "detalle", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador del paciente.");
      }
      return http.get<Paciente>(`/pacientes/${id}`);
    },
    enabled: id !== undefined,
  });
}

export function useEspeciesPaciente() {
  return useQuery({
    queryKey: ["pacientes", "especies"],
    queryFn: () => http.get<EspeciePaciente[]>("/pacientes/especies"),
    staleTime: 5 * 60_000,
  });
}

export function useCrearPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: PacienteFormData) =>
      http.post<Paciente>("/pacientes", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useActualizarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: PacienteFormData }) =>
      http.patch<Paciente>(`/pacientes/${id}`, datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

export function useDesactivarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      http.delete<{ mensaje: string }>(`/pacientes/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

export function useReactivarPaciente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      http.post<{ mensaje: string }>(`/pacientes/${id}/reactivar`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}
