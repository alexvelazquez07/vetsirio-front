import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormDialog } from "@/components/data/FormDialog";
import { ProveedorForm } from "@/features/suppliers/ProveedorForm";
import { renderConChakra } from "@/test/utils";
import type { Proveedor } from "@/types/dominio";

const onGuardar = vi.fn();

function montar(proveedor?: Proveedor) {
  return renderConChakra(
    <FormDialog
      abierto
      onClose={vi.fn()}
      titulo="Nuevo proveedor"
      textoConfirmar="Registrar"
      onConfirmar={() => {
        document
          .querySelector<HTMLFormElement>("#proveedor-form")
          ?.requestSubmit();
      }}
    >
      <ProveedorForm proveedor={proveedor} onGuardar={onGuardar} />
    </FormDialog>,
    { conQuery: true, conRouter: true },
  );
}

async function llenar(etiqueta: RegExp, valor: string) {
  const usuario = userEvent.setup();
  const campo = screen.getByLabelText(etiqueta);

  await usuario.clear(campo);
  await usuario.type(campo, valor);
}

describe("ProveedorForm", () => {
  beforeEach(() => onGuardar.mockClear());

  it("muestra los datos fiscales y comerciales obligatorios", () => {
    montar();

    expect(screen.getByLabelText(/^ruc/i)).toBeRequired();
    expect(screen.getByLabelText(/^razón social/i)).toBeRequired();
    expect(screen.getByText("Contacto")).toBeInTheDocument();
    expect(screen.getByText("Domicilio")).toBeInTheDocument();
  });

  it("evita registrar sin RUC y razón social", async () => {
    const usuario = userEvent.setup();

    montar();
    await usuario.click(screen.getByRole("button", { name: "Registrar" }));

    expect(await screen.findByText("El RUC es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("La razón social es obligatoria")).toBeInTheDocument();
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it("muestra el detalle de validación devuelto por el backend", () => {
    renderConChakra(
      <ProveedorForm
        onGuardar={onGuardar}
        errorGeneral="Los datos enviados no son válidos."
        erroresServidor={{ documento: "Ingresá un RUC válido" }}
        detallesServidor={["El RUC debe tener entre 8 y 11 dígitos"]}
      />,
      { conQuery: true, conRouter: true },
    );

    expect(
      screen.getByText("Los datos enviados no son válidos."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("El RUC debe tener entre 8 y 11 dígitos"),
    ).toBeInTheDocument();
  });

  it("registra el RUC normalizado y la razón social sin espacios laterales", async () => {
    const usuario = userEvent.setup();

    montar();
    await llenar(/^ruc/i, "8001234-5");
    await llenar(/^razón social/i, "  Laboratorios del Sur S.A.  ");
    await usuario.click(screen.getByRole("button", { name: "Registrar" }));

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        documento: "80012345",
        razonSocial: "Laboratorios del Sur S.A.",
        activo: true,
      }),
    );
  });

  it("recupera el RUC con guion al editar aunque la API lo devuelva normalizado", () => {
    montar({
      id: 17,
      documento: "80012345",
      razonSocial: "Laboratorios del Sur S.A.",
      nombreFantasia: null,
      email: null,
      telefono: null,
      direccion: null,
      departamento: null,
      ciudad: null,
      barrio: null,
      contactoNombre: null,
      notas: null,
      activo: true,
    });

    expect(screen.getByLabelText(/^ruc/i)).toHaveValue("8001234-5");
  });

  it("permite registrar el proveedor como inactivo", async () => {
    const usuario = userEvent.setup();

    montar();
    await llenar(/^ruc/i, "80012345");
    await llenar(/^razón social/i, "Laboratorios del Sur S.A.");
    await usuario.click(screen.getByRole("button", { name: "Inactivo" }));
    await usuario.click(screen.getByRole("button", { name: "Registrar" }));

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ activo: false }),
    );
  });

  it("usa controles de entrada del mismo tamaño y estilo que Clientes", () => {
    montar();

    expect(screen.getByLabelText(/^ruc/i)).toHaveStyle({
      height: "var(--chakra-sizes-10)",
      width: "var(--chakra-sizes-full)",
    });
    expect(screen.getByLabelText(/^notas internas/i)).toHaveAttribute("rows", "3");
  });

  it("presenta un solo conjunto de acciones para guardar o cancelar", () => {
    montar();

    expect(screen.getAllByRole("button", { name: "Registrar" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Cancelar" })).toHaveLength(1);
  });
});
