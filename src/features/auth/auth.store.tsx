import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, configurarCallbacksAuth, http } from "@/services/api";
import { aplicarColorDeMarca } from "@/theme/brand-color";
import type { RespuestaLogin, RespuestaPerfil, Usuario, Veterinaria, EstadoSuscripcion } from "@/types/dominio";
import type { LoginForm } from "@/lib/validaciones";

/**
 * Estado de sesión.
 *
 * La fuente de verdad es `/auth/me`, no lo que devolvió el login. La razón es
 * que entre el login y el uso de la app pueden cambiar los permisos del rol o
 * vencer la suscripción; leer del servidor en cada arranque garantiza que la
 * UI no muestre botones que el backend va a rechazar.
 */

interface Sesion {
  usuario: Usuario | null;
  veterinaria: Veterinaria | null;
  estadoSuscripcion: EstadoSuscripcion | null;
  cargando: boolean;
  autenticado: boolean;
}

interface ContextoSesion extends Sesion {
  login: (credenciales: LoginForm) => Promise<void>;
  logout: () => Promise<void>;
  /** Borra el estado local. Cierra la sesión del lado de la app. */
  limpiarSesion: () => void;
  refrescarPerfil: () => Promise<void>;
  /** Permisos del usuario, ya aplanados a Set para consulta rápida. */
  puede: (clave: string) => boolean;
  puedeAlguno: (...claves: string[]) => boolean;
}

const ContextoAuth = createContext<ContextoSesion | null>(null);

/**
 * Rutas públicas donde una sesión vencida no debe expulsar al usuario.
 *
 * El caso que motivó esto: alguien abre el enlace de restablecimiento desde un
 * navegador con cookies viejas. `/auth/me` falla, el refresh también, y el
 * aviso de "sesión expirada" navegaba al login perdiendo el token del enlace.
 */
const RUTAS_SIN_REDIRECCION_POR_SESION = [
  "/login",
  "/registro",
  "/recuperar-password",
  "/restablecer-password",
];

function esRutaPublica(ruta: string): boolean {
  return RUTAS_SIN_REDIRECCION_POR_SESION.some(
    (publica) => ruta === publica || ruta.startsWith(`${publica}/`),
  );
}

export function ProveedorAuth({ children }: { children: ReactNode }) {
  const navegar = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: perfil,
    isLoading: cargando,
  } = useQuery({
    queryKey: ["auth", "perfil"],
    queryFn: async (): Promise<RespuestaPerfil | null> => {
      try {
        return await http.get<RespuestaPerfil>("/auth/me");
      } catch (error) {
        // 401 es el caso normal de "no hay sesión": no es un error que haya
        // que mostrar, simplemente el usuario tiene que entrar.
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        // Cualquier otro fallo (red, 5xx) no significa que la sesión terminó.
        // Se relanza para conservar el último perfil conocido en vez de
        // reemplazarlo por null y expulsar al usuario al login.
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    aplicarColorDeMarca(perfil?.veterinaria.colorPrimario);
  }, [perfil?.veterinaria.colorPrimario]);

  const mutacionLogin = useMutation({
    mutationFn: async ({ email, password }: LoginForm) => {
      // Sólo viajan las credenciales. "Recordar mi correo" es una preferencia
      // local de LoginPage y no forma parte del contrato del backend.
      return http.post<RespuestaLogin>("/auth/login", { email, password });
    },
    onSuccess: async (respuesta) => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      // Si quedó few días de trial, avisamos de una vez en lugar de que el
      // usuario lo descubra cuando intente guardar.
      void respuesta;
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 403) {
        throw error;
      }
      throw error;
    },
  });

  const mutacionLogout = useMutation({
    mutationFn: () => http.post<{ mensaje: string }>("/auth/logout"),
  });

  const login = useCallback(
    async (credenciales: LoginForm) => {
      const respuesta = await mutacionLogin.mutateAsync(credenciales);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });

      // Si el administrador dejó una contraseña temporal, no tiene sentido
      // mostrarle el dashboard para rebotarlo enseguida: va directo al cambio.
      navegar(
        respuesta.usuario.debeCambiarPassword
          ? "/cambiar-password"
          : "/",
        { replace: true },
      );
    },
    [mutacionLogin, queryClient, navegar],
  );

