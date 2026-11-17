import { Box, Flex, chakra, Spinner, Text } from "@chakra-ui/react";
import type { SystemStyleObject } from "@chakra-ui/react";
import { ArrowDown, ArrowUp, Inbox, Search } from "lucide-react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState, type ReactNode } from "react";

/**
 * Tabla de datos reutilizable.
 *
 * Pensada para las pantallas de listado del sistema: búsqueda, orden, estados
 * de carga y vacío, y diseño responsive real.
 *
 * Sobre el responsive: en pantallas angostas la tabla pasa a lista de tarjetas
 * en lugar de hacer scroll horizontal. Scrollear en una tabla de clientes es la
 * forma más rápida de hacer que una app se sienta como una hoja de cálculo y no
 * como un producto. Además, el scroll horizontal esconde columnas, y en una
 * tabla de clientes la columna de teléfono es justo la que no puede faltar.
 */

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  cargando?: boolean;
  /** Texto del estado vacío: cambia según el contexto. */
  vacioTitulo?: string;
  vacioDetalle?: string;
  /** Cambia el mensaje del vacío cuando hay una búsqueda sin resultados. */
  hayBusqueda?: boolean;
  /** Contenido del encabezado: buscador, filtros y acciones. */
  acciones?: ReactNode;
  onFilaClick?: (fila: TData) => void;
  claveFila: (fila: TData) => number | string;
  /** Estilo extra por fila: se usa para resaltar alertas (stock, vencimientos). */
  estiloFila?: (fila: TData) => SystemStyleObject | undefined;
  /** Densidad compacta para tablas con muchas columnas. */
  compacta?: boolean;
}

