import {
  Box,
  Button,
  chakra,
  Container,
  Flex,
  Grid,
  Heading,
  Input,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  HeartPulse,
  Lock,
  Mail,
  Receipt,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { LoginLoading } from "@/components/auth/LoginLoading";
import { TextoRotativo } from "@/components/layout/TextoRotativo";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/features/auth/auth.store";
import {
  guardarEmailRecordado,
  leerEmailRecordado,
  olvidarEmailRecordado,
} from "@/features/auth/emailRecordado";
import { loginSchema, type LoginForm } from "@/lib/validaciones";

/** Frases que se escriben solas en el panel de marca. */
const FRASES = [
  "Agenda que nunca se superpone",
  "Historia clínica de cada mascota",
  "Vacunas al día, sin planillas",
  "Stock y lotes bajo control",
  "Tickets que salen en un click",
  "Cuentas que cierran solas",
];

/** Capacidades que se listan con entrada escalonada. */
const CAPACIDADES = [
  {
    icono: CalendarCheck,
    titulo: "Agenda sin superposiciones",
    detalle: "Reservas por veterinario con control de horarios.",
  },
  {
    icono: HeartPulse,
    titulo: "Historial clínico completo",
    detalle: "Consultas, vacunas y recetas en un solo lugar.",
  },
  {
    icono: Receipt,
    titulo: "Facturación al día",
    detalle: "Tickets, cobros y cierre de caja sin planillas.",
  },
  {
    icono: ShieldCheck,
    titulo: "Cada clínica con sus datos",
    detalle: "Aislamiento real entre veterinarias.",
  },
];

/**
 * Pantalla de acceso.
 *
 * Layout en dos columnas: panel de marca a la izquierda y formulario a la
 * derecha. En móvil se apila y sólo queda el formulario, porque lo primero que
 * necesita alguien que quiere entrar es poder escribir su contraseña sin
 * desplazamiento.
 *
 * Las columnas se definen con un grid de `1fr 34rem` en lugar de dos cajas
 * `flex: 1`. Con flex, el límite de ancho del formulario deja un hueco vacío a
 * la derecha en pantallas anchas; con grid, el formulario queda pegado al borde
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
      // desmonta. La capa sigue montada durante la transición para que no se
      // vea el parpadeo del formulario vacío mientras carga el dashboard.
    } catch (error) {
      setErrorGeneral(
        error instanceof Error
          ? error.message
          : "No pudimos iniciar sesión. Intentá de nuevo.",
      );
      // Sólo se baja la capa si falló: si el login fue exitoso, la pantalla
      // ya está cambiando y bajarla mostraría el formulario un instante.
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
      bg="ink.50"
      templateColumns={{ base: "1fr", lg: "minmax(0, 1fr) 34rem" }}
    >
      {/* ── Panel de marca (izquierda) ─────────────────────────────── */}
      <PanelMarca />

      {/* ── Formulario (derecha) ────────────────────────────────────── */}
      <Flex
        direction="column"
        justify="center"
        px={{ base: "5", md: "10", xl: "12" }}
        py={{ base: "8", md: "12" }}
        bg="white"
        borderLeftWidth={{ lg: "1px" }}
        borderColor="ink.200"
      >
        <Container maxW="25rem" p="0">
          <Box display={{ base: "block", lg: "none" }}>
            <Logo />
          </Box>

          <Heading
            as="h1"
            fontSize={{ base: "2xl", md: "3xl" }}
            fontWeight="bold"
            color="ink.900"
            mt={{ base: "8", lg: "0" }}
            letterSpacing="-0.02em"
          >
            Iniciar Sesión
          </Heading>

          <Text color="ink.600" mt="2">
            Ingresá con el correo con el que registraste tu veterinaria.
          </Text>

          {registrado && !errorGeneral && (
            <Alert status="success" rounded="md" mt="5" title="¡Cuenta creada!">
              {emailRecordado ? (
                <>
                  Ya podés ingresar con <b>{emailRecordado}</b>. Te dejamos el
                  correo cargado.
                </>
              ) : (
                "Ya podés iniciar sesión."
              )}
            </Alert>
          )}

          {sesionExpirada && !errorGeneral && (
            <Alert status="warning" rounded="md" mt="5">
              Tu sesión venció o expiró. Iniciá sesión nuevamente.
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

          <chakra.form onSubmit={enviar} mt="6" noValidate>
            <Campo
              id="email"
              label="Correo electrónico"
              error={errors.email?.message}
              icono={<Mail size={17} />}
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="tu@veterinaria.com"
                pl="10"
                h="11"
                borderColor={errors.email ? "danger.500" : "ink.200"}
                _focusVisible={{
                  borderColor: errors.email ? "danger.500" : "brand.500",
                  boxShadow:
                    "0 0 0 3px color-mix(in srgb, var(--chakra-colors-brand-500) 22%, transparent)",
                }}
                {...register("email")}
              />
            </Campo>

            <Campo
              id="password"
              label="Contraseña"
              error={errors.password?.message}
              icono={<Lock size={17} />}
            >
              <Box position="relative">
                <Input
                  id="password"
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="current-password"
                  // Al volver del registro el correo ya está cargado, así que
                  // el foco arranca donde de verdad hace falta: la clave.
                  autoFocus={registrado && emailRecordado.length > 0}
                  placeholder="Tu contraseña"
                  pl="10"
                  pr="11"
                  h="11"
                  borderColor={errors.password ? "danger.500" : "ink.200"}
                  _focusVisible={{
                    borderColor: errors.password ? "danger.500" : "brand.500",
                    boxShadow:
                      "0 0 0 3px color-mix(in srgb, var(--chakra-colors-brand-500) 22%, transparent)",
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
                  color="ink.500"
                  _hover={{ bg: "ink.100", color: "ink.800" }}
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
                Recordar mi correo
              </Checkbox>

              <Link to="/recuperar-password">
                <Text
                  fontSize="sm"
                  color="brand.700"
                  fontWeight="medium"
                  _hover={{ textDecoration: "underline" }}
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
              borderRadius="md"
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
                <Flex align="center" justify="center" gap="2">
                  <Text>Ingresar</Text>
                  <ArrowRight size={17} />
                </Flex>
              )}
            </Button>
          </chakra.form>

          <Flex align="center" gap="3" my="6">
            <Box flex="1" h="1px" bg="ink.200" />
            <Text fontSize="xs" color="ink.400">
              o
            </Text>
            <Box flex="1" h="1px" bg="ink.200" />
          </Flex>

          <Link to="/registro">
            <Button
              variant="outline"
              w="full"
              h="11"
              borderColor="ink.300"
              color="ink.800"
              fontWeight="semibold"
              _hover={{ bg: "ink.50", borderColor: "brand.400", color: "brand.700" }}
            >
              Crear cuenta de una veterinaria
            </Button>
          </Link>

          <Text textAlign="center" color="ink.500" mt="4" fontSize="xs">
            Período de prueba gratuito.
          </Text>
        </Container>
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
 * Todo lo decorativo va con gradientes CSS y animaciones de transformación:
 * pesa cero bytes contra una imagen de fondo, que es lo que de verdad hace
 * lenta una landing.
 */
function PanelMarca() {
  return (
    <Box
      display={{ base: "none", lg: "block" }}
      position="relative"
      overflow="hidden"
      bg="ink.950"
    >
      {/* Orbes de color: dan profundidad sin una sola imagen. */}
      <Box
        position="absolute"
        inset="0"
        overflow="hidden"
        aria-hidden="true"
      >
        <Box
          position="absolute"
          top="-18%"
          left="-12%"
          w="38rem"
          h="38rem"
          borderRadius="full"
          bg="brand.600"
          opacity="0.32"
          filter="blur(90px)"
          animation="vetsirio-deriva 18s ease-in-out infinite"
        />
        <Box
          position="absolute"
          bottom="-22%"
          right="-10%"
          w="32rem"
          h="32rem"
          borderRadius="full"
          bg="brand.400"
          opacity="0.2"
          filter="blur(100px)"
          animation="vetsirio-deriva 22s ease-in-out infinite reverse"
        />
        <Box
          position="absolute"
          top="42%"
          right="18%"
          w="18rem"
          h="18rem"
          borderRadius="full"
          bg="brand.300"
          opacity="0.14"
          filter="blur(70px)"
          animation="vetsirio-deriva 26s ease-in-out infinite"
        />
      </Box>

      {/* Grilla sutil: da textura sin distraer. */}
      <Box
        position="absolute"
        inset="0"
        opacity="0.16"
        aria-hidden="true"
        backgroundImage={`linear-gradient(rgba(255,255,255,.09) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(255,255,255,.09) 1px, transparent 1px)`}
        backgroundSize="52px 52px"
        // Máscara radial: la grilla se desvanece hacia los bordes para que
        // se vea como textura de fondo y no como una cuadrícula de Excel.
        maskImage="radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 100%)"
        WebkitMaskImage="radial-gradient(ellipse 80% 70% at 50% 40%, black 40%, transparent 100%)"
      />

      <Flex
        position="relative"
        direction="column"
        justify="center"
        h="100%"
        px={{ lg: "12", xl: "16" }}
        py="14"
        color="white"
      >
        {/* Marca */}
        <Flex align="center" gap="3" mb="12">
          <Flex
            align="center"
            justify="center"
            w="10"
            h="10"
            borderRadius="lg"
            bg="brand.500"
            fontWeight="bold"
            boxShadow="0 6px 20px color-mix(in srgb, var(--chakra-colors-brand-500) 45%, transparent)"
          >
            VS
          </Flex>
          <Box>
            <Text fontWeight="bold" fontSize="lg" lineHeight="1.1">
              VetSirio
            </Text>
            <Text fontSize="xs" color="brand.200">
              Software para veterinarias
            </Text>
          </Box>
        </Flex>

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

        {/* Frase rotativa */}
        <Box maxW="26rem" mb="6">
          <TextoRotativo frases={FRASES} />
        </Box>

        <Text mt="2" color="ink.200" fontSize={{ lg: "md", xl: "lg" }} lineHeight="1.65" maxW="28rem">
          Agenda, historia clínica, inventario y facturación, con los datos de tu
          veterinaria aislados de los demás.
        </Text>

        {/* Capacidades con entrada escalonada: aparecen una tras otra al cargar,
            no todas de golpe, que es lo que hace que una pantalla se sienta
            estática. */}
        <Grid gap="5" mt="12">
          {CAPACIDADES.map((capacidad, indice) => (
            <Flex
              key={capacidad.titulo}
              gap="3.5"
              align="flex-start"
              style={{
                animation: `vetsirio-entrada 520ms cubic-bezier(0.22, 1, 0.36, 1) ${indice * 110 + 180}ms both`,
              }}
            >
              <Flex
                align="center"
                justify="center"
                w="9"
                h="9"
                borderRadius="md"
                bg="whiteAlpha.100"
                borderWidth="1px"
                borderColor="whiteAlpha.200"
                color="brand.200"
                flexShrink={0}
              >
                <capacidad.icono size={17} />
              </Flex>
              <Box>
                <Text fontWeight="semibold" fontSize="sm">
                  {capacidad.titulo}
                </Text>
                <Text fontSize="xs" color="ink.300" mt="0.5" lineHeight="1.55">
                  {capacidad.detalle}
                </Text>
              </Box>
            </Flex>
          ))}
        </Grid>

        {/* Pie con sello de seguridad */}
        <Flex
          align="center"
          gap="2.5"
          mt="12"
          pt="6"
          borderTopWidth="1px"
          borderColor="whiteAlpha.150"
          wrap="wrap"
        >
    
          <Flex align="center" gap="2">
            <CheckCircle2 size={14} color="var(--chakra-colors-brand-300)" />
            <Text fontSize="xs" color="ink.300">
              Datos aislados por veterinaria
            </Text>
          </Flex>

          <Flex align="center" gap="2">
            <Lock size={14} color="var(--chakra-colors-brand-300)" />
            <Text fontSize="xs" color="ink.300">
              Contraseñas cifradas 
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </Box>
  );
}

function Logo() {
  return (
    <Flex align="center" gap="3">
      <Flex
        align="center"
        justify="center"
        w="11"
        h="11"
        borderRadius="lg"
        bg="brand.500"
        color="white"
        fontWeight="bold"
        fontSize="lg"
        boxShadow="0 6px 16px color-mix(in srgb, var(--chakra-colors-brand-500) 35%, transparent)"
      >
        VS
      </Flex>
      <Box>
        <Text fontWeight="bold" fontSize="lg" color="ink.900" lineHeight="1.1">
          VetSirio
        </Text>
        <Text fontSize="xs" color="ink.500">
          Software para veterinarias
        </Text>
      </Box>
    </Flex>
  );
}

/** Campo con etiqueta, icono y error. Unifica los tres estados del input. */
function Campo({
  id,
  label,
  error,
  icono,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box mb="4">
      <chakra.label
        htmlFor={id}
        fontSize="sm"
        fontWeight="medium"
        color="ink.800"
        mb="1.5"
        display="block"
      >
        {label}
      </chakra.label>

      <Box position="relative">
        <Box
          position="absolute"
          left="3"
          top="50%"
          transform="translateY(-50%)"
          color={error ? "danger.500" : "ink.400"}
          pointerEvents="none"
          zIndex="1"
        >
          {icono}
        </Box>
        {children}
      </Box>

      {error && (
        <Text fontSize="xs" color="danger.600" mt="1.5" fontWeight="medium">
          {error}
        </Text>
      )}
    </Box>
  );
}