import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type {
  PermisoPorModulo,
  RespuestaPaginada,
  RolPersonal,
  UsuarioPersonal,
} from "@/types/dominio";

const PAGINA_INICIAL = 1;
export const POR_PAGINA = 5;

export interface ConsultaPersonalParams {
  busqueda?: string;
  pagina?: number;
  incluirInactivos?: boolean;
  rolId?: number;
}

export function usePersonal(params: ConsultaPersonalParams = {}) {
  const {
    busqueda = "",
    pagina = PAGINA_INICIAL,
    incluirInactivos = false,
    rolId,
  } = params;

  return useQuery({
    queryKey: ["personal", { busqueda, pagina, incluirInactivos, rolId }],
    queryFn: () => {
      const query = new URLSearchParams({
        pagina: String(pagina),
        porPagina: String(POR_PAGINA),
        ordenarPor: "nombre",
        direccion: "asc",
      });

      if (busqueda.trim()) query.set("busqueda", busqueda.trim());
      if (incluirInactivos) query.set("incluirInactivos", "true");
      if (rolId !== undefined) query.set("rolId", String(rolId));

      return http.get<RespuestaPaginada<UsuarioPersonal>>(
        `/personal?${query.toString()}`,
      );
    },
    placeholderData: (anterior) => anterior,
  });
}

export function usePersonalDetalle(id?: number) {
  return useQuery({
    queryKey: ["personal", "detalle", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador del usuario.");
      }
      return http.get<UsuarioPersonal>(`/personal/${id}`);
    },
    enabled: id !== undefined,
  });
}

/** Roles asignables dentro de la veterinaria, con sus permisos. */
export function useRolesPersonal() {
  return useQuery({
    queryKey: ["personal", "roles"],
    queryFn: () => http.get<RolPersonal[]>("/personal/roles"),
    staleTime: 5 * 60_000,
  });
}

/** Catálogo de permisos agrupado por módulo. */
export function usePermisosPersonal() {
  return useQuery({
    queryKey: ["personal", "permisos"],
    queryFn: () => http.get<PermisoPorModulo[]>("/personal/permisos"),
    staleTime: 5 * 60_000,
  });
}

export interface UsuarioFormData {
  nombre: string;
  apellido: string;
  email: string;
  rolId: number;
  cedula?: string | null;
  telefono?: string | null;
  especialidad?: string | null;
  registroProfesional?: string | null;
  colorAgenda?: string | null;
  horarioInicio?: string | null;
  horarioFin?: string | null;
  diasTrabajo?: number[];
  debeCambiarPassword?: boolean;
  password?: string;
}

export function useCrearUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: UsuarioFormData) =>
      http.post<UsuarioPersonal>("/personal", limpiar(datos)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["personal"] });
    },
  });
}

export function useActualizarUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: UsuarioFormData }) =>
      http.patch<UsuarioPersonal>(`/personal/${id}`, limpiar(datos)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["personal"] });
    },
  });
}

export function useDesactivarUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.delete<{ mensaje: string }>(`/personal/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["personal"] });
    },
  });
}

export function useReactivarUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.post<{ mensaje: string }>(`/personal/${id}/reactivar`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["personal"] });
    },
  });
}

/**
 * Quita los campos ausentes antes de enviar.
 *
 * `null` viaja a propósito para poder vaciar un dato opcional (un teléfono o
 * una especialidad que ya no corresponde). La contraseña vacía sí se descarta:
 * en una edición significa "no la cambies".
 */
function limpiar(datos: UsuarioFormData): Record<string, unknown> {
  const salida: Record<string, unknown> = {};

  for (const [clave, valor] of Object.entries(datos)) {
    if (valor === undefined) continue;
    if (clave === "password" && typeof valor === "string" && valor.trim() === "") {
      continue;
    }
    salida[clave] = valor;
  }

  return salida;
}
