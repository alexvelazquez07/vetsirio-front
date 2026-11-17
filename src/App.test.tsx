import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import App from "@/App";

/**
 * Prueba de humo de la aplicación completa.
 *
 * Monta <App /> entero. Existe por una razón muy concreta: esta prueba ya
 * detectó un bug real que el typecheck no podía ver. <ProveedorAuth> usaba
 * useNavigate() pero estaba montado por fuera de <BrowserRouter>, así que la
 * aplicación reventaba en el navegador con un error que sólo aparecía al
 * ejecutar.
 *
 * Un typecheck nunca va a detectar que el orden de los providers está mal,
 * del router son válidos en cualquier parte del árbol para el compilador.
 * Sólo montar el componente lo detecta.
 *
 * El orden de los providers es una dependencia implícita y frágil. Convertirla
 * en una prueba explícita es la única forma de que no vuelva a romperse.
 */
describe("App — montaje general", () => {
  it("se monta sin lanzar errores de providers ni de router", async () => {
    // La pantalla de login pide /auth/me al backend. Sin mockearlo, el test
    // dependería de que la API esté encendida.
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          message: "Tu sesión no está activa.",
          code: "CREDENCIALES_INVALIDAS",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    ) as typeof fetch;

    expect(() => render(<App />)).not.toThrow();

    // Si el árbol de providers quedó mal, la pantalla de login nunca aparece.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /bienvenido de vuelta/i }),
      ).toBeInTheDocument();
    });
  });

  it("muestra el formulario de acceso con correo y contraseña", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: "Sin sesión" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    });

    // Selector exacto: "/contraseña/i" también matchea el enlace
    // "¿Olvidaste tu contraseña?" y la búsqueda devuelve dos elementos.
    expect(screen.getByLabelText("Contraseña", { selector: "input" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^ingresar$/i }),
    ).toBeInTheDocument();
  });

  it("enlaza a registro y recuperación de contraseña", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: "Sin sesión" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/olvidaste tu contraseña/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", { name: /crear cuenta de una veterinaria/i }),
    ).toBeInTheDocument();
  });

  it("muestra el aviso de sesión expirada en el login", async () => {
    window.history.replaceState({}, "", "/login?sesion=expirada");
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: "Sin sesión" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    render(<App />);

    expect(
      await screen.findByText("Tu sesión venció o expiró. Iniciá sesión nuevamente."),
    ).toBeInTheDocument();

    window.history.replaceState({}, "", "/");
  });
});