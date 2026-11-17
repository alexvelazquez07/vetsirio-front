import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Input,
  Select,
  Spinner,
  Text,
  Textarea,
  chakra,
  createListCollection,
} from "@chakra-ui/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Pencil,
  PawPrint,
  Palette,
  Plus,
  RotateCcw,
  Search,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { FormDialog } from "@/components/data/FormDialog";
import { useBusquedaDiferida } from "@/components/data/Paginacion";
import {
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { toaster } from "@/components/ui/toaster";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError } from "@/features/clients/clients.service";
import { formatHora } from "@/lib/formato";
import {
  useActualizarCita,
  useActualizarEstadoCita,
  useActualizarMotivoAgenda,
  useCambiarEstadoMotivoAgenda,
  useCrearMotivoAgenda,
  useMotivosAgenda,
  useBuscarPacientesAgenda,
  useCancelarCita,
  useCitasAgenda,
  useCrearCita,
  useVeterinariosAgenda,
} from "./agenda.service";
import type {
  CitaAgenda,
  DatosCita,
  DatosMotivoCita,
  EstadoCita,
  MotivoCitaAgenda,
  PacienteAgenda,
  VeterinarioAgenda,
} from "./agenda.service";

type VistaAgenda = "dia" | "semana" | "mes";

const ZONA_AGENDA = "America/Asuncion";
const ALTURA_HORA = 68;
const ESTADOS: Record<
  EstadoCita,
  { etiqueta: string; corta: string; tono: string }
> = {
  pendiente: { etiqueta: "Pendiente", corta: "Pend.", tono: "warning" },
  confirmada: { etiqueta: "Confirmada", corta: "Conf.", tono: "success" },
  en_curso: { etiqueta: "En curso", corta: "Curso", tono: "info" },
  atendida: { etiqueta: "Atendida", corta: "Atend.", tono: "brand" },
  cancelada: { etiqueta: "Cancelada", corta: "Cancel.", tono: "danger" },
  no_asistio: { etiqueta: "No asistió", corta: "Inasist.", tono: "gray" },
};

function fechaClave(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ZONA_AGENDA,
  }).formatToParts(fecha);
  const valor = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function fechaDesdeClave(clave: string): Date {
  const [anio, mes, dia] = clave.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia, 12));
}

function sumarDias(fecha: Date, dias: number): Date {
  const resultado = new Date(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

function sumarMeses(fecha: Date, meses: number): Date {
  return new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + meses, 1, 12),
  );
}

function claveDeDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function inicioSemana(fecha: Date): Date {
  const diaSemana = fecha.getUTCDay() || 7;
  return sumarDias(fecha, 1 - diaSemana);
}

function inicioZona(clave: string): string {
  return new Date(`${clave}T00:00:00-03:00`).toISOString();
}

function rangoVista(fecha: Date, vista: VistaAgenda) {
  if (vista === "dia") {
    const desde = fechaClave(fecha);
    return {
      desde: inicioZona(desde),
      hasta: inicioZona(claveDeDia(sumarDias(fechaDesdeClave(desde), 1))),
    };
  }
  if (vista === "semana") {
    const inicio = inicioSemana(fecha);
    return {
      desde: inicioZona(claveDeDia(inicio)),
      hasta: inicioZona(claveDeDia(sumarDias(inicio, 7))),
    };
  }
  const inicio = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1, 12),
  );
  const fin = sumarMeses(inicio, 1);
  return {
    desde: inicioZona(claveDeDia(inicio)),
    hasta: inicioZona(claveDeDia(fin)),
  };
}

function fechaHora(fecha: Date, hora: string): string {
  return new Date(`${fechaClave(fecha)}T${hora}:00-03:00`).toISOString();
}

function etiquetaDia(fecha: Date, opciones: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("es-PY", {
    ...opciones,
    timeZone: ZONA_AGENDA,
  }).format(fecha);
}

function nombreCliente(paciente: PacienteAgenda) {
  const cliente = paciente.cliente;
  if (!cliente) return "Responsable sin registrar";
  return (
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ") ||
    cliente.razonSocial ||
    "Responsable sin registrar"
  );
}

function nombreVeterinario(veterinario: VeterinarioAgenda | null) {
  return veterinario
    ? `${veterinario.nombre} ${veterinario.apellido}`
    : "Sin asignar";
}

function tonoEstado(estado: EstadoCita) {
  return ESTADOS[estado].tono;
}

function InsigniaEstado({
  estado,
  compacta = false,
}: {
  estado: EstadoCita;
  compacta?: boolean;
}) {
  const definicion = ESTADOS[estado];
  return (
    <Badge
      colorPalette={tonoEstado(estado)}
      size="sm"
      variant="subtle"
      flexShrink={0}
      title={definicion.etiqueta}
      aria-label={`Estado: ${definicion.etiqueta}`}
    >
      {compacta ? definicion.corta : definicion.etiqueta}
    </Badge>
  );
}

function colorVeterinario(veterinario: VeterinarioAgenda | null) {
  const color = veterinario?.colorAgenda;
  return color && /^#[\da-f]{6}$/i.test(color) ? color : "#0D9E87";
}

function colorMotivoCita(cita: CitaAgenda) {
  const color = cita.motivoCita?.color;
  return color && /^#[\da-f]{6}$/i.test(color)
    ? color
    : colorVeterinario(cita.veterinario);
}

function nombreMotivoCita(cita: CitaAgenda) {
  return cita.motivoCita?.nombre ?? cita.motivo;
}

