import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderConChakra } from "@/test/utils";
import { TextoRotativo, useTypewriter } from "./TextoRotativo";

/**
 * Pruebas del texto rotativo.
 *
 * La animación es de las cosas más fáciles de romper sin que se note: si el
 * borrado queda mal enganchado la frase se queda a medias para siempre, o el
 * intervalo se multiplica y la CPU sube sin motivo. Estos tests usan
 * temporizadores falsos para avanzar el reloj y comprobar el ciclo completo sin
 * esperar de verdad.
 */

const FRASES = ["Primera frase", "Segunda frase"];

/** Banco de pruebas que expone el estado del hook en texto plano. */
function Banco() {
  const { texto, completo } = useTypewriter(FRASES);
  return (
    <span data-testid="banco">
      {texto}
      {completo ? "|fin" : ""}
    </span>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useTypewriter", () => {
  it("escribe la primera frase completa con el correr del tiempo", async () => {
    vi.useFakeTimers();

    renderConChakra(<Banco />);

    const banco = screen.getByTestId("banco");
    expect(banco.textContent).not.toContain("|fin");

    // "Primera frase" son 13 caracteres × 62 ms: sobra para completarla.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(banco.textContent).toBe("Primera frase|fin");
  });

  it("no escribe nada si no hay frases", async () => {
    vi.useFakeTimers();

    function BancoVacio() {
      const { texto } = useTypewriter([]);
      return <span data-testid="vacio">{texto}</span>;
    }

    renderConChakra(<BancoVacio />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId("vacio").textContent).toBe("");
  });

  it("respeta prefers-reduced-motion: muestra la frase entera y quieta", async () => {
    vi.useFakeTimers();

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
      renderConChakra(<Banco />);

      // Sin avanzar el reloj, la frase ya debe estar completa y sin cursor.
      expect(screen.getByTestId("banco").textContent).toBe("Primera frase|fin");

      // Ni después de un rato cambia de frase: no hay animación.
      await act(async () => {
        vi.advanceTimersByTime(20000);
      });

      expect(screen.getByTestId("banco").textContent).toBe("Primera frase|fin");
    } finally {
      window.matchMedia = original;
    }
  });
});

describe("TextoRotativo", () => {
  it("reserva espacio para dos líneas durante toda la animación", () => {
    renderConChakra(<TextoRotativo frases={FRASES} />);

    expect(screen.getByText("", { selector: "p" })).toHaveStyle({
      minHeight: "2.4em",
    });
  });

  it("muestra el texto que se está escribiendo", async () => {
    vi.useFakeTimers();

    renderConChakra(<TextoRotativo frases={FRASES} />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // A medio camino la frase todavía está incompleta: sólo se escribió una parte.
    expect(screen.getByText(/primera frase/i)).toBeInTheDocument();
  });
});