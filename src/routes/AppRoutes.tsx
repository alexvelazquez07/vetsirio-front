import { Box, Button, Flex, Heading, Spinner, Text } from "@chakra-ui/react";
import { Compass } from "lucide-react";
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "@/features/auth/auth.store";

/**
 * Barreras de navegación.
 *
 * Todas las pantallas autenticadas pasan por <RutaPrivada>, que además
 * respeta los permisos: ocultar un ítem del menú y bloquear la URL son dos
 * capas distintas y hacen falta las dos. Ocultar el botón no protege nada,
 * porque la URL se puede escribir a mano.
 *
 * Ojo: esto es la capa de experiencia, no de seguridad. La autorización real la
 * aplica el backend en cada petición; esto sólo evita que el usuario llegue a
 * una pantalla que le va a devolver 403.
 */

/** Exige sesión. Guarda la ruta pretendida para volver a ella tras el login. */
export function RutaPrivada() {
  const { autenticado, cargando, usuario } = useAuth();
  const ubicacion = useLocation();

  if (cargando) {
    return (
      <Box
        minH="100dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="ink.50"
      >
        <Flex direction="column" align="center" gap="3">
          <Spinner size="lg" color="brand.500" />
          <Text fontSize="sm" color="ink.500">
            Cargando tu sesión…
          </Text>
        </Flex>
      </Box>
    );
  }

  if (!autenticado) {
    return (
      <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />
    );
  }

  // Una contraseña temporal obliga a pasar por el cambio antes de usar la app.
  // La ruta de cambio queda exenta para no entrar en un bucle de redirecciones.
  if (
    usuario?.debeCambiarPassword &&
    ubicacion.pathname !== "/cambiar-password"
  ) {
    return <Navigate to="/cambiar-password" replace />;
  }

  return <Outlet />;
}

/**
 * Para la sesión ya iniciada, el login y el registro ya no tienen sentido:
 * mostrar el login a alguien que acaba de entrar obliga a un clic extra.
 */
export function SoloVisitantes() {
  const { autenticado, cargando } = useAuth();

  if (cargando) return null;

  if (autenticado) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

/** Verifica un permiso antes de montar la pantalla. */
export function RutaConPermiso({ permiso }: { permiso: string }) {
  const { puede } = useAuth();

  if (!puede(permiso)) {
    return (
      <Box
        minH="50dvh"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px="6"
      >
        <Text color="ink.600" textAlign="center">
          Tu rol no tiene acceso a esta sección. Si creés que es un error,
          pedile a tu administrador que revise tus permisos.
        </Text>
      </Box>
    );
  }

  return <Outlet />;
}

/** Ruta que no existe. */
export function NoEncontrado() {
  const navegar = useNavigate();

  return (
    <Flex minH="60dvh" align="center" justify="center" px="6" py="10">
      <Flex
        direction="column"
        align="center"
        textAlign="center"
        gap="3"
        maxW="28rem"
      >
        <Flex
          align="center"
          justify="center"
          w="16"
          h="16"
          borderRadius="2xl"
          bg="ink.100"
          color="ink.500"
          flexShrink={0}
        >
          <Compass size={30} />
        </Flex>

        <Box>
          <Heading size="md" color="ink.900">
            No encontramos esa página
          </Heading>
          <Text mt="1.5" fontSize="sm" color="ink.600">
            Puede que el enlace esté desactualizado o que la pantalla haya
            cambiado de lugar. Tus datos siguen a salvo.
          </Text>
        </Box>

        <Flex gap="2" mt="1" wrap="wrap" justify="center">
          <Button asChild colorPalette="brand">
            <Link to="/">Ir al inicio</Link>
          </Button>

          {/* Volver atrás es más útil que el inicio cuando el usuario llegó
              desde una notificación o un enlace viejo y quiere seguir donde
              estaba. Si no hay historial, el navegador lo resuelve igual. */}
          <Button variant="outline" onClick={() => navegar(-1)}>
            Volver atrás
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
}