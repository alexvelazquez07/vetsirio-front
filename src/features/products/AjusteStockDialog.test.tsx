import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderConChakra } from "@/test/utils";
import type { Producto } from "@/types/dominio";
import { AjusteStockDialog } from "./AjusteStockDialog";

const producto = {
  id: 12,
  nombre: "Amoxicilina 250 mg",
  stockActual: 8,
  unidadMedida: "frasco",
} as unknown as Producto;

function montar() {
  const onAjustar = vi.fn();

  renderConChakra(
    <AjusteStockDialog
      abierto
      producto={producto}
      onClose={vi.fn()}
      onAjustar={onAjustar}
      guardando={false}
    />,
  );

  return { onAjustar };
}

describe("AjusteStockDialog", () => {
  it("acepta una cantidad entera como 1", async () => {
    const usuario = userEvent.setup();
    const { onAjustar } = montar();

    const cantidad = screen.getByLabelText(/^Cantidad/i);
    await usuario.clear(cantidad);
    await usuario.type(cantidad, "1");
    await usuario.click(
      screen.getByRole("button", { name: "Registrar movimiento" }),
    );

    expect(onAjustar).toHaveBeenCalledWith({
      tipo: "entrada",
      cantidad: 1,
      observacion: undefined,
    });
  });

  it("rechaza cantidades negativas", async () => {
    const usuario = userEvent.setup();
    const { onAjustar } = montar();

    const cantidad = screen.getByLabelText(/^Cantidad/i);
    await usuario.clear(cantidad);
    await usuario.type(cantidad, "-2");
    await usuario.click(
      screen.getByRole("button", { name: "Registrar movimiento" }),
    );

    expect(onAjustar).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ingresá una cantidad mayor a cero.",
    );
  });
});
