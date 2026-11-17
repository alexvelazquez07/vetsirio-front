import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificacionesMenu } from "@/components/layout/NotificacionesMenu";
import { renderConChakra } from "@/test/utils";

/**
 * La campanita.
 *
 * Lo que interesa verificar es el contrato con la API: que el badge refleje las
 * no leídas, que el panel muestre los avisos y que elegir uno lo marque como
 * leído y navegue. Si esa cadena se rompe, la campanita vuelve a ser un adorno.
 */

const marcarLeida = vi.fn();
const marcarTodas = vi.fn();
const navegar = vi.fn();
const puede = vi.fn((_clave: string) => true);

const NOTIFICACION = {
  id: 7,
  usuarioId: 1,
  tipo: "alerta" as const,
  titulo: "Tu suscripción está por vencer",
  mensaje: "Te quedan 3 días de acceso. Renová para no perder el trabajo del día.",
  url: "/suscripcion",
  leida: false,
  leidaEn: null,
  creadoEn: new Date().toISOString(),
};

const mockNotificaciones = vi.fn(() => ({
  data: { items: [NOTIFICACION], noLeidas: 1 },
  isLoading: false,
  isError: false,
}));

vi.mock("@/features/notificaciones/notificaciones.service", () => ({
  useNotificaciones: () => mockNotificaciones(),
  useMarcarNotificacionLeida: () => ({ mutate: marcarLeida }),
  useMarcarTodasLeidas: () => ({ mutate: marcarTodas, isPending: false }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navegar,
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ puede }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  puede.mockReturnValue(true);
  mockNotificaciones.mockReturnValue({
    data: { items: [NOTIFICACION], noLeidas: 1 },
    isLoading: false,
    isError: false,
  });
});

describe("NotificacionesMenu", () => {
  it("muestra el contador de no leídas en el disparador", () => {
    renderConChakra(<NotificacionesMenu />);

    expect(
      screen.getByRole("button", { name: "Notificaciones, 1 sin leer" }),
    ).toBeInTheDocument();
  });

  it("no muestra badge cuando no hay pendientes", () => {
    mockNotificaciones.mockReturnValue({
      data: { items: [], noLeidas: 0 },
      isLoading: false,
      isError: false,
    });

    renderConChakra(<NotificacionesMenu />);

    expect(
      screen.getByRole("button", { name: "Notificaciones" }),
    ).toBeInTheDocument();
  });

  it("abre el panel con el aviso y su mensaje", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<NotificacionesMenu />);

    await usuario.click(
      screen.getByRole("button", { name: "Notificaciones, 1 sin leer" }),
    );

    expect(screen.getByText("Tu suscripción está por vencer")).toBeInTheDocument();
    expect(screen.getByText(/te quedan 3 días/i)).toBeInTheDocument();
  });

  it("marca como leída y navega al elegir un aviso con ruta", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<NotificacionesMenu />);

    await usuario.click(
      screen.getByRole("button", { name: "Notificaciones, 1 sin leer" }),
    );
    await usuario.click(screen.getByText("Tu suscripción está por vencer"));

    expect(marcarLeida).toHaveBeenCalledWith(7);
    expect(navegar).toHaveBeenCalledWith("/suscripcion");
  });

  it("ofrece vaciar el contador de una vez", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<NotificacionesMenu />);

    await usuario.click(
      screen.getByRole("button", { name: "Notificaciones, 1 sin leer" }),
    );
    await usuario.click(screen.getByRole("button", { name: /marcar todas/i }));

    expect(marcarTodas).toHaveBeenCalledTimes(1);
  });

  it("resuelve enlaces viejos que apuntaban a /dashboard", async () => {
    mockNotificaciones.mockReturnValue({
      data: {
        items: [
          {
            ...NOTIFICACION,
            id: 9,
            titulo: "¡Bienvenido a VetSirio!",
            url: "/dashboard",
          },
        ],
        noLeidas: 1,
      },
      isLoading: false,
      isError: false,
    });

    const usuario = userEvent.setup();

    renderConChakra(<NotificacionesMenu />);

    await usuario.click(
      screen.getByRole("button", { name: "Notificaciones, 1 sin leer" }),
    );
    await usuario.click(screen.getByText("¡Bienvenido a VetSirio!"));

    // El dashboard vive en "/": el enlace guardado ya no debe llevar al 404.
    expect(navegar).toHaveBeenCalledWith("/");
  });

  it("no navega a una sección para la que el rol no tiene permiso", async () => {
    puede.mockReturnValue(false);

    const usuario = userEvent.setup();

    renderConChakra(<NotificacionesMenu />);

    await usuario.click(
      screen.getByRole("button", { name: "Notificaciones, 1 sin leer" }),
    );
    await usuario.click(screen.getByText("Tu suscripción está por vencer"));

    expect(puede).toHaveBeenCalledWith("suscripcion.ver");
    expect(navegar).not.toHaveBeenCalled();
  });

  it("no navega si el aviso apunta a una pantalla que ya no existe", async () => {
    mockNotificaciones.mockReturnValue({
      data: {
        items: [{ ...NOTIFICACION, id: 10, url: "/pantalla-inexistente" }],
        noLeidas: 1,
      },
      isLoading: false,
      isError: false,
    });

    const usuario = userEvent.setup();

    renderConChakra(<NotificacionesMenu />);

    await usuario.click(
      screen.getByRole("button", { name: "Notificaciones, 1 sin leer" }),
    );
    await usuario.click(screen.getByText("Tu suscripción está por vencer"));

    expect(navegar).not.toHaveBeenCalled();
  });

  it("explica que no hay nada pendiente cuando la bandeja está vacía", async () => {
    mockNotificaciones.mockReturnValue({
      data: { items: [], noLeidas: 0 },
      isLoading: false,
      isError: false,
    });

    const usuario = userEvent.setup();

    renderConChakra(<NotificacionesMenu />);

    await usuario.click(screen.getByRole("button", { name: "Notificaciones" }));

    expect(screen.getAllByText("Todo al día").length).toBeGreaterThan(0);
  });
});
