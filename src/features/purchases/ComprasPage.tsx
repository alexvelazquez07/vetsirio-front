import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  IconButton,
  Input,
  Skeleton,
  Stack,
  Stat,
  Table,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Edit,
  Eye,
  FileText,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data/DataTable";
import { FormDialog } from "@/components/data/FormDialog";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import {
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError } from "@/features/clients/clients.service";
import {
  formatCantidad,
  formatFecha,
  formatFechaCalendario,
  formatMoneda,
  formatMonedaUSD,
  formatRuc,
} from "@/lib/formato";
import { urlDeArchivo } from "@/services/api";
import { CompraForm } from "./CompraForm";
import {
  COMPRAS_POR_PAGINA,
  useActivarCompra,
  useAnularCompra,
  useCompraDetalle,
  useCompras,
  useComprasResumen,
  useCrearCompra,
  useEliminarCompra,
  type Compra,
  type CompraFiltros,
  type EstadoCompra,
  type EstadoFacturaCompra,
} from "./purchases.service";

/* ─────────────────────────────────── Datos ─────────────────────────────────── */

const ETIQUETAS_COMPROBANTE: Record<string, string> = {
  factura: "Factura",
  factura_credito_fiscal: "Factura crédito fiscal",
};

const ESTADOS_COMPRA: Record<
  EstadoFacturaCompra,
  { etiqueta: string; paleta: "orange" | "success" | "red" }
> = {
  PENDIENTE: { etiqueta: "Pendiente", paleta: "orange" },
  ACTIVA: { etiqueta: "Activa", paleta: "success" },
  ANULADA: { etiqueta: "Anulada", paleta: "red" },
};

const PESTANAS_ESTADO: { valor: EstadoCompra; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "activas", etiqueta: "Activas" },
  { valor: "pendientes", etiqueta: "Pendientes" },
  { valor: "anuladas", etiqueta: "Anuladas" },
];

function monto(moneda: string, valor: string | number | null | undefined): string {
  return moneda === "USD" ? formatMonedaUSD(valor) : formatMoneda(valor);
}

function nombreProveedor(compra: Compra): string {
  return (
    compra.proveedorRazonSocial ??
    compra.proveedor.nombreFantasia ??
    compra.proveedor.razonSocial
  );
}

/* ─────────────────────────────── Componentes de apoyo ─────────────────────────────── */

function TarjetaResumen({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  cargando,
  color = "brand",
}: {
  icono: typeof ShoppingCart;
  etiqueta: string;
  valor: string | number;
  detalle: string;
  cargando?: boolean;
  color?: "brand" | "success" | "orange" | "red";
}) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
      p={{ base: "4", md: "5" }}
    >
      <Flex align="flex-start" justify="space-between" gap="3">
        <Stat.Root minW="0" gap="1">
          <Stat.Label fontSize="sm" color="ink.600">
            {etiqueta}
          </Stat.Label>
          {cargando ? (
            <Skeleton h="8" w="32" borderRadius="md" my="0.5" />
          ) : (
            <Stat.ValueText
              fontSize={{ base: "xl", md: "2xl" }}
              fontWeight="bold"
              color="ink.900"
              fontVariantNumeric="tabular-nums"
            >
              {valor}
            </Stat.ValueText>
          )}
          <Stat.HelpText fontSize="xs" color="ink.500">
            {detalle}
          </Stat.HelpText>
        </Stat.Root>
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

function Tarjeta({
  titulo,
  icono: Icono,
  accesorio,
  flush = false,
  children,
}: {
  titulo?: string;
  icono?: typeof Building2;
  accesorio?: React.ReactNode;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box bg="white" borderWidth="1px" borderColor="ink.200" borderRadius="xl" overflow="hidden">
      {titulo && (
        <Flex
          align="center"
          justify="space-between"
          gap="3"
          px="5"
          py="3.5"
          borderBottomWidth={flush ? "1px" : "0"}
          borderColor="ink.200"
          pb={flush ? "3.5" : "0"}
        >
          <Flex align="center" gap="2.5">
            {Icono && (
              <Flex
                align="center"
                justify="center"
                w="8"
                h="8"
                borderRadius="lg"
                bg="brand.50"
                color="brand.600"
              >
                <Icono size={16} />
              </Flex>
            )}
            <Text fontSize="sm" fontWeight="semibold" color="ink.900">
              {titulo}
            </Text>
          </Flex>
          {accesorio}
        </Flex>
      )}
      <Box p={flush ? "0" : "5"} pt={titulo && !flush ? "3" : flush ? "0" : "5"}>
        {children}
      </Box>
    </Box>
  );
}

