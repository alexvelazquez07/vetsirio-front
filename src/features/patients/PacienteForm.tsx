import {
  Avatar,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  IconButton,
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
  Activity,
  Camera,
  Check,
  CircleUserRound,
  PawPrint,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FormDialog } from "@/components/data/FormDialog";
import { Alert } from "@/components/ui/alert";
import {
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import {
  ClienteForm,
  type ClienteFormValues,
} from "@/features/clients/ClienteForm";
import {
  mensajeDeError,
  useBuscarClientes,
  useCrearCliente,
} from "@/features/clients/clients.service";
import { api } from "@/services/api";
import type { Paciente, RespuestaUpload } from "@/types/dominio";
import { useEspeciesPaciente, urlFotoPaciente } from "./patients.service";

/* ──────────────────────────────── Tipos y datos ──────────────────────────────── */

export interface PacienteFormValues {
  clienteId: number | null;
  especieId: number | null;
  nombre: string;
  raza: string;
  sexo: "" | "macho" | "hembra";
  fechaNacimiento: string;
  edadAnios: string;
  pesoKg: string;
  color: string;
  chipId: string;
  fotoUrl: string;
  esterilizado: boolean;
  desparasitado: boolean;
  alergias: string;
  notas: string;
  activo: boolean;
}

type Errores = Partial<Record<keyof PacienteFormValues, string>>;

const VALORES_INICIALES: PacienteFormValues = {
  clienteId: null,
  especieId: null,
  nombre: "",
  raza: "",
  sexo: "",
  fechaNacimiento: "",
  edadAnios: "",
  pesoKg: "",
  color: "",
  chipId: "",
  fotoUrl: "",
  esterilizado: false,
  desparasitado: false,
  alergias: "",
  notas: "",
  activo: true,
};

/** Orden de los campos validables en pantalla, para enfocar el primero con error. */
const ORDEN_CAMPOS: (keyof PacienteFormValues)[] = [
  "nombre",
  "especieId",
  "fechaNacimiento",
  "edadAnios",
  "pesoKg",
  "clienteId",
];

const ID_CAMPO: Partial<Record<keyof PacienteFormValues, string>> = {
  nombre: "paciente-nombre",
  especieId: "paciente-especie",
  raza: "paciente-raza",
  color: "paciente-color",
  clienteId: "paciente-responsable",
  fechaNacimiento: "paciente-fecha-nacimiento",
  edadAnios: "paciente-edad",
  pesoKg: "paciente-peso",
  chipId: "paciente-chip",
  alergias: "paciente-alergias",
  notas: "paciente-notas",
};

const MAX_FOTO_BYTES = 5 * 1024 * 1024;
const TIPOS_FOTO = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
]);

interface ClienteElegido {
  nombre: string;
  detalle: string;
}

/* ─────────────────────────────────── Utilidades ─────────────────────────────────── */

function nombreCliente(cliente?: Paciente["cliente"]) {
  if (!cliente) return "";
  return (
    [cliente.nombres, cliente.apellidos].filter(Boolean).join(" ") ||
    cliente.documento
  );
}

function detalleCliente(telefono?: string | null, documento?: string | null) {
  return [telefono, documento].filter(Boolean).join(" · ");
}

function edadDesdeFecha(fechaISO: string): string {
  const nacimiento = new Date(`${fechaISO}T00:00:00`);
  if (Number.isNaN(nacimiento.getTime())) return "";
  const hoy = new Date();
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  const pendiente =
    hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (pendiente) anios -= 1;
  if (anios < 0) return "";
  if (anios < 1) return "Menos de 1 año";
  return `${anios} ${anios === 1 ? "año" : "años"}`;
}

/* ───────────────────────────── Componentes de apoyo ───────────────────────────── */

/** Tarjeta de sección compacta: título en una sola línea. */
function Seccion({
  icono: Icono,
  titulo,
  children,
}: {
  icono: typeof PawPrint;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <chakra.section
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
    >
      <Flex
        align="center"
        gap="2.5"
        px={{ base: "4", md: "5" }}
        py="2.5"
        borderBottomWidth="1px"
        borderColor="ink.100"
      >
        <Flex
          align="center"
          justify="center"
          w="7"
          h="7"
          flexShrink={0}
          borderRadius="md"
          bg="brand.50"
          color="brand.600"
        >
          <Icono size={15} />
        </Flex>
        <Text fontSize="sm" fontWeight="semibold" color="ink.900">
          {titulo}
        </Text>
      </Flex>
      <Box p={{ base: "4", md: "5" }}>{children}</Box>
    </chakra.section>
  );
}

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
      <Field.Label fontSize="xs" fontWeight="medium" color="ink.800" mb="1">
        {etiqueta}
        {requerido && <Field.RequiredIndicator />}
      </Field.Label>
      {children}
      {error ? (
        <Field.ErrorText fontSize="xs" mt="0.5">
          {error}
        </Field.ErrorText>
      ) : ayuda ? (
        <Field.HelperText fontSize="xs" color="ink.500" mt="0.5">
          {ayuda}
        </Field.HelperText>
      ) : null}
    </Field.Root>
  );
}

