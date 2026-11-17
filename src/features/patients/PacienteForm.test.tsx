import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FormDialog } from "@/components/data/FormDialog";
import type { Cliente } from "@/types/dominio";
import { renderConChakra } from "@/test/utils";
import { PacienteForm, type PacienteFormValues } from "./PacienteForm";

const { buscarClientes, especies, subir, crearCliente, notificarExito } =
  vi.hoisted(() => ({
    buscarClientes: vi.fn(),
    especies: vi.fn(),
    subir: vi.fn(),
    crearCliente: vi.fn(),
    notificarExito: vi.fn(),
  }));

vi.mock("@/features/clients/clients.service", () => ({
  useBuscarClientes: (termino: string) => buscarClientes(termino),
  useCrearCliente: () => ({
    mutateAsync: (...args: unknown[]) => crearCliente(...args),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  }),
  mensajeDeError: (error: Error) => error.message,
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ puede: () => true }),
}));

vi.mock("@/components/ui/toaster", () => ({
  toaster: { success: (...args: unknown[]) => notificarExito(...args) },
}));

vi.mock("@/features/clients/ClienteForm", () => ({
  ClienteForm: ({
    formId,
    onGuardar,
  }: {
    formId: string;
    onGuardar: (valores: {
      cedula: string;
      ruc: string;
      pasaporte: string;
      nombres: string;
      apellidos: string;
      razonSocial: string;
      email: string;
      telefono: string;
      whatsapp: string;
      direccion: string;
      departamento: string;
      ciudad: string;
      barrio: string;
      notas: string;
      activo: boolean;
    }) => void;
  }) => (
    <form
      id={formId}
      onSubmit={(evento) => {
        evento.preventDefault();
        onGuardar({
          cedula: "12345678",
          ruc: "",
          pasaporte: "",
          nombres: "María",
          apellidos: "González",
          razonSocial: "",
          email: "",
          telefono: "0981123456",
          whatsapp: "",
          direccion: "",
          departamento: "",
          ciudad: "",
          barrio: "",
          notas: "",
          activo: true,
        });
      }}
    />
  ),
}));

vi.mock("./patients.service", () => ({
  useEspeciesPaciente: () => especies(),
  urlFotoPaciente: (url?: string | null) =>
    url ? new URL(url, "http://localhost:3000/api/v1").toString() : undefined,
}));

vi.mock("@/services/api", () => ({
  API_URL: "http://localhost:3000/api/v1",
  api: { post: (...args: unknown[]) => subir(...args) },
}));

const responsable: Pick<
  Cliente,
  "id" | "nombreCompleto" | "documento" | "telefono"
> = {
  id: 8,
  nombreCompleto: "María González",
  documento: "12345678",
  telefono: "0981123456",
};

const onGuardar = vi.fn<(valores: PacienteFormValues) => void>();

function montar() {
  return renderConChakra(
    <FormDialog
      abierto
      onClose={vi.fn()}
      titulo="Nuevo paciente"
      textoConfirmar="Registrar paciente"
      onConfirmar={() =>
        document
          .querySelector<HTMLFormElement>("#paciente-form")
          ?.requestSubmit()
      }
    >
      <PacienteForm onGuardar={onGuardar} />
    </FormDialog>,
    { conQuery: true },
  );
}

