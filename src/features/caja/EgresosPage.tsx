import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  Input,
  NativeSelect,
  Stack,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  CircleDollarSign,
  Eye,
  FileText,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { DataTable } from "@/components/data/DataTable";
import { FormDialog } from "@/components/data/FormDialog";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError } from "@/features/clients/clients.service";
import {
  formatFechaCalendario,
  formatFechaHora,
  formatMoneda,
  formatMonedaUSD,
  formatRuc,
} from "@/lib/formato";
import { EgresoForm } from "./EgresoForm";
import {
  EGRESOS_POR_PAGINA,
  ETIQUETAS_METODO_PAGO,
  ETIQUETAS_TIPO_EGRESO,
  useAnularEgreso,
  useCajaActual,
  useCrearEgreso,
  useEgresos,
  type Egreso,
  type EgresoFiltros,
  type FiltroEstadoEgreso,
  type MetodoPago,
  type TipoEgreso,
} from "./caja.service";

/* ─────────────────────────────── Datos y etiquetas ─────────────────────────────── */

const PESTANAS_ESTADO: { valor: FiltroEstadoEgreso; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "registrado", etiqueta: "Registrados" },
  { valor: "anulado", etiqueta: "Anulados" },
];

const COLOR_TIPO: Record<
  TipoEgreso,
  "gray" | "blue" | "orange" | "red" | "purple" | "green"
> = {
  compra: "blue",
  alquiler: "orange",
  servicios: "blue",
  impuestos: "purple",
  pagos: "green",
  retiros: "red",
  mantenimiento: "orange",
  salarios: "orange",
  otros: "gray",
};

function montoEgreso(egreso: Egreso): string {
  return egreso.moneda === "USD"
    ? formatMonedaUSD(egreso.monto)
    : formatMoneda(egreso.monto);
}

function BadgeEstadoEgreso({ estado }: { estado: Egreso["estado"] }) {
  const anulado = estado === "anulado";
  return (
    <Badge colorPalette={anulado ? "red" : "success"} variant="subtle">
      {anulado ? "Anulado" : "Registrado"}
    </Badge>
  );
}

function FilaDato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <Flex justify="space-between" align="flex-start" gap="4" fontSize="sm">
      <Text color="ink.600" flexShrink={0}>
        {etiqueta}
      </Text>
      <Box color="ink.900" textAlign="right" minW="0">
        {children}
      </Box>
    </Flex>
  );
}

function TarjetaDetalle({
  titulo,
  icono: Icono,
  children,
}: {
  titulo: string;
  icono: typeof CircleDollarSign;
  children: React.ReactNode;
}) {
  return (
    <Box
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="lg"
      p="4"
      bg="white"
    >
      <Flex align="center" gap="2" mb="3">
        <Flex
          align="center"
          justify="center"
          w="7"
          h="7"
          borderRadius="md"
          bg="brand.50"
          color="brand.600"
        >
          <Icono size={14} />
        </Flex>
        <Text fontSize="sm" fontWeight="semibold" color="ink.900">
          {titulo}
        </Text>
      </Flex>
      <Stack gap="2.5">{children}</Stack>
    </Box>
  );
}

/* ───────────────────────────────── Detalle ───────────────────────────────── */

