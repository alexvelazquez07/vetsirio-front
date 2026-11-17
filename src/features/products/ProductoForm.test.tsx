import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderConChakra } from "@/test/utils";
import type { CategoriaProducto, Producto } from "@/types/dominio";
import { ProductoForm } from "./ProductoForm";

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ puede: () => true }),
}));

vi.mock("@/features/clients/clients.service", () => ({
  mensajeDeError: (error: Error) => error.message,
  useCrearProveedor: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));

const producto = {
  id: 12,
  codigo: "MED-012",
  nombre: "Amoxicilina 250 mg",
  descripcion: "Antibiótico de amplio espectro.",
  codigoBarras: "7891234567890",
  codigoSifen: null,
  marca: "Bayer",
  laboratorio: "Richmond",
  principioActivo: "Amoxicilina trihidrato",
  concentracion: "250 mg",
  presentacion: "Frasco de 100 ml",
  especieDestino: "Perros y gatos",
  registroSenacsa: "12345",
  ubicacion: "Estante A3",
  unidadMedida: "frasco",
  precioVenta: 85000,
  precioCosto: 50000,
  porcentajeIva: 10,
  stockActual: 8,
  stockMinimo: 3,
  esMedicamento: true,
  esControlado: false,
  requiereReceta: true,
  activo: true,
  fotoUrl: null,
  categoria: { id: 2, nombre: "Medicamentos" },
  proveedor: {
    id: 5,
    razonSocial: "Richmond S.A.",
    nombreFantasia: "Richmond",
  },
} as unknown as Producto;

function montar(articulo?: Producto, categorias?: CategoriaProducto[]) {
  const onGuardar = vi.fn();

  renderConChakra(
    <ProductoForm
      producto={articulo}
      categorias={categorias}
      onGuardar={onGuardar}
    />,
    { conQuery: true },
  );

  return { onGuardar };
}

function guardar() {
  const formulario = document.querySelector<HTMLFormElement>("#producto-form");
  expect(formulario).not.toBeNull();
  fireEvent.submit(formulario!);
}

describe("ProductoForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exige el nombre antes de guardar", async () => {
    const { onGuardar } = montar();

    guardar();

    expect(
      await screen.findByText("Escribí al menos 2 caracteres."),
    ).toBeInTheDocument();
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it("registra un producto navegando entre los tabs", async () => {
    const usuario = userEvent.setup();
    const { onGuardar } = montar();

    await usuario.type(
      screen.getByLabelText(/^Nombre del producto/i),
      "Ivermectina 1%",
    );

    await usuario.click(screen.getByRole("tab", { name: "Precios" }));
    await usuario.type(screen.getByLabelText(/^Precio de costo/i), "20000");
    await usuario.type(screen.getByLabelText(/^Precio de venta/i), "35000");

    await usuario.click(screen.getByRole("tab", { name: "Inventario" }));
    await usuario.clear(screen.getByLabelText(/^Stock mínimo/i));
    await usuario.type(screen.getByLabelText(/^Stock mínimo/i), "4");

    await usuario.click(screen.getByRole("tab", { name: "Clínica" }));
    await usuario.click(screen.getByLabelText(/^Es medicamento/i));
    await usuario.click(screen.getByLabelText(/^Requiere receta/i));

    guardar();

    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));

    const datos = onGuardar.mock.calls[0][0];
    expect(datos).not.toHaveProperty("stockActual");
    expect(datos).not.toHaveProperty("fechaVencimiento");
    expect(datos).toEqual(
      expect.objectContaining({
        nombre: "Ivermectina 1%",
        precioCosto: 20000,
        precioVenta: 35000,
        stockMinimo: 4,
        esMedicamento: true,
        requiereReceta: true,
        unidadMedida: "unidad",
        activo: true,
      }),
    );
  });

  it("carga los datos al editar y no envía stockActual", async () => {
    const usuario = userEvent.setup();
    const { onGuardar } = montar(producto);

    expect(screen.getByLabelText(/^Nombre del producto/i)).toHaveValue(
      "Amoxicilina 250 mg",
    );

    await usuario.click(screen.getByRole("tab", { name: "Precios" }));
    expect(screen.getByLabelText(/^Precio de venta/i)).toHaveValue("85.000");

    await usuario.click(screen.getByRole("tab", { name: "Inventario" }));
    expect(screen.getByText(/Stock actual: 8 frasco/i)).toBeInTheDocument();

    guardar();

    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));

    const datos = onGuardar.mock.calls[0][0];
    expect(datos).not.toHaveProperty("stockActual");
    expect(datos).toEqual(
      expect.objectContaining({
        codigo: "MED-012",
        nombre: "Amoxicilina 250 mg",
        categoriaId: 2,
        proveedorId: 5,
        precioVenta: 85000,
        esControlado: false,
      }),
    );
  });

  it("no muestra stock inicial ni vencimiento al crear", async () => {
    const usuario = userEvent.setup();
    montar(undefined, [{ id: 4, nombre: "Alimento balanceado" }]);

    await usuario.selectOptions(screen.getByLabelText(/^Categoría/i), "4");
    await usuario.click(screen.getByRole("tab", { name: "Inventario" }));

    expect(screen.queryByLabelText(/^Stock inicial/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/El producto se crea con stock 0/i),
    ).toBeInTheDocument();

    await usuario.click(screen.getByRole("tab", { name: "Clínica" }));
    expect(
      screen.queryByLabelText(/^Fecha de vencimiento/i),
    ).not.toBeInTheDocument();
  });

  it("permite ampliar la imagen del producto", async () => {
    const usuario = userEvent.setup();
    montar({ ...producto, fotoUrl: "/uploads/producto.jpg" } as Producto);

    await usuario.click(
      screen.getByRole("button", { name: "Ampliar imagen del producto" }),
    );

    expect(
      await screen.findByAltText("Imagen ampliada de Amoxicilina 250 mg"),
    ).toBeInTheDocument();
  });

  it("desactiva el control al elegir una categoría de accesorios", async () => {
    const usuario = userEvent.setup();
    montar(undefined, [{ id: 5, nombre: "Accesorios" }]);

    await usuario.selectOptions(screen.getByLabelText(/^Categoría/i), "5");
    await usuario.click(screen.getByRole("tab", { name: "Inventario" }));

    expect(
      screen.getByRole("checkbox", {
        name: /^Controla lote y vencimiento/i,
      }),
    ).not.toBeChecked();
  });

  it("permite desactivar el control de lote y vencimiento", async () => {
    const usuario = userEvent.setup();
    const { onGuardar } = montar();

    await usuario.type(
      screen.getByLabelText(/^Nombre del producto/i),
      "Plato de gato",
    );
    await usuario.click(screen.getByRole("tab", { name: "Inventario" }));

    const control = screen.getByRole("checkbox", {
      name: /^Controla lote y vencimiento/i,
    });
    expect(control).toBeChecked();
    await usuario.click(control);

    guardar();

    await waitFor(() => expect(onGuardar).toHaveBeenCalledTimes(1));

    expect(onGuardar.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        requiereLote: false,
        requiereVencimiento: false,
      }),
    );
  });

  it("salta al tab con error al intentar guardar", async () => {
    const usuario = userEvent.setup();
    const { onGuardar } = montar();

    await usuario.type(screen.getByLabelText(/^Nombre del producto/i), "Test");
    await usuario.click(screen.getByRole("tab", { name: "Inventario" }));

    fireEvent.change(screen.getByLabelText(/^Stock mínimo/i), {
      target: { value: "-1" },
    });

    guardar();

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Inventario/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
    expect(
      await screen.findByText("El stock mínimo no puede ser negativo."),
    ).toBeInTheDocument();
    expect(onGuardar).not.toHaveBeenCalled();
  });
});
