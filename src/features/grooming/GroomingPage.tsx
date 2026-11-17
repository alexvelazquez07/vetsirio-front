import {
  Avatar,
  Badge,
  Box,
  Button,
  EmptyState,
  Flex,
  Grid,
  IconButton,
  Input,
  NativeSelect,
  Skeleton,
  Stack,
  Text,
  VStack,
  chakra,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  Banknote,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Pencil,
  Play,
  Plus,
  Scissors,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/data/DataTable";
import { Paginacion, useBusquedaDiferida } from "@/components/data/Paginacion";
import { PageHeader, Panel, PanelHeader } from "@/components/layout/PageHeader";
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
import { urlDeArchivo } from "@/services/api";
import type {
  EstadoGrooming,
  GroomingSesion,
} from "@/types/dominio";
import { GroomingForm } from "./GroomingForm";
import {
  ESTADOS_GROOMING,
  GROOMING_POR_PAGINA,
  colorEstadoGrooming,
  etiquetaEstadoGrooming,
  useCambiarEstadoGrooming,
  useGroomingDetalle,
  useGroomingResumen,
  useGroomingSesiones,
  usePeluquerosGrooming,
} from "./grooming.service";

/* ─────────────────────────────────── Utilidades ─────────────────────────────────── */

type Periodo = "todas" | "hoy" | "semana" | "mes";

function rangoPeriodo(periodo: Periodo): { desde?: string; hasta?: string } {
  if (periodo === "todas") return {};

  const ahora = new Date();
  const hasta = ahora.toISOString();
  const desde = new Date(ahora);

  if (periodo === "hoy") {
    desde.setHours(0, 0, 0, 0);
  } else if (periodo === "semana") {
    const dia = desde.getDay();
    const diasDesdeLunes = dia === 0 ? 6 : dia - 1;
    desde.setDate(desde.getDate() - diasDesdeLunes);
    desde.setHours(0, 0, 0, 0);
  } else {
    desde.setDate(1);
    desde.setHours(0, 0, 0, 0);
  }

  return { desde: desde.toISOString(), hasta };
}

function fechaHora(valor: string) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(fecha);
}

function diaYHora(valor: string) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    return { dia: "Fecha inválida", hora: "" };
  }
  return {
    dia: new Intl.DateTimeFormat("es-PY", { dateStyle: "medium" }).format(fecha),
    hora: new Intl.DateTimeFormat("es-PY", { timeStyle: "short" }).format(fecha),
  };
}

function duracion(sesion: GroomingSesion) {
  if (!sesion.fechaFin) return null;
  const inicio = new Date(sesion.fechaInicio).getTime();
  const fin = new Date(sesion.fechaFin).getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fin) || fin <= inicio) return null;
  const minutos = Math.round((fin - inicio) / 60_000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

const formatoMoneda = new Intl.NumberFormat("es-PY", {
  style: "currency",
  currency: "PYG",
  maximumFractionDigits: 0,
});

function precio(valor: string | number) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? formatoMoneda.format(numero) : "—";
}

function nombreResponsable(sesion: GroomingSesion) {
  const cliente = sesion.paciente.cliente;
  if (!cliente) return "Responsable sin registrar";
  return (
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ") ||
    cliente.razonSocial ||
    cliente.documento ||
    "Responsable sin registrar"
  );
}

function nombrePeluquero(sesion: GroomingSesion) {
  return sesion.peluquero
    ? `${sesion.peluquero.nombre} ${sesion.peluquero.apellido}`
    : "Sin peluquero asignado";
}

