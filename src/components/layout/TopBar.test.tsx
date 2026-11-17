import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TopBar } from "@/components/layout/TopBar";
import { renderConChakra } from "@/test/utils";

/**
 * La barra superior.
 *
 * El foco está en el botón de navegación: es el único camino al menú cuando el
 * sidebar está oculto tras el drawer y, en escritorio, el control para
 * plegarlo. Tiene que poder anunciar su estado y no parecer un adorno suelto.
 */

const navegar = vi.fn();

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: "/" }),
  useNavigate: () => navegar,
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ usuario: null, puede: () => true }),
}));

vi.mock("@/features/auth/salida.store", () => ({
  useSalida: () => ({ cerrando: false, solicitar: vi.fn() }),
}));

// La campanita consulta la API. Se simula la bandeja vacía: lo que este archivo
// prueba es la barra y sus controles de navegación, no las notificaciones.
vi.mock("@/features/notificaciones/notificaciones.service", () => ({
  useNotificaciones: () => ({
    data: { items: [], noLeidas: 0 },
    isLoading: false,
    isError: false,
  }),
  useMarcarNotificacionLeida: () => ({ mutate: vi.fn() }),
  useMarcarTodasLeidas: () => ({ mutate: vi.fn(), isPending: false }),
}));

/** Props mínimas: cada test sólo cambia lo que le interesa. */
function propsBarra(extra: Partial<Parameters<typeof TopBar>[0]> = {}) {
  return {
    onAbrirMenu: vi.fn(),
    menuAbierto: false,
    colapsada: false,
    onToggleColapsar: vi.fn(),
    ...extra,
  };
}

describe("TopBar · botón de menú", () => {
  it("anuncia si el menú está abierto", () => {
    const { rerender } = renderConChakra(<TopBar {...propsBarra()} />);

    const boton = screen.getByRole("button", { name: "Abrir menú" });

    expect(boton).toHaveAttribute("aria-expanded", "false");

    rerender(<TopBar {...propsBarra({ menuAbierto: true })} />);

    // Sin esto, un lector de pantalla no puede distinguir "cerrado" de
    // "todavía no sé", que es la misma información para quien no ve.
    expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("apunta al panel que abre", () => {
    renderConChakra(<TopBar {...propsBarra()} />);

    expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveAttribute(
      "aria-controls",
      "menu-lateral",
    );
  });

  it("abre el menú al pulsarlo", async () => {
    const usuario = userEvent.setup();
    const alAbrir = vi.fn();

    renderConChakra(<TopBar {...propsBarra({ onAbrirMenu: alAbrir })} />);

    await usuario.click(screen.getByRole("button", { name: "Abrir menú" }));

    expect(alAbrir).toHaveBeenCalledTimes(1);
  });

  it("pliega el sidebar de escritorio desde la barra", async () => {
    const usuario = userEvent.setup();
    const alAlternar = vi.fn();

    renderConChakra(<TopBar {...propsBarra({ onToggleColapsar: alAlternar })} />);

    // Se busca por `aria-label` y no por rol: en jsdom no corren las media
    // queries de Chakra, así que el botón de escritorio conserva el
    // `display: none` de la base y el rol lo excluye del árbol accesible.
    const boton = screen.getByLabelText("Contraer menú");

    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(boton).toHaveAttribute("aria-controls", "navegacion-lateral");

    await usuario.click(boton);

    expect(alAlternar).toHaveBeenCalledTimes(1);
  });

  it("cuando el sidebar está plegado ofrece expandirlo", () => {
    renderConChakra(<TopBar {...propsBarra({ colapsada: true })} />);

    expect(screen.getByLabelText("Expandir menú")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("muestra el título de la sección dentro de la barra", () => {
    renderConChakra(<TopBar {...propsBarra()} />);

    // Se acota al `header` porque "Inicio" es también el nombre de una sección
    // del menú lateral, y lo que interesa comprobar es el rótulo de la barra.
    const barra = screen.getByRole("banner");

    expect(within(barra).getByText("Inicio")).toBeInTheDocument();
  });
});
