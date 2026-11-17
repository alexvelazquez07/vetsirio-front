import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderConChakra } from "@/test/utils";
import { VentaForm } from "./VentaForm";
import type { Venta } from "./ventas.service";

const producto = {
  id: 1,
  codigo: "AMOX",
  nombre: "Amoxicilina 500 mg",
  unidadMedida: "unidad",
  porcentajeIva: 10,
  stockActual: 10,
  stockMinimo: 0,
  precioVenta: 15000,
  precioCosto: 0,
  requiereLote: false,
  requiereVencimiento: false,
  esMedicamento: true,
  esControlado: false,
  requiereReceta: false,
  activo: true,
};

vi.mock("@/features/auth/auth.store", () => ({
  useAuth: () => ({ puede: () => true }),
}));

vi.mock("@/features/clients/clients.service", () => ({
  useBuscarClientes: () => ({
    data: [
      {
        id: 7,
        documento: "80012345-6",
        tipoDocumento: "ruc",
        cedula: null,
        ruc: "80012345-6",
        pasaporte: null,
        nombres: null,
        apellidos: null,
        razonSocial: "Veterinaria del Sur S.A.",
        email: null,
        telefono: "0981 000 000",
        whatsapp: null,
        direccion: null,
        departamento: null,
        ciudad: null,
        barrio: null,
        notas: null,
        activo: true,
        creadoEn: "2026-01-01T00:00:00.000Z",
        nombreCompleto: "Veterinaria del Sur S.A.",
      },
    ],
    isFetching: false,
    isError: false,
  }),
  useCrearCliente: () => ({ mutateAsync: vi.fn(), isPending: false }),
  mensajeDeError: (error: unknown) => String(error),
}));

vi.mock("@/features/products/products.service", () => ({
  UNIDADES_MEDIDA: ["unidad"],
  useCategoriasProducto: () => ({ data: [] }),
  useCrearProducto: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("./ventas.service", () => ({
  buscarProductoPorCodigoVenta: vi.fn(),
  buscarServicioPorCodigoVenta: vi.fn(),
  useRegistrarPagoVenta: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useBuscarProductosVenta: () => ({
    data: { items: [producto] },
    isFetching: false,
    error: null,
  }),
  useBuscarServiciosVenta: () => ({ data: { items: [] }, isFetching: false, error: null }),
}));

function montar() {
  return renderConChakra(<VentaForm onGuardar={vi.fn()} />, { conQuery: true });
}

describe("VentaForm", () => {
  it("muestra las secciones principales y asocia la etiqueta del cliente", () => {
    montar();

    expect(screen.getByText("Ítems de la venta")).toBeInTheDocument();
    expect(screen.getByLabelText(/^cliente/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nuevo producto/i })).toBeInTheDocument();
  });

  it("muestra el vencimiento al pasar la condición de pago a crédito", () => {
    montar();

    expect(screen.queryByText("Vencimiento del pago")).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Contado"), { target: { value: "credito" } });

    expect(screen.getByText("Vencimiento del pago")).toBeInTheDocument();
  });

  it("agrega un producto desde el catálogo con F2", async () => {
    const usuario = userEvent.setup();
    montar();

    fireEvent.keyDown(window, { key: "F2" });

    const buscador = await screen.findByPlaceholderText(/Nombre, SKU o código de barras/i);
    await usuario.type(buscador, "amox");
    await usuario.click(await screen.findByText("Amoxicilina 500 mg"));

    expect(screen.queryByText("Amoxicilina 500 mg")).toBeInTheDocument();
    expect(screen.getAllByText("1 ítem").length).toBeGreaterThan(0);
  });

  it("F2 en el campo Cliente no abre el catálogo de productos", () => {
    montar();

    fireEvent.keyDown(screen.getByLabelText(/^cliente/i), { key: "F2" });

    expect(screen.queryByText("Agregar ítem a la venta")).not.toBeInTheDocument();
  });

  it("filtra clientes en el mismo campo y muestra RUC — nombre al elegir", async () => {
    const usuario = userEvent.setup();
    montar();

    const campoCliente = screen.getByLabelText(/^cliente/i);
    await usuario.type(campoCliente, "veterinaria");
    await usuario.click(await screen.findByText("Veterinaria del Sur S.A."));

    expect(screen.getByLabelText(/^cliente/i)).toHaveValue(
      "80012345-6 — Veterinaria del Sur S.A.",
    );
    expect(screen.queryByLabelText("Nombre del cliente")).not.toBeInTheDocument();
  });

  it("no muestra 'Supera el stock' al mirar una factura ya emitida", () => {
    const venta = {
      id: 99,
      estado: "ACTIVA",
      timbrado: "12345678",
      tipoComprobante: "factura",
      condicionPago: "contado",
      moneda: "PYG",
      fechaEmision: "2026-10-01",
      fechaVencimiento: null,
      total: 30000,
      cliente: {
        id: 7,
        documento: "80012345-6",
        razonSocial: "Veterinaria del Sur S.A.",
        nombreFantasia: null,
      },
      items: [
        {
          id: 1,
          productoId: 1,
          loteId: null,
          descripcion: "Amoxicilina 500 mg",
          codigo: "AMOX",
          unidadMedida: "unidad",
          cantidad: 2,
          costoUnitario: 15000,
          porcentajeIva: 10,
          subtotal: 30000,
          montoIva: 0,
          total: 30000,
          producto: {
            id: 1,
            codigo: "AMOX",
            nombre: "Amoxicilina 500 mg",
            unidadMedida: "unidad",
          },
        },
      ],
    } as unknown as Venta;

    renderConChakra(<VentaForm ventaInicial={venta} soloLectura onGuardar={vi.fn()} />, {
      conQuery: true,
    });

    expect(screen.queryByText(/Supera el stock disponible/i)).not.toBeInTheDocument();
  });
});
