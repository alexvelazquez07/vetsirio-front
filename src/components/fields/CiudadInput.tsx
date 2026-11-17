import { Box, chakra, Text } from "@chakra-ui/react";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  esDepartamentoValido,
  filtrarCiudades,
  useCiudadesParaguay,
  type Ciudad,
} from "@/lib/catalogos/paraguay";

export interface CiudadInputProps {
  value: string;
  onChange: (ciudad: string, departamento?: string) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  /** Departamento ya elegido: filtra las sugerencias a ese departamento. */
  departamento?: string;
  id?: string;
}

/**
 * Autocompletado de ciudades del Paraguay.
 *
 * Acepta texto libre a propósito. El catálogo tiene las localidades
 * principales, pero una clínica puede estar en una zona rural o en un barrio
 * que no figure. Bloquear la escritura obligaría a elegir de una lista
 * incompleta y el usuario terminaría poniendo el barrio en el campo de notas.
 *
 * Interacción:
 *  · Escribe y filtra al instante, sin ir a la red.
 *  · Abajo y Enter eligen; Escape cierra.
 *  · Al elegir una ciudad se completa también el departamento.
 */
export function CiudadInput({
  value,
  onChange,
  label,
  placeholder = "Buscá tu ciudad…",
  helperText,
  errorText,
  disabled,
  required,
  maxLength,
  departamento,
  id,
}: CiudadInputProps) {
  const generado = useId();
  const inputId = id ?? generado;
  const listaId = `${inputId}-lista`;

  const { indices, cargando } = useCiudadesParaguay();

  const [abierto, setAbierto] = useState(false);
  const [resaltada, setResaltada] = useState(0);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const sugerencias = useMemo(() => {
    const todas = filtrarCiudades(value, indices, 12);

    if (!departamento) return todas;

    const clave = departamento.trim().toLowerCase();
    const propias = todas.filter(
      (c) => c.departamento.toLowerCase().includes(clave),
    );

    return propias.length > 0 ? propias : todas;
  }, [value, indices, departamento]);

  // Cierra al hacer clic afuera. Sin esto el desplegable queda flotando sobre
  // el resto del formulario y tapa el botón de guardar.
  useEffect(() => {
    function alHacerClicFuera(evento: MouseEvent) {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target as Node)
      ) {
        setAbierto(false);
      }
    }

    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  useEffect(() => {
    setResaltada(0);
  }, [value]);

  function elegir(ciudad: Ciudad) {
    onChange(ciudad.nombre, ciudad.departamento);
    setAbierto(false);
  }

  function alTeclear(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAbierto(true);
      setResaltada((previo) =>
        sugerencias.length === 0 ? 0 : (previo + 1) % sugerencias.length,
      );
      return;
    }

    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setResaltada((previo) =>
        sugerencias.length === 0 ? 0 : (previo - 1 + sugerencias.length) % sugerencias.length,
      );
      return;
    }

    if (evento.key === "Enter") {
      if (abierto && sugerencias[resaltada]) {
        evento.preventDefault();
        elegir(sugerencias[resaltada]);
      }
      return;
    }

    if (evento.key === "Escape") {
      setAbierto(false);
    }
  }

  const mostrarLista = abierto && value.trim().length > 0 && !disabled;
  const departamentoValido = departamento
    ? esDepartamentoValido(departamento, indices)
    : false;

  return (
    <Box ref={contenedorRef} position="relative">
      {label && (
        <chakra.label
          htmlFor={inputId}
          fontSize="sm"
          fontWeight="medium"
          color="ink.800"
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
        <chakra.input
          id={inputId}
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listaId}
          aria-autocomplete="list"
          autoComplete="off"
          maxLength={maxLength}
          value={value}
          placeholder={cargando ? "Cargando ciudades…" : placeholder}
          disabled={disabled}
          h="10"
          pl="3"
          pr="9"
          borderColor={errorText ? "danger.500" : "ink.200"}
          onChange={(evento: React.ChangeEvent<HTMLInputElement>) => {
            onChange(evento.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={alTeclear}
          _focusVisible={{
            borderColor: errorText ? "danger.500" : "brand.500",
            boxShadow:
              "0 0 0 3px color-mix(in srgb, var(--chakra-colors-brand-500) 22%, transparent)",
            outline: "none",
          }}
        />

        <Box
          position="absolute"
          right="2.5"
          top="50%"
          transform="translateY(-50%)"
          pointerEvents="none"
          color="ink.400"
          aria-hidden="true"
        >
          <ChevronDown size={16} />
        </Box>

        {/*
          El desplegable cuelga de esta caja, que envuelve **sólo** el input.

          Antes estaba puesto en la caja de afuera, que además de la etiqueta
          tenía el `Box` del input; el `left: 0` se resolvía contra el borde de
          esa caja completa y el ancho no terminaba de coincidir con el del
          campo. Acá queda pegado al input y con el mismo ancho, garantizado por
          `left: 0` + `right: 0` sobre la misma caja que lo contiene.
        */}
        {mostrarLista && sugerencias.length > 0 && (
          <Box
            id={listaId}
            role="listbox"
            position="absolute"
            top="calc(100% + 4px)"
            left="0"
            right="0"
            w="full"
            minW="0"
            boxSizing="border-box"
            zIndex="popover"
            bg="white"
            borderWidth="1px"
            borderColor="ink.200"
            borderRadius="md"
            boxShadow="lg"
            overflow="hidden"
            maxH="17rem"
            overflowY="auto"
          >
            {sugerencias.map((ciudad, indice) => {
              const activo = indice === resaltada;

              return (
                <chakra.button
                  key={ciudad.id}
                  type="button"
                  role="option"
                  aria-selected={activo}
                  onMouseEnter={() => setResaltada(indice)}
                  onClick={() => elegir(ciudad)}
                  w="full"
                  minW={0}
                  boxSizing="border-box"
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gap="3"
                  px="3"
                  py="2.5"
                  textAlign="left"
                  bg={activo ? "brand.subtle" : "transparent"}
                  _hover={{ bg: "brand.subtle" }}
                >
                  {/*
                    `flex="1"` + `minW={0}` + `truncate` en el nombre, y
                    `maxW` en el departamento. Sin `minW={0}` un hijo de flex no
                    puede encogerse por debajo de su contenido, así que un
                    nombre largo de ciudad empujaba al departamento fuera de la
                    fila en vez de recortarse: la opción se veía cortada y el
                    departamento desaparece.
                  */}
                  <Text
                    fontSize="sm"
                    color="ink.900"
                    fontWeight={activo ? "semibold" : "normal"}
                    flex="1"
                    minW={0}
                    truncate
                  >
                    {ciudad.nombre}
                  </Text>

                  <Text
                    fontSize="xs"
                    color="ink.500"
                    flexShrink={0}
                    maxW="45%"
                    truncate
                  >
                    {ciudad.departamento}
                  </Text>
                </chakra.button>
              );
            })}
          </Box>
        )}
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

      {/* Si el departamento escrito no existe en el catálogo, se avisa sin
          bloquear: puede ser una división administrativa que el catálogo no
          tiene cargada todavía. */}
      {departamento && !departamentoValido && value.trim().length > 0 && (
        <FlexNota tono="warning" mt="1.5">
          “{departamento}” no figura en el catálogo oficial. Se guardará igual,
          pero conviene revisar que esté bien escrito.
        </FlexNota>
      )}
    </Box>
  );
}

function FlexNota({
  children,
  tono = "info",
  mt,
}: {
  children: React.ReactNode;
  tono?: "info" | "warning";
  mt?: string;
}) {
  return (
    <Text
      fontSize="xs"
      mt={mt}
      lineHeight="1.5"
      color={tono === "warning" ? "warning.fg" : "ink.500"}
      bg={tono === "warning" ? "warning.subtle" : "transparent"}
      px={tono === "warning" ? "2" : "0"}
      py={tono === "warning" ? "1.5" : "0"}
      borderRadius="sm"
    >
      {children}
    </Text>
  );
}

export default CiudadInput;