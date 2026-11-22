import {
  Badge,
  Box,
  Button,
  Collapsible,
  Field,
  Flex,
  Grid,
  IconButton,
  Input,
  NativeSelect,
  Skeleton,
  Stack,
  Table,
  Text,
  chakra,
} from "@chakra-ui/react";
import {
  CalendarDays,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { MoneyInput } from "@/components/fields/MoneyInput";
import { Alert } from "@/components/ui/alert";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup } from "@/components/ui/input-group";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { toaster } from "@/components/ui/toaster";
import { useAuth } from "@/features/auth/auth.store";
import {
  mensajeDeError,
  useBuscarClientes,
  useCrearCliente,
} from "@/features/clients/clients.service";
import {
  UNIDADES_MEDIDA,
  useCategoriasProducto,
  useCrearProducto,
} from "@/features/products/products.service";
import { montoVigente } from "@/features/products/precios";
import {
  formatCantidad,
  formatFecha,
  formatFechaCalendario,
  formatMoneda,
  formatMonedaUSD,
} from "@/lib/formato";
import type { Cliente, Producto, Servicio } from "@/types/dominio";
import { CobroVenta, type PagoLinea } from "./CobroVenta";
import {
  calcularLineaVenta,
  calcularTotalesVenta,
  fechaHoyCalendario,
  type PorcentajeIvaVenta,
} from "./ventas.calculo";
import {
  buscarProductoPorCodigoVenta,
  buscarServicioPorCodigoVenta,
  useBuscarProductosVenta,
  useBuscarServiciosVenta,
  useRegistrarPagoVenta,
  type CondicionPagoVenta,
  type EstadoFacturaVenta,
  type MonedaVenta,
  type TipoComprobanteVenta,
  type Venta,
  type VentaItem,
  type VentaItemPayload,
  type VentaPayload,
  type PagoVentaPayload,
} from "./ventas.service";

/* ──────────────────────────────── Tipos y datos ──────────────────────────────── */

export interface LineaFormularioVenta {
  key: string;
  producto: Producto | null;
  servicio: Servicio | null;
  codigoSku: string;
  cantidad: string;
  precioUnitario: string;
  porcentajeIva: PorcentajeIvaVenta;
  /** Se conserva el lote de una venta pendiente al continuarla, aunque ya no se edite acá. */
  codigoLote: string;
  fechaVencimiento: string;
  descripcion: string;
}

interface Errores {
  cliente?: string;
  timbrado?: string;
  establecimiento?: string;
  puntoExpedicion?: string;
  numero?: string;
  fechaEmision?: string;
  fechaVencimiento?: string;
  tipoCambio?: string;
  lineas?: string;
}

type EstadoNuevaVenta = "PENDIENTE" | "ACTIVA";
type TipoCatalogo = "producto" | "servicio";

const ESTADOS_VENTA_FORM: Record<
  EstadoFacturaVenta,
  { etiqueta: string; paleta: "orange" | "success" | "red" }
> = {
  PENDIENTE: { etiqueta: "Pendiente", paleta: "orange" },
  ACTIVA: { etiqueta: "Activa", paleta: "success" },
  ANULADA: { etiqueta: "Anulada", paleta: "red" },
};

const ID = {
  cliente: "venta-cliente",
  timbrado: "venta-timbrado",
  establecimiento: "venta-establecimiento",
  puntoExpedicion: "venta-punto-expedicion",
  numero: "venta-numero",
  fechaEmision: "venta-fecha-emision",
  fechaVencimiento: "venta-fecha-vencimiento",
  tipoCambio: "venta-tipo-cambio",
} as const;

const ORDEN_CAMPOS: (keyof typeof ID)[] = [
  "cliente",
  "timbrado",
  "establecimiento",
  "puntoExpedicion",
  "numero",
  "fechaEmision",
  "fechaVencimiento",
  "tipoCambio",
];

const FILAS_MINIMAS = 5;
const ALTO_FILA = "2.75rem";
const ALTO_MAXIMO_TABLA = "16.5rem";

/* ─────────────────────────────────── Utilidades ─────────────────────────────────── */

function nuevaLinea(): LineaFormularioVenta {
  return {
    key: crypto.randomUUID(),
    producto: null,
    servicio: null,
    codigoSku: "",
    cantidad: "1",
    precioUnitario: "",
    porcentajeIva: 10,
    codigoLote: "",
    fechaVencimiento: "",
    descripcion: "",
  };
}

function ivaDeNumero(valor: number | undefined, respaldo: PorcentajeIvaVenta): PorcentajeIvaVenta {
  return valor === 0 || valor === 5 || valor === 10 ? valor : respaldo;
}

function lineaOcupada(linea: LineaFormularioVenta): boolean {
  return linea.producto !== null || linea.servicio !== null;
}

/**
 * Stock del producto como número, o `null` si no se conoce.
 *
 * El detalle de una venta puede no informar `stockActual` (por ejemplo, una
 * venta vieja): en ese caso no hay que asumir 0, porque parecería que todos
 * los ítems superan el stock.
 */
function stockDeProducto(producto: Producto): number | null {
  const stock = Number(producto.stockActual);
  return Number.isFinite(stock) ? stock : null;
}

function productoSinStock(producto: Producto): boolean {
  const stock = stockDeProducto(producto);
  return stock !== null && stock <= 0;
}

/**
 * Precio de venta que corresponde a la fecha de emisión. Si el producto no
 * tiene historial (venta vieja o respuesta reducida) se usa el denormalizado.
 */
function precioVentaVigente(producto: Producto, fecha: string): number {
  if (producto.precios && producto.precios.length > 0) {
    return montoVigente(producto.precios, "venta", fecha);
  }
  return Number(producto.precioVenta) || 0;
}

function productoSinPrecio(producto: Producto, fecha: string): boolean {
  return precioVentaVigente(producto, fecha) <= 0;
}

function nombreDeLinea(linea: LineaFormularioVenta): string {
  return linea.producto?.nombre ?? linea.servicio?.nombre ?? "ítem";
}

function lineaDesdeProducto(
  producto: Producto,
  fechaEmision: string,
): LineaFormularioVenta {
  return {
    ...nuevaLinea(),
    producto,
    servicio: null,
    codigoSku: producto.codigo,
    porcentajeIva: ivaDeNumero(producto.porcentajeIva, 5),
    precioUnitario: String(precioVentaVigente(producto, fechaEmision)),
    descripcion: producto.nombre,
  };
}

function lineaDesdeServicio(servicio: Servicio): LineaFormularioVenta {
  return {
    ...nuevaLinea(),
    producto: null,
    servicio,
    codigoSku: servicio.codigo?.trim() || "",
    porcentajeIva: 10,
    precioUnitario: servicio.precio?.toString() ?? "",
    descripcion: servicio.nombre,
  };
}

function lineaDesdeItem(item: VentaItem): LineaFormularioVenta {
  if (item.servicio || item.servicioId) {
    const servicio = item.servicio
      ? ({
          id: item.servicio.id,
          codigo: item.servicio.codigo,
          nombre: item.servicio.nombre,
          descripcion: item.descripcion,
          precio: item.costoUnitario,
          duracionMin: 0,
          requiereVeterinario: false,
          consumeInsumos: false,
          precioPersonalizado: true,
          activo: true,
        } as Servicio)
      : ({
          id: item.servicioId as number,
          codigo: item.codigo,
          nombre: item.descripcion || "Servicio",
          descripcion: item.descripcion,
          precio: item.costoUnitario,
          duracionMin: 0,
          requiereVeterinario: false,
          consumeInsumos: false,
          precioPersonalizado: true,
          activo: true,
        } as Servicio);

    return {
      ...nuevaLinea(),
      servicio,
      codigoSku: servicio.codigo?.trim() ?? "",
      cantidad: String(item.cantidad ?? 1),
      precioUnitario: String(item.costoUnitario ?? 0),
      porcentajeIva: ivaDeNumero(item.porcentajeIva, 10),
      descripcion: item.descripcion || servicio.nombre,
    };
  }

  // Al continuar la carga de una venta pendiente el backend puede devolver sólo
  // el productoId. Si se exigiera `item.producto`, la línea quedaría "vacía" y
  // el ítem se perdería al volver a guardar.
  const producto =
    item.producto || item.productoId
      ? ({
          id: item.producto?.id ?? item.productoId ?? 0,
          nombre: item.producto?.nombre ?? item.descripcion ?? "Producto",
          codigo: item.producto?.codigo ?? item.codigo ?? "",
          unidadMedida: item.producto?.unidadMedida ?? item.unidadMedida ?? "unidad",
          porcentajeIva: item.porcentajeIva ?? 5,
          // Si el backend no manda el stock, queda desconocido (NaN) para no
          // mostrar un falso "Supera el stock disponible (0)".
          stockActual: item.producto?.stockActual ?? Number.NaN,
          requiereLote: !!item.lote,
          requiereVencimiento: !!item.lote?.fechaVencimiento,
          esMedicamento: false,
          esControlado: false,
          requiereReceta: false,
          precioVenta: item.costoUnitario ?? 0,
          precioCosto: 0,
          stockMinimo: 0,
          activo: true,
        } as Producto)
      : null;

  return {
    ...nuevaLinea(),
    producto,
    codigoSku: item.producto?.codigo ?? item.codigo ?? "",
    cantidad: String(item.cantidad ?? 1),
    precioUnitario: String(item.costoUnitario ?? 0),
    porcentajeIva: ivaDeNumero(item.porcentajeIva, 5),
    codigoLote: item.lote?.codigoLote ?? "",
    fechaVencimiento: soloFecha(item.lote?.fechaVencimiento),
    descripcion: item.descripcion ?? item.producto?.nombre ?? "",
  };
}

function completarFilas(lineas: LineaFormularioVenta[]): LineaFormularioVenta[] {
  const ocupadas = lineas.filter(lineaOcupada).length;
  const vacias = lineas.length - ocupadas;
  const faltantes = Math.max(0, FILAS_MINIMAS - lineas.length, 1 - vacias);
  if (faltantes === 0) return lineas;
  return [...lineas, ...Array.from({ length: faltantes }, () => nuevaLinea())];
}

