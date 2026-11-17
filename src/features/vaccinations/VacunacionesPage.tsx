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
  CalendarClock,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  Pencil,
  Search,
  Syringe,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError } from "@/features/clients/clients.service";
import { urlFotoPaciente } from "@/features/patients/patients.service";
import type { Vacunacion } from "@/types/dominio";
import { VacunacionForm } from "./VacunacionForm";
import { VACUNACIONES_POR_PAGINA, useVacunacionDetalle, useVacunaciones } from "./vaccinations.service";

/* ─────────────────────────────────── Utilidades ─────────────────────────────────── */

const ES_IMAGEN = /\.(?:jpe?g|png|webp|gif|avif|bmp)$/i;

function fecha(fechaISO: string | null, conHora = false) {
  if (!fechaISO) return "Sin programar";
  const fechaLocal = new Date(fechaISO);
  if (Number.isNaN(fechaLocal.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "medium",
    ...(conHora ? { timeStyle: "short" as const } : {}),
  }).format(fechaLocal);
}

/** Separa día y hora para mostrarlos en dos líneas dentro de la tabla. */
function diaYHora(fechaISO: string) {
  const valor = new Date(fechaISO);
  if (Number.isNaN(valor.getTime())) return { dia: "Fecha inválida", hora: "" };
  return {
    dia: new Intl.DateTimeFormat("es-PY", { dateStyle: "medium" }).format(valor),
    hora: new Intl.DateTimeFormat("es-PY", { timeStyle: "short" }).format(valor),
  };
}

function nombreResponsable(vacunacion: Vacunacion) {
  const cliente = vacunacion.paciente.cliente;
  if (!cliente) return "Responsable sin registrar";
  return (
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ") ||
    cliente.razonSocial ||
    cliente.documento ||
    "Responsable sin registrar"
  );
}

function diasHasta(fechaISO: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(`${fechaISO.slice(0, 10)}T00:00:00`);
  return Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
}

function textoRelativo(dias: number): string {
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias === -1) return "Ayer";
  return dias > 0 ? `En ${dias} días` : `Hace ${Math.abs(dias)} días`;
}

type ColorEstado = "error" | "warning" | "info" | "gray";

interface EstadoDosis {
  etiqueta: string | null;
  color: ColorEstado;
  relativo: string;
  dias: number;
}

function estadoProximaDosis(vacunacion: Vacunacion): EstadoDosis | null {
  if (!vacunacion.fechaProxima) return null;
  const dias = diasHasta(vacunacion.fechaProxima);
  const relativo = textoRelativo(dias);
  if (dias < 0) return { etiqueta: "Vencida", color: "error", relativo, dias };
  if (dias === 0) return { etiqueta: "Hoy", color: "warning", relativo, dias };
  if (dias <= 7) return { etiqueta: "Esta semana", color: "info", relativo, dias };
  return { etiqueta: null, color: "gray", relativo, dias };
}

/** Colores de la tarjeta de próxima dosis según su estado. */
const ESTILO_TARJETA_DOSIS: Record<ColorEstado, { bg: string; borde: string; texto: string }> = {
  error: { bg: "red.50", borde: "red.200", texto: "red.800" },
  warning: { bg: "orange.50", borde: "orange.200", texto: "orange.800" },
  info: { bg: "blue.50", borde: "blue.200", texto: "blue.800" },
  gray: { bg: "white", borde: "ink.200", texto: "ink.800" },
};

/* ─────────────────────────────── Componentes de apoyo ─────────────────────────────── */

function AvatarPaciente({ nombre, size = "md" }: { nombre: string; size?: "sm" | "md" | "lg" | "xl" }) {
  return (
    <Avatar.Root size={size} colorPalette="brand" flexShrink={0}>
      <Avatar.Fallback name={nombre} />
    </Avatar.Root>
  );
}

