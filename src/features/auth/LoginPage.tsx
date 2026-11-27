import {
  Box,
  Button,
  chakra,
  Flex,
  Grid,
  Heading,
  Input,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, PawPrint } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import logoLoginMovil from "@/assets/img/02_VetSirio_logo_fondo_blanco.png";
import logoLoginOscuro from "@/assets/img/06_logo_pantalla_login_transparente.png";
import logoLoginClaro from "@/assets/img/06_logo_pantalla_login_transparente.png";
import { LoginLoading } from "@/components/auth/LoginLoading";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/features/auth/auth.store";
import {
  guardarEmailRecordado,
  leerEmailRecordado,
  olvidarEmailRecordado,
} from "@/features/auth/emailRecordado";
import { loginSchema, type LoginForm } from "@/lib/validaciones";

/** Frases que rotan en el panel de marca. */
const FRASES = [
  "Agenda que nunca se superpone",
  "Historia clínica de cada mascota",
  "Vacunas al día, sin planillas",
  "Stock y lotes bajo control",
  "Tickets que salen en un click",
  "Cuentas que cierran solas",
];

/** Huellas del recorrido animado: posición (%), giro (grados) y retardo (s). */
const HUELLAS = [
  { x: 8, y: 78, giro: 62, retardo: 0 },
  { x: 24, y: 58, giro: 82, retardo: 0.7 },
  { x: 40, y: 70, giro: 58, retardo: 1.4 },
  { x: 56, y: 48, giro: 80, retardo: 2.1 },
  { x: 72, y: 60, giro: 56, retardo: 2.8 },
  { x: 88, y: 36, giro: 78, retardo: 3.5 },
];

/** Azul noche con un leve tinte del color de marca hacia la esquina inferior. */
const COLOR_FONDO_PANEL =
  "linear-gradient(160deg, var(--chakra-colors-ink-950, #0b1220) 0%, var(--chakra-colors-ink-950, #0b1220) 45%, color-mix(in srgb, var(--chakra-colors-brand-500) 24%, var(--chakra-colors-ink-950, #0b1220)) 100%)";

const anilloFoco =
  "0 0 0 3px color-mix(in srgb, var(--chakra-colors-brand-500) 18%, transparent)";

/**
 * Animaciones del login. Se definen aquí para que la pantalla sea autónoma y
 * no dependa de keyframes globales. Todo es transform/opacity/stroke: no hay
 * imágenes que descargar. Con "reducir movimiento" activado quedan estáticas.
 */
const ESTILOS_ANIMACION = `
@keyframes vs-login-paso {
  0%   { opacity: 0; transform: translateY(6px) rotate(var(--giro)) scale(.9); }
  18%  { opacity: .55; transform: translateY(0) rotate(var(--giro)) scale(1); }
  60%  { opacity: .55; }
  100% { opacity: 0; transform: translateY(-4px) rotate(var(--giro)) scale(1); }
}
@keyframes vs-login-latido {
  0%   { stroke-dashoffset: 100; }
  55%  { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -100; }
}
@keyframes vs-login-fundido {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes vs-login-flotar {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50%      { transform: translate3d(2rem, 1.5rem, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .vs-login-anim { animation: none !important; }
  .vs-login-huella { opacity: .28 !important; }
}
`;

/**
 * Pantalla de acceso, versión minimalista con panel lateral.
 *
 * Panel de marca oscuro a la izquierda (una frase que rota, un recorrido de
 * huellas y una línea de latido) y formulario sin adornos a la derecha. En
 * pantallas chicas el panel desaparece y el logo pasa encima del título.
 *
 * Las columnas usan grid `1fr 34rem`: el formulario queda pegado al borde
 * derecho y el panel ocupa exactamente el resto.
 */
