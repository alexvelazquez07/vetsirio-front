import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Grid,
  Input,
  Spinner,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import {
  CalendarClock,
  CheckCircle2,
  Mail,
  MessageCircle,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { FormDialog } from "@/components/data/FormDialog";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { mensajeDeError } from "@/features/clients/clients.service";
import { formatFecha, formatFechaHora, formatMoneda } from "@/lib/formato";
import {
  useSolicitarPlan,
  useSuscripcion,
  type ModalidadPlan,
  type ResumenSuscripcion,
} from "./suscripcion.service";

const REGEX_WHATSAPP = /^(?:\+?595|0)9\d{8}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MODALIDAD_META: Record<
  ModalidadPlan,
  { etiqueta: string; periodo: string }
> = {
  mensual: { etiqueta: "Mensual", periodo: "/ mes" },
  anual: { etiqueta: "Anual", periodo: "/ año" },
};

/**
 * Pantalla del plan.
 *
 * El cliente elige entre pago mensual y anual; el botón no cobra ni activa
 * nada: abre un modal para dejar su WhatsApp (obligatorio), un email de
 * contacto y un comentario opcional. El backend avisa al equipo de VetSirio y
 * deja la solicitud registrada con la modalidad elegida.
 *
 * La pantalla tiene que funcionar con el trial vencido, porque es justamente
 * el lugar al que el cliente llega cuando ya no puede guardar datos.
 */
export function SuscripcionPage() {
  const { usuario } = useAuth();
  const consulta = useSuscripcion();
  const solicitar = useSolicitarPlan();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [exitoAbierto, setExitoAbierto] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [modalidad, setModalidad] = useState<ModalidadPlan>("mensual");

  const [whatsapp, setWhatsapp] = useState("");
  const [emailContacto, setEmailContacto] = useState("");
  const [comentario, setComentario] = useState("");
  const [intento, setIntento] = useState(false);

  const abrirModal = (elegida: ModalidadPlan) => {
    setModalidad(elegida);
    setWhatsapp(usuario?.telefono ?? "");
    setEmailContacto(usuario?.email ?? "");
    setComentario("");
    setIntento(false);
    solicitar.reset();
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    if (solicitar.isPending) return;
    setModalAbierto(false);
    solicitar.reset();
  };

  const telefonoNormalizado = whatsapp.replace(/[\s().-]/g, "");
  const whatsappValido = REGEX_WHATSAPP.test(telefonoNormalizado);
  const emailValido = REGEX_EMAIL.test(emailContacto.trim());

  const precioModalidad =
    modalidad === "anual"
      ? consulta.data?.precioAnual
      : consulta.data?.precioMensual;

  const estadoActual = consulta.data?.estadoSuscripcion;
  const planPagoVigente = Boolean(
    estadoActual &&
      !estadoActual.enTrial &&
      !estadoActual.expirado &&
      !estadoActual.suspendida,
  );
  const inicioPlanAnual =
    planPagoVigente && estadoActual?.venceEn
      ? formatFecha(estadoActual.venceEn)
      : null;

  const enviar = () => {
    setIntento(true);

    if (!whatsappValido || !emailValido) return;

    solicitar.mutate(
      {
        whatsapp: telefonoNormalizado,
        emailContacto: emailContacto.trim(),
        comentario: comentario.trim() || undefined,
        modalidad,
      },
      {
        onSuccess: (respuesta) => {
          setMensajeExito(respuesta.mensaje);
          setModalAbierto(false);
          setExitoAbierto(true);
          toaster.success({
            title: "Solicitud enviada",
            description: "El equipo de VetSirio se va a comunicar con vos.",
          });
        },
      },
    );
  };

  return (
    <Box>
      <PageHeader
        titulo="Mi plan"
        descripcion="Gestioná la activación y renovación del plan de tu veterinaria."
        migas={["Inicio", "Mi plan"]}
      />

      {consulta.isLoading ? (
        <Panel>
          <Flex align="center" justify="center" py="16" gap="3">
            <Spinner size="md" color="brand.500" />
            <Text fontSize="sm" color="ink.600">
              Cargando tu plan…
            </Text>
          </Flex>
        </Panel>
      ) : consulta.error ? (
        <Panel>
          <Alert status="error" title="No pudimos cargar tu plan">
            {mensajeDeError(consulta.error)}
          </Alert>
        </Panel>
      ) : consulta.data ? (
        <Contenido
          resumen={consulta.data}
          onSolicitar={abrirModal}
          solicitando={solicitar.isPending}
        />
      ) : null}

      <FormDialog
        abierto={modalAbierto}
        onClose={cerrarModal}
        titulo={`Solicitar plan ${MODALIDAD_META[modalidad].etiqueta.toLowerCase()}`}
        descripcion="Dejanos tus datos y coordinamos el pago por WhatsApp."
        ancho="lg"
        textoConfirmar="Enviar solicitud"
        guardando={solicitar.isPending}
        bloquearCierre={solicitar.isPending}
        onConfirmar={enviar}
      >
        <Stack gap="4">
          <Alert status="info" title="El plan no se activa automáticamente">
            Recibimos tu pedido y el equipo de VetSirio se comunica con vos para
            acordar el medio de pago. La activación se hace después de confirmar
            el pago.
          </Alert>

          {modalidad === "anual" && inicioPlanAnual && (
            <Alert
              status="success"
              title="El plan anual empieza al vencer el actual"
            >
              Tu plan sigue vigente hasta el {inicioPlanAnual}. El anual cubre
              12 meses desde esa fecha, así que no perdés los días que te
              quedan.
            </Alert>
          )}

          <Box
            bg="ink.50"
            borderWidth="1px"
            borderColor="ink.200"
            borderRadius="md"
            px="4"
            py="3"
          >
            <Flex justify="space-between" align="center" gap="3">
              <Box>
                <Text fontSize="xs" color="ink.500" fontWeight="medium">
                  Modalidad elegida
                </Text>
                <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                  Plan {MODALIDAD_META[modalidad].etiqueta}
                  {modalidad === "anual" ? " (12 meses)" : ""}
                </Text>
              </Box>
              {precioModalidad && (
                <Flex align="baseline" gap="1.5">
                  <Text
                    fontSize="lg"
                    fontWeight="bold"
                    color="brand.700"
                    fontVariantNumeric="tabular-nums"
                  >
                    {formatMoneda(precioModalidad, { espacios: true })}
                  </Text>
                  <Text fontSize="xs" color="ink.500">
                    {MODALIDAD_META[modalidad].periodo}
                  </Text>
                </Flex>
              )}
            </Flex>
          </Box>

          <Field.Root required>
            <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
              WhatsApp
              <Field.RequiredIndicator />
            </Field.Label>
            <Input
              value={whatsapp}
              onChange={(evento) => setWhatsapp(evento.target.value)}
              placeholder="0981 123 456"
              inputMode="tel"
              autoComplete="tel"
            />
            <Field.HelperText fontSize="xs" color="ink.500">
              Es el canal por el que te vamos a contactar. Podés escribirlo con
              o sin +595.
            </Field.HelperText>
            {intento && !whatsappValido && (
              <Field.ErrorText fontSize="xs" mt="0.5">
                Ingresá un WhatsApp paraguayo válido, por ejemplo 0981234567.
              </Field.ErrorText>
            )}
          </Field.Root>

          <Field.Root required>
            <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
              Email de contacto
              <Field.RequiredIndicator />
            </Field.Label>
            <Input
              type="email"
              value={emailContacto}
              onChange={(evento) => setEmailContacto(evento.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
            />
            <Field.HelperText fontSize="xs" color="ink.500">
              Lo precargamos con el email de tu cuenta, pero podés cambiarlo.
            </Field.HelperText>
            {intento && !emailValido && (
              <Field.ErrorText fontSize="xs" mt="0.5">
                Ingresá un email válido.
              </Field.ErrorText>
            )}
          </Field.Root>

          <Field.Root>
            <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
              Comentario <Text as="span" color="ink.500" fontWeight="normal">(opcional)</Text>
            </Field.Label>
            <Textarea
              value={comentario}
              onChange={(evento) => setComentario(evento.target.value)}
              placeholder="Contanos si preferís un horario, si pagás por transferencia o cualquier detalle útil."
              rows={4}
              maxLength={1000}
            />
            <Field.HelperText fontSize="xs" color="ink.500">
              {comentario.length}/1000 caracteres
            </Field.HelperText>
          </Field.Root>

          {solicitar.error && (
            <Alert status="error" rounded="md" title="No pudimos enviar la solicitud">
              {mensajeDeError(solicitar.error)}
            </Alert>
          )}
        </Stack>
      </FormDialog>

      <FormDialog
        abierto={exitoAbierto}
        onClose={() => setExitoAbierto(false)}
        titulo="Solicitud recibida"
        ancho="md"
        textoCancelar="Cerrar"
        ocultarConfirmar
      >
        <Stack gap="4">
          <Alert status="success" title="Ya recibimos tu solicitud">
            {mensajeExito}
          </Alert>

          <Text fontSize="sm" color="ink.700">
            Mientras tanto podés seguir consultando y exportando tu información.
            No se borra nada de lo que ya cargaste.
          </Text>

          <Box
            bg="ink.50"
            borderWidth="1px"
            borderColor="ink.200"
            borderRadius="md"
            p="4"
          >
            <Text fontSize="xs" color="ink.500" fontWeight="semibold">
              Datos que enviaste
            </Text>
            <Text fontSize="sm" color="ink.800" mt="1">
              WhatsApp: {telefonoNormalizado}
            </Text>
            <Text fontSize="sm" color="ink.800">
              Email: {emailContacto.trim()}
            </Text>
            <Text fontSize="sm" color="ink.800">
              Modalidad: {MODALIDAD_META[modalidad].etiqueta}
              {modalidad === "anual" ? " (12 meses)" : ""}
            </Text>
          </Box>

          {modalidad === "anual" && inicioPlanAnual && (
            <Text fontSize="sm" color="ink.700">
              El plan anual va a empezar el {inicioPlanAnual}, cuando venza tu
              plan actual.
            </Text>
          )}
        </Stack>
      </FormDialog>
    </Box>
  );
}

function Contenido({
  resumen,
  onSolicitar,
  solicitando,
}: {
  resumen: ResumenSuscripcion;
  onSolicitar: (modalidad: ModalidadPlan) => void;
  solicitando: boolean;
}) {
  const {
    estadoSuscripcion: estado,
    precioMensual,
    precioAnual,
    solicitudPendiente,
  } = resumen;

  const planActivo = !estado.enTrial && !estado.expirado && !estado.suspendida;

  const puedeSolicitarMensual =
    !planActivo && !estado.suspendida && !solicitudPendiente;

  // El anual se puede pedir incluso con un plan vigente: arranca cuando vence
  // el actual, sin pisar los días que le quedan al cliente.
  const puedeSolicitarAnual = !estado.suspendida && !solicitudPendiente;

  const inicioAnual =
    planActivo && estado.venceEn ? formatFecha(estado.venceEn) : null;

  const textoMensual = estado.suspendida
    ? "Cuenta suspendida"
    : planActivo
      ? "Tu plan está vigente"
      : undefined;

  const textoAnual = estado.suspendida
    ? "Cuenta suspendida"
    : planActivo
      ? "Programar plan anual"
      : undefined;

  // Sólo para mostrar el ahorro: no se envía ni se guarda.
  const ahorro = calcularAhorroAnual(precioMensual, precioAnual);

  return (
    <Grid templateColumns={{ base: "1fr", xl: "1.15fr 1fr" }} gap="5">
      <Panel>
        <Flex align="center" gap="2">
          <Sparkles size={18} color="var(--chakra-colors-brand-600)" />
          <Text fontWeight="semibold" color="ink.900" fontSize="md">
            Plan VetSirio
          </Text>
        </Flex>
        <Text fontSize="sm" color="ink.500" mt="1">
          Un solo plan, dos formas de pago. Sin permanencia.
        </Text>

        <Grid
          templateColumns={{ base: "1fr", md: "1fr 1fr" }}
          gap="4"
          mt="6"
        >
          <TarjetaPlan
            modalidad="mensual"
            precio={precioMensual}
            descripcion="Pagás mes a mes y das de baja cuando quieras."
            deshabilitado={!puedeSolicitarMensual}
            textoBoton={textoMensual}
            solicitudPendiente={Boolean(solicitudPendiente)}
            solicitando={solicitando}
            onElegir={() => onSolicitar("mensual")}
          />
          <TarjetaPlan
            modalidad="anual"
            precio={precioAnual}
            descripcion={
              inicioAnual
                ? `Empieza el ${inicioAnual}, cuando vence tu plan actual. Cubre 12 meses desde esa fecha.`
                : "Doce meses de servicio en un solo pago."
            }
            ahorro={ahorro}
            deshabilitado={!puedeSolicitarAnual}
            textoBoton={textoAnual}
            solicitudPendiente={Boolean(solicitudPendiente)}
            solicitando={solicitando}
            onElegir={() => onSolicitar("anual")}
            destacada
          />
        </Grid>

        <Stack gap="3" mt="6" mb="2">
          <Beneficio>Acceso completo a todos los módulos del sistema</Beneficio>
          <Beneficio>Clientes, pacientes, agenda y consultas sin límite de tiempo</Beneficio>
          <Beneficio>Ventas, caja, egresos y facturación</Beneficio>
          <Beneficio>Soporte por WhatsApp para coordinar el pago</Beneficio>
        </Stack>

        <Text fontSize="xs" color="ink.500" mt="3" textAlign="center">
          La solicitud no activa el plan: primero coordinamos el pago.
        </Text>
      </Panel>

      <Stack gap="4">
        <Panel>
          <Text fontWeight="semibold" color="ink.900" mb="3">
            Estado actual
          </Text>

          {estado.suspendida ? (
            <Alert status="error" title="Cuenta suspendida">
              {estado.motivoBloqueo ??
                "Contactá al soporte de VetSirio para regularizar tu situación."}
            </Alert>
          ) : estado.expirado ? (
            <Alert status="warning" title="Período vencido">
              {estado.motivoBloqueo ??
                "Podés seguir consultando y exportando tus datos, pero no guardar cambios."}
            </Alert>
          ) : planActivo ? (
            <Alert status="success" title="Plan vigente">
              Tu plan está activo hasta el {formatFecha(estado.venceEn)}.
            </Alert>
          ) : (
            <Alert status="info" title="Período de prueba">
              {estado.diasRestantes === null
                ? "Tu período de prueba sigue activo."
                : `Te quedan ${estado.diasRestantes} ${
                    estado.diasRestantes === 1 ? "día" : "días"
                  } de prueba.`}
            </Alert>
          )}

          <Stack gap="2" mt="4">
            <Dato etiqueta="Plan actual" valor={estado.plan} capitalizar />
            {estado.venceEn && (
              <Dato etiqueta="Vence" valor={formatFecha(estado.venceEn)} />
            )}
            {estado.diasRestantes !== null && (
              <Dato
                etiqueta="Días restantes"
                valor={String(estado.diasRestantes)}
              />
            )}
          </Stack>
        </Panel>

        {solicitudPendiente ? (
          <Panel>
            <Flex align="center" gap="2" mb="3">
              <CalendarClock size={17} color="var(--chakra-colors-brand-600)" />
              <Text fontWeight="semibold" color="ink.900">
                Solicitud pendiente
              </Text>
            </Flex>

            <Text fontSize="sm" color="ink.600">
              Recibimos tu pedido el {formatFechaHora(solicitudPendiente.creadoEn)}.
              El equipo de VetSirio se va a comunicar con vos en la brevedad.
            </Text>

            <Stack gap="2" mt="4">
              <Dato
                etiqueta="Plan pedido"
                valor={`${MODALIDAD_META[solicitudPendiente.modalidad].etiqueta} (${formatMoneda(
                  solicitudPendiente.precioSnapshot,
                  { espacios: true },
                )} ${MODALIDAD_META[solicitudPendiente.modalidad].periodo})`}
              />
              {solicitudPendiente.modalidad === "anual" && (
                <Dato
                  etiqueta="Empieza"
                  valor={formatFecha(solicitudPendiente.iniciaEn)}
                />
              )}
              <Flex align="center" gap="2" fontSize="sm" color="ink.700">
                <MessageCircle size={14} />
                {solicitudPendiente.whatsapp}
              </Flex>
              <Flex align="center" gap="2" fontSize="sm" color="ink.700">
                <Mail size={14} />
                {solicitudPendiente.emailContacto}
              </Flex>
            </Stack>

            {solicitudPendiente.comentario && (
              <Box
                mt="4"
                bg="ink.50"
                borderLeftWidth="3px"
                borderColor="brand.400"
                borderRadius="sm"
                p="3"
              >
                <Text fontSize="xs" color="ink.500" fontWeight="semibold" mb="1">
                  Tu comentario
                </Text>
                <Text fontSize="sm" color="ink.700" whiteSpace="pre-wrap">
                  {solicitudPendiente.comentario}
                </Text>
              </Box>
            )}
          </Panel>
        ) : (
          <Panel>
            <Text fontWeight="semibold" color="ink.900" mb="3">
              Cómo sigue
            </Text>
            <Stack gap="3">
              <Paso numero="1">
                Elegís la modalidad y enviás la solicitud con tu WhatsApp y email.
              </Paso>
              <Paso numero="2">
                El equipo de VetSirio te contacta para coordinar el pago.
              </Paso>
              <Paso numero="3">
                Confirmado el pago, activamos tu plan por el período elegido.
              </Paso>
            </Stack>
          </Panel>
        )}
      </Stack>
    </Grid>
  );
}

/**
 * Ahorro del plan anual frente a doce meses del mensual.
 *
 * Devuelve null si falta alguno de los dos precios o si el anual no es más
 * barato: en ese caso no hay nada que destacar.
 */
function calcularAhorroAnual(
  precioMensual: string | null,
  precioAnual: string | null,
): number | null {
  if (!precioMensual || !precioAnual) return null;

  const mensual = Number(precioMensual);
  const anual = Number(precioAnual);

  if (!Number.isFinite(mensual) || !Number.isFinite(anual)) return null;

  const ahorro = mensual * 12 - anual;

  return ahorro > 0 ? Math.round(ahorro) : null;
}

function TarjetaPlan({
  modalidad,
  precio,
  descripcion,
  ahorro = null,
  deshabilitado,
  textoBoton,
  solicitudPendiente,
  solicitando,
  onElegir,
  destacada,
}: {
  modalidad: ModalidadPlan;
  precio: string | null;
  descripcion: string;
  ahorro?: number | null;
  deshabilitado: boolean;
  textoBoton?: string;
  solicitudPendiente: boolean;
  solicitando: boolean;
  onElegir: () => void;
  destacada?: boolean;
}) {
  const meta = MODALIDAD_META[modalidad];
  const monto = precio ? formatMoneda(precio, { espacios: true }) : "Consultar";

  const etiqueta = solicitudPendiente
    ? "Solicitud enviada"
    : (textoBoton ?? `Solicitar plan ${meta.etiqueta.toLowerCase()}`);

  return (
    <Flex
      direction="column"
      position="relative"
      borderWidth="1px"
      borderColor={destacada ? "purple.300" : "ink.200"}
      bg={destacada ? "purple.50" : "white"}
      borderRadius="lg"
      p="5"
    >
      {destacada && (
        <Badge
          position="absolute"
          top="-3"
          right="4"
          colorPalette="purple"
          variant="solid"
          size="sm"
        >
          <Star size={12} />
          Recomendado
        </Badge>
      )}

      <Text
        fontSize="sm"
        fontWeight="semibold"
        color={destacada ? "purple.700" : "ink.700"}
      >
        {meta.etiqueta}
      </Text>

      <Flex align="baseline" gap="2" mt="2">
        <Text
          fontSize="3xl"
          fontWeight="bold"
          color="ink.900"
          letterSpacing="-0.03em"
          fontVariantNumeric="tabular-nums"
        >
          {monto}
        </Text>
        <Text fontSize="xs" color="ink.500">
          {meta.periodo}
        </Text>
      </Flex>

      <Text fontSize="sm" color="ink.600" mt="2" flex="1">
        {descripcion}
      </Text>

      <Box minH="1.25rem" mt="2">
        {ahorro !== null && (
          <Text fontSize="xs" fontWeight="semibold" color="green.700">
            Ahorrás {formatMoneda(ahorro)}
          </Text>
        )}
      </Box>

      <Button
        mt="4"
        width="full"
        colorPalette={destacada ? "purple" : "brand"}
        variant={destacada ? "solid" : "outline"}
        loading={solicitando}
        disabled={deshabilitado}
        onClick={onElegir}
      >
        {deshabilitado ? (
          <CheckCircle2 size={16} />
        ) : (
          <Send size={16} />
        )}
        {etiqueta}
      </Button>
    </Flex>
  );
}

function Beneficio({ children }: { children: ReactNode }) {
  return (
    <Flex align="flex-start" gap="2.5" fontSize="sm" color="ink.700">
      <Box color="brand.600" mt="0.5" flexShrink={0}>
        <CheckCircle2 size={16} />
      </Box>
      <Text>{children}</Text>
    </Flex>
  );
}

function Paso({ numero, children }: { numero: string; children: ReactNode }) {
  return (
    <Flex align="flex-start" gap="3">
      <Flex
        align="center"
        justify="center"
        w="6"
        h="6"
        borderRadius="full"
        bg="brand.subtle"
        color="brand.fg"
        fontSize="xs"
        fontWeight="bold"
        flexShrink={0}
      >
        {numero}
      </Flex>
      <Text fontSize="sm" color="ink.700">
        {children}
      </Text>
    </Flex>
  );
}

function Dato({
  etiqueta,
  valor,
  capitalizar,
}: {
  etiqueta: string;
  valor: string;
  capitalizar?: boolean;
}) {
  return (
    <Flex justify="space-between" gap="4" fontSize="sm">
      <Text color="ink.500">{etiqueta}</Text>
      <Text
        color="ink.900"
        fontWeight="medium"
        style={capitalizar ? { textTransform: "capitalize" } : undefined}
      >
        {valor}
      </Text>
    </Flex>
  );
}
