import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type {
  CategoriaServicio,
  RespuestaAccion,
  RespuestaPaginada,
  Servicio,
} from "@/types/dominio";

export const SERVICIOS_POR_PAGINA = 5;

export interface ServicioFiltros {
  busqueda?: string;
  pagina?: number;
  categoriaId?: number;
  incluirInactivos?: boolean;
  ordenarPor?: "nombre" | "codigo" | "precio" | "recientes";
  direccion?: "asc" | "desc";
}

export interface ServicioResumen {
  total: number;
  categorias: number;
  precioPromedio: number;
  duracionPromedio: number;
  consumenInsumos: number;
  requierenVeterinario: number;
}

export interface ServicioFormData {
  codigo?: string;
  nombre: string;
  descripcion?: string | null;
  categoriaId?: number | null;
  precio: number;
  duracionMin?: number;
  consumeInsumos?: boolean;
  requiereVeterinario?: boolean;
  precioPersonalizado?: boolean;
  activo?: boolean;
}

function construirQueryServicios(
  filtros: ServicioFiltros,
  porPagina: number,
): string {
  const {
    busqueda = "",
    pagina = 1,
    categoriaId,
    incluirInactivos = false,
    ordenarPor = "nombre",
    direccion = "asc",
  } = filtros;

  const query = new URLSearchParams({
    pagina: String(pagina),
    porPagina: String(porPagina),
    ordenarPor,
    direccion,
  });

  if (busqueda.trim()) query.set("busqueda", busqueda.trim());
  if (categoriaId) query.set("categoriaId", String(categoriaId));
  if (incluirInactivos) query.set("incluirInactivos", "true");

  return query.toString();
}

export function useServicios(filtros: ServicioFiltros = {}) {
  const {
    busqueda = "",
    pagina = 1,
    categoriaId,
    incluirInactivos = false,
    ordenarPor = "nombre",
    direccion = "asc",
  } = filtros;

  return useQuery({
    queryKey: [
      "servicios",
      {
        busqueda,
        pagina,
        categoriaId,
        incluirInactivos,
        ordenarPor,
        direccion,
      },
    ],
    queryFn: () =>
      http.get<RespuestaPaginada<Servicio>>(
        `/servicios?${construirQueryServicios(filtros, SERVICIOS_POR_PAGINA)}`,
      ),
    placeholderData: (anterior) => anterior,
  });
}

export function useServicioResumen() {
  return useQuery({
    queryKey: ["servicios", "resumen"],
    queryFn: () => http.get<ServicioResumen>("/servicios/resumen"),
  });
}

export function useCategoriasServicio() {
  return useQuery({
    queryKey: ["servicios", "categorias"],
    queryFn: () => http.get<CategoriaServicio[]>("/servicios/categorias"),
    staleTime: 5 * 60_000,
  });
}

export function useServicioDetalle(id?: number) {
  return useQuery({
    queryKey: ["servicios", "detalle", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador del servicio.");
      }
      return http.get<Servicio>(`/servicios/${id}`);
    },
    enabled: id !== undefined,
  });
}

export function useCrearServicio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: ServicioFormData) =>
      http.post<Servicio>("/servicios", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servicios"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useActualizarServicio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ServicioFormData }) =>
      http.patch<Servicio>(`/servicios/${id}`, datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servicios"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDesactivarServicio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      http.delete<RespuestaAccion>(`/servicios/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servicios"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useReactivarServicio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      http.post<RespuestaAccion>(`/servicios/${id}/reactivar`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servicios"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCrearCategoriaServicio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: { nombre: string; color?: string | null; icono?: string | null }) =>
      http.post<CategoriaServicio>("/servicios/categorias", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servicios", "categorias"] });
    },
  });
}

export function useActualizarCategoriaServicio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      datos,
    }: {
      id: number;
      datos: { nombre?: string; color?: string | null; icono?: string | null };
    }) => http.patch<CategoriaServicio>(`/servicios/categorias/${id}`, datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servicios", "categorias"] });
    },
  });
}

export function useEliminarCategoriaServicio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      http.delete<RespuestaAccion>(`/servicios/categorias/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servicios", "categorias"] });
    },
  });
}

// Aliases para compatibilidad con distintas convenciones de nombres.
export {
  useServicios as useServicio,
  useServicios as useServicioListado,
  useServicioDetalle as useServicioById,
  useCrearServicio as useCreateServicio,
  useActualizarServicio as useUpdateServicio,
  useDesactivarServicio as useDeleteServicio,
  useReactivarServicio as useReactivateServicio,
  SERVICIOS_POR_PAGINA as POR_PAGINA,
};

export { mensajeDeError, errorDeCampo } from "@/features/clients/clients.service";
export { useDialogo } from "@/features/clients/clients.service";

export type { DialogoState } from "@/features/clients/clients.service";
