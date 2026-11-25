import { describe, expect, it } from "vitest";

import {
  api,
  configurarCallbacksAuth,
  debeIntentarRefresh,
  debeRecargarPagina,
  esSesionTerminada,
  http,
  ApiError,
} from "@/services/api";

/**
 * Pruebas del ciclo de sesión.
 *
 * Existen por un bug real y muy caro: el navegador recargaba la página cada
 * segundo. La secuencia era un bucle:
 *
 *   1. El frontend llama /auth/me al arrancar para averiguar quién sos.
 *   2. No hay sesión, responde 401. Y está bien que responda así.
 *   3. El interceptor lo tomaba como "el token expiró" e intentaba refrescar.
 *   4. /auth/refresh también respondía 401.
 *   5. El interceptor llamaba a window.location.assign(), que recarga la
 *      página entera.
 *   6. Al recargar, se volvía al paso 1.
 *
 * Lo engañoso del diagnóstico es que cada petición individual era correcta.
 * /auth/me sin sesión tiene que dar 401. Lo que estaba mal era la reacción a
 * ese 401, que quedó enterrada en un interceptor y por eso ningún typecheck ni
 * test lo veía.
 *
 * Por eso la decisión vive ahora en dos funciones puras y estos tests la
 * cubren sin necesidad de simular axios entero.
 */

describe("debeIntentarRefresh", () => {
  it("renueva sólo cuando el backend dice que el token expiró", () => {
    expect(
      debeIntentarRefresh({
        status: 401,
        code: "TOKEN_EXPIRADO",
        url: "/clientes",
        yaReintentado: false,
      }),
    ).toBe(true);
  });

  it("NO renueva cuando 401 significa simplemente que no hay sesión", () => {
    // Este es el caso que armaba el bucle: /auth/me sin cookies responde 401
    // sin código TOKEN_EXPIRADO. No hay token vencido que recuperar.
    expect(
      debeIntentarRefresh({
        status: 401,
        code: undefined,
        url: "/auth/me",
        yaReintentado: false,
      }),
    ).toBe(false);
  });

  it("renueva /auth/me cuando el backend confirma que el token expiró", () => {
    expect(
      debeIntentarRefresh({
        status: 401,
        code: "TOKEN_EXPIRADO",
        url: "/auth/me",
        yaReintentado: false,
      }),
    ).toBe(true);
  });

  it("NO renueva si la petición ya se reintentó una vez", () => {
    // Sin este freno, un token que sigue vencido después del refresh entra en
    // un ciclo de reintentos dentro de una misma petición.
    expect(
      debeIntentarRefresh({
        status: 401,
        code: "TOKEN_EXPIRADO",
        url: "/clientes",
        yaReintentado: true,
      }),
    ).toBe(false);
  });

  it("NO renueva en las rutas de autenticación", () => {
    for (const url of ["/auth/login", "/auth/refresh", "/auth/registro"]) {
      expect(
        debeIntentarRefresh({
          status: 401,
          code: "TOKEN_EXPIRADO",
          url,
          yaReintentado: false,
        }),
      ).toBe(false);
    }
  });

  it("ignora los errores que no son 401", () => {
    for (const status of [400, 403, 404, 409, 500, 503]) {
      expect(
        debeIntentarRefresh({
          status,
          code: "TOKEN_EXPIRADO",
          url: "/clientes",
          yaReintentado: false,
        }),
      ).toBe(false);
    }
  });
});

describe("debeRecargarPagina", () => {
  it("nunca recarga, en ningún caso", () => {
    // Recargar la página era el paso 6 del bucle. La regla queda escrita como
    // función para que sea explícita y quede cubierta por un test, en vez de
    // ser un window.location.assign() suelto que alguien puede reponer.
    const casos = [
      { status: 401, code: "TOKEN_EXPIRADO", url: "/clientes", yaReintentado: false },
      { status: 401, code: undefined, url: "/auth/me", yaReintentado: false },
      { status: 401, code: "TOKEN_EXPIRADO", url: "/clientes", yaReintentado: true },
      { status: 500, code: undefined, url: "/clientes", yaReintentado: false },
    ];

    for (const caso of casos) {
      expect(debeRecargarPagina(caso)).toBe(false);
    }
  });
});

describe("esSesionTerminada", () => {
  it("cierra la sesión cuando el servidor rechaza el refresh (401/403)", () => {
    expect(
      esSesionTerminada(new ApiError("Sesión expirada", 401, "REFRESH_EXPIRADO")),
    ).toBe(true);
    expect(
      esSesionTerminada(new ApiError("Cuenta inactiva", 403, "CUENTA_INACTIVA")),
    ).toBe(true);
  });

  it("NO cierra la sesión por un corte de red o un error del servidor", () => {
    // Expulsar al usuario porque el wifi falló al volver a la pestaña es
    // justamente el síntoma que se está corrigiendo.
    expect(
      esSesionTerminada(new ApiError("Sin conexión", 503, "SIN_CONEXION")),
    ).toBe(false);
    expect(esSesionTerminada(new ApiError("Error interno", 500))).toBe(false);
    expect(esSesionTerminada(new Error("boom"))).toBe(false);
    expect(esSesionTerminada(undefined)).toBe(false);
  });

  it("reconoce el error crudo de axios con status 401", () => {
    expect(esSesionTerminada({ response: { status: 401 } })).toBe(true);
  });
});

describe("api — configuración", () => {
  it("expone el cliente HTTP con baseURL y credenciales", () => {
    expect(api.defaults.baseURL).toBeDefined();
    // Sin withCredentials, el navegador no manda la cookie de sesión y el
    // login "funciona" pero cada petición vuelve a dar 401.
    expect(api.defaults.withCredentials).toBe(true);
  });

  it("expone los verbos HTTP", () => {
    for (const verbo of ["get", "post", "patch", "put", "delete"] as const) {
      expect(typeof http[verbo]).toBe("function");
    }
  });

  it("acepta configurar los callbacks de sesión sin romper", () => {
    expect(() => {
      configurarCallbacksAuth({
        alRenovar: () => undefined,
        alCerrar: () => undefined,
      });
    }).not.toThrow();
  });
});

describe("ApiError — manejo de errores de unicidad", () => {
  it("mapea conflicto de código a campo 'codigo'", () => {
    const error = new ApiError("Ya existe un producto con el código MED-001.", 409, "CONFLICTO_UNICIDAD", {
      codigo: ["Ya existe un producto con el código MED-001."],
    });
    expect(error.errorDeCampo("codigo")).toBe("Ya existe un producto con el código MED-001.");
    expect(error.errorDeCampo("codigoBarras")).toBeUndefined();
  });

  it("mapea conflicto de código de barras a campo 'codigoBarras'", () => {
    const error = new ApiError("Ya existe un producto con el código de barras 7891234567890.", 409, "CONFLICTO_UNICIDAD", {
      codigoBarras: ["Ya existe un producto con el código de barras 7891234567890."],
    });
    expect(error.errorDeCampo("codigoBarras")).toBe("Ya existe un producto con el código de barras 7891234567890.");
    expect(error.errorDeCampo("codigo")).toBeUndefined();
  });

  it("devuelve undefined para campo sin error", () => {
    const error = new ApiError("Error genérico", 400, "ERROR_GENERICO", {
      nombre: ["El nombre es requerido"],
    });
    expect(error.errorDeCampo("nombre")).toBe("El nombre es requerido");
    expect(error.errorDeCampo("codigo")).toBeUndefined();
  });
});