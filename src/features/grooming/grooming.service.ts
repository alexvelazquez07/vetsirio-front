import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type {
  EstadoGrooming,
  GroomingSesion,
  Paciente,
  RespuestaPaginada,
} from "@/types/dominio";

export const GROOMING_POR_PAGINA = 5;

export type PacienteGrooming = Pick<
  Paciente,
  "id" | "nombre" | "especie" | "cliente"
>;

export interface PeluqueroGrooming {
  id: number;
  nombre: string;
  apellido: string;
  rol: { nombre: string };
}

export interface GroomingResumen {
  pendientes: number;
  enProceso: number;
  finalizadasHoy: number;
  ingresosMes: number;
}

export interface GroomingFiltros {
  busqueda: string;
  pagina: number;
  estado?: EstadoGrooming;
  peluqueroId?: number;
  desde?: string;
  hasta?: string;
}

export interface GroomingFormData {
  pacienteId: number;
  peluqueroId: number | null;
  fechaInicio: string;
  fechaFin: string;
  tipoServicio: string | null;
  estado: EstadoGrooming;
  precio: number;
  observaciones: string | null;
  fotoAntesUrl: string | null;
  fotoDespuesUrl: string | null;
}

export const ESTADOS_GROOMING: {
  valor: EstadoGrooming;
  etiqueta: string;
  color: string;
}[] = [
  { valor: "pendiente", etiqueta: "Pendiente", color: "orange" },
  { valor: "en_proceso", etiqueta: "En proceso", color: "blue" },
  { valor: "finalizada", etiqueta: "Finalizada", color: "green" },
  { valor: "cancelada", etiqueta: "Cancelada", color: "gray" },
];

export function etiquetaEstadoGrooming(estado: EstadoGrooming) {
  return (
    ESTADOS_GROOMING.find((item) => item.valor === estado)?.etiqueta ?? estado
  );
}

export function colorEstadoGrooming(estado: EstadoGrooming) {
  return ESTADOS_GROOMING.find((item) => item.valor === estado)?.color ?? "gray";
}

export function useGroomingSesiones({
  busqueda,
  pagina,
  estado,
  peluqueroId,
  desde,
  hasta,
}: GroomingFiltros) {
  return useQuery({
    queryKey: [
      "grooming",
      { busqueda, pagina, estado, peluqueroId, desde, hasta },
    ],
    queryFn: () => {
      const query = new URLSearchParams({
        pagina: String(pagina),
        porPagina: String(GROOMING_POR_PAGINA),
      });
      if (busqueda.trim()) query.set("busqueda", busqueda.trim());
      if (estado) query.set("estado", estado);
      if (peluqueroId) query.set("peluqueroId", String(peluqueroId));
      if (desde) query.set("desde", desde);
      if (hasta) query.set("hasta", hasta);
      return http.get<RespuestaPaginada<GroomingSesion>>(
        `/grooming?${query.toString()}`,
      );
    },
    placeholderData: (anterior) => anterior,
  });
}

export function useGroomingResumen() {
  return useQuery({
    queryKey: ["grooming", "resumen"],
    queryFn: () => http.get<GroomingResumen>("/grooming/resumen"),
    staleTime: 30_000,
  });
}

export function useGroomingDetalle(id?: number) {
  return useQuery({
    queryKey: ["grooming", "detalle", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador de la sesión.");
      }
      return http.get<GroomingSesion>(`/grooming/${id}`);
    },
    enabled: id !== undefined,
  });
}

export function usePeluquerosGrooming() {
  return useQuery({
    queryKey: ["grooming", "peluqueros"],
    queryFn: () => http.get<PeluqueroGrooming[]>("/grooming/peluqueros"),
    staleTime: 5 * 60_000,
  });
}

export function useBuscarPacientesGrooming(termino: string) {
  return useQuery({
    queryKey: ["grooming", "pacientes", termino],
    queryFn: () => {
      const query = new URLSearchParams({ q: termino.trim() });
      return http.get<PacienteGrooming[]>(
        `/grooming/pacientes?${query.toString()}`,
      );
    },
    enabled: termino.trim().length >= 2,
    staleTime: 15_000,
  });
}

function invalidarGroomingYAgenda(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({ queryKey: ["grooming"] });
  // Toda sesión asegura su cita: la agenda y el panel tienen que reflejarlo
  // aunque el cambio se haya hecho desde este módulo.
  void queryClient.invalidateQueries({ queryKey: ["agenda"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useCrearGroomingSesion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: GroomingFormData) =>
      http.post<GroomingSesion>("/grooming", datos),
    onSuccess: () => invalidarGroomingYAgenda(queryClient),
  });
}

export function useActualizarGroomingSesion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: GroomingFormData }) =>
      http.patch<GroomingSesion>(`/grooming/${id}`, datos),
    onSuccess: (sesion) => {
      invalidarGroomingYAgenda(queryClient);
      queryClient.setQueryData(["grooming", "detalle", sesion.id], sesion);
    },
  });
}

export function useCambiarEstadoGrooming() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: EstadoGrooming }) =>
      http.patch<GroomingSesion>(`/grooming/${id}/estado`, { estado }),
    onSuccess: (sesion) => {
      invalidarGroomingYAgenda(queryClient);
      queryClient.setQueryData(["grooming", "detalle", sesion.id], sesion);
    },
  });
}
