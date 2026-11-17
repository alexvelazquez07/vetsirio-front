import { Box, chakra, Flex, Skeleton, Text } from "@chakra-ui/react";
import {
  Bell,
  BellOff,
  CheckCheck,
  CircleCheck,
  CircleX,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import {
  useMarcarNotificacionLeida,
  useMarcarTodasLeidas,
  useNotificaciones,
  type Notificacion,
  type TipoNotificacion,
} from "@/features/notificaciones/notificaciones.service";
import { resolverDestinoNotificacion } from "@/features/notificaciones/notificaciones.rutas";
import { formatTiempoRelativo } from "@/lib/formato";

/**
 * Campanita de notificaciones de la barra superior.
 *
 * El contador sale de la misma consulta que el listado, así que el badge y el
 * panel nunca se contradicen. La consulta se refresca sola cada minuto: no hay
 * websockets en el producto y un aviso con un minuto de retraso sigue siendo
 * útil.
 *
 * El panel se cierra al navegar a la ruta del aviso. Si la notificación no
 * tiene ruta, se queda abierto y sólo se marca como leída: cerrar sin llevar a
 * ningún lado haría que el usuario perdiera el hilo de lo que estaba leyendo.
 */

const ESTILOS_POR_TIPO: Record<
  TipoNotificacion,
  { icono: LucideIcon; bg: string; color: string }
> = {
  info: { icono: Info, bg: "info.subtle", color: "info.fg" },
  exito: { icono: CircleCheck, bg: "success.subtle", color: "success.fg" },
  alerta: { icono: TriangleAlert, bg: "warning.subtle", color: "warning.fg" },
  error: { icono: CircleX, bg: "danger.subtle", color: "danger.fg" },
};

export function NotificacionesMenu() {
  const navegar = useNavigate();
  const { puede } = useAuth();
  const [abierto, setAbierto] = useState(false);

  const { data, isLoading, isError } = useNotificaciones();
  const marcarLeida = useMarcarNotificacionLeida();
  const marcarTodas = useMarcarTodasLeidas();

  const noLeidas = data?.noLeidas ?? 0;
  const items = data?.items ?? [];

  function abrirNotificacion(notificacion: Notificacion) {
    if (!notificacion.leida) {
      marcarLeida.mutate(notificacion.id);
    }

    const destino = resolverDestinoNotificacion(notificacion.url, puede);

    if (destino.accion === "navegar") {
      setAbierto(false);
      navegar(destino.ruta);
      return;
    }

    if (destino.accion === "sin-permiso") {
      toaster.info({
        title: "Aviso para el administrador",
        description:
          "Esta sección la gestiona el administrador de la veterinaria. El mensaje queda disponible acá.",
      });
      return;
    }

    // Sin URL no hay nada que hacer: el aviso es sólo informativo. Con URL
    // rota, se avisa que el enlace quedó viejo en lugar de mandar al 404.
    if (notificacion.url) {
      toaster.info({
        title: "El enlace de este aviso ya no está disponible",
        description:
          "La pantalla a la que llevaba cambió de lugar. El mensaje sigue acá.",
      });
    }
  }

  return (
    <PopoverRoot
      open={abierto}
      onOpenChange={(detalle) => setAbierto(detalle.open)}
      positioning={{ placement: "bottom-end" }}>
      <PopoverTrigger asChild>
        <chakra.button
          as="button"
          type="button"
          position="relative"
          display="flex"
          alignItems="center"
          justifyContent="center"
          w="10"
          h="10"
          flexShrink={0}
          borderRadius="md"
          color={abierto ? "ink.900" : "ink.600"}
          bg={abierto ? "ink.100" : "transparent"}
          aria-label={
            noLeidas > 0
              ? `Notificaciones, ${noLeidas} sin leer`
              : "Notificaciones"
          }
          title="Notificaciones"
          aria-expanded={abierto}
          _hover={{ bg: "ink.100", color: "ink.900" }}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "brand.500",
            outlineOffset: "2px",
          }}>
          <Bell size={20} />

          {noLeidas > 0 && (
            <Flex
              position="absolute"
              top="1"
              right="1"
              minW="4"
              h="4"
              px="1"
              align="center"
              justify="center"
              borderRadius="full"
              bg="danger.500"
              color="white"
              fontSize="2xs"
              fontWeight="bold"
              lineHeight="1"
              borderWidth="2px"
              borderColor="white">
              {noLeidas > 9 ? "9+" : noLeidas}
            </Flex>
          )}
        </chakra.button>
      </PopoverTrigger>

      <PopoverContent
        bg="white"
        borderColor="ink.200"
        borderRadius="xl"
        boxShadow="xl"
        p="0"
        w="22rem"
        maxW="calc(100vw - 2rem)"
        overflow="hidden"
        aria-label="Notificaciones">
        <Flex
          align="center"
          gap="2.5"
          px="4"
          py="3"
          borderBottomWidth="1px"
          borderColor="ink.200"
          bg="ink.50">
          <Flex
            align="center"
            justify="center"
            w="8"
            h="8"
            borderRadius="lg"
            bg="brand.subtle"
            color="brand.fg"
            flexShrink={0}>
            <Bell size={16} />
          </Flex>

          <Box minW={0} flex="1">
            <Text fontSize="sm" fontWeight="semibold" color="ink.900">
              Notificaciones
            </Text>
            <Text fontSize="xs" color="ink.500">
              {noLeidas > 0
                ? `${noLeidas} sin leer`
                : "Todo al día"}
            </Text>
          </Box>

          {noLeidas > 0 && (
            <chakra.button
              as="button"
              type="button"
              display="flex"
              alignItems="center"
              gap="1.5"
              px="2"
              py="1"
              borderRadius="md"
              color="brand.fg"
              fontSize="xs"
              fontWeight="medium"
              cursor="pointer"
              disabled={marcarTodas.isPending}
              onClick={() => marcarTodas.mutate()}
              _hover={{ bg: "brand.muted" }}
              _disabled={{ opacity: 0.6, cursor: "not-allowed" }}
              _focusVisible={{
                outline: "2px solid",
                outlineColor: "brand.500",
                outlineOffset: "1px",
              }}>
              <CheckCheck size={14} />
              Marcar todas
            </chakra.button>
          )}
        </Flex>

        <Box maxH="24rem" overflowY="auto">
          {isLoading ? (
            <Box p="3">
              {[0, 1, 2].map((fila) => (
                <Flex key={fila} gap="3" py="2.5" align="flex-start">
                  <Skeleton w="8" h="8" borderRadius="lg" flexShrink={0} />
                  <Box flex="1">
                    <Skeleton h="3.5" w="60%" borderRadius="sm" />
                    <Skeleton h="3" w="90%" mt="1.5" borderRadius="sm" />
                    <Skeleton h="2.5" w="24" mt="1.5" borderRadius="sm" />
                  </Box>
                </Flex>
              ))}
            </Box>
          ) : isError ? (
            <Flex direction="column" align="center" gap="1" px="6" py="8" textAlign="center">
              <Text fontSize="sm" fontWeight="medium" color="ink.700">
                No pudimos cargar las notificaciones
              </Text>
              <Text fontSize="xs" color="ink.500">
                Revisá tu conexión. La campanita vuelve a intentarlo sola.
              </Text>
            </Flex>
          ) : items.length === 0 ? (
            <Flex
              direction="column"
              align="center"
              justify="center"
              gap="2"
              px="6"
              py="10"
              textAlign="center">
              <Flex
                align="center"
                justify="center"
                w="12"
                h="12"
                borderRadius="full"
                bg="ink.50"
                color="ink.400">
                <BellOff size={22} />
              </Flex>
              <Text fontSize="sm" fontWeight="medium" color="ink.700">
                Todo al día
              </Text>
              <Text fontSize="xs" color="ink.500" maxW="15rem">
                Los avisos de tu cuenta y del sistema van a aparecer acá.
              </Text>
            </Flex>
          ) : (
            items.map((notificacion) => (
              <ItemNotificacion
                key={notificacion.id}
                notificacion={notificacion}
                onAbrir={abrirNotificacion}
              />
            ))
          )}
        </Box>
      </PopoverContent>
    </PopoverRoot>
  );
}

