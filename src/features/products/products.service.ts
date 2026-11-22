import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { http } from "@/services/api";
import type {
  CategoriaProducto,
  Producto,
  ProductoLote,
  RespuestaAccion,
  RespuestaPaginada,
} from "@/types/dominio";

export const PRODUCTOS_POR_PAGINA = 5;

export interface ProductoFiltros {
  busqueda?: string;
  pagina?: number;
  categoriaId?: number;
  proveedorId?: number;
  incluirInactivos?: boolean;
  soloMedicamentos?: boolean;
  vencimiento?: "vencidos" | "por_vencer";
  ordenarPor?: "nombre" | "codigo" | "precio" | "stock" | "recientes";
  direccion?: "asc" | "desc";
}

export interface ProductoResumen {
  total: number;
  medicamentos: number;
  bajoStock: number;
  agotados: number;
  valorInventario: number;
  porVencer: number;
  vencidos: number;
}

export interface ProveedorProducto {
  id: number;
  documento: string;
  razonSocial: string;
  nombreFantasia: string | null;
  telefono: string | null;
  email: string | null;
  nombreMostrable?: string;
}

export interface ProductoPrecioPayload {
  id?: number;
  tipo: "venta" | "compra";
  monto: number;
  vigenteDesde: string;
  vigenteHasta?: string | null;
}

export interface ProductoFormData {
  codigo?: string;
  nombre: string;
  descripcion?: string | null;
  codigoBarras?: string | null;
  codigoSifen?: string | null;
  categoriaId?: number | null;
  proveedorId?: number | null;
  marca?: string | null;
  laboratorio?: string | null;
  principioActivo?: string | null;
  concentracion?: string | null;
  presentacion?: string | null;
  especieDestino?: string | null;
  registroSenacsa?: string | null;
  ubicacion?: string | null;
  unidadMedida: string;
  esMedicamento: boolean;
  esControlado: boolean;
  requiereReceta: boolean;
  requiereLote: boolean;
  requiereVencimiento: boolean;
  precioVenta: number;
  precioCosto: number;
  porcentajeIva: number;
  stockMinimo: number;
  fotoUrl?: string | null;
  activo: boolean;
  precios?: ProductoPrecioPayload[];
}

export interface CargaInicialStockItem {
  productoId: number;
  codigoLote?: string;
  fechaVencimiento?: string;
  cantidad: number;
}

export interface CargaInicialStockPayload {
  items: CargaInicialStockItem[];
}

export interface CargaInicialStockResultado {
  referencia: string;
  lineas: number;
  unidades: number;
  productos: number;
  mensaje: string;
}

export interface ResumenLotesProducto {
  cantidadLotes: number;
  cantidadTotal: number;
  lotesPorVencer: number;
  lotesVencidos: number;
  proximoVencimiento: string | null;
  alertaVencimiento: "vencido" | "por_vencer" | null;
}

export interface LotesProductoRespuesta {
  producto: Pick<
    Producto,
    "id" | "nombre" | "unidadMedida" | "stockActual" | "stockMinimo"
  >;
  lotes: ProductoLote[];
  resumen: ResumenLotesProducto;
}

export type EstadoStockProducto = "agotado" | "bajo" | "disponible";

export function estadoStockProducto(
  producto: Pick<Producto, "stockActual" | "stockMinimo">,
): EstadoStockProducto {
  const stock = Number(producto.stockActual);
  const minimo = Number(producto.stockMinimo);

  if (!Number.isFinite(stock) || stock <= 0) return "agotado";
  if (stock <= minimo) return "bajo";
  return "disponible";
}

export const UNIDADES_MEDIDA = [
  "unidad",
  "caja",
  "frasco",
  "ampolla",
  "comprimido",
  "tableta",
  "ml",
  "litro",
  "kg",
  "gramo",
  "bolsa",
  "sachet",
  "sobre",
  "tubo",
  "pomo",
  "pack",
] as const;

export const ESPECIES_DESTINO = [
  "Todas las especies",
  "Perros",
  "Gatos",
  "Perros y gatos",
  "Aves",
  "Roedores",
  "Equinos",
  "Bovinos",
  "Exóticos",
] as const;

