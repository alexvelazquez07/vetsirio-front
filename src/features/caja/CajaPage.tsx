import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  Input,
  Skeleton,
  Stack,
  Stat,
  Tabs,
  Text,
  Textarea,
  chakra,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowRight,
  Banknote,
  CircleDollarSign,
  Clock,
  Lock,
  LockOpen,
  RefreshCw,
  Scale,
  Search,
  TrendingDown,
  TrendingUp,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { DataTable } from "@/components/data/DataTable";
import { FormDialog } from "@/components/data/FormDialog";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { MoneyInput } from "@/components/fields/MoneyInput";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError } from "@/features/clients/clients.service";
import {
  formatFechaHora,
  formatMoneda,
} from "@/lib/formato";
import {
  DENOMINACIONES_PYG,
  calcularDiferencia,
  estadoDiferencia,
  sumarDetallesArqueo,
} from "./caja.calculo";
import {
  CAJA_POR_PAGINA,
  useAbrirCaja,
  useCajaActual,
  useCajas,
  useCerrarCaja,
  type CajaSesion,
  type FiltroEstadoCaja,
  type Monto,
} from "./caja.service";

/* ─────────────────────────────── Datos y etiquetas ─────────────────────────────── */

const PESTANAS_ESTADO: { valor: FiltroEstadoCaja; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "abierta", etiqueta: "Abierta" },
  { valor: "cerrada", etiqueta: "Cerradas" },
];

function monto(valor: Monto | null | undefined): string {
  return formatMoneda(valor);
}

function BadgeEstadoCaja({ estado }: { estado: CajaSesion["estado"] }) {
  const abierta = estado === "abierta";
  return (
    <Badge colorPalette={abierta ? "success" : "gray"} variant="subtle">
      {abierta ? "Abierta" : "Cerrada"}
    </Badge>
  );
}

function DiferenciaBadge({ diferencia }: { diferencia: Monto | null }) {
  if (diferencia === null || diferencia === undefined) {
    return (
      <Text fontSize="sm" color="ink.400">
        —
      </Text>
    );
  }

  const numero = Number(diferencia);
  const estado = estadoDiferencia(numero);
  const config = {
    cuadrada: { etiqueta: "Cuadrada", paleta: "success" },
    sobrante: { etiqueta: "Sobrante", paleta: "info" },
    faltante: { etiqueta: "Faltante", paleta: "red" },
  }[estado] as { etiqueta: string; paleta: "success" | "info" | "red" };

  return (
    <Box textAlign="right">
      <Badge colorPalette={config.paleta} variant="subtle">
        {config.etiqueta}
      </Badge>
      <Text
        fontSize="xs"
        mt="1"
        fontWeight="semibold"
        fontVariantNumeric="tabular-nums"
        color={estado === "faltante" ? "red.600" : estado === "sobrante" ? "blue.600" : "green.700"}
      >
        {monto(numero)}
      </Text>
    </Box>
  );
}

/* ─────────────────────────────── Componentes de apoyo ─────────────────────────────── */

function TarjetaResumen({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  color = "brand",
}: {
  icono: typeof Banknote;
  etiqueta: string;
  valor: string;
  detalle: string;
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
          <Stat.ValueText
            fontSize={{ base: "xl", md: "2xl" }}
            fontWeight="bold"
            color="ink.900"
            fontVariantNumeric="tabular-nums"
          >
            {valor}
          </Stat.ValueText>
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

function FilaDato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <Flex justify="space-between" align="center" gap="4" fontSize="sm">
      <Text color="ink.600">{etiqueta}</Text>
      <Box color="ink.900" textAlign="right" fontVariantNumeric="tabular-nums">
        {children}
      </Box>
    </Flex>
  );
}

function DatoUsuario({
  usuario,
  fecha,
}: {
  usuario: { nombre: string; apellido: string } | null;
  fecha: string | null;
}) {
  if (!fecha) {
    return (
      <Text fontSize="xs" color="ink.500">
        En curso
      </Text>
    );
  }

  return (
    <Box>
      <Text fontSize="sm" color="ink.800">
        {formatFechaHora(fecha)}
      </Text>
      {usuario && (
        <Text fontSize="xs" color="ink.500">
          {usuario.nombre} {usuario.apellido}
        </Text>
      )}
    </Box>
  );
}

/* ───────────────────────────────────── Página ───────────────────────────────────── */