/** Input numérico con la unidad a la derecha. */
function InputConUnidad({
  unidad,
  ...props
}: { unidad: string } & React.ComponentProps<typeof Input>) {
  return (
    <Box position="relative" w="full">
      <Input size="sm" pe="11" {...props} />
      <Text
        position="absolute"
        right="3"
        top="50%"
        transform="translateY(-50%)"
        fontSize="xs"
        color="ink.500"
        pointerEvents="none"
      >
        {unidad}
      </Text>
    </Box>
  );
}

function AvatarCliente({ nombre, size = "sm" }: { nombre: string; size?: "sm" | "md" }) {
  return (
    <Avatar.Root size={size} colorPalette="brand" flexShrink={0}>
      <Avatar.Fallback name={nombre} />
    </Avatar.Root>
  );
}

/**
 * Botón con marca de verificación.
 * `role="radio"` para opciones excluyentes (sexo) y `role="checkbox"` para las que no lo son.
 */
function BotonCheck({
  activo,
  onClick,
  role,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  role: "radio" | "checkbox";
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      flex="1"
      variant={activo ? "solid" : "outline"}
      colorPalette={activo ? "brand" : "gray"}
      role={role}
      aria-checked={activo}
      onClick={onClick}
    >
      {activo && <Check size={14} />}
      {children}
    </Button>
  );
}

/** Sexo: una sola opción marcada; volver a tocarla la desmarca (sin especificar). */
function SelectorSexo({
  valor,
  onCambiar,
}: {
  valor: PacienteFormValues["sexo"];
  onCambiar: (valor: PacienteFormValues["sexo"]) => void;
}) {
  const opciones: { valor: "hembra" | "macho"; etiqueta: string }[] = [
    { valor: "hembra", etiqueta: "Hembra" },
    { valor: "macho", etiqueta: "Macho" },
  ];

  return (
    <Box>
      <Text id="paciente-sexo-etiqueta" fontSize="xs" fontWeight="medium" color="ink.800" mb="1">
        Sexo
      </Text>
      <Flex gap="2" role="radiogroup" aria-labelledby="paciente-sexo-etiqueta">
        {opciones.map((opcion) => {
          const activo = valor === opcion.valor;
          return (
            <BotonCheck
              key={opcion.valor}
              role="radio"
              activo={activo}
              onClick={() => onCambiar(activo ? "" : opcion.valor)}
            >
              {opcion.etiqueta}
            </BotonCheck>
          );
        })}
      </Flex>
    </Box>
  );
}

/**
 * Foto de la mascota: un recuadro con las acciones sobre la propia imagen.
 * Acepta arrastrar y soltar directamente sobre el recuadro.
 */
