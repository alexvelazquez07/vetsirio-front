import { MENU } from "@/routes/menu";

/**
 * Resolución del destino de una notificación.
 *
 * Las notificaciones guardan una URL interna, pero esa URL puede quedar
 * desactualizada: es un dato persistido, no una ruta viva de React Router. El
 * caso real que motivó esto es `/dashboard`, que se usó durante un tiempo y
 * hoy apunta a una pantalla que ya no existe con ese nombre.
 *
 * La regla es simple: si la ruta existe y el usuario puede verla, se navega.
 * Si no existe, no se navega y se avisa. Si existe pero requiere un permiso
 * que el usuario no tiene, tampoco se navega: mandarlo a la pantalla de
 * "sin acceso" es casi tan malo como el 404.
 */

export type DestinoNotificacion =
  | { accion: "navegar"; ruta: string }
  | { accion: "sin-destino" }
  | { accion: "sin-permiso" };

/** Rutas viejas que siguen apareciendo en notificaciones ya guardadas. */
const ALIAS: Record<string, string> = {
  "/dashboard": "/",
  "/inicio": "/",
};

/**
 * Rutas que existen en App.tsx pero no salen del menú, o que necesitan un
 * permiso distinto al que declara el ítem del menú.
 *
 * `/` es el caso especial: el menú lo declara con `panel.ver`, pero la ruta
 * índice no tiene guarda de permisos. Cualquier usuario autenticado puede
 * aterrizar ahí, así que no debe bloquearse.
 */
const RUTAS_EXTRA: Array<[string, string | undefined]> = [
  ["/", undefined],
  ["/cambiar-password", undefined],
  ["/ventas/nueva", "ventas.ver"],
  ["/suscripcion", "suscripcion.ver"],
  ["/admin", "__superadmin__"],
];

/** Mapa ruta → permiso requerido (undefined = sin permiso específico). */
const RUTAS_CONOCIDAS = new Map<string, string | undefined>();

for (const grupo of MENU) {
  for (const item of grupo.items) {
    RUTAS_CONOCIDAS.set(item.ruta, item.permiso);
  }
}

for (const [ruta, permiso] of RUTAS_EXTRA) {
  RUTAS_CONOCIDAS.set(ruta, permiso);
}

/** Deja la URL en una ruta interna comparable: sin query, hash ni barra final. */
function normalizarRuta(url: string): string | null {
  const sinExtras = url.trim().split(/[?#]/)[0];

  if (!sinExtras.startsWith("/")) return null;

  const sinBarraFinal =
    sinExtras.length > 1 ? sinExtras.replace(/\/+$/, "") : "/";

  return ALIAS[sinBarraFinal] ?? sinBarraFinal;
}

export function resolverDestinoNotificacion(
  url: string | null | undefined,
  puede: (clave: string) => boolean,
): DestinoNotificacion {
  if (!url) return { accion: "sin-destino" };

  const ruta = normalizarRuta(url);

  if (!ruta || !RUTAS_CONOCIDAS.has(ruta)) {
    return { accion: "sin-destino" };
  }

  const permiso = RUTAS_CONOCIDAS.get(ruta);

  if (permiso && !puede(permiso)) {
    return { accion: "sin-permiso" };
  }

  return { accion: "navegar", ruta };
}
