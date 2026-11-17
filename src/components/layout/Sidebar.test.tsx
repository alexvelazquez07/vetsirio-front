import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/components/layout/Sidebar";
import { renderConChakra } from "@/test/utils";

/**
 * El acordeón del menú lateral.
 *
 * La regla que importa: al entrar no se despliega todo. Sólo el grupo de la
 * pantalla actual queda abierto y el resto responde al clic de la persona.
 *
 * Se comprueba con `aria-expanded` y no con la visibilidad del contenido: en
 * jsdom no corren las animaciones de colapso de Ark, así que el panel queda
 * oculto aunque el estado sea "abierto". El atributo del disparador es el que
 * refleja lo que ve la persona en el navegador.
 */

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({
    usuario: { rol: { nombre: "admin" } },
    veterinaria: { nombreComercial: "Veterinaria Test", logoUrl: null },
    puede: () => true,
  }),
}));

vi.mock("@/services/api", () => ({
  urlDeArchivo: (ruta: string) => ruta,
}));

describe("Sidebar · acordeón de grupos", () => {
  it("arranca abierto sólo el grupo de la pantalla actual", () => {
    renderConChakra(<Sidebar colapsada={false} />, { conRouter: true, ruta: "/clientes" });

    expect(screen.getByRole("button", { name: "Atención al cliente" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "General" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("despliega y pliega un grupo con un clic", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<Sidebar colapsada={false} />, { conRouter: true, ruta: "/" });

    const clinico = screen.getByRole("button", { name: "Clínico" });

    expect(clinico).toHaveAttribute("aria-expanded", "false");

    await usuario.click(clinico);

    expect(clinico).toHaveAttribute("aria-expanded", "true");

    await usuario.click(clinico);

    expect(clinico).toHaveAttribute("aria-expanded", "false");
  });
});

describe("Sidebar · riel plegado", () => {
  it("muestra un ícono por grupo, no uno por módulo", () => {
    renderConChakra(<Sidebar colapsada />, { conRouter: true, ruta: "/clientes" });

    expect(screen.getByRole("button", { name: "Atención al cliente" })).toBeInTheDocument();

    // "Clientes" es un módulo, no un grupo: en el riel no tiene ícono propio.
    expect(screen.queryByRole("button", { name: "Clientes" })).not.toBeInTheDocument();
  });

  it("despliega los módulos del grupo al pasar el mouse", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<Sidebar colapsada />, { conRouter: true, ruta: "/clientes" });

    const grupo = screen.getByRole("button", { name: "Atención al cliente" });

    expect(grupo).toHaveAttribute("aria-expanded", "false");

    await usuario.hover(grupo);

    expect(await screen.findByRole("link", { name: "Clientes" })).toBeVisible();
    expect(grupo).toHaveAttribute("aria-expanded", "true");
  });

  it("abre el panel con el teclado y enfoca el primer módulo", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<Sidebar colapsada />, { conRouter: true, ruta: "/" });

    screen.getByRole("button", { name: "General" }).focus();

    expect(await screen.findByRole("link", { name: "Inicio" })).toBeVisible();

    await usuario.keyboard("{Enter}");

    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Inicio" })).toHaveFocus(),
    );
  });

  it("al hacer clic con el mouse no roba el foco al botón", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<Sidebar colapsada />, { conRouter: true, ruta: "/" });

    const grupo = screen.getByRole("button", { name: "General" });

    await usuario.click(grupo);

    // El panel se abre, pero el foco se queda donde la persona lo dejó: si
    // saltara al primer módulo, un clic accidental cambiaría de pantalla.
    expect(await screen.findByRole("link", { name: "Inicio" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveFocus();
  });

  it("mantiene el panel abierto si el foco sigue adentro", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<Sidebar colapsada />, { conRouter: true, ruta: "/" });

    const grupo = screen.getByRole("button", { name: "General" });

    grupo.focus();
    await usuario.keyboard("{Enter}");

    const inicio = await screen.findByRole("link", { name: "Inicio" });
    await waitFor(() => expect(inicio).toHaveFocus());

    // El mouse se va del grupo, pero el teclado está en el panel: cerrarlo
    // dejaría el foco huérfano y cortaría la navegación por teclado.
    await usuario.unhover(grupo);

    // Se espera más que la demora de cierre para distinguir "sigue abierto"
    // de "todavía no se cerró".
    await new Promise((resolver) => setTimeout(resolver, 250));

    expect(screen.getByRole("link", { name: "Inicio" })).toBeVisible();
  });
});
