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
  Skeleton,
  Spinner,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import {
  CalendarClock,
  FileText,
  Image as ImageIcon,
  Package,
  PawPrint,
  Search,
  Syringe,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import { urlFotoPaciente } from "@/features/patients/patients.service";
import { ApiError, api } from "@/services/api";
import type { RespuestaUpload, Vacunacion } from "@/types/dominio";
import {
  useActualizarVacunacion,
  useBuscarPacientesVacunacion,
  useCrearVacunacion,
  type PacienteVacunacion,
  type VacunacionFormData,
} from "./vaccinations.service";

/* ──────────────────────────────── Tipos y datos ──────────────────────────────── */

interface ValoresVacunacion {
  pacienteId: number | null;
  nombreVacuna: string;
  lote: string;
  fechaAplicacion: string;
  fechaProxima: string;
  via: string;
  loteVenceEn: string;
  certificadoUrl: string;
}

type Errores = Partial<Record<keyof ValoresVacunacion, string>>;

const VALORES_INICIALES: ValoresVacunacion = {
  pacienteId: null,
  nombreVacuna: "",
  lote: "",
  fechaAplicacion: fechaHoraLocal(),
  fechaProxima: "",
  via: "",
  loteVenceEn: "",
  certificadoUrl: "",
};

/** Orden de los campos en pantalla, para enfocar el primero con error. */
const ORDEN_CAMPOS: (keyof ValoresVacunacion)[] = [
  "pacienteId",
  "nombreVacuna",
  "via",
  "lote",
  "loteVenceEn",
  "fechaAplicacion",
  "fechaProxima",
];

/** Id del control de cada campo (para enfocarlo y vincular etiquetas). */
const ID_CAMPO: Record<keyof ValoresVacunacion, string> = {
  pacienteId: "vacunacion-paciente",
  nombreVacuna: "vacunacion-nombre",
  via: "vacunacion-via",
  lote: "vacunacion-lote",
  loteVenceEn: "vacunacion-lote-vence",
  fechaAplicacion: "vacunacion-fecha-aplicacion",
  fechaProxima: "vacunacion-fecha-proxima",
  certificadoUrl: "vacunacion-certificado",
};

const SUGERENCIAS_VACUNA = ["Antirrábica", "Séxtuple", "Quíntuple", "Triple felina"];
const SUGERENCIAS_VIA = ["Subcutánea", "Intramuscular", "Oral", "Intranasal"];

const MAX_CERTIFICADO_BYTES = 5 * 1024 * 1024;
const TIPOS_CERTIFICADO = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
]);
const ACEPTA_CERTIFICADO =
  "application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp,image/gif,.gif,image/avif,.avif,image/bmp,.bmp";

const ES_IMAGEN = /\.(?:jpe?g|png|webp|gif|avif|bmp)$/i;

/* ─────────────────────────────────── Utilidades ─────────────────────────────────── */

function fechaHoraLocal(fecha = new Date()) {
  const diferencia = fecha.getTimezoneOffset() * 60_000;
  return new Date(fecha.getTime() - diferencia).toISOString().slice(0, 16);
}

