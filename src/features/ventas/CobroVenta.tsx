import { Badge, Box, Button, Flex, Grid, IconButton, Input, Stack, Text, chakra } from "@chakra-ui/react";
import { ArrowLeftRight, Banknote, CreditCard, Plus, Send, Trash2, type LucideIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { MoneyInput } from "@/components/fields/MoneyInput";
import type { CondicionPagoVenta, MetodoPagoVenta, MonedaVenta } from "./ventas.service";

export interface PagoLinea {
  id: string;
  metodo: MetodoPagoVenta;
  monto: number;
  referencia?: string;
}

const METODOS: {
  valor: MetodoPagoVenta;
  corto: string;
  largo: string;
  icono: LucideIcon;
  pideReferencia: boolean;
}[] = [
  { valor: "efectivo", corto: "Efectivo", largo: "Efectivo", icono: Banknote, pideReferencia: false },
  { valor: "tarjeta_debito", corto: "Débito", largo: "Tarjeta débito", icono: CreditCard, pideReferencia: true },
  { valor: "tarjeta_credito", corto: "Crédito", largo: "Tarjeta crédito", icono: CreditCard, pideReferencia: true },
  { valor: "transferencia", corto: "Transfer.", largo: "Transferencia", icono: ArrowLeftRight, pideReferencia: true },
  { valor: "giro", corto: "Giro", largo: "Giro", icono: Send, pideReferencia: true },
];

const BILLETES_PYG = [10000, 20000, 50000, 100000];
const BILLETES_USD = [5, 10, 20, 50, 100];

interface Props {
  /** Total de la venta (con IVA) en la moneda seleccionada. */
  total: number;
  moneda: MonedaVenta;
  condicionPago: CondicionPagoVenta;
  pagos: PagoLinea[];
  /** Mismo formateador que usa el resumen, para no duplicar lógica de moneda. */
  formatear: (valor: number) => string;
  deshabilitado?: boolean;
  cargando?: boolean;
  onAgregar: (pago: Omit<PagoLinea, "id">) => void;
  onQuitar?: (id: string) => void;
}

function Etiqueta({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <chakra.label htmlFor={htmlFor} display="block" fontSize="xs" fontWeight="medium" color="ink.800" mb="1">
      {children}
    </chakra.label>
  );
}

export function CobroVenta({
  total,
  moneda,
  condicionPago,
  pagos,
  formatear,
  deshabilitado = false,
  cargando = false,
  onAgregar,
  onQuitar,
}: Props) {
  const uid = useId();
  const idMonto = `${uid}-monto`;
  const idEntrega = `${uid}-entrega`;
  const idReferencia = `${uid}-referencia`;
  const idMetodo = (valor: MetodoPagoVenta) => `${uid}-metodo-${valor}`;

  const [metodo, setMetodo] = useState<MetodoPagoVenta>("efectivo");
  // undefined = automático (cobra todo el saldo); null = la persona vació el campo.
  // Distinguirlos evita que el campo "reviva" el saldo apenas se borra el contenido.
  const [montoManual, setMontoManual] = useState<number | null | undefined>(undefined);
  const [entrega, setEntrega] = useState<number | null>(null);
  const [referencia, setReferencia] = useState("");

  const decimales = moneda === "USD" ? 2 : 0;
  const simbolo = moneda === "USD" ? "US$" : undefined;
  const redondear = (n: number) => {
    const f = 10 ** decimales;
    return Math.round(n * f) / f;
  };

  // Un monto escrito en guaraníes no tiene sentido al pasar a dólares (y viceversa).
  useEffect(() => {
    setMontoManual(undefined);
    setEntrega(null);
  }, [moneda]);

  const cobrado = redondear(pagos.reduce((suma, p) => suma + p.monto, 0));
  const diferencia = redondear(total - cobrado);
  const saldo = Math.max(diferencia, 0);
  const sobrecobro = total > 0 && diferencia < 0 ? redondear(-diferencia) : 0;
  const porcentaje = total > 0 ? Math.min(100, (cobrado / total) * 100) : 0;
  const cobradoPorCompleto = total > 0 && diferencia <= 0;

  const config = METODOS.find((m) => m.valor === metodo) ?? METODOS[0];
  const montoAplicar = montoManual === undefined ? saldo : redondear(montoManual ?? 0);
  const excede = montoAplicar > saldo;
  const esEfectivo = metodo === "efectivo";
  const vuelto = esEfectivo && entrega !== null && entrega > montoAplicar ? redondear(entrega - montoAplicar) : 0;
  const falta =
    esEfectivo && entrega !== null && entrega > 0 && entrega < montoAplicar
      ? redondear(montoAplicar - entrega)
      : 0;
  const puedeAgregar = !deshabilitado && total > 0 && montoAplicar > 0 && !excede;

  const sugerenciasEntrega = (moneda === "USD" ? BILLETES_USD : BILLETES_PYG)
    .filter((b) => b >= montoAplicar && b !== montoAplicar)
    .slice(0, 3);

  const estado =
    total <= 0
      ? { texto: "Sin ítems", paleta: "gray" }
      : sobrecobro > 0
        ? { texto: "Cobrado de más", paleta: "red" }
        : cobradoPorCompleto
          ? { texto: "Cobrado", paleta: "green" }
          : cobrado > 0
            ? { texto: "Cobro parcial", paleta: "orange" }
            : condicionPago === "credito"
              ? { texto: "A crédito", paleta: "blue" }
              : { texto: "Sin cobrar", paleta: "gray" };

  function elegirMetodo(valor: MetodoPagoVenta) {
    setMetodo(valor);
    if (valor !== "efectivo") setEntrega(null);
  }

  function agregar() {
    if (!puedeAgregar) return;
    onAgregar({
      metodo,
      monto: montoAplicar,
      referencia: config.pideReferencia ? referencia.trim() || undefined : undefined,
    });
    setMontoManual(undefined);
    setEntrega(null);
    setReferencia("");
  }

  // Este componente vive dentro del <form> de la venta: sin esto, Enter en un
  // campo de cobro enviaría (guardaría) la venta completa.
  function alTeclearCampo(evento: React.KeyboardEvent) {
    if (evento.key !== "Enter" || (evento.target as HTMLElement).tagName !== "INPUT") return;
    evento.preventDefault();
    agregar();
  }

  // Patrón radiogroup: una sola parada de Tab y flechas para moverse entre medios.
  function alTeclearMetodo(evento: React.KeyboardEvent<HTMLDivElement>) {
    const adelante = evento.key === "ArrowRight" || evento.key === "ArrowDown";
    const atras = evento.key === "ArrowLeft" || evento.key === "ArrowUp";
    if (!adelante && !atras) return;
    evento.preventDefault();
    const actual = METODOS.findIndex((m) => m.valor === metodo);
    const siguiente = METODOS[(actual + (adelante ? 1 : -1) + METODOS.length) % METODOS.length];
    elegirMetodo(siguiente.valor);
    document.getElementById(idMetodo(siguiente.valor))?.focus();
  }

  return (
    <Box borderWidth="1px" borderColor="ink.200" borderRadius="lg" p="3.5" bg="white">
      <Flex align="center" justify="space-between" gap="2" mb="2.5">
        <Text fontSize="sm" fontWeight="bold" color="ink.900">
          Cobro
        </Text>
        <Badge colorPalette={estado.paleta} variant="subtle" size="sm">
          {estado.texto}
        </Badge>
      </Flex>

      {/* Avance del cobro */}
      <Box>
        <Flex justify="space-between" fontSize="xs" mb="1">
          <Text color="ink.600">
            Cobrado{" "}
            <chakra.span fontWeight="semibold" color="ink.900" fontVariantNumeric="tabular-nums">
              {formatear(cobrado)}
            </chakra.span>
          </Text>
          <Text color="ink.600">
            Saldo{" "}
            <chakra.span
              fontWeight="semibold"
              fontVariantNumeric="tabular-nums"
              color={saldo > 0 ? "orange.700" : "green.700"}
            >
              {formatear(saldo)}
            </chakra.span>
          </Text>
        </Flex>
        <Box
          h="1.5"
          bg="ink.100"
          borderRadius="full"
          overflow="hidden"
          role="progressbar"
          aria-label="Avance del cobro"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(porcentaje)}
        >
          <Box
            h="full"
            w={`${porcentaje}%`}
            bg={sobrecobro > 0 ? "red.500" : cobradoPorCompleto ? "green.500" : "brand.500"}
            transition="width 0.2s"
          />
        </Box>
        {sobrecobro > 0 && (
          <Text fontSize="2xs" color="red.600" mt="1" role="alert">
            Los cobros superan el total en {formatear(sobrecobro)}. Revisá los montos.
          </Text>
        )}
      </Box>

      {/* Cobros ya registrados */}
      {pagos.length > 0 && (
        <Stack as="ul" gap="1" mt="3" listStyleType="none" p="0">
          {pagos.map((pago) => {
            const metodoPago = METODOS.find((m) => m.valor === pago.metodo);
            const Icono = metodoPago?.icono ?? Banknote;
            return (
              <Flex
                as="li"
                key={pago.id}
                align="center"
                gap="2"
                px="2"
                py="1.5"
                bg="ink.50"
                borderRadius="md"
              >
                <Box color="ink.500" flexShrink={0}>
                  <Icono size={14} />
                </Box>
                <Box flex="1" minW="0">
                  <Text fontSize="xs" fontWeight="medium" color="ink.900" truncate>
                    {metodoPago?.largo ?? pago.metodo}
                  </Text>
                  {pago.referencia && (
                    <Text fontSize="2xs" color="ink.500" truncate title={pago.referencia}>
                      Ref. {pago.referencia}
                    </Text>
                  )}
                </Box>
                <Text fontSize="xs" fontWeight="semibold" fontVariantNumeric="tabular-nums">
                  {formatear(pago.monto)}
                </Text>
                {onQuitar && (
                  <IconButton
                    type="button"
                    size="2xs"
                    variant="ghost"
                    colorPalette="red"
                    aria-label={`Quitar cobro de ${formatear(pago.monto)}`}
                    title="Quitar"
                    disabled={cargando || deshabilitado}
                    onClick={() => onQuitar(pago.id)}
                  >
                    <Trash2 size={12} />
                  </IconButton>
                )}
              </Flex>
            );
          })}
        </Stack>
      )}

      {/* Nuevo cobro */}
      {total <= 0 ? (
        <Text fontSize="xs" color="ink.500" mt="3">
          Agregá ítems a la venta para poder cobrar.
        </Text>
      ) : cobradoPorCompleto ? (
        sobrecobro === 0 && (
          <Text fontSize="xs" color="green.700" mt="3">
            La venta está cobrada por completo.
          </Text>
        )
      ) : (
        <Stack
          gap="2.5"
          mt="3"
          pt="3"
          borderTopWidth="1px"
          borderColor="ink.100"
          onKeyDown={alTeclearCampo}
        >
          {condicionPago === "credito" && (
            <Text fontSize="2xs" color="ink.500">
              Venta a crédito: lo que no cobres ahora queda como saldo pendiente.
            </Text>
          )}

          <Box>
            <Text id={`${uid}-metodo-label`} fontSize="xs" fontWeight="medium" color="ink.800" mb="1">
              Medio de pago
            </Text>
            <Grid
              templateColumns={{ base: "repeat(3, minmax(0, 1fr))", sm: "repeat(5, minmax(0, 1fr))" }}
              gap="1.5"
              role="radiogroup"
              aria-labelledby={`${uid}-metodo-label`}
              onKeyDown={alTeclearMetodo}
            >
              {METODOS.map((m) => {
                const activo = m.valor === metodo;
                const Icono = m.icono;
                return (
                  <chakra.button
                    key={m.valor}
                    id={idMetodo(m.valor)}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    tabIndex={activo ? 0 : -1}
                    disabled={deshabilitado}
                    onClick={() => elegirMetodo(m.valor)}
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    gap="0.5"
                    py="1.5"
                    px="1"
                    borderWidth="1px"
                    borderRadius="md"
                    borderColor={activo ? "brand.500" : "ink.200"}
                    bg={activo ? "brand.50" : "white"}
                    color={activo ? "brand.700" : "ink.600"}
                    fontSize="2xs"
                    fontWeight={activo ? "semibold" : "medium"}
                    cursor="pointer"
                    _hover={{ borderColor: "brand.300" }}
                    _focusVisible={{ outline: "2px solid", outlineColor: "brand.500", outlineOffset: "1px" }}
                    _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
                  >
                    <Icono size={16} />
                    {m.corto}
                  </chakra.button>
                );
              })}
            </Grid>
          </Box>

          <Box>
            <Flex align="center" justify="space-between" mb="1">
              <Etiqueta htmlFor={idMonto}>Monto a cobrar</Etiqueta>
              {montoManual !== undefined && montoAplicar !== saldo && (
                <Button
                  type="button"
                  size="2xs"
                  variant="ghost"
                  colorPalette="brand"
                  onClick={() => setMontoManual(undefined)}
                >
                  Cobrar saldo
                </Button>
              )}
            </Flex>
            <MoneyInput
              id={idMonto}
              value={montoManual === undefined ? (saldo > 0 ? saldo : null) : montoManual}
              onChange={(valor) => setMontoManual(valor)}
              placeholder="0"
              disabled={deshabilitado}
              simbolo={simbolo}
              decimales={decimales}
            />
            {excede && (
              <Text fontSize="2xs" color="red.600" mt="0.5" role="alert">
                El monto supera el saldo ({formatear(saldo)}).
              </Text>
            )}
          </Box>

          {esEfectivo && (
            <Box>
              <Etiqueta htmlFor={idEntrega}>Cliente entrega (opcional)</Etiqueta>
              <MoneyInput
                id={idEntrega}
                value={entrega}
                onChange={(valor) => setEntrega(valor)}
                placeholder="0"
                disabled={deshabilitado}
                simbolo={simbolo}
                decimales={decimales}
              />
              {montoAplicar > 0 && (
                <Flex gap="1" mt="1" wrap="wrap">
                  <Button
                    type="button"
                    size="2xs"
                    variant="outline"
                    disabled={deshabilitado}
                    onClick={() => setEntrega(montoAplicar)}
                  >
                    Exacto
                  </Button>
                  {sugerenciasEntrega.map((billete) => (
                    <Button
                      key={billete}
                      type="button"
                      size="2xs"
                      variant="outline"
                      disabled={deshabilitado}
                      onClick={() => setEntrega(billete)}
                    >
                      {formatear(billete)}
                    </Button>
                  ))}
                </Flex>
              )}
              {vuelto > 0 && (
                <Text fontSize="xs" fontWeight="semibold" color="green.700" mt="1" aria-live="polite">
                  Vuelto: {formatear(vuelto)}
                </Text>
              )}
              {falta > 0 && (
                <Text fontSize="xs" fontWeight="medium" color="orange.700" mt="1" aria-live="polite">
                  Faltan {formatear(falta)} para cubrir el monto.
                </Text>
              )}
            </Box>
          )}

          {config.pideReferencia && (
            <Box>
              <Etiqueta htmlFor={idReferencia}>
                {metodo === "transferencia" ? "N° de operación" : "N° de aprobación / referencia"} (opcional)
              </Etiqueta>
              <Input
                id={idReferencia}
                size="sm"
                value={referencia}
                onChange={(evento) => setReferencia(evento.target.value)}
                disabled={deshabilitado}
                autoComplete="off"
              />
            </Box>
          )}

          <Button
            type="button"
            size="sm"
            colorPalette="brand"
            w="full"
            onClick={agregar}
            disabled={!puedeAgregar}
            loading={cargando}
          >
            <Plus size={14} /> Agregar cobro{puedeAgregar ? ` de ${formatear(montoAplicar)}` : ""}
          </Button>
        </Stack>
      )}
    </Box>
  );
}