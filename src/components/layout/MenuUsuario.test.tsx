import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { MenuUsuario } from "@/components/layout/MenuUsuario";
import { renderConChakra } from "@/test/utils";

/**
 * El menú de usuario.
 *
 * Se verifica sobre todo el contrato con la sesión: quién se muestra, qué se
 * puede hacer y, sobre todo, que cerrar sesión NO sea un clic accidental desde
 * el disparador. Ese es el motivo de que exista el menú en lugar de un botón
 * suelto, así que un test que no cubra ese comportamiento no estaría probando
 * la razón del componente.
 */

const solicitar = vi.fn();
const navegar = vi.fn();

const USUARIO = {
  id: 1,
  nombre: "María",
  apellido: "González",
  email: "maria@patitasfelices.py",
  telefono: null,
  fotoUrl: null,
  especialidad: null,
  colorAgenda: null,
  diasTrabajo: [1, 2, 3],
  debeCambiarPassword: false,
  ultimoAcceso: null,
  rol: { id: 1, nombre: "admin", permisos: [] },
};

const VETERINARIA = { nombreComercial: "Patitas Felices" };

/** Permisos por defecto del mock: todo autorizado salvo donde se cambie. */
const permisosPorDefecto = ["configuracion.ver"];

/** Forma del contexto que devuelve `useAuth`, con la sesión opcional. */
type ContextoMock = {
  usuario: typeof USUARIO | null;
  veterinaria: typeof VETERINARIA | null;
  puede: (clave: string) => boolean;
};

/**
 * Mock de `useAuth`.
 *
 * Es `vi.fn` y no una función suelta porque dos tests necesitan cambiar lo que
 * devuelve; con una función común no hay forma de sobrescribir el caso puntual
 * y el permiso se filtra a los tests siguientes.
 *
 * El tipo se declara explícitamente porque, sin él, TypeScript infiere del
 * valor inicial que `usuario` nunca es `null` y después rechaza justamente el
 * test que comprueba que no se renderiza nada sin sesión.
 */
const mockAuth = vi.fn<() => ContextoMock>(() => ({
  usuario: USUARIO,
  veterinaria: VETERINARIA,
  puede: (clave) => permisosPorDefecto.includes(clave),
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => mockAuth(),
}));

vi.mock("@/features/auth/salida.store", () => ({
  useSalida: () => ({ cerrando: false, solicitar }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navegar,
}));

beforeEach(() => {
  vi.clearAllMocks();

  // `clearAllMocks` no restaura la implementación ni la cola de `once`, así que
  // hay que devolver el mock a su estado inicial explícitamente.
  mockAuth.mockReset();
  mockAuth.mockReturnValue({
    usuario: USUARIO,
    veterinaria: VETERINARIA,
    puede: (clave: string) => permisosPorDefecto.includes(clave),
  });
});

describe("MenuUsuario", () => {
  it("muestra la identidad de quien está conectado", () => {
    renderConChakra(<MenuUsuario />);

    // El disparador lleva nombre y veterinaria, para no obligar a abrir el menú
    // sólo para saber quién está dentro.
    expect(screen.getByText("María González")).toBeInTheDocument();
    expect(screen.getByText("Patitas Felices")).toBeInTheDocument();
  });

  it("usa iniciales cuando el usuario no tiene foto", () => {
    renderConChakra(<MenuUsuario />);

    expect(screen.getByText("MG")).toBeInTheDocument();
  });

  it("no cierra sesión al pulsar el avatar", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<MenuUsuario />);

    await usuario.click(screen.getByRole("button", { name: /menú de maría gonzález/i }));

    // Abrió el menú, no cerró la sesión.
    expect(solicitar).not.toHaveBeenCalled();
    expect(screen.getByText("maria@patitasfelices.py")).toBeInTheDocument();
  });

  it("ofrece cerrar sesión dentro del menú", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<MenuUsuario />);

    await usuario.click(screen.getByRole("button", { name: /menú de maría gonzález/i }));

    expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it("dispara la salida sólo al elegir la opción explícita", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<MenuUsuario />);

    await usuario.click(screen.getByRole("button", { name: /menú de maría gonzález/i }));
    await usuario.click(screen.getByRole("menuitem", { name: /cerrar sesión/i }));

    expect(solicitar).toHaveBeenCalledTimes(1);
  });

  it("lleva a configuración", async () => {
    const usuario = userEvent.setup();

    renderConChakra(<MenuUsuario />);

    await usuario.click(screen.getByRole("button", { name: /menú de maría gonzález/i }));
    await usuario.click(screen.getByRole("menuitem", { name: /configuración/i }));

    expect(navegar).toHaveBeenCalledWith("/configuracion");
  });

  it("deshabilita configuración si el rol no tiene permiso", async () => {
    mockAuth.mockReturnValue({
      usuario: USUARIO,
      veterinaria: VETERINARIA,
      puede: () => false,
    });

    const usuario = userEvent.setup();

    renderConChakra(<MenuUsuario />);

    await usuario.click(screen.getByRole("button", { name: /menú de maría gonzález/i }));

    const item = screen.getByRole("menuitem", { name: /configuración/i });

    expect(item).toHaveAttribute("data-disabled", "");

    // Un ítem deshabilitado no debe navegar aunque se pulse.
    await usuario.click(item);

    expect(navegar).not.toHaveBeenCalled();
  });

  it("no renderiza nada si no hay sesión", () => {
    mockAuth.mockReturnValue({
      usuario: null,
      veterinaria: null,
      puede: () => false,
    });

    const { container } = renderConChakra(<MenuUsuario />);

    expect(container).toBeEmptyDOMElement();
  });

  it("deja la identidad accesible en móvil, donde no se ve el nombre", () => {
    renderConChakra(<MenuUsuario />);

    // En pantallas chicas el nombre se oculta por estilo, pero el nombre sigue
    // en el aria-label: si no, el botón sería un avatar sin nombre para un
    // lector de pantalla.
    expect(
      screen.getByRole("button", { name: "Menú de María González" }),
    ).toBeInTheDocument();
  });
});