import {
  Box,
  Button,
  chakra,
  Container,
  Flex,
  Heading,
  Input,
  PinInput,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import logoVetSirio from "@/assets/img/02_VetSirio_logo_fondo_blanco.png";
import { Alert } from "@/components/ui/alert";
import {
  ProgressCircleRing,
  ProgressCircleRoot,
  ProgressCircleValueText,
} from "@/components/ui/progress-circle";
import { ApiError, http } from "@/services/api";
import { guardarEmailRecordado } from "@/features/auth/emailRecordado";
import { recuperacionSchema } from "@/lib/validaciones";
import {
  calcularMsRestantes,
  enmascararEmail,
  esCodigoCompleto,
  estadoDelTiempo,
  formatearCuentaRegresiva,
  porcentajeRestante,
  segundosParaReenviar,
} from "./recuperar.calculo";

type Paso = "email" | "codigo";

interface RespuestaSolicitud {
  mensaje: string;
  /** Vencimiento absoluto del código, en ISO 8601. */
  expiraEn: string;
  minutosValidezCodigo: number;
}

interface RespuestaVerificacion {
  token: string;
  expiraEn: string;
}

const LONGITUD_CODIGO = 6;
const MINUTOS_VALIDEZ_POR_DEFECTO = 10;

/** Anillo de foco compartido con la pantalla de acceso. */
const anilloFoco =
  "0 0 0 3px color-mix(in srgb, var(--chakra-colors-brand-500) 18%, transparent)";

/**
 * `Date.now` aislado en una función de módulo para que el compilador de React
 * no lo interprete como una llamada impura durante el render.
 */
function marcaDeTiempo(): number {
  return Date.now();
}

/**
 * Recuperación de contraseña en dos pasos: correo y código de 6 dígitos.
 *
 * La respuesta del backend es la misma exista o no el correo. Por eso la
 * pantalla avanza al paso del código siempre, sin confirmar si la dirección
 * está registrada: hacerlo convertiría el formulario en un oráculo de qué
 * correos tienen cuenta.
 *
 * El contador se calcula desde `expiraEn` (fecha absoluta del servidor) en cada
 * tick y no restando de a un segundo, para que no se desfase si la pestaña se
 * suspende. El backend valida el vencimiento igual: el contador es sólo visual.
 */
export function RecuperarPasswordPage() {
  const navigate = useNavigate();

  const [paso, setPaso] = useState<Paso>("email");
  const [email, setEmail] = useState("");
  const [expiraEn, setExpiraEn] = useState<string | null>(null);
  const [minutosValidez, setMinutosValidez] = useState(
    MINUTOS_VALIDEZ_POR_DEFECTO,
  );
  const [ultimoEnvioMs, setUltimoEnvioMs] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [digitos, setDigitos] = useState<string[]>([]);
  const [verificando, setVerificando] = useState(false);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);

  const { register, handleSubmit, formState, reset, getValues } = useForm<{
    email: string;
  }>({
    resolver: zodResolver(recuperacionSchema),
    defaultValues: { email: "" },
  });

  // Un solo intervalo mientras se muestra el código. Al volver al paso del
  // correo se limpia para no seguir re-renderizando sin motivo.
  useEffect(() => {
    if (paso !== "codigo") return;

    const intervalo = window.setInterval(() => setAhora(Date.now()), 1000);

    return () => window.clearInterval(intervalo);
  }, [paso]);

  const msRestantes = calcularMsRestantes(expiraEn, ahora);
  const msTotal = minutosValidez * 60 * 1000;
  const porcentaje = porcentajeRestante(msRestantes, msTotal);
  const estado = estadoDelTiempo(msRestantes);
  const vencido = estado === "vencido";
  const segundosReenvio = segundosParaReenviar(ultimoEnvioMs, ahora);

  const codigo = digitos.join("");
  const codigoCompleto = esCodigoCompleto(codigo);

  const anuncio =
    estado === "critico"
      ? "Quedan menos de 30 segundos para ingresar el código."
      : estado === "vencido"
        ? "El código venció. Pedí uno nuevo."
        : "";

  const solicitar = async (emailSolicitado: string) => {
    setError(null);
    setCargando(true);

    try {
      const respuesta = await http.post<RespuestaSolicitud>(
        "/auth/recuperar-password",
        { email: emailSolicitado },
      );

      // Si el pedido salió bien, el correo queda listo para precargarse en el
      // acceso: la persona ya lo escribió una vez y no debería repetirlo.
      guardarEmailRecordado(emailSolicitado);
      setEmail(emailSolicitado);
      setExpiraEn(respuesta.expiraEn);
      setMinutosValidez(
        respuesta.minutosValidezCodigo > 0
          ? respuesta.minutosValidezCodigo
          : MINUTOS_VALIDEZ_POR_DEFECTO,
      );
      setDigitos([]);
      setErrorCodigo(null);
      const enviadoEn = marcaDeTiempo();
      setUltimoEnvioMs(enviadoEn);
      setAhora(enviadoEn);
      setPaso("codigo");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos enviar el correo. Intentá de nuevo en unos minutos.",
      );
    } finally {
      setCargando(false);
    }
  };

  const enviar = handleSubmit(async (datos) => {
    await solicitar(datos.email.trim());
  });

  const reenviar = async () => {
    if (!email || cargando || segundosReenvio > 0) return;

    await solicitar(email);
  };

  const verificar = async () => {
    if (!codigoCompleto || verificando || vencido) return;

    setError(null);
    setErrorCodigo(null);
    setVerificando(true);

    try {
      const respuesta = await http.post<RespuestaVerificacion>(
        "/auth/verificar-codigo",
        { email, codigo },
      );

      // El backend rotó el token: el enlace del correo ya no sirve y sólo este
      // navegador, que demostró acceso al correo, puede continuar.
      navigate(
        `/restablecer-password?token=${encodeURIComponent(respuesta.token)}`,
      );
    } catch (e) {
      const mensaje =
        e instanceof ApiError && e.code === "CODIGO_RESET_INVALIDO"
          ? "El código no es válido o venció. Revisalo e intentá de nuevo."
          : e instanceof Error
            ? e.message
            : "No pudimos verificar el código. Intentá de nuevo.";

      setErrorCodigo(mensaje);
      setDigitos([]);
    } finally {
      setVerificando(false);
    }
  };

  const volverAlCorreo = () => {
    setPaso("email");
    setDigitos([]);
    setError(null);
    setErrorCodigo(null);
    reset({ email });
  };

  const colorAnillo =
    estado === "vencido"
      ? "red.300"
      : estado === "critico"
        ? "red.500"
        : estado === "aviso"
          ? "orange.500"
          : "brand.500";

  const colorTexto =
    estado === "critico" || estado === "vencido"
      ? "danger.600"
      : estado === "aviso"
        ? "warning.600"
        : "ink.700";

  return (
    <Flex minH="100dvh" bg="ink.50" align="center" py="10" px="5">
      <Container maxW="26rem" p="0">
        <Box
          bg="white"
          borderRadius="2xl"
          borderWidth="1px"
          borderColor="ink.200"
          px={{ base: "6", md: "8" }}
          py={{ base: "7", md: "9" }}
        >
          {/* Logo con fondo blanco: se funde con la tarjeta, que también es
              blanca. La imagen original es grande, así que se limita el ancho y
              la altura se calcula sola para no deformarla. */}
          <chakra.img
            src={logoVetSirio}
            alt="VetSirio — gestión veterinaria"
            display="block"
            w="full"
            maxW="21rem"
            h="auto"
            mx="auto"
            mb="7"
            decoding="async"
            draggable={false}
            userSelect="none"
          />

          {/* Indicador de paso: dos barras finas y el número de paso. */}
          <Box mb="6" aria-hidden="true">
            <Flex gap="1.5">
              <Box flex="1" h="1" borderRadius="full" bg="brand.500" />
              <Box
                flex="1"
                h="1"
                borderRadius="full"
                bg={paso === "codigo" ? "brand.500" : "ink.200"}
                transition="background 200ms ease"
              />
            </Flex>
            <Text fontSize="xs" color="ink.500" mt="2">
              Paso {paso === "email" ? 1 : 2} de 2
            </Text>
          </Box>

          {paso === "email" ? (
            <>
              <Heading
                as="h1"
                fontSize="xl"
                fontWeight="semibold"
                color="ink.900"
                letterSpacing="-0.02em"
              >
                Recuperar contraseña
              </Heading>

              <Text color="ink.500" mt="1.5" mb="6" fontSize="sm" lineHeight="1.6">
                Ingresá el correo con el que registraste tu veterinaria. Te
                enviamos un código de 6 dígitos y un enlace para crear una
                contraseña nueva.
              </Text>

              {error && (
                <Alert status="error" rounded="md" mb="4">
                  {error}
                </Alert>
              )}

              <chakra.form onSubmit={enviar} noValidate>
                <Box mb="5">
                  <chakra.label
                    htmlFor="email"
                    fontSize="sm"
                    fontWeight="medium"
                    color="ink.700"
                    mb="1.5"
                    display="block"
                  >
                    Correo electrónico
                  </chakra.label>

                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="tu@veterinaria.com"
                    h="11"
                    borderColor={
                      formState.errors.email ? "danger.500" : "ink.200"
                    }
                    _hover={{
                      borderColor: formState.errors.email
                        ? "danger.500"
                        : "ink.300",
                    }}
                    _focusVisible={{
                      borderColor: formState.errors.email
                        ? "danger.500"
                        : "brand.500",
                      boxShadow: anilloFoco,
                    }}
                    {...register("email")}
                  />

                  {formState.errors.email && (
                    <Text fontSize="xs" color="danger.600" mt="1.5">
                      {formState.errors.email.message}
                    </Text>
                  )}
                </Box>

                <Button
                  type="submit"
                  w="full"
                  h="11"
                  bg="brand.500"
                  color="white"
                  fontWeight="semibold"
                  borderRadius="lg"
                  loading={cargando}
                  _hover={{ bg: "brand.600" }}
                  _active={{ bg: "brand.700" }}
                >
                  Enviar código
                </Button>
              </chakra.form>
            </>
          ) : (
            <chakra.form
              onSubmit={(evento) => {
                evento.preventDefault();
                void verificar();
              }}
              noValidate
            >
              <Flex direction="column" align="center" textAlign="center">
                <Flex
                  align="center"
                  justify="center"
                  w="12"
                  h="12"
                  borderRadius="full"
                  bg="brand.subtle"
                  color="brand.fg"
                  mb="4"
                >
                  <ShieldCheck size={24} />
                </Flex>

                <Heading
                  as="h1"
                  fontSize="xl"
                  fontWeight="semibold"
                  color="ink.900"
                  letterSpacing="-0.02em"
                >
                  Ingresá el código
                </Heading>

                <Text color="ink.500" mt="1.5" fontSize="sm" lineHeight="1.6">
                  Enviamos un código de 6 dígitos a{" "}
                  <chakra.span fontWeight="semibold" color="ink.800">
                    {enmascararEmail(email)}
                  </chakra.span>
                  . Revisá también la carpeta de spam.
                </Text>
              </Flex>

              <Flex justify="center" mt="6" mb="1">
                <ProgressCircleRoot
                  value={porcentaje}
                  size="xl"
                  css={{
                    "@media (prefers-reduced-motion: reduce)": {
                      "& circle": { transition: "none" },
                    },
                  }}
                >
                  <ProgressCircleRing
                    cap="round"
                    trackColor="ink.100"
                    color={colorAnillo}
                  />
                  <ProgressCircleValueText
                    fontSize="sm"
                    fontWeight="bold"
                    color={colorTexto}
                    fontVariantNumeric="tabular-nums"
                  >
                    {formatearCuentaRegresiva(msRestantes)}
                  </ProgressCircleValueText>
                </ProgressCircleRoot>
              </Flex>

              <Text
                fontSize="xs"
                color={vencido ? "danger.600" : "ink.500"}
                textAlign="center"
                mb="5"
              >
                {vencido
                  ? "El código venció. Pedí uno nuevo para continuar."
                  : `El código vence en ${minutosValidez} minutos.`}
              </Text>

              <PinInput.Root
                value={digitos}
                onValueChange={(detalles) => setDigitos(detalles.value)}
                count={LONGITUD_CODIGO}
                otp
                type="numeric"
                autoFocus
                disabled={vencido || verificando}
              >
                <PinInput.HiddenInput />
                <PinInput.Control gap="2" justifyContent="center">
                  {Array.from({ length: LONGITUD_CODIGO }, (_, indice) => (
                    <PinInput.Input
                      key={indice}
                      index={indice}
                      h="12"
                      w="10"
                      fontSize="xl"
                      fontWeight="semibold"
                      textAlign="center"
                      borderRadius="md"
                      borderColor={
                        errorCodigo
                          ? "danger.400"
                          : estado === "critico" || estado === "vencido"
                            ? "danger.300"
                            : "ink.200"
                      }
                      _hover={{ borderColor: "ink.300" }}
                      _focusVisible={{
                        borderColor: "brand.500",
                        boxShadow: anilloFoco,
                      }}
                      aria-label={`Dígito ${indice + 1} de ${LONGITUD_CODIGO}`}
                    />
                  ))}
                </PinInput.Control>
              </PinInput.Root>

              {errorCodigo && (
                <Alert status="error" rounded="md" mt="4">
                  {errorCodigo}
                </Alert>
              )}

              {error && (
                <Alert status="error" rounded="md" mt="4">
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                w="full"
                h="11"
                mt="5"
                bg="brand.500"
                color="white"
                fontWeight="semibold"
                borderRadius="lg"
                loading={verificando}
                disabled={!codigoCompleto || vencido}
                _hover={{ bg: "brand.600" }}
                _active={{ bg: "brand.700" }}
              >
                Verificar código
              </Button>

              <Flex justify="center" align="center" gap="1" mt="3" wrap="wrap">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={reenviar}
                  loading={cargando}
                  disabled={segundosReenvio > 0 || cargando}
                  color="ink.600"
                >
                  {segundosReenvio > 0
                    ? `Reenviar en ${segundosReenvio}s`
                    : "Reenviar código"}
                </Button>

                <Text color="ink.300" aria-hidden="true">
                  ·
                </Text>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={volverAlCorreo}
                  disabled={verificando}
                  color="ink.600"
                >
                  Cambiar correo
                </Button>
              </Flex>

              <Text
                fontSize="xs"
                color="ink.500"
                textAlign="center"
                mt="2"
                lineHeight="1.6"
              >
                También podés usar el enlace del correo. Al usar el código, el
                enlace deja de funcionar.
              </Text>

              {anuncio && (
                <VisuallyHidden role="status" aria-live="polite">
                  {anuncio}
                </VisuallyHidden>
              )}
            </chakra.form>
          )}
        </Box>

        <Link
          to="/login"
          onClick={() => guardarEmailRecordado(email || getValues("email"))}
        >
          <Flex
            align="center"
            gap="2"
            justify="center"
            mt="6"
            color="ink.500"
            _hover={{ color: "ink.900" }}
          >
            <ArrowLeft size={16} />
            <Text fontSize="sm" fontWeight="medium">
              Volver al acceso
            </Text>
          </Flex>
        </Link>
      </Container>
    </Flex>
  );
}