function ItemNotificacion({
  notificacion,
  onAbrir,
}: {
  notificacion: Notificacion;
  onAbrir: (notificacion: Notificacion) => void;
}) {
  const estilo = ESTILOS_POR_TIPO[notificacion.tipo] ?? ESTILOS_POR_TIPO.info;
  const Icono = estilo.icono;

  return (
    <chakra.button
      as="button"
      type="button"
      display="block"
      w="full"
      px="4"
      py="3"
      textAlign="left"
      cursor="pointer"
      bg={notificacion.leida ? "white" : "brand.subtle"}
      borderBottomWidth="1px"
      borderColor="ink.100"
      transition="background 0.15s ease"
      aria-label={
        notificacion.leida
          ? notificacion.titulo
          : `${notificacion.titulo}, sin leer`
      }
      onClick={() => onAbrir(notificacion)}
      _hover={{ bg: notificacion.leida ? "ink.50" : "brand.50" }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "brand.500",
        outlineOffset: "-2px",
      }}>
      <Flex align="flex-start" gap="3">
        <Flex
          align="center"
          justify="center"
          w="8"
          h="8"
          borderRadius="lg"
          bg={estilo.bg}
          color={estilo.color}
          flexShrink={0}>
          <Icono size={16} />
        </Flex>

        <Box minW={0} flex="1">
          <Flex align="center" gap="2">
            <Text
              fontSize="sm"
              fontWeight={notificacion.leida ? "medium" : "semibold"}
              color="ink.900"
              flex="1"
              truncate>
              {notificacion.titulo}
            </Text>

            {!notificacion.leida && (
              <Box
                w="2"
                h="2"
                borderRadius="full"
                bg="brand.500"
                flexShrink={0}
                aria-hidden="true"
              />
            )}
          </Flex>

          <Text
            fontSize="xs"
            color="ink.600"
            lineClamp={2}
            mt="0.5"
            lineHeight="1.4">
            {notificacion.mensaje}
          </Text>

          <Text fontSize="2xs" color="ink.400" mt="1">
            {formatTiempoRelativo(notificacion.creadoEn)}
          </Text>
        </Box>
      </Flex>
    </chakra.button>
  );
}