/**
   * Pide al servidor que cierre la sesión. No toca el estado local.
   *
   * Borrar el caché no es un detalle interno: en el momento en que se borra, la
   * consulta `["auth", "perfil"]` queda sin datos, `autenticado` pasa a falso y
   * <RutaPrivada> redirige al login de inmediato. Si el borrado fuera parte de
   * esta función, el cierre de sesión se completaría en el tiempo que tarda la
   * petición y la animación no llegaría a verse ni un segundo.
   *
   * Por eso el borrado vive aparte, en `limpiarSesion`, y lo llama
   * <ProveedorSalida> cuando la animación ya terminó.
   */
  const logout = useCallback(async () => {
    try {
      await mutacionLogout.mutateAsync();
    } catch {
      // Si el logout falla en el servidor, se limpia igual localmente: dejar
      // al usuario "logueado" en una sesión que el backend ya cerró solo
      // genera errores confusos después. Por eso quien limpia es
      // `limpiarSesion`, que se llama igual en el `catch`.
    }
  }, [mutacionLogout]);

  /**
   * Borra todo el estado de sesión del cliente.
   *
   * Es lo que realmente cierra la sesión del punto de vista de la app: al
   * vaciarse el caché, <RutaPrivada> deja de considerar autenticado al usuario
   * y lo manda al login.
   */
  const limpiarSesion = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    configurarCallbacksAuth({
      alCerrar: () => {
        queryClient.setQueryData(["auth", "perfil"], null);
        queryClient.getMutationCache().clear();
        queryClient.removeQueries({
          predicate: (consulta) => consulta.queryKey[0] !== "auth",
        });

        // En una pantalla pública no se redirige: el enlace del correo (o el
        // formulario de login) tiene que seguir disponible aunque las cookies
        // de una sesión anterior estén vencidas.
        if (!esRutaPublica(window.location.pathname)) {
          navegar("/login?sesion=expirada", { replace: true });
        }
      },
    });

    return () => configurarCallbacksAuth({});
  }, [navegar, queryClient]);

  const refrescarPerfil = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["auth", "perfil"] });
  }, [queryClient]);

  const permisos = useMemo(
    () => new Set(perfil?.usuario.rol.permisos?.map((p) => p.clave) ?? []),
    [perfil],
  );

  const esSuperAdmin = perfil?.usuario.rol.nombre === "superadmin";

  const puede = useCallback(
    (clave: string) => esSuperAdmin || permisos.has(clave),
    [esSuperAdmin, permisos],
  );

  const puedeAlguno = useCallback(
    (...claves: string[]) => esSuperAdmin || claves.some((clave) => permisos.has(clave)),
    [esSuperAdmin, permisos],
  );

  const valor = useMemo<ContextoSesion>(
    () => ({
      usuario: perfil?.usuario ?? null,
      veterinaria: perfil?.veterinaria ?? null,
      estadoSuscripcion: perfil?.estadoSuscripcion ?? null,
      cargando,
      autenticado: Boolean(perfil?.usuario),
      login,
      logout,
      limpiarSesion,
      refrescarPerfil,
      puede,
      puedeAlguno,
    }),
    [perfil, cargando, login, logout, limpiarSesion, refrescarPerfil, puede, puedeAlguno],
  );

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}

export function useAuth(): ContextoSesion {
  const contexto = useContext(ContextoAuth);

  if (!contexto) {
    throw new Error("useAuth debe usarse dentro de <ProveedorAuth>.");
  }

  return contexto;
}