function aNumero(valor: string): number {
  const numero = Number(valor.replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
}

function formatearMonto(
  moneda: MonedaVenta,
  valor: number | string | null | undefined,
): string {
  return moneda === "USD" ? formatMonedaUSD(valor) : formatMoneda(valor);
}

/** Primer control que se completa después de elegir el ítem: la cantidad. */
function idPrimerCampo(linea: LineaFormularioVenta): string {
  return lineaOcupada(linea) ? `cantidad-${linea.key}` : `sku-${linea.key}`;
}

function soloFecha(valor?: string | null): string {
  return valor ? valor.slice(0, 10) : "";
}

function nombreCliente(cliente: Cliente | null): string {
  if (!cliente) return "";
  return (
    cliente.nombreCompleto ||
    cliente.razonSocial ||
    `${cliente.nombres ?? ""} ${cliente.apellidos ?? ""}`.trim()
  );
}

/**
 * Documento con el que se identifica al cliente en la venta.
 *
 * Se prioriza el RUC porque es el dato que exige la factura legal; si el
 * cliente no tiene RUC se cae al documento principal (cédula o pasaporte).
 */
function documentoDeCliente(cliente: Cliente): string {
  return cliente.ruc || cliente.documento || cliente.cedula || cliente.pasaporte || "";
}

/** "RUC — Nombre" tal como se muestra una vez elegido el cliente. */
function etiquetaCliente(cliente: Cliente): string {
  const documento = documentoDeCliente(cliente);
  const nombre = nombreCliente(cliente);
  if (!documento) return nombre;
  if (!nombre) return documento;
  return `${documento} — ${nombre}`;
}

/**
 * El cliente que viene dentro de una venta trae menos campos que el de
 * /clientes. Sin recomponer `nombreCompleto`, al continuar una venta pendiente
 * el campo aparecía vacío aunque la venta sí tuviera cliente.
 */
function clienteDesdeVenta(venta?: Venta | null): Cliente | null {
  const cliente = venta?.cliente;
  if (!cliente) return null;

  return {
    ...(cliente as unknown as Cliente),
    razonSocial: cliente.razonSocial ?? "",
    nombreCompleto:
      cliente.nombreCompleto ||
      cliente.nombreFantasia ||
      cliente.razonSocial ||
      cliente.documento,
  };
}

/* ───────────────────────────── Componentes de apoyo ───────────────────────────── */

function Campo({
  id,
  etiqueta,
  requerido,
  error,
  ayuda,
  children,
}: {
  id?: string;
  etiqueta: string;
  requerido?: boolean;
  error?: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    // `id` en el Field.Root enlaza la etiqueta con el control; `ids.control`
    // solo cambia el id del contenedor y dejaba la etiqueta apuntando a un id
    // inexistente (además de duplicar el id del input).
    <Field.Root invalid={!!error} required={requerido} id={id}>
      <Field.Label fontSize="xs" fontWeight="medium" color="ink.800" mb="1">
        {etiqueta}
        {requerido && <Field.RequiredIndicator />}
      </Field.Label>
      {children}
      {error ? (
        <Field.ErrorText fontSize="xs" mt="0.5">
          {error}
        </Field.ErrorText>
      ) : ayuda ? (
        <Field.HelperText fontSize="xs" color="ink.500" mt="0.5">
          {ayuda}
        </Field.HelperText>
      ) : null}
    </Field.Root>
  );
}

function NumeroFactura({
  establecimiento,
  puntoExpedicion,
  numero,
  error,
  onEstablecimiento,
  onPuntoExpedicion,
  onNumero,
  soloLectura = false,
}: {
  establecimiento: string;
  puntoExpedicion: string;
  numero: string;
  error?: string;
  onEstablecimiento: (valor: string) => void;
  onPuntoExpedicion: (valor: string) => void;
  onNumero: (valor: string) => void;
  soloLectura?: boolean;
}) {
  const soloDigitos = (valor: string, largo: number) => valor.replace(/\D/g, "").slice(0, largo);

  return (
    <Field.Root invalid={!!error} required id={ID.establecimiento}>
      <Field.Label fontSize="xs" fontWeight="medium" color="ink.800" mb="1">
        Nº Factura
        <Field.RequiredIndicator />
      </Field.Label>
      <Flex align="center" gap="1" w="full">
        <Input
          id={ID.establecimiento}
          aria-label="Establecimiento"
          value={establecimiento}
          onChange={(e) => onEstablecimiento(soloDigitos(e.target.value, 3))}
          inputMode="numeric"
          placeholder="001"
          fontFamily="mono"
          textAlign="center"
          w="3.8rem"
          size="sm"
          flexShrink={0}
          readOnly={soloLectura}
        />
        <Text color="ink.400" fontSize="xs" aria-hidden="true">
          –
        </Text>
        <Input
          id={ID.puntoExpedicion}
          aria-label="Punto de expedición"
          value={puntoExpedicion}
          onChange={(e) => onPuntoExpedicion(soloDigitos(e.target.value, 3))}
          inputMode="numeric"
          placeholder="001"
          fontFamily="mono"
          textAlign="center"
          w="3.8rem"
          size="sm"
          flexShrink={0}
          readOnly={soloLectura}
        />
        <Text color="ink.400" fontSize="xs" aria-hidden="true">
          –
        </Text>
        <Input
          id={ID.numero}
          aria-label="Número"
          value={numero}
          onChange={(e) => onNumero(soloDigitos(e.target.value, 8))}
          inputMode="numeric"
          placeholder="0000123"
          fontFamily="mono"
          size="sm"
          flex="1"
          minW="0"
          readOnly={soloLectura}
        />
      </Flex>
      {error && (
        <Field.ErrorText fontSize="xs" mt="0.5">
          {error}
        </Field.ErrorText>
      )}
    </Field.Root>
  );
}

function BuscadorItemsModal({
  abierto,
  busquedaInicial,
  tipoInicial,
  fechaEmision,
  onCerrar,
  onSeleccionarProducto,
  onSeleccionarServicio,
}: {
  abierto: boolean;
  busquedaInicial: string;
  tipoInicial: TipoCatalogo;
  fechaEmision: string;
  onCerrar: () => void;
  onSeleccionarProducto: (producto: Producto) => void;
  onSeleccionarServicio: (servicio: Servicio) => void;
}) {
  const [tipo, setTipo] = useState<TipoCatalogo>(tipoInicial);
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const [indiceActivo, setIndiceActivo] = useState(0);

  const consultaProductos = useBuscarProductosVenta(busqueda, abierto && tipo === "producto", [], 5);
  const consultaServicios = useBuscarServiciosVenta(
    busqueda,
    abierto && tipo === "servicio",
    [],
    5,
  );

  const productos = consultaProductos.data?.items ?? [];
  const servicios = consultaServicios.data?.items ?? [];
  const resultados = tipo === "producto" ? productos : servicios;
  const consulta = tipo === "producto" ? consultaProductos : consultaServicios;
  const mostrarProductos = tipo === "producto" && busqueda.trim().length > 1;
  // Los servicios se listan aunque la búsqueda esté vacía, así que el combobox
  // siempre está "expandido" en esa pestaña.
  const mostrarResultados = tipo === "producto" ? mostrarProductos : true;
  const indiceSeguro = Math.min(indiceActivo, Math.max(resultados.length - 1, 0));

  function elegirProducto(producto: Producto) {
    if (productoSinStock(producto)) {
      toaster.error({
        title: "Sin stock disponible",
        description: `«${producto.nombre}» no tiene unidades para vender.`,
      });
      return;
    }
    if (productoSinPrecio(producto, fechaEmision)) {
      toaster.error({
        title: "Sin precio de venta vigente",
        description: `«${producto.nombre}» no tiene precio vigente al ${formatFechaCalendario(fechaEmision)}. Cargalo en Productos → Precios.`,
      });
      return;
    }
    onSeleccionarProducto(producto);
    onCerrar();
  }

  function elegirServicio(servicio: Servicio) {
    onSeleccionarServicio(servicio);
    onCerrar();
  }

  function teclas(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndiceActivo((indice) => Math.min(indice + 1, Math.max(resultados.length - 1, 0)));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceActivo((indice) => Math.max(indice - 1, 0));
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      if (tipo === "producto") {
        const elegido = productos[indiceSeguro];
        if (elegido) elegirProducto(elegido);
      } else {
        const elegido = servicios[indiceSeguro];
        if (elegido) elegirServicio(elegido);
      }
    }
  }

  return (
    <DialogRoot
      open={abierto}
      onOpenChange={({ open }) => {
        if (!open) onCerrar();
      }}
      size="xl"
    >
      <DialogContent maxW="min(96vw, 46rem)" p="0" overflow="hidden" position="relative">
        <DialogCloseTrigger />
        <DialogHeader px="5" pt="5" pb="3" borderBottomWidth="1px" borderColor="ink.100">
          <DialogTitle fontSize="md">Agregar ítem a la venta</DialogTitle>
          <DialogDescription fontSize="xs">
            Elegí un producto del inventario o un servicio (consulta, delivery, grooming…).
          </DialogDescription>
        </DialogHeader>

        <DialogBody p="0">
          <Stack gap="3" px="5" py="3" borderBottomWidth="1px" borderColor="ink.100">
            <SegmentedControl
              size="sm"
              value={tipo}
              onValueChange={(detalle) => {
                const valor = String(detalle.value) as TipoCatalogo;
                if (valor !== "producto" && valor !== "servicio") return;
                setTipo(valor);
                setIndiceActivo(0);
              }}
              items={[
                { value: "producto", label: "Productos" },
                { value: "servicio", label: "Servicios" },
              ]}
              w="full"
            />
            <InputGroup startElement={<Search size={15} />}>
              <Input
                value={busqueda}
                onChange={(evento) => {
                  setBusqueda(evento.target.value);
                  setIndiceActivo(0);
                }}
                onKeyDown={teclas}
                size="sm"
                placeholder={
                  tipo === "producto"
                    ? "Nombre, SKU o código de barras..."
                    : "Consulta general, delivery, baño..."
                }
                autoComplete="off"
                autoFocus
                role="combobox"
                aria-expanded={mostrarResultados}
                aria-controls="venta-modal-lista-items"
                aria-autocomplete="list"
              />
            </InputGroup>
          </Stack>

          <Box
            id="venta-modal-lista-items"
            role="listbox"
            maxH="22rem"
            minH="8rem"
            overflowY="auto"
            p="2"
          >
            {tipo === "producto" && !mostrarProductos ? (
              <Flex h="8rem" align="center" justify="center" direction="column" gap="1" color="ink.500">
                <Package size={18} />
                <Text fontSize="xs">Escribí al menos 2 caracteres para buscar un producto.</Text>
              </Flex>
            ) : consulta.isFetching ? (
              <Stack gap="1.5" p="1">
                <Skeleton h="10" borderRadius="md" />
                <Skeleton h="10" borderRadius="md" />
                <Skeleton h="10" borderRadius="md" />
              </Stack>
            ) : consulta.error ? (
              <Alert status="error" rounded="md">
                No se pudo buscar en el catálogo.
              </Alert>
            ) : tipo === "producto" && productos.length ? (
              productos.map((producto, indice) => {
                const activo = indice === indiceSeguro;
                const sinStock = productoSinStock(producto);
                const sinPrecio = productoSinPrecio(producto, fechaEmision);
                const noVendible = sinStock || sinPrecio;
                return (
                  <chakra.button
                    key={producto.id}
                    type="button"
                    role="option"
                    aria-selected={activo}
                    aria-disabled={noVendible}
                    title={
                      sinStock
                        ? "Sin stock disponible"
                        : sinPrecio
                          ? "Sin precio de venta vigente"
                          : undefined
                    }
                    tabIndex={-1}
                    w="full"
                    textAlign="left"
                    px="3"
                    py="2"
                    borderRadius="md"
                    bg={activo ? "brand.50" : "transparent"}
                    opacity={noVendible ? 0.6 : 1}
                    cursor={noVendible ? "not-allowed" : "pointer"}
                    onMouseDown={(evento: React.MouseEvent) => evento.preventDefault()}
                    onMouseEnter={() => setIndiceActivo(indice)}
                    onClick={() => elegirProducto(producto)}
                  >
                    <Flex justify="space-between" align="center" gap="3">
                      <Box minW="0" flex="1">
                        <Text fontSize="sm" fontWeight="semibold" color="ink.900" truncate>
                          {producto.nombre}
                        </Text>
                        <Text fontSize="2xs" color="ink.500" fontFamily="mono" truncate>
                          {producto.codigo} · {producto.unidadMedida}
                          {producto.categoria ? ` · ${producto.categoria.nombre}` : ""}
                        </Text>
                      </Box>
                      <Flex gap="1" flexShrink={0} align="center">
                        {producto.requiereLote && (
                          <Badge colorPalette="purple" variant="subtle" size="xs">
                            Lote
                          </Badge>
                        )}
                        <Badge colorPalette={sinStock ? "red" : "gray"} variant="subtle" size="xs">
                          {sinStock ? "Sin stock" : `Stock ${formatCantidad(producto.stockActual)}`}
                        </Badge>
                        {sinPrecio ? (
                          <Badge colorPalette="orange" variant="subtle" size="xs">
                            Sin precio
                          </Badge>
                        ) : (
                          <Text fontSize="xs" fontWeight="medium" color="ink.700">
                            {formatearMonto(
                              "PYG",
                              precioVentaVigente(producto, fechaEmision),
                            )}
                          </Text>
                        )}
                      </Flex>
                    </Flex>
                  </chakra.button>
                );
              })
            ) : tipo === "servicio" && servicios.length ? (
              servicios.map((servicio, indice) => {
                const activo = indice === indiceSeguro;
                return (
                  <chakra.button
                    key={servicio.id}
                    type="button"
                    role="option"
                    aria-selected={activo}
                    tabIndex={-1}
                    w="full"
                    textAlign="left"
                    px="3"
                    py="2"
                    borderRadius="md"
                    bg={activo ? "brand.50" : "transparent"}
                    onMouseDown={(evento: React.MouseEvent) => evento.preventDefault()}
                    onMouseEnter={() => setIndiceActivo(indice)}
                    onClick={() => elegirServicio(servicio)}
                  >
                    <Flex justify="space-between" align="center" gap="3">
                      <Box minW="0" flex="1">
                        <Flex align="center" gap="2" minW="0">
                          <Text fontSize="sm" fontWeight="semibold" color="ink.900" truncate>
                            {servicio.nombre}
                          </Text>
                          {servicio.categoria && (
                            <Badge colorPalette="teal" variant="subtle" size="xs">
                              {servicio.categoria.nombre}
                            </Badge>
                          )}
                        </Flex>
                        <Text fontSize="2xs" color="ink.500" truncate>
                          {[servicio.codigo, servicio.duracionMin ? `${servicio.duracionMin} min` : null]
                            .filter(Boolean)
                            .join(" · ") || "Servicio"}
                        </Text>
                      </Box>
                      <Text fontSize="xs" fontWeight="medium" color="ink.700" flexShrink={0}>
                        {formatearMonto("PYG", servicio.precio)}
                      </Text>
                    </Flex>
                  </chakra.button>
                );
              })
            ) : (
              <Flex h="8rem" align="center" justify="center" direction="column" gap="1">
                <Text fontSize="sm" fontWeight="medium" color="ink.700">
                  {tipo === "producto" ? "No se encontraron productos." : "No hay servicios para mostrar."}
                </Text>
                <Text fontSize="xs" color="ink.500">
                  {tipo === "producto"
                    ? "Probá con otro nombre, SKU o código de barras."
                    : "Cargá servicios en el módulo Servicios (consulta, delivery, baño…)."}
                </Text>
              </Flex>
            )}
          </Box>

          <Flex
            px="5"
            py="2.5"
            borderTopWidth="1px"
            borderColor="ink.100"
            justify="space-between"
            gap="3"
            color="ink.500"
          >
            <Text fontSize="2xs">F2 abre este catálogo desde cualquier fila vacía.</Text>
            <Text fontSize="2xs">↑↓ navegar · Enter agregar · Esc cerrar</Text>
          </Flex>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}

function NumeroDeFila({ indice, tenue = false }: { indice: number; tenue?: boolean }) {
  return (
    <Text
      fontSize="2xs"
      fontVariantNumeric="tabular-nums"
      color={tenue ? "ink.300" : "ink.400"}
      w="4"
      textAlign="end"
      flexShrink={0}
    >
      {indice}
    </Text>
  );
}

function FilaVenta({
  indice,
  linea,
  moneda,
  error,
  resolviendoSku,
  conAyuda,
  mostrarStock,
  onCambiar,
  onResolverSku,
  onQuitar,
}: {
  indice: number;
  linea: LineaFormularioVenta;
  moneda: MonedaVenta;
  error?: string;
  resolviendoSku: boolean;
  conAyuda: boolean;
  /** En una factura ya emitida el stock actual no aplica: es un documento histórico. */
  mostrarStock: boolean;
  onCambiar: (cambios: Partial<LineaFormularioVenta>) => void;
  onResolverSku: (codigo: string) => void;
  onQuitar: () => void;
}) {
  const producto = linea.producto;
  const servicio = linea.servicio;
  const ocupada = lineaOcupada(linea);
  const calculo = calcularLineaVenta({
    cantidad: ocupada ? aNumero(linea.cantidad) : 0,
    costoUnitario: ocupada ? aNumero(linea.precioUnitario) : 0,
    porcentajeIva: linea.porcentajeIva,
  });
  const celda = { py: "1", px: "2", verticalAlign: "middle" as const };
  const vacio = (
    <Text fontSize="2xs" color="ink.300" textAlign="center">
      —
    </Text>
  );

  const cantidadLlena = aNumero(linea.cantidad) > 0;
  const precioLleno = linea.precioUnitario.trim() !== "";
  const stock = producto ? stockDeProducto(producto) : null;
  const superaStock =
    mostrarStock &&
    producto !== null &&
    stock !== null &&
    aNumero(linea.cantidad) > stock;
  const etiqueta = nombreDeLinea(linea);

  return (
    <Table.Row
      h={ALTO_FILA}
      bg={error ? "red.50" : "white"}
      data-linea-key={linea.key}
      opacity={ocupada ? 1 : 0.85}
    >
      <Table.Cell {...celda} w="2rem" ps="2">
        <NumeroDeFila indice={indice} tenue={!ocupada} />
      </Table.Cell>

      <Table.Cell {...celda} w="7rem">
        {ocupada ? (
          <Text
            fontSize="xs"
            fontFamily="mono"
            fontWeight="medium"
            color="ink.700"
            truncate
            title={linea.codigoSku || undefined}
          >
            {linea.codigoSku || (servicio ? "SERV" : "—")}
          </Text>
        ) : (
          <Input
            id={`sku-${linea.key}`}
            size="xs"
            value={linea.codigoSku}
            onChange={(evento) => onCambiar({ codigoSku: evento.target.value.toUpperCase() })}
            onKeyDown={(evento) => {
              if (evento.key !== "Enter") return;
              evento.preventDefault();
              if (!resolviendoSku) onResolverSku(linea.codigoSku);
            }}
            placeholder="Cód."
            fontFamily="mono"
            autoComplete="off"
            aria-label={`Código de la fila ${indice}`}
            aria-busy={resolviendoSku}
            borderColor={error ? "red.300" : undefined}
          />
        )}
        {resolviendoSku && (
          <Text fontSize="2xs" color="ink.500" mt="0.5">
            Buscando…
          </Text>
        )}
      </Table.Cell>

      <Table.Cell {...celda} minW="12rem">
        {ocupada ? (
          <Box minW="0">
            <Text fontSize="xs" fontWeight="semibold" color="ink.900" truncate title={etiqueta}>
              {etiqueta}
            </Text>
          </Box>
        ) : error ? (
          <Text fontSize="2xs" color="red.600" fontWeight="medium">
            {error}
          </Text>
        ) : conAyuda ? (
          <Text fontSize="2xs" color="ink.400">
            Código + Enter, o F2 para el catálogo de productos y servicios.
          </Text>
        ) : (
          vacio
        )}
        {ocupada && error && (
          <Text fontSize="2xs" color="red.600" fontWeight="medium" role="alert">
            {error}
          </Text>
        )}
        {ocupada && !error && superaStock && (
          <Text fontSize="2xs" color="orange.600" fontWeight="medium">
            Supera el stock disponible ({formatCantidad(stock)}).
          </Text>
        )}
      </Table.Cell>

      <Table.Cell {...celda} w="5.5rem">
        {ocupada ? (
          <Input
            id={`cantidad-${linea.key}`}
            size="xs"
            type="number"
            min="0.0001"
            step="0.0001"
            value={linea.cantidad}
            onChange={(evento) => onCambiar({ cantidad: evento.target.value })}
            aria-label={`Cantidad de ${etiqueta}`}
          />
        ) : (
          vacio
        )}
      </Table.Cell>

      <Table.Cell {...celda} w="10rem">
        {ocupada ? (
          <MoneyInput
            id={`precio-${linea.key}`}
            value={linea.precioUnitario.trim() === "" ? null : aNumero(linea.precioUnitario)}
            onChange={(valor) => onCambiar({ precioUnitario: valor === null ? "" : String(valor) })}
            placeholder="0"
            disabled={!cantidadLlena}
            readOnly={producto !== null}
            simbolo={moneda === "USD" ? "US$" : undefined}
            decimales={moneda === "USD" ? 2 : 0}
          />
        ) : (
          vacio
        )}
      </Table.Cell>

      <Table.Cell {...celda} w="5.5rem">
        {ocupada ? (
          <NativeSelect.Root size="xs" disabled={!precioLleno}>
            <NativeSelect.Field
              value={linea.porcentajeIva}
              onChange={(evento) =>
                onCambiar({ porcentajeIva: Number(evento.target.value) as PorcentajeIvaVenta })
              }
              aria-label={`IVA de ${etiqueta}`}
            >
              <option value="10">10 %</option>
              <option value="5">5 %</option>
              <option value="0">Exento</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        ) : (
          vacio
        )}
      </Table.Cell>

      <Table.Cell {...celda} textAlign="end" minW="6rem">
        {ocupada ? (
          <>
            <Text fontSize="xs" fontWeight="semibold" fontVariantNumeric="tabular-nums" color="ink.900">
              {formatearMonto(moneda, calculo.total)}
            </Text>
            <Text fontSize="2xs" color="ink.500" fontVariantNumeric="tabular-nums">
              IVA {formatearMonto(moneda, calculo.montoIva)}
            </Text>
          </>
        ) : (
          vacio
        )}
      </Table.Cell>

      <Table.Cell {...celda} textAlign="center" w="8">
        {ocupada ? (
          <IconButton
            type="button"
            aria-label={`Quitar ${etiqueta}`}
            title="Quitar"
            size="2xs"
            variant="ghost"
            colorPalette="red"
            onClick={onQuitar}
          >
            <Trash2 size={13} />
          </IconButton>
        ) : null}
      </Table.Cell>
    </Table.Row>
  );
}

function PanelAltaRapida({
  abierto,
  titulo,
  onCerrar,
  children,
}: {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible.Root open={abierto}>
      <Collapsible.Content>
        <Box mt="2" p="3" borderWidth="1px" borderColor="brand.200" borderRadius="md" bg="brand.50">
          <Flex justify="space-between" align="center" mb="2">
            <Text fontSize="xs" fontWeight="bold" color="ink.900">
              {titulo}
            </Text>
            <IconButton
              type="button"
              aria-label={`Cerrar: ${titulo}`}
              size="2xs"
              variant="ghost"
              onClick={onCerrar}
            >
              <X size={12} />
            </IconButton>
          </Flex>
          {children}
        </Box>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

/* ─────────────────────────────────── Formulario ─────────────────────────────────── */

export function VentaForm({
  formId = "venta-form",
  ventaInicial,
  onGuardar,
  errorGeneral,
  datosFiscales,
  soloLectura = false,
}: {
  formId?: string;
  ventaInicial?: Venta | null;
  onGuardar: (datos: VentaPayload) => void;
  errorGeneral?: string | null;
  /**
   * Muestra la venta sin permitir cambios (facturas activas o anuladas).
   * El pie del diálogo expone las acciones válidas para ese estado.
   */
  soloLectura?: boolean;
  /** Datos fiscales de la veterinaria (timbrado, número, punto de expedición, establecimiento).
   * Se muestran de solo lectura; el backend los toma de la configuración al crear. */
  datosFiscales?: {
    numero: number;
    timbrado: string | null;
    puntoExpedicion: string;
    establecimiento: string;
  };
}) {
  const { puede } = useAuth();
  const registrarPago = useRegistrarPagoVenta();

  const [cliente, setCliente] = useState<Cliente | null>(() => clienteDesdeVenta(ventaInicial));
  const [timbrado, setTimbrado] = useState(datosFiscales?.timbrado ?? ventaInicial?.timbrado ?? "");
  const [establecimiento, setEstablecimiento] = useState(
    datosFiscales?.establecimiento ?? ventaInicial?.establecimiento ?? "001",
  );
  const [puntoExpedicion, setPuntoExpedicion] = useState(
    datosFiscales?.puntoExpedicion ?? ventaInicial?.puntoExpedicion ?? "001",
  );
  const [numero, setNumero] = useState(datosFiscales?.numero?.toString() ?? ventaInicial?.numero ?? "");
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobanteVenta>(
    ventaInicial?.tipoComprobante ?? "factura",
  );
  const [fechaEmision, setFechaEmision] = useState(
    soloFecha(ventaInicial?.fechaEmision) || fechaHoyCalendario(),
  );
  const [fechaVencimiento, setFechaVencimiento] = useState(
    soloFecha(ventaInicial?.fechaVencimiento),
  );
  const [condicionPago, setCondicionPago] = useState<CondicionPagoVenta>(
    ventaInicial?.condicionPago ?? "contado",
  );
  const [estadoVenta, setEstadoVenta] = useState<EstadoNuevaVenta>(
    ventaInicial?.estado === "PENDIENTE" ? "PENDIENTE" : "ACTIVA",
  );
  const [moneda, setMoneda] = useState<MonedaVenta>(ventaInicial?.moneda ?? "PYG");
  const [tipoCambio, setTipoCambio] = useState(ventaInicial?.tipoCambio?.toString() ?? "");

  // Cobros: en una venta nueva (o pendiente) se acumulan acá y viajan en `onGuardar`;
  // en una factura ya emitida se registran directo en el backend (ver `agregarPago`).
  const [pagos, setPagos] = useState<PagoLinea[]>([]);
  const [errorCobro, setErrorCobro] = useState<string | null>(null);

  const [lineas, setLineas] = useState<LineaFormularioVenta[]>(() => {
    const iniciales = (ventaInicial?.items ?? []).map(lineaDesdeItem);
    // En solo lectura no tiene sentido agregar filas vacías para cargar ítems.
    return soloLectura ? iniciales : completarFilas(iniciales);
  });

  // El precio de un producto siempre es el vigente a la fecha de emisión: al
  // cambiar la fecha se recalcula. Los servicios conservan su precio editable.
  useEffect(() => {
    setLineas((previas) => {
      let huboCambios = false;
      const siguientes = previas.map((linea) => {
        if (!linea.producto) return linea;
        const precio = precioVentaVigente(linea.producto, fechaEmision);
        const texto = precio > 0 ? String(precio) : "";
        if (linea.precioUnitario === texto) return linea;
        huboCambios = true;
        return { ...linea, precioUnitario: texto };
      });
      return huboCambios ? siguientes : previas;
    });
  }, [fechaEmision]);

  const [errores, setErrores] = useState<Errores>({});
  const [erroresLineas, setErroresLineas] = useState<Record<string, string>>({});
  const [skuEnCurso, setSkuEnCurso] = useState<string | null>(null);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [busquedaBuscador, setBusquedaBuscador] = useState("");
  const [lineaBuscador, setLineaBuscador] = useState<string | null>(null);

  const [altaCliente, setAltaCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    documento: "",
    razonSocial: "",
    nombres: "",
    apellidos: "",
    telefono: "",
    direccion: "",
    email: "",
  });
  const [errorAltaCliente, setErrorAltaCliente] = useState<string | null>(null);
  const crearCliente = useCrearCliente();

  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [listaClientesAbierta, setListaClientesAbierta] = useState(false);
  const clientesBusqueda = useBuscarClientes(busquedaCliente, !cliente);

  const [altaProducto, setAltaProducto] = useState(false);
  const [nuevoProducto, setNuevoProducto] = useState({
    codigo: "",
    nombre: "",
    presentacion: "",
    unidadMedida: "unidad",
    porcentajeIva: "10",
    precioVenta: null as number | null,
    categoriaId: null as number | null,
    requiereLote: false,
    requiereVencimiento: false,
  });
  const [errorAltaProducto, setErrorAltaProducto] = useState<string | null>(null);
  const crearProducto = useCrearProducto();
  const categorias = useCategoriasProducto();

  const esPendiente = estadoVenta === "PENDIENTE";
  const estadoMostrado = ventaInicial?.estado ?? estadoVenta;
  const ventaYaEmitida = !!ventaInicial?.id && ventaInicial.estado === "ACTIVA";
  // Una venta anulada no se cobra y una pendiente todavía no es factura emitida.
  const puedeCobrar = ventaInicial?.estado !== "ANULADA" && !esPendiente;

  const lineasOcupadas = lineas.filter(lineaOcupada);
  const lineasCalculo = lineasOcupadas.map((linea) => ({
    cantidad: aNumero(linea.cantidad),
    costoUnitario: aNumero(linea.precioUnitario),
    porcentajeIva: linea.porcentajeIva,
  }));
  const totales = calcularTotalesVenta(lineasCalculo);
  const primeraVacia = lineas.find((linea) => !lineaOcupada(linea))?.key ?? null;
  const mostrarListaClientes =
    listaClientesAbierta && !cliente && busquedaCliente.trim().length > 1;

  // Sólo se muestran las filas de IVA que tienen monto: menos ruido en el resumen.
  const filasIva = [
    { etiqueta: "IVA 10 %", valor: totales.iva10 },
    { etiqueta: "IVA 5 %", valor: totales.iva5 },
    { etiqueta: "Exenta", valor: totales.exenta },
  ].filter((fila) => Number(fila.valor) > 0);

  function agregarPago(pago: Omit<PagoLinea, "id">) {
    const nuevo: PagoLinea = { ...pago, id: crypto.randomUUID() };
    setErrorCobro(null);

    if (ventaYaEmitida && ventaInicial) {
      registrarPago.mutate(
        { id: ventaInicial.id, pago },
        {
          onSuccess: () => setPagos((previos) => [...previos, nuevo]),
          onError: (error) => setErrorCobro(mensajeDeError(error)),
        },
      );
      return;
    }
    setPagos((previos) => [...previos, nuevo]);
  }

  function cambiarLinea(key: string, cambios: Partial<LineaFormularioVenta>) {
    setLineas((previas) =>
      previas.map((linea) => (linea.key === key ? { ...linea, ...cambios } : linea)),
    );
    setErroresLineas((previos) => {
      const siguiente = { ...previos };
      delete siguiente[key];
      return siguiente;
    });
    setErrores((previos) => ({ ...previos, lineas: undefined }));
  }

  function quitarLinea(key: string) {
    setLineas((previas) => completarFilas(previas.filter((linea) => linea.key !== key)));
    setErroresLineas((previos) => {
      const siguiente = { ...previos };
      delete siguiente[key];
      return siguiente;
    });
    setErrores((previos) => ({ ...previos, lineas: undefined }));
  }

  function colocarLinea(base: LineaFormularioVenta, keyDestino?: string | null) {
    const destino =
      (keyDestino
        ? lineas.find((linea) => linea.key === keyDestino && !lineaOcupada(linea))
        : undefined) ?? lineas.find((linea) => !lineaOcupada(linea));
    const aplicada = destino
      ? { ...base, key: destino.key, cantidad: destino.cantidad || "1" }
      : base;

    setLineas((previas) =>
      completarFilas(
        destino
          ? previas.map((linea) => (linea.key === aplicada.key ? aplicada : linea))
          : [...previas, aplicada],
      ),
    );
    setErroresLineas((previos) => {
      const siguiente = { ...previos };
      delete siguiente[aplicada.key];
      return siguiente;
    });
    setErrores((previos) => ({ ...previos, lineas: undefined }));
    setLineaBuscador(null);
    window.setTimeout(() => document.getElementById(idPrimerCampo(aplicada))?.focus(), 60);
  }

  function agregarProducto(
    producto: Producto,
    keyDestino?: string | null,
    opciones: { permitirSinStock?: boolean } = {},
  ) {
    // Un producto sin stock no se puede vender: se avisa y no se agrega.
    // La excepción es el alta rápida, que crea el producto con stock 0.
    if (!opciones.permitirSinStock && productoSinStock(producto)) {
      setErroresLineas((previos) => ({
        ...previos,
        [keyDestino ?? primeraVacia ?? ""]: `«${producto.nombre}» no tiene stock disponible.`,
      }));
      toaster.error({
        title: "Sin stock disponible",
        description: `«${producto.nombre}» no tiene unidades para vender.`,
      });
      return;
    }
    if (productoSinPrecio(producto, fechaEmision)) {
      setErroresLineas((previos) => ({
        ...previos,
        [keyDestino ?? primeraVacia ?? ""]: `«${producto.nombre}» no tiene precio de venta vigente al ${formatFechaCalendario(fechaEmision)}.`,
      }));
      toaster.error({
        title: "Sin precio de venta vigente",
        description: `«${producto.nombre}» no tiene precio vigente al ${formatFechaCalendario(fechaEmision)}. Cargalo en Productos → Precios.`,
      });
      return;
    }
    // Como la tabla ya no pide lote, un mismo producto no puede repetirse.
    const yaExiste = lineas.some((linea) => linea.producto?.id === producto.id);
    if (yaExiste) {
      setErroresLineas((previos) => ({
        ...previos,
        [keyDestino ?? primeraVacia ?? ""]: `El producto «${producto.nombre}» ya está en la tabla.`,
      }));
      return;
    }
    colocarLinea(lineaDesdeProducto(producto, fechaEmision), keyDestino);
  }

  function agregarServicio(servicio: Servicio, keyDestino?: string | null) {
    const yaExiste = lineas.some((linea) => linea.servicio?.id === servicio.id);
    if (yaExiste) {
      setErroresLineas((previos) => ({
        ...previos,
        [keyDestino ?? primeraVacia ?? ""]: `El servicio «${servicio.nombre}» ya está en la tabla.`,
      }));
      return;
    }
    colocarLinea(lineaDesdeServicio(servicio), keyDestino);
  }

  function cerrarBuscador() {
    setBuscadorAbierto(false);
    setLineaBuscador(null);
    setBusquedaBuscador("");
  }

  async function resolverSku(key: string, codigo: string) {
    const codigoLimpio = codigo.trim().toUpperCase();
    if (!codigoLimpio) {
      setErroresLineas((previos) => ({ ...previos, [key]: "Ingresá un código." }));
      return;
    }

    const linea = lineas.find((actual) => actual.key === key);
    if (!linea || lineaOcupada(linea) || skuEnCurso) return;

    setSkuEnCurso(key);
    setErroresLineas((previos) => {
      const siguiente = { ...previos };
      delete siguiente[key];
      return siguiente;
    });

    try {
      const producto = await buscarProductoPorCodigoVenta(codigoLimpio);
      if (producto) {
        agregarProducto(producto, key);
        return;
      }

      const servicio = await buscarServicioPorCodigoVenta(codigoLimpio);
      if (servicio) {
        agregarServicio(servicio, key);
        return;
      }

      setErroresLineas((previos) => ({
        ...previos,
        [key]: `No existe «${codigoLimpio}». F2 busca productos o servicios.`,
      }));
    } catch (error) {
      setErroresLineas((previos) => ({
        ...previos,
        [key]: mensajeDeError(error),
      }));
    } finally {
      setSkuEnCurso(null);
    }
  }

  useEffect(() => {
    function alPresionarF2(evento: KeyboardEvent) {
      if (soloLectura || evento.key !== "F2" || evento.repeat) return;

      const objetivo = evento.target instanceof HTMLElement ? evento.target : null;

      // F2 dentro del campo Cliente no debe abrir el catálogo de productos:
      // enfoca el campo y despliega el filtro inline que ya vive ahí.
      if (objetivo?.closest("[data-campo-cliente]")) {
        evento.preventDefault();
        setListaClientesAbierta(true);
        document.getElementById(ID.cliente)?.focus();
        return;
      }

      if (buscadorAbierto) return;

      const fila = objetivo?.closest<HTMLElement>("[data-linea-key]") ?? null;
      evento.preventDefault();
      const key = fila?.dataset.lineaKey ?? null;
      const linea = key ? lineas.find((actual) => actual.key === key) : undefined;
      const pendiente = linea && !lineaOcupada(linea) ? linea : undefined;
      setLineaBuscador(pendiente?.key ?? null);
      setBusquedaBuscador(pendiente?.codigoSku ?? "");
      setBuscadorAbierto(true);
    }

    window.addEventListener("keydown", alPresionarF2);
    return () => window.removeEventListener("keydown", alPresionarF2);
  }, [buscadorAbierto, lineas, soloLectura]);

  async function guardarClienteRapido() {
    setErrorAltaCliente(null);
    if (!nuevoCliente.documento.trim()) {
      setErrorAltaCliente("Ingresá el documento del cliente.");
      return;
    }
    if (!nuevoCliente.razonSocial.trim() && !nuevoCliente.nombres.trim()) {
      setErrorAltaCliente("Ingresá razón social o nombre y apellido.");
      return;
    }

    try {
      const creado = await crearCliente.mutateAsync({
        cedula:
          nuevoCliente.documento.replace(/\D/g, "").length <= 10
            ? nuevoCliente.documento
            : undefined,
        ruc:
          nuevoCliente.documento.replace(/\D/g, "").length >= 11
            ? nuevoCliente.documento
            : undefined,
        razonSocial: nuevoCliente.razonSocial || undefined,
        nombres: nuevoCliente.nombres || undefined,
        apellidos: nuevoCliente.apellidos || undefined,
        telefono: nuevoCliente.telefono || undefined,
        direccion: nuevoCliente.direccion || undefined,
        email: nuevoCliente.email || undefined,
        activo: true,
      });
      setCliente(creado);
      setAltaCliente(false);
      setNuevoCliente({
        documento: "",
        razonSocial: "",
        nombres: "",
        apellidos: "",
        telefono: "",
        direccion: "",
        email: "",
      });
      setErrores((previos) => ({ ...previos, cliente: undefined }));
      toaster.success({
        title: "Cliente registrado",
        description: nombreCliente(creado),
      });
    } catch (error) {
      setErrorAltaCliente(mensajeDeError(error));
    }
  }

  async function guardarProductoRapido() {
    setErrorAltaProducto(null);
    if (nuevoProducto.nombre.trim().length < 2) {
      setErrorAltaProducto("Ingresá el nombre del producto.");
      return;
    }
    if (!nuevoProducto.precioVenta || nuevoProducto.precioVenta <= 0) {
      setErrorAltaProducto(
        "Ingresá un precio de venta mayor a cero para poder facturarlo.",
      );
      return;
    }

    try {
      const creado = await crearProducto.mutateAsync({
        codigo: nuevoProducto.codigo.trim() || undefined,
        nombre: nuevoProducto.nombre,
        presentacion: nuevoProducto.presentacion || undefined,
        unidadMedida: nuevoProducto.unidadMedida,
        porcentajeIva: Number(nuevoProducto.porcentajeIva),
        categoriaId: nuevoProducto.categoriaId,
        esMedicamento: false,
        esControlado: false,
        requiereReceta: false,
        requiereLote: nuevoProducto.requiereLote,
        requiereVencimiento: nuevoProducto.requiereVencimiento,
        precioVenta: nuevoProducto.precioVenta,
        precioCosto: 0,
        precios: [
          {
            tipo: "venta",
            monto: nuevoProducto.precioVenta,
            vigenteDesde: fechaEmision,
            vigenteHasta: null,
          },
        ],
        stockMinimo: 0,
        proveedorId: null,
        activo: true,
      });
      agregarProducto(creado, null, { permitirSinStock: true });
      setAltaProducto(false);
      setNuevoProducto({
        codigo: "",
        nombre: "",
        presentacion: "",
        unidadMedida: "unidad",
        porcentajeIva: "10",
        precioVenta: null,
        categoriaId: null,
        requiereLote: false,
        requiereVencimiento: false,
      });
      toaster.success({
        title: "Producto creado",
        description: "Ya está agregado a esta venta.",
      });
    } catch (error) {
      setErrorAltaProducto(mensajeDeError(error));
    }
  }

  function validar(): { nuevos: Errores; porLinea: Record<string, string> } {
    const nuevos: Errores = {};
    const erroresPorLinea: Record<string, string> = {};

    if (!cliente) nuevos.cliente = "Seleccioná el cliente.";
    if (!fechaEmision) nuevos.fechaEmision = "Indicá la fecha de emisión.";
    if (condicionPago === "credito" && !fechaVencimiento) {
      nuevos.fechaVencimiento = "Una venta a crédito necesita vencimiento.";
    }
    if (fechaVencimiento && fechaEmision && fechaVencimiento < fechaEmision) {
      nuevos.fechaVencimiento = "No puede ser anterior a la emisión.";
    }
    if (moneda === "USD" && aNumero(tipoCambio) <= 0) {
      nuevos.tipoCambio = "Indicá un tipo de cambio mayor a cero.";
    }
    if (!lineasOcupadas.length) {
      nuevos.lineas = "Agregá al menos un producto o servicio a la venta.";
    }

    const claves = new Set<string>();
    for (const linea of lineasOcupadas) {
      const producto = linea.producto;
      const servicio = linea.servicio;
      let error: string | undefined;

      if (producto && productoSinPrecio(producto, fechaEmision)) {
        error = `Sin precio de venta vigente al ${formatFechaCalendario(fechaEmision)}.`;
      } else if (aNumero(linea.cantidad) <= 0) {
        error = "La cantidad debe ser mayor a cero.";
      } else if (linea.precioUnitario.trim() === "") {
        error = "Indicá el precio unitario.";
      } else if (aNumero(linea.precioUnitario) < 0) {
        error = "El precio no puede ser negativo.";
      }

      // Las ventas no piden lote ni vencimiento: sólo se evita repetir el ítem.
      const clave = producto
        ? `p:${producto.id}|${linea.codigoLote.trim().toUpperCase()}`
        : `s:${servicio!.id}`;
      if (!error && claves.has(clave)) {
        error = producto
          ? "Este producto ya está cargado."
          : "Este servicio ya está cargado.";
      }
      claves.add(clave);
      if (error) erroresPorLinea[linea.key] = error;
    }

    setErrores(nuevos);
    setErroresLineas(erroresPorLinea);
    return { nuevos, porLinea: erroresPorLinea };
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (soloLectura) return;
    const { nuevos, porLinea } = validar();
    const primero = ORDEN_CAMPOS.find((campo) => nuevos[campo]);
    if (primero) {
      document.getElementById(ID[primero])?.focus();
      return;
    }
    if (nuevos.lineas) {
      document.getElementById("venta-buscador-items")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }
    const lineaConError = lineas.find((linea) => porLinea[linea.key]);
    if (lineaConError) {
      document.getElementById(idPrimerCampo(lineaConError))?.focus();
      return;
    }
    if (!cliente) return;

    const items: VentaItemPayload[] = [];
    for (const linea of lineasOcupadas) {
      if (linea.producto) {
        items.push({
          tipoItem: "producto",
          productoId: linea.producto.id,
          servicioId: null,
          cantidad: aNumero(linea.cantidad),
          costoUnitario: precioVentaVigente(linea.producto, fechaEmision),
          porcentajeIva: linea.porcentajeIva,
          ...(linea.descripcion.trim() ? { descripcion: linea.descripcion.trim() } : {}),
          // Sólo viaja el lote que ya traía una venta pendiente; acá ya no se edita.
          ...(linea.producto.requiereLote && linea.codigoLote.trim()
            ? { codigoLote: linea.codigoLote.trim().toUpperCase() }
            : {}),
          ...(linea.producto.requiereVencimiento && linea.fechaVencimiento
            ? { fechaVencimiento: linea.fechaVencimiento }
            : {}),
        });
        continue;
      }
      if (linea.servicio) {
        items.push({
          tipoItem: "servicio",
          productoId: null,
          servicioId: linea.servicio.id,
          cantidad: aNumero(linea.cantidad),
          costoUnitario: aNumero(linea.precioUnitario),
          porcentajeIva: linea.porcentajeIva,
          descripcion: linea.descripcion.trim() || linea.servicio.nombre,
        });
      }
    }

    onGuardar({
      clienteId: cliente.id,
      tipoComprobante,
      fechaEmision,
      ...(fechaVencimiento ? { fechaVencimiento } : {}),
      condicionPago,
      moneda,
      estado: estadoVenta,
      ...(moneda === "USD" ? { tipoCambio: aNumero(tipoCambio) } : {}),
      items,
      // Los cobros de una factura ya emitida se registraron uno a uno: no se reenvían.
      ...(!ventaYaEmitida && !esPendiente && pagos.length
        ? {
            pagos: pagos.map(
              ({ metodo, monto, referencia }) =>
                ({ metodo, monto, referencia }) as PagoVentaPayload,
            ),
          }
        : {}),
    });
  }

  const errorNumeroFactura = errores.establecimiento ?? errores.puntoExpedicion ?? errores.numero;
  const quitarCobroLocal = ventaYaEmitida
    ? undefined
    : (id: string) => setPagos((previos) => previos.filter((pago) => pago.id !== id));

  return (
    <chakra.form id={formId} onSubmit={enviar} noValidate>
      {/*
        Dos columnas desde `xl`: a la izquierda se arma la venta (datos, ítems,
        notas) y a la derecha, siempre a la vista, quedan el resumen y el cobro.
        Por debajo de `xl` la columna lateral baja debajo de los ítems.
      */}
      <Grid
        templateColumns={{ base: "1fr", xl: "minmax(0, 1fr) 21rem" }}
        gap="4"
        alignItems="start"
      >
        <chakra.fieldset disabled={soloLectura} borderWidth="0" p="0" m="0" minW="0">
          <Stack gap="4">
            {soloLectura && ventaInicial?.estado === "ANULADA" && (
              <Alert status="warning" rounded="md" title="Venta anulada">
                {ventaInicial.anuladaMotivo ?? "Esta venta fue anulada."}
                {ventaInicial.anuladaEn ? ` · ${formatFecha(ventaInicial.anuladaEn)}` : ""}
              </Alert>
            )}

            {soloLectura && ventaInicial?.estado === "ACTIVA" && (
              <Alert status="info" rounded="md" title="Factura activa">
                Está emitida y ya descontó stock. Para modificarla tenés que anularla; mientras
                tanto podés registrar cobros.
              </Alert>
            )}

            {errorGeneral && (
              <Alert status="error" rounded="md" title="No pudimos guardar la venta">
                {errorGeneral}
              </Alert>
            )}

            {errores.lineas && (
              <Alert status="warning" rounded="md" title="Faltan ítems">
                {errores.lineas}
              </Alert>
            )}

            {/* ── Datos de la venta ───────────────────────────────────────── */}
            <Box borderWidth="1px" borderColor="ink.200" borderRadius="lg" p="4" bg="white">
              <Box>
                <Campo
                  id={ID.cliente}
                  etiqueta="Cliente"
                  requerido
                  error={errores.cliente}
                  ayuda={cliente ? undefined : "Escribí al menos 2 caracteres para filtrar."}
                >
                  <Flex gap="1.5" align="flex-start" w="full" data-campo-cliente>
                    <Box flex="1" minW="0">
                      <Box
                        position="relative"
                        onBlur={(evento) => {
                          if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) {
                            setListaClientesAbierta(false);
                          }
                        }}
                      >
                        <InputGroup
                          w="full"
                          startElement={<Search size={14} />}
                          endElement={
                            cliente ? (
                              <IconButton
                                type="button"
                                size="2xs"
                                variant="ghost"
                                aria-label="Quitar cliente"
                                title="Quitar cliente"
                                onClick={() => {
                                  setCliente(null);
                                  setBusquedaCliente("");
                                  setListaClientesAbierta(false);
                                }}
                              >
                                <X size={12} />
                              </IconButton>
                            ) : undefined
                          }
                        >
                          <Input
                            id={ID.cliente}
                            size="sm"
                            value={cliente ? etiquetaCliente(cliente) : busquedaCliente}
                            onChange={(evento) => {
                              const valor = evento.target.value;
                              if (cliente) setCliente(null);
                              setBusquedaCliente(valor);
                              setListaClientesAbierta(true);
                              setErrores((previos) => ({ ...previos, cliente: undefined }));
                            }}
                            onFocus={() => {
                              if (!cliente) setListaClientesAbierta(true);
                            }}
                            onKeyDown={(evento) => {
                              if (evento.key === "Escape") setListaClientesAbierta(false);
                            }}
                            placeholder="Nombre, RUC o cédula..."
                            readOnly={!!cliente}
                            title={cliente ? "Quitá el cliente con la X para buscar otro" : undefined}
                            autoComplete="off"
                            role="combobox"
                            aria-expanded={mostrarListaClientes}
                            aria-controls="venta-lista-clientes"
                            aria-autocomplete="list"
                          />
                        </InputGroup>

                        {mostrarListaClientes && (
                          <Box
                            id="venta-lista-clientes"
                            role="listbox"
                            position="absolute"
                            top="100%"
                            left="0"
                            w="full"
                            maxW="34rem"
                            mt="1"
                            bg="white"
                            borderWidth="1px"
                            borderColor="ink.200"
                            borderRadius="md"
                            boxShadow="lg"
                            zIndex="10"
                            maxH="200px"
                            overflowY="auto"
                          >
                            {clientesBusqueda.isFetching ? (
                              <Stack gap="1.5" p="2">
                                <Skeleton h="8" borderRadius="md" />
                                <Skeleton h="8" borderRadius="md" />
                              </Stack>
                            ) : clientesBusqueda.isError ? (
                              <Text fontSize="xs" color="red.600" px="3" py="2">
                                No se pudo buscar clientes.
                              </Text>
                            ) : !clientesBusqueda.data?.length ? (
                              <Text fontSize="xs" color="ink.500" px="3" py="2">
                                Sin coincidencias. Podés dar de alta un cliente.
                              </Text>
                            ) : (
                              clientesBusqueda.data.map((c) => (
                                <Box
                                  key={c.id}
                                  role="option"
                                  aria-selected={false}
                                  px="3"
                                  py="2"
                                  cursor="pointer"
                                  _hover={{ bg: "brand.50" }}
                                  onMouseDown={(evento: React.MouseEvent) => evento.preventDefault()}
                                  onClick={() => {
                                    setCliente(c);
                                    setBusquedaCliente("");
                                    setListaClientesAbierta(false);
                                    setErrores((previos) => ({ ...previos, cliente: undefined }));
                                  }}
                                >
                                  <Text fontSize="sm" fontWeight="medium">
                                    {nombreCliente(c)}
                                  </Text>
                                  <Text fontSize="2xs" color="ink.500" fontFamily="mono">
                                    {documentoDeCliente(c)}
                                  </Text>
                                </Box>
                              ))
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>

                    {!soloLectura && puede("clientes.crear") && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        colorPalette="brand"
                        flexShrink={0}
                        onClick={() => setAltaCliente((previo) => !previo)}
                        aria-expanded={altaCliente}
                      >
                        <Plus size={14} /> Nuevo
                      </Button>
                    )}
                  </Flex>
                </Campo>
              </Box>

              <PanelAltaRapida
                abierto={altaCliente}
                titulo="Alta rápida de cliente"
                onCerrar={() => setAltaCliente(false)}
              >
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="2.5">
                  <Campo etiqueta="Documento">
                    <Input
                      size="sm"
                      value={nuevoCliente.documento}
                      onChange={(evento) =>
                        setNuevoCliente((previo) => ({ ...previo, documento: evento.target.value }))
                      }
                      placeholder="Cédula/RUC"
                      bg="white"
                    />
                  </Campo>
                  <Campo etiqueta="Razón social">
                    <Input
                      size="sm"
                      value={nuevoCliente.razonSocial}
                      onChange={(evento) =>
                        setNuevoCliente((previo) => ({ ...previo, razonSocial: evento.target.value }))
                      }
                      placeholder="Si es empresa"
                      bg="white"
                    />
                  </Campo>
                  <Campo etiqueta="Nombres">
                    <Input
                      size="sm"
                      value={nuevoCliente.nombres}
                      onChange={(evento) =>
                        setNuevoCliente((previo) => ({ ...previo, nombres: evento.target.value }))
                      }
                      bg="white"
                    />
                  </Campo>
                  <Campo etiqueta="Apellidos">
                    <Input
                      size="sm"
                      value={nuevoCliente.apellidos}
                      onChange={(evento) =>
                        setNuevoCliente((previo) => ({ ...previo, apellidos: evento.target.value }))
                      }
                      bg="white"
                    />
                  </Campo>
                  <Campo etiqueta="Teléfono">
                    <Input
                      size="sm"
                      value={nuevoCliente.telefono}
                      onChange={(evento) =>
                        setNuevoCliente((previo) => ({ ...previo, telefono: evento.target.value }))
                      }
                      placeholder="0981 000 000"
                      bg="white"
                    />
                  </Campo>
                  <Campo etiqueta="Correo">
                    <Input
                      size="sm"
                      type="email"
                      value={nuevoCliente.email}
                      onChange={(evento) =>
                        setNuevoCliente((previo) => ({ ...previo, email: evento.target.value }))
                      }
                      bg="white"
                    />
                  </Campo>
                </Grid>
                {errorAltaCliente && (
                  <Alert status="error" rounded="md" mt="2">
                    {errorAltaCliente}
                  </Alert>
                )}
                <Flex justify="flex-end" gap="2" mt="2">
                  <Button type="button" variant="ghost" size="xs" onClick={() => setAltaCliente(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    colorPalette="brand"
                    loading={crearCliente.isPending}
                    onClick={() => void guardarClienteRapido()}
                  >
                    Guardar
                  </Button>
                </Flex>
              </PanelAltaRapida>

              {/* Condiciones de la venta */}
              <Grid
                templateColumns={{
                  base: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(12, minmax(0, 1fr))",
                }}
                gap="3"
                alignItems="start"
                mt="3"
              >
                <Box gridColumn={{ base: "auto", md: "span 3" }}>
                  <Campo
                    id={ID.fechaEmision}
                    etiqueta="Fecha de emisión"
                    requerido
                    error={errores.fechaEmision}
                  >
                    <Input
                      id={ID.fechaEmision}
                      size="sm"
                      type="date"
                      value={fechaEmision}
                      onChange={(evento) => {
                        setFechaEmision(evento.target.value);
                        setErrores((previos) => ({ ...previos, fechaEmision: undefined }));
                      }}
                    />
                  </Campo>
                </Box>

                <Box gridColumn={{ base: "auto", md: "span 3" }}>
                  <Campo etiqueta="Condición de pago">
                    <NativeSelect.Root size="sm">
                      <NativeSelect.Field
                        value={condicionPago}
                        onChange={(evento) => {
                          const valor = evento.target.value as CondicionPagoVenta;
                          setCondicionPago(valor);
                          if (valor === "contado") {
                            setFechaVencimiento("");
                            setErrores((previos) => ({ ...previos, fechaVencimiento: undefined }));
                          }
                        }}
                      >
                        <option value="contado">Contado</option>
                        <option value="credito">Crédito</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Campo>
                </Box>

                {condicionPago === "credito" && (
                  <Box gridColumn={{ base: "auto", md: "span 3" }}>
                    <Campo
                      id={ID.fechaVencimiento}
                      etiqueta="Vencimiento del pago"
                      requerido
                      error={errores.fechaVencimiento}
                    >
                      <Input
                        id={ID.fechaVencimiento}
                        size="sm"
                        type="date"
                        value={fechaVencimiento}
                        min={fechaEmision || undefined}
                        onChange={(evento) => {
                          setFechaVencimiento(evento.target.value);
                          setErrores((previos) => ({ ...previos, fechaVencimiento: undefined }));
                        }}
                      />
                    </Campo>
                  </Box>
                )}

                <Box gridColumn={{ base: "auto", md: "span 3" }}>
                  <Campo etiqueta="Moneda">
                    <NativeSelect.Root size="sm">
                      <NativeSelect.Field
                        value={moneda}
                        onChange={(e) => {
                          const val = e.target.value as MonedaVenta;
                          setMoneda(val);
                          if (val === "PYG") {
                            setTipoCambio("");
                            setErrores((p) => ({ ...p, tipoCambio: undefined }));
                          }
                        }}
                      >
                        <option value="PYG">Guaraní (₲)</option>
                        <option value="USD">Dólar (US$)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Campo>
                </Box>

                {moneda === "USD" && (
                  <Box gridColumn={{ base: "auto", md: "span 3" }}>
                    <Campo
                      id={ID.tipoCambio}
                      etiqueta="Tipo de cambio"
                      requerido
                      error={errores.tipoCambio}
                    >
                      <Input
                        id={ID.tipoCambio}
                        size="sm"
                        type="number"
                        min="0"
                        step="0.01"
                        value={tipoCambio}
                        onChange={(evento) => {
                          setTipoCambio(evento.target.value);
                          setErrores((previos) => ({ ...previos, tipoCambio: undefined }));
                        }}
                        placeholder="7300"
                      />
                    </Campo>
                  </Box>
                )}

                <Box gridColumn={{ base: "auto", md: "span 3" }}>
                  <Campo etiqueta="Estado">
                    {soloLectura ? (
                      <Badge
                        colorPalette={ESTADOS_VENTA_FORM[estadoMostrado].paleta}
                        variant="subtle"
                        size="sm"
                        alignSelf="flex-start"
                        mt="1"
                      >
                        {ESTADOS_VENTA_FORM[estadoMostrado].etiqueta}
                      </Badge>
                    ) : (
                      <NativeSelect.Root size="sm">
                        <NativeSelect.Field
                          value={estadoVenta}
                          onChange={(e) => setEstadoVenta(e.target.value as EstadoNuevaVenta)}
                        >
                          <option value="ACTIVA">Activa</option>
                          <option value="PENDIENTE">Pendiente</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    )}
                  </Campo>
                </Box>
              </Grid>

              {/* Datos del comprobante: casi siempre vienen de la configuración fiscal */}
              <Box borderTopWidth="1px" borderColor="ink.100" mt="3.5" pt="3">
           
                <Grid
                  templateColumns={{
                    base: "1fr",
                    md: "repeat(12, minmax(0, 1fr))",
                  }}
                  gap="3"
                  alignItems="start"
                >
                  <Box gridColumn={{ base: "auto", md: "span 4" }}>
                    <Campo etiqueta="Tipo">
                      <NativeSelect.Root size="sm">
                        <NativeSelect.Field
                          value={tipoComprobante}
                          onChange={(evento) =>
                            setTipoComprobante(evento.target.value as TipoComprobanteVenta)
                          }
                        >
                          <option value="factura">Factura</option>
                          <option value="factura_credito_fiscal">Factura crédito fiscal</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Campo>
                  </Box>
                  <Box gridColumn={{ base: "auto", md: "span 3" }}>
                    <Campo id={ID.timbrado} etiqueta="Timbrado" requerido error={errores.timbrado}>
                      <Input
                        id={ID.timbrado}
                        size="sm"
                        value={timbrado}
                        onChange={(evento) => {
                          setTimbrado(evento.target.value.replace(/\D/g, "").slice(0, 8));
                          setErrores((previos) => ({ ...previos, timbrado: undefined }));
                        }}
                        placeholder="12345678"
                        inputMode="numeric"
                        fontFamily="mono"
                        readOnly={!!datosFiscales || !!ventaInicial}
                      />
                    </Campo>
                  </Box>
                  <Box gridColumn={{ base: "auto", md: "span 5" }}>
                    <NumeroFactura
                      establecimiento={establecimiento}
                      puntoExpedicion={puntoExpedicion}
                      numero={numero}
                      error={errorNumeroFactura}
                      soloLectura={!!datosFiscales || !!ventaInicial}
                      onEstablecimiento={(valor) => {
                        setEstablecimiento(valor);
                        setErrores((previos) => ({
                          ...previos,
                          establecimiento: undefined,
                          puntoExpedicion: undefined,
                          numero: undefined,
                        }));
                      }}
                      onPuntoExpedicion={(valor) => {
                        setPuntoExpedicion(valor);
                        setErrores((previos) => ({
                          ...previos,
                          establecimiento: undefined,
                          puntoExpedicion: undefined,
                          numero: undefined,
                        }));
                      }}
                      onNumero={(valor) => {
                        setNumero(valor);
                        setErrores((previos) => ({
                          ...previos,
                          establecimiento: undefined,
                          puntoExpedicion: undefined,
                          numero: undefined,
                        }));
                      }}
                    />
                  </Box>
                </Grid>
              </Box>
            </Box>

            {/* ── Ítems ───────────────────────────────────────────────────── */}
            <Box id="venta-buscador-items">
              <Flex gap="2" align="center" justify="space-between" mb="2" wrap="wrap">
                <Flex align="baseline" gap="2" minW="0">
                  <Text fontSize="sm" fontWeight="bold" color="ink.900">
                    Ítems de la venta
                  </Text>
                  <Text fontSize="2xs" color="ink.500">
                    {soloLectura
                      ? "Detalle de los ítems facturados."
                      : "Productos y servicios. Enter en el código, o F2 para el catálogo."}
                  </Text>
                </Flex>
                <Flex gap="2" align="center" flexShrink={0} wrap="wrap">
                  {lineasOcupadas.length > 0 && (
                    <Badge colorPalette="brand" variant="subtle" size="sm">
                      {lineasOcupadas.length} {lineasOcupadas.length === 1 ? "ítem" : "ítems"}
                    </Badge>
                  )}
                  {!soloLectura && puede("productos.crear") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAltaProducto((p) => !p)}
                      aria-expanded={altaProducto}
                    >
                      <Plus size={14} /> Nuevo producto
                    </Button>
                  )}
                </Flex>
              </Flex>

              {altaProducto && (
                <PanelAltaRapida
                  abierto={altaProducto}
                  titulo="Alta rápida de producto"
                  onCerrar={() => setAltaProducto(false)}
                >
                  <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="2.5">
                    <Campo etiqueta="Código interno (SKU)">
                      <Input
                        size="sm"
                        value={nuevoProducto.codigo}
                        onChange={(evento) =>
                          setNuevoProducto((previo) => ({
                            ...previo,
                            codigo: evento.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="Opcional"
                        bg="white"
                      />
                    </Campo>
                    <Campo etiqueta="Categoría">
                      <NativeSelect.Root size="sm">
                        <NativeSelect.Field
                          value={nuevoProducto.categoriaId ?? ""}
                          onChange={(evento) =>
                            setNuevoProducto((previo) => ({
                              ...previo,
                              categoriaId: evento.target.value ? Number(evento.target.value) : null,
                            }))
                          }
                          bg="white"
                        >
                          <option value="">Sin categoría</option>
                          {categorias.data?.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.nombre}
                            </option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Campo>
                    <Campo etiqueta="Nombre" requerido>
                      <Input
                        size="sm"
                        value={nuevoProducto.nombre}
                        onChange={(evento) =>
                          setNuevoProducto((previo) => ({ ...previo, nombre: evento.target.value }))
                        }
                        placeholder="Ej.: Amoxicilina 500 mg"
                        bg="white"
                      />
                    </Campo>
                    <Campo etiqueta="Presentación">
                      <Input
                        size="sm"
                        value={nuevoProducto.presentacion}
                        onChange={(evento) =>
                          setNuevoProducto((previo) => ({
                            ...previo,
                            presentacion: evento.target.value,
                          }))
                        }
                        bg="white"
                      />
                    </Campo>
                    <Campo etiqueta="Unidad">
                      <NativeSelect.Root size="sm">
                        <NativeSelect.Field
                          value={nuevoProducto.unidadMedida}
                          onChange={(evento) =>
                            setNuevoProducto((previo) => ({
                              ...previo,
                              unidadMedida: evento.target.value,
                            }))
                          }
                          bg="white"
                        >
                          {UNIDADES_MEDIDA.map((unidad) => (
                            <option key={unidad} value={unidad}>
                              {unidad}
                            </option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Campo>
                    <Campo etiqueta="Precio de venta" requerido>
                      <MoneyInput
                        value={nuevoProducto.precioVenta}
                        onChange={(valor) =>
                          setNuevoProducto((previo) => ({
                            ...previo,
                            precioVenta: valor,
                          }))
                        }
                        ariaLabel="Precio de venta del producto nuevo"
                      />
                    </Campo>
                    <Campo etiqueta="IVA">
                      <NativeSelect.Root size="sm">
                        <NativeSelect.Field
                          value={nuevoProducto.porcentajeIva}
                          onChange={(evento) =>
                            setNuevoProducto((previo) => ({
                              ...previo,
                              porcentajeIva: evento.target.value,
                            }))
                          }
                          bg="white"
                        >
                          <option value="10">10 %</option>
                          <option value="5">5 %</option>
                          <option value="0">Exento</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </Campo>
                  </Grid>
                  <Flex
                    align="center"
                    justify="space-between"
                    gap="2"
                    mt="2"
                    p="2"
                    borderWidth="1px"
                    borderColor="ink.200"
                    borderRadius="md"
                    bg="white"
                  >
                    <Text fontSize="xs" fontWeight="medium" color="ink.900">
                      Controla lote y vencimiento
                    </Text>
                    <Switch
                      checked={nuevoProducto.requiereLote}
                      onCheckedChange={(detalle) =>
                        setNuevoProducto((previo) => ({
                          ...previo,
                          requiereLote: detalle.checked === true,
                          requiereVencimiento: detalle.checked === true,
                        }))
                      }
                      colorPalette="brand"
                      size="sm"
                      aria-label="Controla lote y vencimiento"
                    />
                  </Flex>
                  {errorAltaProducto && (
                    <Alert status="error" rounded="md" mt="2">
                      {errorAltaProducto}
                    </Alert>
                  )}
                  <Flex justify="flex-end" gap="2" mt="2">
                    <Button type="button" variant="ghost" size="xs" onClick={() => setAltaProducto(false)}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      colorPalette="brand"
                      loading={crearProducto.isPending}
                      onClick={() => void guardarProductoRapido()}
                    >
                      Crear y agregar
                    </Button>
                  </Flex>
                </PanelAltaRapida>
              )}

              <Table.ScrollArea
                maxH={ALTO_MAXIMO_TABLA}
                overflowY="auto"
                borderWidth="1px"
                borderColor="ink.200"
                borderRadius="md"
                bg="white"
              >
                <Table.Root size="sm" minW="48rem">
                  <Table.Header position="sticky" top="0" zIndex="1" bg="ink.50">
                    <Table.Row bg="ink.50">
                      <Table.ColumnHeader py="1.5" w="2rem" ps="2">
                        #
                      </Table.ColumnHeader>
                      <Table.ColumnHeader py="1.5" w="7rem">
                        Código
                      </Table.ColumnHeader>
                      <Table.ColumnHeader py="1.5">Descripción</Table.ColumnHeader>
                      <Table.ColumnHeader py="1.5" w="5.5rem">
                        Cant.
                      </Table.ColumnHeader>
                      <Table.ColumnHeader py="1.5" w="10rem">
                        Precio
                      </Table.ColumnHeader>
                      <Table.ColumnHeader py="1.5" w="5.5rem">
                        IVA
                      </Table.ColumnHeader>
                      <Table.ColumnHeader py="1.5" textAlign="end">
                        Total
                      </Table.ColumnHeader>
                      <Table.ColumnHeader py="1.5" w="8" />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {lineas.map((linea, idx) => (
                      <FilaVenta
                        key={linea.key}
                        indice={idx + 1}
                        linea={linea}
                        moneda={moneda}
                        error={erroresLineas[linea.key]}
                        resolviendoSku={skuEnCurso === linea.key}
                        conAyuda={linea.key === primeraVacia && lineasOcupadas.length === 0}
                        mostrarStock={!soloLectura}
                        onCambiar={(cambios) => cambiarLinea(linea.key, cambios)}
                        onResolverSku={(codigo) => void resolverSku(linea.key, codigo)}
                        onQuitar={() => quitarLinea(linea.key)}
                      />
                    ))}
                  </Table.Body>
                </Table.Root>
              </Table.ScrollArea>
            </Box>
          </Stack>
        </chakra.fieldset>

        {/*
          Columna lateral: queda fuera del fieldset a propósito. Una factura activa
          está en solo lectura, pero igual tiene que poder cobrarse.
        */}
        <Stack
          gap="3"
          position={{ xl: "sticky" }}
          top={{ xl: "0" }}
          maxH={{ xl: "calc(100dvh - 8rem)" }}
          overflowY={{ xl: "auto" }}
        >
          <Box bg="brand.900" color="white" borderRadius="lg" p="3.5">
            <Flex align="center" justify="space-between" gap="2" mb="2.5">
              <Text fontSize="xs" fontWeight="bold">
                Resumen
              </Text>
              <Flex gap="1">
                <Badge
                  colorPalette={estadoMostrado === "ANULADA" ? "red" : esPendiente ? "orange" : "green"}
                  variant="solid"
                  size="xs"
                >
                  {ESTADOS_VENTA_FORM[estadoMostrado].etiqueta}
                </Badge>
                <Badge colorPalette="brand" variant="solid" size="xs">
                  {lineasCalculo.length} {lineasCalculo.length === 1 ? "ítem" : "ítems"}
                </Badge>
              </Flex>
            </Flex>
            <Stack gap="1.5" fontSize="xs">
              <Flex justify="space-between" gap="2">
                <Text color="brand.200">Subtotal</Text>
                <Text fontWeight="semibold" fontVariantNumeric="tabular-nums">
                  {formatearMonto(moneda, totales.subtotal)}
                </Text>
              </Flex>
              {filasIva.map((fila) => (
                <Flex key={fila.etiqueta} justify="space-between" gap="2">
                  <Text color="brand.200">{fila.etiqueta}</Text>
                  <Text fontVariantNumeric="tabular-nums">{formatearMonto(moneda, fila.valor)}</Text>
                </Flex>
              ))}
              {filasIva.length > 1 && (
                <Flex justify="space-between" gap="2">
                  <Text color="brand.200">IVA total</Text>
                  <Text fontVariantNumeric="tabular-nums">{formatearMonto(moneda, totales.iva)}</Text>
                </Flex>
              )}
            </Stack>
            <Box borderTopWidth="1px" borderColor="brand.700" mt="2.5" pt="2.5">
              <Flex justify="space-between" align="flex-end" gap="2">
                <Text fontSize="xs" color="brand.200">
                  Total ({moneda})
                </Text>
                <Text fontSize="xl" fontWeight="bold" fontVariantNumeric="tabular-nums" lineHeight="1">
                  {formatearMonto(moneda, totales.total)}
                </Text>
              </Flex>
            </Box>
            {condicionPago === "credito" && fechaVencimiento && (
              <Flex align="center" gap="1" mt="2" color="brand.200" fontSize="2xs">
                <CalendarDays size={12} />
                Vence el {formatFechaCalendario(fechaVencimiento)}
              </Flex>
            )}
          </Box>

          {puedeCobrar && (
            <>
              {errorCobro && (
                <Alert status="error" rounded="md" title="No se pudo registrar el cobro">
                  {errorCobro}
                </Alert>
              )}
              <CobroVenta
                total={Number(totales.total)}
                moneda={moneda}
                condicionPago={condicionPago}
                pagos={pagos}
                formatear={(valor) => formatearMonto(moneda, valor)}
                cargando={registrarPago.isPending}
                onAgregar={agregarPago}
                onQuitar={quitarCobroLocal}
              />
            </>
          )}

          {!puedeCobrar && !soloLectura && (
            <Text fontSize="2xs" color="ink.500" px="1">
              Las ventas pendientes no se cobran: pasá la venta a Activa para registrar cobros.
            </Text>
          )}
        </Stack>
      </Grid>

      {buscadorAbierto && (
        <BuscadorItemsModal
          key={`${lineaBuscador ?? "libre"}:${busquedaBuscador}`}
          abierto
          busquedaInicial={busquedaBuscador}
          tipoInicial="producto"
          fechaEmision={fechaEmision}
          onCerrar={cerrarBuscador}
          onSeleccionarProducto={(producto) => agregarProducto(producto, lineaBuscador)}
          onSeleccionarServicio={(servicio) => agregarServicio(servicio, lineaBuscador)}
        />
      )}
    </chakra.form>
  );
}