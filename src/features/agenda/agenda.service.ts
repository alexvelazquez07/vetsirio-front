import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";

export type EstadoCita =
  | "pendiente"
  | "confirmada"
  | "en_curso"
  | "atendida"
  | "cancelada"
  | "no_asistio";

export interface VeterinarioAgenda {
  id: number;
  nombre: string;
  apellido: string;
  especialidad: string | null;
  colorAgenda: string | null;
}

export interface PacienteAgenda {
  id: number;
  nombre: string;
  especie: { nombre: string; icono: string | null } | null;
  cliente: {
    id: number;
    nombres: string | null;
    apellidos: string | null;
    razonSocial: string | null;
    telefono: string | null;
    whatsapp: string | null;
  } | null;
}

export interface CitaAgenda {
  id: number;
  pacienteId: number;
  veterinarioId: number | null;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoCita;
  motivo: string;
  whatsapp: string | null;
  motivoCitaId: number | null;
  motivoCita: MotivoCitaAgenda | null;
  notas: string | null;
  paciente: PacienteAgenda;
  veterinario: VeterinarioAgenda | null;
}

export interface MotivoCitaAgenda {
  id: number;
  nombre: string;
  color: string;
  activo: boolean;
  predeterminado: boolean;
}

export interface DatosCita {
  pacienteId: number;
  motivoCitaId: number;
  whatsapp: string | null;
  veterinarioId: number | null;
  fechaInicio: string;
  fechaFin: string;
  notas: string | null;
}

export interface DatosMotivoCita {
  nombre: string;
  color: string;
}

export function useMotivosAgenda() {
  return useQuery({
    queryKey: ["agenda", "motivos"],
    queryFn: () => http.get<MotivoCitaAgenda[]>("/citas/motivos"),
    staleTime: 60_000,
  });
}

export function useCrearMotivoAgenda() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosMotivoCita) =>
      http.post<MotivoCitaAgenda>("/citas/motivos", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agenda", "motivos"] });
    },
  });
}

export function useActualizarMotivoAgenda() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      datos,
    }: {
      id: number;
      datos: Partial<DatosMotivoCita>;
    }) => http.patch<MotivoCitaAgenda>(`/citas/motivos/${id}`, datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agenda", "motivos"] });
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
    },
  });
}

export function useCambiarEstadoMotivoAgenda() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      http.patch<MotivoCitaAgenda>(`/citas/motivos/${id}/estado`, { activo }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agenda", "motivos"] });
    },
  });
}

export function rangoDiaActualAgenda(ahora: Date | number = Date.now()) {
  const fechaActual = typeof ahora === "number" ? new Date(ahora) : ahora;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Asuncion",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fechaActual);
  const valor = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  const hoy = `${valor("year")}-${valor("month")}-${valor("day")}`;
  const [anio, mes, dia] = hoy.split("-").map(Number);
  const manana = new Date(Date.UTC(anio, mes - 1, dia + 1, 12))
    .toISOString()
    .slice(0, 10);
  return {
    desde: new Date(`${hoy}T00:00:00-03:00`).toISOString(),
    hasta: new Date(`${manana}T00:00:00-03:00`).toISOString(),
  };
}

export function fechaCortaAgenda(timestamp: number) {
  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Asuncion",
  }).format(timestamp);
}

export function horaActualAgenda(timestamp: number) {
  return Number(
    new Intl.DateTimeFormat("es-PY", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: "America/Asuncion",
    }).format(timestamp),
  );
}

export function useCitasAgenda(
  desde: string,
  hasta: string,
  veterinarioId?: number,
  enabled = true,
) {
  return useQuery({
    queryKey: ["agenda", { desde, hasta, veterinarioId }],
    queryFn: () => {
      const params = new URLSearchParams({ desde, hasta });
      if (veterinarioId) params.set("veterinarioId", String(veterinarioId));
      return http.get<CitaAgenda[]>(`/citas?${params.toString()}`);
    },
    enabled,
  });
}

export function useVeterinariosAgenda() {
  return useQuery({
    queryKey: ["agenda", "veterinarios"],
    queryFn: () => http.get<VeterinarioAgenda[]>("/citas/veterinarios"),
    staleTime: 5 * 60_000,
  });
}

export function useBuscarPacientesAgenda(termino: string, activo = true) {
  return useQuery({
    queryKey: ["agenda", "pacientes", termino],
    queryFn: () =>
      http.get<PacienteAgenda[]>(
        `/citas/pacientes?q=${encodeURIComponent(termino.trim())}`,
      ),
    enabled: termino.trim().length >= 2 && activo,
    staleTime: 15_000,
  });
}

export function useCrearCita() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: DatosCita) => http.post<CitaAgenda>("/citas", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
      void queryClient.invalidateQueries({ queryKey: ["grooming"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useActualizarCita() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: DatosCita }) =>
      http.patch<CitaAgenda>(`/citas/${id}`, datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
      void queryClient.invalidateQueries({ queryKey: ["grooming"] });
    },
  });
}

export function useActualizarEstadoCita() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      estado,
    }: {
      id: number;
      estado: Exclude<EstadoCita, "cancelada">;
    }) => http.patch<CitaAgenda>(`/citas/${id}/estado`, { estado }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
      void queryClient.invalidateQueries({ queryKey: ["grooming"] });
    },
  });
}

export function useCancelarCita() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      http.post<CitaAgenda>(`/citas/${id}/cancelar`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agenda"] });
      void queryClient.invalidateQueries({ queryKey: ["grooming"] });
    },
  });
}