function construirQueryProductos(
  filtros: ProductoFiltros,
  porPagina: number,
): string {
  const {
    busqueda = "",
    pagina = 1,
    categoriaId,
    proveedorId,
    incluirInactivos = false,
    soloMedicamentos = false,
    vencimiento,
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
  if (proveedorId) query.set("proveedorId", String(proveedorId));
  if (incluirInactivos) query.set("incluirInactivos", "true");
  if (soloMedicamentos) query.set("esMedicamento", "true");
  if (vencimiento) query.set("vencimiento", vencimiento);

  return query.toString();
}

export function useProductos(filtros: ProductoFiltros = {}) {
  const {
    busqueda = "",
    pagina = 1,
    categoriaId,
    proveedorId,
    incluirInactivos = false,
    soloMedicamentos = false,
    vencimiento,
    ordenarPor = "nombre",
    direccion = "asc",
  } = filtros;

  return useQuery({
    queryKey: [
      "productos",
      {
        busqueda,
        pagina,
        categoriaId,
        proveedorId,
        incluirInactivos,
        soloMedicamentos,
        vencimiento,
        ordenarPor,
        direccion,
      },
    ],
    queryFn: () =>
      http.get<RespuestaPaginada<Producto>>(
        `/productos?${construirQueryProductos(filtros, PRODUCTOS_POR_PAGINA)}`,
      ),
    placeholderData: (anterior) => anterior,
  });
}

export function useProductoResumen() {
  return useQuery({
    queryKey: ["productos", "resumen"],
    queryFn: () => http.get<ProductoResumen>("/productos/resumen"),
  });
}

export function useCategoriasProducto() {
  return useQuery({
    queryKey: ["productos", "categorias"],
    queryFn: () => http.get<CategoriaProducto[]>("/productos/categorias"),
    staleTime: 5 * 60_000,
  });
}

export function useProveedoresProducto() {
  return useQuery({
    queryKey: ["productos", "proveedores"],
    queryFn: () => http.get<ProveedorProducto[]>("/productos/proveedores"),
    staleTime: 60_000,
  });
}

export function useProductoDetalle(id?: number) {
  return useQuery({
    queryKey: ["productos", "detalle", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador del producto.");
      }
      return http.get<Producto>(`/productos/${id}`);
    },
    enabled: id !== undefined,
  });
}

export function useLotesProducto(id?: number) {
  return useQuery({
    queryKey: ["productos", "lotes", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Se necesita el identificador del producto.");
      }
      return http.get<LotesProductoRespuesta>(`/productos/${id}/lotes`);
    },
    enabled: id !== undefined,
  });
}

export function useCargaInicialStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: CargaInicialStockPayload) =>
      http.post<CargaInicialStockResultado>("/productos/carga-inicial", datos),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export async function obtenerProductosParaExportar(
  filtros: Omit<ProductoFiltros, "pagina"> = {},
): Promise<Producto[]> {
  const obtenerPagina = (pagina: number) =>
    http.get<RespuestaPaginada<Producto>>(
      `/productos?${construirQueryProductos(
        { ...filtros, pagina },
        PRODUCTOS_POR_PAGINA,
      )}`,
    );

  const primeraPagina = await obtenerPagina(1);
  const productos = [...primeraPagina.items];
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
    productos.push(...respuestas.flatMap((respuesta) => respuesta.items));
  }

  return productos;
}

function limpiarProducto(datos: ProductoFormData): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  const nullable = new Set([
    "categoriaId",
    "proveedorId",
    "descripcion",
    "codigoBarras",
    "codigoSifen",
    "marca",
    "laboratorio",
    "principioActivo",
    "concentracion",
    "presentacion",
    "especieDestino",
    "registroSenacsa",
    "ubicacion",
    "fotoUrl",
  ]);

  for (const [clave, valor] of Object.entries(datos)) {
    if (valor === undefined) continue;
    if (typeof valor === "string" && valor.trim() === "") {
      if (nullable.has(clave)) salida[clave] = null;
      continue;
    }
    salida[clave] = typeof valor === "string" ? valor.trim() : valor;
  }

  return salida;
}

export function useCrearProducto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: ProductoFormData) =>
      http.post<Producto>("/productos", limpiarProducto(datos)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["proveedores"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useActualizarProducto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ProductoFormData }) =>
      http.patch<Producto>(`/productos/${id}`, limpiarProducto(datos)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["proveedores"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useAjustarStockProducto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      tipo,
      cantidad,
      observacion,
    }: {
      id: number;
      tipo: "entrada" | "salida";
      cantidad: number;
      observacion?: string;
    }) =>
      http.patch<Producto>(`/productos/${id}/stock`, {
        tipo,
        cantidad,
        observacion,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDesactivarProducto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.delete<RespuestaAccion>(`/productos/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useReactivarProducto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      http.post<RespuestaAccion>(`/productos/${id}/reactivar`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["productos"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
