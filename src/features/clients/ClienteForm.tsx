import {
  Avatar,
  Badge,
  Box,
  Field,
  Flex,
  Grid,
  Input,
  Skeleton,
  Stack,
  Text,
  Textarea,
  chakra,
} from "@chakra-ui/react";
import {
  Building2,
  CircleUser,
  ExternalLink,
  Hash,
  Mail,
  MapPin,
  PawPrint,
  Phone,
  StickyNote,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { CiudadInput } from "@/components/fields/CiudadInput";
import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import type { Cliente } from "@/types/dominio";
import { mensajeDeError, useClienteDetalle } from "./clients.service";

/* ──────────────────────────────── Tipos y datos ──────────────────────────────── */

export interface ClienteFormValues {
  cedula: string;
  ruc: string;
  pasaporte: string;
  nombres: string;
  apellidos: string;
  razonSocial: string;
  email: string;
  telefono: string;
  whatsapp: string;
  direccion: string;
  departamento: string;
  ciudad: string;
  barrio: string;
  notas: string;
  activo: boolean;
}

type Errores = Partial<Record<keyof ClienteFormValues, string>>;

const VALORES_INICIALES: ClienteFormValues = {
  cedula: "",
  ruc: "",
  pasaporte: "",
  nombres: "",
  apellidos: "",
  razonSocial: "",
  email: "",
  telefono: "",
  whatsapp: "",
  direccion: "",
  departamento: "",
  ciudad: "",
  barrio: "",
  notas: "",
  activo: true,
};

/** Orden de los campos validables en pantalla, para enfocar el primero con error. */
const ORDEN_CAMPOS: (keyof ClienteFormValues)[] = [
  "cedula",
  "ruc",
  "nombres",
  "email",
  "telefono",
  "whatsapp",
];

const id = (campo: string) => `cliente-${campo}`;

function formatearRuc(valor: string): string {
  const digitos = valor.replace(/\D/g, "");

  if (digitos.length < 8 || digitos.length > 11) return digitos;

  return `${digitos.slice(0, -1)}-${digitos.slice(-1)}`;
}

/* ───────────────────────────── Componentes de apoyo ───────────────────────────── */

/** Tarjeta de sección: título con icono y los campos dentro. */
function Seccion({
  icono: Icono,
  titulo,
  descripcion,
  accesorio,
  children,
}: {
  icono: typeof CircleUser;
  titulo: string;
  descripcion?: string;
  accesorio?: React.ReactNode;
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
      <Flex align="center" justify="space-between" gap="3" wrap="wrap" mb="4">
        <Flex align="center" gap="3" minW="0">
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
            {descripcion && (
              <Text fontSize="xs" color="ink.600" mt="0.5">
                {descripcion}
              </Text>
            )}
          </Box>
        </Flex>
        {accesorio}
      </Flex>
      {children}
    </chakra.section>
  );
}

/** Campo de Chakra (Field) con etiqueta, ayuda y error ya resueltos. */
function Campo({
  campoId,
  etiqueta,
  requerido,
  error,
  ayuda,
  children,
}: {
  campoId: string;
  etiqueta: string;
  requerido?: boolean;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <Field.Root invalid={!!error} required={requerido} ids={{ control: campoId }}>
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

/**
 * Campo de texto con icono a la izquierda.
 * El icono tiene `pointer-events: none` para que el clic llegue al input.
 */
function CampoConIcono({
  campo,
  etiqueta,
  requerido,
  error,
  ayuda,
  icono,
  value,
  onChange,
  onBlur,
  placeholder,
  inputMode,
}: {
  campo: string;
  etiqueta: string;
  requerido?: boolean;
  error?: string;
  ayuda?: string;
  icono: React.ReactNode;
  value: string;
  onChange: (valor: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  inputMode?: "numeric" | "tel" | "email" | "text";
}) {
  return (
    <Campo campoId={id(campo)} etiqueta={etiqueta} requerido={requerido} error={error} ayuda={ayuda}>
      <Box position="relative" w="full">
        <Box
          position="absolute"
          left="3"
          top="50%"
          transform="translateY(-50%)"
          color="ink.400"
          pointerEvents="none"
          zIndex="1"
          aria-hidden="true"
        >
          {icono}
        </Box>
        <Input
          ps="9"
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          onChange={(evento) => onChange(evento.target.value)}
          onBlur={onBlur}
        />
      </Box>
    </Campo>
  );
}

/* ─────────────────────────────────── Formulario ─────────────────────────────────── */

/**
 * Formulario de cliente.
 *
 * Los documentos van en campos separados, no en un selector único: en Paraguay
 * una persona natural puede tener cédula y RUC a la vez. Se cargan los que
 * tenga y el resto queda vacío. Al menos uno es obligatorio: sin documento el
 * cliente no se puede localizar ni facturar. El nombre siempre, y la razón
 * social sólo si factura a nombre de una empresa.
 *
 * No trae botones de pie: <FormDialog> pone el "Registrar" y dispara el envío
 * por `formId`.
 */
export function ClienteForm({
  cliente,
  onGuardar,
  errorGeneral,
  erroresServidor,
  formId = "cliente-form",
}: {
  cliente?: Cliente | null;
  onGuardar: (valores: ClienteFormValues) => void;
  errorGeneral?: string | null;
  erroresServidor?: Errores;
  /** Id del <form>; el diálogo lo usa para disparar el envío. */
  formId?: string;
}) {
  const [valores, setValores] = useState<ClienteFormValues>(VALORES_INICIALES);
  const [errores, setErrores] = useState<Errores>({});
  const consultaCliente = useClienteDetalle(cliente?.id);
  const navegar = useNavigate();

  // Carga los datos al cambiar de cliente: sin esto, editar un cliente y
  // cerrar sin guardar deja el formulario con los del anterior.
  useEffect(() => {
    if (!cliente) {
      setValores(VALORES_INICIALES);
      setErrores({});
      return;
    }

    setValores({
      cedula: cliente.cedula ?? "",
      ruc: formatearRuc(cliente.ruc ?? ""),
      pasaporte: cliente.pasaporte ?? "",
      nombres: cliente.nombres ?? "",
      apellidos: cliente.apellidos ?? "",
      razonSocial: cliente.razonSocial ?? "",
      email: cliente.email ?? "",
      telefono: cliente.telefono ?? "",
      whatsapp: cliente.whatsapp ?? "",
      direccion: cliente.direccion ?? "",
      departamento: cliente.departamento ?? "",
      ciudad: cliente.ciudad ?? "",
      barrio: cliente.barrio ?? "",
      notas: cliente.notas ?? "",
      activo: cliente.activo,
    });
    setErrores({});
  }, [cliente]);

  function cambiar<K extends keyof ClienteFormValues>(
    campo: K,
    nuevo: ClienteFormValues[K],
  ) {
    setValores((previo) => ({ ...previo, [campo]: nuevo }));
    setErrores((previo) => ({ ...previo, [campo]: undefined }));
  }

  function validar(): Errores {
    const nuevos: Errores = {};

    // Cada documento se valida por su cuenta y sólo si se cargó.
    const documentos = [
      { campo: "cedula" as const, etiqueta: "cédula", patron: /^\d{7,8}$/, largo: "7 u 8" },
      { campo: "ruc" as const, etiqueta: "RUC", patron: /^\d{8,11}$/, largo: "8 a 11" },
    ];

    // Se conserva el pasaporte de clientes existentes, aunque ya no se captura
    // desde este formulario.
    let hayDocumento = Boolean(valores.pasaporte.trim());

    for (const { campo, etiqueta, patron, largo } of documentos) {
      const valor = valores[campo].replace(/\D/g, "");

      if (!valor) continue;

      hayDocumento = true;

      if (!patron.test(valor)) {
        nuevos[campo] = `El ${etiqueta} tiene ${largo} dígitos.`;
      }
    }

    if (!hayDocumento) {
      nuevos.cedula = "Cargá al menos un documento: cédula o RUC.";
    }

    if (valores.nombres.trim().length < 2) {
      nuevos.nombres = "Ingresá al menos el nombre.";
    }

    if (valores.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.email.trim())) {
      nuevos.email = "Ingresá un correo válido.";
    }

    for (const campo of ["telefono", "whatsapp"] as const) {
      const valor = valores[campo].replace(/\D/g, "");

      if (valor.length > 0 && (valor.length < 7 || valor.length > 15)) {
        nuevos[campo] = "Ingresá entre 7 y 15 dígitos.";
      }
    }

    setErrores(nuevos);
    return nuevos;
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    const nuevos = validar();
    const primero = ORDEN_CAMPOS.find((campo) => nuevos[campo]);
    if (primero) {
      document.getElementById(id(primero))?.focus();
      return;
    }

    onGuardar({
      ...valores,
      cedula: valores.cedula.replace(/\D/g, ""),
      ruc: formatearRuc(valores.ruc),
      pasaporte: valores.pasaporte.replace(/[\s.-]/g, "").toUpperCase(),
      email: valores.email.trim().toLowerCase(),
      nombres: valores.nombres.trim(),
      apellidos: valores.apellidos.trim(),
      razonSocial: valores.razonSocial.trim(),
    });
  }

  const error = (campo: keyof ClienteFormValues) =>
    errores[campo] ?? erroresServidor?.[campo];

  const pacientes = consultaCliente.data?.pacientes ?? [];

  return (
    <chakra.form id={formId} onSubmit={enviar} noValidate>
      <Stack gap="4">
        {errorGeneral && (
          <Alert status="error" rounded="md">
            {errorGeneral}
          </Alert>
        )}

        {/* ── Identificación ───────────────────────────────────────── */}
        <Seccion
          icono={CircleUser}
          titulo="Identificación"
          descripcion="Documento y nombre del cliente."
          accesorio={
            <Flex align="center" gap="2.5">
              <Text fontSize="xs" color="ink.600">
                {valores.activo ? "Cliente activo" : "Cliente inactivo"}
              </Text>
              <Switch
                checked={valores.activo}
                onCheckedChange={(detalle: { checked: boolean }) =>
                  cambiar("activo", detalle.checked)
                }
                colorPalette="success"
                aria-label="Cliente activo"
              />
            </Flex>
          }
        >
          <Stack gap="5">
            <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="5">
              <CampoConIcono
                campo="cedula"
                etiqueta="Cédula"
                placeholder="12345678"
                inputMode="numeric"
                icono={<Hash size={16} />}
                value={valores.cedula}
                onChange={(valor) => cambiar("cedula", valor)}
                onBlur={() => cambiar("cedula", valores.cedula.replace(/\D/g, ""))}
                error={error("cedula")}
                ayuda="Cargá la cédula, el RUC o ambos."
              />

              <CampoConIcono
                campo="ruc"
                etiqueta="RUC"
                placeholder="80012345-0"
                inputMode="numeric"
                icono={<Hash size={16} />}
                value={valores.ruc}
                onChange={(valor) => cambiar("ruc", valor)}
                onBlur={() => cambiar("ruc", formatearRuc(valores.ruc))}
                error={error("ruc")}
                ayuda="Se agrega el guion antes del dígito verificador."
              />
            </Grid>

            <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="5">
              <CampoConIcono
                campo="nombres"
                etiqueta="Nombres"
                requerido
                placeholder="María"
                icono={<CircleUser size={16} />}
                value={valores.nombres}
                onChange={(valor) => cambiar("nombres", valor)}
                error={error("nombres")}
              />

              <CampoConIcono
                campo="apellidos"
                etiqueta="Apellidos"
                placeholder="González"
                icono={<CircleUser size={16} />}
                value={valores.apellidos}
                onChange={(valor) => cambiar("apellidos", valor)}
                error={error("apellidos")}
              />
            </Grid>

            <CampoConIcono
              campo="razonSocial"
              etiqueta="Razón social"
              placeholder="Veterinaria San Jerez S.R.L."
              icono={<Building2 size={16} />}
              value={valores.razonSocial}
              onChange={(valor) => cambiar("razonSocial", valor)}
              error={error("razonSocial")}
              ayuda="Opcional. Sólo si el cliente factura a nombre de una empresa."
            />
          </Stack>
        </Seccion>

        {/* ── Contacto ─────────────────────────────────────────────── */}
        <Seccion
          icono={Phone}
          titulo="Contacto"
          descripcion="Cómo comunicarte con el cliente."
        >
          <Stack gap="5">
            <CampoConIcono
              campo="email"
              etiqueta="Correo electrónico"
              placeholder="maria@correo.com"
              inputMode="email"
              icono={<Mail size={16} />}
              value={valores.email}
              onChange={(valor) => cambiar("email", valor)}
              error={error("email")}
              ayuda="Para enviarle recordatorios de citas y comprobantes."
            />

            <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="5">
              <CampoConIcono
                campo="telefono"
                etiqueta="Teléfono"
                placeholder="0981123456"
                inputMode="tel"
                icono={<Phone size={16} />}
                value={valores.telefono}
                onChange={(valor) => cambiar("telefono", valor)}
                error={error("telefono")}
              />

              <CampoConIcono
                campo="whatsapp"
                etiqueta="WhatsApp"
                placeholder="0981987654"
                inputMode="tel"
                icono={<Phone size={16} />}
                value={valores.whatsapp}
                onChange={(valor) => cambiar("whatsapp", valor)}
                error={error("whatsapp")}
              />
            </Grid>
          </Stack>
        </Seccion>

        {/* ── Domicilio ────────────────────────────────────────────── */}
        <Seccion icono={MapPin} titulo="Domicilio" descripcion="Dirección del cliente.">
          <Stack gap="5">
            <CampoConIcono
              campo="direccion"
              etiqueta="Dirección"
              placeholder="Av. Brasil 1234, casa 45"
              icono={<MapPin size={16} />}
              value={valores.direccion}
              onChange={(valor) => cambiar("direccion", valor)}
              error={error("direccion")}
            />

            <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="5">
              <Box minW="0">
                <CiudadInput
                  value={valores.ciudad}
                  onChange={(ciudad, departamento) => {
                    // El departamento se guarda como dato derivado para la API,
                    // no se pide por separado: al elegir una ciudad viene del catálogo.
                    cambiar("departamento", departamento ?? "");
                    cambiar("ciudad", ciudad);
                  }}
                  label="Ciudad"
                  departamento={valores.departamento}
                  errorText={error("ciudad")}
                />
              </Box>

              <Campo campoId={id("barrio")} etiqueta="Barrio" error={error("barrio")}>
                <Input
                  placeholder="San Cristóbal"
                  value={valores.barrio}
                  onChange={(evento) => cambiar("barrio", evento.target.value)}
                />
              </Campo>
            </Grid>
          </Stack>
        </Seccion>

        {/* ── Mascotas vinculadas ──────────────────────────────────── */}
        <Seccion
          icono={PawPrint}
          titulo="Mascotas vinculadas"
          descripcion="Las mascotas de las que este cliente es responsable."
          accesorio={
            cliente && pacientes.length > 0 ? (
              <Badge colorPalette="brand" variant="subtle" size="sm">
                {pacientes.length} {pacientes.length === 1 ? "mascota" : "mascotas"}
              </Badge>
            ) : undefined
          }
        >
          {cliente ? (
            consultaCliente.isLoading ? (
              <Stack gap="2" role="status" aria-label="Cargando mascotas">
                <Skeleton h="14" borderRadius="lg" />
                <Skeleton h="14" borderRadius="lg" />
              </Stack>
            ) : consultaCliente.isError ? (
              <Alert status="error" rounded="md">
                No se pudieron cargar las mascotas: {mensajeDeError(consultaCliente.error)}
              </Alert>
            ) : pacientes.length ? (
              <Stack gap="2">
                {pacientes.map((paciente) => (
                  <chakra.button
                    type="button"
                    key={paciente.id}
                    w="full"
                    textAlign="left"
                    display="flex"
                    alignItems="center"
                    gap="3"
                    p="3"
                    borderWidth="1px"
                    borderColor="ink.200"
                    borderRadius="lg"
                    bg="white"
                    transition="border-color 0.15s ease, background 0.15s ease"
                    _hover={{ borderColor: "brand.300", bg: "brand.50" }}
                    _focusVisible={{
                      outline: "2px solid",
                      outlineColor: "brand.500",
                      outlineOffset: "2px",
                    }}
                    onClick={() =>
                      navegar(
                        `/pacientes?busqueda=${encodeURIComponent(paciente.nombre)}&pacienteId=${paciente.id}`,
                      )
                    }
                    aria-label={`Abrir ficha de ${paciente.nombre} en Pacientes`}
                  >
                    <Avatar.Root size="md" colorPalette="brand" flexShrink={0}>
                      <Avatar.Fallback>
                        <PawPrint size={18} />
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <Box minW="0" flex="1">
                      <Text fontSize="sm" fontWeight="semibold" color="ink.900" truncate>
                        {paciente.nombre}
                      </Text>
                      <Text fontSize="xs" color="ink.600" truncate>
                        {[paciente.especie?.nombre, paciente.raza].filter(Boolean).join(" · ") ||
                          "Especie o raza sin especificar"}
                        {paciente.sexo
                          ? ` · ${paciente.sexo === "macho" ? "Macho" : "Hembra"}`
                          : ""}
                      </Text>
                    </Box>
                    <Badge
                      colorPalette={paciente.activo ? "success" : "gray"}
                      variant="subtle"
                      size="sm"
                    >
                      {paciente.activo ? "Activo" : "Inactivo"}
                    </Badge>
                    <ExternalLink size={15} color="var(--chakra-colors-ink-400)" />
                  </chakra.button>
                ))}
              </Stack>
            ) : (
              <Alert status="info" rounded="md">
                Este cliente todavía no tiene mascotas vinculadas. Para asociar una,
                seleccioná este cliente como responsable en el formulario de Pacientes.
              </Alert>
            )
          ) : (
            <Alert status="info" rounded="md">
              Guardá el cliente primero. Después podés vincular una o más mascotas
              desde el formulario de Pacientes.
            </Alert>
          )}
        </Seccion>

        {/* ── Notas ────────────────────────────────────────────────── */}
        <Seccion
          icono={StickyNote}
          titulo="Información adicional"
          descripcion="Visible sólo para el equipo de la veterinaria."
        >
          <Campo campoId={id("notas")} etiqueta="Notas internas" error={error("notas")}>
            <Textarea
              rows={3}
              minH="6rem"
              maxH="12rem"
              resize="vertical"
              placeholder="Alergias, preferencias de contacto, observaciones…"
              value={valores.notas}
              onChange={(evento) => cambiar("notas", evento.target.value)}
            />
          </Campo>
        </Seccion>

        {/* Sin pie de botones a propósito: <FormDialog> ya pone el "Registrar" y
            dispara este mismo formulario por `formId`. */}
      </Stack>
    </chakra.form>
  );
}