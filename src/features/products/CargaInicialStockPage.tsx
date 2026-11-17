import {
  Badge,
  Box,
  Button,
  Flex,
  IconButton,
  Input,
  Spinner,
  Table,
  Text,
  chakra,
} from "@chakra-ui/react";
import { ArchiveRestore, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { FormDialog } from "@/components/data/FormDialog";
import { PageHeader, Panel } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { toaster } from "@/components/ui/toaster";
import {
  mensajeDeError,
} from "@/features/clients/clients.service";
import { useBuscarProductosCompra } from "@/features/purchases/purchases.service";
import { formatCantidad } from "@/lib/formato";
import type { Producto } from "@/types/dominio";
import { estadoLote } from "./lotes";
import {
  useCargaInicialStock,
  type CargaInicialStockItem,
} from "./products.service";

interface LineaCarga {
  key: string;
  producto: Producto;
  codigoLote: string;
  fechaVencimiento: string;
  cantidad: string;
}

type ErroresLinea = Partial<
  Record<"codigoLote" | "fechaVencimiento" | "cantidad", string>
>;

function nuevaLinea(producto: Producto): LineaCarga {
  return {
    key: crypto.randomUUID(),
    producto,
    codigoLote: "",
    fechaVencimiento: "",
    cantidad: "1",
  };
}

function aNumero(valor: string): number {
  const numero = Number(valor.replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
}

function BuscadorProducto({
  onSeleccionar,
}: {
  onSeleccionar: (producto: Producto) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const consulta = useBuscarProductosCompra(busqueda);

  return (
    <Box position="relative" w={{ base: "full", md: "26rem" }}>
      <Box position="relative">
        <Box
          position="absolute"
          left="3"
          top="50%"
          transform="translateY(-50%)"
          color="ink.400"
          pointerEvents="none"
        >
          <Search size={15} />
        </Box>
        <Input
          value={busqueda}
          onChange={(evento) => {
            setBusqueda(evento.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
          pl="9"
          placeholder="Buscá un producto por nombre o código…"
          bg="white"
          aria-label="Agregar producto a la carga inicial"
        />
      </Box>

      {abierto && busqueda.trim().length > 1 && (
        <Box
          position="absolute"
          zIndex="20"
          top="calc(100% + 4px)"
          left="0"
          right="0"
          bg="white"
          borderWidth="1px"
          borderColor="ink.200"
          borderRadius="lg"
          boxShadow="lg"
          maxH="16rem"
          overflowY="auto"
          p="1"
        >
          {consulta.isFetching ? (
            <Flex align="center" gap="2" px="3" py="3" color="ink.500">
              <Spinner size="xs" />
              <Text fontSize="sm">Buscando…</Text>
            </Flex>
          ) : consulta.data?.items.length ? (
            consulta.data.items.map((producto) => (
              <chakra.button
                key={producto.id}
                type="button"
                w="full"
                textAlign="left"
                px="3"
                py="2.5"
                borderRadius="md"
                _hover={{ bg: "brand.50" }}
                onMouseDown={(evento) => evento.preventDefault()}
                onClick={() => {
                  onSeleccionar(producto);
                  setBusqueda("");
                  setAbierto(false);
                }}
              >
                <Flex justify="space-between" gap="3">
                  <Box minW="0">
                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                      color="ink.900"
                      truncate
                    >
                      {producto.nombre}
                    </Text>
                    <Text fontSize="xs" color="ink.500" truncate>
                      {producto.codigo} · {producto.unidadMedida}
                    </Text>
                  </Box>
                  <Badge colorPalette="gray" variant="subtle" flexShrink={0}>
                    Stock {formatCantidad(producto.stockActual)}
                  </Badge>
                </Flex>
              </chakra.button>
            ))
          ) : (
            <Box px="3" py="3">
              <Text fontSize="sm" color="ink.600">
                No se encontraron productos.
              </Text>
              <Text fontSize="xs" color="ink.500" mt="1">
                Creá el producto primero desde el listado de Productos.
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export function CargaInicialStockPage() {
  const [lineas, setLineas] = useState<LineaCarga[]>([]);
  const [errores, setErrores] = useState<Record<string, ErroresLinea>>({});
  const [confirmando, setConfirmando] = useState(false);
  const carga = useCargaInicialStock();

  const resumen = useMemo(() => {
    const unidades = lineas.reduce(
      (total, linea) => total + aNumero(linea.cantidad),
      0,
    );
    const productos = new Set(lineas.map((linea) => linea.producto.id)).size;

    return {
      lineas: lineas.length,
      unidades,
      productos,
    };
  }, [lineas]);

  function agregar(producto: Producto) {
    if (
      !producto.requiereLote &&
      lineas.some((linea) => linea.producto.id === producto.id)
    ) {
      toaster.error({
        title: "Ese producto ya está en la lista",
        description:
          "No controla lote, así que agregá las unidades en la línea existente.",
      });
      return;
    }

    setLineas((previas) => [...previas, nuevaLinea(producto)]);
  }

  function cambiar(key: string, cambios: Partial<LineaCarga>) {
    setLineas((previas) =>
      previas.map((linea) =>
        linea.key === key ? { ...linea, ...cambios } : linea,
      ),
    );
    setErrores((previos) => {
      const copia = { ...previos };
      delete copia[key];
      return copia;
    });
  }

  function quitar(key: string) {
    setLineas((previas) => previas.filter((linea) => linea.key !== key));
    setErrores((previos) => {
      const copia = { ...previos };
      delete copia[key];
      return copia;
    });
  }

  function validar(): CargaInicialStockItem[] | null {
    if (lineas.length === 0) {
      toaster.error({
        title: "Agregá al menos un producto",
        description: "Buscá un producto y completá la cantidad.",
      });
      return null;
    }

    const nuevos: Record<string, ErroresLinea> = {};
    const claves = new Map<string, string>();

    for (const linea of lineas) {
      const erroresLinea: ErroresLinea = {};
      const codigoLote = linea.producto.requiereLote
        ? linea.codigoLote.trim().toUpperCase()
        : "";

      if (linea.producto.requiereLote) {
        if (!codigoLote) {
          erroresLinea.codigoLote = "Indicá el número de lote.";
        } else if (codigoLote.length > 60) {
          erroresLinea.codigoLote = "El lote admite hasta 60 caracteres.";
        }
      }

      if (
        linea.producto.requiereVencimiento &&
        !/^\d{4}-\d{2}-\d{2}$/.test(linea.fechaVencimiento)
      ) {
        erroresLinea.fechaVencimiento = "Indicá el vencimiento.";
      }

      if (aNumero(linea.cantidad) <= 0) {
        erroresLinea.cantidad = "La cantidad debe ser mayor que cero.";
      }

      const clave = `${linea.producto.id}|${codigoLote || "SIN_LOTE"}`;
      if (claves.has(clave)) {
        if (linea.producto.requiereLote) {
          erroresLinea.codigoLote = "Este lote ya está cargado en la lista.";
        } else {
          erroresLinea.cantidad = "Este producto ya está cargado en la lista.";
        }
      } else {
        claves.set(clave, linea.key);
      }

      if (Object.keys(erroresLinea).length > 0) {
        nuevos[linea.key] = erroresLinea;
      }
    }

    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos);
      toaster.error({
        title: "Revisá la carga",
        description: "Hay datos incompletos o repetidos en la lista.",
      });
      return null;
    }

    return lineas.map((linea) => ({
      productoId: linea.producto.id,
      ...(linea.producto.requiereLote
        ? { codigoLote: linea.codigoLote.trim().toUpperCase() }
        : {}),
      ...(linea.producto.requiereVencimiento
        ? { fechaVencimiento: linea.fechaVencimiento }
        : {}),
      cantidad: aNumero(linea.cantidad),
    }));
  }

  function abrirConfirmacion() {
    if (!validar()) return;
    carga.reset();
    setConfirmando(true);
  }

  function guardar() {
    const items = validar();
    if (!items) {
      setConfirmando(false);
      return;
    }

    carga.mutate(
      { items },
      {
        onSuccess: (resultado) => {
          setConfirmando(false);
          setLineas([]);
          setErrores({});
          toaster.success({
            title: "Carga inicial registrada",
            description: resultado.mensaje,
          });
        },
      },
    );
  }

  return (
    <Box>
      <PageHeader
        titulo="Carga inicial de stock"
        descripcion="Registrá el stock que ya tenés en la estantería. Si el producto controla lote, indicá también su vencimiento."
        acciones={
          <Badge colorPalette="brand" variant="subtle" size="lg">
            Una sola vez por lote
          </Badge>
        }
      />

      <Alert status="info" rounded="md" mb="4">
        Usá esta pantalla para la mercadería que ya existía antes de empezar a
        usar VetSirio. Cada línea suma stock y deja un movimiento de apertura;
        si el producto controla lote, también crea el lote. Las compras
        posteriores se cargan desde “Compras”.
      </Alert>

      <Panel>
        <Flex direction="column" gap="4">
          <Flex
            align={{ base: "stretch", md: "center" }}
            gap="3"
            wrap="wrap"
          >
            <BuscadorProducto onSeleccionar={agregar} />
            <Text fontSize="xs" color="ink.500">
              Podés agregar el mismo producto varias veces, una línea por cada
              lote físico. Los productos sin lote se cargan en una sola línea.
            </Text>
          </Flex>

          {lineas.length === 0 ? (
            <Flex
              direction="column"
              align="center"
              justify="center"
              gap="3"
              py="12"
              px="4"
              borderWidth="1px"
              borderStyle="dashed"
              borderColor="ink.200"
              borderRadius="xl"
              bg="ink.50"
              textAlign="center"
            >
              <Flex
                align="center"
                justify="center"
                w="12"
                h="12"
                borderRadius="full"
                bg="white"
                color="brand.600"
              >
                <ArchiveRestore size={22} />
              </Flex>
              <Box>
                <Text fontSize="sm" fontWeight="semibold" color="ink.800">
                  Todavía no agregaste lotes
                </Text>
                <Text fontSize="sm" color="ink.500" mt="1">
                  Buscá un producto arriba para empezar la carga.
                </Text>
              </Box>
            </Flex>
          ) : (
            <Box
              borderWidth="1px"
              borderColor="ink.200"
              borderRadius="lg"
              overflow="hidden"
            >
              <Table.ScrollArea maxH="26rem">
                <Table.Root size="sm" minW="52rem" stickyHeader>
                  <Table.Header>
                    <Table.Row bg="ink.50">
                      <Table.ColumnHeader>Producto</Table.ColumnHeader>
                      <Table.ColumnHeader>Lote</Table.ColumnHeader>
                      <Table.ColumnHeader>Vencimiento</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="right">
                        Cantidad
                      </Table.ColumnHeader>
                      <Table.ColumnHeader>Estado</Table.ColumnHeader>
                      <Table.ColumnHeader />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {lineas.map((linea) => {
                      const error = errores[linea.key] ?? {};
                      const vencimiento =
                        linea.producto.requiereVencimiento &&
                        linea.fechaVencimiento
                          ? estadoLote(linea.fechaVencimiento)
                          : null;

                      return (
                        <Table.Row key={linea.key}>
                          <Table.Cell minW="13rem">
                            <Text
                              fontSize="sm"
                              fontWeight="semibold"
                              color="ink.900"
                            >
                              {linea.producto.nombre}
                            </Text>
                            <Text fontSize="xs" color="ink.500">
                              {linea.producto.codigo} ·{" "}
                              {linea.producto.unidadMedida}
                            </Text>
                          </Table.Cell>
                          <Table.Cell minW="9rem">
                            {linea.producto.requiereLote ? (
                              <>
                                <Input
                                  size="sm"
                                  h="9"
                                  value={linea.codigoLote}
                                  onChange={(evento) =>
                                    cambiar(linea.key, {
                                      codigoLote:
                                        evento.target.value.toUpperCase(),
                                    })
                                  }
                                  placeholder="Lote"
                                  bg="white"
                                  fontFamily="mono"
                                  aria-label={`Lote de ${linea.producto.nombre}`}
                                />
                                {error.codigoLote && (
                                  <Text fontSize="xs" color="red.600" mt="1">
                                    {error.codigoLote}
                                  </Text>
                                )}
                              </>
                            ) : (
                              <Text fontSize="xs" color="ink.400">
                                Sin lote
                              </Text>
                            )}
                          </Table.Cell>
                          <Table.Cell minW="10rem">
                            {linea.producto.requiereVencimiento ? (
                              <>
                                <Input
                                  size="sm"
                                  h="9"
                                  type="date"
                                  value={linea.fechaVencimiento}
                                  onChange={(evento) =>
                                    cambiar(linea.key, {
                                      fechaVencimiento: evento.target.value,
                                    })
                                  }
                                  bg="white"
                                  aria-label={`Vencimiento de ${linea.producto.nombre}`}
                                />
                                {error.fechaVencimiento && (
                                  <Text fontSize="xs" color="red.600" mt="1">
                                    {error.fechaVencimiento}
                                  </Text>
                                )}
                              </>
                            ) : (
                              <Text fontSize="xs" color="ink.400">
                                —
                              </Text>
                            )}
                          </Table.Cell>
                          <Table.Cell minW="6.5rem" textAlign="right">
                            <Input
                              size="sm"
                              h="9"
                              w="24"
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              value={linea.cantidad}
                              onChange={(evento) =>
                                cambiar(linea.key, {
                                  cantidad: evento.target.value,
                                })
                              }
                              bg="white"
                              textAlign="right"
                              aria-label={`Cantidad de ${linea.producto.nombre}`}
                            />
                            {error.cantidad && (
                              <Text
                                fontSize="xs"
                                color="red.600"
                                mt="1"
                                textAlign="right"
                              >
                                {error.cantidad}
                              </Text>
                            )}
                          </Table.Cell>
                          <Table.Cell minW="8rem">
                            {vencimiento ? (
                              <Badge
                                colorPalette={vencimiento.color}
                                variant="subtle"
                                size="sm"
                              >
                                {vencimiento.texto}
                              </Badge>
                            ) : (
                              <Text fontSize="xs" color="ink.400">
                                —
                              </Text>
                            )}
                          </Table.Cell>
                          <Table.Cell textAlign="right">
                            <IconButton
                              type="button"
                              size="sm"
                              variant="ghost"
                              colorPalette="red"
                              aria-label={`Quitar ${linea.producto.nombre}${linea.codigoLote ? ` lote ${linea.codigoLote}` : ""}`}
                              title="Quitar línea"
                              onClick={() => quitar(linea.key)}
                            >
                              <Trash2 size={15} />
                            </IconButton>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Root>
              </Table.ScrollArea>
            </Box>
          )}

          <Flex
            align="center"
            justify="space-between"
            gap="3"
            wrap="wrap"
            borderTopWidth="1px"
            borderColor="ink.100"
            pt="4"
          >
            <Flex gap="2" wrap="wrap" align="center">
              <Badge colorPalette="gray" variant="subtle">
                {resumen.lineas} {resumen.lineas === 1 ? "línea" : "líneas"}
              </Badge>
              <Badge colorPalette="brand" variant="subtle">
                {formatCantidad(resumen.unidades)} unidades
              </Badge>
              <Badge colorPalette="gray" variant="subtle">
                {resumen.productos}{" "}
                {resumen.productos === 1 ? "producto" : "productos"}
              </Badge>
            </Flex>

            <Button
              colorPalette="brand"
              disabled={lineas.length === 0}
              onClick={abrirConfirmacion}
            >
              <Plus size={16} />
              Guardar carga inicial
            </Button>
          </Flex>
        </Flex>
      </Panel>

      <FormDialog
        abierto={confirmando}
        onClose={() => {
          if (!carga.isPending) {
            setConfirmando(false);
            carga.reset();
          }
        }}
        titulo="Confirmar carga inicial"
        descripcion={`${resumen.lineas} ${resumen.lineas === 1 ? "línea" : "líneas"} · ${formatCantidad(resumen.unidades)} unidades`}
        ancho="md"
        textoConfirmar="Registrar carga"
        guardando={carga.isPending}
        bloquearCierre={carga.isPending}
        onConfirmar={guardar}
      >
        <Flex direction="column" gap="3">
          <Alert
            status="warning"
            rounded="md"
            title="Revisá las cantidades antes de confirmar"
          >
            Cada línea suma stock y genera un movimiento de apertura. Si te
            equivocaste, después podés corregirlo con un ajuste de stock.
          </Alert>

          {carga.error && (
            <Alert status="error" rounded="md">
              {mensajeDeError(carga.error)}
            </Alert>
          )}
        </Flex>
      </FormDialog>
    </Box>
  );
}
