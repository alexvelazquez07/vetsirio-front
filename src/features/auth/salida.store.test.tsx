import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { CapaSalida } from "@/components/auth/CapaSalida";
import { ProveedorSalida, useSalida } from "@/features/auth/salida.store";
import { renderConChakra } from "@/test/utils";

/**
 * La salida de sesión animada.
 *
 * El comportamiento no obvio está en el tiempo, así que la mayoría de los tests
 * manejan relojes falsos. Lo que se verifica:
 *
 *  · La capa aparece aunque `logout()` todavía no haya resuelto.
 *  · El estado local NO se limpia hasta que la animación terminó. Este es el
 *    punto que más fácil se rompe: al vaciarse el caché, <RutaPrivada> manda
 *    al login de inmediato y toda la animación se pierde por el camino.
 *  · Siempre se sale: si la petición no termina nunca, el tope la libera.
 *  · Dos clics seguidos no disparan dos salidas.
 */

const logout = vi.fn(() => Promise.resolve());
const limpiarSesion = vi.fn();
const navegar = vi.fn();

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ logout, limpiarSesion }),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const real = await importOriginal<typeof import("react-router-dom")>();

  return { ...real, useNavigate: () => navegar };
});

/** Botón que dispara la salida, para probar el hook desde un hijo real. */
function Disparador() {
  const { solicitar, cerrando } = useSalida();

  return (
    <button type="button" onClick={solicitar}>
      {cerrando ? "Cerrando" : "Salir"}
    </button>
  );
}

const montar = () =>
  renderConChakra(
    <ProveedorSalida>
      <Disparador />
    </ProveedorSalida>,
    { conRouter: true },
  );

beforeEach(() => {
  vi.clearAllMocks();
  logout.mockResolvedValue(undefined);
});

