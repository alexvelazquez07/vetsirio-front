import {
  Avatar,
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  Input,
  NativeSelect,
  Skeleton,
  Spinner,
  Stack,
  Text,
  Textarea,
  chakra,
} from "@chakra-ui/react";
import {
  CalendarDays,
  ImagePlus,
  PawPrint,
  Scissors,
  Search,
  Wallet,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { FormDialog } from "@/components/data/FormDialog";
import { Alert } from "@/components/ui/alert";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError } from "@/features/clients/clients.service";
import { api, urlDeArchivo } from "@/services/api";
import type {
  EstadoGrooming,
  GroomingSesion,
  RespuestaUpload,
} from "@/types/dominio";
import {
  ESTADOS_GROOMING,
  useActualizarGroomingSesion,
  useBuscarPacientesGrooming,
  useCrearGroomingSesion,
  usePeluquerosGrooming,
  type GroomingFormData,
  type PacienteGrooming,
} from "./grooming.service";

/* ──────────────────────────────── Tipos y datos ──────────────────────────────── */

interface Errores {
  pacienteId?: string;
  fechaInicio?: string;
  fechaFin?: string;
  precio?: string;
}

type GroomingFormProps = {
  abierto: boolean;
  sesion?: GroomingSesion | null;
  onClose: () => void;
  onGuardado?: (sesion: GroomingSesion) => void;
};

const SERVICIOS_SUGERIDOS = [
  "Baño y corte",
  "Baño",
  "Corte de uñas",
  "Deslanado",
  "Corte higiénico",
  "Spa completo",
];

const TIPOS_FOTO = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
]);

const MAX_FOTO_BYTES = 5 * 1024 * 1024;

const ID_PACIENTE = "grooming-paciente";
const LISTA_PACIENTES = "grooming-lista-pacientes";
const ID_FORMULARIO = "grooming-form";

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

function inicioPorDefecto() {
  const ahora = new Date();
  ahora.setSeconds(0, 0);
  return ahora;
}

function finPorDefecto(inicio: Date) {
  return new Date(inicio.getTime() + 60 * 60 * 1000);
}

function aNumero(valor: string) {
  return Number(valor.replace(",", "."));
}

function nombreResponsable(paciente: PacienteGrooming) {
  const cliente = paciente.cliente;
  if (!cliente) return "Responsable sin registrar";
  return (
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ") ||
    cliente.razonSocial ||
    cliente.documento ||
    "Responsable sin registrar"
  );
}

/* ─────────────────────────────── Componentes de apoyo ─────────────────────────────── */