export function CajaPage() {
  const { puede } = useAuth();
  const { texto, setTexto, busqueda } = useBusquedaDiferida();

  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<FiltroEstadoCaja>("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const actual = useCajaActual();
  const abrir = useAbrirCaja();
  const cerrar = useCerrarCaja();

  const [dialogoAbrir, setDialogoAbrir] = useState(false);
  const [montoInicial, setMontoInicial] = useState<number | null>(null);
  const [observacionesApertura, setObservacionesApertura] = useState("");
  const [errorApertura, setErrorApertura] = useState<string | null>(null);

  const [dialogoCerrar, setDialogoCerrar] = useState(false);
  const [montoReal, setMontoReal] = useState<number | null>(null);
  const [desglosar, setDesglosar] = useState(false);
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [observacionesCierre, setObservacionesCierre] = useState("");
  const [errorCierre, setErrorCierre] = useState<string | null>(null);

  const filtros = {
    busqueda,
    pagina,
    estado,
    desde: desde || undefined,
    hasta: hasta || undefined,
    ordenarPor: "fecha" as const,
    direccion: "desc" as const,
  };

  const historial = useCajas(filtros);

  const hayFiltros = Boolean(busqueda || desde || hasta);
  const hayBusqueda = hayFiltros || estado !== "todas";

  const sesion = actual.data?.abierta ? actual.data.sesion : null;
  const efectivo = actual.data?.efectivo;
  const otrosMedios = actual.data?.otrosMedios;

  const esperadoCierre = Number(efectivo?.esperado ?? 0);
  const detallesCierre = DENOMINACIONES_PYG.map((denominacion) => ({
    denominacion: denominacion.valor,
    cantidad: Number(cantidades[denominacion.valor] ?? 0) || 0,
    esBillete: denominacion.esBillete,
  })).filter((detalle) => detalle.cantidad > 0);
  const totalDesglose = sumarDetallesArqueo(detallesCierre);
  const contadoCierre = desglosar ? totalDesglose : montoReal;
  const diferenciaCierre =
    contadoCierre === null
      ? null
      : calcularDiferencia(contadoCierre, esperadoCierre);
  const estadoDiferenciaCierre =
    diferenciaCierre === null ? null : estadoDiferencia(diferenciaCierre);

  function refrescar() {
    void actual.refetch();
    void historial.refetch();
  }

  function limpiarFiltros() {
    setTexto("");
    setDesde("");
    setHasta("");
    setEstado("todas");
    setPagina(1);
  }

  function mostrarApertura() {
    abrir.reset();
    setMontoInicial(null);
    setObservacionesApertura("");
    setErrorApertura(null);
    setDialogoAbrir(true);
  }

  function mostrarCierre() {
    cerrar.reset();
    setMontoReal(null);
    setDesglosar(false);
    setCantidades({});
    setObservacionesCierre("");
    setErrorCierre(null);
    setDialogoCerrar(true);
  }

  function confirmarApertura(evento: React.FormEvent) {
    evento.preventDefault();

    if (montoInicial !== null && montoInicial < 0) {
      setErrorApertura("El monto inicial no puede ser negativo.");
      return;
    }

    setErrorApertura(null);

    abrir.mutate(
      {
        ...(montoInicial !== null ? { montoInicial } : {}),
        ...(observacionesApertura.trim()
          ? { observaciones: observacionesApertura.trim() }
          : {}),
      },
      {
        onSuccess: () => {
          setDialogoAbrir(false);
          setPagina(1);
          toaster.success({
            title: "Caja abierta",
            description: "Ya podés registrar ventas, egresos y movimientos.",
          });
        },
      },
    );
  }

  function confirmarCierre(evento: React.FormEvent) {
    evento.preventDefault();

    if (contadoCierre === null) {
      setErrorCierre("Ingresá el monto contado para cerrar la caja.");
      return;
    }

    if (desglosar && totalDesglose <= 0) {
      setErrorCierre("Cargá al menos una denominación del arqueo.");
      return;
    }

    if (
      diferenciaCierre !== null &&
      diferenciaCierre !== 0 &&
      !observacionesCierre.trim()
    ) {
      setErrorCierre(
        "La diferencia del arqueo exige una observación que explique el descuadre.",
      );
      return;
    }

    setErrorCierre(null);

    cerrar.mutate(
      {
        montoReal: contadoCierre,
        ...(desglosar && detallesCierre.length
          ? { detalles: detallesCierre }
          : {}),
        ...(observacionesCierre.trim()
          ? { observaciones: observacionesCierre.trim() }
          : {}),
      },
      {
        onSuccess: (sesionCerrada) => {
          const diferencia = Number(sesionCerrada.diferencia ?? 0);
          setDialogoCerrar(false);
          setPagina(1);
          toaster.success({
            title: "Caja cerrada",
            description:
              diferencia === 0
                ? "El arqueo quedó cuadrado."
                : `Diferencia del arqueo: ${formatMoneda(diferencia)}.`,
          });
        },
      },
    );
  }

  const columnas = useMemo<ColumnDef<CajaSesion, unknown>[]>(
    () => [
      {
        accessorKey: "fechaApertura",
        header: "Apertura",
        cell: ({ row }) => (
          <Box>
            <Text fontSize="sm" color="ink.800">
              {formatFechaHora(row.original.fechaApertura)}
            </Text>
            <Text fontSize="xs" color="ink.500">
              {row.original.usuarioApertura.nombre}{" "}
              {row.original.usuarioApertura.apellido}
            </Text>
          </Box>
        ),
      },
      {
        id: "cierre",
        header: "Cierre",
        cell: ({ row }) => (
          <DatoUsuario
            usuario={row.original.usuarioCierre}
            fecha={row.original.fechaCierre}
          />
        ),
      },
      {
        id: "movimientos",
        header: "Movimientos",
        cell: ({ row }) => {
          const cuenta = row.original._count;
          if (!cuenta) {
            return (
              <Text fontSize="sm" color="ink.400">
                —
              </Text>
            );
          }
          return (
            <Box>
              <Text fontSize="sm" color="ink.800">
                {cuenta.movimientos} movimientos
              </Text>
              <Text fontSize="xs" color="ink.500">
                {cuenta.ventas} ventas · {cuenta.egresos} egresos
              </Text>
            </Box>
          );
        },
      },
      {
        accessorKey: "montoInicial",
        header: "Inicial",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Text fontSize="sm" fontVariantNumeric="tabular-nums">
            {monto(row.original.montoInicial)}
          </Text>
        ),
      },
      {
        accessorKey: "montoEsperado",
        header: "Esperado",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Text fontSize="sm" fontVariantNumeric="tabular-nums">
            {row.original.montoEsperado === null
              ? "—"
              : monto(row.original.montoEsperado)}
          </Text>
        ),
      },
      {
        accessorKey: "montoReal",
        header: "Contado",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Text fontSize="sm" fontVariantNumeric="tabular-nums">
            {row.original.montoReal === null
              ? "—"
              : monto(row.original.montoReal)}
          </Text>
        ),
      },
      {
        id: "diferencia",
        header: "Diferencia",
        meta: { align: "right" },
        cell: ({ row }) => (
          <DiferenciaBadge diferencia={row.original.diferencia} />
        ),
      },
      {
        accessorKey: "estado",
        header: "Estado",
        cell: ({ row }) => <BadgeEstadoCaja estado={row.original.estado} />,
      },
    ],
    [],
  );

  return (
    <Box>
      <PageHeader
        titulo="Caja"
        descripcion="Apertura, movimientos del día y cierre con arqueo."
        migas={["Finanzas", "Caja"]}
        acciones={
          <>
            <Button
              variant="outline"
              onClick={refrescar}
              loading={actual.isFetching || historial.isFetching}
            >
              <RefreshCw size={15} /> Actualizar
            </Button>

            {puede("caja.egresos") && (
              <Button variant="outline" asChild>
                <Link to="/egresos">
                  <CircleDollarSign size={15} /> Egresos
                </Link>
              </Button>
            )}

            {!sesion && puede("caja.abrir") && (
              <Button colorPalette="brand" onClick={mostrarApertura}>
                <LockOpen size={16} /> Abrir caja
              </Button>
            )}

            {sesion && puede("caja.cerrar") && (
              <Button colorPalette="brand" onClick={mostrarCierre}>
                <Lock size={16} /> Cerrar caja
              </Button>
            )}
          </>
        }
      />

      {actual.isLoading ? (
        <Panel mb="6">
          <Stack gap="4" role="status" aria-label="Cargando estado de caja">
            <Skeleton h="8" w="48" borderRadius="md" />
            <Grid
              templateColumns={{ base: "1fr", sm: "1fr 1fr", xl: "repeat(4, 1fr)" }}
              gap="4"
            >
              <Skeleton h="28" borderRadius="xl" />
              <Skeleton h="28" borderRadius="xl" />
              <Skeleton h="28" borderRadius="xl" />
              <Skeleton h="28" borderRadius="xl" />
            </Grid>
          </Stack>
        </Panel>
      ) : actual.error ? (
        <Alert status="error" rounded="md" title="No pudimos cargar la caja" mb="6">
          {mensajeDeError(actual.error)}
        </Alert>
      ) : !actual.data?.abierta || !sesion ? (
        <Panel mb="6">
          <Flex
            direction={{ base: "column", md: "row" }}
            align={{ base: "stretch", md: "center" }}
            justify="space-between"
            gap="5"
          >
            <Flex align="flex-start" gap="4" minW="0">
              <Flex
                align="center"
                justify="center"
                w="12"
                h="12"
                flexShrink={0}
                borderRadius="xl"
                bg="brand.subtle"
                color="brand.600"
              >
                <Lock size={22} />
              </Flex>
              <Box minW="0">
                <Text fontSize="lg" fontWeight="bold" color="ink.900">
                  La caja está cerrada
                </Text>
                <Text fontSize="sm" color="ink.600" mt="1">
                  Abrí la caja para registrar cobros, egresos y movimientos del
                  día. El saldo esperado se calcula desde el libro de caja, no
                  desde las ventas.
                </Text>
              </Box>
            </Flex>

            {puede("caja.abrir") && (
              <Button
                colorPalette="brand"
                flexShrink={0}
                onClick={mostrarApertura}
              >
                <LockOpen size={16} /> Abrir caja
              </Button>
            )}
          </Flex>
        </Panel>
      ) : (
        <Stack gap="5" mb="6">
          <Panel>
            <Flex
              align={{ base: "flex-start", md: "center" }}
              justify="space-between"
              direction={{ base: "column", md: "row" }}
              gap="4"
              mb="5"
            >
              <Flex align="flex-start" gap="4" minW="0">
                <Flex
                  align="center"
                  justify="center"
                  w="12"
                  h="12"
                  flexShrink={0}
                  borderRadius="xl"
                  bg="success.subtle"
                  color="success.600"
                >
                  <LockOpen size={22} />
                </Flex>
                <Box minW="0">
                  <Flex align="center" gap="2" wrap="wrap">
                    <Text fontSize="lg" fontWeight="bold" color="ink.900">
                      Caja abierta
                    </Text>
                    <BadgeEstadoCaja estado="abierta" />
                  </Flex>
                  <Flex
                    align="center"
                    gap="3"
                    wrap="wrap"
                    mt="1"
                    fontSize="xs"
                    color="ink.500"
                  >
                    <Flex align="center" gap="1">
                      <Clock size={13} />
                      {formatFechaHora(sesion.fechaApertura)}
                    </Flex>
                    <Flex align="center" gap="1">
                      <UserRound size={13} />
                      {sesion.usuarioApertura.nombre}{" "}
                      {sesion.usuarioApertura.apellido}
                    </Flex>
                  </Flex>
                </Box>
              </Flex>

              <Flex gap="2" wrap="wrap">
                {puede("caja.egresos") && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/egresos">
                      Registrar egreso <ArrowRight size={14} />
                    </Link>
                  </Button>
                )}
                {puede("caja.cerrar") && (
                  <Button
                    colorPalette="brand"
                    size="sm"
                    onClick={mostrarCierre}
                  >
                    <Lock size={15} /> Cerrar caja
                  </Button>
                )}
              </Flex>
            </Flex>

            <Grid
              templateColumns={{
                base: "1fr",
                sm: "1fr 1fr",
                xl: "repeat(4, 1fr)",
              }}
              gap="4"
            >
              <TarjetaResumen
                icono={Banknote}
                etiqueta="Monto inicial"
                valor={monto(sesion.montoInicial)}
                detalle="Fondos con los que abrió la caja"
              />
              <TarjetaResumen
                icono={TrendingUp}
                etiqueta="Ingresos en efectivo"
                valor={monto(efectivo?.ingresos)}
                detalle="Cobros que entraron al cajón"
                color="success"
              />
              <TarjetaResumen
                icono={TrendingDown}
                etiqueta="Egresos en efectivo"
                valor={monto(efectivo?.egresos)}
                detalle="Pagos que salieron del cajón"
                color="orange"
              />
              <TarjetaResumen
                icono={Wallet}
                etiqueta="Saldo esperado"
                valor={monto(efectivo?.esperado)}
                detalle="Inicial + ingresos − egresos"
              />
            </Grid>
          </Panel>

          <Grid templateColumns={{ base: "1fr", lg: "2fr 1fr" }} gap="5">
            <Panel>
              <Flex align="center" gap="2.5" mb="4">
                <Flex
                  align="center"
                  justify="center"
                  w="8"
                  h="8"
                  borderRadius="lg"
                  bg="brand.50"
                  color="brand.600"
                >
                  <Scale size={16} />
                </Flex>
                <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                  Resumen del libro de caja
                </Text>
              </Flex>

              <Stack gap="2.5">
                <FilaDato etiqueta="Monto inicial">
                  {monto(sesion.montoInicial)}
                </FilaDato>
                <FilaDato etiqueta="Ingresos en efectivo">
                  + {monto(efectivo?.ingresos)}
                </FilaDato>
                <FilaDato etiqueta="Egresos en efectivo">
                  − {monto(efectivo?.egresos)}
                </FilaDato>
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
                    Saldo esperado
                  </Text>
                  <Text
                    fontSize="xl"
                    fontWeight="bold"
                    color="brand.700"
                    fontVariantNumeric="tabular-nums"
                  >
                    {monto(efectivo?.esperado)}
                  </Text>
                </Flex>
              </Stack>
            </Panel>

            <Panel>
              <Flex align="center" gap="2.5" mb="2">
                <Flex
                  align="center"
                  justify="center"
                  w="8"
                  h="8"
                  borderRadius="lg"
                  bg="ink.100"
                  color="ink.600"
                >
                  <CircleDollarSign size={16} />
                </Flex>
                <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                  Otros medios
                </Text>
              </Flex>
              <Text fontSize="xs" color="ink.500" mb="4">
                Tarjeta, transferencia y giro. Quedan en el libro, pero no en el
                efectivo contado del cajón.
              </Text>

              <Stack gap="2.5">
                <FilaDato etiqueta="Ingresos">
                  {monto(otrosMedios?.ingresos)}
                </FilaDato>
                <FilaDato etiqueta="Egresos">
                  {monto(otrosMedios?.egresos)}
                </FilaDato>
              </Stack>
            </Panel>
          </Grid>

          {sesion.observaciones && (
            <Alert status="info" rounded="md" title="Observaciones de la sesión">
              <Text whiteSpace="pre-wrap">{sesion.observaciones}</Text>
            </Alert>
          )}
        </Stack>
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
              setEstado(value as FiltroEstadoCaja);
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
                placeholder="Observaciones o usuario…"
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
            disabled={!hayBusqueda}
            visibility={{ base: hayBusqueda ? "visible" : "hidden", lg: "visible" }}
          >
            <X size={15} /> Limpiar
          </Button>
        </Grid>

        <DataTable
          data={historial.data?.items ?? []}
          columns={columnas}
          cargando={historial.isLoading}
          claveFila={(fila) => fila.id}
          hayBusqueda={hayBusqueda}
          vacioTitulo="Todavía no hay sesiones de caja"
          vacioDetalle="Cuando abras la primera caja, vas a ver el historial de aperturas, cierres y arqueos acá."
        />

        {historial.data && (
          <Paginacion
            pagina={historial.data.pagina}
            totalPaginas={historial.data.totalPaginas}
            total={historial.data.total}
            porPagina={CAJA_POR_PAGINA}
            onCambioPagina={setPagina}
            singular="sesión"
            plural="sesiones"
          />
        )}
      </Panel>

      {/* ── Apertura ─────────────────────────────────────────────────── */}
      <FormDialog
        abierto={dialogoAbrir}
        onClose={() => {
          if (!abrir.isPending) {
            setDialogoAbrir(false);
            abrir.reset();
          }
        }}
        titulo="Abrir caja"
        descripcion="Indicá con cuánto efectivo arranca la sesión. Podés dejarlo en cero."
        ancho="md"
        textoConfirmar="Abrir caja"
        guardando={abrir.isPending}
        bloquearCierre={abrir.isPending}
        onConfirmar={() =>
          (
            document.getElementById("caja-apertura-form") as HTMLFormElement | null
          )?.requestSubmit()
        }
      >
        <chakra.form id="caja-apertura-form" onSubmit={confirmarApertura} noValidate>
          <Stack gap="4">
            <Alert status="info" rounded="md" title="Caja en guaraníes">
              La caja opera en PYG. Las transacciones en otra moneda se
              registran con tipo de cambio y se convierten a guaraníes.
            </Alert>

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
                Monto inicial
              </Field.Label>
              <MoneyInput
                value={montoInicial}
                onChange={setMontoInicial}
                placeholder="0"
                helperText="Vuelto o cambio con el que arranca el día."
              />
            </Field.Root>

            <Field.Root>
              <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
                Observaciones
              </Field.Label>
              <Textarea
                value={observacionesApertura}
                onChange={(evento) =>
                  setObservacionesApertura(evento.target.value)
                }
                placeholder="Opcional: turno, novedades del día anterior…"
                rows={3}
                maxLength={500}
              />
            </Field.Root>

            {errorApertura && (
              <Alert status="error" rounded="md">
                {errorApertura}
              </Alert>
            )}

            {abrir.error && (
              <Alert status="error" rounded="md">
                {mensajeDeError(abrir.error)}
              </Alert>
            )}
          </Stack>
        </chakra.form>
      </FormDialog>

      {/* ── Cierre y arqueo ──────────────────────────────────────────── */}
      <FormDialog
        abierto={dialogoCerrar}
        onClose={() => {
          if (!cerrar.isPending) {
            setDialogoCerrar(false);
            cerrar.reset();
          }
        }}
        titulo="Cerrar caja"
        descripcion="Contá el efectivo del cajón. La diferencia la calcula el servidor."
        ancho="lg"
        textoConfirmar="Cerrar caja"
        guardando={cerrar.isPending}
        bloquearCierre={cerrar.isPending}
        onConfirmar={() =>
          (
            document.getElementById("caja-cierre-form") as HTMLFormElement | null
          )?.requestSubmit()
        }
      >
        <chakra.form id="caja-cierre-form" onSubmit={confirmarCierre} noValidate>
          <Stack gap="4">
            <Alert status="warning" rounded="md" title="El cierre es definitivo">
              La sesión se cierra y el arqueo queda inmutable. Si hay faltante o
              sobrante, la observación es obligatoria.
            </Alert>

            <Grid
              templateColumns={{ base: "1fr", sm: "repeat(3, 1fr)" }}
              gap="3"
            >
              <Box
                p="3"
                borderWidth="1px"
                borderColor="ink.200"
                borderRadius="lg"
                bg="ink.50"
              >
                <Text fontSize="xs" color="ink.500">
                  Esperado
                </Text>
                <Text
                  fontSize="lg"
                  fontWeight="bold"
                  color="ink.900"
                  fontVariantNumeric="tabular-nums"
                >
                  {monto(esperadoCierre)}
                </Text>
              </Box>

              <Box
                p="3"
                borderWidth="1px"
                borderColor="ink.200"
                borderRadius="lg"
                bg="ink.50"
              >
                <Text fontSize="xs" color="ink.500">
                  Contado
                </Text>
                <Text
                  fontSize="lg"
                  fontWeight="bold"
                  color="ink.900"
                  fontVariantNumeric="tabular-nums"
                >
                  {contadoCierre === null ? "—" : monto(contadoCierre)}
                </Text>
              </Box>

              <Box
                p="3"
                borderWidth="1px"
                borderColor={
                  estadoDiferenciaCierre === "faltante"
                    ? "red.200"
                    : estadoDiferenciaCierre === "sobrante"
                      ? "blue.200"
                      : "ink.200"
                }
                borderRadius="lg"
                bg={
                  estadoDiferenciaCierre === "faltante"
                    ? "red.50"
                    : estadoDiferenciaCierre === "sobrante"
                      ? "blue.50"
                      : "ink.50"
                }
              >
                <Text fontSize="xs" color="ink.500">
                  Diferencia
                </Text>
                {diferenciaCierre === null ? (
                  <Text fontSize="lg" fontWeight="bold" color="ink.400">
                    —
                  </Text>
                ) : (
                  <Flex align="baseline" gap="2" wrap="wrap">
                    <Text
                      fontSize="lg"
                      fontWeight="bold"
                      fontVariantNumeric="tabular-nums"
                      color={
                        estadoDiferenciaCierre === "faltante"
                          ? "red.700"
                          : estadoDiferenciaCierre === "sobrante"
                            ? "blue.700"
                            : "green.700"
                      }
                    >
                      {monto(diferenciaCierre)}
                    </Text>
                    <Badge
                      colorPalette={
                        estadoDiferenciaCierre === "faltante"
                          ? "red"
                          : estadoDiferenciaCierre === "sobrante"
                            ? "info"
                            : "success"
                      }
                      variant="subtle"
                    >
                      {estadoDiferenciaCierre === "faltante"
                        ? "Faltante"
                        : estadoDiferenciaCierre === "sobrante"
                          ? "Sobrante"
                          : "Cuadrada"}
                    </Badge>
                  </Flex>
                )}
              </Box>
            </Grid>

            <Switch
              checked={desglosar}
              onCheckedChange={(detalle) => setDesglosar(detalle.checked)}
              size="sm"
            >
              Desglosar billetes y monedas
            </Switch>

            {desglosar ? (
              <Box
                borderWidth="1px"
                borderColor="ink.200"
                borderRadius="lg"
                p="3"
              >
                <Stack gap="2">
                  {DENOMINACIONES_PYG.map((denominacion) => {
                    const cantidad = cantidades[denominacion.valor] ?? "";
                    const subtotal =
                      denominacion.valor * (Number(cantidad) || 0);

                    return (
                      <Flex
                        key={denominacion.valor}
                        align="center"
                        gap="2"
                      >
                        <Text
                          flex="1"
                          fontSize="sm"
                          color="ink.700"
                          fontVariantNumeric="tabular-nums"
                        >
                          {formatMoneda(denominacion.valor)}
                        </Text>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          size="sm"
                          w="20"
                          value={cantidad}
                          onChange={(evento) =>
                            setCantidades((previas) => ({
                              ...previas,
                              [denominacion.valor]: evento.target.value,
                            }))
                          }
                          aria-label={`Cantidad de ${formatMoneda(denominacion.valor)}`}
                          placeholder="0"
                        />
                        <Text
                          w="28"
                          textAlign="end"
                          fontSize="sm"
                          fontWeight="medium"
                          color="ink.900"
                          fontVariantNumeric="tabular-nums"
                        >
                          {formatMoneda(subtotal)}
                        </Text>
                      </Flex>
                    );
                  })}

                  <Flex
                    justify="space-between"
                    align="center"
                    pt="2"
                    borderTopWidth="1px"
                    borderColor="ink.200"
                  >
                    <Text fontWeight="bold" color="ink.900">
                      Total arqueado
                    </Text>
                    <Text
                      fontWeight="bold"
                      color="ink.900"
                      fontVariantNumeric="tabular-nums"
                    >
                      {monto(totalDesglose)}
                    </Text>
                  </Flex>
                </Stack>
              </Box>
            ) : (
              <Field.Root>
                <Field.Label
                  fontSize="sm"
                  fontWeight="medium"
                  color="ink.800"
                >
                  Monto contado
                </Field.Label>
                <MoneyInput
                  value={montoReal}
                  onChange={(valor) => {
                    setMontoReal(valor);
                    setErrorCierre(null);
                  }}
                  placeholder="0"
                  helperText="Efectivo que contaste físicamente en el cajón."
                />
              </Field.Root>
            )}

            <Field.Root
              required={
                diferenciaCierre !== null && diferenciaCierre !== 0
              }
              invalid={!!errorCierre}
            >
              <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
                Observaciones
                {diferenciaCierre !== null && diferenciaCierre !== 0 && (
                  <Field.RequiredIndicator />
                )}
              </Field.Label>
              <Textarea
                value={observacionesCierre}
                onChange={(evento) => {
                  setObservacionesCierre(evento.target.value);
                  setErrorCierre(null);
                }}
                placeholder={
                  diferenciaCierre !== null && diferenciaCierre !== 0
                    ? "Explicá el faltante o sobrante del arqueo…"
                    : "Opcional: novedades del cierre…"
                }
                rows={3}
                maxLength={500}
              />
              <Field.HelperText fontSize="xs" color="ink.500">
                Obligatoria cuando la diferencia no es cero.
              </Field.HelperText>
            </Field.Root>

            {errorCierre && (
              <Alert status="error" rounded="md">
                {errorCierre}
              </Alert>
            )}

            {cerrar.error && (
              <Alert status="error" rounded="md">
                {mensajeDeError(cerrar.error)}
              </Alert>
            )}
          </Stack>
        </chakra.form>
      </FormDialog>
    </Box>
  );
}
