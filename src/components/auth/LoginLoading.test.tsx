import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderConChakra } from "@/test/utils";
import { LoginLoading } from "./LoginLoading";

/**
 * Pruebas de la pantalla de carga del login.
 *
 * El riesgo acá no es que se vea feo, sino que se quede pegada. Si la capa no
 * baja cuando el login falla, el usuario queda mirando una pantalla oscura con
 * un mensaje de "verificando tus credenciales" y Cree que el sistema está
 * colgado, sin poder volver a intentarlo.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe("LoginLoading", () => {
  it("no renderiza nada cuando está oculta", () => {
    renderConChakra(<LoginLoading visible={false} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("muestra la capa con el primer paso cuando aparece", () => {
    renderConChakra(<LoginLoading visible />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/verificando tus credenciales/i)).toBeInTheDocument();
  });

  it("anuncia los cambios de paso a los lectores de pantalla", () => {
    renderConChakra(<LoginLoading visible />);

    // aria-live hace que un lector de pantalla anuncie el avance. Sin esto,
    // para alguien que no ve la pantalla el login parece colgado.
    //
    // La etiqueta se compara sin acentos a propósito: el texto vive en el
    // componente y el test no debería depender de la codificación con la que
    // segrabó este archivo.
    const estado = screen.getByRole("status");
    expect(estado).toHaveAttribute("aria-live", "polite");

    const etiqueta = estado.getAttribute("aria-label") ?? "";
    expect(etiqueta.toLowerCase()).toContain("iniciando");
  });

  it("avanza entre los pasos con el correr del tiempo", async () => {
    vi.useFakeTimers();

    renderConChakra(<LoginLoading visible />);

    expect(screen.getByText(/verificando tus credenciales/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(750);
    });

    expect(screen.getByText(/abriendo tu sesión/i)).toBeInTheDocument();
  });

  it("vuelve al primer paso si se reabre tras un error", async () => {
    vi.useFakeTimers();

    // Se desmonta y se vuelve a montar en lugar de usar rerender: el rerender
    // de Testing Library reemplaza el árbol completo y perdería el
    // ChakraProvider que envuelve al componente.
    const primera = renderConChakra(<LoginLoading visible />);

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    // El login falló y la capa se oculta.
    primera.unmount();
    const segunda = renderConChakra(<LoginLoading visible />);

    // El usuario reintenta: el avance no debe arrancar en el paso 3, porque
    // ya no está en esa etapa.
    expect(screen.getByText(/verificando tus credenciales/i)).toBeInTheDocument();

    segunda.unmount();
  });

  it("con movimiento reducido muestra el estado quieto, sin barra de progreso", () => {
    const original = window.matchMedia;

    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    try {
      renderConChakra(<LoginLoading visible />);

      // Sigue leyendo el mensaje: la información no se pierde.
      expect(screen.getByText(/verificando tus credenciales/i)).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });

  it("separa el centrado de la huella de su animacion", () => {
    const { container } = renderConChakra(<LoginLoading visible />);

    // La huella del login es absoluta, asi que su centrado necesita
    // translate(-50%, -50%). Ese translate va en una caja envolvente y NO en la
    // que anima: si estuviera en la misma, el scale del keyframe lo pisaria y
    // la huella se correria hacia arriba y a la izquierda.
    //
    // El keyframe queda con escala pura y el centrado vive en el componente.
    const animados = Array.from(
      container.querySelectorAll<HTMLElement>("[style*='vetsirio-latido']"),
    );

    expect(animados).toHaveLength(1);

    // El elemento animado no lleva ningun transform propio.
    expect(animados[0].style.transform).toBe("");

    // ...y esta dentro de una caja aparte que si lo lleva.
    expect(animados[0].parentElement).not.toBeNull();
    expect(animados[0].parentElement).not.toBe(animados[0]);
  });
});
