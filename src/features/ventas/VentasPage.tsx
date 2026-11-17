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
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  CheckCircle2,
  CircleDollarSign,
  Edit,
  Eye,
  FileText,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data/DataTable";
import { FormDialog } from "@/components/data/FormDialog";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError, useConfiguracion } from "@/features/clients/clients.service";
import { normalizarConfiguracionImpresion } from "@/features/settings/impresion";
import {
  formatFechaCalendario,
  formatMoneda,
  formatMonedaUSD,
} from "@/lib/formato";
import { urlDeArchivo } from "@/services/api";
import { VentaForm } from "./VentaForm";
import { imprimirComprobante } from "./imprimir";
import {
  ticketDesdeVenta,
  type TicketOrganizacion,
} from "./ticket";
import {
  VENTAS_POR_PAGINA,
  obtenerVenta,
  useActivarVenta,
  useActualizarVenta,
  useAnularVenta,
  useCrearVenta,
  useEliminarVenta,
  useSiguienteNumeroVenta,
  useVentaDetalle,
  useVentas,
  useVentasResumen,
  type EstadoFacturaVenta,
  type EstadoVenta,
  type Venta,
  type VentaFiltros,
  type VentaPayload,
} from "./ventas.service";

const ETIQUETAS_COMPROBANTE: Record<string, string> = {
  factura: "Factura",
  factura_credito_fiscal: "Factura crédito fiscal",
};

const ESTADOS_VENTA: Record<
  EstadoFacturaVenta,
  { etiqueta: string; paleta: "orange" | "success" | "red" }
> = {
  PENDIENTE: { etiqueta: "Pendiente", paleta: "orange" },
  ACTIVA: { etiqueta: "Activa", paleta: "success" },
  ANULADA: { etiqueta: "Anulada", paleta: "red" },
};

const PESTANAS_ESTADO: { valor: EstadoVenta; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "activas", etiqueta: "Activas" },
  { valor: "pendientes", etiqueta: "Pendientes" },
  { valor: "anuladas", etiqueta: "Anuladas" },
];

function monto(moneda: string, valor: string | number | null | undefined): string {
  return moneda === "USD" ? formatMonedaUSD(valor) : formatMoneda(valor);
}

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

function BadgeCondicion({ condicion }: { condicion: string }) {
  const credito = condicion === "credito";
  return (
    <Badge colorPalette={credito ? "orange" : "green"} variant="subtle">
      {credito ? "Crédito" : "Contado"}
    </Badge>
  );
}

