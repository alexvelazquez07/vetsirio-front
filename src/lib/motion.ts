import { useEffect, useState } from "react";

/**
 * Indica si el sistema operativo pidió reducir el movimiento.
 *
 * `prefers-reduced-motion` no es un detalle: para personas con trastornos
 * vestibulares o epilepsia fotosensible, una animación de entrada de pantalla
 * completa puede provocar síntomas reales. Quien lo tiene configurado en el
 * sistema espera que las apps lo respeten.
 *
 * Se lee con `useEffect` y no con un `useMemo` como el resto de los valores
 * derivados porque la preferencia puede cambiar con la sesión: la persona la
 * activa en Preferencias del sistema mientras la app está abierta y espera que
 * surta efecto sin recargar. Un `useMemo` la leería una sola vez al montar.
 *
 * Arranca en `false` en lugar de leer en el render para que el HTML del
 * servidor y el primer render del cliente coincidan; una discrepancia ahí
 * dispara la advertencia de hidratación de React.
 */
export function useSinMovimiento(): boolean {
  const [sinMovimiento, setSinMovimiento] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");

    setSinMovimiento(consulta.matches);

    const alCambiar = (evento: MediaQueryListEvent) => {
      setSinMovimiento(evento.matches);
    };

    // addEventListener no existe en Safari anterior a 14, que sigue apareciendo
    // en equipos de clínicas que no se actualizan. addListener es el camino
    // viejo pero sigue funcionando.
    if (consulta.addEventListener) {
      consulta.addEventListener("change", alCambiar);
      return () => consulta.removeEventListener("change", alCambiar);
    }

    consulta.addListener(alCambiar);
    return () => consulta.removeListener(alCambiar);
  }, []);

  return sinMovimiento;
}