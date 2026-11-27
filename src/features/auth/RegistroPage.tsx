import { chakra, Box,
  Button,
  Container,
  Flex,
  Grid,
  Heading,
  Input,
  Spinner,
  Text, } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Lock,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";

import logoVetSirio from "@/assets/img/08_app_icon_192x192.png";
import { Alert } from "@/components/ui/alert";
import { guardarEmailRecordado } from "@/features/auth/emailRecordado";
import { http } from "@/services/api";
import { registroSchema, type RegistroForm } from "@/lib/validaciones";

/** Cuánto se queda el mensaje de éxito antes de saltar solo al acceso. */
const MS_ANTES_DEL_ACCESO = 2500;

/**
 * Requisitos de `passwordSchema`, con la misma regla que valida Zod y el
 * backend. Se declaran acá como funciones para poder evaluarlos en vivo
 * mientras la persona escribe; si cambia el esquema, hay que cambiarlos acá.
 */
const REQUISITOS_PASSWORD = [
  {
    clave: "largo",
    etiqueta: "8 caracteres o más",
    cumple: (valor: string) => valor.length >= 8 && valor.length <= 200,
  },
  {
    clave: "minuscula",
    etiqueta: "Una minúscula",
    cumple: (valor: string) => /[a-z]/.test(valor),
  },
  {
    clave: "mayuscula",
    etiqueta: "Una mayúscula",
    cumple: (valor: string) => /[A-Z]/.test(valor),
  },
  {
    clave: "numero",
    etiqueta: "Un número",
    cumple: (valor: string) => /\d/.test(valor),
  },
] as const;

/**
 * Alta de una veterinaria.
 *
 * Formulario en dos pasos porque son 14 campos: en una sola columna el
 * formulario se vuelve una pared y la tasa de abandono sube. El paso 1 pide
 * los datos de la clínica, el 2 los del responsable. Nada se envía hasta el
 * final, así que no quedan veterinarias a medio crear si el usuario abandona.
 */
