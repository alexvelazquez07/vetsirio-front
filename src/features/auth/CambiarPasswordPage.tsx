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
import { Eye, EyeOff, KeyRound, Lock, LogOut } from "lucide-react";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { Alert } from "@/components/ui/alert";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import { http } from "@/services/api";
import type { RespuestaPerfil } from "@/types/dominio";
import {
  cambiarPasswordSchema,
  type CambiarPasswordForm,
} from "@/lib/validaciones";

/**
 * Cambio de contraseña desde una sesión iniciada.
 *
 * Es la pantalla que ve el integrante cuando el administrador le dejó una
 * contraseña temporal, y también la que puede abrir voluntariamente desde el
 * menú de usuario. La contraseña nueva exige la misma política fuerte que el
 * registro; la temporal que definió el administrador no.
 */
export function CambiarPasswordPage() {
  const { usuario, logout, limpiarSesion } = useAuth();
  const navegar = useNavigate();
  const queryClient = useQueryClient();

  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);
  const [mostrarActual, setMostrarActual] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CambiarPasswordForm>({
    resolver: zodResolver(cambiarPasswordSchema) as Resolver<CambiarPasswordForm>,
    defaultValues: {
      passwordActual: "",
      passwordNuevo: "",
      confirmPassword: "",
    },
    mode: "onBlur",
  });

  const obligatorio = usuario?.debeCambiarPassword === true;

  const enviar = handleSubmit(async (datos) => {
    setErrorGeneral(null);

    try {
      const respuesta = await http.post<{ mensaje: string }>(
        "/auth/cambiar-password",
        datos,
      );

      // El backend ya marcó debeCambiarPassword=false. Reflejarlo en el perfil
      // cacheado evita que RutaPrivada vuelva a mandar a esta pantalla.
      queryClient.setQueryData<RespuestaPerfil | null>(
        ["auth", "perfil"],
        (anterior) => {
          if (!anterior) return anterior ?? null;

          return {
            ...anterior,
            usuario: { ...anterior.usuario, debeCambiarPassword: false },
          };
        },
      );

      toaster.success({
        title: "Contraseña actualizada",
        description: respuesta.mensaje,
      });
      navegar("/", { replace: true });
    } catch (error) {
      setErrorGeneral(
        error instanceof Error
          ? error.message
          : "No pudimos cambiar la contraseña. Intentá de nuevo.",
      );
    }
  });

  async function salir() {
    setSaliendo(true);

    try {
      await logout();
    } finally {
      limpiarSesion();
      navegar("/login", { replace: true });
    }
  }

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
          <Flex
            align="center"
            justify="center"
            w="12"
            h="12"
            borderRadius="full"
            bg="brand.subtle"
            color="brand.fg"
            mb="4"
            mx="auto"
          >
            <KeyRound size={22} />
          </Flex>

          <Heading
            as="h1"
            fontSize="xl"
            fontWeight="bold"
            color="ink.900"
            textAlign="center"
            letterSpacing="-0.02em"
          >
            {obligatorio ? "Cambiá tu contraseña" : "Actualizá tu contraseña"}
          </Heading>

          <Text color="ink.600" mt="2" mb="6" fontSize="sm" textAlign="center">
            {obligatorio
              ? "Tu administrador te dejó una contraseña temporal. Elegí una nueva para continuar."
              : "Ingresá tu contraseña actual y elegí una nueva."}
          </Text>

          {errorGeneral && (
            <Alert status="error" rounded="md" mb="4">
              {errorGeneral}
            </Alert>
          )}

          <chakra.form onSubmit={enviar} noValidate>
            <CampoPassword
              id="passwordActual"
              label="Contraseña actual"
              error={errors.passwordActual?.message}
              visible={mostrarActual}
              onToggle={() => setMostrarActual((previo) => !previo)}
              autoComplete="current-password"
              placeholder="La que usás hoy"
              {...register("passwordActual")}
            />

            <CampoPassword
              id="passwordNuevo"
              label="Contraseña nueva"
              error={errors.passwordNuevo?.message}
              visible={mostrarNueva}
              onToggle={() => setMostrarNueva((previo) => !previo)}
              autoComplete="new-password"
              placeholder="Tu contraseña nueva"
              {...register("passwordNuevo")}
            />

            <CampoPassword
              id="confirmPassword"
              label="Confirmá la contraseña"
              error={errors.confirmPassword?.message}
              visible={mostrarConfirmacion}
              onToggle={() => setMostrarConfirmacion((previo) => !previo)}
              autoComplete="new-password"
              placeholder="Repetí la contraseña nueva"
              {...register("confirmPassword")}
            />

            <Text fontSize="xs" color="ink.500" mt="-1" mb="5">
              Mínimo 8 caracteres, con una mayúscula, una minúscula y un número.
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
        </Box>

        <Flex justify="center" mt="5">
          <Button
            variant="ghost"
            size="sm"
            color="ink.600"
            loading={saliendo}
            onClick={salir}
          >
            <Flex align="center" gap="2">
              <LogOut size={15} />
              <Text>Cerrar sesión</Text>
            </Flex>
          </Button>
        </Flex>
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
