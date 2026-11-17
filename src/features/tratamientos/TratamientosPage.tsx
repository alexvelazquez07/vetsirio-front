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
  Skeleton,
  Stack,
  Text,
  VStack,
  chakra,
} from "@chakra-ui/react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Pencil,
  Pill,
  Plus,
  RotateCcw,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";

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
import type { Tratamiento } from "@/types/dominio";
import { TratamientoForm } from "./TratamientoForm";
import {
  TRATAMIENTOS_POR_PAGINA,
  useDesactivarTratamiento,
  useReactivarTratamiento,
  useTratamientoDetalle,
  useTratamientos,
} from "./tratamientos.service";

/* ─────────────────────────────────── Utilidades ─────────────────────────────────── */

function fechaSolo(valor: string | null) {
  if (!valor) return "Sin fecha";
  const fecha = new Date(`${valor.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-PY", { dateStyle: "medium" }).format(fecha);
}

function fechaHora(valor: string | null) {
  if (!valor) return "Sin fecha";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(fecha);
}

function diaYHora(fechaISO: string) {
  const valor = new Date(fechaISO);
  if (Number.isNaN(valor.getTime())) {
    return { dia: "Fecha inválida", hora: "" };
  }
  return {
    dia: new Intl.DateTimeFormat("es-PY", { dateStyle: "medium" }).format(valor),
    hora: new Intl.DateTimeFormat("es-PY", { timeStyle: "short" }).format(valor),
  };
}

function nombreResponsable(tratamiento: Tratamiento) {
  const cliente = tratamiento.paciente.cliente;
  if (!cliente) return "Responsable sin registrar";
  return (
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ") ||
    cliente.razonSocial ||
    cliente.documento ||
    "Responsable sin registrar"
  );
}

function progreso(dosis: Tratamiento["dosis"]) {
  const total = dosis.length;
  const hechas = dosis.filter((item) => item.administrada).length;
  return { total, hechas, pct: total ? Math.round((hechas / total) * 100) : 0 };
}

/* ─────────────────────────────── Componentes de apoyo ─────────────────────────────── */

function AvatarPaciente({
  nombre,
  size = "md",
}: {
  nombre: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  return (
    <Avatar.Root size={size} colorPalette="brand" flexShrink={0}>
      <Avatar.Fallback name={nombre} />
    </Avatar.Root>
  );
}

function Tarjeta({
  children,
  ...props
}: { children: ReactNode } & ComponentProps<typeof Box>) {
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
  icono: typeof Pill;
  children: ReactNode;
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

function CargandoTabla() {
  return (
    <Stack gap="3" p="5" aria-label="Cargando tratamientos" role="status">
      {Array.from({ length: 6 }).map((_, i) => (
        <Flex key={i} align="center" gap="4">
          <Skeleton h="10" w="28" borderRadius="md" />
          <Skeleton h="10" w="10" borderRadius="full" />
          <Skeleton h="10" flex="1" borderRadius="md" />
          <Skeleton
            h="10"
            w="32"
            borderRadius="md"
            display={{ base: "none", md: "block" }}
          />
        </Flex>
      ))}
    </Stack>
  );
}

function columnasTratamientos(
  onVer: (tratamiento: Tratamiento) => void,
): ColumnDef<Tratamiento>[] {
  return [
    {
      accessorKey: "fechaInicio",
      header: "Inicio",
      cell: ({ row }) => {
        const { dia, hora } = diaYHora(row.original.fechaInicio);
        return (
          <Box whiteSpace="nowrap">
            <Text fontSize="sm" fontWeight="medium" color="ink.800">
              {dia}
            </Text>
            {hora && (
              <Text fontSize="xs" color="ink.500">
                {hora}
              </Text>
            )}
          </Box>
        );
      },
    },
    {
      accessorKey: "paciente.nombre",
      header: "Paciente",
      cell: ({ row }) => (
        <Flex align="center" gap="3" minW="44">
          <AvatarPaciente nombre={row.original.paciente.nombre} size="sm" />
          <Box minW="0">
            <Text fontWeight="semibold" color="ink.900" truncate>
              {row.original.paciente.nombre}
            </Text>
            <Text fontSize="xs" color="ink.500" truncate>
              {row.original.paciente.especie?.nombre ?? "Especie no registrada"}{" "}
              · {nombreResponsable(row.original)}
            </Text>
          </Box>
        </Flex>
      ),
    },
    {
      accessorKey: "nombre",
      header: "Tratamiento",
      cell: ({ row }) => {
        const { total, hechas } = progreso(row.original.dosis);
        return (
          <Box minW="0" maxW="60">
            <Flex align="center" gap="2">
              <Text fontSize="sm" fontWeight="medium" color="ink.800" truncate>
                {row.original.nombre}
              </Text>
              {total > 0 && (
                <Badge
                  colorPalette={hechas === total ? "green" : "brand"}
                  variant="subtle"
                  size="sm"
                  flexShrink={0}
                >
                  {hechas}/{total} dosis
                </Badge>
              )}
            </Flex>
            <Text fontSize="xs" color="ink.500" truncate>
              {row.original.descripcion || "Sin descripción"}
            </Text>
          </Box>
        );
      },
    },
    {
      accessorKey: "activo",
      header: "Estado",
      cell: ({ row }) => (
        <Flex direction="column" align="flex-start" gap="1">
          <Badge
            colorPalette={row.original.activo ? "green" : "gray"}
            variant="subtle"
            size="sm"
          >
            {row.original.activo ? "Activo" : "Cerrado"}
          </Badge>
          <Text fontSize="xs" color="ink.500" whiteSpace="nowrap">
            {row.original.fechaFinPrevista
              ? `Fin previsto ${fechaSolo(row.original.fechaFinPrevista)}`
              : "Sin fin previsto"}
          </Text>
        </Flex>
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
          aria-label={`Ver tratamiento de ${row.original.paciente.nombre}`}
        >
          Ver ficha <ChevronRight size={15} />
        </Button>
      ),
    },
  ];
}

/* ─────────────────────────────────────── Página ─────────────────────────────────────── */

export function TratamientosPage() {
  const { puede } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pagina, setPagina] = useState(1);
  const [verCerrados, setVerCerrados] = useState(false);
  const [tratamientoSeleccionadoId, setTratamientoSeleccionadoId] = useState<
    number | null
  >(null);
  const [tratamientoEditando, setTratamientoEditando] =
    useState<Tratamiento | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState<Tratamiento | null>(
    null,
  );

  const { texto, setTexto, busqueda } = useBusquedaDiferida(
    searchParams.get("busqueda") ?? "",
  );
  const pacienteIdRaw = searchParams.get("pacienteId");
  const pacienteId =
    pacienteIdRaw && /^\d+$/.test(pacienteIdRaw)
      ? Number(pacienteIdRaw)
      : undefined;

  const consulta = useTratamientos({
    busqueda,
    pagina,
    pacienteId,
    incluirInactivos: verCerrados,
  });
  const detalle = useTratamientoDetalle(tratamientoSeleccionadoId ?? undefined);
  const desactivar = useDesactivarTratamiento();
  const reactivar = useReactivarTratamiento();

  useEffect(() => {
    if (searchParams.get("nuevo") !== "1") return;
    if (puede("tratamientos.crear")) {
      setTratamientoEditando(null);
      setFormularioAbierto(true);
    }
    setSearchParams(
      (params) => {
        params.delete("nuevo");
        return params;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, puede]);

  useEffect(() => setPagina(1), [busqueda, pacienteId, verCerrados]);

  const columnas = useMemo(
    () =>
      columnasTratamientos((registro) =>
        setTratamientoSeleccionadoId(registro.id),
      ),
    [],
  );

  function abrirNueva() {
    setTratamientoEditando(null);
    setFormularioAbierto(true);
  }

  function editarDetalle() {
    if (!detalle.data) return;
    setTratamientoEditando(detalle.data);
    setFormularioAbierto(true);
    setTratamientoSeleccionadoId(null);
  }

  function quitarFiltroPaciente() {
    setSearchParams(
      (params) => {
        params.delete("pacienteId");
        return params;
      },
      { replace: true },
    );
  }

  async function cerrarTratamiento() {
    if (!confirmarCierre) return;
    try {
      await desactivar.mutateAsync(confirmarCierre.id);
      toaster.success({
        title: "Tratamiento cerrado",
        description: `${confirmarCierre.nombre} quedó marcado como cerrado.`,
      });
      setConfirmarCierre(null);
    } catch (error) {
      toaster.error({
        title: "No se pudo cerrar el tratamiento",
        description: mensajeDeError(error),
      });
    }
  }

  async function reactivarTratamiento() {
    if (!detalle.data) return;
    try {
      await reactivar.mutateAsync(detalle.data.id);
      toaster.success({
        title: "Tratamiento reactivado",
        description: `${detalle.data.nombre} vuelve a estar activo.`,
      });
    } catch (error) {
      toaster.error({
        title: "No se pudo reactivar el tratamiento",
        description: mensajeDeError(error),
      });
    }
  }

  const total = consulta.data?.total ?? 0;
  const nombrePacienteFiltrado = consulta.data?.items[0]?.paciente.nombre;
  const datosFicha = detalle.data;
  const resumenFicha = datosFicha ? progreso(datosFicha.dosis) : null;

  return (
    <>
      <PageHeader
        titulo={pacienteId ? "Tratamientos del paciente" : "Tratamientos"}
        descripcion="Seguimiento de tratamientos, fechas y esquema de dosis."
        migas={["Clínico", "Tratamientos"]}
        acciones={
          puede("tratamientos.crear") ? (
            <Button colorPalette="brand" onClick={abrirNueva}>
              <Plus size={17} /> Nuevo tratamiento
            </Button>
          ) : undefined
        }
      />

      {pacienteId && (
        <Flex
          align="center"
          gap="3"
          wrap="wrap"
          mb="4"
          p="3"
          bg="brand.50"
          borderWidth="1px"
          borderColor="brand.200"
          borderRadius="lg"
        >
          {nombrePacienteFiltrado && (
            <AvatarPaciente nombre={nombrePacienteFiltrado} size="sm" />
          )}
          <Box flex="1" minW="12rem">
            <Text fontSize="sm" fontWeight="semibold" color="brand.900">
              {nombrePacienteFiltrado
                ? `Tratamientos de ${nombrePacienteFiltrado}`
                : "Tratamientos de un paciente"}
            </Text>
            <Text fontSize="xs" color="brand.800">
              Estás viendo sólo los tratamientos de este paciente.
            </Text>
          </Box>
          <Button
            size="xs"
            variant="outline"
            colorPalette="brand"
            onClick={quitarFiltroPaciente}
          >
            <X size={14} /> Ver todos
          </Button>
        </Flex>
      )}

      <Panel flush>
        <PanelHeader
          titulo="Registro de tratamientos"
          descripcion={`${total} ${total === 1 ? "tratamiento registrado" : "tratamientos registrados"}`}
          acciones={
            <Flex align="center" gap="3" wrap="wrap" justify="flex-end">
              <chakra.label
                display="flex"
                alignItems="center"
                gap="2"
                cursor="pointer"
                userSelect="none"
                whiteSpace="nowrap"
              >
                <chakra.input
                  type="checkbox"
                  checked={verCerrados}
                  onChange={(evento) =>
                    setVerCerrados(evento.target.checked)
                  }
                  w="4"
                  h="4"
                />
                <Text fontSize="sm" color="ink.700">
                  Ver cerrados
                </Text>
              </chakra.label>

              <Box position="relative" w={{ base: "full", md: "18rem" }}>
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
                  placeholder="Buscar paciente o tratamiento"
                  aria-label="Buscar tratamientos"
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
              vacioTitulo="No hay tratamientos"
              vacioDetalle="No hay tratamientos que coincidan con la búsqueda."
              hayBusqueda={Boolean(busqueda)}
              claveFila={(fila) => fila.id}
            />
            <Paginacion
              pagina={pagina}
              totalPaginas={consulta.data.totalPaginas}
              total={consulta.data.total}
              porPagina={TRATAMIENTOS_POR_PAGINA}
              onCambioPagina={setPagina}
              singular="tratamiento"
              plural="tratamientos"
            />
          </>
        ) : (
          <EmptyState.Root py="12">
            <EmptyState.Content>
              <EmptyState.Indicator color="brand.600">
                <Stethoscope />
              </EmptyState.Indicator>
              <VStack textAlign="center" gap="1">
                <EmptyState.Title>
                  {busqueda
                    ? "No encontramos tratamientos"
                    : "Todavía no hay tratamientos"}
                </EmptyState.Title>
                <EmptyState.Description maxW="26rem">
                  {busqueda
                    ? "Probá buscar por otro paciente o nombre del tratamiento."
                    : "Registrá los tratamientos indicados para hacer seguimiento de sus dosis y fechas."}
                </EmptyState.Description>
              </VStack>
              {!busqueda && puede("tratamientos.crear") && (
                <Button colorPalette="brand" variant="outline" onClick={abrirNueva}>
                  Crear primer tratamiento
                </Button>
              )}
              {busqueda && (
                <Button variant="outline" onClick={() => setTexto("")}>
                  Borrar búsqueda
                </Button>
              )}
            </EmptyState.Content>
          </EmptyState.Root>
        )}
      </Panel>

      <TratamientoForm
        abierto={formularioAbierto}
        tratamiento={tratamientoEditando}
        onClose={() => {
          setFormularioAbierto(false);
          setTratamientoEditando(null);
        }}
        onGuardado={(guardado) => {
          setFormularioAbierto(false);
          setTratamientoEditando(null);
          setTratamientoSeleccionadoId(guardado.id);
          setPagina(1);
        }}
      />

      {/* ── Ficha de tratamiento ─────────────────────────────────────────── */}
      <DialogRoot
        open={tratamientoSeleccionadoId !== null}
        onOpenChange={(estado) => {
          if (!estado.open) setTratamientoSeleccionadoId(null);
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
                bg="brand.600"
                color="white"
              >
                <Stethoscope size={22} />
              </Flex>
              <Box minW="0">
                <DialogTitle
                  fontSize="lg"
                  fontWeight="bold"
                  color="ink.900"
                  lineHeight="1.25"
                >
                  Ficha de tratamiento
                </DialogTitle>
                {datosFicha && (
                  <Text color="ink.600" fontSize="sm" mt="0.5" truncate>
                    {datosFicha.nombre} · {fechaHora(datosFicha.fechaInicio)}
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
            onClick={() => setTratamientoSeleccionadoId(null)}
            aria-label="Cerrar ficha de tratamiento"
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
                    <AvatarPaciente
                      nombre={datosFicha.paciente.nombre}
                      size="xl"
                    />
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
                      <Text color="ink.500" fontSize="xs" mt="0.5">
                        Indicado por {datosFicha.veterinario.nombre}{" "}
                        {datosFicha.veterinario.apellido}
                      </Text>
                    </Box>
                    <Badge
                      colorPalette={datosFicha.activo ? "green" : "gray"}
                      variant="subtle"
                    >
                      {datosFicha.activo ? "Activo" : "Cerrado"}
                    </Badge>
                  </Flex>
                </Tarjeta>

                <Tarjeta>
                  <TituloTarjeta icono={CalendarDays}>
                    Datos del tratamiento
                  </TituloTarjeta>
                  <Grid
                    templateColumns={{ base: "1fr", sm: "1fr 1fr" }}
                    gap="4"
                  >
                    <Dato titulo="Nombre" valor={datosFicha.nombre} />
                    <Dato
                      titulo="Inicio"
                      valor={fechaHora(datosFicha.fechaInicio)}
                    />
                    <Dato
                      titulo="Fin previsto"
                      valor={
                        datosFicha.fechaFinPrevista
                          ? fechaSolo(datosFicha.fechaFinPrevista)
                          : null
                      }
                    />
                    <Dato
                      titulo="Fin real"
                      valor={
                        datosFicha.fechaFinReal
                          ? fechaSolo(datosFicha.fechaFinReal)
                          : null
                      }
                    />
                    <Dato
                      titulo="Dosis administradas"
                      valor={
                        resumenFicha
                          ? `${resumenFicha.hechas} de ${resumenFicha.total} (${resumenFicha.pct}%)`
                          : null
                      }
                    />
                    <Dato
                      titulo="Descripción"
                      valor={datosFicha.descripcion}
                    />
                  </Grid>
                </Tarjeta>

                <Tarjeta>
                  <TituloTarjeta icono={Pill}>
                    Esquema de dosis
                  </TituloTarjeta>
                  {datosFicha.dosis.length ? (
                    <Stack gap="2.5">
                      {datosFicha.dosis.map((item) => (
                        <Flex
                          key={item.id ?? item.numeroDosis}
                          align="center"
                          gap="3"
                          p="3"
                          borderWidth="1px"
                          borderColor={
                            item.administrada ? "green.200" : "ink.200"
                          }
                          borderRadius="lg"
                          bg={item.administrada ? "green.50" : "white"}
                          wrap="wrap"
                        >
                          <Flex
                            align="center"
                            justify="center"
                            w="9"
                            h="9"
                            flexShrink={0}
                            borderRadius="full"
                            bg={item.administrada ? "green.100" : "brand.50"}
                            color={
                              item.administrada ? "green.700" : "brand.600"
                            }
                          >
                            {item.administrada ? (
                              <CheckCircle2 size={17} />
                            ) : (
                              <Pill size={17} />
                            )}
                          </Flex>
                          <Box flex="1" minW="10rem">
                            <Text
                              fontSize="sm"
                              fontWeight="semibold"
                              color="ink.900"
                            >
                              Dosis {item.numeroDosis} · {Number(item.cantidad)}{" "}
                              {item.unidad}
                            </Text>
                            <Text fontSize="xs" color="ink.600">
                              Programada: {fechaSolo(item.fechaProgramada)}
                            </Text>
                            {item.fechaAplicada && (
                              <Text fontSize="xs" color="ink.600">
                                Aplicada: {fechaHora(item.fechaAplicada)}
                              </Text>
                            )}
                            {item.observaciones && (
                              <Text fontSize="xs" color="ink.500" mt="1">
                                {item.observaciones}
                              </Text>
                            )}
                          </Box>
                          <Badge
                            colorPalette={
                              item.administrada ? "green" : "orange"
                            }
                            variant="subtle"
                            size="sm"
                          >
                            {item.administrada ? "Administrada" : "Pendiente"}
                          </Badge>
                        </Flex>
                      ))}
                    </Stack>
                  ) : (
                    <Text fontSize="sm" color="ink.500">
                      No se cargaron dosis para este tratamiento.
                    </Text>
                  )}
                </Tarjeta>

                {datosFicha.notas && (
                  <Tarjeta>
                    <TituloTarjeta icono={Pencil}>Notas internas</TituloTarjeta>
                    <Text fontSize="sm" color="ink.800" whiteSpace="pre-wrap">
                      {datosFicha.notas}
                    </Text>
                  </Tarjeta>
                )}
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
                onClick={() => setTratamientoSeleccionadoId(null)}
              >
                Cerrar
              </Button>

              {!datosFicha.activo && puede("tratamientos.editar") && (
                <Button
                  variant="outline"
                  colorPalette="brand"
                  onClick={() => void reactivarTratamiento()}
                  loading={reactivar.isPending}
                >
                  <RotateCcw size={16} /> Reactivar
                </Button>
              )}

              {datosFicha.activo && puede("tratamientos.eliminar") && (
                <Button
                  variant="outline"
                  colorPalette="red"
                  onClick={() => setConfirmarCierre(datosFicha)}
                >
                  Cerrar tratamiento
                </Button>
              )}

              {puede("tratamientos.editar") && (
                <Button colorPalette="brand" onClick={editarDetalle}>
                  <Pencil size={16} /> Editar tratamiento
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </DialogRoot>

      {/* ── Confirmación de cierre ───────────────────────────────────────── */}
      <DialogRoot
        open={confirmarCierre !== null}
        onOpenChange={(estado) => {
          if (!estado.open && !desactivar.isPending) setConfirmarCierre(null);
        }}
        size="cover"
      >
        <DialogContent maxW="30rem" p="0" overflow="hidden">
          <DialogHeader px="6" pt="5" pb="4" pr="14">
            <DialogTitle fontSize="lg" fontWeight="bold" color="ink.900">
              Cerrar tratamiento
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
            onClick={() => setConfirmarCierre(null)}
            disabled={desactivar.isPending}
            aria-label="Cerrar confirmación"
          >
            <X size={18} />
          </IconButton>

          <DialogBody px="6" py="4">
            <Text fontSize="sm" color="ink.700">
              ¿Querés cerrar el tratamiento{" "}
              <Text as="span" fontWeight="semibold">
                {confirmarCierre?.nombre}
              </Text>
              ? Dejará de aparecer en el registro activo y podrá reactivarse
              más adelante.
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
              onClick={() => setConfirmarCierre(null)}
              disabled={desactivar.isPending}
            >
              Cancelar
            </Button>
            <Button
              colorPalette="red"
              onClick={() => void cerrarTratamiento()}
              loading={desactivar.isPending}
              loadingText="Cerrando…"
            >
              Cerrar tratamiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
}
