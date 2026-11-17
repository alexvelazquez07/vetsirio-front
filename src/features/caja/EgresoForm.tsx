import {
  Box,
  Field,
  Grid,
  Input,
  NativeSelect,
  Stack,
  Text,
  Textarea,
  chakra,
} from "@chakra-ui/react";
import { useState } from "react";

import { MoneyInput } from "@/components/fields/MoneyInput";
import { Alert } from "@/components/ui/alert";
import { useProveedoresOpciones } from "@/features/clients/clients.service";
import { fechaHoyCalendario } from "./caja.calculo";
import {
  ETIQUETAS_METODO_PAGO,
  ETIQUETAS_TIPO_EGRESO,
  type EgresoPayload,
  type MetodoPago,
  type MonedaEgreso,
  type TipoEgreso,
} from "./caja.service";

interface Errores {
  concepto?: string;
  monto?: string;
  tipoCambio?: string;
  fecha?: string;
}

function aNumero(valor: string): number {
  const numero = Number(valor.replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
}

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
    <Field.Root
      invalid={!!error}
      required={requerido}
      ids={id ? { control: id } : undefined}
    >
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

export function EgresoForm({
  formId = "egreso-form",
  cajaAbierta,
  onGuardar,
  errorGeneral,
}: {
  formId?: string;
  cajaAbierta: boolean;
  onGuardar: (datos: EgresoPayload) => void;
  errorGeneral?: string | null;
}) {
  const proveedores = useProveedoresOpciones();

  const [tipo, setTipo] = useState<TipoEgreso>("otros");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState<number | null>(null);
  const [moneda, setMoneda] = useState<MonedaEgreso>("PYG");
  const [tipoCambio, setTipoCambio] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [fecha, setFecha] = useState(fechaHoyCalendario);
  const [proveedorId, setProveedorId] = useState("");
  const [comprobanteNum, setComprobanteNum] = useState("");
  const [notas, setNotas] = useState("");
  const [errores, setErrores] = useState<Errores>({});

  function cambiarMoneda(valor: MonedaEgreso) {
    setMoneda(valor);
    setMonto(null);
    setErrores((previos) => ({ ...previos, monto: undefined, tipoCambio: undefined }));

    if (valor === "PYG") setTipoCambio("");
  }

  function validar(): Errores {
    const nuevos: Errores = {};

    if (concepto.trim().length < 2) {
      nuevos.concepto = "Indicá el concepto del egreso.";
    }

    if (monto === null || monto <= 0) {
      nuevos.monto = "El monto debe ser mayor a cero.";
    }

    if (moneda === "USD" && aNumero(tipoCambio) <= 0) {
      nuevos.tipoCambio = "Indicá el tipo de cambio para el monto en dólares.";
    }

    if (!fecha) {
      nuevos.fecha = "Indicá la fecha del egreso.";
    }

    return nuevos;
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    const nuevos = validar();
    setErrores(nuevos);

    if (Object.keys(nuevos).length > 0 || monto === null) return;

    onGuardar({
      tipo,
      concepto: concepto.trim(),
      monto,
      metodoPago,
      moneda,
      fecha,
      ...(moneda === "USD" ? { tipoCambio: aNumero(tipoCambio) } : {}),
      ...(proveedorId ? { proveedorId: Number(proveedorId) } : {}),
      ...(comprobanteNum.trim()
        ? { comprobanteNum: comprobanteNum.trim() }
        : {}),
      ...(notas.trim() ? { notas: notas.trim() } : {}),
    });
  }

  return (
    <chakra.form
      id={formId}
      onSubmit={enviar}
      noValidate
      bg="white"
      p="4"
      borderRadius="xl"
      borderWidth="1px"
      borderColor="ink.200"
    >
      <Stack gap="4">
        {!cajaAbierta && (
          <Alert status="warning" rounded="md" title="La caja está cerrada">
            Abrí la caja antes de registrar un egreso, incluso si el pago no es
            en efectivo.
          </Alert>
        )}

        {errorGeneral && (
          <Alert status="error" rounded="md" title="No pudimos guardar el egreso">
            {errorGeneral}
          </Alert>
        )}

        <Grid
          templateColumns={{ base: "1fr", md: "repeat(12, minmax(0, 1fr))" }}
          gap="3"
          alignItems="start"
        >
          <Box gridColumn={{ base: "auto", md: "span 4" }}>
            <Campo etiqueta="Tipo" requerido>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={tipo}
                  onChange={(evento) =>
                    setTipo(evento.target.value as TipoEgreso)
                  }
                >
                  {(Object.keys(ETIQUETAS_TIPO_EGRESO) as TipoEgreso[]).map(
                    (valor) => (
                      <option key={valor} value={valor}>
                        {ETIQUETAS_TIPO_EGRESO[valor]}
                      </option>
                    ),
                  )}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Campo>
          </Box>

          <Box gridColumn={{ base: "auto", md: "span 8" }}>
            <Campo
              etiqueta="Concepto"
              requerido
              error={errores.concepto}
            >
              <Input
                size="sm"
                value={concepto}
                onChange={(evento) => {
                  setConcepto(evento.target.value);
                  setErrores((previos) => ({
                    ...previos,
                    concepto: undefined,
                  }));
                }}
                placeholder="Ej.: alquiler del local, combustible, insumos…"
                maxLength={255}
                autoComplete="off"
              />
            </Campo>
          </Box>

          <Box gridColumn={{ base: "auto", md: "span 4" }}>
            <Campo etiqueta="Monto" requerido error={errores.monto}>
              <MoneyInput
                value={monto}
                onChange={(valor) => {
                  setMonto(valor);
                  setErrores((previos) => ({ ...previos, monto: undefined }));
                }}
                simbolo={moneda === "USD" ? "US$" : undefined}
                decimales={moneda === "USD" ? 2 : 0}
                placeholder="0"
                disabled={!cajaAbierta}
              />
            </Campo>
          </Box>

          <Box gridColumn={{ base: "auto", md: "span 3" }}>
            <Campo etiqueta="Moneda">
              <NativeSelect.Root size="sm" disabled={!cajaAbierta}>
                <NativeSelect.Field
                  value={moneda}
                  onChange={(evento) =>
                    cambiarMoneda(evento.target.value as MonedaEgreso)
                  }
                >
                  <option value="PYG">Guaraní (₲)</option>
                  <option value="USD">Dólar (US$)</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Campo>
          </Box>

          {moneda === "USD" && (
            <Box gridColumn={{ base: "auto", md: "span 5" }}>
              <Campo
                etiqueta="Tipo de cambio"
                requerido
                error={errores.tipoCambio}
                ayuda="Se usa para convertir el egreso a la caja en guaraníes."
              >
                <Input
                  size="sm"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={tipoCambio}
                  onChange={(evento) => {
                    setTipoCambio(evento.target.value);
                    setErrores((previos) => ({
                      ...previos,
                      tipoCambio: undefined,
                    }));
                  }}
                  placeholder="7500"
                  inputMode="decimal"
                  disabled={!cajaAbierta}
                />
              </Campo>
            </Box>
          )}

          <Box gridColumn={{ base: "auto", md: "span 4" }}>
            <Campo etiqueta="Método de pago">
              <NativeSelect.Root size="sm" disabled={!cajaAbierta}>
                <NativeSelect.Field
                  value={metodoPago}
                  onChange={(evento) =>
                    setMetodoPago(evento.target.value as MetodoPago)
                  }
                >
                  {(Object.keys(ETIQUETAS_METODO_PAGO) as MetodoPago[]).map(
                    (valor) => (
                      <option key={valor} value={valor}>
                        {ETIQUETAS_METODO_PAGO[valor]}
                      </option>
                    ),
                  )}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Campo>
          </Box>

          <Box gridColumn={{ base: "auto", md: "span 4" }}>
            <Campo etiqueta="Fecha" requerido error={errores.fecha}>
              <Input
                size="sm"
                type="date"
                value={fecha}
                max={fechaHoyCalendario()}
                onChange={(evento) => {
                  setFecha(evento.target.value);
                  setErrores((previos) => ({ ...previos, fecha: undefined }));
                }}
                disabled={!cajaAbierta}
              />
            </Campo>
          </Box>

          <Box gridColumn={{ base: "auto", md: "span 4" }}>
            <Campo etiqueta="Proveedor">
              <NativeSelect.Root
                size="sm"
                disabled={!cajaAbierta || proveedores.isLoading}
              >
                <NativeSelect.Field
                  value={proveedorId}
                  onChange={(evento) => setProveedorId(evento.target.value)}
                >
                  <option value="">
                    {proveedores.isLoading
                      ? "Cargando proveedores…"
                      : "Sin proveedor"}
                  </option>
                  {proveedores.data?.map((proveedor) => (
                    <option key={proveedor.id} value={proveedor.id}>
                      {proveedor.nombreMostrable}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Campo>
          </Box>

          <Box gridColumn={{ base: "auto", md: "span 4" }}>
            <Campo etiqueta="Comprobante Nº">
              <Input
                size="sm"
                value={comprobanteNum}
                onChange={(evento) => setComprobanteNum(evento.target.value)}
                placeholder="Ej.: 001-001-0000123"
                maxLength={60}
                autoComplete="off"
                disabled={!cajaAbierta}
              />
            </Campo>
          </Box>

          <Box gridColumn={{ base: "auto", md: "span 8" }}>
            <Campo etiqueta="Notas">
              <Textarea
                size="sm"
                value={notas}
                onChange={(evento) => setNotas(evento.target.value)}
                placeholder="Detalle adicional del gasto…"
                rows={3}
                maxLength={1000}
                disabled={!cajaAbierta}
              />
            </Campo>
          </Box>
        </Grid>

        <Text fontSize="xs" color="ink.500">
          El egreso queda registrado en el libro de caja de la sesión abierta.
          Si el pago no es en efectivo, no descuenta del saldo esperado, pero sí
          queda en el historial.
        </Text>
      </Stack>
    </chakra.form>
  );
}