function FotoMascota({
  src,
  nombre,
  subiendo,
  error,
  onArchivo,
  onElegir,
  onQuitar,
  onAmpliar,
}: {
  src?: string | null;
  nombre: string;
  subiendo: boolean;
  error?: string;
  onArchivo: (archivo?: File) => void;
  onElegir: () => void;
  onQuitar: () => void;
  onAmpliar: () => void;
}) {
  const [arrastrando, setArrastrando] = useState(false);

  return (
    <Box w="full">
      <Box
        position="relative"
        w={{ base: "11rem", md: "full" }}
        mx={{ base: "auto", md: "0" }}
        aspectRatio={1}
        role="group"
        aria-label="Foto de la mascota"
        data-testid="foto-dropzone"
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
          if (!subiendo) onArchivo(evento.dataTransfer.files[0]);
        }}
      >
        {src ? (
          <chakra.button
            type="button"
            onClick={onAmpliar}
            aria-label="Ampliar foto de la mascota"
            display="block"
            w="full"
            h="full"
            borderRadius="2xl"
            overflow="hidden"
            cursor="zoom-in"
            borderWidth="1px"
            borderColor="ink.200"
            boxShadow="sm"
          >
            <chakra.img
              src={src}
              alt={`Foto de ${nombre || "la mascota"}`}
              w="full"
              h="full"
              objectFit="cover"
            />
          </chakra.button>
        ) : (
          <chakra.button
            type="button"
            onClick={onElegir}
            aria-label="Agregar foto de la mascota"
            title="JPG, PNG, WEBP, GIF, AVIF o BMP, hasta 5 MB. También podés arrastrar la imagen hasta acá."
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap="2"
            w="full"
            h="full"
            borderRadius="2xl"
            borderWidth="2px"
            borderStyle="dashed"
            borderColor="brand.200"
            bg="brand.50"
            color="brand.600"
            transition="background 0.15s ease, border-color 0.15s ease"
            _hover={{ bg: "brand.100", borderColor: "brand.300" }}
          >
            <PawPrint size={44} />
            <Text fontSize="sm" fontWeight="medium">
              Agregar foto
            </Text>
          </chakra.button>
        )}

        {src && !subiendo && (
          <Flex position="absolute" right="2" bottom="2" gap="1.5">
            <IconButton
              type="button"
              size="xs"
              borderRadius="full"
              bg="white"
              color="ink.800"
              boxShadow="md"
              _hover={{ bg: "ink.50" }}
              onClick={onElegir}
              aria-label="Cambiar foto"
              title="Cambiar foto"
            >
              <Camera size={14} />
            </IconButton>
            <IconButton
              type="button"
              size="xs"
              borderRadius="full"
              bg="white"
              color="red.600"
              boxShadow="md"
              _hover={{ bg: "red.50" }}
              onClick={onQuitar}
              aria-label="Quitar foto"
              title="Quitar foto"
            >
              <Trash2 size={14} />
            </IconButton>
          </Flex>
        )}

        {arrastrando && (
          <Flex
            position="absolute"
            inset="0"
            align="center"
            justify="center"
            borderRadius="2xl"
            borderWidth="2px"
            borderStyle="dashed"
            borderColor="brand.500"
            bg="whiteAlpha.900"
            color="brand.700"
            pointerEvents="none"
          >
            <Text fontSize="sm" fontWeight="semibold">
              Soltá la imagen
            </Text>
          </Flex>
        )}

        {subiendo && (
          <Flex
            position="absolute"
            inset="0"
            align="center"
            justify="center"
            direction="column"
            gap="2"
            borderRadius="2xl"
            bg="whiteAlpha.800"
            role="status"
          >
            <Spinner size="lg" color="brand.600" />
            <Text fontSize="xs" fontWeight="medium" color="ink.700">
              Subiendo…
            </Text>
          </Flex>
        )}
      </Box>

      {error && (
        <Text fontSize="xs" color="danger.600" fontWeight="medium" mt="1.5" textAlign="center" role="alert">
          {error}
        </Text>
      )}
    </Box>
  );
}

/* ─────────────────────────────────── Formulario ─────────────────────────────────── */

