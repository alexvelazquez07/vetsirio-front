import {
  Box,
  Button,
  Field,
  Flex,
  Grid,
  Input,
  Text,
  Textarea,
  chakra,
} from "@chakra-ui/react";
import { ArrowDownToLine, ArrowUpFromLine, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { FormDialog } from "@/components/data/FormDialog";
import { Alert } from "@/components/ui/alert";
import type { Producto } from "@/types/dominio";

export interface AjusteStockValores {
  tipo: "entrada" | "salida";
  cantidad: number;
  observacion?: string;
}

export function AjusteStockDialog({
  abierto,
  producto,
  onClose,
  onAjustar,
  guardando,
  errorGeneral,
}: {
  abierto: boolean;
  producto: Producto | null;
  onClose: () => void;
  onAjustar: (valores: AjusteStockValores) => void;
  guardando: boolean;
  errorGeneral?: string | null;
}) {
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");
  const [cantidad, setCantidad] = useState("1");
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState("");

  const stockActual = Number(producto?.stockActual ?? 0);
  const cantidadNumero = Number(cantidad.replace(",", "."));
  const cantidadValida =
    Number.isFinite(cantidadNumero) && cantidadNumero > 0;
  const resultante =
    stockActual + (tipo === "salida" ? -cantidadNumero : cantidadNumero);
  const stockInsuficiente = tipo === "salida" && resultante < 0;

  useEffect(() => {
    if (!abierto) return;
    setTipo("entrada");
    setCantidad("1");
    setObservacion("");
    setError("");
  }, [abierto, producto?.id]);

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError("");

    if (!cantidadValida) {
      setError("Ingresá una cantidad mayor a cero.");
      return;
    }

    if (stockInsuficiente) {
      setError(
        `No podés retirar más de lo disponible (${stockActual} ${producto?.unidadMedida ?? "unidad"}).`,
      );
      return;
    }

    onAjustar({
      tipo,
      cantidad: cantidadNumero,
      observacion: observacion.trim() || undefined,
    });
  }

  const color = tipo === "entrada" ? "success" : "danger";

  return (
    <FormDialog
      abierto={abierto}
      onClose={onClose}
      titulo="Ajustar stock"
      descripcion={
        producto
          ? `${producto.nombre} · stock actual ${stockActual} ${producto.unidadMedida}`
          : undefined
      }
      textoConfirmar="Registrar movimiento"
      guardando={guardando}
      bloquearCierre={guardando}
      ancho="md"
      onConfirmar={() => {
        document
          .querySelector<HTMLFormElement>("#ajuste-stock-form")
          ?.requestSubmit();
      }}
    >
      <chakra.form id="ajuste-stock-form" onSubmit={enviar} noValidate>
        <Grid templateColumns="1fr 1fr" gap="3" mb="5">
          <chakra.button
            type="button"
            onClick={() => setTipo("entrada")}
            textAlign="left"
            p="4"
            borderWidth="1.5px"
            borderColor={tipo === "entrada" ? "success.400" : "ink.200"}
            bg={tipo === "entrada" ? "success.subtle" : "white"}
            borderRadius="lg"
            transition="border-color 0.15s ease, background 0.15s ease"
            _hover={{ borderColor: "success.300" }}
            aria-pressed={tipo === "entrada"}
          >
            <Flex align="center" gap="2.5">
              <Flex
                align="center"
                justify="center"
                w="8"
                h="8"
                borderRadius="md"
                bg={tipo === "entrada" ? "success.100" : "ink.100"}
                color={tipo === "entrada" ? "success.700" : "ink.500"}
              >
                <ArrowDownToLine size={17} />
              </Flex>
              <Box>
                <Text fontWeight="semibold" fontSize="sm" color="ink.900">
                  Entrada
                </Text>
                <Text fontSize="xs" color="ink.500">
                  Compra o reposición
                </Text>
              </Box>
            </Flex>
          </chakra.button>

          <chakra.button
            type="button"
            onClick={() => setTipo("salida")}
            textAlign="left"
            p="4"
            borderWidth="1.5px"
            borderColor={tipo === "salida" ? "danger.400" : "ink.200"}
            bg={tipo === "salida" ? "danger.subtle" : "white"}
            borderRadius="lg"
            transition="border-color 0.15s ease, background 0.15s ease"
            _hover={{ borderColor: "danger.300" }}
            aria-pressed={tipo === "salida"}
          >
            <Flex align="center" gap="2.5">
              <Flex
                align="center"
                justify="center"
                w="8"
                h="8"
                borderRadius="md"
                bg={tipo === "salida" ? "danger.100" : "ink.100"}
                color={tipo === "salida" ? "danger.700" : "ink.500"}
              >
                <ArrowUpFromLine size={17} />
              </Flex>
              <Box>
                <Text fontWeight="semibold" fontSize="sm" color="ink.900">
                  Salida
                </Text>
                <Text fontSize="xs" color="ink.500">
                  Merma o retiro
                </Text>
              </Box>
            </Flex>
          </chakra.button>
        </Grid>

        <Field.Root
          invalid={!!error || stockInsuficiente}
          required
          mb="4"
        >
          <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
            Cantidad
            <Field.RequiredIndicator />
          </Field.Label>
          <Input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={cantidad}
            onChange={(evento) => {
              setCantidad(evento.target.value);
              setError("");
            }}
            autoFocus
            fontVariantNumeric="tabular-nums"
          />
          <Field.HelperText fontSize="xs" color="ink.500">
            Se registra como {tipo} manual en el historial del producto.
          </Field.HelperText>
        </Field.Root>

        <Box mb="4">
          <Field.Root ids={{ control: "ajuste-observacion" }}>
            <Field.Label fontSize="sm" fontWeight="medium" color="ink.800">
              Observación
            </Field.Label>
            <Textarea
              id="ajuste-observacion"
              value={observacion}
              onChange={(evento) => setObservacion(evento.target.value)}
              placeholder="Ej.: reposición de proveedor, vencimiento, rotura…"
              rows={2}
              maxLength={1000}
            />
          </Field.Root>
        </Box>

        <Box
          p="4"
          borderRadius="lg"
          bg={`${color}.subtle`}
          borderWidth="1px"
          borderColor={`${color}.100`}
          mb="4"
        >
          <Flex align="center" justify="space-between" gap="3" wrap="wrap">
            <Flex align="center" gap="3">
              <Flex
                align="center"
                justify="center"
                w="9"
                h="9"
                borderRadius="lg"
                bg="white"
                color={`${color}.600`}
              >
                <PackageCheck size={18} />
              </Flex>
              <Box>
                <Text fontSize="sm" fontWeight="semibold" color="ink.900">
                  {stockInsuficiente
                    ? "Stock insuficiente"
                    : "Stock después del ajuste"}
                </Text>
                <Text fontSize="xs" color="ink.600" mt="0.5">
                  {stockActual} {producto?.unidadMedida ?? "unidad"} →{" "}
                  {Number.isFinite(resultante) ? resultante : stockActual}{" "}
                  {producto?.unidadMedida ?? "unidad"}
                </Text>
              </Box>
            </Flex>
            <Text
              fontSize="xl"
              fontWeight="bold"
              color={`${color}.700`}
              fontVariantNumeric="tabular-nums"
            >
              {tipo === "entrada" ? "+" : "−"}
              {cantidadValida ? cantidadNumero : 0}
            </Text>
          </Flex>
        </Box>

        {(error || stockInsuficiente) && (
          <Text role="alert" fontSize="sm" color="danger.600" mb="4">
            {error ||
              `No podés retirar más de lo disponible (${stockActual} ${producto?.unidadMedida ?? "unidad"}).`}
          </Text>
        )}

        {errorGeneral && <Alert status="error">{errorGeneral}</Alert>}

        <Button type="submit" display="none" aria-hidden="true" tabIndex={-1} />
      </chakra.form>
    </FormDialog>
  );
}