function DetalleEgreso({ egreso }: { egreso: Egreso }) {
  return (
    <Stack gap="4">
      {egreso.estado === "anulado" && (
        <Alert
          status="warning"
          rounded="md"
          title="Egreso anulado"
          icon={<TriangleAlert size={18} />}
        >
          {egreso.anuladoMotivo ?? "El egreso fue anulado."}
          {egreso.anuladoEn ? ` · ${formatFechaHora(egreso.anuladoEn)}` : ""}
          {egreso.anuladoPor
            ? ` · ${egreso.anuladoPor.nombre} ${egreso.anuladoPor.apellido}`
            : ""}
        </Alert>
      )}

      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="4">
        <TarjetaDetalle titulo="Egreso" icono={CircleDollarSign}>
          <FilaDato etiqueta="Concepto">
            <Text fontWeight="semibold">{egreso.concepto}</Text>
          </FilaDato>
          <FilaDato etiqueta="Tipo">
            <Badge colorPalette={COLOR_TIPO[egreso.tipo]} variant="subtle">
              {ETIQUETAS_TIPO_EGRESO[egreso.tipo]}
            </Badge>
          </FilaDato>
          <FilaDato etiqueta="Estado">
            <BadgeEstadoEgreso estado={egreso.estado} />
          </FilaDato>
          <FilaDato etiqueta="Fecha">
            {formatFechaCalendario(egreso.fecha)}
          </FilaDato>
          <FilaDato etiqueta="Método">
            {ETIQUETAS_METODO_PAGO[egreso.metodoPago]}
          </FilaDato>
          <FilaDato etiqueta="Monto">
            <Text fontWeight="bold" fontVariantNumeric="tabular-nums">
              {montoEgreso(egreso)}
            </Text>
          </FilaDato>
          {egreso.moneda === "USD" && egreso.tipoCambio && (
            <FilaDato etiqueta="Tipo de cambio">
              {formatMoneda(egreso.tipoCambio)}
            </FilaDato>
          )}
        </TarjetaDetalle>

        <TarjetaDetalle titulo="Comprobante y proveedor" icono={FileText}>
          <FilaDato etiqueta="Proveedor">
            {egreso.proveedor ? (
              <Box>
                <Text>{egreso.proveedor.razonSocial}</Text>
                <Text fontSize="xs" color="ink.500">
                  RUC {formatRuc(egreso.proveedor.documento)}
                </Text>
              </Box>
            ) : (
              "—"
            )}
          </FilaDato>
          <FilaDato etiqueta="Comprobante">
            {egreso.comprobanteNum ?? "—"}
          </FilaDato>
          <FilaDato etiqueta="Factura de compra">
            {egreso.facturaCompra?.numeroComprobante ?? "—"}
          </FilaDato>
          <FilaDato etiqueta="Registrado por">
            {egreso.usuario.nombre} {egreso.usuario.apellido}
          </FilaDato>
          <FilaDato etiqueta="Caja">
            {formatFechaHora(egreso.cajaSesion.fechaApertura)}
          </FilaDato>
        </TarjetaDetalle>
      </Grid>

      <TarjetaDetalle titulo="Movimiento de caja" icono={CircleDollarSign}>
        {egreso.movimientoCaja ? (
          <>
            <FilaDato etiqueta="Monto en caja">
              <Text fontWeight="semibold" fontVariantNumeric="tabular-nums">
                {formatMoneda(egreso.movimientoCaja.monto)}
              </Text>
            </FilaDato>
            <FilaDato etiqueta="Afecta efectivo">
              <Badge
                colorPalette={
                  egreso.movimientoCaja.afectaEfectivo ? "success" : "gray"
                }
                variant="subtle"
              >
                {egreso.movimientoCaja.afectaEfectivo ? "Sí" : "No"}
              </Badge>
            </FilaDato>
            {egreso.movimientoCaja.reversaDeId && (
              <FilaDato etiqueta="Reversa de">
                Movimiento #{egreso.movimientoCaja.reversaDeId}
              </FilaDato>
            )}
          </>
        ) : (
          <Text fontSize="sm" color="ink.500">
            El egreso no tiene un movimiento de caja asociado.
          </Text>
        )}
      </TarjetaDetalle>

      {egreso.notas && (
        <Box
          borderWidth="1px"
          borderColor="ink.200"
          borderRadius="lg"
          p="4"
          bg="ink.50"
        >
          <Text fontSize="xs" fontWeight="semibold" color="ink.600" mb="1">
            Notas
          </Text>
          <Text fontSize="sm" color="ink.800" whiteSpace="pre-wrap">
            {egreso.notas}
          </Text>
        </Box>
      )}
    </Stack>
  );
}

/* ───────────────────────────────────── Página ───────────────────────────────────── */