function Tarjeta({ children, ...props }: { children: React.ReactNode } & React.ComponentProps<typeof Box>) {
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

function TituloTarjeta({ icono: Icono, children }: { icono: typeof Syringe; children: React.ReactNode }) {
  return (
    <Flex align="center" gap="2.5" mb="4">
      <Flex align="center" justify="center" w="8" h="8" borderRadius="lg" bg="brand.50" color="brand.600" flexShrink={0}>
        <Icono size={16} />
      </Flex>
      <Text fontSize="sm" fontWeight="semibold" color="ink.900">
        {children}
      </Text>
    </Flex>
  );
}

/** Dato de la ficha. Si no tiene valor, no se muestra (ni siquiera su etiqueta). */
function Dato({ titulo, valor }: { titulo: string; valor: string | null | undefined }) {
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

function BadgeDosis({ estado }: { estado: EstadoDosis | null }) {
  if (!estado?.etiqueta) return null;
  return (
    <Badge colorPalette={estado.color} variant="subtle" size="sm">
      {estado.etiqueta}
    </Badge>
  );
}

function CargandoTabla() {
  return (
    <Stack gap="3" p="5" aria-label="Cargando vacunaciones" role="status">
      {Array.from({ length: 6 }).map((_, i) => (
        <Flex key={i} align="center" gap="4">
          <Skeleton h="10" w="28" borderRadius="md" />
          <Skeleton h="10" w="10" borderRadius="full" />
          <Skeleton h="10" flex="1" borderRadius="md" />
          <Skeleton h="10" w="32" borderRadius="md" display={{ base: "none", md: "block" }} />
        </Flex>
      ))}
    </Stack>
  );
}

function columnasVacunaciones(onVer: (vacunacion: Vacunacion) => void): ColumnDef<Vacunacion>[] {
  return [
    {
      accessorKey: "fechaAplicacion",
      header: "Aplicación",
      cell: ({ row }) => {
        const { dia, hora } = diaYHora(row.original.fechaAplicacion);
        return (
          <Box whiteSpace="nowrap">
            <Text fontSize="sm" fontWeight="medium" color="ink.800">{dia}</Text>
            {hora && <Text fontSize="xs" color="ink.500">{hora}</Text>}
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
            <Text fontWeight="semibold" color="ink.900" truncate>{row.original.paciente.nombre}</Text>
            <Text fontSize="xs" color="ink.500" truncate>
              {row.original.paciente.especie?.nombre ?? "Especie no registrada"} · {nombreResponsable(row.original)}
            </Text>
          </Box>
        </Flex>
      ),
    },
    {
      accessorKey: "nombreVacuna",
      header: "Vacuna y lote",
      cell: ({ row }) => (
        <Flex align="center" gap="2.5" maxW="60">
          <Box minW="0">
            <Text fontSize="sm" fontWeight="medium" color="ink.800" truncate>{row.original.nombreVacuna}</Text>
            <Text fontSize="xs" color="ink.500" truncate>
              {row.original.lote ? `Lote ${row.original.lote}` : "Sin lote registrado"}
            </Text>
          </Box>
          {row.original.certificadoUrl && (
            <Box color="brand.600" flexShrink={0} title="Tiene certificado adjunto" aria-label="Tiene certificado adjunto">
              <FileCheck2 size={16} />
            </Box>
          )}
        </Flex>
      ),
    },
    {
      accessorKey: "fechaProxima",
      header: "Próxima dosis",
      cell: ({ row }) => {
        const estado = estadoProximaDosis(row.original);
        if (!estado) {
          return <Text fontSize="sm" color="ink.400">Sin programar</Text>;
        }
        return (
          <Flex align="center" gap="2.5">
            <Box whiteSpace="nowrap">
              <Text fontSize="sm" fontWeight="medium" color="ink.800">{fecha(row.original.fechaProxima)}</Text>
              <Text fontSize="xs" color="ink.500">{estado.relativo}</Text>
            </Box>
            <BadgeDosis estado={estado} />
          </Flex>
        );
      },
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
          aria-label={`Ver vacunación de ${row.original.paciente.nombre}`}
        >
          Ver ficha <ChevronRight size={15} />
        </Button>
      ),
    },
  ];
}

/* ─────────────────────────────────────── Página ─────────────────────────────────────── */

export function VacunacionesPage() {
  const { puede } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pagina, setPagina] = useState(1);
  const [vacunacionSeleccionadaId, setVacunacionSeleccionadaId] = useState<number | null>(null);
  const [vacunacionEditando, setVacunacionEditando] = useState<Vacunacion | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const { texto, setTexto, busqueda } = useBusquedaDiferida(searchParams.get("busqueda") ?? "");
  const pacienteIdRaw = searchParams.get("pacienteId");
  const pacienteId = pacienteIdRaw && /^\d+$/.test(pacienteIdRaw) ? Number(pacienteIdRaw) : undefined;
  const consulta = useVacunaciones({ busqueda, pagina, pacienteId });
  const detalle = useVacunacionDetalle(vacunacionSeleccionadaId ?? undefined);

  useEffect(() => {
    if (searchParams.get("nuevo") !== "1") return;
    if (puede("vacunaciones.crear")) {
      setVacunacionEditando(null);
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

  useEffect(() => setPagina(1), [busqueda, pacienteId]);

  const columnas = useMemo(
    () => columnasVacunaciones((registro) => setVacunacionSeleccionadaId(registro.id)),
    [],
  );

  function abrirNueva() {
    setVacunacionEditando(null);
    setFormularioAbierto(true);
  }

  function editarDetalle() {
    if (!detalle.data) return;
    setVacunacionEditando(detalle.data);
    setFormularioAbierto(true);
    setVacunacionSeleccionadaId(null);
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

  const total = consulta.data?.total ?? 0;
  const nombrePacienteFiltrado = consulta.data?.items[0]?.paciente.nombre;
  const datosFicha = detalle.data;
  const estadoFicha = datosFicha ? estadoProximaDosis(datosFicha) : null;
  const certificadoEsImagen = datosFicha?.certificadoUrl ? ES_IMAGEN.test(datosFicha.certificadoUrl) : false;

  return (
    <>
      <PageHeader
        titulo={pacienteId ? "Historial de vacunaciones" : "Vacunaciones"}
        descripcion="Registro de vacunas aplicadas, lotes, certificados y próximas dosis."
        migas={["Clínico", "Vacunaciones"]}
        acciones={
          puede("vacunaciones.crear") ? (
            <Button colorPalette="brand" onClick={abrirNueva}>
              <Syringe size={17} /> Registrar vacunación
            </Button>
          ) : undefined
        }
      />

      {/* Filtro activo por paciente (llegó desde su ficha) */}
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
          {nombrePacienteFiltrado && <AvatarPaciente nombre={nombrePacienteFiltrado} size="sm" />}
          <Box flex="1" minW="12rem">
            <Text fontSize="sm" fontWeight="semibold" color="brand.900">
              {nombrePacienteFiltrado
                ? `Historial de ${nombrePacienteFiltrado}`
                : "Historial de un paciente"}
            </Text>
            <Text fontSize="xs" color="brand.800">
              Estás viendo sólo las vacunaciones de este paciente.
            </Text>
          </Box>
          <Button size="xs" variant="outline" colorPalette="brand" onClick={quitarFiltroPaciente}>
            <X size={14} /> Ver todas
          </Button>
        </Flex>
      )}

      <Panel flush>
        <PanelHeader
          titulo="Registro de vacunaciones"
          descripcion={`${total} ${total === 1 ? "vacunación registrada" : "vacunaciones registradas"}`}
          acciones={
            <Box position="relative" w={{ base: "full", md: "20rem" }}>
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
                onChange={(event) => setTexto(event.target.value)}
                placeholder="Buscar paciente, vacuna o lote"
                aria-label="Buscar vacunaciones"
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
          }
        />

        {consulta.isPending ? (
          <CargandoTabla />
        ) : consulta.isError ? (
          <Box p="5">
            <Alert status="error" rounded="md">
              <Flex align="center" justify="space-between" gap="3" wrap="wrap" w="full">
                <Text fontSize="sm">{mensajeDeError(consulta.error)}</Text>
                <Button size="xs" variant="outline" onClick={() => void consulta.refetch()}>
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
              vacioTitulo="No hay vacunaciones"
              vacioDetalle="No hay vacunaciones que coincidan con la búsqueda."
              hayBusqueda={Boolean(busqueda)}
              claveFila={(fila) => fila.id}
            />
            <Paginacion
              pagina={pagina}
              totalPaginas={consulta.data.totalPaginas}
              total={consulta.data.total}
              porPagina={VACUNACIONES_POR_PAGINA}
              onCambioPagina={setPagina}
              singular="vacunación"
              plural="vacunaciones"
            />
          </>
        ) : (
          <EmptyState.Root py="12">
            <EmptyState.Content>
              <EmptyState.Indicator color="brand.600">
                <Syringe />
              </EmptyState.Indicator>
              <VStack textAlign="center" gap="1">
                <EmptyState.Title>
                  {busqueda ? "No encontramos vacunaciones" : "Todavía no hay vacunaciones"}
                </EmptyState.Title>
                <EmptyState.Description maxW="26rem">
                  {busqueda
                    ? "Probá buscar por otro paciente, vacuna o lote."
                    : "Registrá la aplicación de vacunas para llevar el seguimiento sanitario y programar las próximas dosis."}
                </EmptyState.Description>
              </VStack>
              {!busqueda && puede("vacunaciones.crear") && (
                <Button colorPalette="brand" variant="outline" onClick={abrirNueva}>
                  Registrar primera vacunación
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

      <VacunacionForm
        abierto={formularioAbierto}
        vacunacion={vacunacionEditando}
        onClose={() => {
          setFormularioAbierto(false);
          setVacunacionEditando(null);
        }}
        onGuardado={(guardada) => {
          setFormularioAbierto(false);
          setVacunacionEditando(null);
          setVacunacionSeleccionadaId(guardada.id);
          setPagina(1);
        }}
      />

      {/* ── Ficha de vacunación ───────────────────────────────────────────── */}
      <DialogRoot
        open={vacunacionSeleccionadaId !== null}
        onOpenChange={(estado) => {
          if (!estado.open) setVacunacionSeleccionadaId(null);
        }}
        size="cover"
      >
        <DialogContent maxW="46rem" maxH="calc(100dvh - 2rem)" p="0" overflow="hidden" display="flex" flexDirection="column">
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
              <Flex align="center" justify="center" w="11" h="11" flexShrink={0} borderRadius="xl" bg="brand.600" color="white">
                <Syringe size={22} />
              </Flex>
              <Box minW="0">
                <DialogTitle fontSize="lg" fontWeight="bold" color="ink.900" lineHeight="1.25">
                  Ficha de vacunación
                </DialogTitle>
                {datosFicha && (
                  <Text color="ink.600" fontSize="sm" mt="0.5" truncate>
                    {datosFicha.nombreVacuna} · {fecha(datosFicha.fechaAplicacion, true)}
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
            onClick={() => setVacunacionSeleccionadaId(null)}
            aria-label="Cerrar ficha de vacunación"
          >
            <X size={18} />
          </IconButton>

          <DialogBody px={{ base: "4", md: "6" }} py="5" flex="1" minH="0" overflowY="auto" bg="ink.50">
            {detalle.isPending ? (
              <Stack gap="4" role="status" aria-label="Cargando ficha">
                <Skeleton h="24" borderRadius="xl" />
                <Skeleton h="40" borderRadius="xl" />
                <Skeleton h="28" borderRadius="xl" />
              </Stack>
            ) : detalle.isError ? (
              <Alert status="error" rounded="md">{mensajeDeError(detalle.error)}</Alert>
            ) : datosFicha ? (
              <Stack gap="4">
                {/* Paciente */}
                <Tarjeta>
                  <Flex align="center" gap="4" wrap="wrap">
                    <AvatarPaciente nombre={datosFicha.paciente.nombre} size="xl" />
                    <Box flex="1" minW="12rem">
                      <Flex align="center" gap="2" wrap="wrap">
                        <Text fontSize="xl" fontWeight="bold" color="ink.900" lineHeight="1.2">
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
                      {datosFicha.aplicadaPor && (
                        <Text color="ink.500" fontSize="xs" mt="0.5">
                          Aplicó {datosFicha.aplicadaPor.nombre} {datosFicha.aplicadaPor.apellido}
                        </Text>
                      )}
                    </Box>
                  </Flex>
                </Tarjeta>

                {/* Próxima dosis, resaltada según su estado */}
                {datosFicha.fechaProxima && estadoFicha && (
                  <Flex
                    align="center"
                    gap="4"
                    p={{ base: "4", md: "5" }}
                    borderWidth="1px"
                    borderRadius="xl"
                    wrap="wrap"
                    bg={ESTILO_TARJETA_DOSIS[estadoFicha.color].bg}
                    borderColor={ESTILO_TARJETA_DOSIS[estadoFicha.color].borde}
                    color={ESTILO_TARJETA_DOSIS[estadoFicha.color].texto}
                  >
                    <Flex
                      align="center"
                      justify="center"
                      w="11"
                      h="11"
                      borderRadius="xl"
                      bg="whiteAlpha.800"
                      flexShrink={0}
                    >
                      <CalendarClock size={22} />
                    </Flex>
                    <Box flex="1" minW="10rem">
                      <Text fontSize="xs" fontWeight="medium" opacity={0.85}>
                        Próxima dosis
                      </Text>
                      <Text fontSize="lg" fontWeight="bold" lineHeight="1.25">
                        {fecha(datosFicha.fechaProxima)}
                      </Text>
                      <Text fontSize="sm" opacity={0.9}>
                        {estadoFicha.relativo}
                      </Text>
                    </Box>
                    <BadgeDosis estado={estadoFicha} />
                  </Flex>
                )}

                {/* Datos de aplicación (sólo los que existen) */}
                <Tarjeta>
                  <TituloTarjeta icono={CalendarDays}>Datos de aplicación</TituloTarjeta>
                  <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="4">
                    <Dato titulo="Vacuna" valor={datosFicha.nombreVacuna} />
                    <Dato titulo="Fecha y hora de aplicación" valor={fecha(datosFicha.fechaAplicacion, true)} />
                    <Dato titulo="Vía de administración" valor={datosFicha.via} />
                    <Dato titulo="Número de lote" valor={datosFicha.lote} />
                    <Dato
                      titulo="Vencimiento del lote"
                      valor={datosFicha.loteVenceEn ? fecha(datosFicha.loteVenceEn) : null}
                    />
                  </Grid>
                </Tarjeta>

                {/* Certificado */}
                <Tarjeta>
                  <TituloTarjeta icono={FileText}>Certificado</TituloTarjeta>
                  {datosFicha.certificadoUrl ? (
                    certificadoEsImagen ? (
                      <Box>
                        <a
                          href={urlFotoPaciente(datosFicha.certificadoUrl)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Abrir la imagen del certificado en una pestaña nueva"
                        >
                          <chakra.img
                            src={urlFotoPaciente(datosFicha.certificadoUrl)}
                            alt={`Certificado de vacunación de ${datosFicha.paciente.nombre}`}
                            maxW="full"
                            maxH="24rem"
                            mx="auto"
                            objectFit="contain"
                            borderWidth="1px"
                            borderColor="ink.200"
                            borderRadius="lg"
                          />
                        </a>
                        <Flex justify="flex-end" mt="3">
                          <Button asChild size="xs" variant="outline">
                            <a href={urlFotoPaciente(datosFicha.certificadoUrl)} target="_blank" rel="noreferrer">
                              <ExternalLink size={14} /> Abrir en pestaña nueva
                            </a>
                          </Button>
                        </Flex>
                      </Box>
                    ) : (
                      <Flex align="center" gap="3" p="3" borderWidth="1px" borderColor="ink.200" borderRadius="lg" wrap="wrap">
                        <Flex align="center" justify="center" w="10" h="10" borderRadius="md" bg="brand.50" color="brand.600" flexShrink={0}>
                          <FileText size={20} />
                        </Flex>
                        <Box flex="1" minW="10rem">
                          <Text fontSize="sm" fontWeight="semibold" color="ink.900">Certificado en PDF</Text>
                          <Text fontSize="xs" color="ink.600">Se abre en una pestaña nueva.</Text>
                        </Box>
                        <Button asChild size="sm" variant="outline" colorPalette="brand">
                          <a href={urlFotoPaciente(datosFicha.certificadoUrl)} target="_blank" rel="noreferrer">
                            <ExternalLink size={15} /> Abrir certificado
                          </a>
                        </Button>
                      </Flex>
                    )
                  ) : (
                    <Flex align="center" gap="3" color="ink.500">
                      <ImageIcon size={18} />
                      <Text fontSize="sm">No se adjuntó certificado.</Text>
                    </Flex>
                  )}
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
            >
              <Button variant="ghost" onClick={() => setVacunacionSeleccionadaId(null)}>
                Cerrar
              </Button>
              {puede("vacunaciones.crear") && (
                <Button colorPalette="brand" onClick={editarDetalle}>
                  <Pencil size={16} /> Editar vacunación
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </DialogRoot>
    </>
  );
}