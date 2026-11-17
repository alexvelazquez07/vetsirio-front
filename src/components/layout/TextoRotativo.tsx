import { Box, chakra } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Máquina de escribir que cicla frases.
 *
 * Se usa en la pantalla de acceso para mostrar de qué se ocupa el sistema sin
 * un carrusel de imágenes, que pesa más y distrae más.
 *
 * Un único intervalo maneja las tres fases del ciclo. La versión anterior usaba
 * dos intervalos más dos efectos para coordinar la espera y el borrado, y
 * terminó con un acoplamiento frágil entre ellos: cambiar una dependencia
 * recreaba el intervalo y el texto se quedaba congelado.
 *
 * Aquí la coordinación está en el propio tick, que decide según la fase cuánto
 * avanza. Así no hay efecto que sincronizar con otro.
 */

const TICK_MS = 32;
/** Caracteres por tick al escribir. 2 × 32 ms ≈ 64 ms por letra. */
const PASO_ESCRITURA = 2;
/** Caracteres por tick al borrar. 1 × 32 ms ≈ 32 ms por letra. */
const PASO_BORRADO = 1;
/** Ticks de espera con la frase completa, antes de empezar a borrar. */
const ESPERA_ESCRITA_TICKS = 75;
/** Ticks de espera con la frase vacía, antes de la siguiente. */
const ESPERA_BORRADA_TICKS = 12;

type Fase = "escribiendo" | "espera" | "borrando";

interface Maquina {
  indice: number;
  posicion: number;
  fase: Fase;
  esperaRestante: number;
}

export function useTypewriter(
  frases: string[],
  opciones?: { pausaEscritaMs?: number; pausaBorradaMs?: number },
) {
  const [texto, setTexto] = useState("");
  const [completo, setCompleto] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [activo, setActivo] = useState(true);

  // El estado del ciclo vive en un ref: se lee y se escribe en cada tick sin
  // provocar renders. Sólo el texto visible va a estado de React.
  const maquina = useRef<Maquina>({
    indice: 0,
    posicion: 0,
    fase: "escribiendo",
    esperaRestante: 0,
  });

  const sinMovimiento = useMemo(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Ticks de espera convertidos a milisegundos, respetando la opción del llamador.
  const pausaEscritaTicks = opciones?.pausaEscritaMs
    ? Math.round(opciones.pausaEscritaMs / TICK_MS)
    : ESPERA_ESCRITA_TICKS;
  const pausaBorradaTicks = opciones?.pausaBorradaMs
    ? Math.round(opciones.pausaBorradaMs / TICK_MS)
    : ESPERA_BORRADA_TICKS;

  useEffect(() => {
    if (frases.length === 0) return;

    // Con movimiento reducido se muestra la primera frase completa y quieta.
    if (sinMovimiento) {
      maquina.current = { indice: 0, posicion: frases[0].length, fase: "espera", esperaRestante: 0 };
      setTexto(frases[0]);
      setCompleto(true);
      setBorrando(false);
      setActivo(false);
      return;
    }

    maquina.current = { indice: 0, posicion: 0, fase: "escribiendo", esperaRestante: 0 };
    setTexto("");
    setCompleto(false);
    setBorrando(false);

    const temporizador = setInterval(() => {
      const estado = maquina.current;
      const frase = frases[estado.indice] ?? "";

      switch (estado.fase) {
        case "escribiendo": {
          const siguiente = Math.min(estado.posicion + PASO_ESCRITURA, frase.length);
          estado.posicion = siguiente;
          setTexto(frase.slice(0, siguiente));

          if (siguiente >= frase.length) {
            estado.fase = "espera";
            estado.esperaRestante = pausaEscritaTicks;
            setCompleto(true);
          }

          break;
        }

        case "espera": {
          estado.esperaRestante -= 1;

          if (estado.esperaRestante <= 0) {
            estado.fase = "borrando";
            estado.esperaRestante = pausaBorradaTicks;
            setBorrando(true);
          }

          break;
        }

        case "borrando": {
          const siguiente = Math.max(estado.posicion - PASO_BORRADO, 0);
          estado.posicion = siguiente;
          setTexto(frase.slice(0, siguiente));

          if (siguiente <= 0) {
            estado.indice = (estado.indice + 1) % frases.length;
            estado.fase = "escribiendo";
            setBorrando(false);
            setCompleto(false);
          }

          break;
        }
      }
    }, TICK_MS);

    return () => clearInterval(temporizador);
  }, [frases, sinMovimiento, pausaEscritaTicks, pausaBorradaTicks]);

  return { texto, borrando, completo, activo };
}

export interface TextoRotativoProps {
  frases: string[];
}

/**
 * Frase que se escribe sola.
 *
 * El cursor desaparece cuando la frase quedó completa: un cursor quieto sobre
 * una palabra terminada parece un error de carga.
 */
export function TextoRotativo({ frases }: TextoRotativoProps) {
  const { texto, activo } = useTypewriter(frases);

  return (
    <Box display="flex" alignItems="flex-start">
      <chakra.p
        fontSize={{ base: "xl", md: "3xl" }}
        fontWeight="bold"
        color="white"
        lineHeight="1.2"
        letterSpacing="-0.02em"
        minH="2.4em"
      >
        {texto}
        {activo && <Cursor />}
      </chakra.p>
    </Box>
  );
}

function Cursor() {
  return (
    <chakra.span
      display="inline-block"
      w="3px"
      h="0.82em"
      ml="2px"
      bg="brand.200"
      verticalAlign="-0.02em"
      animation="vetsirio-cursor 1.1s steps(2, start) infinite"
    />
  );
}