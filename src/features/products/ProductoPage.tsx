import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  IconButton,
  NativeSelect,
  Text,
  chakra,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  Eye,
  FileDown,
  FileSpreadsheet,
  Package,
  PackageSearch,
  Pencil,
  Pill,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data/DataTable";
import { FormDialog } from "@/components/data/FormDialog";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import {
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import {
  errorDeCampo,
  mensajeDeError,
  useDialogo,
} from "@/features/clients/clients.service";
import { formatFecha, formatFechaCalendario, formatMoneda } from "@/lib/formato";
import { urlDeArchivo } from "@/services/api";
import type { Producto } from "@/types/dominio";
import { AjusteStockDialog, type AjusteStockValores } from "./AjusteStockDialog";
import { ProductoDetalle } from "./ProductoDetalle";
import { ProductoForm, type ProductoFormValues } from "./ProductoForm";
import { VerLotesDialog } from "./VerLotesDialog";
import {
  descargarProductosExcel,
  descargarProductosPdf,
} from "./productos.export";
import {
  PRODUCTOS_POR_PAGINA,
  obtenerProductosParaExportar,
  useActualizarProducto,
  useAjustarStockProducto,
  useCategoriasProducto,
  useCrearProducto,
  useDesactivarProducto,
  useProductoDetalle,
  useProductoResumen,
  useProductos,
  useProveedoresProducto,
  useReactivarProducto,
  type ProductoFiltros,
} from "./products.service";

type OrdenProducto = NonNullable<ProductoFiltros["ordenarPor"]>;

const OPCIONES_ORDEN: Array<{ valor: OrdenProducto; etiqueta: string }> = [
  { valor: "nombre", etiqueta: "Nombre (A-Z)" },
  { valor: "stock", etiqueta: "Menor stock primero" },
  { valor: "precio", etiqueta: "Mayor precio primero" },
  { valor: "recientes", etiqueta: "Más recientes" },
  { valor: "codigo", etiqueta: "Código" },
];

function formatearCantidad(valor: string | number | null | undefined) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "0";
  return new Intl.NumberFormat("es-PY", {
    maximumFractionDigits: 2,
  }).format(numero);
}

function TarjetaResumen({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  color = "brand",
  alerta,
}: {
  icono: typeof Boxes;
  etiqueta: string;
  valor: string | number;
  detalle: string;
  color?: "brand" | "success" | "orange" | "red";
  alerta?: boolean;
}) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor={alerta ? `${color}.200` : "ink.200"}
      borderRadius="xl"
      p={{ base: "4", md: "5" }}
      boxShadow="sm"
    >
      <Flex align="flex-start" justify="space-between" gap="3">
        <Box minW="0">
          <Text
            fontSize="2xs"
            fontWeight="semibold"
            color="ink.500"
            textTransform="uppercase"
            letterSpacing="0.05em"
          >
            {etiqueta}
          </Text>
          <Text
            fontSize={{ base: "xl", md: "2xl" }}
            fontWeight="bold"
            color="ink.900"
            lineHeight="1.2"
            mt="1.5"
            fontVariantNumeric="tabular-nums"
          >
            {valor}
          </Text>
          <Text fontSize="xs" color="ink.500" mt="1">
            {detalle}
          </Text>
        </Box>
        <Flex
          align="center"
          justify="center"
          w="10"
          h="10"
          flexShrink={0}
          borderRadius="lg"
          bg={`${color}.subtle`}
          color={`${color}.600`}
        >
          <Icono size={20} />
        </Flex>
      </Flex>
    </Box>
  );
}