export function DataTable<TData>({
  data,
  columns,
  cargando,
  vacioTitulo = "Todavía no hay registros",
  vacioDetalle = "Cuando cargues el primero, aparecerá en esta lista.",
  hayBusqueda = false,
  acciones,
  onFilaClick,
  claveFila,
  estiloFila,
  compacta = false,
}: DataTableProps<TData>) {
  // El orden vive acá y no en el servidor a propósito: el orden es una
  // preferencia de lectura de esta pantalla, no parte de la consulta. El
  // servidor ya pagina y ordena por lo que el usuario pidió explícitamente.
  const [orden, setOrden] = useState<SortingState>([]);

  const tabla = useReactTable({
    data,
    columns,
    state: { sorting: orden },
    onSortingChange: setOrden,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const celdaPadding = compacta ? "2.5" : "3";

  return (
    <Box>
      {acciones && (
        <Flex
          align={{ base: "stretch", md: "center" }}
          justify="space-between"
          gap="3"
          wrap="wrap"
          p="4"
          borderBottomWidth="1px"
          borderColor="ink.200"
        >
          {acciones}
        </Flex>
      )}

      {cargando ? (
        <Flex align="center" justify="center" py="16" direction="column" gap="3">
          <Spinner size="lg" color="brand.500" />
          <Text fontSize="sm" color="ink.500">
            Cargando…
          </Text>
        </Flex>
      ) : data.length === 0 ? (
        <EstadoVacio
          titulo={hayBusqueda ? "Sin resultados" : vacioTitulo}
          detalle={
            hayBusqueda
              ? "Probá con otro término de búsqueda o quitá los filtros."
              : vacioDetalle
          }
          esBusqueda={hayBusqueda}
        />
      ) : (
        <>
          {/* ── Escritorio: tabla ────────────────────────────────────── */}
          <Box display={{ base: "none", lg: "block" }} overflowX="auto">
            <chakra.table w="full" borderCollapse="collapse">
              <chakra.thead bg="ink.50">
                {tabla.getHeaderGroups().map((grupo) => (
                  <chakra.tr key={grupo.id}>
                    {grupo.headers.map((header) => {
                      const ordenable = header.column.getCanSort();
                      const direccion = header.column.getIsSorted();
                      const alineacion =
                        header.column.columnDef.meta?.align ?? "left";

                      return (
                        <chakra.th
                          key={header.id}
                          textAlign={alineacion}
                          px="4"
                          py="3"
                          fontSize="xs"
                          fontWeight="bold"
                          textTransform="uppercase"
                          letterSpacing="0.04em"
                          color="ink.500"
                          borderBottomWidth="1px"
                          borderColor="ink.200"
                          whiteSpace="nowrap"
                          aria-sort={
                            direccion === "asc"
                              ? "ascending"
                              : direccion === "desc"
                                ? "descending"
                                : "none"
                          }
                        >
                          {ordenable ? (
                            <chakra.button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              display="inline-flex"
                              alignItems="center"
                              gap="1.5"
                              fontSize="inherit"
                              fontWeight="inherit"
                              letterSpacing="inherit"
                              color="inherit"
                              _hover={{ color: "ink.900" }}
                            >
                              <chakra.span textTransform="uppercase">
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                              </chakra.span>
                              {direccion === "asc" ? (
                                <ArrowUp size={13} />
                              ) : direccion === "desc" ? (
                                <ArrowDown size={13} />
                              ) : null}
                            </chakra.button>
                          ) : (
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )
                          )}
                        </chakra.th>
                      );
                    })}
                  </chakra.tr>
                ))}
              </chakra.thead>

              <chakra.tbody>
                {tabla.getRowModel().rows.map((fila) => (
                  <chakra.tr
                    key={fila.id}
                    onClick={() => onFilaClick?.(fila.original)}
                    cursor={onFilaClick ? "pointer" : "default"}
                    transition="background 0.12s ease"
                    _hover={{ bg: "ink.50" }}
                    borderBottomWidth="1px"
                    borderColor="ink.100"
                    {...estiloFila?.(fila.original)}
                  >
                    {fila.getVisibleCells().map((celda) => (
                      <chakra.td
                        key={celda.id}
                        px="4"
                        py={celdaPadding}
                        fontSize="sm"
                        color="ink.800"
                        textAlign={celda.column.columnDef.meta?.align ?? "left"}
                        verticalAlign="middle"
                      >
                        {flexRender(celda.column.columnDef.cell, celda.getContext())}
                      </chakra.td>
                    ))}
                  </chakra.tr>
                ))}
              </chakra.tbody>
            </chakra.table>
          </Box>

          {/* ── Móvil y tablet: tarjetas ─────────────────────────────── */}
          <Flex
            display={{ base: "flex", lg: "none" }}
            direction="column"
            gap="2"
            p="3"
          >
            {tabla.getRowModel().rows.map((fila) => {
              const celdas = fila.getVisibleCells();
              const principal = celdas[0];
              const resto = celdas.slice(1);

              return (
                <Box
                  key={claveFila(fila.original)}
                  borderWidth="1px"
                  borderColor="ink.200"
                  borderRadius="md"
                  p="3.5"
                  bg="white"
                  onClick={() => onFilaClick?.(fila.original)}
                  cursor={onFilaClick ? "pointer" : "default"}
                  _active={{ bg: "ink.50" }}
                  {...estiloFila?.(fila.original)}
                >
                  {principal && (
                    <Box
                      fontWeight="semibold"
                      color="ink.900"
                      fontSize="sm"
                      mb={resto.length > 0 ? "2.5" : "0"}
                    >
                      {flexRender(
                        principal.column.columnDef.cell,
                        principal.getContext(),
                      )}
                    </Box>
                  )}

                  <Flex direction="column" gap="1.5">
                    {resto.map((celda) => {
                      const contenido = flexRender(
                        celda.column.columnDef.cell,
                        celda.getContext(),
                      );

                      if (contenido === null || contenido === undefined) {
                        return null;
                      }

                      const encabezado = celda.column.columnDef.header;
                      const esAccion = celda.column.id === "acciones";

                      // Los botones de acción no se repiten como etiqueta:
                      // la tarjeta es chica y un botón con "Editar | Desactivar"
                      // al lado es ruido.
                      if (esAccion) {
                        return (
                          <Flex
                            key={celda.id}
                            justify="flex-end"
                            mt="2"
                            pt="2.5"
                            borderTopWidth="1px"
                            borderColor="ink.100"
                          >
                            {contenido}
                          </Flex>
                        );
                      }

                      return (
                        <Flex
                          key={celda.id}
                          justify="space-between"
                          align="center"
                          gap="3"
                        >
                          {typeof encabezado === "string" && (
                            <Text
                              fontSize="xs"
                              color="ink.500"
                              flexShrink={0}
                            >
                              {encabezado}
                            </Text>
                          )}
                          <Box
                            fontSize="sm"
                            color="ink.800"
                            textAlign="right"
                            minW={0}
                          >
                            {contenido}
                          </Box>
                        </Flex>
                      );
                    })}
                  </Flex>
                </Box>
              );
            })}
          </Flex>
        </>
      )}
    </Box>
  );
}

function EstadoVacio({
  titulo,
  detalle,
  esBusqueda,
}: {
  titulo: string;
  detalle: string;
  esBusqueda: boolean;
}) {
  return (
    <Flex
      direction="column"
      align="center"
      textAlign="center"
      py={{ base: "12", md: "16" }}
      px="6"
    >
      <Flex
        align="center"
        justify="center"
        w="12"
        h="12"
        borderRadius="full"
        bg={esBusqueda ? "brand.subtle" : "ink.100"}
        color={esBusqueda ? "brand.fg" : "ink.400"}
        mb="4"
      >
        {esBusqueda ? <Search size={22} /> : <Inbox size={22} />}
      </Flex>

      <Text fontWeight="semibold" color="ink.800" fontSize="sm">
        {titulo}
      </Text>
      <Text fontSize="xs" color="ink.500" mt="1" maxW="24rem" lineHeight="1.6">
        {detalle}
      </Text>
    </Flex>
  );
}