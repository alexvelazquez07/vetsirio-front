import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FormDialog } from "@/components/data/FormDialog";
import { ClienteForm } from "@/features/clients/ClienteForm";
import type { Cliente } from "@/types/dominio";
import { renderConChakra } from "@/test/utils";

/**
 * Formulario de cliente.
 *
 * Lo que se fija acá es la decisión de diseño: el formulario **no** pregunta si
 * el cliente es persona natural o empresa. Esa pregunta obligaba a elegir uno de
 * los dos datos, y como hay personas naturales con RUC, terminaba obligando a
 * cargar una razón social inventada para poder guardar. El tipo de documento
 * dice cómo se identifica; el nombre dice quién es.
 *
 * El harness monta el <FormDialog> real en lugar de un stub, porque los
 * botones viven ahí y la prueba de que no estén duplicados sólo es válida si
 * el diálogo está presente.
 */

const onGuardar = vi.fn();

function montar(cliente?: Cliente | null, onClose = vi.fn()) {
  return renderConChakra(
    <FormDialog
      abierto
      onClose={onClose}
      titulo="Nuevo cliente"
      textoConfirmar="Registrar"
      onConfirmar={() => {
        // Igual que en producción.
        document
          .querySelector<HTMLFormElement>("#cliente-form")
          ?.requestSubmit();
      }}
    >
      <ClienteForm cliente={cliente} onGuardar={onGuardar} />
    </FormDialog>,
    // <CiudadInput> lee el catálogo de ciudades con useQuery, así que el
    // harness necesita el cliente de React Query.
    { conQuery: true, conRouter: true },
  );
}

const botonRegistrar = () => screen.getByRole("button", { name: "Registrar" });

/** Rellena un campo por su etiqueta. */
async function llenar(
  usuario: ReturnType<typeof userEvent.setup>,
  etiqueta: RegExp,
  valor: string,
) {
  const campo = screen.getByLabelText(etiqueta);

  await usuario.clear(campo);
  await usuario.type(campo, valor);
}

