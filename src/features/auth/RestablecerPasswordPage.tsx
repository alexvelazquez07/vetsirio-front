import {
  Box,
  Button,
  chakra,
  Container,
  Flex,
  Heading,
  Input,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";

import { Alert } from "@/components/ui/alert";
import { ApiError, http } from "@/services/api";
import { nuevaPasswordSchema } from "@/lib/validaciones";

type Formulario = {
  password: string;
  confirmPassword: string;
};

type Estado = "validando" | "invalido" | "formulario" | "listo";

/**
 * Paso 2 de la recuperación: el usuario abre el enlace del correo, elige una
 * contraseña nueva y el backend invalida el token y todas las sesiones.
 *
 * La ruta es pública incluso para alguien con sesión iniciada: el enlace del
 * correo tiene que funcionar igual si se abre en el mismo navegador donde la
 * sesión quedó abierta.
 */
export function RestablecerPasswordPage() {
  const [parametros] = useSearchParams();
  const token = parametros.get("token")?.trim() ?? "";
  const queryClient = useQueryClient();

  const [estado, setEstado] = useState<Estado>("validando");
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({
    resolver: zodResolver(nuevaPasswordSchema) as Resolver<Formulario>,
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  useEffect(() => {
    let cancelado = false;

    if (!token) {
      setEstado("invalido");
      return;
    }

    const validar = async () => {
      try {
        const respuesta = await http.get<{ valido: boolean }>(
          "/auth/validar-token",
          { params: { token } },
        );

        if (!cancelado) {
          setEstado(respuesta.valido ? "formulario" : "invalido");
        }
      } catch {
        if (!cancelado) {
          setEstado("invalido");
        }
      }
    };

    void validar();

    return () => {
      cancelado = true;
    };
  }, [token]);

  const enviar = handleSubmit(async (datos) => {
    setErrorGeneral(null);

    try {
      await http.post<{ mensaje: string }>("/auth/confirmar-recuperacion", {
        token,
        password: datos.password,
        confirmPassword: datos.confirmPassword,
      });

      // El backend revoca los refresh tokens y borra las cookies. Si había una
      // sesión abierta en este navegador, el perfil cacheado quedaría como
      // "autenticado" y el login rebotaría al inicio: se limpia acá.
      queryClient.setQueryData(["auth", "perfil"], null);
      setEstado("listo");
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : "No pudimos restablecer la contraseña. Intentá de nuevo.";

      if (
        error instanceof ApiError &&
        (error.code === "TOKEN_RESET_INVALIDO" ||
          error.code === "TOKEN_RESET_EXPIRADO")
      ) {
        setEstado("invalido");
      }

      setErrorGeneral(mensaje);
    }
  });

  return (
    <Flex minH="100dvh" bg="ink.50" align="center" py="10" px="5">
      <Container maxW="26rem" p="0">
        <Flex justify="center" mb="7">
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
          >
            VS
          </Flex>
        </Flex>

        <Box
          bg="white"
          borderRadius="lg"
          borderWidth="1px"
          borderColor="ink.200"
          boxShadow="sm"
          p={{ base: "6", md: "7" }}
        >
          {estado === "validando" && (
            <Flex direction="column" align="center" py="8" gap="4">
              <Spinner size="lg" color="brand.500" />
              <Text color="ink.600" fontSize="sm">
                Validando el enlace…
              </Text>
            </Flex>
          )}

          {estado === "invalido" && (
            <Flex direction="column" align="center" textAlign="center" py="4">
              <Flex
                align="center"
                justify="center"
                w="12"
                h="12"
                borderRadius="full"
                bg="danger.subtle"
                color="danger.fg"
                mb="4"
              >
                <AlertCircle size={24} />
              </Flex>

              <Heading as="h1" size="md" fontWeight="bold" color="ink.900">
                Enlace no válido
              </Heading>

              <Text color="ink.600" mt="2" fontSize="sm" lineHeight="1.6">
                {errorGeneral ??
                  "Este enlace expiró o ya fue utilizado. Pedí uno nuevo para continuar."}
              </Text>

              <Link to="/recuperar-password" style={{ width: "100%" }}>
                <Button mt="6" w="full" h="11" bg="brand.500" color="white">
                  Pedir un enlace nuevo
                </Button>
              </Link>
            </Flex>
          )}

          {estado === "listo" && (
            <Flex direction="column" align="center" textAlign="center" py="4">
              <Flex
                align="center"
                justify="center"
                w="12"
                h="12"
                borderRadius="full"
                bg="success.subtle"
                color="success.fg"
                mb="4"
              >
                <CheckCircle2 size={24} />
              </Flex>

              <Heading as="h1" size="md" fontWeight="bold" color="ink.900">
                Contraseña actualizada
              </Heading>

              <Text color="ink.600" mt="2" fontSize="sm" lineHeight="1.6">
                Ya podés iniciar sesión con tu contraseña nueva. Por seguridad
                cerramos todas las sesiones que tenías abiertas.
              </Text>

              <Link to="/login?restablecido=1" style={{ width: "100%" }}>
                <Button mt="6" w="full" h="11" bg="brand.500" color="white">
                  Ir al acceso
                </Button>
              </Link>
            </Flex>
          )}

          {estado === "formulario" && (
            <>
              <Heading
                as="h1"
                fontSize="xl"
                fontWeight="bold"
                color="ink.900"
                letterSpacing="-0.02em"
              >
                Creá una contraseña nueva
              </Heading>

              <Text color="ink.600" mt="2" mb="6" fontSize="sm">
                Elegí una contraseña que no uses en otros sitios. El enlace sólo
                sirve una vez.
              </Text>

              {errorGeneral && (
                <Alert status="error" rounded="md" mb="4">
                  {errorGeneral}
                </Alert>
              )}

              <chakra.form onSubmit={enviar} noValidate>
                <CampoPassword
                  id="password"
                  label="Nueva contraseña"
                  error={errors.password?.message}
                  visible={mostrarPassword}
                  onToggle={() => setMostrarPassword((previo) => !previo)}
                  autoComplete="new-password"
                  placeholder="Tu contraseña nueva"
                  {...register("password")}
                />

                <CampoPassword
                  id="confirmPassword"
                  label="Confirmá la contraseña"
                  error={errors.confirmPassword?.message}
                  visible={mostrarConfirmacion}
                  onToggle={() =>
                    setMostrarConfirmacion((previo) => !previo)
                  }
                  autoComplete="new-password"
                  placeholder="Repetí la contraseña"
                  {...register("confirmPassword")}
                />

                <Text fontSize="xs" color="ink.500" mt="-1" mb="5">
                  Mínimo 8 caracteres, con una mayúscula, una minúscula y un
                  número.
                </Text>

                <Button
                  type="submit"
                  w="full"
                  h="11"
                  bg="brand.500"
                  color="white"
                  fontWeight="semibold"
                  disabled={isSubmitting}
                  _hover={{ bg: "brand.600" }}
                  _active={{ bg: "brand.700" }}
                >
                  {isSubmitting ? (
                    <Flex align="center" gap="2">
                      <Spinner size="sm" />
                      <Text>Guardando…</Text>
                    </Flex>
                  ) : (
                    "Guardar contraseña"
                  )}
                </Button>
              </chakra.form>
            </>
          )}
        </Box>

        <Link to="/login">
          <Flex
            align="center"
            gap="2"
            justify="center"
            mt="6"
            color="ink.600"
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

/** Campo de contraseña con icono, botón para verla y mensaje de error. */
function CampoPassword({
  id,
  label,
  error,
  visible,
  onToggle,
  ...inputProps
}: {
  id: string;
  label: string;
  error?: string;
  visible: boolean;
  onToggle: () => void;
} & Omit<React.ComponentProps<"input">, "size">) {
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
          <Lock size={17} />
        </Box>

        <Input
          id={id}
          type={visible ? "text" : "password"}
          pl="10"
          pr="11"
          h="11"
          borderColor={error ? "danger.500" : "ink.200"}
          _focusVisible={{
            borderColor: error ? "danger.500" : "brand.500",
            boxShadow:
              "0 0 0 3px color-mix(in srgb, var(--chakra-colors-brand-500) 22%, transparent)",
          }}
          {...inputProps}
        />

        <chakra.button
          type="button"
          onClick={onToggle}
          position="absolute"
          right="2"
          top="50%"
          transform="translateY(-50%)"
          p="1.5"
          borderRadius="md"
          color="ink.500"
          _hover={{ bg: "ink.100", color: "ink.800" }}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </chakra.button>
      </Box>

      {error && (
        <Text fontSize="xs" color="danger.600" mt="1.5" fontWeight="medium">
          {error}
        </Text>
      )}
    </Box>
  );
}