function fechaIsoLocal(fecha: Date) {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** Suma días o meses a una fecha "AAAA-MM-DD" sin problemas de zona horaria. */
function sumarAFecha(base: string, { dias = 0, meses = 0 }: { dias?: number; meses?: number }) {
  const [anio, mes, dia] = (base || fechaIsoLocal(new Date())).split("-").map(Number);
  return fechaIsoLocal(new Date(anio, mes - 1 + meses, dia + dias));
}

function formatearFechaCorta(iso: string) {
  const [anio, mes, dia] = iso.slice(0, 10).split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : iso;
}

function nombreResponsable(paciente: PacienteVacunacion | null) {
  const cliente = paciente?.cliente;
  if (!cliente) return "Responsable sin registrar";
  return (
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ") ||
    cliente.razonSocial ||
    cliente.documento ||
    "Responsable sin registrar"
  );
}

/* ───────────────────────────── Componentes de apoyo ───────────────────────────── */

/** Tarjeta de sección: título con icono y los campos dentro. */
function Seccion({
  icono: Icono,
  titulo,
  descripcion,
  children,
}: {
  icono: typeof Syringe;
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
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
        <Box minW="0">
          <Text fontSize="sm" fontWeight="semibold" color="ink.900" lineHeight="1.3">
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

/** Campo de Chakra (Field) con etiqueta, ayuda y error ya resueltos. */
function Campo({
  id,
  etiqueta,
  requerido,
  error,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  requerido?: boolean;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
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
  );
}

/** Atajos que completan el campo con un toque. */
function Atajos({
  opciones,
  activo,
  onElegir,
  disabled,
}: {
  opciones: { etiqueta: string; valor: string }[];
  activo?: string;
  onElegir: (valor: string) => void;
  disabled?: boolean;
}) {
  return (
    <Flex gap="1.5" wrap="wrap">
      {opciones.map((opcion) => {
        const seleccionado = activo === opcion.valor;
        return (
          <Button
            key={opcion.etiqueta}
            type="button"
            size="2xs"
            variant={seleccionado ? "subtle" : "outline"}
            colorPalette={seleccionado ? "brand" : "gray"}
            borderRadius="full"
            disabled={disabled}
            onClick={() => onElegir(opcion.valor)}
            aria-pressed={seleccionado}
          >
            {opcion.etiqueta}
          </Button>
        );
      })}
    </Flex>
  );
}

function AvatarPaciente({
  nombre,
  size = "md",
}: {
  nombre: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <Avatar.Root size={size} colorPalette="brand" flexShrink={0}>
      <Avatar.Fallback name={nombre} />
    </Avatar.Root>
  );
}

/* ─────────────────────────────────── Formulario ─────────────────────────────────── */

export function VacunacionForm({
  abierto,
  vacunacion,
  onClose,
  onGuardado,
}: {
  abierto: boolean;
  vacunacion: Vacunacion | null;
  onClose: () => void;
  onGuardado: (vacunacion: Vacunacion) => void;
}) {
  const { puede } = useAuth();
  const [valores, setValores] = useState<ValoresVacunacion>(VALORES_INICIALES);
  const [errores, setErrores] = useState<Errores>({});
  const [textoPaciente, setTextoPaciente] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] =
    useState<PacienteVacunacion | null>(null);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const [errorFormulario, setErrorFormulario] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const inputCertificado = useRef<HTMLInputElement>(null);
  const cuerpo = useRef<HTMLDivElement>(null);

  const busquedaPacientes = useBuscarPacientesVacunacion(textoPaciente);
  const crear = useCrearVacunacion();
  const actualizar = useActualizarVacunacion();
  const guardando = crear.isPending || actualizar.isPending || subiendo;
  const permiteEditar = puede("vacunaciones.editar") || puede("vacunaciones.crear");

  const resultados = busquedaPacientes.data ?? [];
  const mostrarLista =
    listaAbierta && textoPaciente.trim().length >= 2 && !pacienteSeleccionado;

  useEffect(() => {
    if (!abierto) return;
    setErrorFormulario("");
    setErrores({});
    setListaAbierta(false);
    setArrastrando(false);

    if (!vacunacion) {
      setValores({ ...VALORES_INICIALES, fechaAplicacion: fechaHoraLocal() });
      setTextoPaciente("");
      setPacienteSeleccionado(null);
      return;
    }

    const paciente: PacienteVacunacion = {
      id: vacunacion.paciente.id,
      nombre: vacunacion.paciente.nombre,
      especie: vacunacion.paciente.especie,
      cliente: vacunacion.paciente.cliente,
    };
    setPacienteSeleccionado(paciente);
    setTextoPaciente(paciente.nombre);
    setValores({
      pacienteId: paciente.id,
      nombreVacuna: vacunacion.nombreVacuna,
      lote: vacunacion.lote ?? "",
      fechaAplicacion: fechaHoraLocal(new Date(vacunacion.fechaAplicacion)),
      fechaProxima: vacunacion.fechaProxima?.slice(0, 10) ?? "",
      via: vacunacion.via ?? "",
      loteVenceEn: vacunacion.loteVenceEn?.slice(0, 10) ?? "",
      certificadoUrl: vacunacion.certificadoUrl ?? "",
    });
  }, [abierto, vacunacion]);

  // Al cambiar el texto de búsqueda, la selección con teclado vuelve al primer resultado.
  useEffect(() => {
    setIndiceActivo(0);
  }, [textoPaciente]);

  function cambiar<K extends keyof ValoresVacunacion>(campo: K, valor: ValoresVacunacion[K]) {
    setValores((anterior) => ({ ...anterior, [campo]: valor }));
    setErrores((anterior) => ({ ...anterior, [campo]: undefined }));
    setErrorFormulario("");
  }

  function elegirPaciente(paciente: PacienteVacunacion) {
    setPacienteSeleccionado(paciente);
    setTextoPaciente(paciente.nombre);
    setListaAbierta(false);
    cambiar("pacienteId", paciente.id);
  }

  function quitarPaciente() {
    setPacienteSeleccionado(null);
    setTextoPaciente("");
    cambiar("pacienteId", null);
    // Devuelve el foco al buscador una vez que se vuelve a mostrar.
    setTimeout(() => document.getElementById(ID_CAMPO.pacienteId)?.focus(), 0);
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
      evento.preventDefault(); // evita enviar el formulario
      const elegido = resultados[indiceActivo];
      if (elegido) elegirPaciente(elegido);
    } else if (evento.key === "Escape") {
      evento.stopPropagation(); // cierra la lista, no el diálogo
      setListaAbierta(false);
    }
  }

  async function subirCertificado(archivo?: File) {
    if (!archivo) return;
    setErrorFormulario("");

    if (!TIPOS_CERTIFICADO.has(archivo.type)) {
      setErrorFormulario(
        "Adjuntá un certificado PDF o una imagen JPG, PNG, WEBP, GIF, AVIF o BMP.",
      );
      if (inputCertificado.current) inputCertificado.current.value = "";
      return;
    }
    if (archivo.size === 0 || archivo.size > MAX_CERTIFICADO_BYTES) {
      setErrorFormulario("El certificado debe pesar entre 1 byte y 5 MB.");
      if (inputCertificado.current) inputCertificado.current.value = "";
      return;
    }

    const datos = new FormData();
    datos.append("archivo", archivo);
    setSubiendo(true);
    try {
      const respuesta = await api.post<RespuestaUpload>("/uploads", datos, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      cambiar("certificadoUrl", respuesta.data.data.url);
    } catch (error) {
      const mensaje = mensajeDeError(error);
      setErrorFormulario(mensaje);
      toaster.error({ title: "No se pudo subir el certificado", description: mensaje });
    } finally {
      setSubiendo(false);
      if (inputCertificado.current) inputCertificado.current.value = "";
    }
  }

  function validar(): Errores {
    const nuevos: Errores = {};

    if (!pacienteSeleccionado || !valores.pacienteId) {
      nuevos.pacienteId = "Seleccioná el paciente que recibió la vacuna.";
    }
    if (valores.nombreVacuna.trim().length < 2) {
      nuevos.nombreVacuna = "Ingresá el nombre de la vacuna.";
    }
    if (!valores.fechaAplicacion || Number.isNaN(new Date(valores.fechaAplicacion).getTime())) {
      nuevos.fechaAplicacion = "Ingresá una fecha y hora válidas.";
    } else {
      const diaAplicacion = valores.fechaAplicacion.slice(0, 10);
      if (valores.fechaProxima && valores.fechaProxima < diaAplicacion) {
        nuevos.fechaProxima = "La próxima dosis no puede ser anterior a la aplicación.";
      }
      if (valores.loteVenceEn && valores.loteVenceEn < diaAplicacion) {
        nuevos.loteVenceEn = "El lote ya estaba vencido el día de la aplicación.";
      }
    }

    setErrores(nuevos);
    return nuevos;
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErrorFormulario("");

    if (!permiteEditar) {
      setErrorFormulario("Tu rol no tiene permiso para registrar vacunaciones.");
      return;
    }

    const nuevos = validar();
    const primero = ORDEN_CAMPOS.find((campo) => nuevos[campo]);
    if (primero) {
      document.getElementById(ID_CAMPO[primero])?.focus();
      return;
    }
    if (!pacienteSeleccionado || !valores.pacienteId) return;

    const datos: VacunacionFormData = {
      pacienteId: valores.pacienteId,
      nombreVacuna: valores.nombreVacuna.trim(),
      lote: valores.lote.trim() || null,
      fechaAplicacion: new Date(valores.fechaAplicacion).toISOString(),
      fechaProxima: valores.fechaProxima || null,
      via: valores.via.trim() || null,
      loteVenceEn: valores.loteVenceEn || null,
      certificadoUrl: valores.certificadoUrl || null,
    };

    try {
      const guardada = vacunacion
        ? await actualizar.mutateAsync({ id: vacunacion.id, datos })
        : await crear.mutateAsync(datos);
      toaster.success({
        title: vacunacion ? "Vacunación actualizada" : "Vacunación registrada",
        description: guardada.fechaProxima
          ? `${pacienteSeleccionado.nombre} · ${guardada.nombreVacuna} · próxima dosis ${guardada.fechaProxima.slice(0, 10)} a las 08:00`
          : `${pacienteSeleccionado.nombre} · ${guardada.nombreVacuna}`,
      });
      onGuardado(guardada);
    } catch (error) {
      const detalle =
        error instanceof ApiError && error.errors
          ? Object.entries(error.errors)
              .flatMap(([campo, mensajes]) => mensajes.map((mensaje) => `${campo}: ${mensaje}`))
              .join(" · ")
          : "";
      const mensaje = detalle ? `${mensajeDeError(error)} ${detalle}` : mensajeDeError(error);
      setErrorFormulario(mensaje);
      cuerpo.current?.scrollTo({ top: 0, behavior: "smooth" });
      toaster.error({ title: "No se pudo guardar la vacunación", description: mensaje });
    }
  }

  const certificadoEsImagen = ES_IMAGEN.test(valores.certificadoUrl);
  const IconoCertificado = certificadoEsImagen ? ImageIcon : FileText;
  const diaAplicacion = valores.fechaAplicacion.slice(0, 10);

  return (
    <DialogRoot
      open={abierto}
      onOpenChange={(detalle) => {
        if (!detalle.open && !guardando) onClose();
      }}
      size="cover"
      motionPreset="slide-in-bottom"
    >
      <DialogContent
        maxW="52rem"
        maxH="calc(100dvh - 2rem)"
        p="0"
        overflow="hidden"
        display="flex"
        flexDirection="column"
      >
        {/* ── Encabezado ─────────────────────────────────────────────── */}
        <DialogHeader px={{ base: "4", md: "6" }} py="5" pr="16" bg="white" borderBottomWidth="1px" borderColor="ink.200">
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
              <Syringe size={22} />
            </Flex>
            <Box minW="0">
              <DialogTitle fontSize="lg" fontWeight="bold" color="ink.900" lineHeight="1.25">
                {vacunacion ? "Editar vacunación" : "Registrar vacunación"}
              </DialogTitle>
              <Text color="ink.600" fontSize="sm" mt="0.5">
                {vacunacion
                  ? "Corregí los datos de esta aplicación."
                  : "Dejá constancia de la vacuna aplicada y agendá la próxima dosis."}
              </Text>
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
          onClick={onClose}
          disabled={guardando}
          aria-label="Cerrar formulario"
        >
          <X size={18} />
        </IconButton>

        {/* ── Cuerpo ─────────────────────────────────────────────────── */}
        <DialogBody
          ref={cuerpo}
          px={{ base: "4", md: "6" }}
          py="5"
          flex="1"
          minH="0"
          overflowY="auto"
          bg="ink.50"
        >
          <chakra.form id="vacunacion-form" onSubmit={enviar} noValidate>
            <Stack gap="4">
              {!permiteEditar && (
                <Alert status="info" rounded="md">
                  Tu rol no tiene permiso para registrar vacunaciones. Podés ver los datos, pero no guardarlos.
                </Alert>
              )}
              {errorFormulario && (
                <Alert status="error" rounded="md">
                  {errorFormulario}
                </Alert>
              )}

              {/* Paciente */}
              <Seccion
                icono={PawPrint}
                titulo="Paciente"
                descripcion="¿Quién recibió la vacuna?"
              >
                {pacienteSeleccionado ? (
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" color="ink.800" mb="1.5">
                      Paciente seleccionado
                    </Text>
                    <Flex
                      align="center"
                      gap="3"
                      p="3"
                      borderWidth="1px"
                      borderColor="brand.200"
                      bg="brand.50"
                      borderRadius="lg"
                    >
                      <AvatarPaciente nombre={pacienteSeleccionado.nombre} size="lg" />
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
                      {!vacunacion && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          colorPalette="brand"
                          onClick={quitarPaciente}
                        >
                          Cambiar
                        </Button>
                      )}
                    </Flex>
                  </Box>
                ) : (
                  <Box
                    position="relative"
                    onBlur={(evento: React.FocusEvent<HTMLElement>) => {
                      if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) {
                        setListaAbierta(false);
                      }
                    }}
                  >
                    <Campo
                      id={ID_CAMPO.pacienteId}
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
                            cambiar("pacienteId", null);
                          }}
                          onFocus={() => setListaAbierta(true)}
                          onKeyDown={teclasBuscador}
                          placeholder="Ej.: Luna, o el nombre del responsable"
                          autoComplete="off"
                          role="combobox"
                          aria-expanded={mostrarLista}
                          aria-controls="vacunacion-lista-pacientes"
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
                        id="vacunacion-lista-pacientes"
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
                            No se pudo buscar pacientes: {mensajeDeError(busquedaPacientes.error)}
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
                                // Evita que el buscador pierda el foco al hacer clic.
                                onMouseDown={(evento: React.MouseEvent) => evento.preventDefault()}
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
                                <AvatarPaciente nombre={paciente.nombre} size="sm" />
                                <Box minW="0">
                                  <Text fontSize="sm" fontWeight="semibold" color="ink.900" truncate>
                                    {paciente.nombre}
                                  </Text>
                                  <Text fontSize="xs" color="ink.600" truncate>
                                    {paciente.especie?.nombre ?? "Especie sin registrar"} ·{" "}
                                    {nombreResponsable(paciente)}
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

              {/* Vacuna y lote */}
              <Seccion
                icono={Package}
                titulo="Vacuna y lote"
                descripcion="Qué se aplicó y de qué lote salió."
              >
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="5">
                  <Stack gap="2">
                    <Campo
                      id={ID_CAMPO.nombreVacuna}
                      etiqueta="Nombre de la vacuna"
                      requerido
                      error={errores.nombreVacuna}
                    >
                      <Input
                        value={valores.nombreVacuna}
                        onChange={(e) => cambiar("nombreVacuna", e.target.value)}
                        maxLength={150}
                        placeholder="Ej.: Antirrábica, séxtuple"
                      />
                    </Campo>
                    <Atajos
                      opciones={SUGERENCIAS_VACUNA.map((v) => ({ etiqueta: v, valor: v }))}
                      activo={valores.nombreVacuna}
                      onElegir={(valor) => cambiar("nombreVacuna", valor)}
                    />
                  </Stack>

                  <Stack gap="2">
                    <Campo
                      id={ID_CAMPO.via}
                      etiqueta="Vía de administración"
                      error={errores.via}
                    >
                      <Input
                        value={valores.via}
                        onChange={(e) => cambiar("via", e.target.value)}
                        maxLength={20}
                        placeholder="Ej.: Subcutánea"
                      />
                    </Campo>
                    <Atajos
                      opciones={SUGERENCIAS_VIA.map((v) => ({ etiqueta: v, valor: v }))}
                      activo={valores.via}
                      onElegir={(valor) => cambiar("via", valor)}
                    />
                  </Stack>

                  <Campo id={ID_CAMPO.lote} etiqueta="Número de lote" error={errores.lote}>
                    <Input
                      value={valores.lote}
                      onChange={(e) => cambiar("lote", e.target.value)}
                      maxLength={60}
                    />
                  </Campo>

                  <Campo
                    id={ID_CAMPO.loteVenceEn}
                    etiqueta="Vencimiento del lote"
                    error={errores.loteVenceEn}
                  >
                    <Input
                      type="date"
                      value={valores.loteVenceEn}
                      onChange={(e) => cambiar("loteVenceEn", e.target.value)}
                    />
                  </Campo>
                </Grid>
              </Seccion>

              {/* Aplicación y próxima dosis */}
              <Seccion
                icono={CalendarClock}
                titulo="Aplicación y próxima dosis"
                descripcion="Cuándo se aplicó y cuándo toca el refuerzo."
              >
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="5">
                  <Campo
                    id={ID_CAMPO.fechaAplicacion}
                    etiqueta="Fecha y hora de aplicación"
                    requerido
                    error={errores.fechaAplicacion}
                  >
                    <Input
                      type="datetime-local"
                      value={valores.fechaAplicacion}
                      onChange={(e) => cambiar("fechaAplicacion", e.target.value)}
                    />
                  </Campo>

                  <Stack gap="2">
                    <Campo
                      id={ID_CAMPO.fechaProxima}
                      etiqueta="Próxima dosis"
                      error={errores.fechaProxima}
                      ayuda={
                        valores.fechaProxima
                          ? `Se agenda para las 08:00 del ${formatearFechaCorta(valores.fechaProxima)}.`
                          : "Opcional. Elegí una fecha o usá un atajo."
                      }
                    >
                      <Input
                        type="date"
                        value={valores.fechaProxima}
                        min={diaAplicacion || undefined}
                        onChange={(e) => cambiar("fechaProxima", e.target.value)}
                      />
                    </Campo>
                    <Atajos
                      opciones={[
                        { etiqueta: "+21 días", valor: sumarAFecha(diaAplicacion, { dias: 21 }) },
                        { etiqueta: "+1 mes", valor: sumarAFecha(diaAplicacion, { meses: 1 }) },
                        { etiqueta: "+1 año", valor: sumarAFecha(diaAplicacion, { meses: 12 }) },
                      ]}
                      activo={valores.fechaProxima}
                      onElegir={(valor) => cambiar("fechaProxima", valor)}
                    />
                  </Stack>
                </Grid>
              </Seccion>

              {/* Certificado */}
              <Seccion
                icono={FileText}
                titulo="Certificado de vacunación"
                descripcion="Opcional. PDF o imagen, hasta 5 MB."
              >
                <input
                  ref={inputCertificado}
                  id={ID_CAMPO.certificadoUrl}
                  type="file"
                  accept={ACEPTA_CERTIFICADO}
                  hidden
                  onChange={(event) => void subirCertificado(event.target.files?.[0])}
                />

                {valores.certificadoUrl ? (
                  <Flex
                    align="center"
                    gap="3"
                    p="3"
                    borderWidth="1px"
                    borderColor="ink.200"
                    borderRadius="lg"
                    wrap="wrap"
                  >
                    <Flex
                      align="center"
                      justify="center"
                      w="10"
                      h="10"
                      flexShrink={0}
                      borderRadius="md"
                      bg="brand.50"
                      color="brand.600"
                    >
                      <IconoCertificado size={20} />
                    </Flex>
                    <Box flex="1" minW="10rem">
                      <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                        Certificado adjunto
                      </Text>
                      <Text fontSize="xs" color="ink.600">
                        {certificadoEsImagen ? "Imagen" : "Documento PDF"}
                      </Text>
                    </Box>
                    <Flex gap="1.5" wrap="wrap">
                      <Button asChild size="xs" variant="outline">
                        <a href={urlFotoPaciente(valores.certificadoUrl)} target="_blank" rel="noreferrer">
                          Ver
                        </a>
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        loading={subiendo}
                        onClick={() => inputCertificado.current?.click()}
                      >
                        Reemplazar
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        colorPalette="red"
                        disabled={subiendo}
                        onClick={() => cambiar("certificadoUrl", "")}
                      >
                        <Trash2 size={14} />
                        Quitar
                      </Button>
                    </Flex>
                  </Flex>
                ) : (
                  <Flex
                    direction="column"
                    align="center"
                    gap="2"
                    px="4"
                    py="6"
                    textAlign="center"
                    borderWidth="1px"
                    borderStyle="dashed"
                    borderColor={arrastrando ? "brand.500" : "ink.300"}
                    bg={arrastrando ? "brand.50" : "ink.50"}
                    borderRadius="lg"
                    transition="background 0.15s ease, border-color 0.15s ease"
                    onDragOver={(evento: React.DragEvent) => {
                      evento.preventDefault();
                      if (!subiendo) setArrastrando(true);
                    }}
                    onDragLeave={(evento: React.DragEvent) => {
                      if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) {
                        setArrastrando(false);
                      }
                    }}
                    onDrop={(evento: React.DragEvent) => {
                      evento.preventDefault();
                      setArrastrando(false);
                      if (!subiendo) void subirCertificado(evento.dataTransfer.files[0]);
                    }}
                    role="group"
                    aria-label="Zona para adjuntar el certificado"
                  >
                    {subiendo ? <Spinner size="md" color="brand.600" /> : <Upload size={22} color="var(--chakra-colors-ink-400)" />}
                    <Text fontSize="sm" color="ink.700">
                      {subiendo ? "Subiendo certificado…" : "Arrastrá el archivo hasta acá o"}
                    </Text>
                    {!subiendo && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        colorPalette="brand"
                        onClick={() => inputCertificado.current?.click()}
                      >
                        Elegir archivo
                      </Button>
                    )}
                    <Text fontSize="xs" color="ink.500">
                      PDF, JPG, PNG, WEBP, GIF, AVIF o BMP · máximo 5 MB
                    </Text>
                  </Flex>
                )}
              </Seccion>
            </Stack>
          </chakra.form>
        </DialogBody>

        {/* ── Pie ────────────────────────────────────────────────────── */}
        <DialogFooter
          px={{ base: "4", md: "6" }}
          py="4"
          borderTopWidth="1px"
          borderColor="ink.200"
          gap="2"
          bg="white"
          justifyContent="space-between"
        >
          <Text fontSize="xs" color="ink.500" display={{ base: "none", sm: "block" }}>
            <chakra.span color="red.600">*</chakra.span> Campo obligatorio
          </Text>
          <Flex gap="2" w={{ base: "full", sm: "auto" }}>
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={guardando}
              flex={{ base: "1", sm: "initial" }}
            >
              Cancelar
            </Button>
            <Button
              colorPalette="brand"
              type="submit"
              form="vacunacion-form"
              loading={guardando}
              loadingText="Guardando…"
              disabled={!permiteEditar}
              flex={{ base: "1", sm: "initial" }}
            >
              {vacunacion ? "Guardar cambios" : "Registrar vacunación"}
            </Button>
          </Flex>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}