const HORA = new Intl.DateTimeFormat("es-PY", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function horaCita(valor: string) {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? "—" : HORA.format(fecha);
}

function mensajeEstadoCita(estado: string) {
  const etiquetas: Record<string, string> = {
    pendiente: "Pendiente",
    confirmada: "Confirmada",
    en_curso: "En curso",
    atendida: "Atendida",
    cancelada: "Cancelada",
    no_asistio: "No asistió",
  };
  return etiquetas[estado] ?? estado;
}

/* ─────────────────────────────── Componentes de apoyo ─────────────────────────────── */

function AvatarPaciente({ nombre }: { nombre: string }) {
  return (
    <Avatar.Root size="sm" colorPalette="brand" flexShrink={0}>
      <Avatar.Fallback name={nombre} />
    </Avatar.Root>
  );
}

function TarjetaResumen({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  color = "brand",
  cargando,
}: {
  icono: typeof Scissors;
  etiqueta: string;
  valor: string;
  detalle: string;
  color?: string;
  cargando?: boolean;
}) {
  return (
    <Flex
      align="center"
      gap="3.5"
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
      p={{ base: "3.5", md: "4" }}
    >
      <Flex
        align="center"
        justify="center"
        w="11"
        h="11"
        flexShrink={0}
        borderRadius="xl"
        bg={`${color}.50`}
        color={`${color}.600`}
      >
        <Icono size={20} />
      </Flex>
      <Box minW="0">
        <Text fontSize="xs" fontWeight="medium" color="ink.500" truncate>
          {etiqueta}
        </Text>
        {cargando ? (
          <Skeleton h="6" w="16" mt="1" borderRadius="sm" />
        ) : (
          <Text fontSize="xl" fontWeight="bold" color="ink.900" lineHeight="1.2">
            {valor}
          </Text>
        )}
        <Text fontSize="2xs" color="ink.500" mt="0.5" truncate>
          {detalle}
        </Text>
      </Box>
    </Flex>
  );
}

function Tarjeta({
  children,
  ...props
}: { children: React.ReactNode } & React.ComponentProps<typeof Box>) {
  return (
    <Box
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
      p={{ base: "4", md: "5" }}
      {...props}
    >
      {children}
    </Box>
  );
}

function TituloTarjeta({
  icono: Icono,
  children,
}: {
  icono: typeof Scissors;
  children: React.ReactNode;
}) {
  return (
    <Flex align="center" gap="2.5" mb="4">
      <Flex
        align="center"
        justify="center"
        w="8"
        h="8"
        borderRadius="lg"
        bg="brand.50"
        color="brand.600"
        flexShrink={0}
      >
        <Icono size={16} />
      </Flex>
      <Text fontSize="sm" fontWeight="semibold" color="ink.900">
        {children}
      </Text>
    </Flex>
  );
}

function Dato({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string | null | undefined;
}) {
  if (!valor || !valor.trim()) return null;
  return (
    <Box minW="0">
      <Text fontSize="xs" fontWeight="medium" color="ink.500">
        {titulo}
      </Text>
      <Text fontSize="sm" fontWeight="medium" color="ink.900" mt="0.5">
        {valor}
      </Text>
    </Box>
  );
}

function EstadoBadge({ estado }: { estado: EstadoGrooming }) {
  return (
    <Badge
      colorPalette={colorEstadoGrooming(estado)}
      variant="subtle"
      size="sm"
      whiteSpace="nowrap"
    >
      {etiquetaEstadoGrooming(estado)}
    </Badge>
  );
}

function CargandoTabla() {
  return (
    <Stack gap="3" p="5" aria-label="Cargando sesiones" role="status">
      {Array.from({ length: 6 }).map((_, indice) => (
        <Flex key={indice} align="center" gap="4">
          <Skeleton h="10" w="28" borderRadius="md" />
          <Skeleton h="10" w="10" borderRadius="full" />
          <Skeleton h="10" flex="1" borderRadius="md" />
          <Skeleton
            h="10"
            w="24"
            borderRadius="md"
            display={{ base: "none", md: "block" }}
          />
        </Flex>
      ))}
    </Stack>
  );
}

function columnasGrooming(
  onVer: (sesion: GroomingSesion) => void,
): ColumnDef<GroomingSesion>[] {
  return [
    {
      accessorKey: "fechaInicio",
      header: "Fecha",
      cell: ({ row }) => {
        const { dia, hora } = diaYHora(row.original.fechaInicio);
        return (
          <Box whiteSpace="nowrap">
            <Text fontSize="sm" fontWeight="medium" color="ink.800">
              {dia}
            </Text>
            <Text fontSize="xs" color="ink.500">
              {hora}
              {duracion(row.original) ? ` · ${duracion(row.original)}` : ""}
            </Text>
          </Box>
        );
      },
    },
    {
      id: "paciente",
      header: "Paciente",
      cell: ({ row }) => (
        <Flex align="center" gap="3" minW="44">
          <AvatarPaciente nombre={row.original.paciente.nombre} />
          <Box minW="0">
            <Text fontWeight="semibold" color="ink.900" truncate>
              {row.original.paciente.nombre}
            </Text>
            <Text fontSize="xs" color="ink.500" truncate>
              {row.original.paciente.especie?.nombre ??
                "Especie no registrada"}{" "}
              · {nombreResponsable(row.original)}
            </Text>
          </Box>
        </Flex>
      ),
    },
    {
      id: "servicio",
      header: "Servicio",
      cell: ({ row }) => (
        <Box minW="0" maxW="56">
          <Flex align="center" gap="2" wrap="wrap">
            <Text fontSize="sm" fontWeight="medium" color="ink.800" truncate>
              {row.original.tipoServicio || "Servicio sin detallar"}
            </Text>
            {row.original.cita && (
              <Badge colorPalette="purple" variant="subtle" size="xs">
                En agenda
              </Badge>
            )}
          </Flex>
          <Text fontSize="xs" color="ink.500" truncate>
            {nombrePeluquero(row.original)}
          </Text>
        </Box>
      ),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => <EstadoBadge estado={row.original.estado} />,
    },
    {
      accessorKey: "precio",
      header: "Precio",
      meta: { align: "right" },
      cell: ({ row }) => (
        <Text fontSize="sm" fontWeight="semibold" color="ink.900" whiteSpace="nowrap">
          {precio(row.original.precio)}
        </Text>
      ),
    },
    {
      id: "detalle",
      header: "",
      cell: ({ row }) => (
        <Button
          size="xs"
          variant="ghost"
          colorPalette="brand"
          onClick={() => onVer(row.original)}
          aria-label={`Ver sesión de ${row.original.paciente.nombre}`}
        >
          Ver ficha <ChevronRight size={15} />
        </Button>
      ),
    },
  ];
}

/* ─────────────────────────────────────── Página ─────────────────────────────────────── */

export function GroomingPage() {
  const { puede } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<EstadoGrooming | "">("");
  const [peluqueroId, setPeluqueroId] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("todas");
  const [sesionSeleccionadaId, setSesionSeleccionadaId] = useState<
    number | null
  >(null);
  const [sesionEditando, setSesionEditando] = useState<GroomingSesion | null>(
    null,
  );
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [confirmarCancelacion, setConfirmarCancelacion] =
    useState<GroomingSesion | null>(null);

  const { texto, setTexto, busqueda } = useBusquedaDiferida("");
  const rango = useMemo(() => rangoPeriodo(periodo), [periodo]);

  const consulta = useGroomingSesiones({
    busqueda,
    pagina,
    estado: estado || undefined,
    peluqueroId: peluqueroId ? Number(peluqueroId) : undefined,
    desde: rango.desde,
    hasta: rango.hasta,
  });
  const resumen = useGroomingResumen();
  const peluqueros = usePeluquerosGrooming();
  const detalle = useGroomingDetalle(sesionSeleccionadaId ?? undefined);
  const cambiarEstado = useCambiarEstadoGrooming();

  useEffect(
    () => setPagina(1),
    [busqueda, estado, peluqueroId, periodo],
  );

  const columnas = useMemo(
    () =>
      columnasGrooming((registro) => setSesionSeleccionadaId(registro.id)),
    [],
  );

  function abrirNueva() {
    setSesionEditando(null);
    setFormularioAbierto(true);
  }

  function editarDetalle() {
    if (!detalle.data) return;
    setSesionEditando(detalle.data);
    setFormularioAbierto(true);
    setSesionSeleccionadaId(null);
  }

  async function cambiarEstadoSesion(
    sesion: GroomingSesion,
    nuevo: EstadoGrooming,
  ) {
    try {
      await cambiarEstado.mutateAsync({ id: sesion.id, estado: nuevo });
      toaster.success({
        title: "Estado actualizado",
        description: `${sesion.paciente.nombre} · ${etiquetaEstadoGrooming(nuevo)}.`,
      });
      setConfirmarCancelacion(null);
    } catch (error) {
      toaster.error({
        title: "No se pudo cambiar el estado",
        description: mensajeDeError(error),
      });
    }
  }

  const datosFicha = detalle.data;
  const resumenDatos = resumen.data;
  const filtrosActivos = Boolean(busqueda || estado || peluqueroId) ||
    periodo !== "todas";

  return (
    <>
      <PageHeader
        titulo="Grooming"
        descripcion="Sesiones de peluquería, servicios y seguimiento visual."
        migas={["Clínico", "Grooming"]}
        acciones={
          puede("grooming.crear") ? (
            <Button colorPalette="brand" onClick={abrirNueva}>
              <Plus size={17} /> Nueva sesión
            </Button>
          ) : undefined
        }
      />

      <Grid
        templateColumns={{
          base: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
        }}
        gap="3"
        mb="5"
      >
        <TarjetaResumen
          icono={Clock}
          etiqueta="Pendientes"
          valor={String(resumenDatos?.pendientes ?? 0)}
          detalle="Esperando atención"
          color="orange"
          cargando={resumen.isPending}
        />
        <TarjetaResumen
          icono={Scissors}
          etiqueta="En proceso"
          valor={String(resumenDatos?.enProceso ?? 0)}
          detalle="Trabajándose ahora"
          color="blue"
          cargando={resumen.isPending}
        />
        <TarjetaResumen
          icono={CheckCircle2}
          etiqueta="Finalizadas hoy"
          valor={String(resumenDatos?.finalizadasHoy ?? 0)}
          detalle="Sesiones completadas"
          color="green"
          cargando={resumen.isPending}
        />
        <TarjetaResumen
          icono={Banknote}
          etiqueta="Ingresos del mes"
          valor={precio(resumenDatos?.ingresosMes ?? 0)}
          detalle="Sesiones finalizadas"
          color="purple"
          cargando={resumen.isPending}
        />
      </Grid>

      <Panel flush>
        <PanelHeader
          titulo="Registro de sesiones"
          descripcion={`${consulta.data?.total ?? 0} ${
            consulta.data?.total === 1
              ? "sesión registrada"
              : "sesiones registradas"
          }`}
          acciones={
            <Flex align="center" gap="2.5" wrap="wrap" justify="flex-end">
              <Box position="relative" w={{ base: "full", md: "16rem" }}>
                <Box
                  position="absolute"
                  left="3"
                  top="50%"
                  transform="translateY(-50%)"
                  color="ink.400"
                  pointerEvents="none"
                  zIndex="1"
                >
                  <Search size={16} />
                </Box>
                <Input
                  value={texto}
                  onChange={(evento) => setTexto(evento.target.value)}
                  placeholder="Buscar paciente o servicio"
                  aria-label="Buscar sesiones de grooming"
                  size="sm"
                  ps="9"
                  pe={texto ? "9" : "3"}
                />
                {texto && (
                  <IconButton
                    type="button"
                    size="2xs"
                    variant="ghost"
                    position="absolute"
                    right="2"
                    top="50%"
                    transform="translateY(-50%)"
                    borderRadius="full"
                    onClick={() => setTexto("")}
                    aria-label="Borrar búsqueda"
                  >
                    <X size={14} />
                  </IconButton>
                )}
              </Box>

              <NativeSelect.Root size="sm" w={{ base: "full", sm: "10rem" }}>
                <NativeSelect.Field
                  value={estado}
                  onChange={(evento) =>
                    setEstado(evento.target.value as EstadoGrooming | "")
                  }
                  aria-label="Filtrar por estado"
                >
                  <option value="">Todos los estados</option>
                  {ESTADOS_GROOMING.map((item) => (
                    <option key={item.valor} value={item.valor}>
                      {item.etiqueta}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>

              <NativeSelect.Root size="sm" w={{ base: "full", sm: "11rem" }}>
                <NativeSelect.Field
                  value={peluqueroId}
                  onChange={(evento) => setPeluqueroId(evento.target.value)}
                  aria-label="Filtrar por peluquero"
                >
                  <option value="">Todos los peluqueros</option>
                  {(peluqueros.data ?? []).map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.nombre} {persona.apellido}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>

              <chakra.select
                value={periodo}
                onChange={(evento) =>
                  setPeriodo(evento.target.value as Periodo)
                }
                aria-label="Filtrar por período"
                h="8"
                px="2.5"
                pr="7"
                borderRadius="md"
                borderWidth="1px"
                borderColor="ink.300"
                bg="white"
                fontSize="sm"
                color="ink.800"
                w={{ base: "full", sm: "9.5rem" }}
              >
                <option value="todas">Todo el historial</option>
                <option value="hoy">Hoy</option>
                <option value="semana">Esta semana</option>
                <option value="mes">Este mes</option>
              </chakra.select>
            </Flex>
          }
        />

        {consulta.isPending ? (
          <CargandoTabla />
        ) : consulta.isError ? (
          <Box p="5">
            <Alert status="error" rounded="md">
              <Flex
                align="center"
                justify="space-between"
                gap="3"
                wrap="wrap"
                w="full"
              >
                <Text fontSize="sm">{mensajeDeError(consulta.error)}</Text>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void consulta.refetch()}
                >
                  Reintentar
                </Button>
              </Flex>
            </Alert>
          </Box>
        ) : consulta.data?.items.length ? (
          <>
            <DataTable
              columns={columnas}
              data={consulta.data.items}
              vacioTitulo="No hay sesiones de grooming"
              vacioDetalle="Cuando registres la primera, aparecerá en esta lista."
              hayBusqueda={filtrosActivos}
              claveFila={(fila) => fila.id}
            />
            <Paginacion
              pagina={pagina}
              totalPaginas={consulta.data.totalPaginas}
              total={consulta.data.total}
              porPagina={GROOMING_POR_PAGINA}
              onCambioPagina={setPagina}
              singular="sesión"
              plural="sesiones"
            />
          </>
        ) : (
          <EmptyState.Root py="12">
            <EmptyState.Content>
              <EmptyState.Indicator color="brand.600">
                <Scissors />
              </EmptyState.Indicator>
              <VStack textAlign="center" gap="1">
                <EmptyState.Title>
                  {filtrosActivos
                    ? "No encontramos sesiones"
                    : "Todavía no hay sesiones"}
                </EmptyState.Title>
                <EmptyState.Description maxW="26rem">
                  {filtrosActivos
                    ? "Probá con otro período, otro estado o borrá la búsqueda."
                    : "Registrá la primera sesión de peluquería para llevar el seguimiento y sincronizarla con la agenda."}
                </EmptyState.Description>
              </VStack>
              {filtrosActivos ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setTexto("");
                    setEstado("");
                    setPeluqueroId("");
                    setPeriodo("todas");
                  }}
                >
                  Quitar filtros
                </Button>
              ) : (
                puede("grooming.crear") && (
                  <Button
                    colorPalette="brand"
                    variant="outline"
                    onClick={abrirNueva}
                  >
                    Registrar primera sesión
                  </Button>
                )
              )}
            </EmptyState.Content>
          </EmptyState.Root>
        )}
      </Panel>

      <GroomingForm
        abierto={formularioAbierto}
        sesion={sesionEditando}
        onClose={() => {
          setFormularioAbierto(false);
          setSesionEditando(null);
        }}
        onGuardado={(guardada) => {
          setFormularioAbierto(false);
          setSesionEditando(null);
          setSesionSeleccionadaId(guardada.id);
          setPagina(1);
        }}
      />

      {/* ── Ficha de la sesión ───────────────────────────────────────────── */}
      <DialogRoot
        open={sesionSeleccionadaId !== null}
        onOpenChange={(valor) => {
          if (!valor.open) setSesionSeleccionadaId(null);
        }}
        size="cover"
      >
        <DialogContent
          maxW="46rem"
          maxH="calc(100dvh - 2rem)"
          p="0"
          overflow="hidden"
          display="flex"
          flexDirection="column"
        >
          <DialogHeader
            px={{ base: "4", md: "6" }}
            py="5"
            pr="16"
            bg="white"
            borderBottomWidth="1px"
            borderColor="ink.200"
            flexShrink="0"
          >
            <Flex align="center" gap="3.5">
              <Flex
                align="center"
                justify="center"
                w="11"
                h="11"
                flexShrink={0}
                borderRadius="xl"
                bg="purple.600"
                color="white"
              >
                <Scissors size={22} />
              </Flex>
              <Box minW="0">
                <DialogTitle
                  fontSize="lg"
                  fontWeight="bold"
                  color="ink.900"
                  lineHeight="1.25"
                >
                  Sesión de grooming
                </DialogTitle>
                {datosFicha && (
                  <Text color="ink.600" fontSize="sm" mt="0.5" truncate>
                    {datosFicha.paciente.nombre} ·{" "}
                    {fechaHora(datosFicha.fechaInicio)}
                  </Text>
                )}
              </Box>
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
            onClick={() => setSesionSeleccionadaId(null)}
            aria-label="Cerrar ficha de sesión"
          >
            <X size={18} />
          </IconButton>

          <DialogBody
            px={{ base: "4", md: "6" }}
            py="5"
            flex="1"
            minH="0"
            overflowY="auto"
            bg="ink.50"
          >
            {detalle.isPending ? (
              <Stack gap="4" role="status" aria-label="Cargando ficha">
                <Skeleton h="24" borderRadius="xl" />
                <Skeleton h="40" borderRadius="xl" />
                <Skeleton h="28" borderRadius="xl" />
              </Stack>
            ) : detalle.isError ? (
              <Alert status="error" rounded="md">
                {mensajeDeError(detalle.error)}
              </Alert>
            ) : datosFicha ? (
              <Stack gap="4">
                <Tarjeta>
                  <Flex align="center" gap="4" wrap="wrap">
                    <AvatarPaciente nombre={datosFicha.paciente.nombre} />
                    <Box flex="1" minW="12rem">
                      <Flex align="center" gap="2" wrap="wrap">
                        <Text
                          fontSize="xl"
                          fontWeight="bold"
                          color="ink.900"
                          lineHeight="1.2"
                        >
                          {datosFicha.paciente.nombre}
                        </Text>
                        {datosFicha.paciente.especie?.nombre && (
                          <Badge colorPalette="brand" variant="subtle">
                            {datosFicha.paciente.especie.nombre}
                          </Badge>
                        )}
                      </Flex>
                      <Text color="ink.600" fontSize="sm" mt="1">
                        Responsable: {nombreResponsable(datosFicha)}
                      </Text>
                    </Box>
                    <EstadoBadge estado={datosFicha.estado} />
                  </Flex>
                </Tarjeta>

                <Tarjeta>
                  <TituloTarjeta icono={Scissors}>
                    Servicio realizado
                  </TituloTarjeta>
                  <Grid
                    templateColumns={{ base: "1fr", sm: "1fr 1fr" }}
                    gap="4"
                  >
                    <Dato
                      titulo="Servicio"
                      valor={datosFicha.tipoServicio || "Sin detallar"}
                    />
                    <Dato
                      titulo="Peluquero"
                      valor={nombrePeluquero(datosFicha)}
                    />
                    <Dato
                      titulo="Inicio"
                      valor={fechaHora(datosFicha.fechaInicio)}
                    />
                    <Dato
                      titulo="Fin"
                      valor={
                        datosFicha.fechaFin
                          ? fechaHora(datosFicha.fechaFin)
                          : null
                      }
                    />
                    <Dato
                      titulo="Duración"
                      valor={duracion(datosFicha)}
                    />
                    <Dato
                      titulo="Precio"
                      valor={precio(datosFicha.precio)}
                    />
                    <Dato
                      titulo="Observaciones"
                      valor={datosFicha.observaciones}
                    />
                  </Grid>
                </Tarjeta>

                <Tarjeta>
                  <TituloTarjeta icono={CalendarDays}>
                    Vínculo con la agenda
                  </TituloTarjeta>
                  {datosFicha.cita ? (
                    <Flex
                      align="center"
                      gap="3"
                      p="3"
                      borderWidth="1px"
                      borderColor="purple.200"
                      bg="purple.50"
                      borderRadius="lg"
                      wrap="wrap"
                    >
                      <Flex
                        align="center"
                        justify="center"
                        w="9"
                        h="9"
                        flexShrink={0}
                        borderRadius="lg"
                        bg="purple.100"
                        color="purple.700"
                      >
                        <CalendarDays size={17} />
                      </Flex>
                      <Box flex="1" minW="10rem">
                        <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                          Cita #{datosFicha.cita.id} ·{" "}
                          {mensajeEstadoCita(datosFicha.cita.estado)}
                        </Text>
                        <Text fontSize="xs" color="ink.600">
                          {horaCita(datosFicha.cita.fechaInicio)} a{" "}
                          {horaCita(datosFicha.cita.fechaFin)} ·{" "}
                          {datosFicha.cita.motivo}
                        </Text>
                      </Box>
                    </Flex>
                  ) : (
                    <Text fontSize="sm" color="ink.500">
                      Esta sesión todavía no tiene una cita vinculada. Se creará
                      automáticamente al guardar.
                    </Text>
                  )}
                </Tarjeta>

                <Tarjeta>
                  <TituloTarjeta icono={Search}>
                    Antes y después
                  </TituloTarjeta>
                  <Grid
                    templateColumns={{
                      base: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                    }}
                    gap="4"
                  >
                    <FotoSesion
                      titulo="Antes"
                      url={datosFicha.fotoAntesUrl}
                    />
                    <FotoSesion
                      titulo="Después"
                      url={datosFicha.fotoDespuesUrl}
                    />
                  </Grid>
                </Tarjeta>
              </Stack>
            ) : null}
          </DialogBody>

          {datosFicha && (
            <DialogFooter
              px={{ base: "4", md: "6" }}
              py="4"
              borderTopWidth="1px"
              borderColor="ink.200"
              gap="2"
              bg="white"
              justifyContent="flex-end"
              flexWrap="wrap"
            >
              <Button
                variant="ghost"
                onClick={() => setSesionSeleccionadaId(null)}
              >
                Cerrar
              </Button>

              {puede("grooming.editar") &&
                !["finalizada", "cancelada"].includes(datosFicha.estado) && (
                  <>
                    <Button
                      variant="outline"
                      colorPalette="red"
                      onClick={() => setConfirmarCancelacion(datosFicha)}
                    >
                      <Ban size={16} /> Cancelar sesión
                    </Button>

                    {datosFicha.estado === "pendiente" ? (
                      <Button
                        variant="outline"
                        colorPalette="blue"
                        loading={cambiarEstado.isPending}
                        onClick={() =>
                          void cambiarEstadoSesion(datosFicha, "en_proceso")
                        }
                      >
                        <Play size={16} /> Iniciar atención
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        colorPalette="green"
                        loading={cambiarEstado.isPending}
                        onClick={() =>
                          void cambiarEstadoSesion(datosFicha, "finalizada")
                        }
                      >
                        <Check size={16} /> Finalizar
                      </Button>
                    )}
                  </>
                )}

              {puede("grooming.editar") &&
                !["finalizada", "cancelada"].includes(datosFicha.estado) && (
                  <Button colorPalette="brand" onClick={editarDetalle}>
                    <Pencil size={16} /> Editar sesión
                  </Button>
                )}
            </DialogFooter>
          )}
        </DialogContent>
      </DialogRoot>

      {/* ── Confirmación de cancelación ──────────────────────────────────── */}
      <DialogRoot
        open={confirmarCancelacion !== null}
        onOpenChange={(valor) => {
          if (!valor.open && !cambiarEstado.isPending) {
            setConfirmarCancelacion(null);
          }
        }}
        size="cover"
      >
        <DialogContent maxW="30rem" p="0" overflow="hidden">
          <DialogHeader px="6" pt="5" pb="4" pr="14">
            <DialogTitle fontSize="lg" fontWeight="bold" color="ink.900">
              Cancelar sesión
            </DialogTitle>
          </DialogHeader>

          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            position="absolute"
            top="3"
            right="3"
            borderRadius="full"
            onClick={() => setConfirmarCancelacion(null)}
            disabled={cambiarEstado.isPending}
            aria-label="Cerrar confirmación"
          >
            <X size={18} />
          </IconButton>

          <DialogBody px="6" py="4">
            <Text fontSize="sm" color="ink.700">
              ¿Querés cancelar la sesión de{" "}
              <Text as="span" fontWeight="semibold">
                {confirmarCancelacion?.paciente.nombre}
              </Text>
              ? La cita vinculada en la agenda también quedará cancelada.
            </Text>
          </DialogBody>

          <DialogFooter
            px="6"
            py="4"
            borderTopWidth="1px"
            borderColor="ink.200"
            gap="2"
            bg="ink.50"
          >
            <Button
              variant="ghost"
              onClick={() => setConfirmarCancelacion(null)}
              disabled={cambiarEstado.isPending}
            >
              Volver
            </Button>
            <Button
              colorPalette="red"
              loading={cambiarEstado.isPending}
              loadingText="Cancelando…"
              onClick={() =>
                confirmarCancelacion &&
                void cambiarEstadoSesion(confirmarCancelacion, "cancelada")
              }
            >
              Cancelar sesión
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
}

function FotoSesion({
  titulo,
  url,
}: {
  titulo: string;
  url: string | null;
}) {
  const src = urlDeArchivo(url);

  return (
    <Box>
      <Text fontSize="xs" fontWeight="medium" color="ink.500" mb="1.5">
        {titulo}
      </Text>
      <Flex
        align="center"
        justify="center"
        h="40"
        borderRadius="lg"
        overflow="hidden"
        borderWidth="1px"
        borderColor="ink.200"
        bg="ink.100"
        color="ink.400"
      >
        {src ? (
          <chakra.img
            src={src}
            alt={`Foto ${titulo.toLowerCase()} de la sesión`}
            w="full"
            h="full"
            objectFit="cover"
          />
        ) : (
          <Text fontSize="xs">Sin foto</Text>
        )}
      </Flex>
    </Box>
  );
}
