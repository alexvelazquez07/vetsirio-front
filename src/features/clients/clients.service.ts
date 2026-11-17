import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { ApiError, http } from "@/services/api";
import type { ConfiguracionImpresion } from "@/features/settings/impresion";
import type {
  Cliente,
  PlanVeterinaria,
  Proveedor,
  RespuestaPaginada,
} from "@/types/dominio";

/**
 * Servicios de los módulos de clientes, proveedores y configuración.
 *
 * Cada consulta tiene su propia clave en la caché de React Query. Eso no es
 * un detalle: permite invalidar exactamente lo que cambió. Al dar de alta un
 * cliente desde dentro de una factura, sólo se invalida ["clientes"], y la
 * tabla de ventas no se vuelve a pedir ni a parpadear.
 */

const PAGINA_INICIAL = 1;
export const POR_PAGINA = 5;

// ============================================================================
//  Clientes
// ============================================================================

export interface ConsultaClientesParams {
  busqueda?: string;
  pagina?: number;
  incluirInactivos?: boolean;
}

export function useClientes(params: ConsultaClientesParams = {}) {
  const {
    busqueda = "",
    pagina = PAGINA_INICIAL,
    incluirInactivos = false,
  } = params;

  return useQuery({
    queryKey: ["clientes", { busqueda, pagina, incluirInactivos }],
    queryFn: () => {
      const query = new URLSearchParams({
        pagina: String(pagina),
        porPagina: String(POR_PAGINA),
        ordenarPor: "recientes",
        direccion: "desc",
      });

      if (busqueda.trim()) query.set("busqueda", busqueda.trim());
      if (incluirInactivos) query.set("incluirInactivos", "true");

      return http.get<RespuestaPaginada<Cliente>>(
        `/clientes?${query.toString()}`,
      );
    },
    placeholderData: (anterior) => anterior,
  });
}

export interface ClienteDetalle extends Cliente {
  pacientes: Array<{
    id: number;
    nombre: string;
    especie: { nombre: string; icono: string | null } | null;
    raza: string | null;
    sexo: "macho" | "hembra" | null;
    fotoUrl: string | null;
    fechaNacimiento: string | null;
    activo: boolean;
  }>;
}

export function useClienteDetalle(id?: number) {
  return useQuery({
    queryKey: ["clientes", "detalle", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador del cliente.");
      }
      return http.get<ClienteDetalle>(`/clientes/${id}`);
    },
    enabled: id !== undefined,
  });
}

export async function obtenerClientesParaExportar(
  busqueda = "",
): Promise<Cliente[]> {
  const obtenerPagina = (pagina: number) => {
    const query = new URLSearchParams({
      pagina: String(pagina),
      porPagina: String(POR_PAGINA),
      incluirInactivos: "true",
      ordenarPor: "recientes",
      direccion: "desc",
    });

    if (busqueda.trim()) query.set("busqueda", busqueda.trim());

    return http.get<RespuestaPaginada<Cliente>>(
      `/clientes?${query.toString()}`,
    );
  };

  const primeraPagina = await obtenerPagina(1);
  const clientes = [...primeraPagina.items];
  const CONCURRENCIA_MAXIMA = 4;

  for (
    let paginaInicial = 2;
    paginaInicial <= primeraPagina.totalPaginas;
    paginaInicial += CONCURRENCIA_MAXIMA
  ) {
    const paginas = Array.from(
      {
        length: Math.min(
          CONCURRENCIA_MAXIMA,
          primeraPagina.totalPaginas - paginaInicial + 1,
        ),
      },
      (_, indice) => paginaInicial + indice,
    );
    const respuestas = await Promise.all(paginas.map(obtenerPagina));
    clientes.push(...respuestas.flatMap((respuesta) => respuesta.items));
  }

  return clientes;
}

export function useCrearCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: ClienteFormData) =>
      http.post<Cliente>("/clientes", limpiar(datos)),
    onSuccess: (cliente) => {
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      void queryClient.invalidateQueries({ queryKey: ["clientes", "buscar"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      return cliente;
    },
  });
}