function CeldaVencimiento({
  producto,
  puedeVerLotes,
  onVerLotes,
}: {
  producto: Producto;
  puedeVerLotes: boolean;
  onVerLotes: () => void;
}) {
  const alerta = producto.alertaVencimiento;

  if (!producto.cantidadLotes) {
    return (
      <Text fontSize="sm" color="ink.400" whiteSpace="nowrap">
        Sin lotes
      </Text>
    );
  }

  if (!alerta) {
    return producto.proximoVencimiento ? (
      <Box>
        <Badge colorPalette="green" variant="subtle" size="sm">
          Vigente
        </Badge>
        <Text fontSize="xs" color="ink.500" mt="1" whiteSpace="nowrap">
          Próximo {formatFechaCalendario(producto.proximoVencimiento)}
        </Text>
      </Box>
    ) : (
      <Badge colorPalette="gray" variant="subtle" size="sm">
        Sin vencimiento
      </Badge>
    );
  }

  const vencido = alerta === "vencido";
  const cantidad = vencido
    ? (producto.lotesVencidos ?? 0)
    : (producto.lotesPorVencer ?? 0);
  const lotes = producto.lotesAlerta ?? [];
  const primero = lotes[0];
  const restantes = lotes.length - 1;

  const contenido = (
    <Box>
      <Badge
        colorPalette={vencido ? "red" : "orange"}
        variant="solid"
        size="sm"
      >
        {vencido ? "Vencido" : "Por vencer"}
        {cantidad > 1 ? ` · ${cantidad} lotes` : ""}
      </Badge>
      {primero && (
        <Text
          fontSize="xs"
          color={vencido ? "red.700" : "orange.700"}
          mt="1"
          whiteSpace="nowrap"
        >
          Lote{" "}
          <chakra.span fontFamily="mono" fontWeight="semibold">
            {primero.codigoLote}
          </chakra.span>{" "}
          · {formatFechaCalendario(primero.fechaVencimiento)}
        </Text>
      )}
      {restantes > 0 && (
        <Text fontSize="2xs" color="ink.500" mt="0.5">
          +{restantes} lote{restantes === 1 ? "" : "s"} en alerta
        </Text>
      )}
    </Box>
  );

  if (!puedeVerLotes) return contenido;

  return (
    <chakra.button
      type="button"
      onClick={(evento: React.MouseEvent) => {
        evento.stopPropagation();
        onVerLotes();
      }}
      display="block"
      w="full"
      textAlign="left"
      borderRadius="md"
      p="1"
      m="-1"
      title="Ver lotes"
      _hover={{ bg: vencido ? "red.100" : "orange.100" }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: vencido ? "red.500" : "orange.500",
        outlineOffset: "2px",
      }}
    >
      {contenido}
    </chakra.button>
  );
}

