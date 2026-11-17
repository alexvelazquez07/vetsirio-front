import {
  Avatar,
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  IconButton,
  Input,
  NativeSelect,
  Skeleton,
  Stack,
  Text,
  Textarea,
  chakra,
} from "@chakra-ui/react";
import {
  ClipboardList,
  PawPrint,
  Pill,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { FormDialog } from "@/components/data/FormDialog";
import { Alert } from "@/components/ui/alert";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError } from "@/features/clients/clients.service";
import type { Tratamiento } from "@/types/dominio";
import {
  useActualizarTratamiento,
  useBuscarPacientesTratamiento,
  useCrearTratamiento,
  type PacienteTratamiento,
  type TratamientoFormData,
} from "./tratamientos.service";

/* ──────────────────────────────── Tipos y datos ──────────────────────────────── */

interface DosisItem {
  productoId: number | null;
  cantidad: string;
  unidad: string;
  fechaProgramada: string;
  fechaAplicada: string;
  administrada: boolean;
  observaciones: string;
}

interface Errores {
  pacienteId?: string;
  nombre?: string;
  fechaInicio?: string;
  fechaFinPrevista?: string;
  dosis?: string;
}

type TratamientoFormProps = {
  abierto: boolean;
  tratamiento?: Tratamiento | null;
  onClose: () => void;
  onGuardado?: (tratamiento: Tratamiento) => void;
};

const UNIDADES = ["ml", "mg", "g", "comprimido", "cápsula", "gota", "tableta", "unidad"];

const ID_PACIENTE = "tratamiento-paciente";
const LISTA_PACIENTES = "tratamiento-lista-pacientes";

/* ─────────────────────────────────── Utilidades ─────────────────────────────────── */

function pad(valor: number) {
  return String(valor).padStart(2, "0");
}

function paraInputFechaHora(fecha: Date) {
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
}

function desdeISOFechaHora(iso: string | null | undefined) {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return paraInputFechaHora(fecha);
}

function desdeISOFecha(iso: string | null | undefined) {
  return iso ? iso.slice(0, 10) : "";
}

function hoyISO() {
  return paraInputFechaHora(new Date()).slice(0, 10);
}

function dosisVacia(fechaProgramada = hoyISO()): DosisItem {
  return {
    productoId: null,
    cantidad: "1",
    unidad: "ml",
    fechaProgramada,
    fechaAplicada: "",
    administrada: false,
    observaciones: "",
  };
}

function aNumero(valor: string) {
  return Number(valor.replace(",", "."));
}

/* ─────────────────────────────── Componentes de apoyo ─────────────────────────────── */

function Seccion({
  icono: Icono,
  titulo,
  descripcion,
  accion,
  children,
}: {
  icono: typeof Pill;
  titulo: string;
  descripcion: string;
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <chakra.section
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
      p={{ base: "4", md: "5" }}
    >
      <Flex align="center" gap="3" mb="4" wrap="wrap">
        <Flex
          align="center"
          justify="center"
          w="9"
          h="9"
          flexShrink={0}
          borderRadius="lg"
          bg="brand.50"
          color="brand.600"
        >
          <Icono size={18} />
        </Flex>
        <Box minW="0" flex="1">
          <Text fontSize="sm" fontWeight="semibold" color="ink.900">
            {titulo}
          </Text>
          <Text fontSize="xs" color="ink.600" mt="0.5">
            {descripcion}
          </Text>
        </Box>
        {accion}
      </Flex>
      {children}
    </chakra.section>
  );
}

function Campo({
  id,
  etiqueta,
  requerido,
  error,
  ayuda,
  anchoCompleto,
  children,
}: {
  id: string;
  etiqueta: string;
  requerido?: boolean;
  error?: string;
  ayuda?: string;
  anchoCompleto?: boolean;
  children: ReactNode;
}) {
  return (
    <Box gridColumn={anchoCompleto ? "1 / -1" : undefined}>
      <Field.Root invalid={!!error} required={requerido} ids={{ control: id }}>
        <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
          {etiqueta}
          {requerido && <Field.RequiredIndicator />}
        </Field.Label>
        {children}
        {error ? (
          <Field.ErrorText fontSize="xs">{error}</Field.ErrorText>
        ) : ayuda ? (
          <Field.HelperText fontSize="xs" color="ink.500">
            {ayuda}
          </Field.HelperText>
        ) : null}
      </Field.Root>
    </Box>
  );
}