function Seccion({
  icono: Icono,
  titulo,
  descripcion,
  children,
}: {
  icono: typeof Scissors;
  titulo: string;
  descripcion: string;
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
      <Flex align="center" gap="3" mb="4">
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

function CampoFoto({
  id,
  etiqueta,
  ayuda,
  url,
  onCambiar,
}: {
  id: string;
  etiqueta: string;
  ayuda: string;
  url: string;
  onCambiar: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const src = urlDeArchivo(url);

  async function subir(archivo?: File) {
    if (!archivo) return;
    setError("");

    if (!TIPOS_FOTO.has(archivo.type)) {
      setError("Usá una imagen JPG, PNG, WEBP, GIF, AVIF o BMP.");
      if (input.current) input.current.value = "";
      return;
    }
    if (archivo.size > MAX_FOTO_BYTES) {
      setError("La imagen no puede superar los 5 MB.");
      if (input.current) input.current.value = "";
      return;
    }

    const datos = new FormData();
    datos.append("archivo", archivo);
    setSubiendo(true);
    try {
      const respuesta = await api.post<RespuestaUpload>("/uploads", datos, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onCambiar(respuesta.data.data.url);
      setError("");
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo subir la imagen. Intentá nuevamente.",
      );
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Stack gap="1.5">
      <Text fontSize="sm" fontWeight="medium" color="ink.800">
        {etiqueta}
      </Text>

      <Flex
        align="center"
        gap="4"
        p="3"
        borderWidth="1px"
        borderStyle="dashed"
        borderColor={error ? "red.300" : "ink.300"}
        borderRadius="lg"
        bg="ink.50"
        wrap="wrap"
      >
        <Flex
          align="center"
          justify="center"
          w="20"
          h="20"
          flexShrink={0}
          borderRadius="md"
          overflow="hidden"
          bg="white"
          color="ink.400"
          borderWidth="1px"
          borderColor="ink.200"
        >
          {subiendo ? (
            <Spinner size="md" color="brand.500" />
          ) : src ? (
            <chakra.img
              src={src}
              alt={etiqueta}
              w="full"
              h="full"
              objectFit="cover"
            />
          ) : (
            <ImagePlus size={26} />
          )}
        </Flex>

        <Stack gap="1.5" flex="1" minW="8rem">
          <Button
            type="button"
            size="xs"
            variant="outline"
            colorPalette="brand"
            alignSelf="flex-start"
            loading={subiendo}
            loadingText="Subiendo…"
            onClick={() => input.current?.click()}
          >
            {url ? "Cambiar foto" : "Subir foto"}
          </Button>
          <Text fontSize="2xs" color="ink.500">
            {ayuda}
          </Text>
        </Stack>
      </Flex>

      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp"
        hidden
        aria-label={etiqueta}
        onChange={(evento) => void subir(evento.target.files?.[0])}
      />

      {error && (
        <Text fontSize="xs" color="red.600">
          {error}
        </Text>
      )}
    </Stack>
  );
}

/* ─────────────────────────────────── Formulario ─────────────────────────────────── */

export function GroomingForm({
  abierto,
  sesion,
  onClose,
  onGuardado,
}: GroomingFormProps) {
  const { puede } = useAuth();
  const crear = useCrearGroomingSesion();
  const actualizar = useActualizarGroomingSesion();
  const peluqueros = usePeluquerosGrooming();

  const [textoPaciente, setTextoPaciente] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] =
    useState<PacienteGrooming | null>(null);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);

  const [tipoServicio, setTipoServicio] = useState("");
  const [peluqueroId, setPeluqueroId] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [estado, setEstado] = useState<EstadoGrooming>("pendiente");
  const [precio, setPrecio] = useState("0");
  const [observaciones, setObservaciones] = useState("");
  const [fotoAntesUrl, setFotoAntesUrl] = useState("");
  const [fotoDespuesUrl, setFotoDespuesUrl] = useState("");

  const [errores, setErrores] = useState<Errores>({});
  const [errorFormulario, setErrorFormulario] = useState("");

  const busquedaPacientes = useBuscarPacientesGrooming(textoPaciente);
  const resultados = busquedaPacientes.data ?? [];
  const mostrarLista =
    listaAbierta && textoPaciente.trim().length >= 2 && !pacienteSeleccionado;
  const guardando = crear.isPending || actualizar.isPending;
  const permiteEditar = puede(
    sesion ? "grooming.editar" : "grooming.crear",
  );
  const estadoBloqueado =
    sesion?.estado === "finalizada" || sesion?.estado === "cancelada";

  useEffect(() => {
    if (!abierto) return;

    setErrores({});
    setErrorFormulario("");
    setListaAbierta(false);
    setIndiceActivo(0);

    if (!sesion) {
      const inicio = inicioPorDefecto();
      setPacienteSeleccionado(null);
      setTextoPaciente("");
      setTipoServicio("");
      setPeluqueroId("");
      setFechaInicio(paraInputFechaHora(inicio));
      setFechaFin(paraInputFechaHora(finPorDefecto(inicio)));
      setEstado("pendiente");
      setPrecio("0");
      setObservaciones("");
      setFotoAntesUrl("");
      setFotoDespuesUrl("");
      return;
    }

    const paciente: PacienteGrooming = {
      id: sesion.paciente.id,
      nombre: sesion.paciente.nombre,
      especie: sesion.paciente.especie,
      cliente: sesion.paciente.cliente,
    };
    setPacienteSeleccionado(paciente);
    setTextoPaciente(paciente.nombre);
    setTipoServicio(sesion.tipoServicio ?? "");
    setPeluqueroId(sesion.peluqueroId ? String(sesion.peluqueroId) : "");
    setFechaInicio(desdeISOFechaHora(sesion.fechaInicio));
    setFechaFin(desdeISOFechaHora(sesion.fechaFin));
    setEstado(sesion.estado);
    setPrecio(String(Number(sesion.precio)));
    setObservaciones(sesion.observaciones ?? "");
    setFotoAntesUrl(sesion.fotoAntesUrl ?? "");
    setFotoDespuesUrl(sesion.fotoDespuesUrl ?? "");
  }, [abierto, sesion]);

  useEffect(() => setIndiceActivo(0), [textoPaciente]);

  function limpiarError(campo: keyof Errores) {
    setErrores((actuales) => ({ ...actuales, [campo]: undefined }));
    setErrorFormulario("");
  }

  function elegirPaciente(paciente: PacienteGrooming) {
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
      setIndiceActivo((i) =>
        Math.min(i + 1, Math.max(resultados.length - 1, 0)),
      );
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

  function validar(): Errores {
    const nuevos: Errores = {};

    if (!pacienteSeleccionado) {
      nuevos.pacienteId = "Seleccioná el paciente que se va a atender.";
    }
    if (!fechaInicio || Number.isNaN(new Date(fechaInicio).getTime())) {
      nuevos.fechaInicio = "Ingresá una fecha de inicio válida.";
    }
    if (!fechaFin || Number.isNaN(new Date(fechaFin).getTime())) {
      nuevos.fechaFin = "Ingresá una hora de fin válida.";
    } else if (fechaInicio && new Date(fechaFin) <= new Date(fechaInicio)) {
      nuevos.fechaFin = "La hora de fin debe ser posterior al inicio.";
    }
    const valorPrecio = aNumero(precio);
    if (!Number.isFinite(valorPrecio) || valorPrecio < 0) {
      nuevos.precio = "Ingresá un precio válido, mayor o igual a cero.";
    }

    return nuevos;
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorFormulario("");

    if (!permiteEditar) {
      setErrorFormulario("Tu rol no tiene permiso para guardar sesiones.");
      return;
    }

    const nuevos = validar();
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;
    if (!pacienteSeleccionado) return;

    const datos: GroomingFormData = {
      pacienteId: pacienteSeleccionado.id,
      peluqueroId: peluqueroId ? Number(peluqueroId) : null,
      fechaInicio: new Date(fechaInicio).toISOString(),
      fechaFin: new Date(fechaFin).toISOString(),
      tipoServicio: tipoServicio.trim() || null,
      estado,
      precio: aNumero(precio),
      observaciones: observaciones.trim() || null,
      fotoAntesUrl: fotoAntesUrl || null,
      fotoDespuesUrl: fotoDespuesUrl || null,
    };

    try {
      const guardada = sesion
        ? await actualizar.mutateAsync({ id: sesion.id, datos })
        : await crear.mutateAsync(datos);
      toaster.success({
        title: sesion ? "Sesión actualizada" : "Sesión registrada",
        description: `${pacienteSeleccionado.nombre} · la agenda quedó sincronizada.`,
      });
      if (onGuardado) onGuardado(guardada);
      else onClose();
    } catch (error) {
      const mensaje = mensajeDeError(error);
      setErrorFormulario(mensaje);
      toaster.error({
        title: "No se pudo guardar la sesión",
        description: mensaje,
      });
    }
  }

  return (
    <FormDialog
      abierto={abierto}
      onClose={onClose}
      titulo={sesion ? "Editar sesión de grooming" : "Nueva sesión de grooming"}
      descripcion={
        sesion
          ? "Actualizá el servicio, el horario y el seguimiento de la sesión."
          : "Registrá la atención; la cita se crea o vincula sola en la agenda."
      }
      ancho="xl"
      guardando={guardando}
      bloquearCierre={guardando}
      textoConfirmar={sesion ? "Guardar cambios" : "Registrar sesión"}
      onConfirmar={() =>
        document
          .querySelector<HTMLFormElement>(`#${ID_FORMULARIO}`)
          ?.requestSubmit()
      }
    >
      <chakra.form id={ID_FORMULARIO} onSubmit={enviar} noValidate>
        <Flex direction="column" gap="4">
          {errorFormulario && (
            <Alert status="error" rounded="md">
              {errorFormulario}
            </Alert>
          )}
          {!permiteEditar && !errorFormulario && (
            <Alert status="info" rounded="md">
              Tu rol tiene acceso de solo lectura a las sesiones.
            </Alert>
          )}

          <Alert status="info" rounded="md">
            <CalendarDays size={16} />
            <Text fontSize="xs">
              Al guardar, esta sesión se refleja en la agenda como una cita de
              peluquería. Si ya existe una cita compatible, se vincula en vez de
              duplicarla.
            </Text>
          </Alert>

          {/* Paciente */}
          <Seccion
            icono={PawPrint}
            titulo="Paciente"
            descripcion="¿A quién corresponde esta sesión?"
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

          {/* Servicio */}
          <Seccion
            icono={Scissors}
            titulo="Servicio y horario"
            descripcion="Qué se hace, cuándo y quién lo atiende."
          >
            <Grid
              templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }}
              gap="4"
            >
              <Campo
                id="grooming-servicio"
                etiqueta="Tipo de servicio"
                ayuda="Elegí una sugerencia o escribí el servicio realizado."
                anchoCompleto
              >
                <Input
                  value={tipoServicio}
                  onChange={(evento) => setTipoServicio(evento.target.value)}
                  placeholder="Ej.: Baño y corte"
                  list="grooming-servicios-sugeridos"
                  maxLength={100}
                />
                <datalist id="grooming-servicios-sugeridos">
                  {SERVICIOS_SUGERIDOS.map((servicio) => (
                    <option key={servicio} value={servicio} />
                  ))}
                </datalist>
              </Campo>

              <Campo
                id="grooming-peluquero"
                etiqueta="Peluquero"
                ayuda="Opcional. Podés asignarlo más adelante."
              >
                <NativeSelect.Root disabled={peluqueros.isPending}>
                  <NativeSelect.Field
                    value={peluqueroId}
                    onChange={(evento) => setPeluqueroId(evento.target.value)}
                  >
                    <option value="">Sin asignar</option>
                    {(peluqueros.data ?? []).map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.nombre} {persona.apellido}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Campo>

              <Campo
                id="grooming-estado"
                etiqueta="Estado"
                ayuda={
                  estadoBloqueado
                    ? "Una sesión finalizada o cancelada ya no cambia de estado."
                    : undefined
                }
              >
                <NativeSelect.Root disabled={estadoBloqueado}>
                  <NativeSelect.Field
                    value={estado}
                    onChange={(evento) =>
                      setEstado(evento.target.value as EstadoGrooming)
                    }
                  >
                    {ESTADOS_GROOMING.map((item) => (
                      <option key={item.valor} value={item.valor}>
                        {item.etiqueta}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Campo>

              <Campo
                id="grooming-inicio"
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
                    limpiarError("fechaFin");
                  }}
                />
              </Campo>

              <Campo
                id="grooming-fin"
                etiqueta="Fin"
                requerido
                error={errores.fechaFin}
                ayuda="La sesión no puede durar más de 8 horas."
              >
                <Input
                  type="datetime-local"
                  value={fechaFin}
                  onChange={(evento) => {
                    setFechaFin(evento.target.value);
                    limpiarError("fechaFin");
                  }}
                />
              </Campo>

              <Campo
                id="grooming-precio"
                etiqueta="Precio"
                requerido
                error={errores.precio}
                ayuda="En guaraníes. Podés registrarlo en cero y cobrarlo después."
              >
                <Input
                  type="number"
                  min="0"
                  step="500"
                  value={precio}
                  onChange={(evento) => {
                    setPrecio(evento.target.value);
                    limpiarError("precio");
                  }}
                  ps="8"
                />
              </Campo>

              <Campo
                id="grooming-observaciones"
                etiqueta="Observaciones"
                ayuda="Indicaciones, estado del pelaje, alergias o notas del servicio."
                anchoCompleto
              >
                <Textarea
                  value={observaciones}
                  onChange={(evento) => setObservaciones(evento.target.value)}
                  rows={3}
                  maxLength={10000}
                  placeholder="Ej.: Se trabajó con máquina 3 mm, sin nudos…"
                  resize="vertical"
                />
              </Campo>
            </Grid>
          </Seccion>

          {/* Fotos */}
          <Seccion
            icono={Wallet}
            titulo="Fotos del antes y después"
            descripcion="Opcional. Sirven como registro visual del trabajo realizado."
          >
            <Grid
              templateColumns={{ base: "1fr", sm: "repeat(2, minmax(0, 1fr))" }}
              gap="4"
            >
              <CampoFoto
                id="grooming-foto-antes"
                etiqueta="Antes"
                ayuda="JPG, PNG, WEBP, GIF, AVIF o BMP hasta 5 MB."
                url={fotoAntesUrl}
                onCambiar={(url) => setFotoAntesUrl(url ?? "")}
              />
              <CampoFoto
                id="grooming-foto-despues"
                etiqueta="Después"
                ayuda="JPG, PNG, WEBP, GIF, AVIF o BMP hasta 5 MB."
                url={fotoDespuesUrl}
                onCambiar={(url) => setFotoDespuesUrl(url ?? "")}
              />
            </Grid>

            {(fotoAntesUrl || fotoDespuesUrl) && (
              <Button
                type="button"
                size="xs"
                variant="ghost"
                colorPalette="red"
                mt="3"
                onClick={() => {
                  setFotoAntesUrl("");
                  setFotoDespuesUrl("");
                }}
              >
                <X size={14} /> Quitar ambas fotos
              </Button>
            )}
          </Seccion>
        </Flex>
      </chakra.form>
    </FormDialog>
  );
}