function FilaDato({
  etiqueta,
  children,
  mono = false,
}: {
  etiqueta: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <Flex justify="space-between" align="center" gap="4" fontSize="sm">
      <Text color="ink.600">{etiqueta}</Text>
      <Box color="ink.900" fontFamily={mono ? "mono" : undefined} textAlign="right">
        {children}
      </Box>
    </Flex>
  );
}

function BadgeCondicion({ condicion }: { condicion: string }) {
  const credito = condicion === "credito";
  return (
    <Badge colorPalette={credito ? "orange" : "green"} variant="subtle">
      {credito ? "Crédito" : "Contado"}
    </Badge>
  );
}

/* ───────────────────────────────── Detalle de compra ───────────────────────────────── */

function DetalleCompraDialog({
  id,
  onClose,
  onAnular,
  onEliminar,
  onActivar,
  onContinuarCarga,
  puedeAnular,
  puedeActivar,
}: {
  id?: number;
  onClose: () => void;
  onAnular: (compra: Compra) => void;
  onEliminar: (compra: Compra) => void;
  onActivar: (compra: Compra) => void;
  onContinuarCarga: (compra: Compra) => void;
  puedeAnular: boolean;
  puedeActivar: boolean;
}) {
  const consulta = useCompraDetalle(id);
  const compra = consulta.data;
  const archivo = urlDeArchivo(compra?.archivoUrl);
  const estado = compra ? ESTADOS_COMPRA[compra.estado] : null;

  return (
    <DialogRoot
      open={id !== undefined}
      onOpenChange={(detalle) => {
        if (!detalle.open) onClose();
      }}
      size="cover"
    >
      <DialogContent
        maxW="60rem"
        maxH="calc(100dvh - 3rem)"
        borderRadius="xl"
        overflow="hidden"
        p="0"
        display="flex"
        flexDirection="column"
      >
        <DialogHeader
          px={{ base: "4", md: "6" }}
          py="5"
          pr={{ base: "14", md: "16" }}
          bg="white"
          borderBottomWidth="1px"
          borderColor="ink.200"
          flexShrink="0"
        >
          <Flex align="center" gap="3.5" wrap="wrap">
            <Flex
              align="center"
              justify="center"
              w="11"
              h="11"
              flexShrink={0}
              borderRadius="xl"
              bg="brand.600"
              color="white"
            >
              <ReceiptText size={22} />
            </Flex>
            <Box minW="0" flex="1">
              <DialogTitle fontSize="lg" fontWeight="bold" color="ink.900" lineHeight="1.25">
                {compra ? `Compra ${compra.numeroComprobante}` : "Detalle de la compra"}
              </DialogTitle>
              {compra && (
                <Text fontSize="sm" color="ink.600" mt="0.5" truncate>
                  {nombreProveedor(compra)} · {formatFechaCalendario(compra.fechaEmision)}
                </Text>
              )}
            </Box>
            {compra && estado && (
              <Badge colorPalette={estado.paleta} variant="subtle" size="md">
                {estado.etiqueta}
              </Badge>
            )}
          </Flex>
        </DialogHeader>

        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          position="absolute"
          top="4"
          right="4"
          zIndex="1"
          borderRadius="full"
          onClick={onClose}
          aria-label="Cerrar detalle de la compra"
        >
          <X size={18} />
        </IconButton>

        <DialogBody px={{ base: "4", md: "6" }} py="5" overflowY="auto" bg="ink.50" flex="1" minH="0">
          {consulta.isLoading ? (
            <Stack gap="4" role="status" aria-label="Cargando compra">
              <Skeleton h="28" borderRadius="xl" />
              <Skeleton h="56" borderRadius="xl" />
              <Skeleton h="32" borderRadius="xl" />
            </Stack>
          ) : !compra ? (
            <Alert status="error" title="No se pudo cargar la compra">
              {consulta.error ? mensajeDeError(consulta.error) : "Intentá de nuevo."}
            </Alert>
          ) : (
            <Stack gap="5">
              {compra.estado === "ANULADA" && (
                <Alert
                  status="warning"
                  rounded="md"
                  title="Compra anulada"
                  icon={<TriangleAlert size={18} />}
                >
                  {compra.anuladaMotivo ?? "El stock de esta compra ya fue revertido."}
                  {compra.anuladaEn ? ` · ${formatFecha(compra.anuladaEn)}` : ""}
                </Alert>
              )}

              {compra.estado === "PENDIENTE" && (
                <Alert
                  status="info"
                  rounded="md"
                  title="Compra pendiente"
                  icon={<TriangleAlert size={18} />}
                >
                  Está registrada pero todavía no modificó el stock. Podés continuar cargándola, activarla o eliminarla.
                </Alert>
              )}

              <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="5">
                <Tarjeta titulo="Proveedor" icono={Building2}>
                  <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                    {compra.proveedorRazonSocial ?? compra.proveedor.razonSocial}
                  </Text>
                  <Text fontSize="sm" color="ink.600" mt="1">
                    RUC {formatRuc(compra.proveedorDocumento ?? compra.proveedor.documento)}
                  </Text>
                  {compra.proveedorDireccion && (
                    <Text fontSize="sm" color="ink.600" mt="1">
                      {compra.proveedorDireccion}
                    </Text>
                  )}
                  {(compra.proveedorTelefono || compra.proveedorEmail) && (
                    <Text fontSize="sm" color="ink.600" mt="1">
                      {[compra.proveedorTelefono, compra.proveedorEmail].filter(Boolean).join(" · ")}
                    </Text>
                  )}
                </Tarjeta>

                <Tarjeta titulo="Comprobante" icono={ReceiptText}>
                  <Stack gap="2.5">
                    <FilaDato etiqueta="Timbrado" mono>
                      {compra.timbrado}
                    </FilaDato>
                    <FilaDato etiqueta="Número" mono>
                      {compra.numero}
                    </FilaDato>
                    <FilaDato etiqueta="Tipo">
                      {ETIQUETAS_COMPROBANTE[compra.tipoComprobante] ?? compra.tipoComprobante}
                    </FilaDato>
                    <FilaDato etiqueta="Condición">
                      <BadgeCondicion condicion={compra.condicionPago} />
                    </FilaDato>
                    {compra.fechaVencimiento && (
                      <FilaDato etiqueta="Vencimiento">
                        {formatFechaCalendario(compra.fechaVencimiento)}
                      </FilaDato>
                    )}
                    <FilaDato etiqueta="Moneda">
                      {compra.moneda}
                      {compra.moneda === "USD" && compra.tipoCambio
                        ? ` · Gs. ${formatMoneda(compra.tipoCambio)}`
                        : ""}
                    </FilaDato>
                  </Stack>
                </Tarjeta>
              </Grid>

              <Tarjeta
                titulo="Ítems de la factura"
                icono={ShoppingCart}
                flush
                accesorio={
                  <Badge colorPalette="gray" variant="subtle">
                    {compra.items?.length ?? 0}
                  </Badge>
                }
              >
                <Table.ScrollArea>
                  <Table.Root size="md">
                    <Table.Header>
                      <Table.Row bg="ink.50">
                        <Table.ColumnHeader>Producto</Table.ColumnHeader>
                        <Table.ColumnHeader>Lote</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Cantidad</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Costo</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">IVA</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="end">Total</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {compra.items?.map((item) => (
                        <Table.Row key={item.id}>
                          <Table.Cell minW="14rem">
                            <Text fontSize="sm" fontWeight="medium" color="ink.900">
                              {item.producto?.nombre ?? item.descripcion}
                            </Text>
                            {(item.codigo || item.unidadMedida) && (
                              <Text fontSize="xs" color="ink.500">
                                {[item.codigo, item.unidadMedida].filter(Boolean).join(" · ")}
                              </Text>
                            )}
                          </Table.Cell>
                          <Table.Cell fontSize="sm" color="ink.600">
                            {item.lote?.codigoLote ?? "—"}
                            {item.lote?.fechaVencimiento && (
                              <Text fontSize="xs" color="ink.500">
                                Vence {formatFechaCalendario(item.lote.fechaVencimiento)}
                              </Text>
                            )}
                          </Table.Cell>
                          <Table.Cell textAlign="end" fontVariantNumeric="tabular-nums">
                            {formatCantidad(item.cantidad, 4)}
                          </Table.Cell>
                          <Table.Cell textAlign="end" fontVariantNumeric="tabular-nums">
                            {monto(compra.moneda, item.costoUnitario)}
                          </Table.Cell>
                          <Table.Cell textAlign="end" color="ink.600">
                            {item.porcentajeIva} %
                          </Table.Cell>
                          <Table.Cell textAlign="end" fontWeight="semibold" fontVariantNumeric="tabular-nums">
                            {monto(compra.moneda, item.total)}
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Table.ScrollArea>
              </Tarjeta>

              <Grid templateColumns={{ base: "1fr", md: "1.2fr 0.8fr" }} gap="5">
                <Tarjeta titulo="Observaciones" icono={FileText}>
                  <Text fontSize="sm" color="ink.700" whiteSpace="pre-wrap">
                    {compra.observaciones || "Sin observaciones."}
                  </Text>
                  <Text fontSize="xs" color="ink.500" mt="4">
                    Registrada por {compra.usuario.nombre} {compra.usuario.apellido}
                  </Text>
                </Tarjeta>

                <Tarjeta titulo="Totales" icono={CircleDollarSign}>
                  <Stack gap="2.5">
                    <FilaDato etiqueta="Subtotal">{monto(compra.moneda, compra.subtotal)}</FilaDato>
                    <FilaDato etiqueta="IVA 5 %">{monto(compra.moneda, compra.iva5)}</FilaDato>
                    <FilaDato etiqueta="IVA 10 %">{monto(compra.moneda, compra.iva10)}</FilaDato>
                    <FilaDato etiqueta="Base exenta">{monto(compra.moneda, compra.exenta)}</FilaDato>
                    <FilaDato etiqueta="IVA total">{monto(compra.moneda, compra.IVA)}</FilaDato>
                    <Flex
                      justify="space-between"
                      align="center"
                      gap="3"
                      pt="3"
                      mt="1"
                      borderTopWidth="1px"
                      borderColor="ink.200"
                    >
                      <Text fontWeight="bold" color="ink.900">
                        Total
                      </Text>
                      <Text fontSize="xl" fontWeight="bold" color="ink.900" fontVariantNumeric="tabular-nums">
                        {monto(compra.moneda, compra.total)}
                      </Text>
                    </Flex>
                  </Stack>
                </Tarjeta>
              </Grid>
            </Stack>
          )}
        </DialogBody>

        <DialogFooter
          px={{ base: "4", md: "6" }}
          py="4"
          borderTopWidth="1px"
          borderColor="ink.200"
          bg="white"
          gap="2"
          flexWrap="wrap"
          flexShrink="0"
        >
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Flex gap="2" ml="auto" wrap="wrap">
            {archivo && (
              <Button variant="outline" asChild>
                <a href={archivo} target="_blank" rel="noreferrer">
                  <FileText size={15} /> Ver factura
                </a>
              </Button>
            )}

            {compra && compra.estado === "PENDIENTE" && (
              <Button colorPalette="brand" variant="outline" onClick={() => onContinuarCarga(compra)}>
                <Edit size={15} /> Continuar cargando
              </Button>
            )}

            {compra && compra.estado === "ACTIVA" && puedeAnular && (
              <Button colorPalette="red" variant="outline" onClick={() => onAnular(compra)}>
                <Ban size={15} /> Anular compra
              </Button>
            )}

            {compra && compra.estado === "PENDIENTE" && puedeAnular && (
              <Button colorPalette="red" variant="outline" onClick={() => onEliminar(compra)}>
                <Trash2 size={15} /> Eliminar compra
              </Button>
            )}

            {compra && compra.estado === "PENDIENTE" && puedeActivar && (
              <Button colorPalette="brand" onClick={() => onActivar(compra)}>
                <CheckCircle2 size={16} /> Activar compra
              </Button>
            )}
          </Flex>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

/* ─────────────────────────────────────── Página ─────────────────────────────────────── */

export function ComprasPage() {
  const { puede } = useAuth();
  const { texto, setTexto, busqueda } = useBusquedaDiferida();

  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<EstadoCompra>("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  
  // Estado para manejar el formulario (nueva o edición de pendiente)
  const [compraEditando, setCompraEditando] = useState<Compra | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);

  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [compraAnulando, setCompraAnulando] = useState<Compra | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [compraEliminando, setCompraEliminando] = useState<Compra | null>(null);
  const [compraActivando, setCompraActivando] = useState<Compra | null>(null);

  const filtros: CompraFiltros = {
    busqueda,
    pagina,
    estado,
    desde: desde || undefined,
    hasta: hasta || undefined,
    ordenarPor: "fecha",
    direccion: "desc",
  };

  const consulta = useCompras(filtros);
  const resumen = useComprasResumen();
  const crear = useCrearCompra();
  const anular = useAnularCompra();
  const eliminar = useEliminarCompra();
  const activar = useActivarCompra();

  const puedeAnular = puede("facturas.anular");
  const puedeActivar = puede("facturas.emitir");

  const resumenPYG = resumen.data?.porMoneda.find((item) => item.moneda === "PYG");
  const resumenUSD = resumen.data?.porMoneda.find((item) => item.moneda === "USD");

  const hayFiltros = Boolean(busqueda || desde || hasta);
  const hayBusqueda = hayFiltros || estado !== "todas";

  function limpiarFiltros() {
    setTexto("");
    setDesde("");
    setHasta("");
    setPagina(1);
  }

  function refrescar() {
    void consulta.refetch();
    void resumen.refetch();
  }

  function abrirActivar(compra: Compra) {
    activar.reset();
    setCompraActivando(compra);
  }

  function abrirEliminar(compra: Compra) {
    eliminar.reset();
    setCompraEliminando(compra);
  }

  function abrirAnular(compra: Compra) {
    anular.reset();
    setMotivoAnulacion("");
    setCompraAnulando(compra);
  }

  function abrirEdicionPendiente(compra: Compra) {
    setDetalleId(null);
    setCompraEditando(compra);
    setNuevaAbierta(true);
  }

  const columnas = useMemo<ColumnDef<Compra, unknown>[]>(
    () => [
      {
        accessorKey: "numeroComprobante",
        header: "Comprobante",
        cell: ({ row }) => {
          const compra = row.original;
          const items = compra._count?.items ?? 0;
          return (
            <Box minW="0">
              <Text fontWeight="semibold" color="ink.900" fontSize="sm" fontFamily="mono">
                {compra.numeroComprobante}
              </Text>
              <Text fontSize="xs" color="ink.500" mt="0.5">
                {ETIQUETAS_COMPROBANTE[compra.tipoComprobante] ?? compra.tipoComprobante} · {items}{" "}
                {items === 1 ? "ítem" : "ítems"}
              </Text>
            </Box>
          );
        },
      },
      {
        accessorKey: "proveedorNombre",
        header: "Proveedor",
        cell: ({ row }) => (
          <Box minW="0">
            <Text fontSize="sm" fontWeight="medium" color="ink.900">
              {row.original.proveedorNombre ?? row.original.proveedor.razonSocial}
            </Text>
            <Text fontSize="xs" color="ink.500" mt="0.5">
              RUC {formatRuc(row.original.proveedor.documento)}
            </Text>
          </Box>
        ),
      },
      {
        accessorKey: "fechaEmision",
        header: "Emisión",
        cell: ({ row }) => (
          <Box>
            <Text fontSize="sm" color="ink.800">
              {formatFechaCalendario(row.original.fechaEmision)}
            </Text>
            {row.original.fechaVencimiento && (
              <Text fontSize="xs" color="ink.500" mt="0.5">
                Vence {formatFechaCalendario(row.original.fechaVencimiento)}
              </Text>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "condicionPago",
        header: "Condición",
        cell: ({ row }) => <BadgeCondicion condicion={row.original.condicionPago} />,
      },
      {
        accessorKey: "total",
        header: "Total",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Text fontSize="sm" fontWeight="bold" color="ink.900" fontVariantNumeric="tabular-nums">
            {monto(row.original.moneda, row.original.total)}
          </Text>
        ),
      },
      {
        accessorKey: "estado",
        header: "Estado",
        cell: ({ row }) => {
          const datos = ESTADOS_COMPRA[row.original.estado];
          return (
            <Badge colorPalette={datos.paleta} variant="subtle">
              {datos.etiqueta}
            </Badge>
          );
        },
      },
      {
        id: "acciones",
        header: "",
        meta: { align: "right" },
        enableSorting: false,
        cell: ({ row }) => {
          const compra = row.original;
          return (
            <Flex justify="flex-end" gap="0.5">
              <IconButton
                type="button"
                aria-label={`Ver compra ${compra.numeroComprobante}`}
                title="Ver detalle"
                size="xs"
                variant="ghost"
                onClick={(evento) => {
                  evento.stopPropagation();
                  setDetalleId(compra.id);
                }}
              >
                <Eye size={16} />
              </IconButton>

              {compra.estado === "PENDIENTE" && (
                <IconButton
                  type="button"
                  aria-label={`Continuar cargando compra ${compra.numeroComprobante}`}
                  title="Continuar cargando"
                  size="xs"
                  variant="ghost"
                  colorPalette="brand"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    abrirEdicionPendiente(compra);
                  }}
                >
                  <Edit size={16} />
                </IconButton>
              )}

              {puedeActivar && compra.estado === "PENDIENTE" && (
                <IconButton
                  type="button"
                  aria-label={`Activar compra ${compra.numeroComprobante}`}
                  title="Activar"
                  size="xs"
                  variant="ghost"
                  colorPalette="green"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    abrirActivar(compra);
                  }}
                >
                  <CheckCircle2 size={16} />
                </IconButton>
              )}

              {puedeAnular && compra.estado === "ACTIVA" && (
                <IconButton
                  type="button"
                  aria-label={`Anular compra ${compra.numeroComprobante}`}
                  title="Anular"
                  size="xs"
                  variant="ghost"
                  colorPalette="red"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    abrirAnular(compra);
                  }}
                >
                  <Ban size={16} />
                </IconButton>
              )}

              {puedeAnular && compra.estado === "PENDIENTE" && (
                <IconButton
                  type="button"
                  aria-label={`Eliminar compra ${compra.numeroComprobante}`}
                  title="Eliminar"
                  size="xs"
                  variant="ghost"
                  colorPalette="red"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    abrirEliminar(compra);
                  }}
                >
                  <Trash2 size={16} />
                </IconButton>
              )}
            </Flex>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puedeActivar, puedeAnular],
  );

  return (
    <Box>
      <PageHeader
        titulo="Compras"
        descripcion="Facturas de proveedores, ingreso de stock y costo actualizado."
        migas={["Operaciones", "Compras"]}
        acciones={
          <>
            <Button
              variant="outline"
              onClick={refrescar}
              loading={consulta.isFetching || resumen.isFetching}
            >
              <RefreshCw size={15} /> Actualizar
            </Button>
            {puede("facturas.emitir") && (
              <Button
                colorPalette="brand"
                onClick={() => {
                  setCompraEditando(null);
                  crear.reset();
                  setNuevaAbierta(true);
                }}
              >
                <Plus size={16} /> Nueva compra
              </Button>
            )}
          </>
        }
      />

      <Grid
        templateColumns={{ base: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" }}
        gap="4"
        mb="6"
      >
        <TarjetaResumen
          icono={ShoppingCart}
          etiqueta="Compras del mes"
          valor={(resumen.data?.activas ?? 0) + (resumen.data?.pendientes ?? 0)}
          detalle={`${resumen.data?.pendientes ?? 0} pendientes · ${resumen.data?.anuladas ?? 0} anuladas`}
          cargando={resumen.isLoading}
        />
        <TarjetaResumen
          icono={CircleDollarSign}
          etiqueta="Inversión del mes"
          valor={formatMoneda(resumenPYG?.total ?? 0)}
          detalle={
            resumenUSD
              ? `Más US$ ${resumenUSD.total.toLocaleString("es-PY", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} en dólares`
              : "Facturas activas en guaraníes"
          }
          color="success"
          cargando={resumen.isLoading}
        />
        <TarjetaResumen
          icono={ReceiptText}
          etiqueta="IVA crédito fiscal"
          valor={formatMoneda(resumenPYG?.iva ?? 0)}
          detalle={`5 %: ${formatMoneda(resumenPYG?.iva5 ?? 0)} · 10 %: ${formatMoneda(resumenPYG?.iva10 ?? 0)}`}
          color="orange"
          cargando={resumen.isLoading}
        />
        <TarjetaResumen
          icono={Ban}
          etiqueta="Anuladas"
          valor={resumen.data?.anuladas ?? 0}
          detalle="Con stock revertido"
          color="red"
          cargando={resumen.isLoading}
        />
      </Grid>

      <Panel flush>
        <Box px={{ base: "4", md: "5" }} borderBottomWidth="1px" borderColor="ink.200" overflowX="auto">
          <Tabs.Root
            value={estado}
            onValueChange={({ value }) => {
              setEstado(value as EstadoCompra);
              setPagina(1);
            }}
            variant="line"
            size="md"
          >
            <Tabs.List borderBottomWidth="0">
              {PESTANAS_ESTADO.map((pestana) => (
                <Tabs.Trigger key={pestana.valor} value={pestana.valor}>
                  {pestana.etiqueta}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>
        </Box>

        <Grid
          templateColumns={{
            base: "1fr",
            sm: "1fr 1fr",
            lg: "minmax(0, 1fr) 10.5rem 10.5rem auto",
          }}
          gap="4"
          alignItems="end"
          px={{ base: "4", md: "5" }}
          py="4"
          borderBottomWidth="1px"
          borderColor="ink.200"
        >
          <Field.Root gridColumn={{ base: "1 / -1", lg: "auto" }}>
            <Field.Label fontSize="xs" fontWeight="medium" color="ink.600">
              Buscar
            </Field.Label>
            <Box position="relative" w="full">
              <Box
                position="absolute"
                left="3"
                top="50%"
                transform="translateY(-50%)"
                color="ink.400"
                pointerEvents="none"
                zIndex="1"
              >
                <Search size={15} />
              </Box>
              <Input
                value={texto}
                onChange={(evento) => {
                  setTexto(evento.target.value);
                  setPagina(1);
                }}
                ps="9"
                placeholder="Número, timbrado, proveedor o RUC…"
              />
            </Box>
          </Field.Root>

          <Field.Root>
            <Field.Label fontSize="xs" fontWeight="medium" color="ink.600">
              Desde
            </Field.Label>
            <Input
              type="date"
              value={desde}
              max={hasta || undefined}
              onChange={(evento) => {
                setDesde(evento.target.value);
                setPagina(1);
              }}
            />
          </Field.Root>

          <Field.Root>
            <Field.Label fontSize="xs" fontWeight="medium" color="ink.600">
              Hasta
            </Field.Label>
            <Input
              type="date"
              value={hasta}
              min={desde || undefined}
              onChange={(evento) => {
                setHasta(evento.target.value);
                setPagina(1);
              }}
            />
          </Field.Root>

          <Button
            variant="ghost"
            onClick={limpiarFiltros}
            disabled={!hayFiltros}
            visibility={{ base: hayFiltros ? "visible" : "hidden", lg: "visible" }}
          >
            <X size={15} /> Limpiar
          </Button>
        </Grid>

        {estado === "pendientes" && (
          <Box px={{ base: "4", md: "5" }} pt="4">
            <Alert status="info" rounded="md" title="Compras pendientes">
              Están registradas pero todavía no modificaron el stock. Podés continuarlas cargando o activarlas.
            </Alert>
          </Box>
        )}

        <DataTable
          data={consulta.data?.items ?? []}
          columns={columnas}
          cargando={consulta.isLoading}
          claveFila={(compra) => compra.id}
          onFilaClick={(compra) => setDetalleId(compra.id)}
          hayBusqueda={hayBusqueda}
          vacioTitulo="Todavía no hay compras registradas"
          vacioDetalle="Cuando cargues la primera factura de compra, vas a verla acá y el stock se actualizará automáticamente."
        />

        {consulta.data && (
          <Paginacion
            pagina={consulta.data.pagina}
            totalPaginas={consulta.data.totalPaginas}
            total={consulta.data.total}
            porPagina={COMPRAS_POR_PAGINA}
            onCambioPagina={setPagina}
            singular="compra"
            plural="compras"
          />
        )}
      </Panel>

      {/* ── Modal Formulario (Nueva o Continuar Carga Pendiente) ───── */}
      <FormDialog
        abierto={nuevaAbierta}
        onClose={() => {
          if (!crear.isPending) {
            setNuevaAbierta(false);
            setCompraEditando(null);
            crear.reset();
          }
        }}
        titulo={compraEditando ? `Continuar carga: Compra ${compraEditando.numeroComprobante}` : "Nueva factura de compra"}
        descripcion="Registrá o completá los datos del comprobante. Podés volver a guardarlo como pendiente o activarlo."
        ancho="3xl"
        textoConfirmar="Guardar compra"
        guardando={crear.isPending}
        bloquearCierre={crear.isPending}
        onConfirmar={() =>
          (document.getElementById("compra-form") as HTMLFormElement | null)?.requestSubmit()
        }
      >
        {nuevaAbierta && (
          <CompraForm
            compraInicial={compraEditando}
            errorGeneral={crear.error ? mensajeDeError(crear.error) : null}
            onGuardar={(datos) => {
              crear.mutate(datos, {
                onSuccess: (compra) => {
                  setNuevaAbierta(false);
                  setCompraEditando(null);
                  setPagina(1);
                  setDetalleId(compra.id);
                  toaster.success({
                    title: compraEditando ? "Compra actualizada" : "Compra registrada",
                    description: `${compra.numeroComprobante} · guardada correctamente`,
                  });
                },
              });
            }}
          />
        )}
      </FormDialog>

      {/* ── Detalle ──────────────────────────────────────────────────── */}
      <DetalleCompraDialog
        id={detalleId ?? undefined}
        onClose={() => setDetalleId(null)}
        puedeAnular={puedeAnular}
        puedeActivar={puedeActivar}
        onAnular={(compra) => {
          setDetalleId(null);
          abrirAnular(compra);
        }}
        onEliminar={(compra) => {
          setDetalleId(null);
          abrirEliminar(compra);
        }}
        onActivar={(compra) => {
          setDetalleId(null);
          abrirActivar(compra);
        }}
        onContinuarCarga={(compra) => {
          setDetalleId(null);
          abrirEdicionPendiente(compra);
        }}
      />

      {/* ── Activar compra pendiente ─────────────────────────────────── */}
      <FormDialog
        abierto={compraActivando !== null}
        onClose={() => {
          if (!activar.isPending) {
            setCompraActivando(null);
            activar.reset();
          }
        }}
        titulo="Activar compra"
        descripcion={
          compraActivando
            ? `${compraActivando.numeroComprobante} · ${nombreProveedor(compraActivando)}`
            : undefined
        }
        ancho="md"
        textoConfirmar="Activar compra"
        guardando={activar.isPending}
        bloquearCierre={activar.isPending}
        onConfirmar={() => {
          if (!compraActivando) return;
          const compra = compraActivando;
          activar.mutate(compra.id, {
            onSuccess: (respuesta) => {
              setCompraActivando(null);
              refrescar();
              setDetalleId(compra.id);
              toaster.success({
                title: "Compra activada",
                description: respuesta?.mensaje ?? `${compra.numeroComprobante} · stock actualizado`,
              });
            },
          });
        }}
      >
        <Stack gap="4">
          <Alert status="info" rounded="md" title="Se ingresa el stock">
            Al activar la compra se suma al stock la cantidad de cada producto y lote de la
            factura. Después ya no se puede eliminar, sólo anular.
          </Alert>

          {compraActivando && (
            <Flex
              justify="space-between"
              align="center"
              gap="3"
              p="4"
              bg="ink.50"
              borderWidth="1px"
              borderColor="ink.200"
              borderRadius="lg"
            >
              <Box minW="0">
                <Text fontSize="sm" fontWeight="semibold" color="ink.900" truncate>
                  {nombreProveedor(compraActivando)}
                </Text>
                <Text fontSize="xs" color="ink.500">
                  {formatFechaCalendario(compraActivando.fechaEmision)}
                </Text>
              </Box>
              <Text fontSize="lg" fontWeight="bold" color="ink.900" fontVariantNumeric="tabular-nums">
                {monto(compraActivando.moneda, compraActivando.total)}
              </Text>
            </Flex>
          )}

          {activar.error && (
            <Alert status="error" rounded="md">
              {mensajeDeError(activar.error)}
            </Alert>
          )}
        </Stack>
      </FormDialog>

      {/* ── Anular compra activa ─────────────────────────────────────── */}
      <FormDialog
        abierto={compraAnulando !== null}
        onClose={() => {
          if (!anular.isPending) {
            setCompraAnulando(null);
            setMotivoAnulacion("");
            anular.reset();
          }
        }}
        titulo="Anular compra"
        descripcion={
          compraAnulando
            ? `${compraAnulando.numeroComprobante} · ${nombreProveedor(compraAnulando)}`
            : undefined
        }
        ancho="md"
        textoConfirmar="Anular y revertir stock"
        guardando={anular.isPending}
        bloquearCierre={anular.isPending}
        confirmarDeshabilitado={motivoAnulacion.trim().length < 3}
        onConfirmar={() => {
          if (!compraAnulando) return;
          anular.mutate(
            { id: compraAnulando.id, motivo: motivoAnulacion.trim() },
            {
              onSuccess: (respuesta) => {
                setCompraAnulando(null);
                setMotivoAnulacion("");
                refrescar();
                toaster.success({
                  title: "Compra anulada",
                  description: respuesta.mensaje,
                });
              },
            },
          );
        }}
      >
        <Stack gap="4">
          <Alert status="warning" rounded="md" title="La anulación revierte el stock">
            Se descuenta la cantidad ingresada de cada producto y lote. Si el stock ya no
            alcanza, la operación se bloquea para no dejar diferencias.
          </Alert>

          <Field.Root required>
            <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
              Motivo de la anulación
              <Field.RequiredIndicator />
            </Field.Label>
            <Textarea
              value={motivoAnulacion}
              onChange={(evento) => setMotivoAnulacion(evento.target.value)}
              placeholder="Ej.: factura duplicada, error de carga, devolución al proveedor…"
              rows={4}
              maxLength={500}
            />
            <Field.HelperText fontSize="xs" color="ink.500">
              Se guarda en la auditoría junto con la fecha y el usuario.
            </Field.HelperText>
          </Field.Root>

          {anular.error && (
            <Alert status="error" rounded="md">
              {mensajeDeError(anular.error)}
            </Alert>
          )}
        </Stack>
      </FormDialog>

      {/* ── Eliminar compra pendiente ────────────────────────────────── */}
      <FormDialog
        abierto={compraEliminando !== null}
        onClose={() => {
          if (!eliminar.isPending) {
            setCompraEliminando(null);
            eliminar.reset();
          }
        }}
        titulo="Eliminar compra pendiente"
        descripcion={
          compraEliminando
            ? `${compraEliminando.numeroComprobante} · ${nombreProveedor(compraEliminando)}`
            : undefined
        }
        ancho="md"
        textoConfirmar="Eliminar compra"
        guardando={eliminar.isPending}
        bloquearCierre={eliminar.isPending}
        onConfirmar={() => {
          if (!compraEliminando) return;
          eliminar.mutate(compraEliminando.id, {
            onSuccess: (respuesta) => {
              setCompraEliminando(null);
              refrescar();
              toaster.success({
                title: "Compra eliminada",
                description: respuesta.mensaje,
              });
            },
          });
        }}
      >
        <Stack gap="4">
          <Alert status="warning" rounded="md" title="Esta acción no se puede deshacer">
            La compra pendiente y sus ítems se eliminan. No se modifica el stock porque esta
            compra nunca lo ingresó.
          </Alert>

          {eliminar.error && (
            <Alert status="error" rounded="md">
              {mensajeDeError(eliminar.error)}
            </Alert>
          )}
        </Stack>
      </FormDialog>
    </Box>
  );
}