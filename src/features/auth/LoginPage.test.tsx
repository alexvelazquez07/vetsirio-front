import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderConChakra } from "@/test/utils";

const mocks = vi.hoisted(() => ({
  login: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({
    login: mocks.login,
    autenticado: false,
    cargando: false,
  }),
}));

import { LoginPage } from "./LoginPage";

const CLAVE_EMAIL = "vetsirio:email-recordado";

beforeEach(() => {
  mocks.login.mockClear();
  window.localStorage.clear();
});

/** Completa el formulario y envía con Enter, que es el flujo real del login. */
async function ingresar(usuario: ReturnType<typeof userEvent.setup>, recordar: boolean) {
  await usuario.type(screen.getByLabelText("Correo electrónico"), "ana@vet.com");
  if (recordar) {
    await usuario.click(screen.getByRole("checkbox", { name: "Recordar mi correo" }));
  }
  await usuario.type(screen.getByLabelText("Contraseña"), "Secreta123");
  await usuario.keyboard("{Enter}");
}

describe("LoginPage", () => {
  it("permite ingresar con el check de recordar marcado", async () => {
    const usuario = userEvent.setup();
    renderConChakra(<LoginPage />, { conRouter: true });

    await ingresar(usuario, true);

    expect(mocks.login).toHaveBeenCalledTimes(1);
    expect(mocks.login).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ana@vet.com", password: "Secreta123" }),
    );
    expect(window.localStorage.getItem(CLAVE_EMAIL)).toBe("ana@vet.com");
  });

  it("precarga el correo guardado y deja el check marcado", () => {
    window.localStorage.setItem(CLAVE_EMAIL, "ana@vet.com");

    renderConChakra(<LoginPage />, { conRouter: true });

    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("ana@vet.com");
    expect(
      screen.getByRole("checkbox", { name: "Recordar mi correo" }),
    ).toBeChecked();
  });

  it("al volver del registro precarga el correo y confirma la cuenta", () => {
    window.localStorage.setItem(CLAVE_EMAIL, "ana@vet.com");

    renderConChakra(<LoginPage />, {
      conRouter: true,
      ruta: "/login?registrado=1",
    });

    expect(screen.getByText("¡Cuenta creada!")).toBeInTheDocument();
    expect(screen.getByText("ana@vet.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("ana@vet.com");
    expect(
      screen.getByRole("checkbox", { name: "Recordar mi correo" }),
    ).toBeChecked();
  });

  it("muestra el aviso cuando vuelve del restablecimiento de contraseña", () => {
    renderConChakra(<LoginPage />, {
      conRouter: true,
      ruta: "/login?restablecido=1",
    });

    expect(
      screen.getByText("Tu contraseña se actualizó. Ya podés iniciar sesión."),
    ).toBeInTheDocument();
  });

  it("borra el correo guardado cuando se desmarca el check", async () => {
    window.localStorage.setItem(CLAVE_EMAIL, "ana@vet.com");
    const usuario = userEvent.setup();
    renderConChakra(<LoginPage />, { conRouter: true });

    await usuario.click(screen.getByRole("checkbox", { name: "Recordar mi correo" }));
    await usuario.type(screen.getByLabelText("Contraseña"), "Secreta123");
    await usuario.keyboard("{Enter}");

    expect(window.localStorage.getItem(CLAVE_EMAIL)).toBeNull();
  });
});
