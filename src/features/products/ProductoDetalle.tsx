import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Separator,
  Spinner,
  Text,
  chakra,
} from "@chakra-ui/react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  Package,
  Pencil,
  Pill,
  PlayCircle,
  Receipt,
  SlidersHorizontal,
  Tag,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";

import {
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerRoot,
} from "@/components/ui/drawer";
import { useAuth } from "@/features/auth/auth.store";
import {
  formatFechaCalendario,
  formatFechaHora,
  formatMoneda,
} from "@/lib/formato";
import { urlDeArchivo } from "@/services/api";
import type { Producto, StockMovimiento } from "@/types/dominio";
import { estadoLote } from "./lotes";
import { estadoStockProducto } from "./products.service";

const ETIQUETAS_MOVIMIENTO: Record<
  StockMovimiento["tipo"],
  { etiqueta: string; color: string; signo: string }
> = {
  entrada: { etiqueta: "Entrada", color: "success", signo: "+" },
  salida: { etiqueta: "Salida", color: "danger", signo: "−" },
  ajuste: { etiqueta: "Ajuste", color: "warning", signo: "" },
  devolucion: { etiqueta: "Devolución", color: "brand", signo: "+" },
  merma: { etiqueta: "Merma", color: "danger", signo: "−" },
  ajuste_inicial: {
    etiqueta: "Apertura inicial",
    color: "brand",
    signo: "+",
  },
};

function Dato({
  etiqueta,
  valor,
  icono: Icono,
}: {
  etiqueta: string;
  valor?: string | number | null;
  icono?: typeof Tag;
}) {
  const vacio = valor === null || valor === undefined || valor === "";
  return (
    <Box>
      <Flex align="center" gap="1.5" color="ink.500" mb="1">
        {Icono && <Icono size={13} />}
        <Text fontSize="2xs" textTransform="uppercase" letterSpacing="0.05em">
          {etiqueta}
        </Text>
      </Flex>
      <Text
        fontSize="sm"
        fontWeight={vacio ? "normal" : "medium"}
        color={vacio ? "ink.400" : "ink.800"}
        lineHeight="1.4"
        wordBreak="break-word"
      >
        {vacio ? "Sin informar" : valor}
      </Text>
    </Box>
  );
}

function TarjetaDato({
  icono: Icono,
  etiqueta,
  children,
  color = "brand",
}: {
  icono: typeof Package;
  etiqueta: string;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Box
      p="4"
      bg="white"
      borderWidth="1px"
      borderColor="ink.200"
      borderRadius="xl"
    >
      <Flex align="center" gap="2" color={`${color}.600`} mb="2">
        <Icono size={16} />
        <Text
          fontSize="xs"
          fontWeight="semibold"
          textTransform="uppercase"
          letterSpacing="0.04em"
        >
          {etiqueta}
        </Text>
      </Flex>
      {children}
    </Box>
  );
}

function SemaforoStock({ producto }: { producto: Producto }) {
  const estado = estadoStockProducto(producto);
  const config = {
    disponible: { color: "success", texto: "Con stock" },
    bajo: { color: "warning", texto: "Stock bajo" },
    agotado: { color: "red", texto: "Agotado" },
  }[estado];

  return (
    <Badge colorPalette={config.color} variant="solid" size="sm">
      {config.texto}
    </Badge>
  );
}

