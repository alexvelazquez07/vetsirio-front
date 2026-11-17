import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderConChakra } from "@/test/utils";
import type { GroomingSesion } from "@/types/dominio";
import { GroomingForm } from "./GroomingForm";

const { buscarPacientes, crear, actualizar, notificarExito, notificarError } =
  vi.hoisted(() => ({
    buscarPacientes: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    notificarExito: vi.fn(),
    notificarError: vi.fn(),
  }));

vi.mock("./grooming.service", () => ({
  ESTADOS_GROOMING: [
    { valor: "pendiente", etiqueta: "Pendiente", color: "orange" },
    { valor: "en_proceso", etiqueta: "En proceso", color: "blue" },
    { valor: "finalizada", etiqueta: "Finalizada", color: "green" },
    { valor: "cancelada", etiqueta: "Cancelada", color: "gray" },
  ],
  useBuscarPacientesGrooming: (termino: string) => buscarPacientes(termino),
  usePeluquerosGrooming: () => ({
    data: [],
    isPending: false,
  }),
  useCrearGroomingSesion: () => ({
    mutateAsync: (...args: unknown[]) => crear(...args),
    isPending: false,
  }),
  useActualizarGroomingSesion: () => ({
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

const guardada = {
  id: 21,
  pacienteId: 7,
  peluqueroId: null,
  citaId: 30,
  fechaInicio: new Date().toISOString(),
  fechaFin: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  tipoServicio: "Baño y corte",
  estado: "pendiente",
  precio: 50000,
  observaciones: null,
  fotoAntesUrl: null,
  fotoDespuesUrl: null,
  paciente,
  peluquero: null,
  cita: null,
} as unknown as GroomingSesion;

const onGuardado = vi.fn();
const onClose = vi.fn();

function montar(sesion?: GroomingSesion) {
  return renderConChakra(
    <GroomingForm abierto sesion={sesion} onClose={onClose} onGuardado={onGuardado} />,
  );
}

async function elegirPaciente(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(
    screen.getByLabelText(/^Buscar paciente/i),
    "Lu",
  );
  await usuario.click(await screen.findByRole("option", { name: /Luna/ }));
}

describe("GroomingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buscarPacientes.mockImplementation((termino: string) => ({
      data: termino.trim().length >= 2 ? [paciente] : [],
      isFetching: false,
      isError: false,
      error: null,
    }));
    crear.mockResolvedValue(guardada);
    actualizar.mockResolvedValue(guardada);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exige paciente antes de registrar la sesión", async () => {
    const usuario = userEvent.setup();
    montar();

    await usuario.click(screen.getByRole("button", { name: "Registrar sesión" }));

    expect(
      await screen.findByText("Seleccioná el paciente que se va a atender."),
    ).toBeInTheDocument();
    expect(crear).not.toHaveBeenCalled();
  });

  it("registra la sesión con el paciente, servicio y precio", async () => {
    const usuario = userEvent.setup();
    montar();

    await elegirPaciente(usuario);
    await usuario.type(
      screen.getByLabelText(/^Tipo de servicio/i),
      "Baño y corte",
    );

    const precio = screen.getByLabelText(/^Precio/i);
    await usuario.clear(precio);
    await usuario.type(precio, "50000");

    await usuario.click(screen.getByRole("button", { name: "Registrar sesión" }));

    await waitFor(() => expect(crear).toHaveBeenCalledTimes(1));

    expect(crear).toHaveBeenCalledWith(
      expect.objectContaining({
        pacienteId: 7,
        peluqueroId: null,
        tipoServicio: "Baño y corte",
        estado: "pendiente",
        precio: 50000,
        fotoAntesUrl: null,
        fotoDespuesUrl: null,
      }),
    );
    expect(onGuardado).toHaveBeenCalledWith(guardada);
    expect(notificarExito).toHaveBeenCalled();
  });

  it("carga los datos de la sesión al editar", () => {
    montar(guardada);

    expect(screen.getByLabelText(/^Tipo de servicio/i)).toHaveValue(
      "Baño y corte",
    );
    expect(screen.getByLabelText(/^Precio/i)).toHaveValue(50000);
    expect(screen.getByText("Luna")).toBeInTheDocument();
  });
});
