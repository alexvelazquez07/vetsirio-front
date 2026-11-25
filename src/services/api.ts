import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

/**
 * Cliente HTTP de la API.
 *
 * No se toca el token en el código: los dos tokens viajan en cookies HttpOnly
 * que el navegador manda solo. Eso elimina de raíz la clase de robo de sesión
 * más común: un XSS que logra leer el token de localStorage. Acá no hay nada
 * que leer, porque el JavaScript de la página no tiene acceso a las cookies.
 *
 * Lo que sí queda es CSRF, y se frena en el backend con SameSite más la
 * validación de Origin.
 */

export const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

/** Resuelve rutas de archivos públicos usando el origen de la API. */
export function urlDeArchivo(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const baseApi = new URL(API_URL, window.location.origin);
    return new URL(url, baseApi).toString();
  } catch {
    return url;
  }
}

/** Error normalizado que consume la UI. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly errors?: Record<string, string[]>;
  readonly estadoSuscripcion?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    code?: string,
    errors?: Record<string, string[]>,
    estadoSuscripcion?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.estadoSuscripcion = estadoSuscripcion;
  }

  /** Texto de error de un campo concreto, para pintarlo bajo el input. */
  errorDeCampo(campo: string): string | undefined {
    return this.errors?.[campo]?.[0];
  }
}

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

/**
 * Callback que se dispara cuando el token se renueva, para que el store de
 * sesión pueda reflejar el nuevo estado si lo necesita.
 */
let alRenovarSesion: ((usuario: unknown) => void) | null = null;
let alCerrarSesion: (() => void) | null = null;

export function configurarCallbacksAuth(hooks: {
  alRenovar?: (usuario: unknown) => void;
  alCerrar?: () => void;
}): void {
  alRenovarSesion = hooks.alRenovar ?? null;
  alCerrarSesion = hooks.alCerrar ?? null;
}

/**
 * Peticiones de refresco pendientes.
 *
 * Si cinco requests fallan a la vez por token vencido, sin esto dispararían
 * cinco refrescos. El segundo que llega se engancha a la misma promesa: sólo
 * se renueva una vez y los cinco esperan el mismo resultado.
 */
let refrescoEnCurso: Promise<unknown> | null = null;

async function refrescarToken(): Promise<unknown> {
  if (!refrescoEnCurso) {
    refrescoEnCurso = axios
      .post(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true, timeout: 15000 },
      )
      .then((respuesta) => {
        refrescoEnCurso = null;
        alRenovarSesion?.(respuesta.data?.usuario);
        return respuesta.data;
      })
      .catch((error: unknown) => {
        refrescoEnCurso = null;
        throw error;
      });
  }

  return refrescoEnCurso;
}

/**
 * Nombre del candado que coordina el refresco entre pestañas.
 *
 * El refresh token es de un solo uso: si dos pestañas lo presentan a la vez,
 * la segunda llega con un token ya rotado y el backend —con razón— interpreta
 * reuso y tumba la familia completa. Ambas terminan deslogueadas. El candado
 * hace que sólo una pestaña rote; las demás esperan y reintentan con las
 * cookies nuevas, que el navegador comparte entre pestañas.
 */
const NOMBRE_CANDADO_REFRESH = "vetsirio:refresh-sesion";

/**
 * Ejecuta `tarea` bajo un candado compartido entre pestañas del mismo origen.
 *
 * Web Locks existe en todos los navegadores actuales; si falta, se ejecuta sin
 * candado. Es una mejora de concurrencia, no un requisito para funcionar.
 */
async function conCandadoEntrePestanas<T>(tarea: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;

  if (!locks) {
    return tarea();
  }

  return locks.request(NOMBRE_CANDADO_REFRESH, tarea) as Promise<T>;
}

/** ¿El error es un access token vencido, que sí se puede renovar? */
function esTokenExpirado(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 401 &&
    error.code === "TOKEN_EXPIRADO"
  );
}

/**
 * ¿La sesión terminó de verdad?
 *
 * Sólo un rechazo explícito del servidor (401/403) cierra la sesión. Un corte
 * de red, un timeout o un 503 al renovar no son motivo para expulsar al
 * usuario: se le deja la sesión como estaba y puede reintentar.
 */
export function esSesionTerminada(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 401 || error.status === 403;
  }

  const status = (error as AxiosError | undefined)?.response?.status;
  return status === 401 || status === 403;
}

/**
 * Renueva la sesión y repite la petición original.
 *
 * Antes de rotar el refresh se reintenta la petición: si otra pestaña renovó
 * mientras esperábamos el candado, las cookies ya son nuevas y no hace falta
 * un segundo refresco.
 */
async function renovarSesionYReintentar(
  original: InternalAxiosRequestConfig,
): Promise<unknown> {
  return conCandadoEntrePestanas(async () => {
    try {
      return await api(original);
    } catch (error) {
      if (!esTokenExpirado(error)) {
        throw error;
      }
    }

    await refrescarToken();
    return api(original);
  });
}

/** Normaliza tanto un error de axios como uno ya normalizado. */
function normalizarError(error: unknown): ApiError {
  return error instanceof ApiError ? error : normalizar(error as AxiosError);
}

/**
 * Rutas que nunca disparan un refresco.
 *
 * Refrescar dentro del refresh crearía un bucle infinito, y un login fallido
 * no tiene nada que renovar.
 */