describe("PacienteForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    buscarClientes.mockReturnValue({ data: [], isError: false });
    crearCliente.mockResolvedValue({
      id: 25,
      nombreCompleto: "María González",
    });
    especies.mockReturnValue({
      data: [{ id: 2, nombre: "Perro", icono: null }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("incluye los datos de mascota, responsable y ficha de salud", () => {
    montar();
    expect(screen.getByLabelText(/^nombre/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^especie/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^cliente responsable/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^nombre/i)).toBeRequired();
    expect(screen.getByLabelText(/^especie/i)).toBeRequired();
    expect(screen.getByLabelText(/^cliente responsable/i)).toBeRequired();
    expect(screen.getByLabelText(/^alergias \/ alertas$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^subir foto$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/también podés arrastrar la imagen hasta acá/i),
    ).toBeInTheDocument();
    const formulario = document.querySelector("#paciente-form")!;
    expect(formulario.textContent!.indexOf("Estado")).toBeLessThan(
      formulario.textContent!.indexOf("Foto de perfil"),
    );
  });

  it("valida nombre, especie y responsable antes de guardar", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(
      screen.getByRole("button", { name: "Registrar paciente" }),
    );
    expect(
      await screen.findByText("Ingresá el nombre de la mascota."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Seleccioná a su responsable."),
    ).toBeInTheDocument();
    expect(screen.getByText("Seleccioná una especie.")).toBeInTheDocument();
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it("permite seleccionar al responsable y envía los valores esenciales", async () => {
    const user = userEvent.setup();
    buscarClientes.mockImplementation((termino: string) => ({
      data: termino ? [responsable] : [],
      isError: false,
    }));
    montar();
    await user.type(screen.getByLabelText(/^nombre/i), "Mora");
    await user.selectOptions(screen.getByLabelText(/^especie/i), "2");
    await user.type(screen.getByLabelText(/^cliente responsable/i), "María");
    await user.click(
      await screen.findByRole("option", { name: /maría gonzález/i }),
    );
    await user.click(
      screen.getByRole("button", { name: "Registrar paciente" }),
    );
    await waitFor(() =>
      expect(onGuardar).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: "Mora",
          clienteId: responsable.id,
          especieId: 2,
          activo: true,
          esterilizado: false,
        }),
      ),
    );
  });

  it("permite registrar un cliente desde responsable y lo selecciona", async () => {
    const user = userEvent.setup();
    montar();

    await user.click(
      screen.getByRole("button", { name: "Registrar nuevo cliente" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Nuevo cliente responsable" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Registrar cliente" }));
    await waitFor(() =>
      expect(crearCliente).toHaveBeenCalledWith(
        expect.objectContaining({
          cedula: "12345678",
          nombres: "María",
          apellidos: "González",
        }),
      ),
    );
    expect(notificarExito).toHaveBeenCalledWith({
      title: "Cliente registrado",
      description: "María González",
    });
    expect(screen.getByText("María González")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cambiar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Nuevo cliente responsable" }),
    ).not.toBeInTheDocument();
  });

  it("sube una imagen soltada en la zona y permite ampliarla", async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview-mora");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    subir.mockResolvedValue({
      data: { data: { url: "/uploads/generales/1/paciente.webp" } },
    });
    montar();
    const archivo = new File(["imagen"], "mora.webp", { type: "image/webp" });
    const zona = screen.getByTestId("foto-dropzone");
    fireEvent.dragOver(zona, { dataTransfer: { files: [archivo] } });
    fireEvent.drop(zona, { dataTransfer: { files: [archivo] } });
    await waitFor(() => expect(subir).toHaveBeenCalled());
    expect(subir.mock.calls[0][1]).toBeInstanceOf(FormData);
    expect(subir).toHaveBeenCalledWith(
      "/uploads",
      expect.any(FormData),
      expect.objectContaining({
        headers: { "Content-Type": "multipart/form-data" },
      }),
    );
    expect(
      screen.getByRole("img", { name: "Foto de la mascota" }),
    ).toHaveAttribute("src", "blob:preview-mora");
    const ampliar = await screen.findByRole("button", {
      name: "Ampliar foto de la mascota",
    });
    await user.click(ampliar);
    expect(
      screen.getByRole("img", { name: "Foto ampliada de la mascota" }),
    ).toHaveAttribute("src", "blob:preview-mora");
    await user.click(
      screen.getByRole("button", { name: "Cerrar vista ampliada" }),
    );
    expect(
      screen.queryByRole("img", { name: "Foto ampliada de la mascota" }),
    ).not.toBeInTheDocument();
  });
});
