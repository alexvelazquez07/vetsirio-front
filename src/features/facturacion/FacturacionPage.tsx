import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  Input,
  NativeSelect,
  Skeleton,
  Stat,
  Table,
  Tabs,
  Text,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Hash,
  Pencil,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data/DataTable";
import { FormDialog } from "@/components/data/FormDialog";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { PageHeader, Panel, PanelHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError } from "@/features/clients/clients.service";
import {
  formatFechaCalendario,
  formatMoneda,
  formatMonedaUSD,
} from "@/lib/formato";
import {
  FACTURACION_POR_PAGINA,
  useActualizarTimbrado,
  useComprobanteFiscal,
  useComprobantesFiscales,
  useResumenFacturacion,
  useTimbradoFiscal,
  type ComprobanteFiscal,
  type EstadoComprobante,
  type EstadoComprobanteFiscal,
  type EstadoSifen,
  type FiltrosComprobantes,
  type ResumenFacturacion,
  type TimbradoFiscal,
  type TimbradoPayload,
  type TipoDocumentoFiscal,
} from "./facturacion.service";

const ETIQUETAS_TIPO: Record<TipoDocumentoFiscal, string> = {
  ticket: "Ticket",
  factura: "Factura",
  factura_credito_fiscal: "Factura crédito fiscal",
  nota_credito: "Nota de crédito",
  nota_debito: "Nota de débito",
};

const ETIQUETAS_ESTADO: Record<
  EstadoComprobanteFiscal,
  { etiqueta: string; paleta: "orange" | "success" | "red" }
> = {
  PENDIENTE: { etiqueta: "Pendiente", paleta: "orange" },
  ACTIVA: { etiqueta: "Vigente", paleta: "success" },
  ANULADA: { etiqueta: "Anulada", paleta: "red" },
};

const ETIQUETAS_SIFEN: Record<
  EstadoSifen,
  { etiqueta: string; paleta: "gray" | "orange" | "success" | "red" | "purple" }
> = {
  no_aplica: { etiqueta: "No aplica", paleta: "gray" },
  pendiente: { etiqueta: "Pendiente", paleta: "orange" },
  aceptado: { etiqueta: "Aceptado", paleta: "success" },
  rechazado: { etiqueta: "Rechazado", paleta: "red" },
  anulado: { etiqueta: "Anulado", paleta: "purple" },
};

const PESTANAS_ESTADO: { valor: EstadoComprobante; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todos" },
  { valor: "vigentes", etiqueta: "Vigentes" },
  { valor: "pendientes", etiqueta: "Pendientes" },
  { valor: "anuladas", etiqueta: "Anuladas" },
];

function monto(
  moneda: string,
  valor: string | number | null | undefined,
): string {
  return moneda === "USD" ? formatMonedaUSD(valor) : formatMoneda(valor);
}

function aFechaIso(fecha: string | Date | null | undefined): string {
  if (!fecha) return "";
  return typeof fecha === "string"
    ? fecha.slice(0, 10)
    : fecha.toISOString().slice(0, 10);
}

