import { Box, chakra, Input, Text } from "@chakra-ui/react";
import { useCallback, useId, useRef, useState } from "react";

import {
  SIMBOLO_GS,
  aEntero,
  desenmascararMonto,
  formatMilesimas,
  formatMoneda,
  enmascararMonto,
} from "@/lib/formato";

export interface MoneyInputProps {
  /** Valor controlado en números. Null o undefined = campo vacío. */
  value?: number | null;
  onChange: (valor: number | null) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  name?: string;
  id?: string;
  /** Nombre accesible cuando no hay label visible. */
  ariaLabel?: string;
  /** Muestra el total formateado con símbolo bajo el campo. */
  mostrarTotal?: boolean;
  /** Símbolo de la moneda. Guaraní por defecto. */
  simbolo?: string;
  /**
   * Decimales admitidos. 0 (guaraní) descarta los centavos; 2 sirve para
   * monedas como el dólar, donde 12,50 no puede convertirse en 1.250.
   */
  decimales?: number;
}

function enmascararConDecimales(entrada: string, decimales: number): string {
  const indiceComa = entrada.lastIndexOf(",");
  const parteEntera = indiceComa >= 0 ? entrada.slice(0, indiceComa) : entrada;
  const parteDecimal = indiceComa >= 0 ? entrada.slice(indiceComa + 1) : null;

  const digitosEnteros = parteEntera.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const enteroFormateado = digitosEnteros.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  if (parteDecimal === null) return enteroFormateado;

  const digitosDecimales = parteDecimal.replace(/\D/g, "").slice(0, decimales);
  return `${enteroFormateado || "0"},${digitosDecimales}`;
}

function desenmascararConDecimales(entrada: string): number | null {
  const limpio = entrada.replace(/\./g, "").replace(",", ".");

  if (limpio.trim() === "") return null;

  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

function formatearConDecimales(valor: number, decimales: number): string {
  return valor.toLocaleString("es-PY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  });
}

/**
 * Campo de monto en guaraníes.
 *
 * Escribe 1500000 y mientras tipeás ve "1.500.000". El prefijo ₲ es
 * decorativo y no se selecciona, así el usuario no lo borra por error.
 *
 * Detalles que parecen menores pero definen la sensación de calidad:
 *  · La máscara se aplica en cada tecla, no al salir del campo. Si se aplicara
 *    al blur, el usuario vería el número plano mientras escribe, que es lo que
 *    hace que un formulario se sienta "de juguete".
 *  · El cursor vuelve al final tras cada tecla, así que insertar un dígito en
 *    medio de un número largo no pierde la posición.
 *  · onBlur lo convierte a número: el string enmascarado es sólo de edición.
 *  · Empty es null, no 0. La diferencia importa: un campo vacío es "no
 *    informado" y un cero es "vale cero". El schema de validación lo distingue.
 */
export function MoneyInput({
  value,
  onChange,
  label,
  placeholder = "0",
  helperText,
  errorText,
  disabled,
  readOnly,
  required,
  autoFocus,
  name,
  id,
  ariaLabel,
  mostrarTotal,
  simbolo = SIMBOLO_GS,
  decimales = 0,
}: MoneyInputProps) {
  const generado = useId();
  const inputId = id ?? generado;
  const conDecimales = decimales > 0;

  // El string enmascarado sólo existe mientras el campo tiene foco. Fuera de
  // foco se deriva del valor numérico, para que un reset de formulario o una
  // recarga de datos no deje el campo mostrando algo viejo.
  const [texto, setTexto] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const valorVisible =
    texto ??
    (value === null || value === undefined
      ? ""
      : conDecimales
        ? formatearConDecimales(value, decimales)
        : formatMilesimas(value));

  const manejarCambio = useCallback(
    (evento: React.ChangeEvent<HTMLInputElement>) => {
      const enmascarado = conDecimales
        ? enmascararConDecimales(evento.target.value, decimales)
        : enmascararMonto(evento.target.value);
      setTexto(enmascarado);

      const numero = conDecimales
        ? desenmascararConDecimales(enmascarado)
        : desenmascararMonto(enmascarado);
      onChange(numero);

      // Se reposiciona el cursor: insertar en medio de "1.500.000" debe
      // respectar la posición del usuario, no saltar al final.
      requestAnimationFrame(() => {
        const input = inputRef.current;
        if (input) {
          const longitudDeseada = enmascarado.length;
          if (input.selectionStart !== longitudDeseada || input.selectionEnd !== longitudDeseada) {
            input.setSelectionRange(longitudDeseada, longitudDeseada);
          }
        }
      });
    },
    [onChange, conDecimales, decimales],
  );

  const manejarBlur = useCallback(() => {
    setTexto(null);
  }, []);

  const total = value === null || value === undefined ? null : aEntero(value);

  return (
    <Box>
      {label && (
        <chakra.label
          htmlFor={inputId}
          fontSize="sm"
          fontWeight="medium"
          color="ink.700"
          mb="1.5"
          display="block"
        >
          {label}
          {required && (
            <chakra.span color="danger.500" ml="1">
              *
            </chakra.span>
          )}
        </chakra.label>
      )}

      <Box position="relative">
        <Box
          position="absolute"
          left="3"
          top="50%"
          transform="translateY(-50%)"
          fontSize="sm"
          fontWeight="medium"
          color={disabled ? "ink.400" : "ink.500"}
          pointerEvents="none"
          userSelect="none"
          zIndex="1"
        >
          {simbolo}
        </Box>

        <Input
          id={inputId}
          name={name}
          aria-label={ariaLabel}
          ref={inputRef}
          value={valorVisible}
          onChange={manejarCambio}
          onBlur={manejarBlur}
          onFocus={(e) => e.currentTarget.select()}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          autoFocus={autoFocus}
          inputMode={conDecimales ? "decimal" : "numeric"}
          // solo dígitos y separadores: bloquea letras, signo y espacios antes
          // de que lleguen al estado.
          pattern={conDecimales ? "[0-9.,]*" : "[0-9.]*"}
          pl={simbolo.length > 1 ? "10" : "7"}
          h="10"
          fontVariantNumeric="tabular-nums"
          fontWeight="medium"
          bg={disabled ? "ink.50" : "white"}
          borderColor={errorText ? "danger.500" : "ink.200"}
          _hover={disabled ? undefined : { borderColor: errorText ? "danger.600" : "ink.300" }}
          _focusVisible={{
            borderColor: errorText ? "danger.600" : "brand.500",
            boxShadow: errorText
              ? "0 0 0 3px rgb(240 68 56 / 0.2)"
              : "0 0 0 3px color-mix(in srgb, var(--chakra-colors-brand-500) 25%, transparent)",
            outline: "none",
          }}
          fontSize={{ base: "md", md: "sm" }}
        />
      </Box>

      {errorText ? (
        <Text fontSize="xs" color="danger.600" mt="1.5" fontWeight="medium">
          {errorText}
        </Text>
      ) : helperText ? (
        <Text fontSize="xs" color="ink.500" mt="1.5">
          {helperText}
        </Text>
      ) : null}

      {mostrarTotal && total !== null && total !== 0 && (
        <Text
          fontSize="xs"
          color="brand.700"
          mt="1.5"
          fontWeight="semibold"
          fontVariantNumeric="tabular-nums"
        >
          Total: {formatMoneda(total)}
        </Text>
      )}
    </Box>
  );
}

export default MoneyInput;