import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormDialog } from "@/components/data/FormDialog";
import { renderConChakra } from "@/test/utils";
import type { Servicio } from "@/types/dominio";
import { ServicioForm } from "./ServicioForm";

const onGuardar = vi.fn();

const categorias = [
  { id: 1, nombre: "Consultas", color: null, icono: null },
  { id: 2, nombre: "Estética", color: null, icono: null },
];

function montar(servicio?: Servicio) {
  return renderConChakra(
    <FormDialog
      abierto
      onClose={vi.fn()}
      titulo={servicio ? "Editar servicio" : "Nuevo servicio"}
      textoConfirmar={servicio ? "Guardar cambios" : "Registrar"}
      onConfirmar={() => {
        document
          .querySelector<HTMLFormElement>("#servicio-form")
          ?.requestSubmit();
      }}
    >
      <ServicioForm
        servicio={servicio}
        categorias={categorias}
        onGuardar={onGuardar}
      />
    </FormDialog>,
    { conQuery: true, conRouter: true },
  );
}

const servicio = {
  id: 5,
  codigo: "SER-0001",
  nombre: "Consulta general",
  descripcion: "Revisión clínica completa",
  precio: "150000",
  duracionMin: 30,
  consumeInsumos: false,
  requiereVeterinario: true,
  precioPersonalizado: true,
  activo: true,
  categoria: { id: 1, nombre: "Consultas", color: null, icono: null },
} as Servicio;

describe("ServicioForm", () => {
  beforeEach(() => onGuardar.mockClear());

  it("muestra los campos esenciales del servicio", () => {
    montar();

    expect(screen.getByLabelText(/^nombre/i)).toBeRequired();
    expect(screen.getByLabelText(/^precio/i)).toBeInTheDocument();
    expect(screen.getByText("Consume insumos")).toBeInTheDocument();
    expect(screen.getByText("Requiere veterinario")).toBeInTheDocument();
    expect(screen.getByText("Precio personalizado")).toBeInTheDocument();
  });

  it("evita registrar sin nombre ni precio válidos", async () => {
    const usuario = userEvent.setup();

    montar();
    await usuario.click(screen.getByRole("button", { name: "Registrar" }));

    expect(
      await screen.findByText("Ingresá un nombre de al menos 2 letras."),
    ).toBeInTheDocument();
    expect(screen.getByText("Ingresá un precio válido.")).toBeInTheDocument();
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it("registra el servicio con los valores ingresados", async () => {
    const usuario = userEvent.setup();

    montar();
    await usuario.type(screen.getByLabelText(/^nombre/i), "Baño medicado");
    await usuario.type(screen.getByLabelText(/^precio/i), "85000");
    await usuario.click(screen.getByRole("button", { name: "Registrar" }));

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: "Baño medicado",
        precio: 85000,
        duracionMin: 30,
        activo: true,
      }),
    );
  });

  it("carga los datos al editar", () => {
    montar(servicio);

    expect(screen.getByLabelText(/^nombre/i)).toHaveValue("Consulta general");
    expect(screen.getByLabelText(/^precio/i)).toHaveValue("150.000");
    expect(screen.getByLabelText(/^código/i)).toHaveValue("SER-0001");
  });
});