export function useActualizarCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ClienteFormData }) =>
      http.patch<Cliente>(`/clientes/${id}`, limpiar(datos)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

export function useDesactivarCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.delete<{ mensaje: string }>(`/clientes/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

export function useReactivarCliente() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.post<{ mensaje: string }>(`/clientes/${id}/reactivar`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
  });
}

/** Autocompletado de clientes para otros formularios. */
export function useBuscarClientes(termino: string, activo = true) {
  return useQuery({
    queryKey: ["clientes", "buscar", termino],
    queryFn: () =>
      http.get<Cliente[]>(
        `/clientes/buscar?q=${encodeURIComponent(termino)}&limite=8`,
      ),
    enabled: termino.trim().length > 1 && activo,
    staleTime: 15_000,
  });
}

/**
 * Datos que se envían al crear o editar un cliente.
 *
 * Los tres documentos son campos opcionales e independientes, y el backend
 * exige al menos uno. No hay `tipoDocumento` que enviar: el backend lo deriva
 * del documento principal para no obligar al cliente a elegir.
 */
export interface ClienteFormData {
  cedula?: string;
  ruc?: string;
  pasaporte?: string;
  nombres?: string;
  apellidos?: string;
  razonSocial?: string;
  email?: string;
  telefono?: string;
  whatsapp?: string;
  direccion?: string;
  departamento?: string;
  ciudad?: string;
  barrio?: string;
  notas?: string;
  activo?: boolean;
}

/**
 * Quita los campos vacíos antes de enviar.
 *
 * Sin esto, un input en blanco viaja como "" y el backend lo guarda como
 * cadena vacía en lugar de NULL. Después el listado muestra "Sin ciudad" con
 * dos espacios pegados, y las búsquedas por ciudad empiezan a fallar.
 */
function limpiar(datos: object): Record<string, unknown> {
  const salida: Record<string, unknown> = {};

  for (const [clave, valor] of Object.entries(datos)) {
    if (valor === undefined || valor === null) continue;
    if (typeof valor === "string" && valor.trim() === "") continue;
    salida[clave] = valor;
  }

  return salida;
}

// ============================================================================
//  Proveedores
// ============================================================================

export interface ConsultaProveedoresParams {
  busqueda?: string;
  pagina?: number;
  incluirInactivos?: boolean;
}

export function useProveedores(params: ConsultaProveedoresParams = {}) {
  const {
    busqueda = "",
    pagina = PAGINA_INICIAL,
    incluirInactivos = false,
  } = params;

  return useQuery({
    queryKey: ["proveedores", { busqueda, pagina, incluirInactivos }],
    queryFn: () => {
      const query = new URLSearchParams({
        pagina: String(pagina),
        porPagina: String(POR_PAGINA),
        ordenarPor: "recientes",
        direccion: "desc",
      });

      if (busqueda.trim()) query.set("busqueda", busqueda.trim());
      if (incluirInactivos) query.set("incluirInactivos", "true");

      return http.get<RespuestaPaginada<Proveedor>>(
        `/proveedores?${query.toString()}`,
      );
    },
    placeholderData: (anterior) => anterior,
  });
}

export function useProveedorDetalle(id?: number) {
  return useQuery({
    queryKey: ["proveedores", "detalle", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador del proveedor.");
      }
      return http.get<Proveedor>(`/proveedores/${id}`);
    },
    enabled: id !== undefined,
  });
}

export async function obtenerProveedoresParaExportar(
  busqueda = "",
  incluirInactivos = false,
): Promise<Proveedor[]> {
  const obtenerPagina = (pagina: number) => {
    const query = new URLSearchParams({
      pagina: String(pagina),
      porPagina: String(POR_PAGINA),
      ordenarPor: "recientes",
      direccion: "desc",
      incluirInactivos: String(incluirInactivos),
    });

    if (busqueda.trim()) query.set("busqueda", busqueda.trim());

    return http.get<RespuestaPaginada<Proveedor>>(
      `/proveedores?${query.toString()}`,
    );
  };

  const primeraPagina = await obtenerPagina(1);
  const proveedores = [...primeraPagina.items];
  const CONCURRENCIA_MAXIMA = 4;

  for (
    let paginaInicial = 2;
    paginaInicial <= primeraPagina.totalPaginas;
    paginaInicial += CONCURRENCIA_MAXIMA
  ) {
    const paginas = Array.from(
      {
        length: Math.min(
          CONCURRENCIA_MAXIMA,
          primeraPagina.totalPaginas - paginaInicial + 1,
        ),
      },
      (_, indice) => paginaInicial + indice,
    );
    const respuestas = await Promise.all(paginas.map(obtenerPagina));
    proveedores.push(...respuestas.flatMap((respuesta) => respuesta.items));
  }

  return proveedores;
}

export interface ProveedorFormData {
  documento: string;
  razonSocial: string;
  nombreFantasia?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  departamento?: string;
  ciudad?: string;
  barrio?: string;
  contactoNombre?: string;
  notas?: string;
  activo?: boolean;
}

export function useCrearProveedor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: ProveedorFormData) =>
      http.post<Proveedor>("/proveedores", limpiar(datos)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["proveedores"] });
    },
  });
}

export function useActualizarProveedor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ProveedorFormData }) =>
      http.patch<Proveedor>(`/proveedores/${id}`, limpiar(datos)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["proveedores"] });
    },
  });
}

export function useDesactivarProveedor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.delete<{ mensaje: string }>(`/proveedores/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["proveedores"] });
    },
  });
}

export function useReactivarProveedor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.post<{ mensaje: string }>(`/proveedores/${id}/reactivar`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["proveedores"] });
    },
  });
}

