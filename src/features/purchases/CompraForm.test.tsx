import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderConChakra } from "@/test/utils";
import type { Producto } from "@/types/dominio";
import { CompraForm } from "./CompraForm";

const { mockBuscarCodigo, mockBuscarProductos } = vi.hoisted(() => ({
  mockBuscarCodigo: vi.fn(),
  mockBuscarProductos: vi.fn(),
}));

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ puede: () => true }),
}));

vi.mock("@/features/clients/clients.service", () => ({
  mensajeDeError: (error: Error) => error.message,
  useCrearProveedor: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useProveedoresOpciones: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock("@/features/products/products.service", () => ({
  UNIDADES_MEDIDA: ["unidad", "frasco"],
  useCrearProducto: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCategoriasProducto: () => ({
    data: [
      { id: 1, nombre: "Medicamentos" },
      { id: 2, nombre: "Accesorios" },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock("./purchases.service", () => ({
  buscarProductoPorCodigo: mockBuscarCodigo,
  useBuscarProductosCompra: mockBuscarProductos,
}));

const producto = {
  id: 1,
  codigo: "MED-01",
  nombre: "Amoxicilina 250 mg",
  unidadMedida: "frasco",
  porcentajeIva: 10,
  stockActual: 8,
  precioCosto: 5000,
  requiereLote: false,
  requiereVencimiento: false,
  categoria: { id: 2, nombre: "Medicamentos" },
} as Producto;

function montar() {
  const onGuardar = vi.fn();

  renderConChakra(<CompraForm onGuardar={onGuardar} />);

  return { onGuardar };
}

describe("CompraForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuscarProductos.mockImplementation((termino: string) => ({
      data: {
        items: termino.trim().length > 1 ? [producto] : [],
      },
      isFetching: false,
      error: null,
    }));
  });

  it("agrega el producto al presionar Enter en el SKU", async () => {
    const usuario = userEvent.setup();
    mockBuscarCodigo.mockResolvedValue(producto);
    montar();

    await usuario.type(screen.getByLabelText("SKU de la fila 1"), "med-01{Enter}");

    await waitFor(() => expect(mockBuscarCodigo).toHaveBeenCalledWith("MED-01"));
    expect(await screen.findByText("Amoxicilina 250 mg")).toBeInTheDocument();
    expect(screen.getByText("MED-01")).toBeInTheDocument();
    expect(screen.queryByText("Stock 8")).not.toBeInTheDocument();
  });

  it("muestra un error cuando el SKU no existe", async () => {
    const usuario = userEvent.setup();
    mockBuscarCodigo.mockResolvedValue(null);
    montar();

    await usuario.type(screen.getByLabelText("SKU de la fila 1"), "NOPE{Enter}");

    expect(
      await screen.findByText(/No existe el SKU «NOPE»/),
    ).toBeInTheDocument();
  });

  it("abre el buscador con F2 y muestra el stock del producto", async () => {
    const usuario = userEvent.setup();
    montar();

    const sku = screen.getByLabelText("SKU de la fila 1");
    await usuario.type(sku, "MED");
    fireEvent.keyDown(sku, { key: "F2" });

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /Buscar producto/i }),
    ).toHaveValue("MED");
    expect(await screen.findByText("Stock 8")).toBeInTheDocument();
  });
});