export function EgresosPage() {
  const { puede } = useAuth();
  const { texto, setTexto, busqueda } = useBusquedaDiferida();

  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<FiltroEstadoEgreso>("todos");
  const [tipo, setTipo] = useState<"" | TipoEgreso>("");
  const [metodoPago, setMetodoPago] = useState<"" | MetodoPago>("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [detalle, setDetalle] = useState<Egreso | null>(null);
  const [egresoAnulando, setEgresoAnulando] = useState<Egreso | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");

  const actual = useCajaActual();
  const consulta = useEgresos({
    busqueda,
    pagina,
    estado,
    tipo: tipo || undefined,
    metodoPago: metodoPago || undefined,
    desde: desde || undefined,
    hasta: hasta || undefined,
    ordenarPor: "fecha",
    direccion: "desc",
  } satisfies EgresoFiltros);

  const crear = useCrearEgreso();
  const anular = useAnularEgreso();

  const cajaAbierta = actual.data?.abierta === true;
  const hayFiltros = Boolean(busqueda || tipo || metodoPago || desde || hasta);
  const hayBusqueda = hayFiltros || estado !== "todos";

  function refrescar() {
    void actual.refetch();
    void consulta.refetch();
  }

  function limpiarFiltros() {
    setTexto("");
    setTipo("");
    setMetodoPago("");
    setDesde("");
    setHasta("");
    setEstado("todos");
    setPagina(1);
  }

  function abrirNuevo() {
    crear.reset();
    setNuevoAbierto(true);
  }

  function abrirAnular(egreso: Egreso) {
    anular.reset();
    setMotivoAnulacion("");
    setEgresoAnulando(egreso);
  }

  const columnas = useMemo<ColumnDef<Egreso, unknown>[]>(
    () => [
      {
        accessorKey: "fecha",
        header: "Fecha",
        cell: ({ row }) => (
          <Text fontSize="sm" color="ink.800">
            {formatFechaCalendario(row.original.fecha)}
          </Text>
        ),
      },
      {
        accessorKey: "concepto",
        header: "Concepto",
        cell: ({ row }) => (
          <Box minW="0">
            <Text fontSize="sm" fontWeight="semibold" color="ink.900">
              {row.original.concepto}
            </Text>
            <Flex align="center" gap="1.5" mt="1" wrap="wrap">
              <Badge
                colorPalette={COLOR_TIPO[row.original.tipo]}
                variant="subtle"
                size="sm"
              >
                {ETIQUETAS_TIPO_EGRESO[row.original.tipo]}
              </Badge>
              {row.original.comprobanteNum && (
                <Text fontSize="xs" color="ink.500" fontFamily="mono">
                  {row.original.comprobanteNum}
                </Text>
              )}
            </Flex>
          </Box>
        ),
      },
      {
        id: "proveedor",
        header: "Proveedor",
        cell: ({ row }) => (
          <Text fontSize="sm" color="ink.700">
            {row.original.proveedor?.razonSocial ?? "—"}
          </Text>
        ),
      },
      {
        accessorKey: "metodoPago",
        header: "Método",
        cell: ({ row }) => (
          <Badge colorPalette="gray" variant="subtle">
            {ETIQUETAS_METODO_PAGO[row.original.metodoPago]}
          </Badge>
        ),
      },
      {
        accessorKey: "monto",
        header: "Monto",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Box textAlign="right">
            <Text
              fontSize="sm"
              fontWeight="bold"
              color="ink.900"
              fontVariantNumeric="tabular-nums"
            >
              {montoEgreso(row.original)}
            </Text>
            {row.original.moneda === "USD" && row.original.movimientoCaja && (
              <Text fontSize="xs" color="ink.500" fontVariantNumeric="tabular-nums">
                En caja {formatMoneda(row.original.movimientoCaja.monto)}
              </Text>
            )}
          </Box>
        ),
      },
      {
        accessorKey: "estado",
        header: "Estado",
        cell: ({ row }) => (
          <Box>
            <BadgeEstadoEgreso estado={row.original.estado} />
            {row.original.estado === "anulado" &&
              row.original.anuladoMotivo && (
                <Text fontSize="xs" color="ink.500" mt="1" truncate>
                  {row.original.anuladoMotivo}
                </Text>
              )}
          </Box>
        ),
      },
      {
        id: "acciones",
        header: "",
        meta: { align: "right" },
        enableSorting: false,
        cell: ({ row }) => {
          const egreso = row.original;
          return (
            <Flex justify="flex-end" gap="0.5">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                aria-label={`Ver egreso ${egreso.concepto}`}
                title="Ver detalle"
                onClick={(evento) => {
                  evento.stopPropagation();
                  setDetalle(egreso);
                }}
              >
                <Eye size={16} />
              </Button>

              {egreso.estado === "registrado" && puede("caja.egresos") && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  colorPalette="red"
                  aria-label={`Anular egreso ${egreso.concepto}`}
                  title="Anular"
                  onClick={(evento) => {
                    evento.stopPropagation();
                    abrirAnular(egreso);
                  }}
                >
                  <Ban size={16} />
                </Button>
              )}
            </Flex>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [puede],
  );

  return (
    <Box>
      <PageHeader
        titulo="Egresos"
        descripcion="Gastos registrados fuera de compras, con su movimiento de caja."
        migas={["Finanzas", "Egresos"]}
        acciones={
          <>
            <Button
              variant="outline"
              onClick={refrescar}
              loading={consulta.isFetching || actual.isFetching}
            >
              <RefreshCw size={15} /> Actualizar
            </Button>
            {puede("caja.egresos") && (
              <Button
                colorPalette="brand"
                onClick={abrirNuevo}
                disabled={!cajaAbierta}
                title={
                  cajaAbierta
                    ? undefined
                    : "Abrí la caja para registrar egresos."
                }
              >
                <Plus size={16} /> Nuevo egreso
              </Button>
            )}
          </>
        }
      />

      {actual.data && !actual.data.abierta && (
        <Alert status="warning" rounded="md" title="La caja está cerrada" mb="5">
          <Flex
            align={{ base: "flex-start", sm: "center" }}
            justify="space-between"
            direction={{ base: "column", sm: "row" }}
            gap="3"
          >
            <Text>
              Todo egreso exige una caja abierta, incluso si el pago no es en
              efectivo. Abrila antes de registrar un gasto.
            </Text>
            <Button size="sm" variant="outline" asChild flexShrink={0}>
              <Link to="/caja">Ir a Caja</Link>
            </Button>
          </Flex>
        </Alert>
      )}

      {actual.error && (
        <Alert status="error" rounded="md" title="No pudimos verificar la caja" mb="5">
          {mensajeDeError(actual.error)}
        </Alert>
      )}

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
              setEstado(value as FiltroEstadoEgreso);
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
            xl: "minmax(0, 1fr) 10rem 10rem 10rem 10rem auto",
          }}
          gap="4"
          alignItems="end"
          px={{ base: "4", md: "5" }}
          py="4"
          borderBottomWidth="1px"
          borderColor="ink.200"
        >
          <Field.Root gridColumn={{ base: "1 / -1", xl: "auto" }}>
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
                placeholder="Concepto, comprobante o proveedor…"
              />
            </Box>
          </Field.Root>

          <Field.Root>
            <Field.Label fontSize="xs" fontWeight="medium" color="ink.600">
              Tipo
            </Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={tipo}
                onChange={(evento) => {
                  setTipo(evento.target.value as "" | TipoEgreso);
                  setPagina(1);
                }}
              >
                <option value="">Todos</option>
                {(Object.keys(ETIQUETAS_TIPO_EGRESO) as TipoEgreso[]).map(
                  (valor) => (
                    <option key={valor} value={valor}>
                      {ETIQUETAS_TIPO_EGRESO[valor]}
                    </option>
                  ),
                )}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
          </Field.Root>

          <Field.Root>
            <Field.Label fontSize="xs" fontWeight="medium" color="ink.600">
              Método
            </Field.Label>
            <NativeSelect.Root size="sm">
              <NativeSelect.Field
                value={metodoPago}
                onChange={(evento) => {
                  setMetodoPago(evento.target.value as "" | MetodoPago);
                  setPagina(1);
                }}
              >
                <option value="">Todos</option>
                {(Object.keys(ETIQUETAS_METODO_PAGO) as MetodoPago[]).map(
                  (valor) => (
                    <option key={valor} value={valor}>
                      {ETIQUETAS_METODO_PAGO[valor]}
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
            disabled={!hayBusqueda}
            visibility={{ base: hayBusqueda ? "visible" : "hidden", xl: "visible" }}
          >
            <X size={15} /> Limpiar
          </Button>
        </Grid>

        <DataTable
          data={consulta.data?.items ?? []}
          columns={columnas}
          cargando={consulta.isLoading}
          claveFila={(egreso) => egreso.id}
          onFilaClick={(egreso) => setDetalle(egreso)}
          hayBusqueda={hayBusqueda}
          vacioTitulo="Todavía no hay egresos registrados"
          vacioDetalle="Cuando registres el primer gasto, vas a verlo acá con su movimiento de caja."
        />

        {consulta.data && (
          <Paginacion
            pagina={consulta.data.pagina}
            totalPaginas={consulta.data.totalPaginas}
            total={consulta.data.total}
            porPagina={EGRESOS_POR_PAGINA}
            onCambioPagina={setPagina}
            singular="egreso"
            plural="egresos"
          />
        )}
      </Panel>

      {/* ── Nuevo egreso ─────────────────────────────────────────────── */}
      <FormDialog
        abierto={nuevoAbierto}
        onClose={() => {
          if (!crear.isPending) {
            setNuevoAbierto(false);
            crear.reset();
          }
        }}
        titulo="Nuevo egreso"
        descripcion="Registrá el gasto. Queda asociado a la caja abierta y no se puede editar; sólo anular."
        ancho="2xl"
        textoConfirmar="Registrar egreso"
        guardando={crear.isPending}
        bloquearCierre={crear.isPending}
        onConfirmar={() =>
          (document.getElementById("egreso-form") as HTMLFormElement | null)?.requestSubmit()
        }
      >
        {nuevoAbierto && (
          <EgresoForm
            cajaAbierta={cajaAbierta}
            errorGeneral={crear.error ? mensajeDeError(crear.error) : null}
            onGuardar={(datos) => {
              crear.mutate(datos, {
                onSuccess: (egreso) => {
                  setNuevoAbierto(false);
                  setPagina(1);
                  toaster.success({
                    title: "Egreso registrado",
                    description: `${egreso.concepto} · ${montoEgreso(egreso)}`,
                  });
                },
              });
            }}
          />
        )}
      </FormDialog>

      {/* ── Detalle ──────────────────────────────────────────────────── */}
      <FormDialog
        abierto={detalle !== null}
        onClose={() => setDetalle(null)}
        titulo="Detalle del egreso"
        descripcion={
          detalle ? `${detalle.concepto} · ${formatFechaCalendario(detalle.fecha)}` : undefined
        }
        ancho="lg"
        textoCancelar="Cerrar"
        ocultarConfirmar
        acciones={
          detalle?.estado === "registrado" && puede("caja.egresos") ? (
            <Button
              colorPalette="red"
              variant="outline"
              onClick={() => {
                const egreso = detalle;
                setDetalle(null);
                if (egreso) abrirAnular(egreso);
              }}
            >
              <Ban size={15} /> Anular egreso
            </Button>
          ) : undefined
        }
      >
        {detalle && <DetalleEgreso egreso={detalle} />}
      </FormDialog>

      {/* ── Anular ───────────────────────────────────────────────────── */}
      <FormDialog
        abierto={egresoAnulando !== null}
        onClose={() => {
          if (!anular.isPending) {
            setEgresoAnulando(null);
            setMotivoAnulacion("");
            anular.reset();
          }
        }}
        titulo="Anular egreso"
        descripcion={
          egresoAnulando
            ? `${egresoAnulando.concepto} · ${montoEgreso(egresoAnulando)}`
            : undefined
        }
        ancho="md"
        textoConfirmar="Anular egreso"
        guardando={anular.isPending}
        bloquearCierre={anular.isPending}
        confirmarDeshabilitado={motivoAnulacion.trim().length < 3}
        onConfirmar={() => {
          if (!egresoAnulando) return;
          anular.mutate(
            { id: egresoAnulando.id, motivo: motivoAnulacion.trim() },
            {
              onSuccess: (egreso) => {
                setEgresoAnulando(null);
                setMotivoAnulacion("");
                toaster.success({
                  title: "Egreso anulado",
                  description: `${egreso.concepto} · la reversa se registró en la caja actual.`,
                });
              },
            },
          );
        }}
      >
        <Stack gap="4">
          <Alert status="warning" rounded="md" title="La anulación no borra el egreso">
            Se marca como anulado y se registra un movimiento de reversa en la
            caja abierta actual. Si la caja está cerrada, la operación se
            bloquea.
          </Alert>

          <Field.Root required>
            <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
              Motivo de la anulación
              <Field.RequiredIndicator />
            </Field.Label>
            <Textarea
              value={motivoAnulacion}
              onChange={(evento) => setMotivoAnulacion(evento.target.value)}
              placeholder="Ej.: pago duplicado, error de monto, gasto cancelado…"
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
    </Box>
  );
}