function AvatarPaciente({ nombre }: { nombre: string }) {
  return (
    <Avatar.Root size="sm" colorPalette="brand" flexShrink={0}>
      <Avatar.Fallback name={nombre} />
    </Avatar.Root>
  );
}

/* ─────────────────────────────────── Formulario ─────────────────────────────────── */

export function TratamientoForm({
  abierto,
  tratamiento,
  onClose,
  onGuardado,
}: TratamientoFormProps) {
  const { puede } = useAuth();
  const crear = useCrearTratamiento();
  const actualizar = useActualizarTratamiento();

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFinPrevista, setFechaFinPrevista] = useState("");
  const [notas, setNotas] = useState("");
  const [dosis, setDosis] = useState<DosisItem[]>([dosisVacia()]);

  const [textoPaciente, setTextoPaciente] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] =
    useState<PacienteTratamiento | null>(null);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);

  const [errores, setErrores] = useState<Errores>({});
  const [errorFormulario, setErrorFormulario] = useState("");

  const busquedaPacientes = useBuscarPacientesTratamiento(textoPaciente);
  const resultados = busquedaPacientes.data ?? [];
  const mostrarLista =
    listaAbierta && textoPaciente.trim().length >= 2 && !pacienteSeleccionado;
  const guardando = crear.isPending || actualizar.isPending;
  const permiteEditar = puede(
    tratamiento ? "tratamientos.editar" : "tratamientos.crear",
  );

  useEffect(() => {
    if (!abierto) return;

    setErrores({});
    setErrorFormulario("");
    setListaAbierta(false);
    setIndiceActivo(0);

    if (!tratamiento) {
      setNombre("");
      setDescripcion("");
      setFechaInicio(paraInputFechaHora(new Date()));
      setFechaFinPrevista("");
      setNotas("");
      setPacienteSeleccionado(null);
      setTextoPaciente("");
      setDosis([dosisVacia()]);
      return;
    }

    const paciente: PacienteTratamiento = {
      id: tratamiento.paciente.id,
      nombre: tratamiento.paciente.nombre,
      especie: tratamiento.paciente.especie,
      cliente: tratamiento.paciente.cliente,
    };
    setPacienteSeleccionado(paciente);
    setTextoPaciente(paciente.nombre);
    setNombre(tratamiento.nombre);
    setDescripcion(tratamiento.descripcion ?? "");
    setFechaInicio(desdeISOFechaHora(tratamiento.fechaInicio));
    setFechaFinPrevista(desdeISOFecha(tratamiento.fechaFinPrevista));
    setNotas(tratamiento.notas ?? "");
    setDosis(
      tratamiento.dosis.length
        ? tratamiento.dosis.map((item) => ({
            productoId: item.productoId,
            cantidad: String(Number(item.cantidad)),
            unidad: item.unidad,
            fechaProgramada: desdeISOFecha(item.fechaProgramada),
            fechaAplicada: desdeISOFechaHora(item.fechaAplicada),
            administrada: item.administrada,
            observaciones: item.observaciones ?? "",
          }))
        : [dosisVacia()],
    );
  }, [abierto, tratamiento]);

  useEffect(() => setIndiceActivo(0), [textoPaciente]);

  function limpiarError(campo: keyof Errores) {
    setErrores((actuales) => ({ ...actuales, [campo]: undefined }));
    setErrorFormulario("");
  }

  function elegirPaciente(paciente: PacienteTratamiento) {
    setPacienteSeleccionado(paciente);
    setTextoPaciente(paciente.nombre);
    setListaAbierta(false);
    limpiarError("pacienteId");
  }

  function quitarPaciente() {
    setPacienteSeleccionado(null);
    setTextoPaciente("");
  }

  function teclasBuscador(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (!mostrarLista) {
      if (evento.key === "ArrowDown") setListaAbierta(true);
      return;
    }
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndiceActivo((i) => Math.min(i + 1, Math.max(resultados.length - 1, 0)));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceActivo((i) => Math.max(i - 1, 0));
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      const elegido = resultados[indiceActivo];
      if (elegido) elegirPaciente(elegido);
    } else if (evento.key === "Escape") {
      evento.stopPropagation();
      setListaAbierta(false);
    }
  }

  function actualizarDosis(indice: number, cambios: Partial<DosisItem>) {
    setDosis((actuales) =>
      actuales.map((item, i) => (i === indice ? { ...item, ...cambios } : item)),
    );
    limpiarError("dosis");
  }

  function agregarDosis() {
    const ultima = dosis[dosis.length - 1];
    setDosis((actuales) => [
      ...actuales,
      dosisVacia(ultima?.fechaProgramada ?? hoyISO()),
    ]);
    limpiarError("dosis");
  }

  function quitarDosis(indice: number) {
    setDosis((actuales) => actuales.filter((_, i) => i !== indice));
    limpiarError("dosis");
  }

  function validar(): Errores {
    const nuevos: Errores = {};

    if (!pacienteSeleccionado) {
      nuevos.pacienteId = "Seleccioná el paciente que recibirá el tratamiento.";
    }
    if (nombre.trim().length < 2) {
      nuevos.nombre = "Ingresá un nombre de al menos 2 letras.";
    }
    if (!fechaInicio || Number.isNaN(new Date(fechaInicio).getTime())) {
      nuevos.fechaInicio = "Ingresá una fecha de inicio válida.";
    }
    if (
      fechaFinPrevista &&
      fechaInicio &&
      fechaFinPrevista < fechaInicio.slice(0, 10)
    ) {
      nuevos.fechaFinPrevista =
        "El fin previsto no puede ser anterior al inicio.";
    }
    if (!dosis.length) {
      nuevos.dosis = "Agregá al menos una dosis al tratamiento.";
    } else {
      for (const [indice, item] of dosis.entries()) {
        const cantidad = aNumero(item.cantidad);
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          nuevos.dosis = `La cantidad de la dosis ${indice + 1} debe ser mayor que cero.`;
          break;
        }
        if (!item.fechaProgramada) {
          nuevos.dosis = `Ingresá la fecha programada de la dosis ${indice + 1}.`;
          break;
        }
        if (
          item.fechaAplicada &&
          Number.isNaN(new Date(item.fechaAplicada).getTime())
        ) {
          nuevos.dosis = `La fecha aplicada de la dosis ${indice + 1} no es válida.`;
          break;
        }
      }
    }

    return nuevos;
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorFormulario("");

    if (!permiteEditar) {
      setErrorFormulario("Tu rol no tiene permiso para guardar tratamientos.");
      return;
    }

    const nuevos = validar();
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    if (!pacienteSeleccionado) return;

    const datos: TratamientoFormData = {
      pacienteId: pacienteSeleccionado.id,
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      fechaInicio: new Date(fechaInicio).toISOString(),
      fechaFinPrevista: fechaFinPrevista || null,
      notas: notas.trim() || null,
      dosis: dosis.map((item, indice) => ({
        numeroDosis: indice + 1,
        productoId: item.productoId,
        cantidad: aNumero(item.cantidad),
        unidad: item.unidad || "ml",
        fechaProgramada: item.fechaProgramada,
        fechaAplicada: item.fechaAplicada
          ? new Date(item.fechaAplicada).toISOString()
          : null,
        administrada: item.administrada,
        observaciones: item.observaciones.trim() || null,
      })),
    };

    try {
      const guardado = tratamiento
        ? await actualizar.mutateAsync({ id: tratamiento.id, datos })
        : await crear.mutateAsync(datos);
      toaster.success({
        title: tratamiento ? "Tratamiento actualizado" : "Tratamiento creado",
        description: `${pacienteSeleccionado.nombre} · ${guardado.nombre}`,
      });
      if (onGuardado) onGuardado(guardado);
      else onClose();
    } catch (error) {
      const mensaje = mensajeDeError(error);
      setErrorFormulario(mensaje);
      toaster.error({
        title: "No se pudo guardar el tratamiento",
        description: mensaje,
      });
    }
  }

  return (
    <FormDialog
      abierto={abierto}
      onClose={onClose}
      titulo={tratamiento ? "Editar tratamiento" : "Nuevo tratamiento"}
      descripcion={
        tratamiento
          ? "Actualizá la pauta, las fechas y las dosis indicadas."
          : "Definí el tratamiento, sus fechas y el esquema de dosis."
      }
      ancho="xl"
      guardando={guardando}
      bloquearCierre={guardando}
      textoConfirmar={tratamiento ? "Guardar cambios" : "Crear tratamiento"}
      onConfirmar={() =>
        document
          .querySelector<HTMLFormElement>("#tratamiento-form")
          ?.requestSubmit()
      }
    >
      <chakra.form id="tratamiento-form" onSubmit={enviar} noValidate>
        <Flex direction="column" gap="4">
          {errorFormulario && (
            <Alert status="error" rounded="md">
              {errorFormulario}
            </Alert>
          )}
          {!permiteEditar && !errorFormulario && (
            <Alert status="info" rounded="md">
              Tu rol tiene acceso de solo lectura a los tratamientos.
            </Alert>
          )}

          {/* Paciente */}
          <Seccion
            icono={PawPrint}
            titulo="Paciente"
            descripcion="¿A quién está indicado este tratamiento?"
          >
            {pacienteSeleccionado ? (
              <Flex
                align="center"
                gap="3"
                p="3"
                borderWidth="1px"
                borderColor="brand.200"
                bg="brand.50"
                borderRadius="lg"
                wrap="wrap"
              >
                <AvatarPaciente nombre={pacienteSeleccionado.nombre} />
                <Box minW="0" flex="1">
                  <Flex align="center" gap="2" wrap="wrap">
                    <Text fontWeight="semibold" color="brand.900" truncate>
                      {pacienteSeleccionado.nombre}
                    </Text>
                    {pacienteSeleccionado.especie?.nombre && (
                      <Badge colorPalette="brand" variant="subtle" size="sm">
                        {pacienteSeleccionado.especie.nombre}
                      </Badge>
                    )}
                  </Flex>
                  <Text fontSize="xs" color="brand.800" mt="0.5" truncate>
                    Responsable: {nombreResponsable(pacienteSeleccionado)}
                  </Text>
                </Box>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  colorPalette="brand"
                  onClick={quitarPaciente}
                >
                  Cambiar
                </Button>
              </Flex>
            ) : (
              <Box
                position="relative"
                onBlur={(evento: React.FocusEvent<HTMLElement>) => {
                  if (
                    !evento.currentTarget.contains(
                      evento.relatedTarget as Node | null,
                    )
                  ) {
                    setListaAbierta(false);
                  }
                }}
              >
                <Campo
                  id={ID_PACIENTE}
                  etiqueta="Buscar paciente"
                  requerido
                  error={errores.pacienteId}
                  ayuda="Escribí al menos 2 letras del nombre del paciente o de su responsable."
                >
                  <Box position="relative" w="full">
                    <Input
                      value={textoPaciente}
                      onChange={(evento) => {
                        setTextoPaciente(evento.target.value);
                        setListaAbierta(true);
                        setPacienteSeleccionado(null);
                        limpiarError("pacienteId");
                      }}
                      onFocus={() => setListaAbierta(true)}
                      onKeyDown={teclasBuscador}
                      placeholder="Ej.: Luna, o el nombre del responsable"
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={mostrarLista}
                      aria-controls={LISTA_PACIENTES}
                      aria-autocomplete="list"
                      ps="9"
                    />
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
                  </Box>
                </Campo>

                {mostrarLista && (
                  <Box
                    id={LISTA_PACIENTES}
                    role="listbox"
                    position="absolute"
                    zIndex="5"
                    left="0"
                    right="0"
                    top="calc(100% - 1.4rem)"
                    bg="white"
                    borderWidth="1px"
                    borderColor="ink.200"
                    borderRadius="lg"
                    boxShadow="lg"
                    maxH="15rem"
                    overflowY="auto"
                    p="1"
                  >
                    {busquedaPacientes.isError ? (
                      <Text p="3" fontSize="sm" color="red.700">
                        No se pudo buscar pacientes:{" "}
                        {mensajeDeError(busquedaPacientes.error)}
                      </Text>
                    ) : busquedaPacientes.isFetching ? (
                      <Stack gap="2" p="2" aria-label="Buscando pacientes">
                        <Skeleton h="10" borderRadius="md" />
                        <Skeleton h="10" borderRadius="md" />
                      </Stack>
                    ) : resultados.length ? (
                      resultados.map((paciente, indice) => {
                        const activo = indice === indiceActivo;
                        return (
                          <chakra.button
                            key={paciente.id}
                            type="button"
                            role="option"
                            aria-selected={activo}
                            tabIndex={-1}
                            onMouseDown={(evento: React.MouseEvent) =>
                              evento.preventDefault()
                            }
                            onMouseEnter={() => setIndiceActivo(indice)}
                            onClick={() => elegirPaciente(paciente)}
                            display="flex"
                            alignItems="center"
                            gap="3"
                            textAlign="left"
                            w="full"
                            px="3"
                            py="2"
                            borderRadius="md"
                            bg={activo ? "brand.50" : "transparent"}
                          >
                            <AvatarPaciente nombre={paciente.nombre} />
                            <Box minW="0">
                              <Text
                                fontSize="sm"
                                fontWeight="semibold"
                                color="ink.900"
                                truncate
                              >
                                {paciente.nombre}
                              </Text>
                              <Text fontSize="xs" color="ink.600" truncate>
                                {paciente.especie?.nombre ??
                                  "Especie sin registrar"}{" "}
                                · {nombreResponsable(paciente)}
                              </Text>
                            </Box>
                          </chakra.button>
                        );
                      })
                    ) : (
                      <Text p="3" fontSize="sm" color="ink.600">
                        No encontramos pacientes activos con ese nombre.
                      </Text>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Seccion>

          {/* Datos del tratamiento */}
          <Seccion
            icono={ClipboardList}
            titulo="Datos del tratamiento"
            descripcion="Nombre, período y aclaraciones generales."
          >
            <Grid
              templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }}
              gap="4"
            >
              <Campo
                id="tratamiento-nombre"
                etiqueta="Nombre del tratamiento"
                requerido
                error={errores.nombre}
                anchoCompleto
              >
                <Input
                  value={nombre}
                  onChange={(evento) => {
                    setNombre(evento.target.value);
                    limpiarError("nombre");
                  }}
                  placeholder="Ej.: Antibiótico postoperatorio"
                  maxLength={200}
                />
              </Campo>
              <Campo
                id="tratamiento-inicio"
                etiqueta="Inicio"
                requerido
                error={errores.fechaInicio}
              >
                <Input
                  type="datetime-local"
                  value={fechaInicio}
                  onChange={(evento) => {
                    setFechaInicio(evento.target.value);
                    limpiarError("fechaInicio");
                  }}
                />
              </Campo>
              <Campo
                id="tratamiento-fin-previsto"
                etiqueta="Fin previsto"
                error={errores.fechaFinPrevista}
                ayuda="Opcional. Debe ser igual o posterior al inicio."
              >
                <Input
                  type="date"
                  value={fechaFinPrevista}
                  onChange={(evento) => {
                    setFechaFinPrevista(evento.target.value);
                    limpiarError("fechaFinPrevista");
                  }}
                />
              </Campo>
              <Campo
                id="tratamiento-descripcion"
                etiqueta="Descripción"
                ayuda="Qué se busca tratar y cualquier indicación general."
                anchoCompleto
              >
                <Textarea
                  value={descripcion}
                  onChange={(evento) => setDescripcion(evento.target.value)}
                  rows={3}
                  maxLength={5000}
                  placeholder="Ej.: Control de infección bacteriana secundaria…"
                />
              </Campo>
              <Campo
                id="tratamiento-notas"
                etiqueta="Notas internas"
                ayuda="Sólo visibles para el equipo de la veterinaria."
                anchoCompleto
              >
                <Textarea
                  value={notas}
                  onChange={(evento) => setNotas(evento.target.value)}
                  rows={2}
                  maxLength={5000}
                  placeholder="Precauciones, recomendaciones u observaciones…"
                />
              </Campo>
            </Grid>
          </Seccion>

          {/* Dosis */}
          <Seccion
            icono={Pill}
            titulo="Esquema de dosis"
            descripcion="Programá cada toma y marcá las que ya fueron administradas."
            accion={
              <Button
                type="button"
                size="sm"
                variant="outline"
                colorPalette="brand"
                onClick={agregarDosis}
              >
                <Plus size={15} /> Agregar dosis
              </Button>
            }
          >
            {errores.dosis && (
              <Box mb="3">
                <Alert status="error" rounded="md">
                  {errores.dosis}
                </Alert>
              </Box>
            )}

            <Stack gap="3">
              {dosis.map((item, indice) => (
                <Box
                  key={indice}
                  borderWidth="1px"
                  borderColor="ink.200"
                  borderRadius="lg"
                  p="4"
                  bg={item.administrada ? "green.50" : "white"}
                >
                  <Flex align="center" justify="space-between" gap="3" mb="3">
                    <Flex align="center" gap="2">
                      <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                        Dosis {indice + 1}
                      </Text>
                      {item.administrada && (
                        <Badge colorPalette="green" variant="subtle" size="sm">
                          Administrada
                        </Badge>
                      )}
                    </Flex>
                    <IconButton
                      type="button"
                      size="2xs"
                      variant="ghost"
                      colorPalette="red"
                      onClick={() => quitarDosis(indice)}
                      disabled={dosis.length === 1}
                      aria-label={`Quitar dosis ${indice + 1}`}
                      title={
                        dosis.length === 1
                          ? "El tratamiento necesita al menos una dosis."
                          : "Quitar dosis"
                      }
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </Flex>

                  <Grid
                    templateColumns={{
                      base: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                      md: "repeat(3, minmax(0, 1fr))",
                    }}
                    gap="3"
                    alignItems="start"
                  >
                    <Campo
                      id={`tratamiento-dosis-cantidad-${indice}`}
                      etiqueta="Cantidad"
                      requerido
                    >
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.cantidad}
                        onChange={(evento) =>
                          actualizarDosis(indice, {
                            cantidad: evento.target.value,
                          })
                        }
                      />
                    </Campo>
                    <Campo
                      id={`tratamiento-dosis-unidad-${indice}`}
                      etiqueta="Unidad"
                    >
                      <NativeSelect.Root>
                        <NativeSelect.Field
                          value={item.unidad}
                          onChange={(evento) =>
                            actualizarDosis(indice, {
                              unidad: evento.target.value,
                            })
                          }
                        >
                          {UNIDADES.map((unidad) => (
                            <option key={unidad} value={unidad}>
                              {unidad}
                            </option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Campo>
                    <Campo
                      id={`tratamiento-dosis-programada-${indice}`}
                      etiqueta="Fecha programada"
                      requerido
                    >
                      <Input
                        type="date"
                        value={item.fechaProgramada}
                        onChange={(evento) =>
                          actualizarDosis(indice, {
                            fechaProgramada: evento.target.value,
                          })
                        }
                      />
                    </Campo>
                    <Campo
                      id={`tratamiento-dosis-aplicada-${indice}`}
                      etiqueta="Fecha aplicada"
                      ayuda="Opcional. Se completa al administrarla."
                    >
                      <Input
                        type="datetime-local"
                        value={item.fechaAplicada}
                        onChange={(evento) =>
                          actualizarDosis(indice, {
                            fechaAplicada: evento.target.value,
                          })
                        }
                      />
                    </Campo>
                    <Box alignSelf="end" pb="2">
                      <chakra.label
                        display="flex"
                        alignItems="center"
                        gap="2"
                        cursor="pointer"
                        userSelect="none"
                      >
                        <chakra.input
                          type="checkbox"
                          checked={item.administrada}
                          onChange={(evento) =>
                            actualizarDosis(indice, {
                              administrada: evento.target.checked,
                            })
                          }
                          w="4"
                          h="4"
                        />
                        <Text fontSize="sm" fontWeight="medium" color="ink.800">
                          Dosis administrada
                        </Text>
                      </chakra.label>
                    </Box>
                    <Campo
                      id={`tratamiento-dosis-observaciones-${indice}`}
                      etiqueta="Observaciones de la dosis"
                      anchoCompleto
                    >
                      <Textarea
                        value={item.observaciones}
                        onChange={(evento) =>
                          actualizarDosis(indice, {
                            observaciones: evento.target.value,
                          })
                        }
                        rows={2}
                        maxLength={2000}
                        placeholder="Reacciones, cambios de pauta u otras notas…"
                      />
                    </Campo>
                  </Grid>
                </Box>
              ))}
            </Stack>
          </Seccion>
        </Flex>
      </chakra.form>
    </FormDialog>
  );
}

function nombreResponsable(paciente: PacienteTratamiento) {
  const cliente = paciente.cliente;
  if (!cliente) return "Responsable sin registrar";
  return (
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ") ||
    cliente.razonSocial ||
    cliente.documento ||
    "Responsable sin registrar"
  );
}