export function ProductoDetalle({
  abierto,
  producto,
  cargando,
  error,
  onClose,
  onEditar,
  onAjustarStock,
  onCambiarEstado,
  cambiandoEstado,
}: {
  abierto: boolean;
  producto: Producto | null;
  cargando: boolean;
  error?: unknown;
  onClose: () => void;
  onEditar: (producto: Producto) => void;
  onAjustarStock: (producto: Producto) => void;
  onCambiarEstado: (producto: Producto) => void;
  cambiandoEstado: boolean;
}) {
  const { puede } = useAuth();
  const estado = producto ? estadoStockProducto(producto) : "agotado";
  const lotes = producto?.lotes ?? [];
  const movimientos = producto?.movimientos ?? [];

  const puedeEditar = puede("productos.editar");
  const puedeAjustar = puede("productos.editar") || puede("stock.ajustar");
  const puedeCambiarEstado = producto?.activo
    ? puede("productos.eliminar")
    : puede("productos.editar");

  return (
    <DrawerRoot
      open={abierto}
      onOpenChange={(detalle) => {
        if (!detalle.open) onClose();
      }}
      placement="end"
      size="md"
    >
      <DrawerContent
        maxW={{ base: "100%", sm: "38rem" }}
        bg="ink.50"
        display="flex"
        flexDirection="column"
      >
        <DrawerHeader
          p="0"
          flexShrink={0}
          position="relative"
          bg="brand.800"
          color="white"
        >
          <chakra.button
            type="button"
            onClick={onClose}
            position="absolute"
            top="3"
            right="3"
            zIndex="1"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w="9"
            h="9"
            borderRadius="full"
            color="white"
            bg="brand.700"
            _hover={{ bg: "brand.600" }}
            aria-label="Cerrar detalle del producto"
          >
            <X size={18} />
          </chakra.button>

          {cargando && !producto ? (
            <Flex align="center" justify="center" gap="3" py="12">
              <Spinner size="md" color="white" />
              <Text fontSize="sm" color="brand.100">
                Cargando producto…
              </Text>
            </Flex>
          ) : error && !producto ? (
            <Flex align="center" gap="3" px="6" py="8" color="red.100">
              <AlertTriangle size={20} />
              <Text fontSize="sm">
                No se pudo cargar el producto. Cerrá el panel y volvé a intentar.
              </Text>
            </Flex>
          ) : producto ? (
            <Flex align="flex-start" gap="4" p={{ base: "4", sm: "5" }} pr="14">
              <Flex
                align="center"
                justify="center"
                w={{ base: "16", sm: "20" }}
                h={{ base: "16", sm: "20" }}
                flexShrink={0}
                borderRadius="xl"
                bg="white"
                borderWidth="1px"
                borderColor="brand.600"
                overflow="hidden"
              >
                {producto.fotoUrl ? (
                  <chakra.img
                    src={urlDeArchivo(producto.fotoUrl)}
                    alt={producto.nombre}
                    w="full"
                    h="full"
                    objectFit="contain"
                    p="1.5"
                  />
                ) : (
                  <Package size={30} color="var(--chakra-colors-brand-600)" />
                )}
              </Flex>

              <Box minW="0" flex="1">
                <Text
                  fontSize="xs"
                  color="brand.200"
                  fontFamily="mono"
                  letterSpacing="0.04em"
                >
                  {producto.codigo}
                </Text>
                <Text
                  fontSize={{ base: "lg", sm: "xl" }}
                  fontWeight="bold"
                  lineHeight="1.25"
                  mt="0.5"
                >
                  {producto.nombre}
                </Text>
                <Text fontSize="sm" color="brand.100" mt="1">
                  {[producto.marca, producto.laboratorio]
                    .filter(Boolean)
                    .join(" · ") || "Sin marca ni laboratorio"}
                </Text>

                <Flex gap="1.5" wrap="wrap" mt="3">
                  {producto.categoria && (
                    <Badge colorPalette="cyan" variant="solid" size="sm">
                      {producto.categoria.nombre}
                    </Badge>
                  )}
                  {producto.esMedicamento && (
                    <Badge colorPalette="purple" variant="solid" size="sm">
                      Medicamento
                    </Badge>
                  )}
                  {producto.esControlado && (
                    <Badge colorPalette="red" variant="solid" size="sm">
                      Controlado
                    </Badge>
                  )}
                  {!producto.activo && (
                    <Badge colorPalette="gray" variant="solid" size="sm">
                      Inactivo
                    </Badge>
                  )}
                </Flex>
              </Box>
            </Flex>
          ) : null}
        </DrawerHeader>

        <DrawerBody p="0" flex="1" overflowY="auto">
          {producto ? (
            <Box p={{ base: "4", sm: "5" }} pb="8">
              <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap="3">
                <TarjetaDato
                  icono={CircleDollarSign}
                  etiqueta="Precio de venta"
                  color="success"
                >
                  <Text
                    fontSize="2xl"
                    fontWeight="bold"
                    color="ink.900"
                    fontVariantNumeric="tabular-nums"
                  >
                    {formatMoneda(producto.precioVenta)}
                  </Text>
                  <Text fontSize="xs" color="ink.500" mt="1">
                    Costo {formatMoneda(producto.precioCosto)} · IVA{" "}
                    {producto.porcentajeIva}%
                  </Text>
                </TarjetaDato>

                <TarjetaDato
                  icono={Boxes}
                  etiqueta="Stock disponible"
                  color={estado === "disponible" ? "success" : "orange"}
                >
                  <Flex align="center" justify="space-between" gap="2">
                    <Text
                      fontSize="2xl"
                      fontWeight="bold"
                      color="ink.900"
                      fontVariantNumeric="tabular-nums"
                    >
                      {Number(producto.stockActual)}
                      <chakra.span
                        fontSize="sm"
                        fontWeight="normal"
                        color="ink.500"
                        ml="1"
                      >
                        {producto.unidadMedida}
                      </chakra.span>
                    </Text>
                    <SemaforoStock producto={producto} />
                  </Flex>
                  <Text fontSize="xs" color="ink.500" mt="1">
                    Mínimo: {Number(producto.stockMinimo)}{" "}
                    {producto.unidadMedida}
                  </Text>
                </TarjetaDato>
              </Grid>

              <Box
                mt="4"
                bg="white"
                borderWidth="1px"
                borderColor="ink.200"
                borderRadius="xl"
                p={{ base: "4", sm: "5" }}
              >
                <Flex align="center" gap="2" mb="4">
                  <Package size={17} color="var(--chakra-colors-brand-600)" />
                  <Text fontWeight="semibold" color="ink.900" fontSize="sm">
                    Datos del producto
                  </Text>
                </Flex>

                <Grid
                  templateColumns={{
                    base: "1fr 1fr",
                    sm: "repeat(3, minmax(0, 1fr))",
                  }}
                  gap="4"
                >
                  <Dato
                    etiqueta="Categoría"
                    valor={producto.categoria?.nombre}
                    icono={Tag}
                  />
                  <Dato etiqueta="Marca" valor={producto.marca} />
                  <Dato etiqueta="Laboratorio" valor={producto.laboratorio} />
                  <Dato
                    etiqueta="Principio activo"
                    valor={producto.principioActivo}
                    icono={Pill}
                  />
                  <Dato etiqueta="Concentración" valor={producto.concentracion} />
                  <Dato etiqueta="Presentación" valor={producto.presentacion} />
                  <Dato etiqueta="Especie destino" valor={producto.especieDestino} />
                  <Dato
                    etiqueta="Registro SENACSA"
                    valor={producto.registroSenacsa}
                  />
                  <Dato
                    etiqueta="Ubicación"
                    valor={producto.ubicacion}
                    icono={Warehouse}
                  />
                  <Dato
                    etiqueta="Código de barras"
                    valor={producto.codigoBarras}
                  />
                  <Dato etiqueta="Código SIFEN" valor={producto.codigoSifen} />
                  <Dato
                    etiqueta="Proveedor"
                    valor={
                      producto.proveedor
                        ? (producto.proveedor.nombreFantasia ??
                          producto.proveedor.razonSocial)
                        : null
                    }
                  />
                </Grid>

                <Separator my="4" />

                <Flex gap="1.5" wrap="wrap">
                  {producto.requiereReceta && (
                    <Badge colorPalette="orange" variant="subtle" size="sm">
                      Requiere receta
                    </Badge>
                  )}
                  <Badge colorPalette="gray" variant="subtle" size="sm">
                    {producto.unidadMedida}
                  </Badge>
                </Flex>

                {producto.descripcion && (
                  <>
                    <Separator my="4" />
                    <Text fontSize="xs" color="ink.500" mb="1">
                      Descripción
                    </Text>
                    <Text fontSize="sm" color="ink.800" lineHeight="1.65">
                      {producto.descripcion}
                    </Text>
                  </>
                )}
              </Box>

              <Box
                mt="4"
                bg="white"
                borderWidth="1px"
                borderColor="ink.200"
                borderRadius="xl"
                overflow="hidden"
              >
                <Flex
                  align="center"
                  justify="space-between"
                  gap="2"
                  px="4"
                  py="3.5"
                  borderBottomWidth="1px"
                  borderColor="ink.100"
                >
                  <Flex align="center" gap="2">
                    <CalendarClock
                      size={16}
                      color="var(--chakra-colors-brand-600)"
                    />
                    <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                      Lotes
                    </Text>
                  </Flex>
                  <Badge colorPalette="gray" variant="subtle" size="sm">
                    {lotes.length}
                  </Badge>
                </Flex>

                {lotes.length === 0 ? (
                  <Text fontSize="sm" color="ink.500" px="4" py="4">
                    Este producto todavía no tiene lotes registrados.
                  </Text>
                ) : (
                  <Flex direction="column">
                    {lotes.map((lote) => {
                      const vencimiento = estadoLote(lote.fechaVencimiento);
                      return (
                        <Flex
                          key={lote.id}
                          align="center"
                          justify="space-between"
                          gap="3"
                          px="4"
                          py="3"
                          borderBottomWidth="1px"
                          borderColor="ink.100"
                          _last={{ borderBottomWidth: 0 }}
                        >
                          <Box minW="0">
                            <Text
                              fontSize="sm"
                              fontWeight="medium"
                              color="ink.900"
                              fontFamily="mono"
                            >
                              {lote.codigoLote}
                            </Text>
                            <Text fontSize="xs" color="ink.500" mt="0.5">
                              {lote.fechaVencimiento
                                ? `Vence ${formatFechaCalendario(lote.fechaVencimiento)}`
                                : "Sin fecha de vencimiento"}
                              {lote.ubicacion ? ` · ${lote.ubicacion}` : ""}
                            </Text>
                          </Box>
                          <Box textAlign="right" flexShrink={0}>
                            <Text
                              fontSize="sm"
                              fontWeight="semibold"
                              color="ink.900"
                              fontVariantNumeric="tabular-nums"
                            >
                              {Number(lote.cantidadActual)}{" "}
                              {producto.unidadMedida}
                            </Text>
                            <Badge
                              colorPalette={vencimiento.color}
                              variant="subtle"
                              size="sm"
                              mt="1"
                            >
                              {vencimiento.texto}
                            </Badge>
                          </Box>
                        </Flex>
                      );
                    })}
                  </Flex>
                )}
              </Box>

              <Box
                mt="4"
                bg="white"
                borderWidth="1px"
                borderColor="ink.200"
                borderRadius="xl"
                overflow="hidden"
              >
                <Flex
                  align="center"
                  justify="space-between"
                  gap="2"
                  px="4"
                  py="3.5"
                  borderBottomWidth="1px"
                  borderColor="ink.100"
                >
                  <Flex align="center" gap="2">
                    <Receipt size={16} color="var(--chakra-colors-brand-600)" />
                    <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                      Últimos movimientos
                    </Text>
                  </Flex>
                  <Badge colorPalette="gray" variant="subtle" size="sm">
                    {movimientos.length}
                  </Badge>
                </Flex>

                {movimientos.length === 0 ? (
                  <Text fontSize="sm" color="ink.500" px="4" py="4">
                    Sin movimientos registrados.
                  </Text>
                ) : (
                  <Flex direction="column">
                    {movimientos.map((movimiento) => {
                      const config = ETIQUETAS_MOVIMIENTO[movimiento.tipo];
                      return (
                        <Flex
                          key={movimiento.id}
                          align="flex-start"
                          gap="3"
                          px="4"
                          py="3"
                          borderBottomWidth="1px"
                          borderColor="ink.100"
                          _last={{ borderBottomWidth: 0 }}
                        >
                          <Flex
                            align="center"
                            justify="center"
                            w="8"
                            h="8"
                            flexShrink={0}
                            borderRadius="md"
                            bg={`${config.color}.subtle`}
                            color={`${config.color}.600`}
                          >
                            {config.signo === "+" ? (
                              <ArrowDownLeft size={15} />
                            ) : (
                              <ArrowUpRight size={15} />
                            )}
                          </Flex>
                          <Box flex="1" minW="0">
                            <Flex
                              align="center"
                              justify="space-between"
                              gap="2"
                            >
                              <Text
                                fontSize="sm"
                                fontWeight="medium"
                                color="ink.900"
                              >
                                {config.etiqueta}
                              </Text>
                              <Text
                                fontSize="sm"
                                fontWeight="semibold"
                                color={`${config.color}.700`}
                                fontVariantNumeric="tabular-nums"
                                flexShrink={0}
                              >
                                {config.signo}
                                {Number(movimiento.cantidad)}
                              </Text>
                            </Flex>
                            <Text fontSize="xs" color="ink.500" mt="0.5">
                              {formatFechaHora(movimiento.fecha)} ·{" "}
                              {movimiento.usuario.nombre}{" "}
                              {movimiento.usuario.apellido}
                            </Text>
                            {movimiento.observacion && (
                              <Text
                                fontSize="xs"
                                color="ink.600"
                                mt="1"
                                lineHeight="1.5"
                              >
                                {movimiento.observacion}
                              </Text>
                            )}
                          </Box>
                        </Flex>
                      );
                    })}
                  </Flex>
                )}
              </Box>
            </Box>
          ) : null}
        </DrawerBody>

        {producto && (
          <DrawerFooter
            px={{ base: "4", sm: "5" }}
            py="4"
            borderTopWidth="1px"
            borderColor="ink.200"
            bg="white"
            gap="2"
            flexWrap="wrap"
            flexShrink={0}
          >
            {puedeCambiarEstado && (
              <Button
                variant="outline"
                colorPalette={producto.activo ? "red" : "green"}
                onClick={() => onCambiarEstado(producto)}
                loading={cambiandoEstado}
                flex={{ base: "1", sm: "initial" }}
              >
                {producto.activo ? <Trash2 size={16} /> : <PlayCircle size={16} />}
                {producto.activo ? "Desactivar" : "Reactivar"}
              </Button>
            )}

            {puedeAjustar && producto.activo && (
              <Button
                variant="outline"
                colorPalette="brand"
                onClick={() => onAjustarStock(producto)}
                flex={{ base: "1", sm: "initial" }}
              >
                <SlidersHorizontal size={16} />
                Ajustar stock
              </Button>
            )}

            {puedeEditar && (
              <Button
                colorPalette="brand"
                onClick={() => onEditar(producto)}
                flex={{ base: "1", sm: "initial" }}
                ml="auto"
              >
                <Pencil size={16} />
                Editar producto
              </Button>
            )}
          </DrawerFooter>
        )}
      </DrawerContent>
    </DrawerRoot>
  );
}