describe("ClienteForm", () => {
  it("no pregunta si es persona natural o empresa y ofrece documentos independientes", () => {
    montar();

    expect(screen.queryByText(/persona natural/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^empresa$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^cédula$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^ruc$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^pasaporte$/i)).not.toBeInTheDocument();
  });

  it("deja cargar más de un documento para el mismo cliente", async () => {
    const usuario = userEvent.setup();

    montar();

    await llenar(usuario, /^cédula$/i, "12345678");
    await llenar(usuario, /^ruc$/i, "80012345");

    expect(screen.getByLabelText(/^cédula$/i)).toHaveValue("12345678");
    expect(screen.getByLabelText(/^ruc$/i)).toHaveValue("80012345");
  });

  it("deja el nombre visible junto con el RUC", () => {
    montar();

    expect(screen.getByLabelText(/^nombres\*?$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^apellidos$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^ruc$/i)).toBeInTheDocument();
  });

  it("solicita ciudad y barrio sin mostrar departamento", () => {
    montar();

    expect(screen.getByLabelText(/^ciudad$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^barrio$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^departamento$/i)).not.toBeInTheDocument();
  });

  it("presenta las notas como un campo ancho y poco alto", () => {
    montar();

    const notas = screen.getByLabelText(/^notas internas$/i);

    expect(notas).toHaveAttribute("rows", "3");
    expect(notas).toHaveStyle({ resize: "vertical" });
  });

  it("acepta una persona natural con RUC y sin razón social", async () => {
    const usuario = userEvent.setup();

    montar();

    await llenar(usuario, /^nombres\*?$/i, "Juan");
    await llenar(usuario, /^ruc$/i, "80012345");

    await usuario.click(botonRegistrar());

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        ruc: "8001234-5",
        nombres: "Juan",
        razonSocial: "",
      }),
    );
  });

  it("permite guardar el cliente como inactivo desde el formulario", async () => {
    const usuario = userEvent.setup();

    montar();

    await llenar(usuario, /^nombres\*?$/i, "Juan");
    await llenar(usuario, /^ruc$/i, "80012345");
    await usuario.click(
      screen.getByRole("checkbox", { name: /cliente activo/i }),
    );
    await usuario.click(botonRegistrar());

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ activo: false }),
    );
  });

  it("guarda el RUC con guion antes del dígito verificador", async () => {
    const usuario = userEvent.setup();

    montar();

    await llenar(usuario, /^nombres\*?$/i, "Laura");
    await llenar(usuario, /^ruc$/i, "32052820");
    await usuario.click(botonRegistrar());

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ ruc: "3205282-0" }),
    );
  });

  it("muestra el RUC existente con guion al editar", () => {
    montar({
      id: 5,
      cedula: null,
      ruc: "32052820",
      pasaporte: null,
      nombres: "Laura",
      apellidos: "",
      razonSocial: "",
      email: null,
      telefono: null,
      whatsapp: null,
      direccion: null,
      departamento: null,
      ciudad: null,
      barrio: null,
      notas: null,
      activo: true,
      creadoEn: "2026-10-16T12:00:00.000Z",
      nombreCompleto: "Laura",
      tipoDocumento: "ruc",
      documento: "32052820",
    });

    expect(screen.getByLabelText(/^ruc$/i)).toHaveValue("3205282-0");
  });

  it("cierra el formulario desde el botón de la esquina", async () => {
    const usuario = userEvent.setup();
    const onClose = vi.fn();

    montar(undefined, onClose);
    await usuario.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("envía la razón social si se completó", async () => {
    const usuario = userEvent.setup();

    montar();

    await llenar(usuario, /^nombres\*?$/i, "María");
    await llenar(usuario, /^cédula$/i, "12345678");
    await llenar(usuario, /^razón social$/i, "Veterinaria San Jerez S.R.L.");

    await usuario.click(botonRegistrar());

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        nombres: "María",
        razonSocial: "Veterinaria San Jerez S.R.L.",
      }),
    );
  });

  it("exige el nombre aunque se haya escrito razón social", async () => {
    const usuario = userEvent.setup();

    montar();

    await llenar(usuario, /^cédula$/i, "12345678");
    await llenar(usuario, /^razón social$/i, "Veterinaria San Jerez S.R.L.");

    await usuario.click(botonRegistrar());

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText(/ingresá al menos el nombre/i)).toBeInTheDocument();
  });

  it("valida el largo según el tipo de documento", async () => {
    const usuario = userEvent.setup();

    montar();

    await llenar(usuario, /^nombres\*?$/i, "Ana");
    await llenar(usuario, /^ruc$/i, "123");

    await usuario.click(botonRegistrar());

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText(/el ruc tiene 8 a 11 dígitos/i)).toBeInTheDocument();
  });

  it("deja un único botón de Registrar en toda la pantalla", () => {
    montar();

    // Antes había un pie dentro del formulario y otro en el diálogo: dos
    // "Registrar" idénticos apilados en la misma pantalla.
    expect(screen.getAllByRole("button", { name: "Registrar" })).toHaveLength(1);
  });

  it("mantiene el control de estado fuera del flujo de envío del form", async () => {
    const usuario = userEvent.setup();
    onGuardar.mockClear();

    montar();

    // El contenido del diálogo se portaliza a document.body, así que hay que
    // buscar desde `document` y no desde el contenedor del render.
    const form = document.querySelector("#cliente-form") as HTMLFormElement;

    expect(form).not.toBeNull();

    // El estado es un switch dentro del form: cambiarlo no debe enviarlo.
    await usuario.click(
      screen.getByRole("checkbox", { name: /cliente activo/i }),
    );

    expect(onGuardar).not.toHaveBeenCalled();
  });

  it("expone el id del form para que el diálogo pueda dispararlo", () => {
    montar();

    expect(document.querySelector("#cliente-form")).not.toBeNull();
  });
});