export function PacienteForm({
  paciente,
  onGuardar,
  errorGeneral,
  formId = "paciente-form",
}: {
  paciente?: Paciente | null;
  onGuardar: (valores: PacienteFormValues) => void;
  errorGeneral?: string | null;
  formId?: string;
}) {
  const [valores, setValores] = useState<PacienteFormValues>(VALORES_INICIALES);
  const [errores, setErrores] = useState<Errores>({});
  const [clienteQuery, setClienteQuery] = useState("");
  const [clienteElegido, setClienteElegido] = useState<ClienteElegido | null>(null);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const [errorFoto, setErrorFoto] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [verFoto, setVerFoto] = useState(false);
  const [crearClienteAbierto, setCrearClienteAbierto] = useState(false);
  const [vistaPreviaLocal, setVistaPreviaLocal] = useState("");
  const inputFoto = useRef<HTMLInputElement>(null);
  const urlVistaPrevia = useRef("");
  const especies = useEspeciesPaciente();
  const clientes = useBuscarClientes(clienteElegido ? "" : clienteQuery);
  const crearCliente = useCrearCliente();
  const { puede } = useAuth();

  const resultados = clientes.data ?? [];
  const mostrarLista =
    listaAbierta && !clienteElegido && clienteQuery.trim().length > 1;

  useEffect(() => {
    if (urlVistaPrevia.current) {
      URL.revokeObjectURL(urlVistaPrevia.current);
      urlVistaPrevia.current = "";
    }
    setVistaPreviaLocal("");
    setListaAbierta(false);

    if (!paciente) {
      setValores(VALORES_INICIALES);
      setClienteQuery("");
      setClienteElegido(null);
      setErrores({});
      setErrorFoto("");
      return;
    }
    setValores({
      clienteId: paciente.cliente?.id ?? null,
      especieId: paciente.especieId,
      nombre: paciente.nombre ?? "",
      raza: paciente.raza ?? "",
      sexo: paciente.sexo ?? "",
      fechaNacimiento: paciente.fechaNacimiento?.slice(0, 10) ?? "",
      edadAnios: paciente.edadAnios === null ? "" : String(paciente.edadAnios),
      pesoKg: paciente.pesoKg === null ? "" : String(paciente.pesoKg),
      color: paciente.color ?? "",
      chipId: paciente.chipId ?? "",
      fotoUrl: paciente.fotoUrl ?? "",
      esterilizado: paciente.esterilizado,
      desparasitado: paciente.desparasitado,
      alergias: paciente.alergias ?? "",
      notas: paciente.notas ?? "",
      activo: paciente.activo,
    });
    const nombre = nombreCliente(paciente.cliente);
    setClienteQuery(nombre);
    setClienteElegido(
      paciente.cliente && nombre
        ? {
            nombre,
            detalle: detalleCliente(paciente.cliente.telefono, paciente.cliente.documento),
          }
        : null,
    );
    setErrores({});
    setErrorFoto("");
  }, [paciente]);

  useEffect(
    () => () => {
      if (urlVistaPrevia.current) {
        URL.revokeObjectURL(urlVistaPrevia.current);
      }
    },
    [],
  );

  useEffect(() => {
    setIndiceActivo(0);
  }, [clienteQuery]);

  function cambiar<K extends keyof PacienteFormValues>(
    campo: K,
    nuevo: PacienteFormValues[K],
  ) {
    setValores((previo) => ({ ...previo, [campo]: nuevo }));
    setErrores((previo) => ({ ...previo, [campo]: undefined }));
  }

  function elegirCliente(id: number, nombre: string, detalle: string) {
    cambiar("clienteId", id);
    setClienteElegido({ nombre, detalle });
    setClienteQuery(nombre);
    setListaAbierta(false);
  }

  function quitarCliente() {
    cambiar("clienteId", null);
    setClienteElegido(null);
    setClienteQuery("");
    setTimeout(() => document.getElementById(ID_CAMPO.clienteId as string)?.focus(), 0);
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
      if (elegido) {
        elegirCliente(
          elegido.id,
          elegido.nombreCompleto,
          detalleCliente(elegido.telefono, elegido.documento),
        );
      }
    } else if (evento.key === "Escape") {
      evento.stopPropagation(); // cierra la lista, no el diálogo
      setListaAbierta(false);
    }
  }

  function validar(): Errores {
    const nuevos: Errores = {};
    if (!valores.nombre.trim()) nuevos.nombre = "Ingresá el nombre de la mascota.";
    if (!valores.especieId) nuevos.especieId = "Seleccioná una especie.";
    if (!valores.clienteId) nuevos.clienteId = "Seleccioná a su responsable.";
    if (valores.fechaNacimiento) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      if (new Date(`${valores.fechaNacimiento}T00:00:00`) > hoy) {
        nuevos.fechaNacimiento = "La fecha de nacimiento no puede ser futura.";
      }
    }
    if (
      valores.edadAnios &&
      (!Number.isInteger(Number(valores.edadAnios)) || Number(valores.edadAnios) < 0)
    ) {
      nuevos.edadAnios = "Ingresá una edad válida en años.";
    }
    if (
      valores.pesoKg &&
      (!Number.isFinite(Number(valores.pesoKg)) || Number(valores.pesoKg) < 0)
    ) {
      nuevos.pesoKg = "Ingresá un peso válido.";
    }
    setErrores(nuevos);
    return nuevos;
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (subiendo) {
      setErrorFoto("Esperá a que termine la carga de la imagen.");
      return;
    }
    const nuevos = validar();
    const primero = ORDEN_CAMPOS.find((campo) => nuevos[campo]);
    if (primero) {
      document.getElementById(ID_CAMPO[primero] as string)?.focus();
      return;
    }
    onGuardar(valores);
  }

  async function subirFoto(archivo?: File) {
    if (!archivo) return;
    setErrorFoto("");
    if (!TIPOS_FOTO.has(archivo.type)) {
      setErrorFoto("Usá una imagen JPG, PNG, WEBP, GIF, AVIF o BMP.");
      if (inputFoto.current) inputFoto.current.value = "";
      return;
    }
    if (archivo.size > MAX_FOTO_BYTES) {
      setErrorFoto("La imagen no puede superar los 5 MB.");
      if (inputFoto.current) inputFoto.current.value = "";
      return;
    }

    if (urlVistaPrevia.current) {
      URL.revokeObjectURL(urlVistaPrevia.current);
    }
    const urlLocal = URL.createObjectURL(archivo);
    urlVistaPrevia.current = urlLocal;
    setVistaPreviaLocal(urlLocal);

    const datos = new FormData();
    datos.append("archivo", archivo);
    setSubiendo(true);
    try {
      const respuesta = await api.post<RespuestaUpload>("/uploads", datos, {
        // Evita que el Content-Type JSON global serialice el FormData. Axios
        // elimina este valor en el adapter del navegador y agrega el boundary.
        headers: { "Content-Type": "multipart/form-data" },
      });
      cambiar("fotoUrl", respuesta.data.data.url);
    } catch (error) {
      setErrorFoto(
        error instanceof Error
          ? error.message
          : "No se pudo subir la imagen. Intentá nuevamente.",
      );
    } finally {
      setSubiendo(false);
      if (inputFoto.current) inputFoto.current.value = "";
    }
  }

  const imagen = vistaPreviaLocal || urlFotoPaciente(valores.fotoUrl);

  function quitarFoto() {
    if (urlVistaPrevia.current) {
      URL.revokeObjectURL(urlVistaPrevia.current);
      urlVistaPrevia.current = "";
    }
    setVistaPreviaLocal("");
    setErrorFoto("");
    cambiar("fotoUrl", "");
  }

  async function guardarClienteNuevo(valoresCliente: ClienteFormValues) {
    try {
      const cliente = await crearCliente.mutateAsync({
        cedula: valoresCliente.cedula.trim() || undefined,
        ruc: valoresCliente.ruc.trim() || undefined,
        pasaporte: valoresCliente.pasaporte.trim() || undefined,
        nombres: valoresCliente.nombres.trim() || undefined,
        apellidos: valoresCliente.apellidos.trim() || undefined,
        razonSocial: valoresCliente.razonSocial.trim() || undefined,
        email: valoresCliente.email.trim() || undefined,
        telefono: valoresCliente.telefono.trim() || undefined,
        whatsapp: valoresCliente.whatsapp.trim() || undefined,
        direccion: valoresCliente.direccion.trim() || undefined,
        departamento: valoresCliente.departamento.trim() || undefined,
        ciudad: valoresCliente.ciudad.trim() || undefined,
        barrio: valoresCliente.barrio.trim() || undefined,
        notas: valoresCliente.notas.trim() || undefined,
        activo: valoresCliente.activo,
      });

      toaster.success({
        title: "Cliente registrado",
        description: cliente.nombreCompleto,
      });
      elegirCliente(
        cliente.id,
        cliente.nombreCompleto,
        detalleCliente(cliente.telefono, cliente.documento),
      );
      setCrearClienteAbierto(false);
    } catch {
      // El error queda visible dentro del modal secundario.
    }
  }

  function abrirNuevoCliente() {
    crearCliente.reset();
    setCrearClienteAbierto(true);
  }

  const puedeCrearCliente = puede("clientes.crear");
  const edadCalculada = valores.fechaNacimiento ? edadDesdeFecha(valores.fechaNacimiento) : "";

  return (
    <>
      <input
        ref={inputFoto}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp"
        hidden
        onChange={(evento) => void subirFoto(evento.currentTarget.files?.[0])}
      />

      <chakra.form id={formId} onSubmit={enviar} noValidate>
        <Stack gap="3">
          {errorGeneral && (
            <Alert status="error" rounded="md">
              {errorGeneral}
            </Alert>
          )}

          {/* ── Mascota: foto al costado y datos a la derecha ───────── */}
          <Seccion icono={PawPrint} titulo="Ficha de la mascota">
            <Grid templateColumns={{ base: "1fr", md: "11rem minmax(0, 1fr)" }} gap="5" alignItems="start">
              <Stack gap="3">
                <FotoMascota
                  src={imagen}
                  nombre={valores.nombre}
                  subiendo={subiendo}
                  error={errorFoto}
                  onArchivo={(archivo) => void subirFoto(archivo)}
                  onElegir={() => inputFoto.current?.click()}
                  onQuitar={quitarFoto}
                  onAmpliar={() => setVerFoto(true)}
                />

                <Flex
                  align="center"
                  justify="space-between"
                  gap="2"
                  px="3"
                  py="2"
                  borderWidth="1px"
                  borderColor="ink.200"
                  borderRadius="lg"
                  w={{ base: "11rem", md: "full" }}
                  mx={{ base: "auto", md: "0" }}
                >
                  <Text fontSize="xs" fontWeight="medium" color="ink.700">
                    {valores.activo ? "Activo" : "Inactivo"}
                  </Text>
                  <Switch
                    checked={valores.activo}
                    onCheckedChange={(detalle: { checked: boolean }) =>
                      cambiar("activo", detalle.checked)
                    }
                    colorPalette="success"
                    size="sm"
                    aria-label="Paciente activo"
                  />
                </Flex>
              </Stack>

              <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3">
                <Campo id={ID_CAMPO.nombre as string} etiqueta="Nombre" requerido error={errores.nombre}>
                  <Input
                    size="sm"
                    placeholder="Mora"
                    value={valores.nombre}
                    onChange={(e) => cambiar("nombre", e.target.value)}
                  />
                </Campo>

                <Campo
                  id={ID_CAMPO.especieId as string}
                  etiqueta="Especie"
                  requerido
                  error={errores.especieId}
                >
                  <Box w="full">
                    <NativeSelect.Root size="sm" disabled={especies.isLoading}>
                      <NativeSelect.Field
                        value={valores.especieId ?? ""}
                        onChange={(e) =>
                          cambiar("especieId", e.target.value ? Number(e.target.value) : null)
                        }
                      >
                        <option value="">
                          {especies.isLoading ? "Cargando especies…" : "Seleccionar especie"}
                        </option>
                        {especies.data?.map((especie) => (
                          <option key={especie.id} value={especie.id}>
                            {especie.nombre}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                    {especies.isError && (
                      <Flex align="center" gap="2" mt="1">
                        <Text fontSize="xs" color="danger.600">
                          No se pudieron cargar las especies.
                        </Text>
                        <Button size="2xs" variant="outline" onClick={() => void especies.refetch()}>
                          Reintentar
                        </Button>
                      </Flex>
                    )}
                  </Box>
                </Campo>

                <Campo id={ID_CAMPO.raza as string} etiqueta="Raza">
                  <Input
                    size="sm"
                    placeholder="Mestiza"
                    value={valores.raza}
                    onChange={(e) => cambiar("raza", e.target.value)}
                  />
                </Campo>

                <SelectorSexo valor={valores.sexo} onCambiar={(valor) => cambiar("sexo", valor)} />

                <Campo
                  id={ID_CAMPO.fechaNacimiento as string}
                  etiqueta="Fecha de nacimiento"
                  error={errores.fechaNacimiento}
                  ayuda={edadCalculada ? `Edad actual: ${edadCalculada}.` : undefined}
                >
                  <Input
                    size="sm"
                    type="date"
                    value={valores.fechaNacimiento}
                    onChange={(e) => {
                      cambiar("fechaNacimiento", e.target.value);
                      if (e.target.value) cambiar("edadAnios", "");
                    }}
                  />
                </Campo>

                <Campo
                  id={ID_CAMPO.edadAnios as string}
                  etiqueta="Edad aproximada"
                  error={errores.edadAnios}
                >
                  <InputConUnidad
                    unidad="años"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="3"
                    value={valores.edadAnios}
                    onChange={(e) => {
                      cambiar("edadAnios", e.target.value);
                      if (e.target.value) cambiar("fechaNacimiento", "");
                    }}
                  />
                </Campo>

                <Campo id={ID_CAMPO.pesoKg as string} etiqueta="Peso" error={errores.pesoKg}>
                  <InputConUnidad
                    unidad="kg"
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="12.5"
                    value={valores.pesoKg}
                    onChange={(e) => cambiar("pesoKg", e.target.value)}
                  />
                </Campo>

                <Campo id={ID_CAMPO.color as string} etiqueta="Color / señas">
                  <Input
                    size="sm"
                    placeholder="Negra con mancha blanca"
                    value={valores.color}
                    onChange={(e) => cambiar("color", e.target.value)}
                  />
                </Campo>
              </Grid>
            </Grid>
          </Seccion>

          {/* ── Responsable ──────────────────────────────────────────── */}
          <Seccion icono={CircleUserRound} titulo="Responsable">
            {clienteElegido ? (
              <Flex
                align="center"
                gap="3"
                p="2.5"
                borderWidth="1px"
                borderColor="brand.200"
                bg="brand.50"
                borderRadius="lg"
              >
                <AvatarCliente nombre={clienteElegido.nombre} size="md" />
                <Box minW="0" flex="1">
                  <Text fontSize="sm" fontWeight="semibold" color="brand.900" truncate>
                    {clienteElegido.nombre}
                  </Text>
                  {clienteElegido.detalle && (
                    <Text fontSize="xs" color="brand.800" truncate>
                      {clienteElegido.detalle}
                    </Text>
                  )}
                </Box>
                <Button type="button" size="xs" variant="outline" colorPalette="brand" onClick={quitarCliente}>
                  Cambiar
                </Button>
              </Flex>
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
                  id={ID_CAMPO.clienteId as string}
                  etiqueta="Cliente responsable"
                  requerido
                  error={errores.clienteId}
                >
                  <Flex gap="2" w="full" align="flex-start">
                    <Box position="relative" flex="1" minW="0">
                      <Input
                        size="sm"
                        value={clienteQuery}
                        onChange={(e) => {
                          setClienteQuery(e.target.value);
                          setListaAbierta(true);
                          cambiar("clienteId", null);
                        }}
                        onFocus={() => setListaAbierta(true)}
                        onKeyDown={teclasBuscador}
                        placeholder="Buscar por nombre, documento o teléfono…"
                        autoComplete="off"
                        role="combobox"
                        aria-expanded={mostrarLista}
                        aria-controls="paciente-lista-clientes"
                        aria-autocomplete="list"
                        ps="8"
                      />
                      <Box
                        position="absolute"
                        left="2.5"
                        top="50%"
                        transform="translateY(-50%)"
                        color="ink.400"
                        pointerEvents="none"
                      >
                        <Search size={15} />
                      </Box>
                    </Box>
                    {puedeCrearCliente && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        colorPalette="brand"
                        flexShrink={0}
                        onClick={abrirNuevoCliente}
                        aria-label="Registrar nuevo cliente"
                      >
                        <UserPlus size={15} />
                        <chakra.span display={{ base: "none", sm: "inline" }}>Nuevo cliente</chakra.span>
                      </Button>
                    )}
                  </Flex>
                </Campo>

                {mostrarLista && (
                  <Box
                    id="paciente-lista-clientes"
                    role="listbox"
                    position="absolute"
                    zIndex="5"
                    left="0"
                    right="0"
                    top="calc(100% + 4px)"
                    bg="white"
                    borderWidth="1px"
                    borderColor="ink.200"
                    borderRadius="lg"
                    boxShadow="lg"
                    maxH="14rem"
                    overflowY="auto"
                    p="1"
                  >
                    {clientes.isError ? (
                      <Text p="3" fontSize="sm" color="danger.600">
                        No se pudo buscar el responsable.
                      </Text>
                    ) : clientes.isFetching ? (
                      <Stack gap="2" p="2" aria-label="Buscando clientes">
                        <Skeleton h="9" borderRadius="md" />
                        <Skeleton h="9" borderRadius="md" />
                      </Stack>
                    ) : resultados.length ? (
                      resultados.map((cliente, indice) => {
                        const activo = indice === indiceActivo;
                        return (
                          <chakra.button
                            key={cliente.id}
                            type="button"
                            role="option"
                            aria-selected={activo}
                            tabIndex={-1}
                            onMouseDown={(evento: React.MouseEvent) => evento.preventDefault()}
                            onMouseEnter={() => setIndiceActivo(indice)}
                            onClick={() =>
                              elegirCliente(
                                cliente.id,
                                cliente.nombreCompleto,
                                detalleCliente(cliente.telefono, cliente.documento),
                              )
                            }
                            display="flex"
                            alignItems="center"
                            gap="3"
                            w="full"
                            px="3"
                            py="1.5"
                            textAlign="left"
                            borderRadius="md"
                            bg={activo ? "brand.50" : "transparent"}
                          >
                            <AvatarCliente nombre={cliente.nombreCompleto} />
                            <Box minW="0">
                              <Text fontSize="sm" fontWeight="semibold" color="ink.900" truncate>
                                {cliente.nombreCompleto}
                              </Text>
                              <Text fontSize="xs" color="ink.600" truncate>
                                {detalleCliente(cliente.telefono, cliente.documento) || "Sin datos de contacto"}
                              </Text>
                            </Box>
                          </chakra.button>
                        );
                      })
                    ) : (
                      <Box p="3">
                        <Text fontSize="sm" color="ink.600">
                          No encontramos clientes con ese dato.
                        </Text>
                        {puedeCrearCliente && (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            colorPalette="brand"
                            mt="2"
                            onMouseDown={(evento: React.MouseEvent) => evento.preventDefault()}
                            onClick={abrirNuevoCliente}
                          >
                            <UserPlus size={14} /> Registrar nuevo cliente
                          </Button>
                        )}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Seccion>

          {/* ── Salud ────────────────────────────────────────────────── */}
          <Seccion icono={Activity} titulo="Datos de salud">
            <Stack gap="3">
              <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3" alignItems="end">
                <Campo
                  id={ID_CAMPO.chipId as string}
                  etiqueta="Microchip"
                  ayuda="Opcional. No puede repetirse entre mascotas."
                >
                  <Input
                    size="sm"
                    placeholder="985 112 000 123456"
                    value={valores.chipId}
                    onChange={(e) => cambiar("chipId", e.target.value)}
                  />
                </Campo>

                <Box>
                  <Text id="paciente-sanitario-etiqueta" fontSize="xs" fontWeight="medium" color="ink.800" mb="1">
                    Estado sanitario
                  </Text>
                  <Flex gap="2" role="group" aria-labelledby="paciente-sanitario-etiqueta">
                    <BotonCheck
                      role="checkbox"
                      activo={valores.esterilizado}
                      onClick={() => cambiar("esterilizado", !valores.esterilizado)}
                    >
                      Esterilizado
                    </BotonCheck>
                    <BotonCheck
                      role="checkbox"
                      activo={valores.desparasitado}
                      onClick={() => cambiar("desparasitado", !valores.desparasitado)}
                    >
                      Desparasitado
                    </BotonCheck>
                  </Flex>
                </Box>
              </Grid>

              <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3">
                <Campo id={ID_CAMPO.alergias as string} etiqueta="Alergias / alertas">
                  <Textarea
                    size="sm"
                    rows={2}
                    minH="4.5rem"
                    maxH="9rem"
                    resize="vertical"
                    placeholder="Medicamentos o alimentos que debe evitar…"
                    value={valores.alergias}
                    onChange={(e) => cambiar("alergias", e.target.value)}
                  />
                </Campo>

                <Campo
                  id={ID_CAMPO.notas as string}
                  etiqueta="Notas internas"
                  ayuda="Visible sólo para el equipo veterinario."
                >
                  <Textarea
                    size="sm"
                    rows={2}
                    minH="4.5rem"
                    maxH="9rem"
                    resize="vertical"
                    placeholder="Temperamento, cuidados especiales…"
                    value={valores.notas}
                    onChange={(e) => cambiar("notas", e.target.value)}
                  />
                </Campo>
              </Grid>
            </Stack>
          </Seccion>
        </Stack>
      </chakra.form>

      <FormDialog
        abierto={crearClienteAbierto}
        onClose={() => setCrearClienteAbierto(false)}
        titulo="Nuevo cliente responsable"
        descripcion="Registrá al responsable y quedará seleccionado automáticamente en la ficha de la mascota."
        textoConfirmar="Registrar cliente"
        guardando={crearCliente.isPending}
        bloquearCierre={crearCliente.isPending}
        onConfirmar={() =>
          document
            .querySelector<HTMLFormElement>("#paciente-cliente-form")
            ?.requestSubmit()
        }
        ancho="xl"
      >
        <ClienteForm
          formId="paciente-cliente-form"
          onGuardar={(valoresCliente) => void guardarClienteNuevo(valoresCliente)}
          errorGeneral={crearCliente.isError ? mensajeDeError(crearCliente.error) : null}
        />
      </FormDialog>

      <DialogRoot open={verFoto} onOpenChange={({ open }) => setVerFoto(open)} size="xl">
        <DialogContent maxW="min(92vw, 56rem)" p="4">
          <DialogHeader display="flex" alignItems="center" justifyContent="space-between" gap="3">
            <DialogTitle>{valores.nombre || "Foto de la mascota"}</DialogTitle>
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              borderRadius="full"
              onClick={() => setVerFoto(false)}
              aria-label="Cerrar vista ampliada"
              title="Cerrar"
            >
              <X size={18} />
            </IconButton>
          </DialogHeader>
          <DialogBody>
            {imagen && (
              <chakra.img
                src={imagen}
                alt={`Foto ampliada de ${valores.nombre || "la mascota"}`}
                w="full"
                maxH="75vh"
                objectFit="contain"
                borderRadius="md"
              />
            )}
          </DialogBody>
        </DialogContent>
      </DialogRoot>
    </>
  );
}