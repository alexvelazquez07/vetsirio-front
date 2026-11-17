import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderConChakra } from "@/test/utils";

const mocks = vi.hoisted(() => ({
  post: vi.fn(() => Promise.resolve({ mensaje: "Cuenta creada." })),
  refrescarPerfil: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/api", () => ({
  http: { post: mocks.post },
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ refrescarPerfil: mocks.refrescarPerfil }),
}));

import { RegistroPage } from "./RegistroPage";

const CLAVE_EMAIL = "vetsirio:email-recordado";

beforeEach(() => {
  mocks.post.mockClear();
  mocks.refrescarPerfil.mockClear();
  window.localStorage.clear();
});

/** Completa el paso 1 y avanza al paso de la cuenta. */
async function completarPasoUno(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText("RUC"), "80012345-0");
  await usuario.type(screen.getByLabelText("Nombre comercial"), "Vet Test");
  await usuario.type(screen.getByLabelText("Razón social"), "Vet Test S.R.L.");
  await usuario.type(
    screen.getByLabelText("Correo de la veterinaria"),
    "ana@vet.com",
  );

  await usuario.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByLabelText("Contraseña");
}

/** Completa los dos pasos con los datos mínimos que exige el esquema. */
async function registrar(usuario: ReturnType<typeof userEvent.setup>) {
  await completarPasoUno(usuario);

  await usuario.type(screen.getByLabelText("Nombre"), "Ana");
  await usuario.type(screen.getByLabelText("Apellido"), "Pérez");
  await usuario.type(screen.getByLabelText("Contraseña"), "Secreta123");
  await usuario.type(screen.getByLabelText("Repetir contraseña"), "Secreta123");

  await usuario.click(
    screen.getByRole("button", { name: "Crear cuenta y empezar" }),
  );
}

describe("RegistroPage", () => {
  it("deja el correo listo en el acceso cuando la cuenta se crea", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<RegistroPage />, { conRouter: true });

    await registrar(usuario);

    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    expect(mocks.post).toHaveBeenCalledWith(
      "/auth/registro",
      expect.objectContaining({ email: "ana@vet.com" }),
    );
    expect(window.localStorage.getItem(CLAVE_EMAIL)).toBe("ana@vet.com");
  });

  it("marca en vivo los requisitos de la contraseña mientras se escribe", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<RegistroPage />, { conRouter: true });

    await completarPasoUno(usuario);
    expect(screen.getByText("0/4")).toBeInTheDocument();

    await usuario.type(screen.getByLabelText("Contraseña"), "secreta");
    expect(screen.getByText("1/4")).toBeInTheDocument();

    await usuario.type(screen.getByLabelText("Contraseña"), "A1");
    expect(screen.getByText("4/4")).toBeInTheDocument();
    expect(screen.getByText("Contraseña segura")).toBeInTheDocument();
  });
});
