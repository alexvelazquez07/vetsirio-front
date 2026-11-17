import { Box, chakra, Flex, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { useSinMovimiento } from "@/lib/motion";

/**
 * Pantalla de carga del inicio de sesión.
 *
 * Tres decisiones de diseño:
 *
 *  · Es una capa sobre la pantalla, no una pantalla nueva. Si el login falla,
 *    el formulario sigue ahí con su error: el usuario no pierde lo que escribió.
 *  · Muestra progreso real. El login tarda entre 300 ms y 1,5 s según la red;
 *    un spinner girando ese tiempo se siente como que la página se congeló.
 *    Los mensajes avanzar por pasos fills ese hueco con algo que explica qué
 *    está pasando.
 *  · Respeta prefers-reduced-motion: sin animaciones, muestra el estado quieto.
 */

/** Momentos que atraviesa el inicio de sesión, en el orden en que ocurren. */
const PASOS = [
  { texto: "Verificando tus credenciales", detalle: "Contraseña y correo" },
  { texto: "Abriendo tu sesión", detalle: "Autenticación segura" },
  { texto: "Cargando tu veterinaria", detalle: "Datos y configuración" },
  { texto: "Preparando tu espacio de trabajo", detalle: "Agenda y pacientes" },
];

export interface LoginLoadingProps {
  /** Muestra u oculta la capa. */
  visible: boolean;
}

export function LoginLoading({ visible }: LoginLoadingProps) {
  const [paso, setPaso] = useState(0);

  const sinMovimiento = useSinMovimiento();

  // El avance es puramente informativo: el login puede tardar más o menos que
  // este tiempo. Por eso los mensajes son genéricos y no anuncian un porcentaje.
  useEffect(() => {
    if (!visible || sinMovimiento) return;

    const temporizador = setInterval(() => {
      setPaso((previo) => (previo + 1) % PASOS.length);
    }, 700);

    return () => clearInterval(temporizador);
  }, [visible, sinMovimiento]);

  // Al empezar de cero, el avance vuelve al primer paso: si el usuario reintenta
  // el login, no debe arrancar en "Preparando tu espacio".
  useEffect(() => {
    if (visible) {
      setPaso(0);
    }
  }, [visible]);

  if (!visible) return null;

  const actual = PASOS[paso];

  return (
    <Box
      position="fixed"
      inset="0"
      zIndex="modal"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="rgba(10, 17, 28, 0.72)"
      backdropFilter="blur(6px)"
      style={{ animation: "vetsirio-aparece 180ms ease-out both" }}
      role="status"
      aria-live="polite"
      aria-label="Iniciando sesión"
    >
      <Flex direction="column" align="center" gap="6" px="6">
        {/* ── Latido ─────────────────────────────────────────────────── */}
        <Latido reduceMotion={sinMovimiento} />

        {/* ── Mensaje ────────────────────────────────────────────────── */}
        <Flex direction="column" align="center" gap="1.5" minH="4.5rem" textAlign="center">
          <Text
            fontSize="lg"
            fontWeight="semibold"
            color="white"
            letterSpacing="-0.01em"
            key={actual.texto}
            style={{ animation: sinMovimiento ? undefined : "vetsirio-entrada 320ms ease-out both" }}
          >
            {actual.texto}
          </Text>

          <Text fontSize="sm" color="whiteAlpha.600">
            {actual.detalle}
          </Text>
        </Flex>

        {/* ── Barra de progreso ──────────────────────────────────────── */}
        {!sinMovimiento && (
          <Flex gap="1.5">
            {PASOS.map((item, indice) => (
              <chakra.span
                key={item.texto}
                w="6"
                h="1"
                borderRadius="full"
                bg={indice <= paso ? "brand.400" : "whiteAlpha.200"}
                style={{
                  transition: "background-color 300ms ease",
                }}
              />
            ))}
          </Flex>
        )}
      </Flex>
    </Box>
  );
}

/**
 * Trazo de latido.
 *
 * Es una línea que se dibuja con un Monitor cardíaco: es el gesto más asociado
 * a la medicina veterinaria y a la salud animal, y no es un spinner genérico
 * que podría ser de cualquier aplicación.
 *
 * El trazo se dibuja con strokeDashoffset, que es la forma más barata de
 * animar: el compositor sólo repinta la línea, sin recalcular layout.
 */
function Latido({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <Box position="relative" w="13rem" h="4rem">
      {/* Ondas de fondo: dos anillos que se expanden, como un monitor. */}
      {!reduceMotion && (
        <>
          <Box
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            w="4rem"
            h="4rem"
            borderRadius="full"
            borderWidth="2px"
            borderColor="brand.500"
            style={{ animation: "vetsirio-onda 2.2s ease-out infinite" }}
          />
          <Box
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            w="4rem"
            h="4rem"
            borderRadius="full"
            borderWidth="2px"
            borderColor="brand.400"
            style={{ animation: "vetsirio-onda 2.2s ease-out 1.1s infinite" }}
          />
        </>
      )}

      {/* Huella de la marca al centro. El centrado va en una caja aparte: si
          estuviera en la misma que anima, el `translate(-50%, -50%)` se
          pisaría con el `scale` del keyframe y la huella quedaría corrida. */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        w="3.5rem"
        h="3.5rem"
      >
        <Flex
          align="center"
          justify="center"
          w="full"
          h="full"
          borderRadius="full"
          bg="brand.500"
          boxShadow="0 0 24px color-mix(in srgb, var(--chakra-colors-brand-500) 50%, transparent)"
          style={
            reduceMotion ? undefined : { animation: "vetsirio-latido 1.15s ease-in-out infinite" }
          }
        >
          <PawPrint size={22} color="white" strokeWidth={2.2} />
        </Flex>
      </Box>

      {/* Trazo del ECG. */}
      <chakra.svg
        position="absolute"
        inset="0"
        w="100%"
        h="100%"
        viewBox="0 0 200 64"
        fill="none"
        aria-hidden="true"
        overflow="visible"
      >
        <chakra.path
          d="M0 32 H70 L80 32 L86 14 L94 50 L102 32 H130 L140 32 L146 22 L152 42 L158 32 H200"
          stroke="var(--chakra-colors-brand-400)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          style={
            reduceMotion
              ? undefined
              : {
                  strokeDasharray: 1,
                  strokeDashoffset: 0,
                  animation: "vetsirio-ecg 2.4s ease-in-out infinite",
                }
          }
        />
      </chakra.svg>
    </Box>
  );
}

/**
 * Huella de perro con los dedos desfasados.
 *
 * Lucide no tiene un ícono de huella con la forma que necesitamos, y usar un
 * paw genérico de otra librería suma una dependencia por un solo ícono.
 */
function PawPrint({ size, color, strokeWidth }: { size: number; color: string; strokeWidth: number }) {
  return (
    <chakra.svg
      width={`${size}px`}
      height={`${size}px`}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Almohadillas de los dedos, en arco sobre la almohadilla principal. */}
      <ellipse cx="6.2" cy="8.6" rx="1.9" ry="2.4" transform="rotate(-16 6.2 8.6)" />
      <ellipse cx="10.4" cy="6.4" rx="1.9" ry="2.5" transform="rotate(-5 10.4 6.4)" />
      <ellipse cx="15.1" cy="7.3" rx="1.9" ry="2.5" transform="rotate(9 15.1 7.3)" />
      <ellipse cx="18.7" cy="10.4" rx="1.7" ry="2.2" transform="rotate(20 18.7 10.4)" />
      <path d="M12.4 12.6c2.6 0 4.7 1.8 4.7 4.1 0 1.7-1.4 2.7-3.2 2.7-.7 0-1.1.2-1.5.2s-.8-.2-1.5-.2c-1.8 0-3.2-1-3.2-2.7 0-2.3 2.1-4.1 4.7-4.1Z" />
    </chakra.svg>
  );
}