import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import { CapaSalida } from "@/components/auth/CapaSalida";
import { useAuth } from "./auth.store";

/**
 * Salida de sesión animada.
 *
 * Existe para que el cierre de sesión pase siempre por el mismo lugar, y para
 * decidir *cuánto dura*. El trabajo real está en el tiempo, no en el dibujo:
 *
 *  · **Mínimo.** El backend responde el logout en 40-150 ms cuando hay red. Con
 *    esa duración, la cortina alcanzaría a verse un cuadro y desaparecería: se
 *    percibe como un glitch, no como una acción. Se fuerza un mínimo para que
 *    la animación se vea entera, y el mínimo manda sobre la respuesta del
 *    servidor.
 *  · **Tope.** A la inversa, si la petición se cuelga, la capa taparía la app
 *    para siempre. El tope está por encima del timeout del cliente HTTP para no
 *    cortar antes de que él mismo haya expirado, y por debajo de "el usuario se
 *    cansó de esperar".
 *  · **Idempotencia.** Mientras hay una salida en curso, las llamadas siguientes
 *    se ignoran. Sin eso, el doble clic dispara dos `logout()` y dos
 *    navegaciones.
 */

/**
 * Tiempo mínimo con la capa en pantalla.
 *
 * 5 s. Es mucho más de lo que el cierre necesita en términos técnicos, y es
 * justo el punto: la acción es irreversible a simple vista y, si el cambio de
 * pantalla fuera rápido, se lee como un glitch y no como algo que el usuario
 * pidió. El tiempo se usa para que la secuencia se_complete y para que los
 * mensajes tengan dónde ir, no para hacer esperar sin motivo.
 *
 * El reparto:
 *   · 0-1,0 s      la cortina baja y tapa el panel
 *   · 0,7-1,3 s    aparece la huella y el primer mensaje
 *   · 1,3-5,0 s    los mensajes avanzan, la huella late, la barra recorre
 *
 * El último tramo tiene la meseta más larga a propósito: el salto al login
 * tiene que llegar después de un silencio, si no se siente pegado a la
 * animación.
 */
const msCierreMinimo = 5000;

/**
 * Tope absoluto.
 *
 * Va por encima de los 15 s del cliente HTTP para no cortar antes de que él
 * mismo haya expirado, y muy por debajo de "el usuario se cansó de esperar".
 */
const msCierreTope = 20_000;

/** Red de seguridad para cuando la navegación no desmonta la app. */
const msRedDeSeguridad = 24_000;

interface ContextoSalida {
  /** Hay una salida en curso y la capa está en pantalla. */
  cerrando: boolean;
  /** Inicia la salida. Es idempotente mientras haya una en curso. */
  solicitar: () => void;
}

const CtxSalida = createContext<ContextoSalida | null>(null);

const esperar = (ms: number) =>
  new Promise<void>((resolver) => {
    setTimeout(resolver, ms);
  });

export function ProveedorSalida({ children }: { children: ReactNode }) {
  const { logout, limpiarSesion } = useAuth();
  const navegar = useNavigate();
  const [cerrando, setCerrando] = useState(false);

  // El guardia va en un ref y no en el estado: `setCerrando` con un updater que
  // dispara efectos sería incorrecto, porque React puede invocar ese updater
  // dos veces en StrictMode y `logout()` se ejecutaría dos veces.
  const enCurso = useRef(false);

  const solicitar = useCallback(() => {
    if (enCurso.current) return;

    enCurso.current = true;
    setCerrando(true);

    // `logout()` y el mínimo arrancan juntos. El `race` con el tope es lo que
    // garantiza que siempre se salga, aunque la petición no termine nunca.
    void Promise.race([
      Promise.all([logout(), esperar(msCierreMinimo)]),
      esperar(msCierreTope),
    ])
      .catch(() => undefined)
      .then(() => {
        enCurso.current = false;

        // El orden importa: primero se limpia, que es lo que hace que
        // <RutaPrivada> deje de considerar autenticado al usuario, y después
        // se navega. Al revés habría un instante con el caché vacío y todavía
        // en el panel, y el login aparecería con un parpadeo de por medio.
        limpiarSesion();
        navegar("/login", { replace: true });
      });
  }, [logout, limpiarSesion, navegar]);

  // Si la navegación fallara por lo que sea, la capa no puede quedarse puesta
  // bloqueando la aplicación.
  useEffect(() => {
    if (!cerrando) return;

    const temporizador = setTimeout(() => {
      enCurso.current = false;
      setCerrando(false);
    }, msRedDeSeguridad);

    return () => clearTimeout(temporizador);
  }, [cerrando]);

  return (
    <CtxSalida.Provider value={{ cerrando, solicitar }}>
      {children}
      {cerrando && <CapaSalida />}
    </CtxSalida.Provider>
  );
}

export function useSalida(): ContextoSalida {
  const contexto = useContext(CtxSalida);

  if (!contexto) {
    throw new Error("useSalida debe usarse dentro de <ProveedorSalida>.");
  }

  return contexto;
}