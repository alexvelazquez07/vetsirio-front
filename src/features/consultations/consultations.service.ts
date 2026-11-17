import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type {
  Consulta,
  Paciente,
  RespuestaPaginada,
} from "@/types/dominio";

export const CONSULTAS_POR_PAGINA = 5;

export type PacienteConsulta = Pick<
  Paciente,
  "id" | "nombre" | "especie" | "cliente"
>;

export interface PrescripcionConsultaData {
  medicamento: string;
  presentacion: string | null;
  dosis: string;
  via: string | null;
  frecuencia: string | null;
  duracion: string | null;
  indicaciones: string | null;
  cantidad: number | null;
}

export interface ArchivoConsultaData {
  url: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  descripcion: string | null;
}

export interface ConsultaFormData {
  pacienteId: number;
  citaId: number | null;
  fecha: string;
  motivoConsulta: string;
  sintomas: string | null;
  examenFisico: string | null;
  diagnostico: string | null;
  tratamientoIndicado: string | null;
  observaciones: string | null;
  pesoKg: number | null;
  temperatura: number | null;
  frecuenciaCardiaca: number | null;
  frecuenciaRespiratoria: number | null;
  prescripciones: PrescripcionConsultaData[];
  archivos: ArchivoConsultaData[];
}

export function useConsultas({
  busqueda,
  pagina,
  pacienteId,
}: {
  busqueda: string;
  pagina: number;
  pacienteId?: number;
}) {
  return useQuery({
    queryKey: ["consultas", { busqueda, pagina, pacienteId }],
    queryFn: () => {
      const query = new URLSearchParams({
        pagina: String(pagina),
        porPagina: String(CONSULTAS_POR_PAGINA),
      });
      if (busqueda.trim()) query.set("busqueda", busqueda.trim());
      if (pacienteId) query.set("pacienteId", String(pacienteId));
      return http.get<RespuestaPaginada<Consulta>>(
        `/consultas?${query.toString()}`,
      );
    },
    placeholderData: (anterior) => anterior,
  });
}

export function useConsultaDetalle(id?: number) {
  return useQuery({
    queryKey: ["consultas", "detalle", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador de la consulta.");
      }
      return http.get<Consulta>(`/consultas/${id}`);
    },
    enabled: id !== undefined,
  });
}

export function useBuscarPacientesConsulta(termino: string) {
  return useQuery({
    queryKey: ["consultas", "pacientes", termino],
    queryFn: () => {
      const query = new URLSearchParams({ q: termino.trim() });
      return http.get<PacienteConsulta[]>(
        `/consultas/pacientes?${query.toString()}`,
      );
    },
    enabled: termino.trim().length >= 2,
    staleTime: 15_000,
  });
}

export function useCrearConsulta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: ConsultaFormData) =>
      http.post<Consulta>("/consultas", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["consultas"] });
      void queryClient.invalidateQueries({ queryKey: ["pacientes"] });
    },
  });
}

export function useActualizarConsulta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ConsultaFormData }) =>
      http.patch<Consulta>(`/consultas/${id}`, datos),
    onSuccess: (consulta) => {
      void queryClient.invalidateQueries({ queryKey: ["consultas"] });
      queryClient.setQueryData(
        ["consultas", "detalle", consulta.id],
        consulta,
      );
    },
  });
}

export function useFinalizarConsulta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      http.post<Consulta>(`/consultas/${id}/finalizar`),
    onSuccess: (consulta) => {
      void queryClient.invalidateQueries({ queryKey: ["consultas"] });
      queryClient.setQueryData(
        ["consultas", "detalle", consulta.id],
        consulta,
      );
    },
  });
}