const SIN_REFRESH = ["/auth/login", "/auth/refresh", "/auth/registro"];

/**
 * Rutas donde un 401 sin código de expiración significa "no hay sesión".
 *
 * La diferencia es la que separa un aviso de un bucle infinito:
 *
 *  · `/auth/me` se llama en cada arranque para averiguar quién sos. Sin sesión
 *    responde 401 sin código de expiración, y no hay nada que recuperar.
 *  · Si el backend sí devuelve `TOKEN_EXPIRADO`, incluso en `/auth/me`, hay
 *    una sesión vencida que todavía puede recuperarse mediante refresh.
 */
const SIN_REFRESH_POR_401_SIN_TOKEN_EXPIRADO = ["/auth/me"];

export interface EntradaDecision {
  status: number;
  /** Código de error que devuelve el backend, si lo manda. */
  code?: string;
  url: string;
  /** Si esta petición particular ya intentó refrescar una vez. */
  yaReintentado: boolean;
}

/**
 * Decide si hay que intentar un refresco de token.
 *
 * Se extrajo como función pura a propósito. La decisión "¿esto es un token
 * vencido o simplemente no hay sesión?" es la que rompe el ciclo de recargas, y
 * burying entre paréntesis de un interceptor la hace imposible de testear sin
 * montar axios entero.
 */
export function debeIntentarRefresh(entrada: EntradaDecision): boolean {
  if (entrada.status !== 401) return false;
  if (entrada.yaReintentado) return false;
  if (SIN_REFRESH.some((ruta) => entrada.url.includes(ruta))) return false;
  if (
    SIN_REFRESH_POR_401_SIN_TOKEN_EXPIRADO.some((ruta) =>
      entrada.url.includes(ruta),
    ) &&
    entrada.code !== "TOKEN_EXPIRADO"
  ) {
    return false;
  }

  return entrada.code === "TOKEN_EXPIRADO";
}

/**
 * Decide si hay que recargar la página entera.
 *
 * Siempre false, y está escrito como función para que la regla quede explícita
 * y cubierta por un test.
 *
 * Recargar es lo que armaba el ciclo: `window.location.assign()` descarta el
 * estado de la aplicación, vuelve a disparar /auth/me, y si ese 401 se
 * confunde con un token vencido, la recarga vuelve a pedir un refresh que
 * vuelve a fallar. El enrutado ya resuelve el caso: si no hay sesión,
 * `RutaPrivada` manda al login con navigate(), sin recargar y sin perder el
 * estado.
 */
export function debeRecargarPagina(_entrada: EntradaDecision): false {
  return false;
}

api.interceptors.response.use(
  (respuesta) => respuesta,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & {
      _reintentado?: boolean;
    }) | undefined;

    const cuerpo = (error.response?.data ?? {}) as { code?: string };

    const entrada: EntradaDecision = {
      status: error.response?.status ?? 0,
      code: cuerpo.code,
      url: original?.url ?? "",
      yaReintentado: original?._reintentado === true,
    };

    if (debeIntentarRefresh(entrada) && original) {
      original._reintentado = true;

      try {
        return await renovarSesionYReintentar(original);
      } catch (errorRenovacion) {
        // El refresh falló. Sólo se cierra la sesión si el servidor la rechazó
        // (401/403); un problema de red no debe sacar al usuario de la app.
        if (esSesionTerminada(errorRenovacion)) {
          alCerrarSesion?.();
        }
        return Promise.reject(normalizarError(errorRenovacion));
      }
    }

    return Promise.reject(normalizar(error));
  },
);

/** Traduce la respuesta cruda de axios al error que consume la UI. */
/** Forma del cuerpo de error que devuelve la API. */
interface PayloadError {
  message?: string;
  code?: string;
  errors?: Record<string, string[]>;
  estadoSuscripcion?: Record<string, unknown>;
}

function normalizar(error: AxiosError): ApiError {
  const status = error.response?.status ?? 0;
  const payload = (error.response?.data ?? {}) as PayloadError;

  if (error.code === "ECONNABORTED") {
    return new ApiError(
      "La solicitud tardó demasiado. Revisá tu conexión e intentá de nuevo.",
      408,
      "TIMEOUT",
    );
  }

  if (!error.response) {
    return new ApiError(
      "No pudimos conectar con el servidor. Verificá que esté encendido.",
      503,
      "SIN_CONEXION",
    );
  }

  const errors = payload?.errors ?? {};

  if (payload?.code === "CONFLICTO_UNICIDAD" && payload?.message) {
    const mensaje = payload.message;
    if (mensaje.includes("código de barras")) {
      errors.codigoBarras = [mensaje];
    } else if (mensaje.includes("código")) {
      errors.codigo = [mensaje];
    }
  }

  return new ApiError(
    payload?.message ?? "Ocurrió un error inesperado.",
    status,
    payload?.code,
    errors,
    payload?.estadoSuscripcion,
  );
}

/** Atajo tipado. */
export async function pedir<T>(config: AxiosRequestConfig): Promise<T> {
  const respuesta = await api.request<T>(config);
  return respuesta.data;
}

export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    pedir<T>({ ...config, method: "GET", url }),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    pedir<T>({ ...config, method: "POST", url, data }),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    pedir<T>({ ...config, method: "PATCH", url, data }),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    pedir<T>({ ...config, method: "PUT", url, data }),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    pedir<T>({ ...config, method: "DELETE", url }),
};