export function RegistroPage() {
  const navegar = useNavigate();

  const [paso, setPaso] = useState<1 | 2>(1);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [emailRegistrado, setEmailRegistrado] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegistroForm>({
    resolver: zodResolver(registroSchema),
    mode: "onBlur",
    defaultValues: {
      ruc: "",
      razonSocial: "",
      nombreComercial: "",
      email: "",
      telefono: "",
      whatsapp: "",
      direccion: "",
      ciudad: "",
      nombre: "",
      apellido: "",
      password: "",
      confirmPassword: "",
    },
  });

  // `useWatch` en vez de `getValues`: el indicador de requisitos necesita
  // repintarse en cada tecla, no sólo al salir del campo.
  const passwordActual = useWatch({ control, name: "password" }) ?? "";

  // Cuando la cuenta se creó, el aviso se lee unos segundos y después se salta
  // solo al acceso. El timer vive en un efecto para poder cancelarlo si la
  // persona se va antes (o si el componente se desmonta).
  useEffect(() => {
    if (!exito) return;

    // El botón de envío está al final del formulario: sin esto el aviso de
    // éxito queda fuera de pantalla justo cuando hay que leerlo.
    window.scrollTo({ top: 0, behavior: "smooth" });

    const temporizador = window.setTimeout(() => {
      navegar("/login?registrado=1", { replace: true });
    }, MS_ANTES_DEL_ACCESO);

    return () => window.clearTimeout(temporizador);
  }, [exito, navegar]);

  const irAlAcceso = () => {
    navegar("/login?registrado=1", { replace: true });
  };

  const avanzar = async () => {
    const valido = await trigger([
      "ruc",
      "razonSocial",
      "nombreComercial",
      "email",
      "telefono",
      "whatsapp",
      "direccion",
      "ciudad",
    ]);

    if (valido) setPaso(2);
  };

  const enviar = handleSubmit(async (datos) => {
    setErrorGeneral(null);

    try {
      const respuesta = await http.post<{ mensaje: string }>("/auth/registro", datos);

      // La cuenta ya existe: dejamos el correo listo en el acceso para que no
      // tenga que volver a escribirlo. Se guarda antes de redirigir porque el
      // login lo lee de `localStorage` al montarse.
      guardarEmailRecordado(datos.email);
      setEmailRegistrado(datos.email);
      setExito(respuesta.mensaje);
    } catch (error) {
      setErrorGeneral(
        error instanceof Error
          ? error.message
          : "No pudimos crear la cuenta. Intentá de nuevo.",
      );
    }
  });

  return (
    <Flex minH="100dvh" bg="ink.50" direction="column">
      <Box bg="white" borderBottomWidth="1px" borderColor="ink.200">
        <Container maxW="5xl" py="4" px={{ base: "5", md: "6" }}>
          <Flex align="center" justify="space-between">
            <Link to="/login">
              <Flex align="center" gap="2" color="ink.600" _hover={{ color: "ink.900" }}>
                <ArrowLeft size={18} />
                <Text fontSize="sm" fontWeight="medium">
                  Volver al acceso
                </Text>
              </Flex>
            </Link>

            <chakra.img
              src={logoVetSirio}
              alt="VetSirio"
              h="12"
              w="auto"
              draggable={false}
            />
          </Flex>
        </Container>
      </Box>

      <Flex flex="1" py={{ base: "8", md: "12" }} px={{ base: "5", md: "6" }}>
        <Container maxW="2xl" p="0">
          <Heading
            as="h1"
            fontSize={{ base: "xl", md: "2xl" }}
            fontWeight="bold"
            color="ink.900"
            letterSpacing="-0.02em"
          >
            Probá VetSirio gratis
          </Heading>
          <Text color="ink.600" mt="2">
            Sin tarjeta de crédito. Tu período de prueba arranca apenas
            confirmes estos datos.
          </Text>

          {/* Indicador de pasos */}
          <Flex align="center" gap="3" mt="7" mb="7">
            {[
              { n: 1, etiqueta: "Tu veterinaria" },
              { n: 2, etiqueta: "Tu cuenta" },
            ].map((item, indice) => {
              const activo = paso >= item.n;

              return (
                <Flex key={item.n} align="center" gap="3" flex={indice === 0 ? "1" : "1"}>
                  <Flex
                    align="center"
                    justify="center"
                    w="8"
                    h="8"
                    borderRadius="full"
                    bg={activo ? "brand.500" : "ink.200"}
                    color={activo ? "white" : "ink.600"}
                    fontWeight="bold"
                    fontSize="sm"
                    flexShrink={0}
                    transition="all 0.2s ease"
                  >
                    {paso > item.n ? <Check size={16} /> : item.n}
                  </Flex>
                  <Text
                    fontSize="sm"
                    fontWeight={activo ? "semibold" : "medium"}
                    color={activo ? "ink.900" : "ink.500"}
                    display={{ base: "none", sm: "block" }}
                  >
                    {item.etiqueta}
                  </Text>
                  {indice === 0 && (
                    <Box h="1px" bg="ink.200" flex="1" mx="2">
                      <Box
                        h="full"
                        bg="brand.500"
                        transition="width 0.3s ease"
                        w={paso > 1 ? "100%" : "0%"}
                      />
                    </Box>
                  )}
                </Flex>
              );
            })}
          </Flex>

          {errorGeneral && (
            <Alert status="error" rounded="md" mb="5">
              {errorGeneral}
            </Alert>
          )}

          {exito && (
            <Alert
              status="success"
              rounded="md"
              mb="5"
              title="¡Cuenta creada!"
              endElement={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={irAlAcceso}
                  flexShrink={0}
                >
                  Ir al acceso
                </Button>
              }
            >
              {exito}
              {emailRegistrado && (
                <>
                  {" "}
                  Dejamos <b>{emailRegistrado}</b> cargado en el acceso.
                </>
              )}{" "}
              Redirigiendo…
            </Alert>
          )}

          <Box
            bg="white"
            borderRadius="lg"
            borderWidth="1px"
            borderColor="ink.200"
            boxShadow="sm"
            p={{ base: "5", md: "7" }}
          >
            <chakra.form onSubmit={enviar} noValidate>
              {paso === 1 ? (
                <Grid gap="4">
                  <Flex align="center" gap="2.5" mb="1">
                    <Building2 size={19} color="var(--chakra-colors-brand-600)" />
                    <Text fontWeight="semibold" color="ink.900">
                      Datos de la veterinaria
                    </Text>
                  </Flex>

                  <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="4">
                    <CampoSimple
                      id="ruc"
                      label="RUC"
                      error={errors.ruc?.message}
                      ayuda="Sin guiones ni puntos"
                    >
                      <Input
                        id="ruc"
                        inputMode="numeric"
                        placeholder="80012345-0"
                        h="10"
                        {...register("ruc")}
                      />
                    </CampoSimple>

                    <CampoSimple
                      id="nombreComercial"
                      label="Nombre comercial"
                      error={errors.nombreComercial?.message}
                    >
                      <Input
                        id="nombreComercial"
                        placeholder="Veterinaria San Jerez"
                        h="10"
                        {...register("nombreComercial")}
                      />
                    </CampoSimple>
                  </Grid>

                  <CampoSimple
                    id="razonSocial"
                    label="Razón social"
                    error={errors.razonSocial?.message}
                  >
                    <Input
                      id="razonSocial"
                      placeholder="Veterinaria San Jerez S.R.L."
                      h="10"
                      {...register("razonSocial")}
                    />
                  </CampoSimple>

                  <CampoSimple
                    id="email"
                    label="Correo de la veterinaria"
                    error={errors.email?.message}
                  >
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      placeholder="contacto@veterinaria.com"
                      h="10"
                      {...register("email")}
                    />
                  </CampoSimple>

                  <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="4">
                    <CampoSimple id="telefono" label="Teléfono" error={errors.telefono?.message}>
                      <Input id="telefono" inputMode="tel" placeholder="0981123456" h="10" {...register("telefono")} />
                    </CampoSimple>

                    <CampoSimple id="whatsapp" label="WhatsApp" error={errors.whatsapp?.message}>
                      <Input id="whatsapp" inputMode="tel" placeholder="0981123456" h="10" {...register("whatsapp")} />
                    </CampoSimple>
                  </Grid>

                  <CampoSimple id="ciudad" label="Ciudad" error={errors.ciudad?.message}>
                    <Input id="ciudad" placeholder="Asunción" h="10" {...register("ciudad")} />
                  </CampoSimple>

                  <CampoSimple id="direccion" label="Dirección" error={errors.direccion?.message}>
                    <Input id="direccion" placeholder="Av. Brasil 1234" h="10" {...register("direccion")} />
                  </CampoSimple>

                  <Button
                    type="button"
                    onClick={avanzar}
                    mt="2"
                    h="11"
                    bg="brand.500"
                    color="white"
                    fontWeight="semibold"
                    _hover={{ bg: "brand.600" }}
                  >
                    <Flex align="center" justify="center" gap="2">
                      <Text>Continuar</Text>
                      <ArrowRight size={17} />
                    </Flex>
                  </Button>
                </Grid>
              ) : (
                <Grid gap="4">
                  <Flex align="center" gap="2.5" mb="1">
                    <User size={19} color="var(--chakra-colors-brand-600)" />
                    <Text fontWeight="semibold" color="ink.900">
                      Quién va a administrar la cuenta
                    </Text>
                  </Flex>

                  <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="4">
                    <CampoSimple id="nombre" label="Nombre" error={errors.nombre?.message}>
                      <Input id="nombre" placeholder="María" h="10" autoComplete="given-name" {...register("nombre")} />
                    </CampoSimple>

                    <CampoSimple id="apellido" label="Apellido" error={errors.apellido?.message}>
                      <Input id="apellido" placeholder="González" h="10" autoComplete="family-name" {...register("apellido")} />
                    </CampoSimple>
                  </Grid>

                  <Text fontSize="sm" color="ink.600">
                    Usaremos este mismo correo para que inicies sesión.
                  </Text>

                  <CampoSimple
                    id="password"
                    label="Contraseña"
                    error={errors.password?.message}
                  >
                    <Box position="relative">
                      <Input
                        id="password"
                        type={mostrarPassword ? "text" : "password"}
                        autoComplete="new-password"
                        pl="10"
                        pr="11"
                        h="10"
                        {...register("password")}
                      />
                      <IconoSlot izquierda={<Lock size={16} />} />
                      <chakra.button
                        as="button"
                        type="button"
                        onClick={() => setMostrarPassword((v) => !v)}
                        position="absolute"
                        right="2"
                        top="50%"
                        transform="translateY(-50%)"
                        p="1.5"
                        borderRadius="md"
                        color="ink.500"
                        _hover={{ bg: "ink.100" }}
                        aria-label={mostrarPassword ? "Ocultar" : "Mostrar"}>
                        {mostrarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </chakra.button>
                    </Box>

                    <IndicadorPassword valor={passwordActual} />
                  </CampoSimple>

                  <CampoSimple
                    id="confirmPassword"
                    label="Repetir contraseña"
                    error={errors.confirmPassword?.message}
                  >
                    <Box position="relative">
                      <Input
                        id="confirmPassword"
                        type={mostrarPassword ? "text" : "password"}
                        autoComplete="new-password"
                        pl="10"
                        h="10"
                        {...register("confirmPassword")}
                      />
                      <IconoSlot izquierda={<Lock size={16} />} />
                    </Box>
                  </CampoSimple>

                  <Flex gap="3" mt="1">
                    <Button
                      type="button"
                      variant="outline"
                      h="11"
                      onClick={() => setPaso(1)}
                      flexShrink={0}
                    >
                      <ArrowLeft size={17} />
                    </Button>

                    <Button
                      type="submit"
                      flex="1"
                      h="11"
                      bg="brand.500"
                      color="white"
                      fontWeight="semibold"
                      disabled={isSubmitting || exito !== null}
                      _hover={{ bg: "brand.600" }}
                    >
                      {isSubmitting ? (
                        <Flex align="center" gap="2">
                          <Spinner size="sm" />
                          <Text>Creando cuenta…</Text>
                        </Flex>
                      ) : (
                        <Text>Crear cuenta y empezar</Text>
                      )}
                    </Button>
                  </Flex>
                </Grid>
              )}
            </chakra.form>
          </Box>

          <Text textAlign="center" color="ink.500" mt="5" fontSize="xs" lineHeight="1.6">
            Al crear la cuenta aceptás que VetSirio guarde los datos de tu
            veterinaria. Los datos de tus clientes no se comparten con ninguna
            otra cuenta de la plataforma.
          </Text>
        </Container>
      </Flex>
    </Flex>
  );
}

/**
 * Requisitos de la contraseña, evaluados en vivo.
 *
 * Más que un texto de ayuda, muestra el avance: barra segmentada + tilde
 * animado por requisito. La animación va en CSS (`vetsirio-check`) para que
 * corra en el compositor y no compita con el repintado del input.
 */
function IndicadorPassword({ valor }: { valor: string }) {
  const requisitos = REQUISITOS_PASSWORD.map((requisito) => ({
    ...requisito,
    cumplido: requisito.cumple(valor),
  }));

  const cumplidos = requisitos.filter((requisito) => requisito.cumplido).length;
  const completo = cumplidos === requisitos.length;

  return (
    <Box mt="3">
      <Flex align="center" justify="space-between" gap="3" mb="2">
        <Text
          fontSize="xs"
          fontWeight={completo ? "semibold" : "medium"}
          color={completo ? "success.700" : "ink.500"}
          transition="color 0.2s ease"
        >
          {completo ? "Contraseña segura" : "La contraseña debe incluir"}
        </Text>
        <Text
          fontSize="xs"
          color="ink.400"
          fontVariantNumeric="tabular-nums"
          aria-live="polite"
        >
          {cumplidos}/{requisitos.length}
        </Text>
      </Flex>

      {/* Barra segmentada: un segmento por requisito, se enciende al cumplirlo. */}
      <Flex gap="1.5" mb="3" aria-hidden="true">
        {requisitos.map((requisito) => (
          <Box
            key={requisito.clave}
            flex="1"
            h="1.5"
            borderRadius="full"
            bg={
              requisito.cumplido
                ? completo
                  ? "success.500"
                  : "brand.500"
                : "ink.200"
            }
            transform={requisito.cumplido ? "scaleY(1)" : "scaleY(0.6)"}
            transition="background-color 0.25s ease, transform 0.25s ease"
          />
        ))}
      </Flex>

      <Grid
        templateColumns={{ base: "1fr", sm: "1fr 1fr" }}
        columnGap="4"
        rowGap="1.5"
      >
        {requisitos.map((requisito) => (
          <Flex
            key={requisito.clave}
            align="center"
            gap="2"
            role="img"
            aria-label={`${requisito.etiqueta}: ${
              requisito.cumplido ? "cumplido" : "pendiente"
            }`}
          >
            <Flex
              align="center"
              justify="center"
              w="4"
              h="4"
              flexShrink={0}
              borderRadius="full"
              borderWidth="1px"
              borderColor={requisito.cumplido ? "success.500" : "ink.300"}
              bg={requisito.cumplido ? "success.500" : "transparent"}
              color="white"
              transform={requisito.cumplido ? "scale(1)" : "scale(0.85)"}
              transition="background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease"
            >
              {requisito.cumplido ? (
                // `key` para reiniciar la animación cada vez que se cumple.
                <Box
                  key={`${requisito.clave}-cumplido`}
                  display="flex"
                  animation="vetsirio-check 260ms cubic-bezier(0.22, 1, 0.36, 1) both"
                >
                  <Check size={11} strokeWidth={3} />
                </Box>
              ) : (
                <Box w="1" h="1" borderRadius="full" bg="ink.300" />
              )}
            </Flex>

            <Text
              fontSize="xs"
              color={requisito.cumplido ? "success.700" : "ink.500"}
              fontWeight={requisito.cumplido ? "medium" : "normal"}
              transition="color 0.2s ease"
            >
              {requisito.etiqueta}
            </Text>
          </Flex>
        ))}
      </Grid>
    </Box>
  );
}

function IconoSlot({ izquierda }: { izquierda: React.ReactNode }) {
  return (
    <Box
      position="absolute"
      left="3"
      top="50%"
      transform="translateY(-50%)"
      color="ink.400"
      pointerEvents="none"
      zIndex="1"
    >
      {izquierda}
    </Box>
  );
}

function CampoSimple({
  id,
  label,
  error,
  ayuda,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
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

      <Box
        css={{
          "& input": {
            borderColor: error
              ? "var(--chakra-colors-danger-500)"
              : "var(--chakra-colors-ink-200)",
          },
        }}
      >
        {children}
      </Box>

      {error ? (
        <Text fontSize="xs" color="danger.600" mt="1.5" fontWeight="medium">
          {error}
        </Text>
      ) : ayuda ? (
        <Text fontSize="xs" color="ink.500" mt="1.5">
          {ayuda}
        </Text>
      ) : null}
    </Box>
  );
}