function fechaFormateada(valor: string) {
  return etiquetaDia(new Date(valor), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function tituloRango(fecha: Date, vista: VistaAgenda) {
  if (vista === "dia") {
    return etiquetaDia(fecha, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }
  if (vista === "mes") {
    return etiquetaDia(fecha, { month: "long", year: "numeric" });
  }
  const inicio = inicioSemana(fecha);
  const fin = sumarDias(inicio, 6);
  return `${etiquetaDia(inicio, { day: "numeric", month: "short" })} – ${etiquetaDia(fin, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function AgendaPage() {
  const { puede } = useAuth();
  const [hoy] = useState(() => fechaClave(new Date()));
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() =>
    fechaDesdeClave(hoy),
  );
  const [vista, setVista] = useState<VistaAgenda>("semana");
  const [veterinarioFiltro, setVeterinarioFiltro] = useState("");
  const [citaFormulario, setCitaFormulario] = useState<CitaAgenda | null>(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [motivosAbierto, setMotivosAbierto] = useState(false);
  const [fechaHoraInicial, setFechaHoraInicial] = useState("");
  const [citaSeleccionada, setCitaSeleccionada] = useState<CitaAgenda | null>(
    null,
  );
  const { desde, hasta } = useMemo(
    () => rangoVista(fechaSeleccionada, vista),
    [fechaSeleccionada, vista],
  );
  const veterinarioId = veterinarioFiltro
    ? Number(veterinarioFiltro)
    : undefined;
  const consultaCitas = useCitasAgenda(desde, hasta, veterinarioId);
  const consultaVeterinarios = useVeterinariosAgenda();
  const consultaMotivos = useMotivosAgenda();
  const crearCita = useCrearCita();
  const actualizarCita = useActualizarCita();
  const actualizarEstado = useActualizarEstadoCita();
  const cancelarCita = useCancelarCita();
  const citas = consultaCitas.data ?? [];
  const citasActivas = citas.filter((cita) => cita.estado !== "cancelada");
  const citasPendientes = citasActivas.filter(
    (cita) => cita.estado === "pendiente",
  );
  const citasConfirmadas = citasActivas.filter(
    (cita) => cita.estado === "confirmada",
  );

  const collectionVeterinariosFiltro = useMemo(() => {
    return createListCollection({
      items: [
        { label: "Todo el equipo", value: "" },
        ...(consultaVeterinarios.data ?? []).map((v) => ({
          label: nombreVeterinario(v),
          value: String(v.id),
        })),
      ],
    });
  }, [consultaVeterinarios.data]);

  function moverFecha(direccion: number) {
    setFechaSeleccionada((actual) => {
      if (vista === "dia") return sumarDias(actual, direccion);
      if (vista === "semana") return sumarDias(actual, direccion * 7);
      return sumarMeses(actual, direccion);
    });
  }

  function abrirNuevaCita(fecha = fechaSeleccionada, hora = "09:00") {
    setCitaFormulario(null);
    setFechaHoraInicial(fechaHora(fecha, hora));
    setFormularioAbierto(true);
  }

  function abrirEdicion(cita: CitaAgenda) {
    setCitaSeleccionada(null);
    setCitaFormulario(cita);
    setFechaHoraInicial(cita.fechaInicio);
    setFormularioAbierto(true);
  }

  async function guardarCita(datos: DatosCita) {
    try {
      if (citaFormulario) {
        await actualizarCita.mutateAsync({ id: citaFormulario.id, datos });
      } else {
        await crearCita.mutateAsync(datos);
      }
      toaster.success({
        title: citaFormulario ? "Cita actualizada" : "Cita agendada",
        description: `${fechaFormateada(datos.fechaInicio)} · ${formatHora(datos.fechaInicio)}`,
      });
      setFormularioAbierto(false);
    } catch (error) {
      toaster.error({
        title: "No se pudo guardar la cita",
        description: mensajeDeError(error),
      });
    }
  }

  async function cambiarEstado(cita: CitaAgenda, estado: EstadoCita) {
    if (estado === "cancelada") {
      try {
        await cancelarCita.mutateAsync(cita.id);
        toaster.success({ title: "Cita cancelada" });
        setCitaSeleccionada(null);
      } catch (error) {
        toaster.error({
          title: "No se pudo cancelar la cita",
          description: mensajeDeError(error),
        });
      }
      return;
    }

    try {
      await actualizarEstado.mutateAsync({ id: cita.id, estado });
      toaster.success({
        title: "Estado actualizado",
        description: ESTADOS[estado].etiqueta,
      });
      setCitaSeleccionada(null);
    } catch (error) {
      toaster.error({
        title: "No se pudo actualizar el estado",
        description: mensajeDeError(error),
      });
    }
  }

  return (
    <Box>
      <PageHeader
        titulo="Agenda"
        descripcion="Organizá los turnos del equipo y atendé a cada paciente a tiempo."
        acciones={
          <Flex
            gap="2"
            direction={{ base: "column", sm: "row" }}
            w={{ base: "full", md: "auto" }}
          >
            {puede("citas.editar") && (
              <Button
                variant="outline"
                onClick={() => setMotivosAbierto(true)}
                w={{ base: "full", md: "auto" }}
              >
                <Palette size={16} />
                Motivos
              </Button>
            )}
            {puede("citas.crear") && (
              <Button
                colorPalette="brand"
                onClick={() => abrirNuevaCita()}
                w={{ base: "full", md: "auto" }}
              >
                <Plus size={17} />
                Nueva cita
              </Button>
            )}
          </Flex>
        }
      />

      <Grid
        templateColumns={{ base: "1fr", sm: "repeat(3, minmax(0, 1fr))" }}
        gap="3"
        mb="5"
      >
        <Resumen
          etiqueta="Turnos del período"
          valor={String(citasActivas.length)}
          nota={vista === "dia" ? "En el día" : "En la agenda"}
          icono={CalendarDays}
          tono="brand"
        />
        <Resumen
          etiqueta="Pendientes"
          valor={String(citasPendientes.length)}
          nota="Esperando confirmación"
          icono={Clock3}
          tono="warning"
        />
        <Resumen
          etiqueta="Confirmados"
          valor={String(citasConfirmadas.length)}
          nota="Con horario confirmado"
          icono={Check}
          tono="success"
        />
      </Grid>

      <Panel flush>
        <Flex
          align={{ base: "stretch", lg: "center" }}
          justify="space-between"
          gap="4"
          wrap="wrap"
          px={{ base: "4", md: "5" }}
          py="4"
          borderBottomWidth="1px"
          borderColor="ink.200"
        >
          <Flex align="center" gap="3" wrap="wrap">
            <Flex align="center" gap="1">
              <Button
                aria-label="Período anterior"
                size="sm"
                variant="outline"
                onClick={() => moverFecha(-1)}
              >
                <ArrowLeft size={16} />
              </Button>
              <Button
                aria-label="Período siguiente"
                size="sm"
                variant="outline"
                onClick={() => moverFecha(1)}
              >
                <ArrowRight size={16} />
              </Button>
            </Flex>
            <Button
              size="sm"
              variant="ghost"
              colorPalette="brand"
              onClick={() => setFechaSeleccionada(fechaDesdeClave(hoy))}
            >
              Hoy
            </Button>
            <Heading
              as="h2"
              size="md"
              color="ink.900"
              textTransform="capitalize"
            >
              {tituloRango(fechaSeleccionada, vista)}
            </Heading>
          </Flex>

          <Flex
            align="center"
            gap="2"
            direction={{ base: "column", sm: "row" }}
            w={{ base: "full", lg: "auto" }}
          >
            <Flex
              p="1"
              borderRadius="md"
              bg="ink.100"
              role="group"
              aria-label="Vista de agenda"
              w={{ base: "full", sm: "auto" }}
            >
              {(["dia", "semana", "mes"] as const).map((opcion) => (
                <Button
                  key={opcion}
                  size="xs"
                  flex="1"
                  variant={vista === opcion ? "solid" : "ghost"}
                  color={vista === opcion ? undefined : "ink.600"}
                  onClick={() => setVista(opcion)}
                  aria-pressed={vista === opcion}
                >
                  {opcion[0].toUpperCase() + opcion.slice(1)}
                </Button>
              ))}
            </Flex>

            <Select.Root
              collection={collectionVeterinariosFiltro}
              value={veterinarioFiltro ? [veterinarioFiltro] : [""]}
              onValueChange={(e) => setVeterinarioFiltro(e.value[0] ?? "")}
              size="sm"
              width={{ base: "full", sm: "13rem" }}
            >
              <Select.Trigger bg="white" borderColor="ink.200">
                <Select.ValueText placeholder="Todo el equipo" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item item={{ label: "Todo el equipo", value: "" }}>
                  Todo el equipo
                </Select.Item>
                {(consultaVeterinarios.data ?? []).map((veterinario) => (
                  <Select.Item
                    key={veterinario.id}
                    item={{
                      label: nombreVeterinario(veterinario),
                      value: String(veterinario.id),
                    }}
                  >
                    {nombreVeterinario(veterinario)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        </Flex>

        {consultaMotivos.isError ? (
          <Text px="5" py="2" fontSize="xs" color="danger.fg" role="alert">
            No se pudo cargar el catálogo de motivos:{" "}
            {mensajeDeError(consultaMotivos.error)}
          </Text>
        ) : (
          <Flex
            align="center"
            gap="3"
            wrap="wrap"
            px={{ base: "4", md: "5" }}
            py="2.5"
            borderBottomWidth="1px"
            borderColor="ink.100"
            aria-label="Leyenda de motivos"
          >
            <Text fontSize="xs" color="ink.500" fontWeight="semibold">
              Motivos:
            </Text>
            {(consultaMotivos.data ?? [])
              .filter((motivo) => motivo.activo)
              .map((motivo) => (
                <Flex key={motivo.id} align="center" gap="1.5">
                  <Box
                    w="2.5"
                    h="2.5"
                    borderRadius="full"
                    bg={motivo.color}
                    aria-hidden="true"
                  />
                  <Text fontSize="xs" color="ink.600">
                    {motivo.nombre}
                  </Text>
                </Flex>
              ))}
          </Flex>
        )}

        {consultaCitas.isPending ? (
          <Flex justify="center" align="center" minH="20rem" gap="3">
            <Spinner color="brand.500" />
            <Text fontSize="sm" color="ink.500">
              Cargando agenda…
            </Text>
          </Flex>
        ) : consultaCitas.isError ? (
          <Flex
            direction="column"
            align="center"
            justify="center"
            minH="20rem"
            px="6"
          >
            <Text fontWeight="semibold" color="danger.fg">
              No pudimos cargar la agenda
            </Text>
            <Text textAlign="center" color="ink.600" fontSize="sm" mt="1">
              {mensajeDeError(consultaCitas.error)}
            </Text>
            <Button
              mt="4"
              size="sm"
              variant="outline"
              onClick={() => void consultaCitas.refetch()}
            >
              Reintentar
            </Button>
          </Flex>
        ) : vista === "mes" ? (
          <CalendarioMes
            fecha={fechaSeleccionada}
            citas={citas}
            hoy={hoy}
            alSeleccionarDia={(dia) => {
              setFechaSeleccionada(dia);
              setVista("dia");
            }}
            alSeleccionarCita={setCitaSeleccionada}
          />
        ) : (
          <CalendarioTiempo
            fecha={fechaSeleccionada}
            vista={vista}
            citas={citas}
            puedeCrear={puede("citas.crear")}
            alSeleccionarHora={abrirNuevaCita}
            alSeleccionarCita={setCitaSeleccionada}
          />
        )}

        {consultaCitas.isFetching && !consultaCitas.isPending && (
          <Flex
            align="center"
            gap="2"
            px="5"
            py="2"
            borderTopWidth="1px"
            borderColor="ink.100"
            color="ink.500"
          >
            <Spinner size="xs" />
            <Text fontSize="xs">Actualizando agenda…</Text>
          </Flex>
        )}
      </Panel>

      {consultaVeterinarios.isError && (
        <Text mt="3" fontSize="sm" color="danger.fg" role="alert">
          No se pudo cargar el listado del equipo:{" "}
          {mensajeDeError(consultaVeterinarios.error)}
        </Text>
      )}

      <FormDialog
        abierto={formularioAbierto}
        onClose={() => setFormularioAbierto(false)}
        titulo={citaFormulario ? "Editar cita" : "Agendar una cita"}
        descripcion="Completá los datos del paciente y elegí un horario disponible."
        textoConfirmar={citaFormulario ? "Guardar cambios" : "Agendar cita"}
        ancho="lg"
        onConfirmar={() => {
          const form = document.getElementById("agenda-cita-form");
          if (form instanceof HTMLFormElement) form.requestSubmit();
        }}
        confirmarDeshabilitado={
          citaFormulario ? !puede("citas.editar") : !puede("citas.crear")
        }
        guardando={crearCita.isPending || actualizarCita.isPending}
      >
        <FormularioCita
          key={
            formularioAbierto
              ? `${citaFormulario?.id ?? "nuevo"}-${fechaHoraInicial}`
              : "cerrado"
          }
          cita={citaFormulario}
          fechaHoraInicial={fechaHoraInicial}
          hoy={hoy}
          veterinarios={consultaVeterinarios.data ?? []}
          buscandoPaciente={puede("citas.crear") || puede("citas.editar")}
          alGuardar={guardarCita}
          errorDeCargaVeterinarios={
            consultaVeterinarios.isError
              ? mensajeDeError(consultaVeterinarios.error)
              : ""
          }
          motivos={consultaMotivos.data ?? []}
          cargandoMotivos={consultaMotivos.isPending}
          errorDeCargaMotivos={
            consultaMotivos.isError ? mensajeDeError(consultaMotivos.error) : ""
          }
        />
      </FormDialog>

      <AdministrarMotivosDialog
        abierto={motivosAbierto}
        puedeEditar={puede("citas.editar")}
        alCerrar={() => setMotivosAbierto(false)}
      />

      <DetalleCita
        key={citaSeleccionada?.id ?? "sin-cita"}
        cita={citaSeleccionada}
        abierto={citaSeleccionada !== null}
        puedeEditar={puede("citas.editar")}
        puedeCancelar={puede("citas.cancelar")}
        guardando={actualizarEstado.isPending || cancelarCita.isPending}
        alCerrar={() => setCitaSeleccionada(null)}
        alEditar={abrirEdicion}
        alCambiarEstado={(estado) => {
          if (citaSeleccionada) void cambiarEstado(citaSeleccionada, estado);
        }}
      />
    </Box>
  );
}

function Resumen({
  etiqueta,
  valor,
  nota,
  icono: Icono,
  tono,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  icono: typeof CalendarDays;
  tono: "brand" | "warning" | "success";
}) {
  return (
    <Panel padding="4">
      <Flex align="center" justify="space-between" gap="3">
        <Box>
          <Text color="ink.500" fontSize="sm">
            {etiqueta}
          </Text>
          <Flex align="baseline" gap="2" mt="1">
            <Heading size="xl" color="ink.900" lineHeight="1">
              {valor}
            </Heading>
            <Text color="ink.500" fontSize="xs">
              {nota}
            </Text>
          </Flex>
        </Box>
        <Flex
          align="center"
          justify="center"
          w="11"
          h="11"
          borderRadius="lg"
          bg={`${tono}.subtle`}
          color={`${tono}.fg`}
          flexShrink={0}
        >
          <Icono size={20} />
        </Flex>
      </Flex>
    </Panel>
  );
}

function CalendarioTiempo({
  fecha,
  vista,
  citas,
  puedeCrear,
  alSeleccionarHora,
  alSeleccionarCita,
}: {
  fecha: Date;
  vista: Exclude<VistaAgenda, "mes">;
  citas: CitaAgenda[];
  puedeCrear: boolean;
  alSeleccionarHora: (fecha: Date, hora: string) => void;
  alSeleccionarCita: (cita: CitaAgenda) => void;
}) {
  const dias =
    vista === "dia"
      ? [fecha]
      : Array.from({ length: 7 }, (_, indice) =>
          sumarDias(inicioSemana(fecha), indice),
        );
  const horaMinima = Math.min(
    8,
    ...citas.map((cita) => Number(formatHora(cita.fechaInicio).slice(0, 2))),
  );
  const horaMaxima = Math.max(
    18,
    ...citas.map((cita) => Number(formatHora(cita.fechaFin).slice(0, 2))),
  );
  const horas = Array.from(
    {
      length: Math.max(
        1,
        Math.min(23, horaMaxima) - Math.max(0, horaMinima) + 1,
      ),
    },
    (_, indice) => Math.max(0, horaMinima) + indice,
  );
  const citasPorDiaYHora = new Map<string, CitaAgenda[]>();

  for (const cita of citas) {
    const llave = `${fechaClave(new Date(cita.fechaInicio))}-${Number(formatHora(cita.fechaInicio).slice(0, 2))}`;
    const lista = citasPorDiaYHora.get(llave) ?? [];
    lista.push(cita);
    citasPorDiaYHora.set(llave, lista);
  }

  return (
    <Box overflowX="auto" overscrollBehaviorX="contain">
      <Box minW={vista === "semana" ? "970px" : "540px"}>
        <Grid
          templateColumns={`72px repeat(${dias.length}, minmax(0, 1fr))`}
          bg="white"
          borderBottomWidth="1px"
          borderColor="ink.200"
          position="sticky"
          top="0"
          zIndex="1"
        >
          <Box />
          {dias.map((dia) => {
            const seleccionada = fechaClave(dia) === fechaClave(fecha);
            return (
              <Flex
                key={fechaClave(dia)}
                direction="column"
                align="center"
                py="3"
                borderLeftWidth="1px"
                borderColor="ink.100"
                bg={seleccionada && vista === "dia" ? "brand.subtle" : "white"}
              >
                <Text
                  fontSize="xs"
                  fontWeight="semibold"
                  color="ink.500"
                  textTransform="uppercase"
                >
                  {etiquetaDia(dia, { weekday: "short" })}
                </Text>
                <Text fontSize="lg" fontWeight="bold" color="ink.900">
                  {etiquetaDia(dia, { day: "numeric" })}
                </Text>
              </Flex>
            );
          })}
        </Grid>

        {horas.map((hora) => (
          <Grid
            key={hora}
            templateColumns={`72px repeat(${dias.length}, minmax(0, 1fr))`}
            minH={`${ALTURA_HORA}px`}
            borderBottomWidth="1px"
            borderColor="ink.100"
          >
            <Flex justify="center" pt="2" color="ink.500" fontSize="xs">
              {`${String(hora).padStart(2, "0")}:00`}
            </Flex>
            {dias.map((dia) => {
              const llave = `${fechaClave(dia)}-${hora}`;
              const eventos = citasPorDiaYHora.get(llave) ?? [];
              return (
                <Box
                  key={llave}
                  position="relative"
                  p="1"
                  borderLeftWidth="1px"
                  borderColor="ink.100"
                  minW={0}
                  role={puedeCrear ? "button" : undefined}
                  tabIndex={puedeCrear ? 0 : undefined}
                  aria-label={
                    puedeCrear
                      ? `Agendar el ${etiquetaDia(dia, { day: "numeric", month: "long" })} a las ${String(hora).padStart(2, "0")}:00`
                      : undefined
                  }
                  cursor={puedeCrear ? "pointer" : "default"}
                  _hover={puedeCrear ? { bg: "ink.50" } : undefined}
                  onClick={() =>
                    puedeCrear &&
                    eventos.length === 0 &&
                    alSeleccionarHora(
                      dia,
                      `${String(hora).padStart(2, "0")}:00`,
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      puedeCrear &&
                      eventos.length === 0 &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      alSeleccionarHora(
                        dia,
                        `${String(hora).padStart(2, "0")}:00`,
                      );
                    }
                  }}
                >
                  <Flex direction="column" gap="1">
                    {eventos.map((cita) => (
                      <TarjetaCita
                        key={cita.id}
                        cita={cita}
                        compacta={vista === "semana"}
                        onClick={() => alSeleccionarCita(cita)}
                      />
                    ))}
                  </Flex>
                  {puedeCrear && eventos.length === 0 && (
                    <Flex
                      align="center"
                      justify="center"
                      h="full"
                      minH="54px"
                      color="ink.300"
                      opacity="0"
                      transition="opacity 0.15s ease"
                      _groupHover={{ opacity: 1 }}
                      _hover={{ opacity: 1 }}
                      pointerEvents="none"
                    >
                      <Plus size={15} />
                    </Flex>
                  )}
                </Box>
              );
            })}
          </Grid>
        ))}
      </Box>
    </Box>
  );
}

function TarjetaCita({
  cita,
  compacta,
  onClick,
}: {
  cita: CitaAgenda;
  compacta: boolean;
  onClick: () => void;
}) {
  const color = colorMotivoCita(cita);
  return (
    <Box
      as="button"
      w="full"
      textAlign="left"
      borderLeftWidth="3px"
      borderLeftColor={color}
      borderRadius="sm"
      bg={
        cita.estado === "cancelada"
          ? "ink.50"
          : `color-mix(in srgb, ${color} 12%, white)`
      }
      px="2"
      py="1.5"
      color="ink.800"
      opacity={cita.estado === "cancelada" ? 0.65 : 1}
      transition="all 0.12s ease"
      _hover={{ boxShadow: "sm", transform: "translateY(-1px)" }}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={`${formatHora(cita.fechaInicio)} ${cita.paciente.nombre}, ${nombreMotivoCita(cita)}, ${ESTADOS[cita.estado].etiqueta}`}
    >
      <Flex align="center" justify="space-between" gap="1">
        <Text fontSize="xs" fontWeight="bold" flexShrink={0}>
          {formatHora(cita.fechaInicio)}
        </Text>
        <InsigniaEstado estado={cita.estado} compacta={compacta} />
      </Flex>
      <Text fontSize="xs" fontWeight="semibold" truncate mt="0.5">
        {cita.paciente.nombre}
      </Text>
      <Text fontSize="xs" color="ink.600" truncate>
        {nombreMotivoCita(cita)}
      </Text>
      {cita.veterinario && !compacta && (
        <Text fontSize="xs" color="ink.500" truncate>
          {nombreVeterinario(cita.veterinario)}
        </Text>
      )}
    </Box>
  );
}

function CalendarioMes({
  fecha,
  citas,
  hoy,
  alSeleccionarDia,
  alSeleccionarCita,
}: {
  fecha: Date;
  citas: CitaAgenda[];
  hoy: string;
  alSeleccionarDia: (dia: Date) => void;
  alSeleccionarCita: (cita: CitaAgenda) => void;
}) {
  const primerDia = new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1, 12),
  );
  const desplazamiento = primerDia.getUTCDay() || 7;
  const dias = Array.from({ length: 42 }, (_, indice) =>
    sumarDias(primerDia, indice - desplazamiento + 1),
  );
  const diasSemana = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <Box p={{ base: "2", md: "4" }} overflowX="auto">
      <Grid minW="660px" templateColumns="repeat(7, minmax(0, 1fr))">
        {diasSemana.map((dia) => (
          <Text
            key={dia}
            py="2"
            textAlign="center"
            textTransform="uppercase"
            fontSize="xs"
            fontWeight="semibold"
            color="ink.500"
          >
            {dia}
          </Text>
        ))}
        {dias.map((dia) => {
          const delMes = dia.getUTCMonth() === fecha.getUTCMonth();
          const clave = claveDeDia(dia);
          const eventosDia = citas.filter(
            (cita) => fechaClave(new Date(cita.fechaInicio)) === clave,
          );
          const esHoy = clave === hoy;
          return (
            <Box
              key={clave}
              minH={{ base: "5.5rem", md: "7.5rem" }}
              p="1.5"
              borderTopWidth="1px"
              borderLeftWidth="1px"
              borderColor="ink.100"
              bg={delMes ? "white" : "ink.50"}
              opacity={delMes ? 1 : 0.55}
            >
              <Button
                size="xs"
                variant={esHoy ? "solid" : "ghost"}
                color={esHoy ? undefined : "ink.600"}
                minW="7"
                h="7"
                borderRadius="full"
                onClick={() => alSeleccionarDia(dia)}
                aria-label={`Ver agenda del ${etiquetaDia(dia, { day: "numeric", month: "long" })}`}
              >
                {etiquetaDia(dia, { day: "numeric" })}
              </Button>
              <Flex direction="column" gap="1" mt="1">
                {eventosDia.slice(0, 3).map((cita) => (
                  <Box
                    key={cita.id}
                    as="button"
                    w="full"
                    textAlign="left"
                    px="1.5"
                    py="1"
                    borderRadius="sm"
                    borderLeftWidth="2px"
                    borderLeftColor={colorMotivoCita(cita)}
                    bg={`color-mix(in srgb, ${colorMotivoCita(cita)} 12%, white)`}
                    onClick={() => alSeleccionarCita(cita)}
                    _hover={{ bg: "brand.muted" }}
                    aria-label={`${formatHora(cita.fechaInicio)} ${cita.paciente.nombre}, ${nombreMotivoCita(cita)}. Estado: ${ESTADOS[cita.estado].etiqueta}`}
                    title={`${ESTADOS[cita.estado].etiqueta}: ${cita.paciente.nombre}`}
                  >
                    <Flex align="center" justify="space-between" gap="1">
                      <Text fontSize="xs" fontWeight="semibold" truncate>
                        {formatHora(cita.fechaInicio)} · {cita.paciente.nombre}
                      </Text>
                      <InsigniaEstado estado={cita.estado} compacta />
                    </Flex>
                  </Box>
                ))}
                {eventosDia.length > 3 && (
                  <Text fontSize="xs" color="ink.500" px="1">
                    +{eventosDia.length - 3} más
                  </Text>
                )}
              </Flex>
            </Box>
          );
        })}
      </Grid>
    </Box>
  );
}

function FormularioCita({
  cita,
  fechaHoraInicial,
  hoy,
  veterinarios,
  motivos,
  cargandoMotivos,
  buscandoPaciente,
  alGuardar,
  errorDeCargaVeterinarios,
  errorDeCargaMotivos,
}: {
  cita: CitaAgenda | null;
  fechaHoraInicial: string;
  hoy: string;
  veterinarios: VeterinarioAgenda[];
  motivos: MotivoCitaAgenda[];
  cargandoMotivos: boolean;
  buscandoPaciente: boolean;
  alGuardar: (datos: DatosCita) => Promise<void>;
  errorDeCargaVeterinarios: string;
  errorDeCargaMotivos: string;
}) {
  const inicial =
    cita?.fechaInicio ??
    (fechaHoraInicial || fechaHora(fechaDesdeClave(hoy), "09:00"));
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_AGENDA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(inicial));
  const valor = (tipo: string) =>
    local.find((parte) => parte.type === tipo)?.value ?? "";

  const {
    texto: busquedaPaciente,
    setTexto: setBusquedaPaciente,
    busqueda: terminoPaciente,
  } = useBusquedaDiferida();
  const [paciente, setPaciente] = useState<PacienteAgenda | null>(
    cita?.paciente ?? null,
  );
  const [whatsapp, setWhatsapp] = useState(cita?.whatsapp ?? "");
  const [veterinarioId, setVeterinarioId] = useState(
    cita?.veterinarioId ? String(cita.veterinarioId) : "",
  );
  const [motivoCitaId, setMotivoCitaId] = useState(
    cita?.motivoCitaId ? String(cita.motivoCitaId) : "",
  );
  const [fecha, setFecha] = useState(
    `${valor("year")}-${valor("month")}-${valor("day")}`,
  );
  const [hora, setHora] = useState(`${valor("hour")}:${valor("minute")}`);
  const [duracion, setDuracion] = useState(() =>
    cita
      ? String(
          Math.max(
            5,
            Math.round(
              (new Date(cita.fechaFin).getTime() -
                new Date(cita.fechaInicio).getTime()) /
                60_000,
            ),
          ),
        )
      : "30",
  );
  const [notas, setNotas] = useState(cita?.notas ?? "");
  const [errorValidacion, setErrorValidacion] = useState("");
  const [busquedaActiva, setBusquedaActiva] = useState(false);
  const pacientes = useBuscarPacientesAgenda(
    terminoPaciente,
    buscandoPaciente && busquedaActiva,
  );
  const esperandoBusqueda =
    busquedaPaciente.trim().length >= 2 &&
    busquedaPaciente.trim() !== terminoPaciente;

  const collectionDuracion = useMemo(() => {
    const minutosOpts = [15, 30, 45, 60, 90, 120];
    return createListCollection({
      items: minutosOpts.map((m) => ({
        label:
          m < 60 ? `${m} minutos` : `${m / 60} ${m === 60 ? "hora" : "horas"}`,
        value: String(m),
      })),
    });
  }, []);

  const collectionVeterinarios = useMemo(() => {
    return createListCollection({
      items: [
        { label: "Sin asignar", value: "" },
        ...veterinarios.map((v) => ({
          label: `${nombreVeterinario(v)}${v.especialidad ? ` · ${v.especialidad}` : ""}`,
          value: String(v.id),
        })),
      ],
    });
  }, [veterinarios]);

  const collectionMotivos = useMemo(() => {
    const items = motivos
      .filter((item) => item.activo || item.id === cita?.motivoCitaId)
      .map((item) => ({
        label: `${item.nombre}${!item.activo ? " (inactivo)" : ""}`,
        value: String(item.id),
      }));
    return createListCollection({ items });
  }, [motivos, cita?.motivoCitaId]);

  function seleccionarPaciente(seleccionado: PacienteAgenda) {
    setPaciente(seleccionado);
    setWhatsapp(
      seleccionado.cliente?.whatsapp ?? seleccionado.cliente?.telefono ?? "",
    );
    setBusquedaPaciente("");
    setBusquedaActiva(false);
    setErrorValidacion("");
  }

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paciente) {
      setErrorValidacion("Buscá y seleccioná un paciente.");
      return;
    }
    if (!motivoCitaId) {
      setErrorValidacion("Seleccioná un motivo para la cita.");
      return;
    }
    if (!fecha || !hora) {
      setErrorValidacion("Completá la fecha y la hora de la cita.");
      return;
    }

    const inicio = fechaHora(fechaDesdeClave(fecha), hora);
    const fin = new Date(
      new Date(inicio).getTime() + Number(duracion) * 60_000,
    ).toISOString();
    setErrorValidacion("");
    await alGuardar({
      pacienteId: paciente.id,
      motivoCitaId: Number(motivoCitaId),
      whatsapp: whatsapp.trim() || null,
      veterinarioId: veterinarioId ? Number(veterinarioId) : null,
      fechaInicio: inicio,
      fechaFin: fin,
      notas: notas.trim() || null,
    });
  }

  return (
    <chakra.form id="agenda-cita-form" onSubmit={enviar}>
      <Flex direction="column" gap="4">
        <Box>
          <Text fontSize="sm" fontWeight="semibold" mb="1.5">
            Paciente <chakra.span color="danger.fg">*</chakra.span>
          </Text>
          {paciente ? (
            <Flex
              align="center"
              gap="3"
              borderWidth="1px"
              borderColor="brand.muted"
              borderRadius="md"
              bg="brand.subtle"
              p="3"
            >
              <Flex
                align="center"
                justify="center"
                w="9"
                h="9"
                borderRadius="full"
                bg="white"
                color="brand.fg"
              >
                <PawPrint size={17} />
              </Flex>
              <Box minW={0} flex="1">
                <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                  {paciente.nombre}
                  {paciente.especie ? ` · ${paciente.especie.nombre}` : ""}
                </Text>
                <Text fontSize="xs" color="ink.600" truncate>
                  {nombreCliente(paciente)}
                  {whatsapp ? ` · ${whatsapp}` : ""}
                </Text>
              </Box>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  setPaciente(null);
                  setBusquedaActiva(true);
                }}
                aria-label="Cambiar paciente"
              >
                <X size={15} />
              </Button>
            </Flex>
          ) : (
            <Box position="relative">
              <Flex
                align="center"
                gap="2"
                borderWidth="1px"
                borderColor="ink.200"
                borderRadius="md"
                px="3"
                bg="white"
                _focusWithin={{
                  borderColor: "brand.500",
                  boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
                }}
              >
                <Search size={17} color="var(--chakra-colors-ink-400)" />
                <Input
                  value={busquedaPaciente}
                  onFocus={() => setBusquedaActiva(true)}
                  onChange={(event) => setBusquedaPaciente(event.target.value)}
                  placeholder="Buscar por mascota o responsable…"
                  aria-label="Buscar paciente"
                  border="none"
                  outline="none"
                  bg="transparent"
                  _focus={{ border: "none", boxShadow: "none" }}
                  py="2.5"
                  fontSize="sm"
                  w="full"
                />
              </Flex>
              {busquedaActiva && busquedaPaciente.trim().length >= 2 && (
                <Box
                  position="absolute"
                  top="calc(100% + 4px)"
                  left="0"
                  right="0"
                  zIndex="popover"
                  bg="white"
                  borderWidth="1px"
                  borderColor="ink.200"
                  borderRadius="md"
                  boxShadow="lg"
                  overflow="hidden"
                  maxH="15rem"
                  overflowY="auto"
                >
                  {esperandoBusqueda || pacientes.isPending ? (
                    <Flex align="center" gap="2" px="3" py="3">
                      <Spinner size="xs" color="brand.500" />
                      <Text fontSize="sm" color="ink.500">
                        Buscando pacientes…
                      </Text>
                    </Flex>
                  ) : pacientes.isError ? (
                    <Text role="alert" fontSize="sm" color="danger.fg" p="3">
                      No se pudieron buscar pacientes:{" "}
                      {mensajeDeError(pacientes.error)}
                    </Text>
                  ) : pacientes.data?.length ? (
                    pacientes.data.map((resultado) => (
                      <Button
                        key={resultado.id}
                        variant="ghost"
                        justifyContent="flex-start"
                        w="full"
                        h="auto"
                        borderRadius="0"
                        px="3"
                        py="2.5"
                        onClick={() => seleccionarPaciente(resultado)}
                      >
                        <PawPrint size={16} />
                        <Box textAlign="left" minW={0}>
                          <Text fontSize="sm" fontWeight="semibold">
                            {resultado.nombre}
                            {resultado.especie
                              ? ` · ${resultado.especie.nombre}`
                              : ""}
                          </Text>
                          <Text fontSize="xs" color="ink.500" truncate>
                            {nombreCliente(resultado)}
                            {(resultado.cliente?.whatsapp ??
                            resultado.cliente?.telefono)
                              ? ` · ${resultado.cliente.whatsapp ?? resultado.cliente.telefono}`
                              : ""}
                          </Text>
                        </Box>
                      </Button>
                    ))
                  ) : (
                    <Text fontSize="sm" color="ink.500" p="3">
                      No encontramos pacientes con ese nombre.
                    </Text>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>

        <CampoFormulario etiqueta="WhatsApp del contacto">
          <Input
            type="tel"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
            placeholder="Número de WhatsApp"
            maxLength={30}
            autoComplete="tel"
            bg="white"
            borderColor="ink.200"
            size="sm"
          />
        </CampoFormulario>

        <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3">
          <CampoFormulario etiqueta="Fecha" requerido>
            <Input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              min={hoy}
              required
              bg="white"
              borderColor="ink.200"
              size="sm"
            />
          </CampoFormulario>
          <CampoFormulario etiqueta="Hora de inicio" requerido>
            <Input
              type="time"
              value={hora}
              onChange={(event) => setHora(event.target.value)}
              required
              bg="white"
              borderColor="ink.200"
              size="sm"
            />
          </CampoFormulario>
          <CampoFormulario etiqueta="Duración">
            <Select.Root
              collection={collectionDuracion}
              value={[duracion]}
              onValueChange={(e) => setDuracion(e.value[0] ?? "30")}
              size="sm"
            >
              <Select.Trigger bg="white" borderColor="ink.200">
                <Select.ValueText placeholder="Seleccionar duración" />
              </Select.Trigger>
              <Select.Content>
                {[15, 30, 45, 60, 90, 120].map((minutos) => (
                  <Select.Item
                    key={minutos}
                    item={{
                      label:
                        minutos < 60
                          ? `${minutos} minutos`
                          : `${minutos / 60} ${minutos === 60 ? "hora" : "horas"}`,
                      value: String(minutos),
                    }}
                  >
                    {minutos < 60
                      ? `${minutos} minutos`
                      : `${minutos / 60} ${minutos === 60 ? "hora" : "horas"}`}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </CampoFormulario>
          <CampoFormulario etiqueta="Veterinario">
            <Select.Root
              collection={collectionVeterinarios}
              value={[veterinarioId]}
              onValueChange={(e) => setVeterinarioId(e.value[0] ?? "")}
              size="sm"
            >
              <Select.Trigger bg="white" borderColor="ink.200">
                <Select.ValueText placeholder="Sin asignar" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item item={{ label: "Sin asignar", value: "" }}>
                  Sin asignar
                </Select.Item>
                {veterinarios.map((veterinario) => (
                  <Select.Item
                    key={veterinario.id}
                    item={{
                      label: `${nombreVeterinario(veterinario)}${veterinario.especialidad ? ` · ${veterinario.especialidad}` : ""}`,
                      value: String(veterinario.id),
                    }}
                  >
                    {nombreVeterinario(veterinario)}
                    {veterinario.especialidad
                      ? ` · ${veterinario.especialidad}`
                      : ""}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </CampoFormulario>
        </Grid>

        {errorDeCargaVeterinarios && (
          <Text color="danger.fg" fontSize="sm" role="alert">
            No se pudo cargar el equipo: {errorDeCargaVeterinarios}
          </Text>
        )}

        <CampoFormulario etiqueta="Motivo de la cita" requerido>
          <Flex align="center" gap="2">
            {motivos.find((item) => String(item.id) === motivoCitaId) && (
              <Box
                w="3"
                h="3"
                borderRadius="full"
                bg={
                  motivos.find((item) => String(item.id) === motivoCitaId)
                    ?.color
                }
                flexShrink={0}
              />
            )}
            <Select.Root
              collection={collectionMotivos}
              value={[motivoCitaId]}
              onValueChange={(e) => setMotivoCitaId(e.value[0] ?? "")}
              disabled={cargandoMotivos || Boolean(errorDeCargaMotivos)}
              size="sm"
              width="full"
            >
              <Select.Trigger bg="white" borderColor="ink.200">
                <Select.ValueText
                  placeholder={
                    cargandoMotivos
                      ? "Cargando motivos…"
                      : "Seleccioná un motivo"
                  }
                />
              </Select.Trigger>
              <Select.Content>
                {motivos
                  .filter(
                    (item) => item.activo || item.id === cita?.motivoCitaId,
                  )
                  .map((item) => (
                    <Select.Item
                      key={item.id}
                      item={{
                        label: `${item.nombre}${!item.activo ? " (inactivo)" : ""}`,
                        value: String(item.id),
                      }}
                    >
                      {item.nombre}
                      {!item.activo ? " (inactivo)" : ""}
                    </Select.Item>
                  ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        </CampoFormulario>

        {errorDeCargaMotivos && (
          <Text color="danger.fg" fontSize="sm" role="alert">
            No se pudo cargar el catálogo de motivos: {errorDeCargaMotivos}
          </Text>
        )}

        <CampoFormulario etiqueta="Notas internas">
          <Textarea
            value={notas}
            onChange={(event) => setNotas(event.target.value)}
            placeholder="Información útil para el equipo (opcional)"
            maxLength={5000}
            rows={3}
            resize="vertical"
            bg="white"
            borderColor="ink.200"
            size="sm"
          />
        </CampoFormulario>

        {errorValidacion && (
          <Text color="danger.fg" fontSize="sm" role="alert">
            {errorValidacion}
          </Text>
        )}
      </Flex>
    </chakra.form>
  );
}

function CampoFormulario({
  etiqueta,
  requerido,
  children,
}: {
  etiqueta: string;
  requerido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Text fontSize="sm" fontWeight="semibold" mb="1.5">
        {etiqueta}
        {requerido && <chakra.span color="danger.fg"> *</chakra.span>}
      </Text>
      <Box>{children}</Box>
    </Box>
  );
}

function AdministrarMotivosDialog({
  abierto,
  puedeEditar,
  alCerrar,
}: {
  abierto: boolean;
  puedeEditar: boolean;
  alCerrar: () => void;
}) {
  const motivos = useMotivosAgenda();
  const crear = useCrearMotivoAgenda();
  const actualizar = useActualizarMotivoAgenda();
  const cambiarEstado = useCambiarEstadoMotivoAgenda();
  const [formularioVisible, setFormularioVisible] = useState(false);
  const [motivoEditando, setMotivoEditando] = useState<MotivoCitaAgenda | null>(
    null,
  );
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#0D9E87");
  const [error, setError] = useState("");
  const guardando = crear.isPending || actualizar.isPending;

  function nuevoMotivo() {
    setMotivoEditando(null);
    setNombre("");
    setColor("#0D9E87");
    setError("");
    setFormularioVisible(true);
  }

  function editarMotivo(motivo: MotivoCitaAgenda) {
    setMotivoEditando(motivo);
    setNombre(motivo.nombre);
    setColor(motivo.color);
    setError("");
    setFormularioVisible(true);
  }

  async function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nombre.trim()) {
      setError("Ingresá un nombre para el motivo.");
      return;
    }

    const datos: DatosMotivoCita = {
      nombre: nombre.trim(),
      color: color.toUpperCase(),
    };
    try {
      if (motivoEditando) {
        await actualizar.mutateAsync({
          id: motivoEditando.id,
          datos,
        });
      } else {
        await crear.mutateAsync(datos);
      }
      toaster.success({
        title: motivoEditando ? "Motivo actualizado" : "Motivo creado",
        description: datos.nombre,
      });
      setFormularioVisible(false);
      setMotivoEditando(null);
      setNombre("");
      setColor("#0D9E87");
      setError("");
    } catch (error) {
      const descripcion = mensajeDeError(error);
      setError(descripcion);
      toaster.error({
        title: "No se pudo guardar el motivo",
        description: descripcion,
      });
    }
  }

  async function alternarEstado(motivo: MotivoCitaAgenda) {
    try {
      await cambiarEstado.mutateAsync({
        id: motivo.id,
        activo: !motivo.activo,
      });
      toaster.success({
        title: motivo.activo ? "Motivo desactivado" : "Motivo reactivado",
        description: motivo.nombre,
      });
    } catch (error) {
      toaster.error({
        title: "No se pudo cambiar el estado",
        description: mensajeDeError(error),
      });
    }
  }

  return (
    <DialogRoot
      open={abierto}
      onOpenChange={(detalle) => {
        if (!detalle.open) {
          setFormularioVisible(false);
          alCerrar();
        }
      }}
      size="lg"
    >
      <DialogContent
        maxW="42rem"
        borderRadius="xl"
        p="0"
        overflow="hidden"
        position="relative"
      >
        <DialogHeader px="5" py="4" pr="14" bg="brand.800" color="white">
          <DialogTitle fontSize="lg" fontWeight="bold">
            Motivos de las citas
          </DialogTitle>
          <Text fontSize="sm" color="brand.100" mt="1">
            Definí categorías y colores para reconocer cada turno en el
            calendario.
          </Text>
        </DialogHeader>
        <chakra.button
          type="button"
          position="absolute"
          top="3"
          right="3"
          zIndex="1"
          display="flex"
          alignItems="center"
          justifyContent="center"
          w="9"
          h="9"
          borderRadius="full"
          bg="brand.700"
          color="white"
          aria-label="Cerrar motivos"
          onClick={() => {
            setFormularioVisible(false);
            alCerrar();
          }}
        >
          <X size={18} />
        </chakra.button>
        <DialogBody p={{ base: "4", md: "5" }} maxH="70dvh" overflowY="auto">
          <Flex
            align={{ base: "stretch", sm: "center" }}
            justify="space-between"
            gap="3"
            mb="4"
            direction={{ base: "column", sm: "row" }}
          >
            <Box>
              <Heading as="h3" size="sm" color="ink.900">
                Catálogo de motivos
              </Heading>
              <Text fontSize="xs" color="ink.500" mt="1">
                Las citas existentes mantienen su motivo aunque lo desactives.
              </Text>
            </Box>
            {puedeEditar && !formularioVisible && (
              <Button
                size="sm"
                colorPalette="brand"
                onClick={nuevoMotivo}
                flexShrink={0}
              >
                <Plus size={15} />
                Agregar motivo
              </Button>
            )}
          </Flex>

          {formularioVisible && (
            <chakra.form
              onSubmit={guardar}
              borderWidth="1px"
              borderColor="brand.muted"
              borderRadius="lg"
              bg="brand.subtle"
              p="4"
              mb="4"
            >
              <Text fontSize="sm" fontWeight="semibold" mb="3">
                {motivoEditando ? "Editar motivo" : "Nuevo motivo"}
              </Text>
              <Grid
                templateColumns={{ base: "1fr", sm: "minmax(0, 1fr) auto" }}
                alignItems="end"
                gap="3"
              >
                <CampoFormulario etiqueta="Nombre del motivo" requerido>
                  <Input
                    value={nombre}
                    onChange={(event) => setNombre(event.target.value)}
                    placeholder="Ej.: Vacuna, Control, Peluquería"
                    maxLength={100}
                    required
                    bg="white"
                    borderColor="ink.200"
                    size="sm"
                  />
                </CampoFormulario>
                <Flex align="center" gap="2">
                  <Input
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    aria-label="Color del motivo"
                    w="3rem"
                    h="2.75rem"
                    p="1"
                    borderWidth="1px"
                    borderColor="ink.200"
                    borderRadius="md"
                    bg="white"
                    cursor="pointer"
                  />
                  <Input
                    value={color.toUpperCase()}
                    onChange={(event) => {
                      const valor = event.target.value;
                      if (/^#[\da-f]{0,6}$/i.test(valor)) setColor(valor);
                    }}
                    onBlur={() => {
                      if (!/^#[\da-f]{6}$/i.test(color)) {
                        setColor("#0D9E87");
                      }
                    }}
                    aria-label="Código hexadecimal del color"
                    maxLength={7}
                    w="6.5rem"
                    size="sm"
                    px="2"
                    borderWidth="1px"
                    borderColor="ink.200"
                    borderRadius="md"
                    bg="white"
                  />
                </Flex>
              </Grid>
              {error && (
                <Text color="danger.fg" fontSize="sm" mt="2" role="alert">
                  {error}
                </Text>
              )}
              <Flex justify="flex-end" gap="2" mt="4">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFormularioVisible(false)}
                  disabled={guardando}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  colorPalette="brand"
                  loading={guardando}
                >
                  {motivoEditando ? "Guardar cambios" : "Crear motivo"}
                </Button>
              </Flex>
            </chakra.form>
          )}

          {motivos.isPending ? (
            <Flex align="center" justify="center" gap="2" py="8">
              <Spinner size="sm" color="brand.500" />
              <Text fontSize="sm" color="ink.500">
                Cargando motivos…
              </Text>
            </Flex>
          ) : motivos.isError ? (
            <Flex direction="column" align="center" gap="3" py="6">
              <Text fontSize="sm" color="danger.fg" role="alert">
                No se pudo cargar el catálogo: {mensajeDeError(motivos.error)}
              </Text>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void motivos.refetch()}
              >
                Reintentar
              </Button>
            </Flex>
          ) : motivos.data?.length ? (
            <Flex direction="column" gap="2">
              {motivos.data.map((motivo) => (
                <Flex
                  key={motivo.id}
                  align="center"
                  gap="3"
                  px="3"
                  py="2.5"
                  borderWidth="1px"
                  borderColor="ink.100"
                  borderRadius="md"
                  opacity={motivo.activo ? 1 : 0.62}
                >
                  <Box
                    w="3"
                    h="9"
                    borderRadius="full"
                    bg={motivo.color}
                    flexShrink={0}
                  />
                  <Box minW={0} flex="1">
                    <Flex align="center" gap="2" wrap="wrap">
                      <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                        {motivo.nombre}
                      </Text>
                      {motivo.predeterminado && (
                        <Badge colorPalette="brand" variant="subtle" size="sm">
                          Inicial
                        </Badge>
                      )}
                      {!motivo.activo && (
                        <Badge colorPalette="gray" variant="subtle" size="sm">
                          Inactivo
                        </Badge>
                      )}
                    </Flex>
                    <Text fontSize="xs" color="ink.500">
                      {motivo.color.toUpperCase()}
                    </Text>
                  </Box>
                  {puedeEditar && (
                    <Flex align="center" gap="1" flexShrink={0}>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => editarMotivo(motivo)}
                        aria-label={`Editar ${motivo.nombre}`}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        colorPalette={motivo.activo ? "danger" : "success"}
                        onClick={() => void alternarEstado(motivo)}
                        loading={cambiarEstado.isPending}
                        aria-label={
                          motivo.activo
                            ? `Desactivar ${motivo.nombre}`
                            : `Reactivar ${motivo.nombre}`
                        }
                      >
                        {motivo.activo ? (
                          <Trash2 size={14} />
                        ) : (
                          <RotateCcw size={14} />
                        )}
                      </Button>
                    </Flex>
                  )}
                </Flex>
              ))}
            </Flex>
          ) : (
            <Text fontSize="sm" color="ink.500" textAlign="center" py="6">
              Aún no hay motivos en el catálogo.
            </Text>
          )}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}

function DetalleCita({
  cita,
  abierto,
  puedeEditar,
  puedeCancelar,
  guardando,
  alCerrar,
  alEditar,
  alCambiarEstado,
}: {
  cita: CitaAgenda | null;
  abierto: boolean;
  puedeEditar: boolean;
  puedeCancelar: boolean;
  guardando: boolean;
  alCerrar: () => void;
  alEditar: (cita: CitaAgenda) => void;
  alCambiarEstado: (estado: EstadoCita) => void;
}) {
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);

  return (
    <DialogRoot
      open={abierto}
      onOpenChange={(detalle) => {
        if (!detalle.open) alCerrar();
      }}
      size="sm"
    >
      <DialogContent
        maxW="30rem"
        maxH="calc(100dvh - 2rem)"
        borderRadius="xl"
        p="0"
        overflow="hidden"
        position="relative"
        display="flex"
        flexDirection="column"
      >
        {cita && (
          <>
            <DialogHeader
              px="5"
              py="4"
              pr="14"
              bg="brand.800"
              color="white"
              flexShrink="0"
            >
              <DialogTitle fontSize="lg" fontWeight="bold">
                Detalle de la cita
              </DialogTitle>
              <Text fontSize="sm" color="brand.100" mt="1">
                {fechaFormateada(cita.fechaInicio)} ·{" "}
                {formatHora(cita.fechaInicio)}–{formatHora(cita.fechaFin)}
              </Text>
            </DialogHeader>
            <chakra.button
              type="button"
              position="absolute"
              top="3"
              right="3"
              zIndex="1"
              display="flex"
              alignItems="center"
              justifyContent="center"
              w="9"
              h="9"
              borderRadius="full"
              bg="brand.700"
              color="white"
              aria-label="Cerrar detalle"
              onClick={alCerrar}
            >
              <X size={18} />
            </chakra.button>
            <DialogBody p="5" flex="1" minH="0" overflowY="auto">
              <Flex align="center" gap="3" mb="5">
                <Flex
                  align="center"
                  justify="center"
                  w="12"
                  h="12"
                  borderRadius="full"
                  bg="brand.subtle"
                  color="brand.fg"
                  flexShrink={0}
                >
                  <PawPrint size={22} />
                </Flex>
                <Box minW={0}>
                  <Heading size="md" color="ink.900">
                    {cita.paciente.nombre}
                  </Heading>
                  <Text fontSize="sm" color="ink.600">
                    {cita.paciente.especie?.nombre ?? "Paciente"} ·{" "}
                    {nombreCliente(cita.paciente)}
                  </Text>
                </Box>
              </Flex>

              <Grid templateColumns="1fr 1fr" gap="4" mb="4">
                <DetalleCampo
                  etiqueta="Estado"
                  valor={
                    <Badge
                      colorPalette={tonoEstado(cita.estado)}
                      variant="subtle"
                    >
                      {ESTADOS[cita.estado].etiqueta}
                    </Badge>
                  }
                />
                <DetalleCampo
                  etiqueta="Veterinario"
                  valor={nombreVeterinario(cita.veterinario)}
                />
                <DetalleCampo
                  etiqueta="Motivo"
                  valor={nombreMotivoCita(cita)}
                />
                <DetalleCampo
                  etiqueta="WhatsApp de la cita"
                  valor={cita.whatsapp ?? "No registrado"}
                />
              </Grid>
              {cita.notas && (
                <Box bg="ink.50" borderRadius="md" p="3" mb="4">
                  <Text fontSize="xs" fontWeight="semibold" color="ink.600">
                    Notas
                  </Text>
                  <Text fontSize="sm" color="ink.800" mt="1">
                    {cita.notas}
                  </Text>
                </Box>
              )}

              <Flex gap="2" wrap="wrap" mt="5">
                {puedeEditar &&
                  cita.estado === "pendiente" &&
                  estadoEditable(cita.estado) && (
                    <Button
                      size="sm"
                      colorPalette="success"
                      onClick={() => alCambiarEstado("confirmada")}
                      loading={guardando}
                    >
                      <Check size={15} />
                      Confirmar
                    </Button>
                  )}
                {puedeEditar && estadoEditable(cita.estado) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => alEditar(cita)}
                  >
                    Editar cita
                  </Button>
                )}
                {puedeEditar &&
                  cita.estado === "confirmada" &&
                  estadoEditable(cita.estado) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => alCambiarEstado("en_curso")}
                      loading={guardando}
                    >
                      <Stethoscope size={15} />
                      Iniciar atención
                    </Button>
                  )}
                {puedeEditar && cita.estado === "en_curso" && (
                  <Button
                    size="sm"
                    colorPalette="success"
                    onClick={() => alCambiarEstado("atendida")}
                    loading={guardando}
                  >
                    <Check size={15} />
                    Marcar atendida
                  </Button>
                )}
                {puedeEditar &&
                  ["pendiente", "confirmada"].includes(cita.estado) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => alCambiarEstado("no_asistio")}
                      loading={guardando}
                    >
                      Marcar inasistencia
                    </Button>
                  )}
                {puedeCancelar && estadoEditable(cita.estado) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    colorPalette="danger"
                    onClick={() => setConfirmandoCancelacion(true)}
                    loading={guardando}
                  >
                    Cancelar cita
                  </Button>
                )}
              </Flex>
              {confirmandoCancelacion && (
                <Flex
                  align={{ base: "stretch", sm: "center" }}
                  justify="space-between"
                  gap="3"
                  mt="4"
                  p="3"
                  borderRadius="md"
                  bg="danger.subtle"
                  direction={{ base: "column", sm: "row" }}
                >
                  <Text fontSize="sm" color="danger.fg">
                    ¿Querés cancelar esta cita? No se puede deshacer.
                  </Text>
                  <Flex gap="2" flexShrink={0}>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => setConfirmandoCancelacion(false)}
                    >
                      Volver
                    </Button>
                    <Button
                      size="xs"
                      colorPalette="danger"
                      onClick={() => {
                        setConfirmandoCancelacion(false);
                        alCambiarEstado("cancelada");
                      }}
                      loading={guardando}
                    >
                      Confirmar cancelación
                    </Button>
                  </Flex>
                </Flex>
              )}
            </DialogBody>
          </>
        )}
      </DialogContent>
    </DialogRoot>
  );
}

function estadoEditable(estado: EstadoCita) {
  return !["atendida", "cancelada", "no_asistio"].includes(estado);
}

function DetalleCampo({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: React.ReactNode;
}) {
  return (
    <Box>
      <Text fontSize="xs" color="ink.500" mb="1">
        {etiqueta}
      </Text>
      <Text fontSize="sm" fontWeight="medium" color="ink.800">
        {valor}
      </Text>
    </Box>
  );
}