export interface ProveedorOpcion {
  id: number;
  documento: string;
  razonSocial: string;
  nombreFantasia: string | null;
  nombreMostrable: string;
}

/** Opciones completas para un select compacto (sólo proveedores activos). */
export function useProveedoresOpciones() {
  return useQuery({
    queryKey: ["proveedores", "opciones"],
    queryFn: () => http.get<ProveedorOpcion[]>("/proveedores/opciones"),
    staleTime: 60_000,
  });
}

export function useBuscarProveedores(termino: string, activo = true) {
  return useQuery({
    queryKey: ["proveedores", "buscar", termino],
    queryFn: () =>
      http.get<Proveedor[]>(
        `/proveedores/buscar?q=${encodeURIComponent(termino)}&limite=8`,
      ),
    enabled: termino.trim().length > 1 && activo,
    staleTime: 15_000,
  });
}

// ============================================================================
//  Configuración
// ============================================================================

export interface ConfiguracionVeterinaria {
  id: number;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  nombreFantasia: string | null;
  email: string;
  telefono: string | null;
  whatsapp: string | null;
  sitioWeb: string | null;
  direccion: string | null;
  departamento: string | null;
  ciudad: string | null;
  barrio: string | null;
  logoUrl: string | null;
  headerUrl: string | null;
  colorPrimario: string;
  moneda: string;
  zonaHoraria: string;
  idioma: string;

  // Suscripción
  plan: PlanVeterinaria;
  trialDias: number;
  trialFin: string | null;
  planVenceEn: string | null;
  maxUsuarios: number;
  activa: boolean;

  // Facturación
  actividadEconomica: string | null;
  registroProfesional: string | null;
  nombreRepresentante: string | null;
  timbradoNro: string | null;
  timbradoFechaInicio: string | null;
  timbradoFechaVencimiento: string | null;
  puntoVenta: string;
  establecimiento: string;
  emitirTicketSinTimbrado: boolean;
  /** Preferencias de impresión; la UI las normaliza antes de usarlas. */
  impresion: Partial<ConfiguracionImpresion> | null;
  correlativoActual: number;
  creadoEn: string;
  estadoTimbrado: EstadoTimbrado;
  _count: {
    usuarios: number;
    clientes: number;
    pacientes: number;
  };
}

export interface EstadoTimbrado {
  timbrado: boolean;
  vencido: boolean;
  puedeEmitirFactura: boolean;
  puedeEmitirTicket: boolean;
  motivo: string | null;
}

export function useConfiguracion() {
  return useQuery({
    queryKey: ["configuracion"],
    queryFn: () => http.get<ConfiguracionVeterinaria>("/configuracion"),
  });
}

export type ConfiguracionFormData = Partial<{
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  nombreFantasia: string;
  email: string;
  telefono: string;
  whatsapp: string;
  sitioWeb: string;
  direccion: string;
  departamento: string;
  ciudad: string;
  barrio: string;
  actividadEconomica: string;
  registroProfesional: string;
  nombreRepresentante: string;
  timbradoNro: string;
  timbradoFechaInicio: string;
  timbradoFechaVencimiento: string;
  puntoVenta: string;
  establecimiento: string;
  logoUrl: string | null;
  colorPrimario: string;
  moneda: string;
  zonaHoraria: string;
  emitirTicketSinTimbrado: boolean;
  impresion: ConfiguracionImpresion;
}>;

export function useActualizarConfiguracion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: ConfiguracionFormData) => {
      const payload = limpiar(datos);
      if (datos.logoUrl === null) payload.logoUrl = null;
      return http.patch<{ id: number }>("/configuracion", payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["configuracion"] });
      // El color primario y el logo viven en la sesión: hay que refrescar
      // /auth/me para que el sidebar y el encabezado los tomen.
      void queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}

/** Extrae el mensaje legible de cualquier error de la API. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado.";
}

/** Campo concreto del DTO que falló la validación. */
export function errorDeCampo(
  error: unknown,
  campo: string,
): string | undefined {
  if (error instanceof ApiError) return error.errorDeCampo(campo);
  return undefined;
}

/** Estado del diálogo de alta/edición, para no repetir useState en cada pantalla. */
export type DialogoState =
  { modo: "cerrado" } | { modo: "crear" } | { modo: "editar"; id: number };

export function useDialogo() {
  const [estado, setEstado] = useState<DialogoState>({ modo: "cerrado" });
  const abrirCrear = useCallback(() => setEstado({ modo: "crear" }), []);
  const abrirEditar = useCallback(
    (id: number) => setEstado({ modo: "editar", id }),
    [],
  );
  const cerrar = useCallback(() => setEstado({ modo: "cerrado" }), []);

  return {
    estado,
    modo: estado.modo,
    abierto: estado.modo !== "cerrado",
    editando: estado.modo === "editar",
    id: estado.modo === "editar" ? estado.id : null,
    abrirCrear,
    abrirEditar,
    cerrar,
  };
}