export function VentasPage() {
  const { puede } = useAuth();
  const { texto, setTexto, busqueda } = useBusquedaDiferida();

  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<EstadoVenta>("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // Un único diálogo: crea una venta nueva o abre una existente (editable si
  // está pendiente, de solo lectura si ya fue activada o anulada).
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [ventaAbiertaId, setVentaAbiertaId] = useState<number | null>(null);

  const [ventaAnulando, setVentaAnulando] = useState<Venta | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [ventaEliminando, setVentaEliminando] = useState<Venta | null>(null);
  const [ventaActivando, setVentaActivando] = useState<Venta | null>(null);
  // Venta recién guardada: al cerrar el formulario se pregunta si se imprime.
  const [ventaImprimiendo, setVentaImprimiendo] = useState<Venta | null>(null);

  const filtros: VentaFiltros = {
    busqueda,
    pagina,
    estado,
    desde: desde || undefined,
    hasta: hasta || undefined,
    ordenarPor: "fecha",
    direccion: "desc",
  };

  const consulta = useVentas(filtros);
  const resumen = useVentasResumen();
  const siguienteNumero = useSiguienteNumeroVenta();
  const crear = useCrearVenta();
  const actualizar = useActualizarVenta();
  const anular = useAnularVenta();
  const eliminar = useEliminarVenta();
  const activar = useActivarVenta();
  const detalle = useVentaDetalle(ventaAbiertaId ?? undefined);
  const configuracion = useConfiguracion();

  const impresion = useMemo(
    () => normalizarConfiguracionImpresion(configuracion.data?.impresion),
    [configuracion.data?.impresion],
  );

  const puedeAnular = puede("facturas.anular");
  const puedeActivar = puede("facturas.emitir");
  const puedeEmitir = puede("facturas.emitir");

  const ventaAbierta = detalle.data ?? null;
  const dialogoAbierto = nuevaAbierta || ventaAbiertaId !== null;
  const ventaEsPendiente = ventaAbierta?.estado === "PENDIENTE";
  const soloLectura = ventaAbierta !== null && !ventaEsPendiente;
  const mostrarConfirmar = nuevaAbierta || ventaEsPendiente;
  const guardandoVenta = crear.isPending || actualizar.isPending;
  const archivoVenta = urlDeArchivo(ventaAbierta?.archivoUrl);

  const resumenPYG = resumen.data?.porMoneda.find((item: any) => item.moneda === "PYG");
  const resumenUSD = resumen.data?.porMoneda.find((item: any) => item.moneda === "USD");

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

  function organizacionTicket(): TicketOrganizacion {
    const datos = configuracion.data;
    return {
      nombre:
        datos?.nombreFantasia ||
        datos?.nombreComercial ||
        datos?.razonSocial ||
        "Veterinaria",
      razonSocial: datos?.razonSocial,
      ruc: datos?.ruc,
      direccion: datos?.direccion,
      telefono: datos?.telefono,
      email: datos?.email,
      logoUrl: urlDeArchivo(datos?.logoUrl),
      colorPrimario: datos?.colorPrimario,
      timbrado: datos?.timbradoNro,
      timbradoVencimiento: datos?.timbradoFechaVencimiento,
      establecimiento: datos?.establecimiento,
      puntoVenta: datos?.puntoVenta,
    };
  }

  function imprimirVenta(venta: Venta) {
    const organizacion = organizacionTicket();
    void imprimirComprobante(
      ticketDesdeVenta(venta, organizacion),
      organizacion,
      impresion,
    ).catch(() => {
      toaster.error({
        title: "No se pudo generar el comprobante",
        description:
          "Revisá la configuración de impresión y volvé a intentar.",
      });
    });
  }

  /** La autoimpresión solo dispara para comprobantes ya emitidos. */
  function autoImprimirVenta(venta: Venta) {
    if (!impresion.autoImprimir || venta.estado !== "ACTIVA") return;
    imprimirVenta(venta);
  }

  function abrirActivar(venta: Venta) {
    activar.reset();
    setVentaActivando(venta);
  }

  function abrirEliminar(venta: Venta) {
    eliminar.reset();
    setVentaEliminando(venta);
  }

  function abrirAnular(venta: Venta) {
    anular.reset();
    setMotivoAnulacion("");
    setVentaAnulando(venta);
  }

  function abrirVenta(venta: Venta) {
    crear.reset();
    actualizar.reset();
    setNuevaAbierta(false);
    setVentaAbiertaId(venta.id);
  }

  function abrirNueva() {
    crear.reset();
    actualizar.reset();
    setVentaAbiertaId(null);
    setNuevaAbierta(true);
  }

  function cerrarDialogo() {
    if (guardandoVenta) return;
    setNuevaAbierta(false);
    setVentaAbiertaId(null);
    crear.reset();
    actualizar.reset();
  }

  /**
   * Ofrece imprimir el comprobante después de guardar.
   *
   * Solo se pregunta por ventas emitidas: una pendiente todavía no es una
   * factura y no tiene sentido sacarla en papel. El formulario ya se cerró y
   * la lista se refresca cuando el usuario responde al diálogo.
   */
  function ofrecerImpresion(venta: Venta) {
    if (venta.estado !== "ACTIVA") return;
    setVentaImprimiendo(venta);
  }

  /**
   * Cierra el diálogo de impresión. Confirmar manda el comprobante a la
   * impresora configurada; cancelar solo descarta la impresión. En ambos casos
   * la venta ya quedó guardada y la lista se actualiza.
   */
  function cerrarImpresion(imprimir: boolean) {
    const venta = ventaImprimiendo;
    setVentaImprimiendo(null);
    if (imprimir && venta) imprimirVenta(venta);
    refrescar();
  }

  function guardarVenta(datos: VentaPayload) {
    if (nuevaAbierta) {
      crear.mutate(datos, {
        onSuccess: (venta) => {
          setNuevaAbierta(false);
          setVentaAbiertaId(null);
          setPagina(1);
          toaster.success({
            title: "Venta registrada",
            description: `${venta.numeroComprobante} · guardada correctamente`,
          });
          ofrecerImpresion(venta);
        },
      });
      return;
    }

    if (!ventaAbierta) return;

    actualizar.mutate(
      { id: ventaAbierta.id, datos },
      {
        onSuccess: (venta) => {
          setNuevaAbierta(false);
          setVentaAbiertaId(null);
          toaster.success({
            title: "Venta actualizada",
            description: `${venta.numeroComprobante} · guardada correctamente`,
          });
          ofrecerImpresion(venta);
        },
      },
    );
  }

  const columnas = useMemo<ColumnDef<Venta, unknown>[]>(
    () => [
      {
        accessorKey: "numeroComprobante",
        header: "Comprobante",
        cell: ({ row }) => {
          const venta = row.original;
          const items = (venta as any)._count?.items ?? 0;
          return (
            <Box minW="0">
              <Text fontWeight="semibold" color="ink.900" fontSize="sm" fontFamily="mono">
                {(venta as any).numeroComprobante}
              </Text>
              <Text fontSize="xs" color="ink.500" mt="0.5">
                {ETIQUETAS_COMPROBANTE[(venta as any).tipoComprobante] ?? (venta as any).tipoComprobante} · {items} {items === 1 ? "ítem" : "ítems"}
              </Text>
            </Box>
          );
        },
      },
      {
        accessorKey: "cliente",
        header: "Cliente",
        cell: ({ row }) => (
          <Box minW="0">
            <Text fontSize="sm" fontWeight="medium" color="ink.900">
              {(row.original as any).cliente?.nombreCompleto || (row.original as any).cliente?.razonSocial || "Sin cliente"}
            </Text>
            {(row.original as any).cliente?.documento && (
              <Text fontSize="xs" color="ink.500" mt="0.5">
                {(row.original as any).cliente.documento}
              </Text>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "fechaEmision",
        header: "Emisión",
        cell: ({ row }) => (
          <Box>
            <Text fontSize="sm" color="ink.800">
              {formatFechaCalendario((row.original as any).fechaEmision)}
            </Text>
            {(row.original as any).fechaVencimiento && (
              <Text fontSize="xs" color="ink.500" mt="0.5">
                Vence {formatFechaCalendario((row.original as any).fechaVencimiento)}
              </Text>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "condicionPago",
        header: "Condición",
        cell: ({ row }) => <BadgeCondicion condicion={(row.original as any).condicionPago} />,
      },
      {
        accessorKey: "total",
        header: "Total",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Text fontSize="sm" fontWeight="bold" color="ink.900" fontVariantNumeric="tabular-nums">
            {monto((row.original as any).moneda, (row.original as any).total)}
          </Text>
        ),
      },
      {
        accessorKey: "estado",
        header: "Estado",
        cell: ({ row }) => {
          const datos = ESTADOS_VENTA[row.original.estado];
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
          const venta = row.original;
          return (
            <Flex justify="flex-end" gap="0.5">
              <IconButton
                type="button"
                aria-label={`Ver venta ${(venta as any).numeroComprobante}`}
                title="Ver detalle"
                size="xs"
                variant="ghost"
                onClick={(evento) => {
                  evento.stopPropagation();
                  abrirVenta(venta);
                }}
              >
                <Eye size={16} />
              </IconButton>

              {(venta as any).estado === "PENDIENTE" && (
                <IconButton
                  type="button"
                  aria-label={`Continuar cargando venta ${(venta as any).numeroComprobante}`}
                  title="Continuar cargando"
                  size="xs"
                  variant="ghost"
                  colorPalette="brand"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    abrirVenta(venta);
                  }}
                >
                  <Edit size={16} />
                </IconButton>
              )}

              {puedeActivar && (venta as any).estado === "PENDIENTE" && (
                <IconButton
                  type="button"
                  aria-label={`Activar venta ${(venta as any).numeroComprobante}`}
                  title="Activar"
                  size="xs"
                  variant="ghost"
                  colorPalette="green"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    abrirActivar(venta);
                  }}
                >
                  <CheckCircle2 size={16} />
                </IconButton>
              )}

              {puedeAnular && (venta as any).estado === "ACTIVA" && (
                <IconButton
                  type="button"
                  aria-label={`Anular venta ${(venta as any).numeroComprobante}`}
                  title="Anular"
                  size="xs"
                  variant="ghost"
                  colorPalette="red"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    abrirAnular(venta);
                  }}
                >
                  <Ban size={16} />
                </IconButton>
              )}

              {puedeAnular && (venta as any).estado === "PENDIENTE" && (
                <IconButton
                  type="button"
                  aria-label={`Eliminar venta ${(venta as any).numeroComprobante}`}
                  title="Eliminar"
                  size="xs"
                  variant="ghost"
                  colorPalette="red"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    abrirEliminar(venta);
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
    [puedeActivar, puedeAnular],
  );

  return (
    <Box>
      <PageHeader
        titulo="Ventas"
        descripcion="Facturas de venta, cobros y seguimiento de stock."
        migas={["Operaciones", "Ventas"]}
        acciones={
          <>
            <Button variant="outline" onClick={refrescar} loading={consulta.isFetching || resumen.isFetching}>
              <RefreshCw size={15} /> Actualizar
            </Button>
            {puedeEmitir && siguienteNumero.data && (
              <Box as="span" fontSize="xs" color="ink.500" mx="2" borderLeftWidth="1px" borderColor="ink.200" px="2">
                <Text fontWeight="bold">Siguiente factura:</Text>{" "}
                {siguienteNumero.data.numero.toString().padStart(7, "0")}
                {siguienteNumero.data.timbrado && (
                  <>
                    <Text marginLeft="2" fontWeight="bold">·</Text>{" "}
                    <Text marginLeft="2" fontWeight="bold">{siguienteNumero.data.timbrado}</Text>
                  </>
                )}
                {!siguienteNumero.data.puedeEmitirFactura && siguienteNumero.data.timbradoVencido && (
                  <Text marginLeft="2" color="red.600" fontWeight="bold">Timbrado vencido</Text>
                )}
              </Box>
            )}
            {puedeEmitir && (
              <Button
                colorPalette="brand"
                disabled={!siguienteNumero.data?.puedeEmitirFactura}
                onClick={abrirNueva}
              >
                <Plus size={16} /> Nueva venta
              </Button>
            )}
          </>
        }
      />

      <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" }} gap="4" mb="6">
        <TarjetaResumen
          icono={ShoppingCart}
          etiqueta="Ventas del mes"
          valor={(resumen.data?.activas ?? 0) + (resumen.data?.pendientes ?? 0)}
          detalle={`${resumen.data?.pendientes ?? 0} pendientes · ${resumen.data?.anuladas ?? 0} anuladas`}
          cargando={resumen.isLoading}
        />
        <TarjetaResumen
          icono={CircleDollarSign}
          etiqueta="Ventas del mes"
          valor={formatMoneda(resumenPYG?.total ?? 0)}
          detalle={resumenUSD ? `Más US$ ${Number(resumenUSD.total || 0).toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} en dólares` : "Facturas activas en guaraníes"}
          color="success"
          cargando={resumen.isLoading}
        />
        <TarjetaResumen
          icono={ReceiptText}
          etiqueta="IVA débito fiscal"
          valor={formatMoneda(resumenPYG?.iva ?? 0)}
          detalle={`5 %: ${formatMoneda(resumenPYG?.iva5 ?? 0)} · 10 %: ${formatMoneda(resumenPYG?.iva10 ?? 0)}`}
          color="orange"
          cargando={resumen.isLoading}
        />
        <TarjetaResumen
          icono={Ban}
          etiqueta="Anuladas"
          valor={resumen.data?.anuladas ?? 0}
          detalle="Ventas anuladas"
          color="red"
          cargando={resumen.isLoading}
        />
      </Grid>

      <Panel flush>
        <Box px={{ base: "4", md: "5" }} borderBottomWidth="1px" borderColor="ink.200" overflowX="auto">
          <Tabs.Root
            value={estado}
            onValueChange={({ value }) => {
              setEstado(value as EstadoVenta);
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
                placeholder="Número, cliente o documento…"
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

          <Button variant="ghost" onClick={limpiarFiltros} disabled={!hayFiltros}>
            <X size={15} /> Limpiar
          </Button>
        </Grid>

        {estado === "pendientes" && (
          <Box px={{ base: "4", md: "5" }} pt="4">
            <Alert status="info" rounded="md" title="Ventas pendientes">
              Están registradas pero todavía no fueron activadas. Podés continuarlas cargando o activarlas.
            </Alert>
          </Box>
        )}

        <DataTable
          data={(consulta.data?.items ?? []) as Venta[]}
          columns={columnas}
          cargando={consulta.isLoading}
          claveFila={(venta) => (venta as any).id}
          onFilaClick={(venta) => abrirVenta(venta)}
          hayBusqueda={hayBusqueda}
          vacioTitulo="Todavía no hay ventas registradas"
          vacioDetalle="Cuando registres la primera factura de venta, vas a verla acá."
        />

        {consulta.data && (
          <Paginacion
            pagina={consulta.data.pagina}
            totalPaginas={consulta.data.totalPaginas}
            total={consulta.data.total}
            porPagina={VENTAS_POR_PAGINA}
            onCambioPagina={setPagina}
            singular="venta"
            plural="ventas"
          />
        )}
      </Panel>

      <FormDialog
        abierto={dialogoAbierto}
        onClose={cerrarDialogo}
        titulo={
          nuevaAbierta
            ? "Nueva factura de venta"
            : ventaAbierta
              ? `Factura ${ventaAbierta.numeroComprobante}`
              : "Cargando venta…"
        }
        descripcion={
          nuevaAbierta
            ? "Cargá cliente, comprobante e ítems (productos o servicios como consulta y delivery). Podés guardarla como pendiente o activa."
            : ventaAbierta
              ? `${
                  ventaAbierta.cliente?.nombreCompleto ||
                  ventaAbierta.cliente?.razonSocial ||
                  ventaAbierta.cliente?.documento ||
                  "Sin cliente"
                } · ${formatFechaCalendario(ventaAbierta.fechaEmision)} · ${
                  ESTADOS_VENTA[ventaAbierta.estado].etiqueta
                }`
              : undefined
        }
        ancho="3xl"
        textoConfirmar={ventaEsPendiente ? "Guardar cambios" : "Guardar venta"}
        textoCancelar={mostrarConfirmar ? "Cancelar" : "Cerrar"}
        guardando={guardandoVenta}
        bloquearCierre={guardandoVenta}
        ocultarConfirmar={!mostrarConfirmar}
        onConfirmar={() =>
          (document.getElementById("venta-form") as HTMLFormElement | null)?.requestSubmit()
        }
        acciones={
          ventaAbierta && (
            <>
              {archivoVenta && (
                <Button variant="outline" size="sm" asChild>
                  <a href={archivoVenta} target="_blank" rel="noreferrer">
                    <FileText size={15} /> Ver comprobante
                  </a>
                </Button>
              )}

              {ventaAbierta.estado !== "PENDIENTE" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => imprimirVenta(ventaAbierta)}
                >
                  <Printer size={15} /> Imprimir comprobante
                </Button>
              )}

              {ventaEsPendiente && puedeAnular && (
                <Button
                  variant="outline"
                  colorPalette="red"
                  size="sm"
                  onClick={() => {
                    cerrarDialogo();
                    abrirEliminar(ventaAbierta);
                  }}
                >
                  <Trash2 size={15} /> Eliminar
                </Button>
              )}

              {ventaEsPendiente && puedeActivar && (
                <Button
                  variant="outline"
                  colorPalette="brand"
                  size="sm"
                  onClick={() => {
                    cerrarDialogo();
                    abrirActivar(ventaAbierta);
                  }}
                >
                  <CheckCircle2 size={15} /> Activar
                </Button>
              )}

              {ventaAbierta.estado === "ACTIVA" && puedeAnular && (
                <Button
                  variant="outline"
                  colorPalette="red"
                  size="sm"
                  onClick={() => {
                    cerrarDialogo();
                    abrirAnular(ventaAbierta);
                  }}
                >
                  <Ban size={15} /> Anular
                </Button>
              )}
            </>
          )
        }
      >
        {nuevaAbierta ? (
          <VentaForm
            ventaInicial={null}
            datosFiscales={siguienteNumero.data ?? undefined}
            errorGeneral={crear.error ? mensajeDeError(crear.error) : null}
            onGuardar={guardarVenta}
          />
        ) : detalle.isLoading ? (
          <Stack gap="4">
            <Skeleton h="28" borderRadius="lg" />
            <Skeleton h="56" borderRadius="lg" />
            <Skeleton h="40" borderRadius="lg" />
          </Stack>
        ) : !ventaAbierta ? (
          <Alert status="error" rounded="md" title="No se pudo cargar la venta">
            {detalle.error ? mensajeDeError(detalle.error) : "Intentá de nuevo."}
          </Alert>
        ) : (
          <VentaForm
            key={`${ventaAbierta.id}-${ventaAbierta.estado}`}
            ventaInicial={ventaAbierta}
            soloLectura={soloLectura}
            errorGeneral={actualizar.error ? mensajeDeError(actualizar.error) : null}
            onGuardar={guardarVenta}
          />
        )}
      </FormDialog>

      <FormDialog
        abierto={ventaImprimiendo !== null}
        onClose={() => cerrarImpresion(false)}
        titulo="Imprimir factura"
        descripcion={
          ventaImprimiendo
            ? `${ventaImprimiendo.numeroComprobante} · ${
                ventaImprimiendo.cliente?.nombreCompleto ||
                ventaImprimiendo.cliente?.razonSocial ||
                ventaImprimiendo.cliente?.documento ||
                "Sin cliente"
              }`
            : undefined
        }
        ancho="md"
        textoConfirmar="Confirmar"
        textoCancelar="Cancelar"
        onConfirmar={() => cerrarImpresion(true)}
      >
        <Stack gap="4">
          <Alert
            status="info"
            rounded="md"
            title="¿Querés imprimir el comprobante?"
            icon={<Printer size={16} />}
          >
            La venta ya está guardada. Al confirmar se envía a la impresora
            configurada; al cancelar solo se cierra este aviso.
          </Alert>

          {ventaImprimiendo && (
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
                  {ventaImprimiendo.numeroComprobante}
                </Text>
                <Text fontSize="xs" color="ink.500">
                  {formatFechaCalendario(ventaImprimiendo.fechaEmision)}
                </Text>
              </Box>
              <Text
                fontSize="lg"
                fontWeight="bold"
                color="ink.900"
                fontVariantNumeric="tabular-nums"
              >
                {monto(ventaImprimiendo.moneda, ventaImprimiendo.total)}
              </Text>
            </Flex>
          )}
        </Stack>
      </FormDialog>

      <FormDialog
        abierto={ventaActivando !== null}
        onClose={() => {
          if (!activar.isPending) {
            setVentaActivando(null);
            activar.reset();
          }
        }}
        titulo="Activar venta"
        descripcion={
          ventaActivando
            ? `${(ventaActivando as any).numeroComprobante} · ${(ventaActivando as any).cliente?.nombreCompleto || ''}`
            : undefined
        }
        ancho="md"
        textoConfirmar="Activar venta"
        guardando={activar.isPending}
        bloquearCierre={activar.isPending}
        onConfirmar={() => {
          if (!ventaActivando) return;
          const venta = ventaActivando;
          activar.mutate((venta as any).id, {
            onSuccess: (respuesta: any) => {
              setVentaActivando(null);
              refrescar();
              setVentaAbiertaId(venta.id);
              toaster.success({
                title: "Venta activada",
                description: respuesta?.mensaje ?? `${(venta as any).numeroComprobante} · procesada correctamente`,
              });
              if (impresion.autoImprimir) {
                void obtenerVenta(venta.id)
                  .then((detalleVenta) => autoImprimirVenta(detalleVenta))
                  .catch(() => undefined);
              }
            },
          });
        }}
      >
        <Stack gap="4">
          <Alert status="info" rounded="md" title="Se procesa la venta">
            Al activar la venta se descuentan los productos del stock según los lotes cargados.
          </Alert>
          {ventaActivando && (
            <Flex justify="space-between" align="center" gap="3" p="4" bg="ink.50" borderWidth="1px" borderColor="ink.200" borderRadius="lg">
              <Box minW="0">
                <Text fontSize="sm" fontWeight="semibold" color="ink.900" truncate>
                  {(ventaActivando as any).cliente?.nombreCompleto || ""}
                </Text>
                <Text fontSize="xs" color="ink.500">
                  {formatFechaCalendario((ventaActivando as any).fechaEmision)}
                </Text>
              </Box>
              <Text fontSize="lg" fontWeight="bold" color="ink.900" fontVariantNumeric="tabular-nums">
                {monto((ventaActivando as any).moneda, (ventaActivando as any).total)}
              </Text>
            </Flex>
          )}
          {activar.error && <Alert status="error" rounded="md">{mensajeDeError(activar.error)}</Alert>}
        </Stack>
      </FormDialog>

      <FormDialog
        abierto={ventaAnulando !== null}
        onClose={() => {
          if (!anular.isPending) {
            setVentaAnulando(null);
            setMotivoAnulacion("");
            anular.reset();
          }
        }}
        titulo="Anular venta"
        descripcion={
          ventaAnulando
            ? `${(ventaAnulando as any).numeroComprobante} · ${(ventaAnulando as any).cliente?.nombreCompleto || ''}`
            : undefined
        }
        ancho="md"
        textoConfirmar="Anular y revertir stock"
        guardando={anular.isPending}
        bloquearCierre={anular.isPending}
        confirmarDeshabilitado={motivoAnulacion.trim().length < 3}
        onConfirmar={() => {
          if (!ventaAnulando) return;
          anular.mutate(
            { id: (ventaAnulando as any).id, motivo: motivoAnulacion.trim() },
            {
              onSuccess: (respuesta: any) => {
                setVentaAnulando(null);
                setMotivoAnulacion("");
                refrescar();
                toaster.success({
                  title: "Venta anulada",
                  description: respuesta.mensaje,
                });
              },
            },
          );
        }}
      >
        <Stack gap="4">
          <Alert status="warning" rounded="md" title="La anulación revierte el stock">
            Se devuelve la cantidad vendida al stock de cada producto y lote.
          </Alert>
          <Field.Root required>
            <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
              Motivo de la anulación
              <Field.RequiredIndicator />
            </Field.Label>
            <Textarea
              value={motivoAnulacion}
              onChange={(evento) => setMotivoAnulacion(evento.target.value)}
              placeholder="Ej.: error en la venta, devolución..."
              rows={4}
              maxLength={500}
            />
          </Field.Root>
          {anular.error && <Alert status="error" rounded="md">{mensajeDeError(anular.error)}</Alert>}
        </Stack>
      </FormDialog>

      <FormDialog
        abierto={ventaEliminando !== null}
        onClose={() => {
          if (!eliminar.isPending) {
            setVentaEliminando(null);
            eliminar.reset();
          }
        }}
        titulo="Eliminar venta pendiente"
        descripcion={
          ventaEliminando
            ? `${(ventaEliminando as any).numeroComprobante} · ${(ventaEliminando as any).cliente?.nombreCompleto || ''}`
            : undefined
        }
        ancho="md"
        textoConfirmar="Eliminar venta"
        guardando={eliminar.isPending}
        bloquearCierre={eliminar.isPending}
        onConfirmar={() => {
          if (!ventaEliminando) return;
          eliminar.mutate((ventaEliminando as any).id, {
            onSuccess: (respuesta: any) => {
              setVentaEliminando(null);
              refrescar();
              toaster.success({
                title: "Venta eliminada",
                description: respuesta.mensaje,
              });
            },
          });
        }}
      >
        <Stack gap="4">
          <Alert status="warning" rounded="md" title="Esta acción no se puede deshacer">
            La venta pendiente y sus ítems se eliminan. No se modifica el stock.
          </Alert>
          {eliminar.error && <Alert status="error" rounded="md">{mensajeDeError(eliminar.error)}</Alert>}
        </Stack>
      </FormDialog>
    </Box>
  );
}