function TarjetaResumen({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  cargando,
  color = "brand",
}: {
  icono: typeof ReceiptText;
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

function BadgeEstado({ estado }: { estado: EstadoComprobanteFiscal }) {
  const datos = ETIQUETAS_ESTADO[estado];
  return (
    <Badge colorPalette={datos.paleta} variant="subtle">
      {datos.etiqueta}
    </Badge>
  );
}

function BadgeSifen({ estado }: { estado: EstadoSifen }) {
  const datos = ETIQUETAS_SIFEN[estado];
  return (
    <Badge colorPalette={datos.paleta} variant="subtle">
      {datos.etiqueta}
    </Badge>
  );
}

function BadgeTipo({ tipo }: { tipo: TipoDocumentoFiscal }) {
  const factura =
    tipo === "factura" || tipo === "factura_credito_fiscal";
  return (
    <Badge
      colorPalette={factura ? "blue" : tipo === "ticket" ? "gray" : "purple"}
      variant="subtle"
    >
      {ETIQUETAS_TIPO[tipo]}
    </Badge>
  );
}

export function FacturacionPage() {
  const { puede } = useAuth();
  const { texto, setTexto, busqueda } = useBusquedaDiferida();

  const [pestana, setPestana] = useState<"comprobantes" | "timbrado">(
    "comprobantes",
  );
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<EstadoComprobante>("todas");
  const [tipoDocumento, setTipoDocumento] = useState<"" | TipoDocumentoFiscal>(
    "",
  );
  const [estadoSifen, setEstadoSifen] = useState<"" | EstadoSifen>("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [comprobanteId, setComprobanteId] = useState<number | null>(null);

  const filtros: FiltrosComprobantes = {
    busqueda,
    pagina,
    estado,
    tipoDocumento: tipoDocumento || undefined,
    estadoSifen: estadoSifen || undefined,
    desde: desde || undefined,
    hasta: hasta || undefined,
    ordenarPor: "fecha",
    direccion: "desc",
  };

  const consulta = useComprobantesFiscales(filtros);
  const resumen = useResumenFacturacion({ desde, hasta });
  const detalle = useComprobanteFiscal(comprobanteId ?? undefined);
  const timbrado = useTimbradoFiscal();
  const actualizarTimbrado = useActualizarTimbrado();

  const puedeConfigurar = puede("facturas.configurar");

  const [editandoTimbrado, setEditandoTimbrado] = useState(false);
  const [formTimbrado, setFormTimbrado] = useState<TimbradoPayload>({});
  const [erroresTimbrado, setErroresTimbrado] = useState<
    Record<string, string | undefined>
  >({});

  const resumenPYG = resumen.data?.porMoneda.find(
    (item) => item.moneda === "PYG",
  );
  const resumenUSD = resumen.data?.porMoneda.find(
    (item) => item.moneda === "USD",
  );
  const comprobanteAbierto = detalle.data ?? null;
  const hayFiltros = Boolean(
    busqueda || desde || hasta || tipoDocumento || estadoSifen,
  );

  function limpiarFiltros() {
    setTexto("");
    setDesde("");
    setHasta("");
    setTipoDocumento("");
    setEstadoSifen("");
    setEstado("todas");
    setPagina(1);
  }

  function refrescar() {
    void consulta.refetch();
    void resumen.refetch();
    void timbrado.refetch();
  }

  function abrirTimbrado() {
    const datos = timbrado.data;
    if (!datos) return;

    setFormTimbrado({
      timbradoNro: datos.timbradoNro ?? "",
      timbradoFechaInicio: aFechaIso(datos.timbradoFechaInicio),
      timbradoFechaVencimiento: aFechaIso(datos.timbradoFechaVencimiento),
      puntoVenta: datos.puntoVenta,
      establecimiento: datos.establecimiento,
      emitirTicketSinTimbrado: datos.emitirTicketSinTimbrado,
    });
    setErroresTimbrado({});
    actualizarTimbrado.reset();
    setEditandoTimbrado(true);
  }

  function guardarTimbrado() {
    const errores: Record<string, string | undefined> = {};

    if (
      formTimbrado.timbradoNro &&
      !/^\d{1,20}$/.test(formTimbrado.timbradoNro)
    ) {
      errores.timbradoNro = "El timbrado debe contener sólo números.";
    }
    if (
      formTimbrado.puntoVenta &&
      !/^\d{1,5}$/.test(formTimbrado.puntoVenta)
    ) {
      errores.puntoVenta = "El punto de venta debe tener hasta 5 dígitos.";
    }
    if (
      formTimbrado.establecimiento &&
      !/^\d{1,5}$/.test(formTimbrado.establecimiento)
    ) {
      errores.establecimiento =
        "El establecimiento debe tener hasta 5 dígitos.";
    }
    if (
      formTimbrado.timbradoFechaInicio &&
      formTimbrado.timbradoFechaVencimiento &&
      formTimbrado.timbradoFechaInicio >
        formTimbrado.timbradoFechaVencimiento
    ) {
      errores.timbradoFechaVencimiento =
        "El vencimiento no puede ser anterior al inicio.";
    }

    setErroresTimbrado(errores);
    if (Object.keys(errores).length > 0) return;

    actualizarTimbrado.mutate(
      {
        timbradoNro: formTimbrado.timbradoNro ?? "",
        timbradoFechaInicio: formTimbrado.timbradoFechaInicio || null,
        timbradoFechaVencimiento:
          formTimbrado.timbradoFechaVencimiento || null,
        puntoVenta: formTimbrado.puntoVenta,
        establecimiento: formTimbrado.establecimiento,
        emitirTicketSinTimbrado: formTimbrado.emitirTicketSinTimbrado,
      },
      {
        onSuccess: () => {
          setEditandoTimbrado(false);
          toaster.success({
            title: "Timbrado actualizado",
            description: "Los próximos comprobantes usarán estos datos.",
          });
        },
      },
    );
  }

  const columnas = useMemo<ColumnDef<ComprobanteFiscal, unknown>[]>(
    () => [
      {
        accessorKey: "numeroComprobante",
        header: "Comprobante",
        cell: ({ row }) => {
          const comprobante = row.original;
          return (
            <Box minW="0">
              <Text
                fontWeight="semibold"
                color="ink.900"
                fontSize="sm"
                fontFamily="mono"
              >
                {comprobante.numeroComprobante}
              </Text>
              <Flex align="center" gap="1.5" mt="1" wrap="wrap">
                <BadgeTipo tipo={comprobante.tipoDocumento} />
                {comprobante.cdcId && (
                  <Text fontSize="xs" color="ink.500" truncate maxW="12rem">
                    CDC {comprobante.cdcId}
                  </Text>
                )}
              </Flex>
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
              {row.original.cliente?.nombreCompleto ||
                row.original.cliente?.razonSocial ||
                "Sin cliente"}
            </Text>
            {row.original.cliente?.documento && (
              <Text fontSize="xs" color="ink.500" mt="0.5">
                {row.original.cliente.documento}
              </Text>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "fechaEmision",
        header: "Emisión",
        cell: ({ row }) => (
          <Text fontSize="sm" color="ink.800">
            {formatFechaCalendario(row.original.fechaEmision)}
          </Text>
        ),
      },
      {
        accessorKey: "timbrado",
        header: "Timbrado",
        cell: ({ row }) => (
          <Text fontSize="sm" color="ink.700" fontFamily="mono">
            {row.original.timbrado ?? "—"}
          </Text>
        ),
      },
      {
        accessorKey: "total",
        header: "Total",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Text
            fontSize="sm"
            fontWeight="bold"
            color="ink.900"
            fontVariantNumeric="tabular-nums"
          >
            {monto(row.original.moneda, row.original.total)}
          </Text>
        ),
      },
      {
        accessorKey: "estadoSifen",
        header: "SIFEN",
        cell: ({ row }) => <BadgeSifen estado={row.original.estadoSifen} />,
      },
      {
        accessorKey: "estado",
        header: "Estado",
        cell: ({ row }) => <BadgeEstado estado={row.original.estado} />,
      },
    ],
    [],
  );

  return (
    <Box>
      <PageHeader
        titulo="Facturación"
        descripcion="Libro de comprobantes emitidos y datos del timbrado fiscal."
        migas={["Finanzas", "Facturación"]}
        acciones={
          <Button
            variant="outline"
            onClick={refrescar}
            loading={consulta.isFetching || resumen.isFetching}
          >
            <RefreshCw size={15} /> Actualizar
          </Button>
        }
      />

      <Tabs.Root
        value={pestana}
        onValueChange={({ value }) =>
          setPestana(value as "comprobantes" | "timbrado")
        }
        variant="line"
      >
        <Tabs.List borderBottomWidth="1px" borderColor="ink.200" mb="5">
          <Tabs.Trigger value="comprobantes">
            <ReceiptText size={15} /> Comprobantes
          </Tabs.Trigger>
          <Tabs.Trigger value="timbrado">
            <ShieldCheck size={15} /> Timbrado
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="comprobantes" pt="0">
          <Grid
            templateColumns={{ base: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" }}
            gap="4"
            mb="6"
          >
            <TarjetaResumen
              icono={ReceiptText}
              etiqueta="Comprobantes del período"
              valor={resumen.data?.comprobantes.total ?? 0}
              detalle={`${resumen.data?.comprobantes.vigentes ?? 0} vigentes · ${
                resumen.data?.comprobantes.anuladas ?? 0
              } anulados`}
              cargando={resumen.isLoading}
            />
            <TarjetaResumen
              icono={CircleDollarSign}
              etiqueta="Total facturado"
              valor={formatMoneda(resumenPYG?.total ?? 0)}
              detalle={
                resumenUSD
                  ? `${formatMonedaUSD(
                      resumenUSD.total,
                    )} en dólares · ${resumenPYG?.cantidad ?? 0} comprobantes`
                  : `${resumen.data?.comprobantes.facturas ?? 0} facturas · ${
                      resumen.data?.comprobantes.tickets ?? 0
                    } tickets`
              }
              color="success"
              cargando={resumen.isLoading}
            />
            <TarjetaResumen
              icono={FileText}
              etiqueta="IVA débito fiscal"
              valor={formatMoneda(resumenPYG?.iva ?? 0)}
              detalle={`5 %: ${formatMoneda(
                resumenPYG?.iva5 ?? 0,
              )} · 10 %: ${formatMoneda(resumenPYG?.iva10 ?? 0)}`}
              color="orange"
              cargando={resumen.isLoading}
            />
            <TarjetaResumen
              icono={Ban}
              etiqueta="Anulados"
              valor={resumen.data?.comprobantes.anuladas ?? 0}
              detalle="Comprobantes anulados en el período"
              color="red"
              cargando={resumen.isLoading}
            />
          </Grid>

          <Panel flush>
            <Box
              px={{ base: "4", md: "5" }}
              borderBottomWidth="1px"
              borderColor="ink.200"
              overflowX="auto"
            >
              <Tabs.Root
                value={estado}
                onValueChange={({ value }) => {
                  setEstado(value as EstadoComprobante);
                  setPagina(1);
                }}
                variant="line"
                size="md"
              >
                <Tabs.List borderBottomWidth="0">
                  {PESTANAS_ESTADO.map((pestanaEstado) => (
                    <Tabs.Trigger
                      key={pestanaEstado.valor}
                      value={pestanaEstado.valor}
                    >
                      {pestanaEstado.etiqueta}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
              </Tabs.Root>
            </Box>

            <Grid
              templateColumns={{
                base: "1fr",
                sm: "1fr 1fr",
                lg: "minmax(0, 1fr) 10rem 9rem 9.5rem 9.5rem auto",
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
                    placeholder="Número, timbrado, CDC o cliente…"
                  />
                </Box>
              </Field.Root>

              <Field.Root>
                <Field.Label fontSize="xs" fontWeight="medium" color="ink.600">
                  Tipo
                </Field.Label>
                <NativeSelect.Root size="sm">
                  <NativeSelect.Field
                    value={tipoDocumento}
                    onChange={(evento) => {
                      setTipoDocumento(
                        evento.target.value as "" | TipoDocumentoFiscal,
                      );
                      setPagina(1);
                    }}
                  >
                    <option value="">Todos</option>
                    {Object.entries(ETIQUETAS_TIPO).map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>
                        {etiqueta}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>

              <Field.Root>
                <Field.Label fontSize="xs" fontWeight="medium" color="ink.600">
                  SIFEN
                </Field.Label>
                <NativeSelect.Root size="sm">
                  <NativeSelect.Field
                    value={estadoSifen}
                    onChange={(evento) => {
                      setEstadoSifen(evento.target.value as "" | EstadoSifen);
                      setPagina(1);
                    }}
                  >
                    <option value="">Todos</option>
                    {Object.entries(ETIQUETAS_SIFEN).map(
                      ([valor, datos]) => (
                        <option key={valor} value={valor}>
                          {datos.etiqueta}
                        </option>
                      ),
                    )}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
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
                gridColumn={{ base: "1 / -1", lg: "auto" }}
              >
                <X size={15} /> Limpiar
              </Button>
            </Grid>

            <DataTable
              data={consulta.data?.items ?? []}
              columns={columnas}
              cargando={consulta.isLoading}
              claveFila={(comprobante) => comprobante.id}
              onFilaClick={(comprobante) => setComprobanteId(comprobante.id)}
              hayBusqueda={hayFiltros || estado !== "todas"}
              vacioTitulo="Todavía no hay comprobantes emitidos"
              vacioDetalle="Cuando emitas una venta o una factura, aparecerá en este libro fiscal."
            />

            {consulta.data && (
              <Paginacion
                pagina={consulta.data.pagina}
                totalPaginas={consulta.data.totalPaginas}
                total={consulta.data.total}
                porPagina={FACTURACION_POR_PAGINA}
                onCambioPagina={setPagina}
                singular="comprobante"
                plural="comprobantes"
              />
            )}
          </Panel>
        </Tabs.Content>

        <Tabs.Content value="timbrado" pt="0">
          <TimbradoPanel
            timbrado={timbrado.data}
            resumen={resumen.data}
            cargando={timbrado.isLoading}
            puedeConfigurar={puedeConfigurar}
            onEditar={abrirTimbrado}
          />
        </Tabs.Content>
      </Tabs.Root>

      <FormDialog
        abierto={comprobanteId !== null}
        onClose={() => setComprobanteId(null)}
        titulo={
          comprobanteAbierto
            ? `Comprobante ${comprobanteAbierto.numeroComprobante}`
            : "Cargando comprobante…"
        }
        descripcion={
          comprobanteAbierto
            ? `${ETIQUETAS_TIPO[comprobanteAbierto.tipoDocumento]} · ${formatFechaCalendario(
                comprobanteAbierto.fechaEmision,
              )}`
            : undefined
        }
        ancho="2xl"
        textoCancelar="Cerrar"
        ocultarConfirmar
      >
        {detalle.isLoading ? (
          <Flex direction="column" gap="4">
            <Skeleton h="28" borderRadius="lg" />
            <Skeleton h="56" borderRadius="lg" />
          </Flex>
        ) : !comprobanteAbierto ? (
          <Alert status="error" rounded="md" title="No se pudo cargar el comprobante">
            {detalle.error
              ? mensajeDeError(detalle.error)
              : "Intentá de nuevo."}
          </Alert>
        ) : (
          <DetalleComprobante comprobante={comprobanteAbierto} />
        )}
      </FormDialog>

      <FormDialog
        abierto={editandoTimbrado}
        onClose={() => {
          if (!actualizarTimbrado.isPending) {
            setEditandoTimbrado(false);
            actualizarTimbrado.reset();
          }
        }}
        titulo="Editar timbrado"
        descripcion="Estos datos se heredan en cada factura que emitas desde Ventas."
        ancho="lg"
        textoConfirmar="Guardar timbrado"
        guardando={actualizarTimbrado.isPending}
        bloquearCierre={actualizarTimbrado.isPending}
        onConfirmar={guardarTimbrado}
      >
        <Flex direction="column" gap="4">
          {actualizarTimbrado.error && (
            <Alert status="error" rounded="md" title="No se pudo guardar">
              {mensajeDeError(actualizarTimbrado.error)}
            </Alert>
          )}

          <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="4">
            <Field.Root gridColumn={{ base: "1 / -1", sm: "auto" }}>
              <Field.Label>Número de timbrado</Field.Label>
              <Input
                value={formTimbrado.timbradoNro ?? ""}
                onChange={(evento) => {
                  setFormTimbrado((previo) => ({
                    ...previo,
                    timbradoNro: evento.target.value.replace(/\D/g, "").slice(0, 20),
                  }));
                  setErroresTimbrado((previos) => ({
                    ...previos,
                    timbradoNro: undefined,
                  }));
                }}
                placeholder="12345678"
                inputMode="numeric"
                fontFamily="mono"
              />
              {erroresTimbrado.timbradoNro && (
                <Text fontSize="xs" color="red.600" mt="1">
                  {erroresTimbrado.timbradoNro}
                </Text>
              )}
            </Field.Root>

            <Field.Root>
              <Field.Label>Fecha de inicio</Field.Label>
              <Input
                type="date"
                value={formTimbrado.timbradoFechaInicio ?? ""}
                max={formTimbrado.timbradoFechaVencimiento || undefined}
                onChange={(evento) =>
                  setFormTimbrado((previo) => ({
                    ...previo,
                    timbradoFechaInicio: evento.target.value,
                  }))
                }
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Fecha de vencimiento</Field.Label>
              <Input
                type="date"
                value={formTimbrado.timbradoFechaVencimiento ?? ""}
                min={formTimbrado.timbradoFechaInicio || undefined}
                onChange={(evento) => {
                  setFormTimbrado((previo) => ({
                    ...previo,
                    timbradoFechaVencimiento: evento.target.value,
                  }));
                  setErroresTimbrado((previos) => ({
                    ...previos,
                    timbradoFechaVencimiento: undefined,
                  }));
                }}
              />
              {erroresTimbrado.timbradoFechaVencimiento && (
                <Text fontSize="xs" color="red.600" mt="1">
                  {erroresTimbrado.timbradoFechaVencimiento}
                </Text>
              )}
            </Field.Root>

            <Field.Root>
              <Field.Label>Establecimiento</Field.Label>
              <Input
                value={formTimbrado.establecimiento ?? ""}
                onChange={(evento) => {
                  setFormTimbrado((previo) => ({
                    ...previo,
                    establecimiento: evento.target.value
                      .replace(/\D/g, "")
                      .slice(0, 5),
                  }));
                  setErroresTimbrado((previos) => ({
                    ...previos,
                    establecimiento: undefined,
                  }));
                }}
                placeholder="001"
                inputMode="numeric"
              />
              {erroresTimbrado.establecimiento && (
                <Text fontSize="xs" color="red.600" mt="1">
                  {erroresTimbrado.establecimiento}
                </Text>
              )}
            </Field.Root>

            <Field.Root>
              <Field.Label>Punto de venta</Field.Label>
              <Input
                value={formTimbrado.puntoVenta ?? ""}
                onChange={(evento) => {
                  setFormTimbrado((previo) => ({
                    ...previo,
                    puntoVenta: evento.target.value
                      .replace(/\D/g, "")
                      .slice(0, 5),
                  }));
                  setErroresTimbrado((previos) => ({
                    ...previos,
                    puntoVenta: undefined,
                  }));
                }}
                placeholder="001"
                inputMode="numeric"
              />
              {erroresTimbrado.puntoVenta && (
                <Text fontSize="xs" color="red.600" mt="1">
                  {erroresTimbrado.puntoVenta}
                </Text>
              )}
            </Field.Root>
          </Grid>

          <Flex
            align="center"
            justify="space-between"
            gap="4"
            p="4"
            bg="ink.50"
            borderWidth="1px"
            borderColor="ink.200"
            borderRadius="lg"
            wrap="wrap"
          >
            <Box flex="1" minW="12rem">
              <Text fontWeight="semibold" fontSize="sm" color="ink.900">
                Emitir ticket sin timbrado
              </Text>
              <Text fontSize="xs" color="ink.600" mt="1">
                Permite documentar ventas mientras el timbrado está pendiente.
              </Text>
            </Box>
            <Switch
              checked={formTimbrado.emitirTicketSinTimbrado ?? true}
              onCheckedChange={(detalle: { checked: boolean }) =>
                setFormTimbrado((previo) => ({
                  ...previo,
                  emitirTicketSinTimbrado: detalle.checked,
                }))
              }
              colorPalette="brand"
              aria-label="Emitir ticket sin timbrado"
            />
          </Flex>
        </Flex>
      </FormDialog>
    </Box>
  );
}

function TimbradoPanel({
  timbrado,
  resumen,
  cargando,
  puedeConfigurar,
  onEditar,
}: {
  timbrado?: TimbradoFiscal;
  resumen?: ResumenFacturacion;
  cargando: boolean;
  puedeConfigurar: boolean;
  onEditar: () => void;
}) {
  if (cargando || !timbrado) {
    return (
      <Panel>
        <Flex direction="column" gap="4">
          <Skeleton h="20" borderRadius="lg" />
          <Skeleton h="40" borderRadius="lg" />
        </Flex>
      </Panel>
    );
  }

  const estado = timbrado.estadoTimbrado;

  return (
    <Flex direction="column" gap="5">
      <Panel>
        <PanelHeader
          titulo="Estado del timbrado"
          descripcion="La DNIT habilita la emisión de facturas fiscales."
          acciones={
            puedeConfigurar ? (
              <Button variant="outline" size="sm" onClick={onEditar}>
                <Pencil size={15} /> Editar timbrado
              </Button>
            ) : undefined
          }
        />

        <Box px={{ base: "4", md: "5" }} py="5">
          <Flex direction="column" gap="5">
            {estado.puedeEmitirFactura ? (
              <Alert status="success" rounded="md" title="Timbrado vigente">
                <Flex align="center" gap="2">
                  <CheckCircle2 size={15} />
                  Podés emitir facturas fiscales con el timbrado{" "}
                  {timbrado.timbradoNro ?? "—"}.
                </Flex>
              </Alert>
            ) : estado.vencido ? (
              <Alert status="error" rounded="md" title="Timbrado vencido">
                <Flex align="center" gap="2">
                  <AlertTriangle size={15} />
                  {estado.motivo ??
                    "Renová el timbrado con la DNIT para volver a emitir facturas."}
                </Flex>
              </Alert>
            ) : (
              <Alert status="warning" rounded="md" title="Sin timbrado">
                <Flex align="center" gap="2">
                  <AlertTriangle size={15} />
                  {estado.motivo ??
                    "Configurá el timbrado para emitir facturas fiscales."}
                </Flex>
              </Alert>
            )}

            <Grid
              templateColumns={{
                base: "1fr",
                sm: "1fr 1fr",
                lg: "repeat(3, minmax(0, 1fr))",
              }}
              gap="4"
            >
              <DatoFiscal
                etiqueta="Número de timbrado"
                valor={timbrado.timbradoNro ?? "Sin configurar"}
                mono
              />
              <DatoFiscal
                etiqueta="Vigencia"
                valor={
                  timbrado.timbradoFechaVencimiento
                    ? `Vence el ${formatFechaCalendario(
                        timbrado.timbradoFechaVencimiento,
                      )}`
                    : "Sin vencimiento"
                }
                detalle={
                  timbrado.timbradoFechaInicio
                    ? `Desde ${formatFechaCalendario(
                        timbrado.timbradoFechaInicio,
                      )}`
                    : undefined
                }
              />
              <DatoFiscal
                etiqueta="Establecimiento / punto"
                valor={`${timbrado.establecimiento}-${timbrado.puntoVenta}`}
                mono
              />
              <DatoFiscal
                etiqueta="Correlativo actual"
                valor={String(timbrado.correlativoActual).padStart(7, "0")}
                mono
              />
              <DatoFiscal
                etiqueta="Próximo comprobante"
                valor={String(timbrado.siguienteNumero).padStart(7, "0")}
                detalle="Se asigna recién al emitir en Ventas."
                mono
              />
              <DatoFiscal
                etiqueta="Ticket sin timbrado"
                valor={
                  timbrado.emitirTicketSinTimbrado ? "Habilitado" : "Deshabilitado"
                }
              />
            </Grid>

            <Alert status="info" rounded="md" title="Cómo se numera">
              El correlativo es único por veterinaria y avanza sólo cuando se
              emite un comprobante. Anular no devuelve el número: la numeración
              fiscal no se reutiliza.
            </Alert>
          </Flex>
        </Box>
      </Panel>

      <Panel>
        <PanelHeader
          titulo="Resumen fiscal por tipo"
          descripcion="Comprobantes del período consultado en la pestaña anterior."
        />
        <Box px={{ base: "4", md: "5" }} py="4">
          <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3">
            {Object.entries(ETIQUETAS_TIPO).map(([tipo, etiqueta]) => {
              const cantidad =
                resumen?.porTipoDocumento.find(
                  (item) => item.tipoDocumento === tipo,
                )?.cantidad ?? 0;

              return (
                <Flex
                  key={tipo}
                  justify="space-between"
                  align="center"
                  gap="3"
                  px="4"
                  py="3"
                  borderWidth="1px"
                  borderColor="ink.200"
                  borderRadius="lg"
                >
                  <BadgeTipo tipo={tipo as TipoDocumentoFiscal} />
                  <Text fontSize="sm" color="ink.600">
                    {etiqueta}
                  </Text>
                  <Text
                    fontSize="sm"
                    fontWeight="bold"
                    color="ink.900"
                    fontVariantNumeric="tabular-nums"
                    ml="auto"
                  >
                    {cantidad}
                  </Text>
                </Flex>
              );
            })}
          </Grid>
        </Box>
      </Panel>
    </Flex>
  );
}

function DatoFiscal({
  etiqueta,
  valor,
  detalle,
  mono,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  mono?: boolean;
}) {
  return (
    <Box
      p="4"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="lg"
      bg="ink.50"
    >
      <Text fontSize="xs" color="ink.500" fontWeight="medium">
        {etiqueta}
      </Text>
      <Text
        fontSize="md"
        fontWeight="bold"
        color="ink.900"
        mt="1"
        fontFamily={mono ? "mono" : undefined}
      >
        {valor}
      </Text>
      {detalle && (
        <Text fontSize="xs" color="ink.500" mt="1">
          {detalle}
        </Text>
      )}
    </Box>
  );
}

function DetalleComprobante({ comprobante }: { comprobante: ComprobanteFiscal }) {
  const items = comprobante.items ?? [];
  const pagos = comprobante.pagos ?? [];

  return (
    <Flex direction="column" gap="5">
      {comprobante.anulada && (
        <Alert status="error" rounded="md" title="Comprobante anulado">
          {comprobante.anuladaMotivo || "Este comprobante fue anulado."}
        </Alert>
      )}

      <Grid
        templateColumns={{ base: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" }}
        gap="3"
      >
        <DatoFiscal
          etiqueta="Tipo"
          valor={ETIQUETAS_TIPO[comprobante.tipoDocumento]}
        />
        <DatoFiscal
          etiqueta="Timbrado"
          valor={comprobante.timbrado ?? "—"}
          mono
        />
        <DatoFiscal
          etiqueta="Establecimiento / punto"
          valor={`${comprobante.establecimiento ?? "—"}-${
            comprobante.puntoExpedicion ?? comprobante.puntoVenta ?? "—"
          }`}
          mono
        />
        <DatoFiscal
          etiqueta="Estado SIFEN"
          valor={ETIQUETAS_SIFEN[comprobante.estadoSifen].etiqueta}
        />
      </Grid>

      <Box
        borderWidth="1px"
        borderColor="ink.200"
        borderRadius="lg"
        p="4"
      >
        <Text fontSize="xs" color="ink.500" fontWeight="medium">
          Cliente
        </Text>
        <Text fontWeight="semibold" color="ink.900" mt="1">
          {comprobante.cliente?.nombreCompleto ||
            comprobante.cliente?.razonSocial ||
            "Sin cliente"}
        </Text>
        {comprobante.cliente?.documento && (
          <Text fontSize="sm" color="ink.600" mt="0.5">
            Documento: {comprobante.cliente.documento}
          </Text>
        )}
        {comprobante.cdcId && (
          <Flex align="center" gap="1.5" mt="2" color="ink.600">
            <Hash size={14} />
            <Text fontSize="xs" fontFamily="mono">
              CDC {comprobante.cdcId}
            </Text>
          </Flex>
        )}
      </Box>

      {items.length > 0 && (
        <Box borderWidth="1px" borderColor="ink.200" borderRadius="lg" overflow="hidden">
          <Table.ScrollArea>
            <Table.Root size="sm">
              <Table.Header bg="ink.50">
                <Table.Row>
                  <Table.ColumnHeader>Descripción</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Cant.</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Precio</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">IVA</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Total</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {items.map((item) => (
                  <Table.Row key={item.id}>
                    <Table.Cell>
                      <Text fontSize="sm" color="ink.900">
                        {item.descripcion}
                      </Text>
                      {item.codigo && (
                        <Text fontSize="xs" color="ink.500">
                          {item.codigo}
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell textAlign="right" fontVariantNumeric="tabular-nums">
                      {item.cantidad}
                    </Table.Cell>
                    <Table.Cell textAlign="right" fontVariantNumeric="tabular-nums">
                      {monto(comprobante.moneda, item.precioUnitario)}
                    </Table.Cell>
                    <Table.Cell textAlign="right">
                      {item.porcentajeIva}%
                    </Table.Cell>
                    <Table.Cell
                      textAlign="right"
                      fontWeight="semibold"
                      fontVariantNumeric="tabular-nums"
                    >
                      {monto(comprobante.moneda, item.total)}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
        </Box>
      )}

      <Flex justify="flex-end">
        <Box
          w={{ base: "full", sm: "20rem" }}
          borderWidth="1px"
          borderColor="ink.200"
          borderRadius="lg"
          p="4"
          bg="ink.50"
        >
          <FilaTotal
            etiqueta="Subtotal"
            valor={monto(comprobante.moneda, comprobante.subtotal)}
          />
          <FilaTotal
            etiqueta="IVA 5 %"
            valor={monto(comprobante.moneda, comprobante.iva5)}
          />
          <FilaTotal
            etiqueta="IVA 10 %"
            valor={monto(comprobante.moneda, comprobante.iva10)}
          />
          <FilaTotal
            etiqueta="Exenta"
            valor={monto(comprobante.moneda, comprobante.exenta)}
          />
          <Box borderTopWidth="1px" borderColor="ink.300" mt="2" pt="2">
            <FilaTotal
              etiqueta="Total"
              valor={monto(comprobante.moneda, comprobante.total)}
              destacado
            />
            {comprobante.pagado !== undefined && (
              <FilaTotal
                etiqueta="Pagado"
                valor={monto(comprobante.moneda, comprobante.pagado)}
              />
            )}
            {comprobante.saldo !== undefined && (
              <FilaTotal
                etiqueta="Saldo"
                valor={monto(comprobante.moneda, comprobante.saldo)}
                destacado
              />
            )}
          </Box>
        </Box>
      </Flex>

      {pagos.length > 0 && (
        <Box borderWidth="1px" borderColor="ink.200" borderRadius="lg" p="4">
          <Text fontWeight="semibold" color="ink.900" fontSize="sm" mb="2">
            Cobros registrados
          </Text>
          <Flex direction="column" gap="2">
            {pagos.map((pago) => (
              <Flex
                key={pago.id}
                justify="space-between"
                align="center"
                gap="3"
                fontSize="sm"
                color="ink.700"
              >
                <Text textTransform="capitalize">{pago.metodo.replace(/_/g, " ")}</Text>
                <Text fontVariantNumeric="tabular-nums" fontWeight="medium">
                  {monto(comprobante.moneda, pago.monto)}
                </Text>
              </Flex>
            ))}
          </Flex>
        </Box>
      )}

      <Flex justify="space-between" gap="3" wrap="wrap" fontSize="xs" color="ink.500">
        <Text>Emitido por {comprobante.usuario.nombre} {comprobante.usuario.apellido}</Text>
        <Text>Registrado el {formatFechaCalendario(comprobante.creadoEn)}</Text>
      </Flex>
    </Flex>
  );
}

function FilaTotal({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <Flex justify="space-between" align="center" gap="3" py="0.5">
      <Text
        fontSize={destacado ? "sm" : "xs"}
        color={destacado ? "ink.900" : "ink.600"}
        fontWeight={destacado ? "bold" : "normal"}
      >
        {etiqueta}
      </Text>
      <Text
        fontSize={destacado ? "md" : "sm"}
        color="ink.900"
        fontWeight={destacado ? "bold" : "medium"}
        fontVariantNumeric="tabular-nums"
      >
        {valor}
      </Text>
    </Flex>
  );
}