describe("ProveedorSalida", () => {
  it("no muestra la capa hasta que se pide la salida", () => {
    montar();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salir" })).toBeInTheDocument();
  });

  it("muestra la capa en cuanto se pide la salida", async () => {
    montar();

    await act(async () => {
      screen.getByRole("button", { name: "Salir" }).click();
    });

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("anuncia el cierre por pantalla", async () => {
    montar();

    await act(async () => {
      screen.getByRole("button", { name: "Salir" }).click();
    });

    // Sin aria-live, un silencio es indistinguible de un cuelgue para quien no
    // ve la pantalla.
    const capa = screen.getByRole("status");

    expect(capa).toHaveAttribute("aria-live", "polite");
    expect(capa).toHaveAttribute("aria-label", "Cerrando sesión");
  });

  it("no limpia el estado local mientras la animación corre", async () => {
    vi.useFakeTimers();

    montar();

    await act(async () => {
      screen.getByRole("button", { name: "Salir" }).click();
    });

    // El logout ya resolvió. Si el caché se borrara acá, <RutaPrivada>
    // redirigía al login en el acto y la cortina se perdía. Es el bug que hizo
    // que la animación no se viera.
    expect(limpiarSesion).not.toHaveBeenCalled();
    expect(navegar).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(4_999);
    });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(limpiarSesion).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("limpia y navega recién al terminar el mínimo", async () => {
    vi.useFakeTimers();

    montar();

    await act(async () => {
      screen.getByRole("button", { name: "Salir" }).click();
    });

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(limpiarSesion).toHaveBeenCalledTimes(1);
    expect(navegar).toHaveBeenCalledWith("/login", { replace: true });

    vi.useRealTimers();
  });

  it("limpia antes de navegar, para que no haya un cuadro vacío de por medio", async () => {
    vi.useFakeTimers();

    const orden: string[] = [];

    limpiarSesion.mockImplementation(() => {
      orden.push("limpiar");
    });
    navegar.mockImplementation(() => {
      orden.push("navegar");
    });

    montar();

    await act(async () => {
      screen.getByRole("button", { name: "Salir" }).click();
      vi.advanceTimersByTime(5_000);
    });

    // Si se navegara primero, habría un instante con el caché vacío y todavía
    // en el panel, y el login aparecería con un parpadeo.
    expect(orden).toEqual(["limpiar", "navegar"]);

    vi.useRealTimers();
  });

  it("ignora clics repetidos sobre una salida en curso", async () => {
    vi.useFakeTimers();

    montar();

    await act(async () => {
      const boton = screen.getByRole("button", { name: "Salir" });
      boton.click();
      boton.click();
      boton.click();
    });

    // Tres clics, una sola salida. Con más de una, la segunda borraría el caché
    // que la primera está a punto de dejar limpio y las dos navegarían.
    expect(logout).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(navegar).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("se libera aunque el backend nunca responda", async () => {
    vi.useFakeTimers();

    logout.mockReturnValue(new Promise(() => {}));

    montar();

    await act(async () => {
      screen.getByRole("button", { name: "Salir" }).click();
    });

    expect(screen.getByRole("status")).toBeInTheDocument();

    // El tope está por encima del timeout del cliente HTTP (15 s) para no
    // cortar antes de que él mismo expire, y muy por debajo del tiempo en que
    // alguien abandona la pestaña.
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });

    expect(limpiarSesion).toHaveBeenCalledTimes(1);
    expect(navegar).toHaveBeenCalledWith("/login", { replace: true });

    vi.useRealTimers();
  });

  it("destapa la pantalla si la navegación no desmonta la app", async () => {
    vi.useFakeTimers();

    logout.mockReturnValue(new Promise(() => {}));

    montar();

    await act(async () => {
      screen.getByRole("button", { name: "Salir" }).click();
    });

    await act(async () => {
      vi.advanceTimersByTime(24_000);
    });

    // Una capa que no responde a nada deja la aplicación inutilizable; el
    // último recurso es destaparla.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("falla si se usa fuera del proveedor", () => {
    const original = console.error;
    console.error = () => {};

    expect(() => renderConChakra(<Disparador />)).toThrow(/ProveedorSalida/);

    console.error = original;
  });
});

describe("CapaSalida", () => {
  it("empieza diciendo qué está cerrando", () => {
    renderConChakra(<CapaSalida />);

    expect(screen.getByText("Revocando tu sesión")).toBeInTheDocument();
  });

  it("avanza los mensajes para que la espera tenga sentido", async () => {
    vi.useFakeTimers();

    renderConChakra(<CapaSalida />);

    expect(screen.getByText("Revocando tu sesión")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1_500);
    });

    expect(screen.getByText("Limpiando este dispositivo")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1_500);
    });

    expect(screen.getByText("Volviendo al inicio")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("no se queda con un paso que ya pasó si se alarga", async () => {
    vi.useFakeTimers();

    renderConChakra(<CapaSalida />);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    // El texto sigue siendo cierto en lugar de mostrar un paso caducado.
    expect(screen.getByText("Volviendo al inicio")).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("queda por encima de la barra superior y el sidebar", () => {
    const { container } = renderConChakra(<CapaSalida />);

    const capa = container.firstElementChild as HTMLElement;

    // Con un z-index inválido la propiedad queda en `auto` y la barra
    // superior (sticky) se dibuja encima: se ve una franja blanca arriba.
    expect(capa.className).not.toMatch(/z-index:\s*(auto|0)\s*;/);
    expect(capa).toHaveStyle({ position: "fixed" });
  });

  it("deja la huella centrada: el elemento animado no lleva transform", () => {
    const { container } = renderConChakra(<CapaSalida />);

    // El bug era `translate(-50%, -50%)` dentro de los keyframes de
    // `vetsirio-latido`: funciona con la huella absoluta del login, pero en un
    // ítem de flex normal lo correa media altura hacia arriba y se ve
    // descentrada. Acá la huella no está posicionada en absoluto, así que
    // cualquier transform en el elemento animado sería un error de centrado.
    const animados = Array.from(
      container.querySelectorAll<HTMLElement>("[style*='vetsirio-latido']"),
    );

    expect(animados).toHaveLength(1);

    const [huella] = animados;

    expect(huella.style.transform).toBe("");
    expect(huella.style.top).toBe("");
    expect(huella.style.left).toBe("");

    // Y es un ítem del flujo, no algo flotando: eso es lo que lo centra.
    expect(huella.closest("[style*='vetsirio-cortina']")).toBeNull();
  });
});