export function ProductoPage() {
  const { puede } = useAuth();
  const dialogo = useDialogo();
  const { texto, setTexto, busqueda } = useBusquedaDiferida();

  const [pagina, setPagina] = useState(1);
  const [categoriaId, setCategoriaId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [soloMedicamentos, setSoloMedicamentos] = useState(false);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [vencimiento, setVencimiento] = useState<
    "" | "vencidos" | "por_vencer"
  >("");
  const [orden, setOrden] = useState<OrdenProducto>("nombre");
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [lotesProductoId, setLotesProductoId] = useState<number | null>(null);
  const [stockProducto, setStockProducto] = useState<Producto | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<{
    src: string;
    nombre: string;
  } | null>(null);

  const direccion: "asc" | "desc" =
    orden === "precio" || orden === "recientes" ? "desc" : "asc";

  const consulta = useProductos({
    busqueda,
    pagina,
    categoriaId: categoriaId ? Number(categoriaId) : undefined,
    proveedorId: proveedorId ? Number(proveedorId) : undefined,
    incluirInactivos,
    soloMedicamentos,
    vencimiento: vencimiento || undefined,
    ordenarPor: orden,
    direccion,
  });
  const resumen = useProductoResumen();
  const categorias = useCategoriasProducto();
  const proveedores = useProveedoresProducto();

  const detalle = useProductoDetalle(detalleId ?? undefined);
  const detalleEnListado = useMemo(
    () =>
      consulta.data?.items.find((item) => item.id === detalleId) ?? null,
    [consulta.data, detalleId],
  );
  const productoDetalle = detalle.data ?? detalleEnListado;

  const productoEditando = useMemo(
    () =>
      consulta.data?.items.find((item) => item.id === dialogo.id) ?? null,
    [consulta.data, dialogo.id],
  );

  const crear = useCrearProducto();
  const actualizar = useActualizarProducto();
  const ajustarStock = useAjustarStockProducto();
  const desactivar = useDesactivarProducto();
  const reactivar = useReactivarProducto();

  const guardando = crear.isPending || actualizar.isPending;
  const errorGuardado = crear.error ?? actualizar.error;
  const erroresServidor = obtenerErroresProducto(errorGuardado);

  function cambiarFiltro(accion: () => void) {
    accion();
    setPagina(1);
  }

  function limpiarFiltros() {
    setTexto("");
    setCategoriaId("");
    setProveedorId("");
    setSoloMedicamentos(false);
    setIncluirInactivos(false);
    setVencimiento("");
    setOrden("nombre");
    setPagina(1);
  }

  function alGuardar(datos: Parameters<typeof crear.mutateAsync>[0]) {
    const editando = dialogo.estado.modo === "editar";
    const peticion = editando
      ? actualizar.mutateAsync({ id: dialogo.id!, datos })
      : crear.mutateAsync(datos);

    peticion
      .then((producto) => {
        toaster.success({
          title: editando ? "Producto actualizado" : "Producto registrado",
          description: `${producto.nombre} · ${producto.codigo}`,
        });
        dialogo.cerrar();
        if (!editando) {
          setPagina(1);
          setDetalleId(producto.id);
        }
      })
      .catch((error) => {
        console.error(mensajeDeError(error));
      });
  }

  function ajustar(producto: Producto, valores: AjusteStockValores) {
    ajustarStock
      .mutateAsync({ id: producto.id, ...valores })
      .then((actualizado) => {
        toaster.success({
          title:
            valores.tipo === "entrada"
              ? "Entrada registrada"
              : "Salida registrada",
          description: `${producto.nombre}: stock actual ${formatearCantidad(actualizado.stockActual)} ${producto.unidadMedida}.`,
        });
        setStockProducto(null);
      })
      .catch((error) => {
        console.error(mensajeDeError(error));
      });
  }

  function cambiarEstado(producto: Producto) {
    const accion = producto.activo ? "desactivar" : "reactivar";
    const acepta = window.confirm(
      `¿Querés ${accion} ${producto.nombre}?\n\n` +
        (producto.activo
          ? "Dejará de aparecer en ventas y en el catálogo. El historial de stock y las ventas anteriores se conservan."
          : "Volverá a estar disponible para la venta."),
    );

    if (!acepta) return;

    const peticion = producto.activo
      ? desactivar.mutateAsync(producto.id)
      : reactivar.mutateAsync(producto.id);

    peticion
      .then((respuesta) => {
        toaster.success({
          title:
            producto.activo ? "Producto desactivado" : "Producto reactivado",
          description: respuesta.mensaje,
        });
      })
      .catch((error) => {
        toaster.error({
          title: "No se pudo cambiar el estado",
          description: mensajeDeError(error),
        });
      });
  }

  async function exportarProductos(formato: "excel" | "pdf") {
    setExportando(formato);

    try {
      const productos = await obtenerProductosParaExportar({
        busqueda,
        categoriaId: categoriaId ? Number(categoriaId) : undefined,
        proveedorId: proveedorId ? Number(proveedorId) : undefined,
        incluirInactivos,
        soloMedicamentos,
        vencimiento: vencimiento || undefined,
        ordenarPor: orden,
        direccion,
      });

      if (formato === "excel") {
        descargarProductosExcel(productos);
      } else {
        descargarProductosPdf(productos, busqueda);
      }

      toaster.success({
        title: `Archivo ${formato === "excel" ? "Excel" : "PDF"} descargado`,
        description: `Se exportaron ${productos.length} productos.`,
      });
    } catch (error) {
      toaster.error({
        title: "No se pudo exportar la lista",
        description: mensajeDeError(error),
      });
    } finally {
      setExportando(null);
    }
  }

  const columnas = useMemo<ColumnDef<Producto, unknown>[]>(
    () => [
      {
        accessorKey: "nombre",
        header: "Producto",
        cell: ({ row }) => {
          const producto = row.original;
          const foto = producto.fotoUrl
            ? urlDeArchivo(producto.fotoUrl)
            : null;
          return (
            <Flex align="center" gap="3" opacity={producto.activo ? 1 : 0.65}>
              {foto ? (
                <chakra.button
                  type="button"
                  onClick={(evento: React.MouseEvent) => {
                    evento.stopPropagation();
                    setFotoAmpliada({
                      src: foto,
                      nombre: producto.nombre,
                    });
                  }}
                  position="relative"
                  w="11"
                  h="11"
                  flexShrink={0}
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor="ink.200"
                  bg="ink.50"
                  overflow="hidden"
                  cursor="zoom-in"
                  aria-label={`Ampliar foto de ${producto.nombre}`}
                  title="Ampliar foto"
                  _hover={{
                    borderColor: "brand.300",
                    "& [data-zoom]": { opacity: 1 },
                  }}
                  _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "brand.500",
                    outlineOffset: "2px",
                  }}
                >
                  <chakra.img
                    src={foto}
                    alt=""
                    w="full"
                    h="full"
                    objectFit="cover"
                  />
                  <Flex
                    data-zoom
                    position="absolute"
                    top="0"
                    left="0"
                    right="0"
                    bottom="0"
                    align="center"
                    justify="center"
                    bg="rgba(0, 0, 0, 0.45)"
                    color="white"
                    opacity="0"
                    transition="opacity 0.15s ease"
                  >
                    <ZoomIn size={16} />
                  </Flex>
                </chakra.button>
              ) : (
                <Flex
                  align="center"
                  justify="center"
                  w="11"
                  h="11"
                  flexShrink={0}
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor="ink.200"
                  bg="ink.50"
                >
                  <Package
                    size={17}
                    color="var(--chakra-colors-ink-400)"
                  />
                </Flex>
              )}

              <Box minW="0">
                <Flex align="center" gap="1.5" wrap="wrap">
                  <chakra.span fontWeight="semibold" color="ink.900">
                    {producto.nombre}
                  </chakra.span>
                  {producto.esControlado && (
                    <Badge colorPalette="red" variant="subtle" size="sm">
                      Controlado
                    </Badge>
                  )}
                  {producto.requiereReceta && !producto.esControlado && (
                    <Badge colorPalette="orange" variant="subtle" size="sm">
                      Receta
                    </Badge>
                  )}
                </Flex>
                {(producto.marca || producto.presentacion) && (
                  <Text fontSize="xs" color="ink.500" mt="0.5">
                    {[producto.marca, producto.presentacion]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                )}
              </Box>
            </Flex>
          );
        },
      },
      {
        accessorKey: "codigo",
        header: "SKU",
        cell: ({ row }) => (
          <Badge
            colorPalette="gray"
            variant="outline"
            size="sm"
            fontFamily="mono"
          >
            {row.original.codigo}
          </Badge>
        ),
      },
      {
        accessorKey: "categoria",
        header: "Categoría",
        cell: ({ row }) =>
          row.original.categoria ? (
            <Badge colorPalette="gray" variant="subtle" size="sm">
              {row.original.categoria.nombre}
            </Badge>
          ) : (
            <Text fontSize="sm" color="ink.400">
              Sin categoría
            </Text>
          ),
      },
      {
        accessorKey: "stockActual",
        header: "Stock",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Text
            textAlign="right"
            fontSize="sm"
            fontWeight="semibold"
            color="ink.900"
            fontVariantNumeric="tabular-nums"
            whiteSpace="nowrap"
          >
            {formatearCantidad(row.original.stockActual)}{" "}
            <chakra.span fontWeight="normal" color="ink.500">
              {row.original.unidadMedida}
            </chakra.span>
          </Text>
        ),
      },
      {
        id: "vencimiento",
        header: "Vencimiento",
        cell: ({ row }) => (
          <CeldaVencimiento
            producto={row.original}
            puedeVerLotes={puede("lotes.ver")}
            onVerLotes={() => setLotesProductoId(row.original.id)}
          />
        ),
      },
      {
        accessorKey: "precioVenta",
        header: "Precio",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Box textAlign="right">
            <Text
              fontSize="sm"
              fontWeight="semibold"
              color="ink.900"
              fontVariantNumeric="tabular-nums"
            >
              {formatMoneda(row.original.precioVenta)}
            </Text>
            <Text fontSize="xs" color="ink.500" mt="0.5">
              Costo {formatMoneda(row.original.precioCosto)}
            </Text>
          </Box>
        ),
      },
      {
        id: "proveedor",
        header: "Proveedor",
        cell: ({ row }) =>
          row.original.proveedor ? (
            <Box>
              <Text fontSize="sm" color="ink.800">
                {row.original.proveedor.nombreFantasia ??
                  row.original.proveedor.razonSocial}
              </Text>
            </Box>
          ) : (
            <Text fontSize="sm" color="ink.400">
              Sin proveedor
            </Text>
          ),
      },
      {
        accessorKey: "creadoEn",
        header: "Alta",
        cell: ({ row }) => (
          <Text fontSize="sm" color="ink.600" whiteSpace="nowrap">
            {formatFecha(row.original.creadoEn) || "—"}
          </Text>
        ),
      },
      {
        id: "estado",
        header: "Estado",
        cell: ({ row }) =>
          row.original.activo ? (
            <Badge colorPalette="success" variant="solid" size="sm">
              Activo
            </Badge>
          ) : (
            <Badge colorPalette="gray" variant="solid" size="sm">
              Inactivo
            </Badge>
          ),
      },
      {
        id: "acciones",
        header: "Acciones",
        meta: { align: "right" },
        enableSorting: false,
        cell: ({ row }) => (
          <Flex justify="flex-end" gap="1">
            {puede("lotes.ver") && (row.original.cantidadLotes ?? 0) > 0 && (
              <chakra.button
                type="button"
                onClick={(evento: React.MouseEvent) => {
                  evento.stopPropagation();
                  setLotesProductoId(row.original.id);
                }}
                p="1.5"
                borderRadius="md"
                color="ink.500"
                _hover={{ bg: "brand.subtle", color: "brand.700" }}
                aria-label={`Ver lotes de ${row.original.nombre}`}
                title={`Ver lotes (${row.original.cantidadLotes})`}
              >
                <PackageSearch size={16} />
              </chakra.button>
            )}

            <chakra.button
              type="button"
              onClick={(evento: React.MouseEvent) => {
                evento.stopPropagation();
                setDetalleId(row.original.id);
              }}
              p="1.5"
              borderRadius="md"
              color="ink.500"
              _hover={{ bg: "ink.100", color: "brand.600" }}
              aria-label={`Ver ${row.original.nombre}`}
              title="Ver ficha"
            >
              <Eye size={16} />
            </chakra.button>

            {(puede("productos.editar") || puede("stock.ajustar")) &&
              row.original.activo && (
                <chakra.button
                  type="button"
                  onClick={(evento: React.MouseEvent) => {
                    evento.stopPropagation();
                    setStockProducto(row.original);
                  }}
                  p="1.5"
                  borderRadius="md"
                  color="ink.500"
                  _hover={{ bg: "brand.subtle", color: "brand.700" }}
                  aria-label={`Ajustar stock de ${row.original.nombre}`}
                  title="Ajustar stock"
                >
                  <SlidersHorizontal size={16} />
                </chakra.button>
              )}

            {puede("productos.editar") && (
              <chakra.button
                type="button"
                onClick={(evento: React.MouseEvent) => {
                  evento.stopPropagation();
                  dialogo.abrirEditar(row.original.id);
                }}
                p="1.5"
                borderRadius="md"
                color="ink.500"
                _hover={{ bg: "ink.100", color: "brand.600" }}
                aria-label={`Editar ${row.original.nombre}`}
                title="Editar"
              >
                <Pencil size={16} />
              </chakra.button>
            )}

            {(row.original.activo
              ? puede("productos.eliminar")
              : puede("productos.editar")) && (
              <chakra.button
                type="button"
                onClick={(evento: React.MouseEvent) => {
                  evento.stopPropagation();
                  cambiarEstado(row.original);
                }}
                p="1.5"
                borderRadius="md"
                color="ink.500"
                _hover={{
                  bg: row.original.activo ? "danger.subtle" : "success.subtle",
                  color: row.original.activo ? "danger.600" : "success.600",
                }}
                aria-label={
                  row.original.activo
                    ? `Desactivar ${row.original.nombre}`
                    : `Reactivar ${row.original.nombre}`
                }
                title={row.original.activo ? "Desactivar" : "Reactivar"}
              >
                <Trash2 size={16} />
              </chakra.button>
            )}
          </Flex>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puede, desactivar, reactivar],
  );

  const hayFiltros =
    busqueda.trim().length > 0 ||
    categoriaId !== "" ||
    proveedorId !== "" ||
    soloMedicamentos ||
    incluirInactivos ||
    vencimiento !== "" ||
    orden !== "nombre";

  const datos = resumen.data;

  const filtros = (
    <Flex direction="column" gap="3" w="full">
      <Flex
        gap="3"
        align={{ base: "stretch", md: "center" }}
        wrap="wrap"
      >
        <Flex position="relative" flex="1" minW={{ base: "full", lg: "22rem" }}>
          <Box
            position="absolute"
            left="3"
            top="50%"
            transform="translateY(-50%)"
            color="ink.400"
            pointerEvents="none"
          >
            <Search size={16} />
          </Box>
          <chakra.input
            value={texto}
            onChange={(evento: React.ChangeEvent<HTMLInputElement>) => {
              setTexto(evento.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por nombre, código, marca, principio activo…"
            aria-label="Buscar productos"
            pl="9"
            pr={texto ? "9" : "3"}
            h="10"
            w="full"
            bg="white"
            borderWidth="1px"
            borderColor="ink.200"
            borderRadius="md"
            fontSize="sm"
            transition="border-color 0.15s ease, box-shadow 0.15s ease"
            _hover={{ borderColor: "ink.300" }}
            _focusVisible={{
              borderColor: "brand.500",
              boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
            }}
          />
          {texto && (
            <chakra.button
              type="button"
              onClick={() => {
                setTexto("");
                setPagina(1);
              }}
              position="absolute"
              right="2"
              top="50%"
              transform="translateY(-50%)"
              p="1.5"
              borderRadius="full"
              color="ink.400"
              _hover={{ bg: "ink.100", color: "ink.700" }}
              aria-label="Limpiar búsqueda"
            >
              <X size={14} />
            </chakra.button>
          )}
        </Flex>

        <NativeSelect.Root w={{ base: "full", sm: "11rem" }}>
          <NativeSelect.Field
            value={categoriaId}
            onChange={(evento) =>
              cambiarFiltro(() => setCategoriaId(evento.target.value))
            }
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            {categorias.data?.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
                {categoria.cantidad !== undefined
                  ? ` (${categoria.cantidad})`
                  : ""}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>

        <NativeSelect.Root w={{ base: "full", sm: "11rem" }}>
          <NativeSelect.Field
            value={proveedorId}
            onChange={(evento) =>
              cambiarFiltro(() => setProveedorId(evento.target.value))
            }
            aria-label="Filtrar por proveedor"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.data?.map((proveedor) => (
              <option key={proveedor.id} value={proveedor.id}>
                {proveedor.nombreMostrable ?? proveedor.razonSocial}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>

        <NativeSelect.Root w={{ base: "full", sm: "11rem" }}>
          <NativeSelect.Field
            value={orden}
            onChange={(evento) =>
              cambiarFiltro(() =>
                setOrden(evento.target.value as OrdenProducto),
              )
            }
            aria-label="Ordenar productos"
          >
            {OPCIONES_ORDEN.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Flex>

      <Flex gap="2" wrap="wrap" align="center">
        <Button
          size="sm"
          variant={soloMedicamentos ? "solid" : "outline"}
          colorPalette={soloMedicamentos ? "purple" : "gray"}
          onClick={() =>
            cambiarFiltro(() => setSoloMedicamentos((previo) => !previo))
          }
          aria-pressed={soloMedicamentos}
        >
          <Pill size={15} />
          Solo medicamentos
        </Button>

        <Button
          size="sm"
          variant={incluirInactivos ? "solid" : "outline"}
          colorPalette={incluirInactivos ? "brand" : "gray"}
          onClick={() =>
            cambiarFiltro(() => setIncluirInactivos((previo) => !previo))
          }
          aria-pressed={incluirInactivos}
        >
          <Tag size={15} />
          {incluirInactivos ? "Inactivos incluidos" : "Incluir inactivos"}
        </Button>

        <Button
          size="sm"
          variant={vencimiento === "vencidos" ? "solid" : "outline"}
          colorPalette={vencimiento === "vencidos" ? "red" : "gray"}
          disabled={
            datos !== undefined &&
            vencimiento !== "vencidos" &&
            datos.vencidos === 0
          }
          onClick={() =>
            cambiarFiltro(() =>
              setVencimiento((previo) =>
                previo === "vencidos" ? "" : "vencidos",
              ),
            )
          }
          aria-pressed={vencimiento === "vencidos"}
        >
          <AlertTriangle size={15} />
          Vencidos
        </Button>

        <Button
          size="sm"
          variant={vencimiento === "por_vencer" ? "solid" : "outline"}
          colorPalette={vencimiento === "por_vencer" ? "orange" : "gray"}
          disabled={
            datos !== undefined &&
            vencimiento !== "por_vencer" &&
            datos.porVencer === 0
          }
          onClick={() =>
            cambiarFiltro(() =>
              setVencimiento((previo) =>
                previo === "por_vencer" ? "" : "por_vencer",
              ),
            )
          }
          aria-pressed={vencimiento === "por_vencer"}
        >
          <CalendarClock size={15} />
          Por vencer
        </Button>

        {hayFiltros && (
          <Button size="sm" variant="ghost" onClick={limpiarFiltros}>
            <X size={15} />
            Limpiar filtros
          </Button>
        )}

        <Flex
          gap="2"
          ml={{ base: "0", md: "auto" }}
          w={{ base: "full", sm: "auto" }}
        >
          <Button
            variant="outline"
            size="sm"
            flex={{ base: "1", sm: "initial" }}
            disabled={exportando !== null || consulta.data?.total === 0}
            loading={exportando === "excel"}
            loadingText="Preparando."
            onClick={() => void exportarProductos("excel")}
          >
            <FileSpreadsheet size={16} />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            flex={{ base: "1", sm: "initial" }}
            disabled={exportando !== null || consulta.data?.total === 0}
            loading={exportando === "pdf"}
            loadingText="Preparando."
            onClick={() => void exportarProductos("pdf")}
          >
            <FileDown size={16} />
            PDF
          </Button>
        </Flex>

        {consulta.data && (
          <Text fontSize="xs" color="ink.500">
            {consulta.data.total}{" "}
            {consulta.data.total === 1 ? "producto" : "productos"}
          </Text>
        )}
      </Flex>
    </Flex>
  );

  return (
    <Box>
      <PageHeader
        titulo="Productos"
        descripcion="Medicamentos, alimentos, accesorios e insumos de la veterinaria."
        acciones={
          puede("productos.crear") ? (
            <Button colorPalette="brand" onClick={dialogo.abrirCrear}>
              <Package size={17} />
              Nuevo producto
            </Button>
          ) : null
        }
      />

      <Grid
        templateColumns={{
          base: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          xl: "repeat(4, minmax(0, 1fr))",
        }}
        gap="3"
        mb="5"
      >
        <TarjetaResumen
          icono={Boxes}
          etiqueta="Productos activos"
          valor={datos ? datos.total : "—"}
          detalle={`${datos?.medicamentos ?? 0} medicamentos`}
        />
        <TarjetaResumen
          icono={AlertTriangle}
          etiqueta="Reposición"
          valor={datos ? datos.bajoStock + datos.agotados : "—"}
          detalle={`${datos?.bajoStock ?? 0} con stock bajo · ${datos?.agotados ?? 0} agotados`}
          color="orange"
          alerta={(datos?.bajoStock ?? 0) + (datos?.agotados ?? 0) > 0}
        />
        <TarjetaResumen
          icono={CircleDollarSign}
          etiqueta="Valor del inventario"
          valor={datos ? formatMoneda(datos.valorInventario) : "—"}
          detalle="Costo del stock disponible"
          color="success"
        />
        <TarjetaResumen
          icono={CalendarClock}
          etiqueta="Vencimientos"
          valor={datos ? datos.porVencer + datos.vencidos : "—"}
          detalle={`${datos?.porVencer ?? 0} lotes por vencer · ${datos?.vencidos ?? 0} vencidos`}
          color="red"
          alerta={(datos?.vencidos ?? 0) > 0}
        />
      </Grid>

      <Panel flush>
        <DataTable
          data={consulta.data?.items ?? []}
          columns={columnas}
          cargando={consulta.isLoading || consulta.isFetching}
          claveFila={(fila) => fila.id}
          hayBusqueda={hayFiltros}
          compacta
          vacioTitulo="Todavía no hay productos"
          vacioDetalle="Cargá tu primer medicamento, alimento o accesorio para empezar a controlar el inventario."
          acciones={filtros}
          onFilaClick={(fila) => setDetalleId(fila.id)}
          estiloFila={(producto) => {
            if (producto.alertaVencimiento === "vencido") {
              return {
                bg: "red.50",
                _hover: { bg: "red.100" },
                boxShadow:
                  "inset 3px 0 0 0 var(--chakra-colors-red-500)",
              };
            }
            if (producto.alertaVencimiento === "por_vencer") {
              return {
                bg: "orange.50",
                _hover: { bg: "orange.100" },
                boxShadow:
                  "inset 3px 0 0 0 var(--chakra-colors-orange-400)",
              };
            }
            return undefined;
          }}
        />

        {consulta.data && (
          <Paginacion
            pagina={pagina}
            totalPaginas={consulta.data.totalPaginas}
            total={consulta.data.total}
            porPagina={PRODUCTOS_POR_PAGINA}
            onCambioPagina={setPagina}
            singular="producto"
            plural="productos"
          />
        )}
      </Panel>

      <FormDialog
        abierto={dialogo.abierto}
        onClose={dialogo.cerrar}
        titulo={dialogo.editando ? "Editar producto" : "Nuevo producto"}
        descripcion={
          dialogo.editando
            ? "Actualizá precios, datos clínicos o la imagen del producto."
            : "Registrá un producto con sus datos comerciales y clínicos."
        }
        textoConfirmar={dialogo.editando ? "Guardar cambios" : "Registrar producto"}
        guardando={guardando}
        bloquearCierre={guardando}
        ancho="2xl"
        onConfirmar={() => {
          document
            .querySelector<HTMLFormElement>("#producto-form")
            ?.requestSubmit();
        }}
      >
        {dialogo.editando && !productoEditando ? (
          <Text role="alert" fontSize="sm" color="danger.600">
            No se encontró el producto en el listado actual. Cerrá el diálogo y
            volvé a intentarlo.
          </Text>
        ) : (
          <ProductoForm
            producto={productoEditando}
            categorias={categorias.data}
            proveedores={proveedores.data}
            onGuardar={alGuardar}
            errorGeneral={
              errorGuardado ? mensajeDeError(errorGuardado) : null
            }
            erroresServidor={erroresServidor}
          />
        )}
      </FormDialog>

      <VerLotesDialog
        productoId={lotesProductoId}
        onClose={() => setLotesProductoId(null)}
      />

      <ProductoDetalle
        abierto={detalleId !== null}
        producto={productoDetalle}
        cargando={detalle.isLoading}
        error={detalle.error}
        onClose={() => setDetalleId(null)}
        onEditar={(producto) => {
          setDetalleId(null);
          dialogo.abrirEditar(producto.id);
        }}
        onAjustarStock={(producto) => {
          setDetalleId(null);
          setStockProducto(producto);
        }}
        onCambiarEstado={cambiarEstado}
        cambiandoEstado={desactivar.isPending || reactivar.isPending}
      />

      <AjusteStockDialog
        abierto={stockProducto !== null}
        producto={stockProducto}
        onClose={() => setStockProducto(null)}
        onAjustar={(valores) => {
          if (stockProducto) ajustar(stockProducto, valores);
        }}
        guardando={ajustarStock.isPending}
        errorGeneral={
          ajustarStock.error ? mensajeDeError(ajustarStock.error) : null
        }
      />

      <DialogRoot
        open={fotoAmpliada !== null}
        onOpenChange={({ open }) => {
          if (!open) setFotoAmpliada(null);
        }}
        size="xl"
      >
        <DialogContent maxW="min(92vw, 56rem)" p="4">
          <DialogHeader
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap="3"
          >
            <Box minW="0">
              <DialogTitle truncate>
                {fotoAmpliada?.nombre ?? "Imagen del producto"}
              </DialogTitle>
            </Box>
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              borderRadius="full"
              onClick={() => setFotoAmpliada(null)}
              aria-label="Cerrar vista ampliada"
              title="Cerrar"
            >
              <X size={18} />
            </IconButton>
          </DialogHeader>
          <DialogBody>
            {fotoAmpliada && (
              <chakra.img
                src={fotoAmpliada.src}
                alt={`Imagen ampliada de ${fotoAmpliada.nombre}`}
                w="full"
                maxH="75vh"
                objectFit="contain"
                borderRadius="md"
              />
            )}
          </DialogBody>
        </DialogContent>
      </DialogRoot>
    </Box>
  );
}

const CAMPOS_PRODUCTO: (keyof ProductoFormValues)[] = [
  "codigo",
  "nombre",
  "descripcion",
  "codigoBarras",
  "codigoSifen",
  "categoriaId",
  "proveedorId",
  "marca",
  "laboratorio",
  "principioActivo",
  "concentracion",
  "presentacion",
  "especieDestino",
  "registroSenacsa",
  "ubicacion",
  "unidadMedida",
  "precioVenta",
  "precioCosto",
  "porcentajeIva",
  "stockMinimo",
  "fotoUrl",
  "activo",
];

function obtenerErroresProducto(
  error: unknown,
): Partial<Record<keyof ProductoFormValues, string>> {
  return CAMPOS_PRODUCTO.reduce<
    Partial<Record<keyof ProductoFormValues, string>>
  >((errores, campo) => {
    const mensaje = errorDeCampo(error, campo);
    if (mensaje) errores[campo] = mensaje;
    return errores;
  }, {});
}
