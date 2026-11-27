import { Box, chakra, Flex, Text } from "@chakra-ui/react";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";

import appIcon from "@/assets/img/08_app_icon_192x192.png";
import { useSinMovimiento } from "@/lib/motion";

/**
 * Capa de cierre de sesión.
 *
 * Existe por una razón concreta: `logout()` borra el caché de React Query y en
 * ese momento <RutaPrivada> manda al usuario al login. Entre el clic y ese
 * momento hay un par de cientos de milisegundos en los que no pasa nada
 * visible, y en la práctica el resultado es un salto seco del panel al
 * formulario. El corte abrupto se lee como error, no como una acción que el
 * usuario pidió hacer.
 *
 * Qué hace esta capa:
 *
 *  · Entra con una cortina que baja desde arriba. Es un movimiento corto y en
 *    una sola dirección, así que no distrae de lo que el usuario acaba de
 *    decidir hacer.
 *  · Bloquea la pantalla mientras dura. Si no, alguien con la paciencia de
 *    hacer doble clic puede disparar dos salidas y dos navegaciones.
 *  · Se anuncia por `aria-live`. Igual que en el login, un silencio es
 *    indistinguible de un cuelgue para quien no ve la pantalla.
 *
 * Por qué los mensajes cambian en vez de quedar fijos: la capa dura 5 segundos
 * porque el cierre es una acción irreversible a simple vista y no debe verse
 * como un glitch. Cinco segundos de una huella latiendo sobre texto fijo se
 * sienten como relleno; los mismos cinco segundos con un avance que explica
 * qué se está cerrando se sienten deliberados.
 *
 * Sobre el z-index: tiene que ser un token de Chakra, no un número. Con un
 * `z-index` inválido la propiedad queda en `auto`, y el sidebar y la barra
 * superior —que son `sticky`, muy por encima de `auto`— se dibujan encima.
 * El síntoma es una franja blanca arriba del todo durante el cierre: no es un
 * hueco del layout, es la barra superior por delante de la cortina.
 */

/** Lo que está pasando, en orden. Los textos dicen sólo cosas que son ciertas. */
const PASOS = [
  { texto: "Revocando tu sesión", detalle: "Cerrándola en el servidor" },
  { texto: "Limpiando este dispositivo", detalle: "Datos de sesión locales" },
  { texto: "Volviendo al inicio", detalle: "Hasta la próxima" },
];

/** Cada cuánto avanza el mensaje. */
const msPorPaso = 1500;

export function CapaSalida() {
  const sinMovimiento = useSinMovimiento();
  const [paso, setPaso] = useState(0);

  // Los pasos se cuentan hacia atrás desde el último. Así, si por lo que sea
  // la capa se quedara más de lo previsto en pantalla, el texto sigue siendo
  // cierto en lugar de quedarse congelado en un paso que ya pasó.
  useEffect(() => {
    if (sinMovimiento) return;

    const temporizador = setInterval(() => {
      setPaso((previa) => Math.min(previa + 1, PASOS.length - 1));
    }, msPorPaso);

    return () => clearInterval(temporizador);
  }, [sinMovimiento]);

  const actual = PASOS[paso];

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="modal"
      overflow="hidden"
      role="status"
      aria-live="polite"
      aria-label="Cerrando sesión"
    >
      {/* Cortina. Se despliega desde arriba con transform: así no dispara el
          layout en cada cuadro y corre en el compositor. */}
      <Box
        position="absolute"
        inset="0"
        bg="ink.900"
        style={
          sinMovimiento
            ? undefined
            : { animation: "vetsirio-cortina 1000ms cubic-bezier(0.4, 0, 0.2, 1) both" }
        }
      >
        {/* Viñeta radial: evita que el fondo sea un plano negro morto. */}
        <Box
          position="absolute"
          inset="0"
          bg="radial-gradient(120% 90% at 50% 40%, rgba(13,158,135,0.28) 0%, rgba(13,158,135,0) 62%)"
        />
      </Box>

      <Flex
        position="relative"
        h="100%"
        direction="column"
        align="center"
        justify="center"
        gap="6"
        px="6"
        textAlign="center"
        style={
          sinMovimiento ? undefined : { animation: "vetsirio-entrada 600ms ease-out 700ms both" }
        }
      >
        <Flex
          align="center"
          justify="center"
          w="4rem"
          h="4rem"
          style={
            sinMovimiento
              ? undefined
              : { animation: "vetsirio-latido 2.6s ease-in-out infinite" }
          }
        >
          <chakra.img
            src={appIcon}
            alt="VetSirio"
            w="full"
            h="full"
            objectFit="contain"
            draggable={false}
            style={{
              filter:
                "drop-shadow(0 0 20px color-mix(in srgb, var(--chakra-colors-brand-500) 60%, transparent))",
            }}
          />
        </Flex>

        {/* El `key` en el texto hace que React lo remonte en cada cambio, y con
            él arranca la animación de entrada del texto nuevo. */}
        <Flex
          key={actual.texto}
          direction="column"
          gap="1.5"
          maxW="24rem"
          style={
            sinMovimiento
              ? undefined
              : { animation: "vetsirio-aparece 320ms ease-out both" }
          }
        >
          <Text
            fontSize="lg"
            fontWeight="semibold"
            color="white"
            letterSpacing="-0.01em"
          >
            {actual.texto}
          </Text>

          <Text fontSize="sm" color="ink.400" lineHeight="1.6">
            {actual.detalle}
          </Text>
        </Flex>

        {/* Barra de progreso indeterminate. Es honesta: no sabe cuánto va a
            tardar, y un porcentaje inventado sería peor que una barra honesta. */}
        <Box
          w="9rem"
          h="0.25rem"
          borderRadius="full"
          bg="whiteAlpha.200"
          overflow="hidden"
        >
          <Box
            w="45%"
            h="full"
            borderRadius="full"
            bg="brand.400"
            style={
              sinMovimiento
                ? undefined
                : { animation: "vetsirio-barra 3s ease-in-out infinite" }
            }
          />
        </Box>

        <Flex align="center" gap="2" color="ink.500" aria-hidden="true">
          <LogOut size={14} />
          <Text fontSize="xs" letterSpacing="0.02em">
            {sinMovimiento ? "Cerrando…" : `Paso ${paso + 1} de ${PASOS.length}`}
          </Text>
        </Flex>
      </Flex>
    </Box>
  );
}