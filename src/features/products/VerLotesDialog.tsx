import {
  Badge,
  Box,
  CloseButton,
  Flex,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { CalendarClock } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import {
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCantidad, formatFechaCalendario } from "@/lib/formato";
import { estadoLote } from "./lotes";
import { useLotesProducto } from "./products.service";

export function VerLotesDialog({
  productoId,
  onClose,
}: {
  productoId: number | null;
  onClose: () => void;
}) {
  const consulta = useLotesProducto(productoId ?? undefined);
  const resumen = consulta.data?.resumen;
  const producto = consulta.data?.producto;

  return (
    <DialogRoot
      open={productoId !== null}
      onOpenChange={({ open }) => {
        if (!open) onClose();
      }}
      size="xl"
    >
      <DialogContent maxW="min(94vw, 52rem)" p="4" position="relative">
        <CloseButton
          position="absolute"
          top="3"
          right="3"
          onClick={onClose}
          aria-label="Cerrar"
        />
        <DialogHeader pr="10">
          <DialogTitle>
            {producto ? `Lotes de ${producto.nombre}` : "Lotes del producto"}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          {consulta.isLoading ? (
            <Flex align="center" justify="center" gap="3" py="10" color="ink.500">
              <Spinner size="sm" />
              <Text fontSize="sm">Cargando lotes…</Text>
            </Flex>
          ) : consulta.error ? (
            <Alert status="error" rounded="md">
              No se pudieron cargar los lotes del producto.
            </Alert>
          ) : consulta.data ? (
            <Flex direction="column" gap="4">
              <Flex gap="2" wrap="wrap">
                <Badge colorPalette="gray" variant="subtle">
                  {resumen?.cantidadLotes ?? 0}{" "}
                  {resumen?.cantidadLotes === 1 ? "lote" : "lotes"}
                </Badge>
                <Badge colorPalette="brand" variant="subtle">
                  {formatCantidad(resumen?.cantidadTotal ?? 0)}{" "}
                  {producto?.unidadMedida}
                </Badge>
                {resumen?.lotesVencidos ? (
                  <Badge colorPalette="red" variant="subtle">
                    {resumen.lotesVencidos} vencido
                    {resumen.lotesVencidos === 1 ? "" : "s"}
                  </Badge>
                ) : null}
                {resumen?.lotesPorVencer ? (
                  <Badge colorPalette="orange" variant="subtle">
                    {resumen.lotesPorVencer} por vencer
                  </Badge>
                ) : null}
              </Flex>

              {consulta.data.lotes.length === 0 ? (
                <Flex
                  align="center"
                  gap="3"
                  p="4"
                  borderWidth="1px"
                  borderColor="ink.200"
                  borderRadius="lg"
                  bg="ink.50"
                >
                  <CalendarClock size={18} color="var(--chakra-colors-ink-400)" />
                  <Box>
                    <Text fontSize="sm" fontWeight="medium" color="ink.800">
                      Sin lotes con stock
                    </Text>
                    <Text fontSize="xs" color="ink.500" mt="0.5">
                      Registrá stock desde “Carga inicial” o desde una factura de
                      compra.
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
                  <Table.ScrollArea maxH="24rem">
                    <Table.Root size="sm" stickyHeader>
                      <Table.Header>
                        <Table.Row bg="ink.50">
                          <Table.ColumnHeader>Lote</Table.ColumnHeader>
                          <Table.ColumnHeader>Vencimiento</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="right">
                            Cantidad
                          </Table.ColumnHeader>
                          <Table.ColumnHeader>Ubicación</Table.ColumnHeader>
                          <Table.ColumnHeader>Estado</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {consulta.data.lotes.map((lote) => {
                          const vencimiento = estadoLote(lote.fechaVencimiento);
                          return (
                            <Table.Row key={lote.id}>
                              <Table.Cell>
                                <Text
                                  fontSize="sm"
                                  fontWeight="medium"
                                  fontFamily="mono"
                                  color="ink.900"
                                >
                                  {lote.codigoLote}
                                </Text>
                              </Table.Cell>
                              <Table.Cell whiteSpace="nowrap">
                                {lote.fechaVencimiento
                                  ? formatFechaCalendario(lote.fechaVencimiento)
                                  : "—"}
                              </Table.Cell>
                              <Table.Cell
                                textAlign="right"
                                fontVariantNumeric="tabular-nums"
                              >
                                {formatCantidad(lote.cantidadActual)}
                              </Table.Cell>
                              <Table.Cell>
                                <Text fontSize="sm" color="ink.600">
                                  {lote.ubicacion ?? "—"}
                                </Text>
                              </Table.Cell>
                              <Table.Cell>
                                <Badge
                                  colorPalette={vencimiento.color}
                                  variant="subtle"
                                  size="sm"
                                >
                                  {vencimiento.texto}
                                </Badge>
                              </Table.Cell>
                            </Table.Row>
                          );
                        })}
                      </Table.Body>
                    </Table.Root>
                  </Table.ScrollArea>
                </Box>
              )}
            </Flex>
          ) : null}
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
}
