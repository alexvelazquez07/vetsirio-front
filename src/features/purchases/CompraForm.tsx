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
  Textarea,
  chakra,
} from "@chakra-ui/react";
import {
  CalendarDays,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import { Switch } from "@/components/ui/switch";
import { toaster } from "@/components/ui/toaster";
import { MoneyInput } from "@/components/fields/MoneyInput";
import { useAuth } from "@/features/auth/auth.store";
import {
  mensajeDeError,
  useCrearProveedor,
  useProveedoresOpciones,
  type ProveedorOpcion,
} from "@/features/clients/clients.service";
import {
  useCrearProducto,
  UNIDADES_MEDIDA,
  useCategoriasProducto,
} from "@/features/products/products.service";
import {
  formatCantidad,
  formatFechaCalendario,
  formatMoneda,
  formatMonedaUSD,
} from "@/lib/formato";
import { http } from "@/services/api";
import type { Producto, RespuestaUpload } from "@/types/dominio";
import {
  calcularLineaCompra,
  calcularTotalesCompra,
  fechaHoyCalendario,
  type PorcentajeIvaCompra,
} from "./purchases.calculo";
import {
  buscarProductoPorCodigo,
  useBuscarProductosCompra,
  type Compra,
  type CompraItemPayload,
  type CompraPayload,
  type CondicionPagoCompra,
  type MonedaCompra,
  type TipoComprobanteCompra,
} from "./purchases.service";

/* ──────────────────────────────── Tipos y datos ──────────────────────────────── */

export interface LineaFormulario {
  key: string;
  producto: Producto | null;
  codigoSku: string;
  cantidad: string;
  costoUnitario: string;
  porcentajeIva: PorcentajeIvaCompra;
  codigoLote: string;
  fechaVencimiento: string;
  descripcion: string;
}

interface Errores {
  proveedor?: string;
  timbrado?: string;
  establecimiento?: string;
  puntoExpedicion?: string;
  numero?: string;
  fechaEmision?: string;
  fechaVencimiento?: string;
  tipoCambio?: string;
  lineas?: string;
}

type EstadoNuevaCompra = "PENDIENTE" | "ACTIVA";

const ID = {
  proveedor: "compra-proveedor",
  timbrado: "compra-timbrado",
  establecimiento: "compra-establecimiento",
  puntoExpedicion: "compra-punto-expedicion",
  numero: "compra-numero",
  fechaEmision: "compra-fecha-emision",
  fechaVencimiento: "compra-fecha-vencimiento",
  tipoCambio: "compra-tipo-cambio",
} as const;

const ORDEN_CAMPOS: (keyof typeof ID)[] = [
  "proveedor",
  "timbrado",
  "establecimiento",
  "puntoExpedicion",
  "numero",
  "fechaEmision",
  "fechaVencimiento",
  "tipoCambio",
];

/**
 * La tabla de ítems siempre muestra al menos esta cantidad de filas (con o sin
 * productos). A partir de la sexta se activa el scroll interno, así el
 * formulario no cambia de alto al cargar la factura.
 */
const FILAS_MINIMAS = 5;
const ALTO_FILA = "2.75rem";
/** Encabezado (~2 rem) + 5 filas compactas, con un peque��o margen. */
const ALTO_MAXIMO_TABLA = "16.5rem";

/* ─────────────────────────────────── Utilidades ─────────────────────────────────── */

function nuevaLinea(): LineaFormulario {
  return {
    key: crypto.randomUUID(),
    producto: null,
    codigoSku: "",
    cantidad: "1",
    costoUnitario: "",
    porcentajeIva: 5,
    codigoLote: "",
    fechaVencimiento: "",
    descripcion: "",
  };
}

function lineaDesdeProducto(producto: Producto): LineaFormulario {
  const iva = [0, 5, 10].includes(producto.porcentajeIva)
    ? (producto.porcentajeIva as PorcentajeIvaCompra)
    : 5;

  return {
    ...nuevaLinea(),
    producto,
    codigoSku: producto.codigo,
    porcentajeIva: iva,
  };
}

function completarFilas(lineas: LineaFormulario[]): LineaFormulario[] {
  const conProducto = lineas.filter((linea) => linea.producto).length;
  const vacias = lineas.length - conProducto;
  const faltantes = Math.max(0, FILAS_MINIMAS - lineas.length, 1 - vacias);

  if (faltantes === 0) return lineas;
  return [...lineas, ...Array.from({ length: faltantes }, () => nuevaLinea())];
}

function aNumero(valor: string): number {
  const numero = Number(valor.replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
}

function formatearMonto(
  moneda: MonedaCompra,
  valor: number | string | null | undefined,
): string {
  return moneda === "USD" ? formatMonedaUSD(valor) : formatMoneda(valor);
}

function idPrimerCampo(linea: LineaFormulario): string {
  const producto = linea.producto;
  if (!producto) return `sku-${linea.key}`;
  if (producto.requiereLote) return `lote-${linea.key}`;
  if (producto.requiereVencimiento) return `vencimiento-${linea.key}`;
  return `costo-${linea.key}`;
}

/** Los `<input type="date">` sólo aceptan AAAA-MM-DD, aunque la API mande una fecha con hora. */
function soloFecha(valor?: string | null): string {
  return valor ? valor.slice(0, 10) : "";
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
    <Field.Root invalid={!!error} required={requerido} ids={id ? { control: id } : undefined}>
      <Field.Label fontSize="xs" fontWeight="medium" color="ink.800" mb="1">
        {etiqueta}
        {requerido && <Field.RequiredIndicator />}
      </Field.Label>
      {children}
      {error ? (
        <Field.ErrorText fontSize="xs" mt="0.5">{error}</Field.ErrorText>
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
}: {
  establecimiento: string;
  puntoExpedicion: string;
  numero: string;
  error?: string;
  onEstablecimiento: (valor: string) => void;
  onPuntoExpedicion: (valor: string) => void;
  onNumero: (valor: string) => void;
}) {
  const soloDigitos = (valor: string, largo: number) => valor.replace(/\D/g, "").slice(0, largo);

  return (
    <Field.Root invalid={!!error} required ids={{ control: ID.establecimiento }}>
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
        />
        <Text color="ink.400" fontSize="xs" aria-hidden="true">–</Text>
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
        />
        <Text color="ink.400" fontSize="xs" aria-hidden="true">–</Text>
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
        />
      </Flex>
      {error && <Field.ErrorText fontSize="xs" mt="0.5">{error}</Field.ErrorText>}
    </Field.Root>
  );
}

function BuscadorProductosModal({
  abierto,
  busquedaInicial,
  onCerrar,
  onSeleccionar,
}: {
  abierto: boolean;
  busquedaInicial: string;
  onCerrar: () => void;
  onSeleccionar: (producto: Producto) => void;
}) {
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const [indiceActivo, setIndiceActivo] = useState(0);
  const consulta = useBuscarProductosCompra(busqueda, abierto, [], 5);
  const resultados = consulta.data?.items ?? [];
  const mostrarResultados = busqueda.trim().length > 1;
  const indiceSeguro = Math.min(indiceActivo, Math.max(resultados.length - 1, 0));

  function elegir(producto: Producto) {
    onSeleccionar(producto);
    onCerrar();
  }

  function teclas(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndiceActivo((indice) =>
        Math.min(indice + 1, Math.max(resultados.length - 1, 0)),
      );
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceActivo((indice) => Math.max(indice - 1, 0));
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      const elegido = resultados[indiceSeguro];
      if (elegido) elegir(elegido);
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
          <DialogTitle fontSize="md">Buscar producto</DialogTitle>
          <DialogDescription fontSize="xs">
            Buscá por nombre, SKU o código de barras. Enter agrega el producto seleccionado.
          </DialogDescription>
        </DialogHeader>

        <DialogBody p="0">
          <Box px="5" py="3" borderBottomWidth="1px" borderColor="ink.100">
            <Box position="relative">
              <Box
                position="absolute"
                left="2.5"
                top="50%"
                transform="translateY(-50%)"
                color="ink.400"
                pointerEvents="none"
                zIndex="1"
              >
                <Search size={15} />
              </Box>
              <Input
                value={busqueda}
                onChange={(evento) => {
                  setBusqueda(evento.target.value);
                  setIndiceActivo(0);
                }}
                onKeyDown={teclas}
                ps="8"
                size="sm"
                placeholder="Nombre, SKU o código de barras..."
                autoComplete="off"
                autoFocus
                role="combobox"
                aria-expanded={mostrarResultados}
                aria-controls="compra-modal-lista-productos"
                aria-autocomplete="list"
                aria-label="Buscar producto para agregar a la compra"
              />
            </Box>
          </Box>

          <Box
            id="compra-modal-lista-productos"
            role="listbox"
            maxH="22rem"
            minH="8rem"
            overflowY="auto"
            p="2"
          >
            {!mostrarResultados ? (
              <Flex h="8rem" align="center" justify="center" direction="column" gap="1" color="ink.500">
                <Search size={18} />
                <Text fontSize="xs">Escribí al menos 2 caracteres para buscar.</Text>
              </Flex>
            ) : consulta.isFetching ? (
              <Stack gap="1.5" p="1">
                <Skeleton h="10" borderRadius="md" />
                <Skeleton h="10" borderRadius="md" />
                <Skeleton h="10" borderRadius="md" />
              </Stack>
            ) : consulta.error ? (
              <Alert status="error" rounded="md">
                No se pudieron buscar los productos.
              </Alert>
            ) : resultados.length ? (
              resultados.map((producto, indice) => {
                const activo = indice === indiceSeguro;
                return (
                  <chakra.button
                    key={producto.id}
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
                    onClick={() => elegir(producto)}
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
                        <Badge
                          colorPalette={Number(producto.stockActual) > 0 ? "gray" : "red"}
                          variant="subtle"
                          size="xs"
                        >
                          Stock {formatCantidad(producto.stockActual)}
                        </Badge>
                      </Flex>
                    </Flex>
                  </chakra.button>
                );
              })
            ) : (
              <Flex h="8rem" align="center" justify="center" direction="column" gap="1">
                <Text fontSize="sm" fontWeight="medium" color="ink.700">
                  No se encontraron productos.
                </Text>
                <Text fontSize="xs" color="ink.500">
                  Probá con otro nombre, SKU o código de barras.
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
            <Text fontSize="2xs">F2 abre esta búsqueda desde cualquier fila.</Text>
            <Text fontSize="2xs">↑↓ navegar · Enter agregar · Esc cerrar</Text>
          </Flex>
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}

/** Número de fila, siempre en la misma columna que el nombre del producto. */
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

function FilaCompra({
  indice,
  linea,
  moneda,
  error,
  resolviendoSku,
  conAyuda,
  onCambiar,
  onResolverSku,
  onQuitar,
}: {
  indice: number;
  linea: LineaFormulario;
  moneda: MonedaCompra;
  error?: string;
  resolviendoSku: boolean;
  conAyuda: boolean;
  onCambiar: (cambios: Partial<LineaFormulario>) => void;
  onResolverSku: (codigo: string) => void;
  onQuitar: () => void;
}) {
  const producto = linea.producto;
  const calculo = calcularLineaCompra({
    cantidad: producto ? aNumero(linea.cantidad) : 0,
    costoUnitario: producto ? aNumero(linea.costoUnitario) : 0,
    porcentajeIva: linea.porcentajeIva,
  });
  const celda = { py: "1", px: "2", verticalAlign: "middle" as const };
  const vacio = (
    <Text fontSize="2xs" color="ink.300" textAlign="center">
      —
    </Text>
  );

  const loteLleno = producto?.requiereLote ? linea.codigoLote.trim().length > 0 : true;
  const vencimientoLleno = producto?.requiereVencimiento
    ? linea.fechaVencimiento.trim().length > 0
    : true;
  const cantidadLlena = aNumero(linea.cantidad) > 0;
  const costoLleno = aNumero(linea.costoUnitario) >= 0;

  return (
    <Table.Row
      h={ALTO_FILA}
      bg={error ? "red.50" : "white"}
      data-linea-key={linea.key}
      opacity={producto ? 1 : 0.85}
    >
      <Table.Cell {...celda} w="2rem" ps="2">
        <NumeroDeFila indice={indice} tenue={!producto} />
      </Table.Cell>

      <Table.Cell {...celda} w="7rem">
        {producto ? (
          <Text
            fontSize="xs"
            fontFamily="mono"
            fontWeight="medium"
            color="ink.700"
            truncate
            title={producto.codigo}
          >
            {producto.codigo}
          </Text>
        ) : (
          <Input
            id={`sku-${linea.key}`}
            size="xs"
            value={linea.codigoSku}
            onChange={(evento) =>
              onCambiar({ codigoSku: evento.target.value.toUpperCase() })
            }
            onKeyDown={(evento) => {
              if (evento.key !== "Enter") return;
              evento.preventDefault();
              if (!resolviendoSku) onResolverSku(linea.codigoSku);
            }}
            placeholder="SKU"
            fontFamily="mono"
            autoComplete="off"
            aria-label={`SKU de la fila ${indice}`}
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
        {producto ? (
          <Box minW="0">
            <Text
              fontSize="xs"
              fontWeight="semibold"
              color="ink.900"
              truncate
              title={producto.nombre}
            >
              {producto.nombre}
            </Text>
          </Box>
        ) : error ? (
          <Text fontSize="2xs" color="red.600" fontWeight="medium">
            {error}
          </Text>
        ) : conAyuda ? (
          <Text fontSize="2xs" color="ink.400">
            Ingresá el SKU y presioná Enter. F2 busca por nombre.
          </Text>
        ) : (
          <Text fontSize="2xs" color="ink.300" textAlign="center">
            —
          </Text>
        )}
        {producto && error && (
          <Text fontSize="2xs" color="red.600" fontWeight="medium" role="alert">
            {error}
          </Text>
        )}
      </Table.Cell>

      <Table.Cell {...celda} w="6.5rem">
        {producto?.requiereLote ? (
          <Input
            id={`lote-${linea.key}`}
            size="xs"
            value={linea.codigoLote}
            onChange={(evento) => onCambiar({ codigoLote: evento.target.value.toUpperCase() })}
            placeholder="Lote"
            fontFamily="mono"
            aria-label={`Lote de ${producto.nombre}`}
          />
        ) : (
          vacio
        )}
      </Table.Cell>

      <Table.Cell {...celda} w="8rem">
        {producto?.requiereVencimiento ? (
          <Input
            id={`vencimiento-${linea.key}`}
            size="xs"
            type="date"
            value={linea.fechaVencimiento}
            onChange={(evento) => onCambiar({ fechaVencimiento: evento.target.value })}
            aria-label={`Vencimiento de ${producto.nombre}`}
            disabled={!loteLleno}
          />
        ) : (
          vacio
        )}
      </Table.Cell>

      <Table.Cell {...celda} w="5.5rem">
        {producto ? (
          <Input
            size="xs"
            type="number"
            min="0.0001"
            step="0.0001"
            value={linea.cantidad}
            onChange={(evento) => onCambiar({ cantidad: evento.target.value })}
            aria-label={`Cantidad de ${producto.nombre}`}
            disabled={!vencimientoLleno}
          />
        ) : (
          vacio
        )}
      </Table.Cell>

      <Table.Cell {...celda} w="6.5rem">
        {producto ? (
          <MoneyInput
            id={`costo-${linea.key}`}
            value={aNumero(linea.costoUnitario) || null}
            onChange={(valor) => onCambiar({ costoUnitario: valor?.toString() ?? "" })}
            placeholder="0"
            disabled={!cantidadLlena}
            aria-label={`Costo unitario de ${producto.nombre}`}
          />
        ) : (
          vacio
        )}
      </Table.Cell>

      <Table.Cell {...celda} w="5.5rem">
        {producto ? (
            <NativeSelect.Root size="xs" disabled={!costoLleno}>
              <NativeSelect.Field
                value={linea.porcentajeIva}
                onChange={(evento) =>
                  onCambiar({ porcentajeIva: Number(evento.target.value) as PorcentajeIvaCompra })
                }
                aria-label={`IVA de ${producto.nombre}`}
              >
              <option value="5">5 %</option>
              <option value="10">10 %</option>
              <option value="0">Exento</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        ) : (
          vacio
        )}
      </Table.Cell>

      <Table.Cell {...celda} textAlign="end" minW="6rem">
        {producto ? (
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
        {producto ? (
          <IconButton
            type="button"
            aria-label={`Quitar ${producto.nombre}`}
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
        <Box
          mt="2"
          p="3"
          borderWidth="1px"
          borderColor="brand.200"
          borderRadius="md"
          bg="brand.50"
        >
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

export function CompraForm({
  formId = "compra-form",
  compraInicial,
  onGuardar,
  errorGeneral,
}: {
  formId?: string;
  compraInicial?: Compra | null;
  onGuardar: (datos: CompraPayload) => void;
  errorGeneral?: string | null;
}) {
  const { puede } = useAuth();

  const [proveedor, setProveedor] = useState<ProveedorOpcion | null>(
    compraInicial
      ? {
          id: Number(compraInicial.proveedor?.id ?? 0),
          documento: compraInicial.proveedor.documento,
          razonSocial: compraInicial.proveedor.razonSocial,
          nombreFantasia: compraInicial.proveedor.nombreFantasia,
          nombreMostrable: compraInicial.proveedorRazonSocial ?? compraInicial.proveedor.razonSocial,
        }
      : null,
  );

  const [timbrado, setTimbrado] = useState(compraInicial?.timbrado ?? "");
  const [establecimiento, setEstablecimiento] = useState(compraInicial?.establecimiento ?? "001");
  const [puntoExpedicion, setPuntoExpedicion] = useState(compraInicial?.puntoExpedicion ?? "001");
  const [numero, setNumero] = useState(compraInicial?.numero ?? "");
  const [tipoComprobante, setTipoComprobante] = useState<TipoComprobanteCompra>(
    (compraInicial?.tipoComprobante as TipoComprobanteCompra) ?? "factura",
  );
  const [fechaEmision, setFechaEmision] = useState(
    soloFecha(compraInicial?.fechaEmision) || fechaHoyCalendario(),
  );
  const [fechaVencimiento, setFechaVencimiento] = useState(soloFecha(compraInicial?.fechaVencimiento));
  const [condicionPago, setCondicionPago] = useState<CondicionPagoCompra>(
    (compraInicial?.condicionPago as CondicionPagoCompra) ?? "contado",
  );
  const [estadoCompra, setEstadoCompra] = useState<EstadoNuevaCompra>(
    compraInicial?.estado === "PENDIENTE" ? "PENDIENTE" : "ACTIVA",
  );
  const [moneda, setMoneda] = useState<MonedaCompra>((compraInicial?.moneda as MonedaCompra) ?? "PYG");
  const [tipoCambio, setTipoCambio] = useState(compraInicial?.tipoCambio?.toString() ?? "");
  const [observaciones, setObservaciones] = useState(compraInicial?.observaciones ?? "");
  const [archivoUrl, setArchivoUrl] = useState(compraInicial?.archivoUrl ?? "");

  const [subiendo, setSubiendo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  // Mapeo con tipado flexible (any) para tolerar propiedades parciales de la API.
  const [lineas, setLineas] = useState<LineaFormulario[]>(() => {
    const cargadas = (compraInicial?.items ?? []).map((item: any): LineaFormulario => ({
      key: crypto.randomUUID(),
      producto: item.producto
        ? ({
            id: item.producto.id ?? item.productoId ?? 0,
            nombre: item.producto.nombre ?? item.descripcion ?? "Producto",
            codigo: item.producto.codigo ?? item.codigo ?? "",
            unidadMedida: item.producto.unidadMedida ?? item.unidadMedida ?? "unidad",
            porcentajeIva: item.porcentajeIva ?? 5,
            stockActual: 0,
            requiereLote: !!item.lote || !!item.codigoLote,
            requiereVencimiento: !!item.lote?.fechaVencimiento || !!item.fechaVencimiento,
            esMedicamento: false,
            esControlado: false,
            requiereReceta: false,
            precioVenta: 0,
            precioCosto: Number(item.costoUnitario ?? 0),
            stockMinimo: 0,
            activo: true,
          } as Producto)
        : null,
      codigoSku: item.producto?.codigo ?? item.codigo ?? "",
      cantidad: (item.cantidad ?? 1).toString(),
      costoUnitario: (item.costoUnitario ?? 0).toString(),
      porcentajeIva: (item.porcentajeIva ?? 5) as PorcentajeIvaCompra,
      codigoLote: item.lote?.codigoLote ?? item.codigoLote ?? "",
      fechaVencimiento: soloFecha(item.lote?.fechaVencimiento ?? item.fechaVencimiento),
      descripcion: item.descripcion ?? "",
    }));

    return completarFilas(cargadas);
  });

  const [errores, setErrores] = useState<Errores>({});
  const [erroresLineas, setErroresLineas] = useState<Record<string, string>>({});
  const [skuEnCurso, setSkuEnCurso] = useState<string | null>(null);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [busquedaBuscador, setBusquedaBuscador] = useState("");
  const [lineaBuscador, setLineaBuscador] = useState<string | null>(null);

  const [altaProveedor, setAltaProveedor] = useState(false);
  const [nuevoProveedor, setNuevoProveedor] = useState({
    documento: "",
    razonSocial: "",
    telefono: "",
    direccion: "",
    email: "",
  });
  const [errorAltaProveedor, setErrorAltaProveedor] = useState<string | null>(null);
  const crearProveedor = useCrearProveedor();
  const proveedores = useProveedoresOpciones();

  const [altaProducto, setAltaProducto] = useState(false);
  const [nuevoProducto, setNuevoProducto] = useState<{
    codigo: string;
    nombre: string;
    presentacion: string;
    unidadMedida: string;
    porcentajeIva: string;
    categoriaId: number | null;
    requiereLote: boolean;
    requiereVencimiento: boolean;
  }>({
    codigo: "",
    nombre: "",
    presentacion: "",
    unidadMedida: "unidad",
    porcentajeIva: "5",
    categoriaId: null,
    requiereLote: false,
    requiereVencimiento: false,
  });
  const [errorAltaProducto, setErrorAltaProducto] = useState<string | null>(null);
  const crearProducto = useCrearProducto();
  const categorias = useCategoriasProducto();

  const lineasConProducto = lineas.filter((linea) => linea.producto);
  const lineasCalculo = lineasConProducto.map((linea) => ({
    cantidad: aNumero(linea.cantidad),
    costoUnitario: aNumero(linea.costoUnitario),
    porcentajeIva: linea.porcentajeIva,
  }));
  const totales = calcularTotalesCompra(lineasCalculo);
  const primeraVacia = lineas.find((linea) => !linea.producto)?.key ?? null;

  function cambiarLinea(key: string, cambios: Partial<LineaFormulario>) {
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
  }

  function agregarProducto(producto: Producto, keyDestino?: string | null) {
    const yaExiste = lineas.some(
      (linea) => linea.producto?.id === producto.id,
    );
    if (yaExiste) {
      setErroresLineas((previos) => ({
        ...previos,
        [keyDestino ?? ""]: `El producto «${producto.nombre}» ya está en la tabla.`,
      }));
      return;
    }

    const destino =
      (keyDestino
        ? lineas.find((linea) => linea.key === keyDestino && !linea.producto)
        : undefined) ?? lineas.find((linea) => !linea.producto);
    const base = destino
      ? {
          ...lineaDesdeProducto(producto),
          key: destino.key,
          cantidad: destino.cantidad || "1",
        }
      : lineaDesdeProducto(producto);

    setLineas((previas) =>
      completarFilas(
        destino
          ? previas.map((linea) => (linea.key === base.key ? base : linea))
          : [...previas, base],
      ),
    );
    setErroresLineas((previos) => {
      const siguiente = { ...previos };
      delete siguiente[base.key];
      return siguiente;
    });
    setErrores((previos) => ({ ...previos, lineas: undefined }));
    setLineaBuscador(null);
    window.setTimeout(() => document.getElementById(idPrimerCampo(base))?.focus(), 60);
  }

  function abrirBuscador(key: string | null = null) {
    const linea = key ? lineas.find((actual) => actual.key === key) : undefined;
    const pendiente = linea && !linea.producto ? linea : undefined;
    setLineaBuscador(pendiente?.key ?? null);
    setBusquedaBuscador(pendiente?.codigoSku ?? "");
    setBuscadorAbierto(true);
  }

  function cerrarBuscador() {
    setBuscadorAbierto(false);
    setLineaBuscador(null);
    setBusquedaBuscador("");
  }

  async function resolverSku(key: string, codigo: string) {
    const codigoLimpio = codigo.trim().toUpperCase();

    if (!codigoLimpio) {
      setErroresLineas((previos) => ({ ...previos, [key]: "Ingresá un SKU." }));
      return;
    }

    const linea = lineas.find((actual) => actual.key === key);
    if (!linea || linea.producto || skuEnCurso) return;

    setSkuEnCurso(key);
    setErroresLineas((previos) => {
      const siguiente = { ...previos };
      delete siguiente[key];
      return siguiente;
    });

    try {
      const producto = await buscarProductoPorCodigo(codigoLimpio);

      if (!producto) {
        setErroresLineas((previos) => ({
          ...previos,
          [key]: `No existe el SKU «${codigoLimpio}». Presioná F2 para buscar.`,
        }));
        return;
      }

      const yaExiste = lineas.some((l) => l.producto?.id === producto.id);
      if (yaExiste) {
        setErroresLineas((previos) => ({
          ...previos,
          [key]: `El producto «${producto.nombre}» ya está en la tabla.`,
        }));
        return;
      }

      agregarProducto(producto, key);
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
      if (evento.key !== "F2" || evento.repeat || buscadorAbierto) return;
      const objetivo =
        evento.target instanceof HTMLElement
          ? evento.target.closest<HTMLElement>("[data-linea-key]")
          : null;

      evento.preventDefault();

      const key = objetivo?.dataset.lineaKey ?? null;
      const linea = key ? lineas.find((actual) => actual.key === key) : undefined;
      const pendiente = linea && !linea.producto ? linea : undefined;
      setLineaBuscador(pendiente?.key ?? null);
      setBusquedaBuscador(pendiente?.codigoSku ?? "");
      setBuscadorAbierto(true);
    }

    window.addEventListener("keydown", alPresionarF2);
    return () => window.removeEventListener("keydown", alPresionarF2);
  }, [buscadorAbierto, lineas]);

  async function guardarProveedorRapido() {
    setErrorAltaProveedor(null);

    if (!/^\d{8,11}$/.test(nuevoProveedor.documento.replace(/\D/g, ""))) {
      setErrorAltaProveedor("El RUC debe tener entre 8 y 11 dígitos.");
      return;
    }

    if (nuevoProveedor.razonSocial.trim().length < 3) {
      setErrorAltaProveedor("Ingresá la razón social del proveedor.");
      return;
    }

    try {
      const creado = await crearProveedor.mutateAsync({
        documento: nuevoProveedor.documento,
        razonSocial: nuevoProveedor.razonSocial,
        telefono: nuevoProveedor.telefono || undefined,
        direccion: nuevoProveedor.direccion || undefined,
        email: nuevoProveedor.email || undefined,
        activo: true,
      });

      setProveedor({
        id: creado.id,
        documento: creado.documento,
        razonSocial: creado.razonSocial,
        nombreFantasia: creado.nombreFantasia,
        nombreMostrable: creado.nombreMostrable ?? creado.razonSocial,
      });
      setAltaProveedor(false);
      setNuevoProveedor({
        documento: "",
        razonSocial: "",
        telefono: "",
        direccion: "",
        email: "",
      });
      setErrores((previos) => ({ ...previos, proveedor: undefined }));
      toaster.success({
        title: "Proveedor registrado",
        description: creado.nombreMostrable ?? creado.razonSocial,
      });
    } catch (error) {
      setErrorAltaProveedor(mensajeDeError(error));
    }
  }

  async function guardarProductoRapido() {
    setErrorAltaProducto(null);

    if (nuevoProducto.nombre.trim().length < 2) {
      setErrorAltaProducto("Ingresá el nombre del producto.");
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
        precioVenta: 0,
        precioCosto: 0,
        stockMinimo: 0,
        proveedorId: proveedor?.id ?? null,
        activo: true,
      });

      agregarProducto(creado);
      setAltaProducto(false);
      setNuevoProducto({
        codigo: "",
        nombre: "",
        presentacion: "",
        unidadMedida: "unidad",
        porcentajeIva: "5",
        categoriaId: null,
        requiereLote: false,
        requiereVencimiento: false,
      });
      toaster.success({
        title: "Producto creado",
        description: "Ya está agregado a esta compra.",
      });
    } catch (error) {
      setErrorAltaProducto(mensajeDeError(error));
    }
  }

  async function subirArchivo(archivo: File) {
    setErrorArchivo(null);

    if (archivo.size > 5 * 1024 * 1024) {
      setErrorArchivo("El archivo admite hasta 5 MB.");
      return;
    }

    const permitidos = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

    if (!permitidos.includes(archivo.type)) {
      setErrorArchivo("Adjuntá un PDF o una imagen JPG, PNG o WebP.");
      return;
    }

    setSubiendo(true);

    try {
      const datos = new FormData();
      datos.append("archivo", archivo);
      const respuesta = await http.post<RespuestaUpload>("/uploads", datos);
      setArchivoUrl(respuesta.data.url);
      toaster.success({ title: "Factura adjuntada" });
    } catch (error) {
      setErrorArchivo(mensajeDeError(error));
    } finally {
      setSubiendo(false);
      if (archivoRef.current) archivoRef.current.value = "";
    }
  }

  function validar(): { nuevos: Errores; porLinea: Record<string, string> } {
    const nuevos: Errores = {};
    const erroresPorLinea: Record<string, string> = {};

    if (!proveedor) nuevos.proveedor = "Seleccioná el proveedor.";
    if (!/^\d{8}$/.test(timbrado)) nuevos.timbrado = "El timbrado debe tener 8 dígitos.";
    if (!/^\d{3}$/.test(establecimiento)) {
      nuevos.establecimiento = "El establecimiento tiene 3 dígitos.";
    } else if (!/^\d{3}$/.test(puntoExpedicion)) {
      nuevos.puntoExpedicion = "El punto de expedición tiene 3 dígitos.";
    } else if (!/^\d{1,8}$/.test(numero)) {
      nuevos.numero = "Ingresá el número de factura (hasta 8 dígitos).";
    }
    if (!fechaEmision) nuevos.fechaEmision = "Indicá la fecha de emisión.";

    if (condicionPago === "credito" && !fechaVencimiento) {
      nuevos.fechaVencimiento = "Una compra a crédito necesita vencimiento.";
    }

    if (fechaVencimiento && fechaEmision && fechaVencimiento < fechaEmision) {
      nuevos.fechaVencimiento = "No puede ser anterior a la emisión.";
    }

    if (moneda === "USD" && aNumero(tipoCambio) <= 0) {
      nuevos.tipoCambio = "Indicá un tipo de cambio mayor a cero.";
    }

    if (!lineasConProducto.length) {
      nuevos.lineas = "Agregá al menos un producto a la compra.";
    }

    const claves = new Set<string>();

    for (const linea of lineasConProducto) {
      const producto = linea.producto!;
      let error: string | undefined;

      if (aNumero(linea.cantidad) <= 0) {
        error = "La cantidad debe ser mayor a cero.";
      } else if (aNumero(linea.costoUnitario) < 0) {
        error = "El costo no puede ser negativo.";
      } else if (producto.requiereLote && !linea.codigoLote.trim()) {
        error = "Indicá el lote.";
      } else if (producto.requiereVencimiento && !linea.fechaVencimiento) {
        error = "Indicá el vencimiento.";
      }

      const clave = `${producto.id}|${linea.codigoLote.trim().toUpperCase()}`;
      if (!error && claves.has(clave)) {
        error = "Este producto ya está cargado con el mismo lote.";
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

    const { nuevos, porLinea } = validar();

    const primero = ORDEN_CAMPOS.find((campo) => nuevos[campo]);
    if (primero) {
      document.getElementById(ID[primero])?.focus();
      return;
    }

    if (nuevos.lineas) {
      document.getElementById("compra-buscador-productos")?.scrollIntoView({
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

    if (!proveedor) return;

    const items: CompraItemPayload[] = lineasConProducto.map((linea) => ({
      productoId: linea.producto!.id,
      cantidad: aNumero(linea.cantidad),
      costoUnitario: aNumero(linea.costoUnitario),
      porcentajeIva: linea.porcentajeIva,
      ...(linea.descripcion.trim() ? { descripcion: linea.descripcion.trim() } : {}),
      ...(linea.producto!.requiereLote && linea.codigoLote.trim()
        ? { codigoLote: linea.codigoLote.trim().toUpperCase() }
        : {}),
      ...(linea.producto!.requiereVencimiento && linea.fechaVencimiento
        ? { fechaVencimiento: linea.fechaVencimiento }
        : {}),
    }));

    onGuardar({
      proveedorId: proveedor.id,
      timbrado,
      establecimiento,
      puntoExpedicion,
      numero,
      tipoComprobante,
      fechaEmision,
      ...(fechaVencimiento ? { fechaVencimiento } : {}),
      condicionPago,
      moneda,
      estado: estadoCompra,
      ...(moneda === "USD" ? { tipoCambio: aNumero(tipoCambio) } : {}),
      items,
      ...(archivoUrl ? { archivoUrl } : {}),
      ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
    });
  }

  const errorNumeroFactura = errores.establecimiento ?? errores.puntoExpedicion ?? errores.numero;
  const esPendiente = estadoCompra === "PENDIENTE";

  return (
    <chakra.form id={formId} onSubmit={enviar} noValidate bg="white" p="4" borderRadius="xl" borderWidth="1px" borderColor="ink.200">
      <Stack gap="3">
        {errorGeneral && (
          <Alert status="error" rounded="md" title="No pudimos guardar la compra">
            {errorGeneral}
          </Alert>
        )}

        {errores.lineas && (
          <Alert status="warning" rounded="md" title="Revisá los productos">
            {errores.lineas}
          </Alert>
        )}

        {/* ── Fila 1: Proveedor, Moneda, Condición de Pago y Estado ───────────────── */}
        <Grid templateColumns={{ base: "1fr", md: "repeat(12, minmax(0, 1fr))" }} gap="3" alignItems="start">
          <Box gridColumn={{ base: "auto", md: "span 4" }}>
            <Campo id={ID.proveedor} etiqueta="Proveedor" requerido error={errores.proveedor}>
              <Flex gap="1.5" align="center" w="full">
                <NativeSelect.Root flex="1" size="sm" disabled={proveedores.isLoading}>
                  <NativeSelect.Field
                    value={proveedor?.id ?? ""}
                    onChange={(evento) => {
                      const id = Number(evento.target.value);
                      setProveedor(proveedores.data?.find((item) => item.id === id) ?? null);
                      setErrores((previos) => ({ ...previos, proveedor: undefined }));
                    }}
                  >
                    <option value="">
                      {proveedores.isLoading ? "Cargando proveedores..." : "Seleccioná un proveedor..."}
                    </option>
                    {proveedores.data?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nombreMostrable}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                {puede("proveedores.crear") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    colorPalette="brand"
                    flexShrink={0}
                    onClick={() => setAltaProveedor((previo) => !previo)}
                    aria-expanded={altaProveedor}
                  >
                    <Plus size={14} /> Nuevo
                  </Button>
                )}
              </Flex>
            </Campo>
          </Box>

          <Box gridColumn={{ base: "auto", md: "span 2" }}>
            <Campo etiqueta="Moneda">
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={moneda}
                  onChange={(e) => {
                    const val = e.target.value as MonedaCompra;
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

          <Box gridColumn={{ base: "auto", md: "span 3" }}>
            <Campo etiqueta="Condición de pago">
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={condicionPago}
                  onChange={(e) => {
                    const val = e.target.value as CondicionPagoCompra;
                    setCondicionPago(val);
                    if (val === "contado") {
                      setFechaVencimiento("");
                      setErrores((p) => ({ ...p, fechaVencimiento: undefined }));
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

          <Box gridColumn={{ base: "auto", md: "span 3" }}>
            <Campo etiqueta="Estado al guardar">
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={estadoCompra}
                  onChange={(e) => setEstadoCompra(e.target.value as EstadoNuevaCompra)}
                >
                  <option value="ACTIVA">Activa</option>
                  <option value="PENDIENTE">Pendiente</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Campo>
          </Box>
        </Grid>

        <PanelAltaRapida
          abierto={altaProveedor}
          titulo="Alta rápida de proveedor"
          onCerrar={() => setAltaProveedor(false)}
        >
          <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="2.5">
            <Campo etiqueta="RUC" requerido>
              <Input
                size="sm"
                value={nuevoProveedor.documento}
                onChange={(evento) =>
                  setNuevoProveedor((previo) => ({
                    ...previo,
                    documento: evento.target.value.replace(/\D/g, "").slice(0, 11),
                  }))
                }
                placeholder="80012345-6"
                inputMode="numeric"
                bg="white"
              />
            </Campo>
            <Campo etiqueta="Razón social" requerido>
              <Input
                size="sm"
                value={nuevoProveedor.razonSocial}
                onChange={(evento) =>
                  setNuevoProveedor((previo) => ({ ...previo, razonSocial: evento.target.value }))
                }
                placeholder="Distribuidora S.A."
                bg="white"
              />
            </Campo>
            <Campo etiqueta="Teléfono">
              <Input
                size="sm"
                value={nuevoProveedor.telefono}
                onChange={(evento) =>
                  setNuevoProveedor((previo) => ({ ...previo, telefono: evento.target.value }))
                }
                placeholder="0981 000 000"
                bg="white"
              />
            </Campo>
            <Campo etiqueta="Correo">
              <Input
                size="sm"
                type="email"
                value={nuevoProveedor.email}
                onChange={(evento) =>
                  setNuevoProveedor((previo) => ({ ...previo, email: evento.target.value }))
                }
                placeholder="compras@proveedor.com"
                bg="white"
              />
            </Campo>
          </Grid>

          {errorAltaProveedor && (
            <Alert status="error" rounded="md" mt="2">
              {errorAltaProveedor}
            </Alert>
          )}

          <Flex justify="flex-end" gap="2" mt="2">
            <Button type="button" variant="ghost" size="xs" onClick={() => setAltaProveedor(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="xs"
              colorPalette="brand"
              loading={crearProveedor.isPending}
              onClick={() => void guardarProveedorRapido()}
            >
              Guardar
            </Button>
          </Flex>
        </PanelAltaRapida>

        {/* ── Fila 2: Comprobante y Fechas ───────────────────────── */}
        <Grid templateColumns={{ base: "1fr", md: "repeat(12, minmax(0, 1fr))" }} gap="3" alignItems="start">
          <Box gridColumn={{ base: "auto", md: "span 3" }}>
            <Campo etiqueta="Comprobante">
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={tipoComprobante}
                  onChange={(evento) =>
                    setTipoComprobante(evento.target.value as TipoComprobanteCompra)
                  }
                >
                  <option value="factura">Factura</option>
                  <option value="factura_credito_fiscal">Factura crédito fiscal</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Campo>
          </Box>

          <Box gridColumn={{ base: "auto", md: "span 2" }}>
            <Campo id={ID.timbrado} etiqueta="Timbrado" requerido error={errores.timbrado}>
              <Input
                size="sm"
                value={timbrado}
                onChange={(evento) =>
                  setTimbrado(evento.target.value.replace(/\D/g, "").slice(0, 8))
                }
                placeholder="12345678"
                inputMode="numeric"
                fontFamily="mono"
              />
            </Campo>
          </Box>

          <Box gridColumn={{ base: "auto", md: "span 4" }}>
            <NumeroFactura
              establecimiento={establecimiento}
              puntoExpedicion={puntoExpedicion}
              numero={numero}
              error={errorNumeroFactura}
              onEstablecimiento={(v) => {
                setEstablecimiento(v);
                setErrores((p) => ({ ...p, establecimiento: undefined }));
              }}
              onPuntoExpedicion={(v) => {
                setPuntoExpedicion(v);
                setErrores((p) => ({ ...p, puntoExpedicion: undefined }));
              }}
              onNumero={(v) => {
                setNumero(v);
                setErrores((p) => ({ ...p, numero: undefined }));
              }}
            />
          </Box>

          <Box gridColumn={{ base: "auto", md: "span 3" }}>
            <Campo id={ID.fechaEmision} etiqueta="Fecha de emisión" requerido error={errores.fechaEmision}>
              <Input
                size="sm"
                type="date"
                value={fechaEmision}
                onChange={(evento) => setFechaEmision(evento.target.value)}
              />
            </Campo>
          </Box>

          {condicionPago === "credito" && (
            <Box gridColumn={{ base: "auto", md: "span 3" }}>
              <Campo id={ID.fechaVencimiento} etiqueta="Vencimiento pago" requerido error={errores.fechaVencimiento}>
                <Input
                  size="sm"
                  type="date"
                  value={fechaVencimiento}
                  min={fechaEmision || undefined}
                  onChange={(evento) => setFechaVencimiento(evento.target.value)}
                />
              </Campo>
            </Box>
          )}

          {moneda === "USD" && (
            <Box gridColumn={{ base: "auto", md: "span 3" }}>
              <Campo id={ID.tipoCambio} etiqueta="Tipo de cambio" requerido error={errores.tipoCambio}>
                <Input
                  size="sm"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tipoCambio}
                  onChange={(evento) => setTipoCambio(evento.target.value)}
                  placeholder="7300"
                />
              </Campo>
            </Box>
          )}
        </Grid>

        <Box borderBottomWidth="1px" borderColor="ink.100" my="1" />

        {/* ── Productos ─────────────────────────────────────────── */}
        <Box id="compra-buscador-productos">
          <Flex gap="2" align="center" justify="space-between" mb="2" wrap="wrap">
            <Flex align="baseline" gap="2" minW="0">
              <Text fontSize="sm" fontWeight="bold" color="ink.900">
                Productos
              </Text>
              <Text fontSize="2xs" color="ink.500">
                Ingresá el SKU en la fila y presioná Enter. F2 abre la búsqueda.
              </Text>
            </Flex>
            <Flex gap="2" align="center" flexShrink={0}>
              {lineasConProducto.length > 0 && (
                <Badge colorPalette="brand" variant="subtle" size="sm">
                  {lineasConProducto.length} {lineasConProducto.length === 1 ? "ítem" : "ítems"}
                </Badge>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                colorPalette="brand"
                onClick={() => abrirBuscador()}
                aria-keyshortcuts="F2"
              >
                <Search size={14} /> Buscar producto
              </Button>
              {puede("productos.crear") && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  colorPalette="brand"
                  onClick={() => setAltaProducto((previo) => !previo)}
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
                      setNuevoProducto((previo) => ({ ...previo, codigo: evento.target.value.toUpperCase() }))
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
                      setNuevoProducto((previo) => ({ ...previo, presentacion: evento.target.value }))
                    }
                    placeholder="Caja x 20 comprimidos"
                    bg="white"
                  />
                </Campo>
                <Campo etiqueta="Unidad">
                  <NativeSelect.Root size="sm">
                    <NativeSelect.Field
                      value={nuevoProducto.unidadMedida}
                      onChange={(evento) =>
                        setNuevoProducto((previo) => ({ ...previo, unidadMedida: evento.target.value }))
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
                <Campo etiqueta="IVA">
                  <NativeSelect.Root size="sm">
                    <NativeSelect.Field
                      value={nuevoProducto.porcentajeIva}
                      onChange={(evento) =>
                        setNuevoProducto((previo) => ({ ...previo, porcentajeIva: evento.target.value }))
                      }
                      bg="white"
                    >
                      <option value="5">5 %</option>
                      <option value="10">10 %</option>
                      <option value="0">Exento</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Campo>
              </Grid>

              <Flex align="center" justify="space-between" gap="2" mt="2" p="2" borderWidth="1px" borderColor="ink.200" borderRadius="md" bg="white">
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

          {/* Siempre visible: 5 filas mínimas y scroll a partir de la sexta. */}
          <Table.ScrollArea
            maxH={ALTO_MAXIMO_TABLA}
            overflowY="auto"
            borderWidth="1px"
            borderColor="ink.200"
            borderRadius="md"
            bg="white"
          >
            <Table.Root size="sm" minW="60rem">
              <Table.Header position="sticky" top="0" zIndex="1" bg="ink.50">
                <Table.Row bg="ink.50">
                  <Table.ColumnHeader py="1.5" w="2rem" ps="2">#</Table.ColumnHeader>
                  <Table.ColumnHeader py="1.5" w="7rem">SKU</Table.ColumnHeader>
                  <Table.ColumnHeader py="1.5">Producto</Table.ColumnHeader>
                  <Table.ColumnHeader py="1.5" w="6.5rem">Lote</Table.ColumnHeader>
                  <Table.ColumnHeader py="1.5" w="8rem">Vencimiento</Table.ColumnHeader>
                  <Table.ColumnHeader py="1.5" w="5.5rem">Cantidad</Table.ColumnHeader>
                  <Table.ColumnHeader py="1.5" w="8rem">Costo unit.</Table.ColumnHeader>
                  <Table.ColumnHeader py="1.5" w="5.5rem">IVA</Table.ColumnHeader>
                  <Table.ColumnHeader py="1.5" textAlign="end">Total</Table.ColumnHeader>
                  <Table.ColumnHeader py="1.5" w="8" />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {lineas.map((linea, indice) => (
                  <FilaCompra
                    key={linea.key}
                    indice={indice + 1}
                    linea={linea}
                    moneda={moneda}
                    error={erroresLineas[linea.key]}
                    resolviendoSku={skuEnCurso === linea.key}
                    conAyuda={primeraVacia === linea.key}
                    onCambiar={(cambios) => cambiarLinea(linea.key, cambios)}
                    onResolverSku={(codigo) => void resolverSku(linea.key, codigo)}
                    onQuitar={() => quitarLinea(linea.key)}
                  />
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>

          {buscadorAbierto && (
            <BuscadorProductosModal
              key={`${lineaBuscador ?? "libre"}:${busquedaBuscador}`}
              abierto
              busquedaInicial={busquedaBuscador}
              onCerrar={cerrarBuscador}
              onSeleccionar={(producto) => agregarProducto(producto, lineaBuscador)}
            />
          )}

        </Box>

        <Box borderBottomWidth="1px" borderColor="ink.100" my="1" />

        {/* ── Pie: Adjunto, Observaciones y Resumen ────────────────── */}
        <Grid templateColumns={{ base: "1fr", lg: "1.2fr 0.8fr" }} gap="4" alignItems="start">
          <Stack gap="2.5">
            <Box>
              <Flex align="center" justify="space-between" mb="1">
                <Text fontSize="xs" fontWeight="medium" color="ink.800">
                  Comprobante adjunto
                </Text>
                {archivoUrl && (
                  <Button
                    type="button"
                    size="2xs"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => setArchivoUrl("")}
                  >
                    Quitar
                  </Button>
                )}
              </Flex>
              {archivoUrl ? (
                <Flex align="center" gap="2" p="1.5" borderWidth="1px" borderColor="green.200" bg="green.50" borderRadius="md">
                  <Paperclip size={13} color="var(--chakra-colors-green-700)" />
                  <Text fontSize="xs" fontWeight="medium" color="green.800" truncate flex="1">
                    Factura adjuntada
                  </Text>
                  <Button type="button" size="2xs" variant="outline" asChild>
                    <a href={archivoUrl} target="_blank" rel="noreferrer">
                      Ver
                    </a>
                  </Button>
                </Flex>
              ) : (
                <>
                  <input
                    ref={archivoRef}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(evento) => {
                      const archivo = evento.target.files?.[0];
                      if (archivo) void subirArchivo(archivo);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    colorPalette="brand"
                    onClick={() => archivoRef.current?.click()}
                    loading={subiendo}
                  >
                    <Upload size={13} /> Adjuntar factura (PDF / Imagen)
                  </Button>
                </>
              )}
              {errorArchivo && (
                <Text fontSize="2xs" color="red.600" mt="0.5" role="alert">
                  {errorArchivo}
                </Text>
              )}
            </Box>

            <Campo etiqueta="Observaciones">
              <Textarea
                size="sm"
                value={observaciones}
                onChange={(evento) => setObservaciones(evento.target.value)}
                placeholder="Notas internas u observaciones adicionales..."
                rows={2}
                resize="vertical"
                maxLength={1000}
              />
            </Campo>
          </Stack>

          {/* Resumen final */}
          <Box
            bg="brand.900"
            color="white"
            borderRadius="lg"
            p="3.5"
            position={{ lg: "sticky" }}
            top={{ lg: "4" }}
          >
            <Flex align="center" justify="space-between" gap="2" mb="2.5">
              <Text fontSize="xs" fontWeight="bold">
                Resumen
              </Text>
              <Flex gap="1">
                <Badge colorPalette={esPendiente ? "orange" : "green"} variant="solid" size="xs">
                  {esPendiente ? "Pendiente" : "Activa"}
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
              <Flex justify="space-between" gap="2">
                <Text color="brand.200">IVA 5 % / 10 % / Exenta</Text>
                <Text fontVariantNumeric="tabular-nums">
                  {formatearMonto(moneda, totales.iva5)} / {formatearMonto(moneda, totales.iva10)} / {formatearMonto(moneda, totales.exenta)}
                </Text>
              </Flex>
              <Flex justify="space-between" gap="2">
                <Text color="brand.200">IVA total</Text>
                <Text fontVariantNumeric="tabular-nums">{formatearMonto(moneda, totales.iva)}</Text>
              </Flex>
            </Stack>

            <Box borderTopWidth="1px" borderColor="brand.700" mt="2.5" pt="2.5">
              <Flex justify="space-between" align="flex-end" gap="2">
                <Text fontSize="xs" color="brand.200">
                  Total ({moneda})
                </Text>
                <Text fontSize="lg" fontWeight="bold" fontVariantNumeric="tabular-nums" lineHeight="1">
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
        </Grid>
      </Stack>
    </chakra.form>
  );
}