export function LoginPage() {
  const { login, autenticado, cargando } = useAuth();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();

  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [emailRecordado] = useState(leerEmailRecordado);
  const [recordarEmail, setRecordarEmail] = useState(emailRecordado.length > 0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema) as Resolver<LoginForm>,
    defaultValues: {
      email: emailRecordado,
      password: "",
    },
    mode: "onBlur",
  });

  // Si ya hay sesión, mostrar el login obliga a un clic de más.
  useEffect(() => {
    if (autenticado) {
      navegar("/", { replace: true });
    }
  }, [autenticado, navegar]);

  const sesionExpirada = parametros.get("sesion") === "expirada";
  const registrado = parametros.get("registrado") === "1";
  const restablecido = parametros.get("restablecido") === "1";

  const enviar = handleSubmit(async (datos) => {
    setErrorGeneral(null);
    setEnviando(true);

    try {
      await login(datos);
      // El correo se recuerda sólo cuando el login salió bien, para no guardar
      // direcciones mal escritas. El backend nunca recibe esta preferencia.
      if (recordarEmail) {
        guardarEmailRecordado(datos.email);
      } else {
        olvidarEmailRecordado();
      }
      // Si el login funciona, `login` navega al inicio y este componente se
      // desmonta. La capa de carga sigue montada durante la transición para
      // que no se vea el parpadeo del formulario mientras carga el dashboard.
    } catch (error) {
      setErrorGeneral(
        error instanceof Error
          ? error.message
          : "No pudimos iniciar sesión. Intentá de nuevo.",
      );
      setEnviando(false);
    }
  });

  if (cargando) {
    return (
      <Flex minH="100dvh" align="center" justify="center" bg="ink.50">
        <Spinner size="lg" color="brand.500" />
      </Flex>
    );
  }

  return (
    <Grid
      minH="100dvh"
      templateColumns={{ base: "1fr", lg: "minmax(0, 1fr) 34rem" }}
    >
      <style>{ESTILOS_ANIMACION}</style>

      {/* ── Panel de marca (izquierda) ─────────────────────────────── */}
      <PanelMarca />

      {/* ── Formulario (derecha) ────────────────────────────────────── */}
      <Flex
        direction="column"
        justify="center"
        px={{ base: "6", md: "10", xl: "12" }}
        py={{ base: "8", md: "12" }}
        bg="white"
      >
        <Box w="full" maxW="24rem" mx="auto">
          {/* En escritorio la marca vive en el panel; aquí sólo en pantallas
              chicas, cuando el panel lateral desaparece. La imagen original es
              grande: se limita el ancho en pantalla y la altura se calcula sola
              para no deformarla. */}
          <Box display={{ base: "block", lg: "none" }} mb="8">
            <chakra.img
              src={logoLoginMovil}
              alt="VetSirio — gestión veterinaria"
              display="block"
              w="full"
              maxW={{ base: "12rem", md: "23rem" }}
              h="auto"
              decoding="async"
              draggable={false}
              userSelect="none"
            />
          </Box>

          <Heading
            as="h1"
            fontSize="2xl"
            fontWeight="semibold"
            color="ink.900"
            letterSpacing="-0.02em"
          >
            Iniciar sesión
          </Heading>

          <Text color="ink.500" mt="1.5" fontSize="sm">
            Ingresá con el correo de tu veterinaria.
          </Text>

          {registrado && !errorGeneral && (
            <Alert status="success" rounded="md" mt="5" title="¡Cuenta creada!">
              {emailRecordado ? (
                <>
                  Ya podés ingresar con <b>{emailRecordado}</b>.
                </>
              ) : (
                "Ya podés iniciar sesión."
              )}
            </Alert>
          )}

          {sesionExpirada && !errorGeneral && (
            <Alert status="warning" rounded="md" mt="5">
              Tu sesión venció. Iniciá sesión nuevamente.
            </Alert>
          )}

          {restablecido && !errorGeneral && (
            <Alert status="success" rounded="md" mt="5">
              Tu contraseña se actualizó. Ya podés iniciar sesión.
            </Alert>
          )}

          {errorGeneral && (
            <Alert status="error" rounded="md" mt="5">
              {errorGeneral}
            </Alert>
          )}

          <chakra.form onSubmit={enviar} mt="7" noValidate>
            <Campo id="email" label="Correo electrónico" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="tu@veterinaria.com"
                h="11"
                borderColor={errors.email ? "danger.500" : "ink.200"}
                _hover={{ borderColor: errors.email ? "danger.500" : "ink.300" }}
                _focusVisible={{
                  borderColor: errors.email ? "danger.500" : "brand.500",
                  boxShadow: anilloFoco,
                }}
                {...register("email")}
              />
            </Campo>

            <Campo id="password" label="Contraseña" error={errors.password?.message}>
              <Box position="relative">
                <Input
                  id="password"
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="current-password"
                  // Al volver del registro el correo ya está cargado, así que
                  // el foco arranca donde de verdad hace falta: la contraseña.
                  autoFocus={registrado && emailRecordado.length > 0}
                  placeholder="Tu contraseña"
                  h="11"
                  pr="11"
                  borderColor={errors.password ? "danger.500" : "ink.200"}
                  _hover={{ borderColor: errors.password ? "danger.500" : "ink.300" }}
                  _focusVisible={{
                    borderColor: errors.password ? "danger.500" : "brand.500",
                    boxShadow: anilloFoco,
                  }}
                  {...register("password")}
                />

                <chakra.button
                  type="button"
                  onClick={() => setMostrarPassword((previo) => !previo)}
                  position="absolute"
                  right="2"
                  top="50%"
                  transform="translateY(-50%)"
                  p="1.5"
                  borderRadius="md"
                  color="ink.400"
                  _hover={{ color: "ink.800" }}
                  aria-label={
                    mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {mostrarPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </chakra.button>
              </Box>
            </Campo>

            <Flex
              justify="space-between"
              align="center"
              mt="1"
              mb="6"
              wrap="wrap"
              gap="2"
            >
              <Checkbox
                size="sm"
                colorPalette="brand"
                checked={recordarEmail}
                onCheckedChange={(detalle) =>
                  setRecordarEmail(detalle.checked === true)
                }
              >
                <Text fontSize="sm" color="ink.600">
                  Recordarme
                </Text>
              </Checkbox>

              <Link to="/recuperar-password">
                <Text
                  fontSize="sm"
                  color="ink.600"
                  _hover={{ color: "brand.700", textDecoration: "underline" }}
                >
                  ¿Olvidaste tu contraseña?
                </Text>
              </Link>
            </Flex>

            <Button
              type="submit"
              w="full"
              h="11"
              bg="brand.500"
              color="white"
              fontWeight="semibold"
              borderRadius="lg"
              disabled={isSubmitting}
              _hover={{ bg: "brand.600" }}
              _active={{ bg: "brand.700" }}
            >
              {isSubmitting ? (
                <Flex align="center" gap="2">
                  <Spinner size="sm" />
                  <Text>Ingresando…</Text>
                </Flex>
              ) : (
                "Ingresar"
              )}
            </Button>
          </chakra.form>

          <Text textAlign="center" color="ink.500" mt="7" fontSize="sm">
            ¿Todavía no tenés cuenta?{" "}
            <Link to="/registro">
              <chakra.span
                color="brand.700"
                fontWeight="semibold"
                _hover={{ textDecoration: "underline" }}
              >
                Registrá tu veterinaria
              </chakra.span>
            </Link>
          </Text>

          <Text textAlign="center" color="ink.400" mt="3" fontSize="xs">
            Período de prueba gratuito
          </Text>
        </Box>
      </Flex>

      {/* Capa de carga. Se queda montada si el login fue exitoso, mientras el
          router reemplaza la pantalla. */}
      <LoginLoading visible={enviando} />
    </Grid>
  );
}

/**
 * Panel de marca.
 *
 * Fondo oscuro (azul noche con un tinte del color de marca). Tres elementos, todos
 * animados con CSS puro: frase rotativa, recorrido de huellas y línea de
 * latido. Es decorativo, por eso va oculto a lectores de pantalla.
 */
function PanelMarca() {
  return (
    <Box
      display={{ base: "none", lg: "block" }}
      position="relative"
      overflow="hidden"
      style={{ background: COLOR_FONDO_PANEL }}
    >
      {/* Mancha de color muy suave que deriva despacio. */}
      <Box
        className="vs-login-anim"
        aria-hidden="true"
        position="absolute"
        top="-14%"
        right="-10%"
        w="34rem"
        h="34rem"
        borderRadius="full"
        bg="brand.500"
        opacity="0.26"
        filter="blur(100px)"
        style={{ animation: "vs-login-flotar 24s ease-in-out infinite" }}
      />

      {/* Grilla muy tenue que se desvanece hacia los bordes. */}
      <Box
        aria-hidden="true"
        position="absolute"
        inset="0"
        opacity="0.07"
        backgroundImage={`linear-gradient(#fff 1px, transparent 1px),
                          linear-gradient(90deg, #fff 1px, transparent 1px)`}
        backgroundSize="56px 56px"
        maskImage="radial-gradient(ellipse 75% 65% at 40% 45%, black 35%, transparent 100%)"
        WebkitMaskImage="radial-gradient(ellipse 75% 65% at 40% 45%, black 35%, transparent 100%)"
      />

      <Flex
        position="relative"
        direction="column"
        h="100%"
        px={{ lg: "12", xl: "16" }}
        py="12"
      >
        <Marca oscuro />

        <Flex direction="column" justify="center" flex="1" py="10">
          <Text
            fontSize="xs"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="0.16em"
            color="brand.300"
            mb="4"
          >
            Gestión veterinaria
          </Text>

          <FraseRotativa />

          <Text color="ink.300" mt="4" maxW="26rem" lineHeight="1.65">
            Agenda, historia clínica, inventario y facturación en un solo lugar,
            con los datos de tu veterinaria aislados de los demás.
          </Text>

          <RecorridoHuellas />
        </Flex>

        <Box aria-hidden="true">
          <LineaLatido />
          <Text color="ink.400" fontSize="xs" mt="3">
            Agenda · Historia clínica · Inventario · Facturación
          </Text>
        </Box>
      </Flex>
    </Box>
  );
}

/** Frase grande que cambia cada pocos segundos con un fundido suave. */
function FraseRotativa() {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setIndice((previo) => (previo + 1) % FRASES.length),
      3800,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <Heading
      key={indice}
      className="vs-login-anim"
      as="h2"
      fontSize={{ lg: "3xl", xl: "4xl" }}
      fontWeight="semibold"
      color="white"
      lineHeight="1.15"
      letterSpacing="-0.025em"
      maxW="28rem"
      minH="2.4em"
      style={{ animation: "vs-login-fundido 650ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
    >
      {FRASES[indice]}
    </Heading>
  );
}

/** Huellas que aparecen una tras otra, como si una mascota cruzara la pantalla. */
function RecorridoHuellas() {
  return (
    <Box
      aria-hidden="true"
      position="relative"
      w="100%"
      maxW="30rem"
      h="9rem"
      mt="8"
    >
      {HUELLAS.map((huella, indice) => (
        <Box
          key={indice}
          className="vs-login-huella vs-login-anim"
          position="absolute"
          left={`${huella.x}%`}
          top={`${huella.y}%`}
          color="brand.300"
          opacity="0"
          style={
            {
              "--giro": `${huella.giro}deg`,
              animation: `vs-login-paso 4.2s ease-in-out ${huella.retardo}s infinite`,
            } as React.CSSProperties
          }
        >
          <PawPrint size={26} strokeWidth={1.75} />
        </Box>
      ))}
    </Box>
  );
}

/** Línea de electrocardiograma que se dibuja y se desvanece en bucle. */
function LineaLatido() {
  const trazo = "M0 30 H120 L134 30 L144 8 L158 52 L170 18 L180 30 H400";

  return (
    <chakra.svg
      viewBox="0 0 400 60"
      w="100%"
      maxW="26rem"
      h="auto"
      fill="none"
      color="brand.300"
    >
      <path
        d={trazo}
        stroke="currentColor"
        strokeOpacity="0.14"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="vs-login-anim"
        d={trazo}
        pathLength={100}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="100"
        style={{ animation: "vs-login-latido 3.6s linear infinite" }}
      />
    </chakra.svg>
  );
}

/**
 * Logo del producto. Se muestra con su tamaño original, sin escalarlo ni
 * recortarlo. `alignSelf="flex-start"` evita que el contenedor flex en
 * columna lo estire a todo el ancho del panel.
 */
function Marca({ oscuro = false }: { oscuro?: boolean }) {
  return (
    <chakra.img
      src={oscuro ? logoLoginOscuro : logoLoginClaro}
      alt="VetSirio — gestión veterinaria"
      display="block"
      alignSelf="flex-start"
      maxW="100%"
      draggable={false}
      userSelect="none"
    />
  );
}

/** Campo con etiqueta y mensaje de error. */
function Campo({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <Box mb="4">
      <chakra.label
        htmlFor={id}
        fontSize="sm"
        fontWeight="medium"
        color="ink.700"
        mb="1.5"
        display="block"
      >
        {label}
      </chakra.label>

      {children}

      {error && (
        <Text fontSize="xs" color="danger.600" mt="1.5">
          {error}
        </Text>
      )}
    </Box>
  );
}