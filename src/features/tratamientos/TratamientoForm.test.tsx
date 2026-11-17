import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderConChakra } from "@/test/utils";
import type { Tratamiento } from "@/types/dominio";
import { TratamientoForm } from "./TratamientoForm";

const { buscarPacientes, crear, actualizar, notificarExito, notificarError } =
  vi.hoisted(() => ({
    buscarPacientes: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    notificarExito: vi.fn(),
    notificarError: vi.fn(),
  }));

vi.mock("./tratamientos.service", () => ({
  useBuscarPacientesTratamiento: (termino: string) => buscarPacientes(termino),
  useCrearTratamiento: () => ({
    mutateAsync: (...args: unknown[]) => crear(...args),
    isPending: false,
  }),
  useActualizarTratamiento: () => ({
    mutateAsync: (...args: unknown[]) => actualizar(...args),
    isPending: false,
  }),
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ puede: () => true }),
}));

vi.mock("@/components/ui/toaster", () => ({
  toaster: {
    success: (...args: unknown[]) => notificarExito(...args),
    error: (...args: unknown[]) => notificarError(...args),
  },
}));

vi.mock("@/features/clients/clients.service", () => ({
  mensajeDeError: (error: Error) => error.message,
}));

const paciente = {
  id: 7,
  nombre: "Luna",
  especie: { id: 1, nombre: "Perro", icono: "dog" },
  cliente: {
    id: 3,
    nombres: "María",
    apellidos: "González",
    razonSocial: null,
    documento: "12345678",
    telefono: "0981123456",
    whatsapp: null,
  },
};

const guardado = {
  id: 11,
  pacienteId: 7,
  veterinarioId: 1,
  nombre: "Antibiótico",
  descripcion: null,
  fechaInicio: new Date().toISOString(),
  fechaFinPrevista: null,
  fechaFinReal: null,
  activo: true,
  paciente,
  veterinario: {
    id: 1,
    nombre: "Ana",
    apellido: "López",
    especialidad: "Clínica",
  },
  dosis: [],
} as unknown as Tratamiento;

const onGuardado = vi.fn();
const onClose = vi.fn();

function montar() {
  return renderConChakra(
    <TratamientoForm abierto onClose={onClose} onGuardado={onGuardado} />,
  );
}

function buscarPaciente() {
  return screen.getByLabelText(/^Buscar paciente/i);
}

async function elegirPaciente(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(buscarPaciente(), "Lu");
  await usuario.click(await screen.findByRole("option", { name: /Luna/ }));
}

describe("TratamientoForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buscarPacientes.mockImplementation((termino: string) => ({
      data: termino.trim().length >= 2 ? [paciente] : [],
      isFetching: false,
      isError: false,
      error: null,
    }));
    crear.mockResolvedValue(guardado);
    actualizar.mockResolvedValue(guardado);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exige paciente y nombre antes de guardar", async () => {
    const usuario = userEvent.setup();
    montar();

    await usuario.click(screen.getByRole("button", { name: "Crear tratamiento" }));

    expect(
      await screen.findByText(
        "Seleccioná el paciente que recibirá el tratamiento.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ingresá un nombre de al menos 2 letras."),
    ).toBeInTheDocument();
    expect(crear).not.toHaveBeenCalled();
  });

  it("crea un tratamiento con la dosis inicial", async () => {
    const usuario = userEvent.setup();
    montar();

    await elegirPaciente(usuario);
    await usuario.type(
      screen.getByLabelText(/^Nombre del tratamiento/i),
      "Antibiótico",
    );
    await usuario.click(screen.getByRole("button", { name: "Crear tratamiento" }));

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));

    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({
        pacienteId: 7,
        nombre: "Antibiótico",
        descripcion: null,
        dosis: [
          expect.objectContaining({
            numeroDosis: 1,
            cantidad: 1,
            unidad: "ml",
            administrada: false,
          }),
        ],
      }),
    );
    expect(onGuardado).toHaveBeenCalledWith(guardado);
    expect(notificarExito).toHaveBeenCalled();
  });

  it("permite agregar y quitar dosis", async () => {
    const usuario = userEvent.setup();
    montar();

    expect(screen.getByText("Dosis 1")).toBeInTheDocument();
    expect(screen.queryByText("Dosis 2")).not.toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: /agregar dosis/i }));
    expect(screen.getByText("Dosis 2")).toBeInTheDocument();

    await usuario.click(
      screen.getByRole("button", { name: "Quitar dosis 2" }),
    );
    expect(screen.queryByText("Dosis 2")).not.toBeInTheDocument();
  });
});
