import { Box, Button, Flex, Text, chakra } from "@chakra-ui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

export interface PaginacionProps {
  pagina: number;
  totalPaginas: number;
  total: number;
  porPagina: number;
  onCambioPagina: (pagina: number) => void;
  /** Textos en plural para el resumen. */
  singular?: string;
  plural?: string;
}

/**
 * Paginación.
 *
 * Muestra el total real, no sólo el número de páginas: quien atiende necesita
 * saber si tiene 7 clientes o 700 antes de decidir si le conviene buscar por
 * nombre.
 */
export function Paginacion({
  pagina,
  totalPaginas,
  total,
  porPagina,
  onCambioPagina,
  singular = "registro",
  plural = "registros",
}: PaginacionProps) {
  // Evita el salto de scroll al cambiar de página: si el usuario está en la
  // fila 3 y pasa a la 2, no debería perder el lugar.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pagina]);

  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  if (total === 0) {
    return null;
  }

  return (
    <Flex
      align={{ base: "stretch", sm: "center" }}
      justify="space-between"
      gap="3"
      px="4"
      py="3"
      borderTopWidth="1px"
      borderColor="ink.200"
      wrap="wrap"
    >
      <Text fontSize="xs" color="ink.600">
        Mostrando{" "}
        <chakra.span fontWeight="semibold" color="ink.900">
          {desde}
        </chakra.span>{" "}
        a{" "}
        <chakra.span fontWeight="semibold" color="ink.900">
          {hasta}
        </chakra.span>{" "}
        de{" "}
        <chakra.span fontWeight="semibold" color="ink.900">
          {total}
        </chakra.span>{" "}
        {total === 1 ? singular : plural}
      </Text>

      {totalPaginas > 1 && (
        <Flex align="center" gap="1" ml="auto">
          <BotonPagina
            onClick={() => onCambioPagina(pagina - 1)}
            disabled={pagina <= 1}
            etiqueta="Página anterior"
          >
            <ChevronLeft size={16} />
          </BotonPagina>

          <Flex align="center" gap="1" display={{ base: "none", sm: "flex" }}>
            {paginasVisibles(pagina, totalPaginas).map((item, indice) =>
              item === "..." ? (
                <Box
                  key={`puntos-${indice}`}
                  px="2"
                  fontSize="sm"
                  color="ink.400"
                >
                  …
                </Box>
              ) : (
                <chakra.button
                  key={item}
                  type="button"
                  onClick={() => onCambioPagina(item)}
                  minW="8"
                  h="8"
                  px="2"
                  borderRadius="md"
                  fontSize="sm"
                  fontWeight={item === pagina ? "bold" : "medium"}
                  bg={item === pagina ? "brand.500" : "transparent"}
                  color={item === pagina ? "white" : "ink.700"}
                  _hover={{
                    bg: item === pagina ? "brand.600" : "ink.100",
                  }}
                  aria-current={item === pagina ? "page" : undefined}
                >
                  {item}
                </chakra.button>
              ),
            )}
          </Flex>

          <Text
            fontSize="sm"
            color="ink.700"
            px="2"
            display={{ base: "block", sm: "none" }}
            fontVariantNumeric="tabular-nums"
          >
            {pagina} / {totalPaginas}
          </Text>

          <BotonPagina
            onClick={() => onCambioPagina(pagina + 1)}
            disabled={pagina >= totalPaginas}
            etiqueta="Página siguiente"
          >
            <ChevronRight size={16} />
          </BotonPagina>
        </Flex>
      )}
    </Flex>
  );
}

function BotonPagina({
  children,
  onClick,
  disabled,
  etiqueta,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  etiqueta: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      minW="8"
      px="0"
      aria-label={etiqueta}
      color="ink.700"
    >
      {children}
    </Button>
  );
}

/**
 * Qué números de página mostrar.
 *
 * Always muestra la primera, la última y una ventana alrededor de la actual.
 * Con 40 páginas, botones para todas son inmanejables; con las 5 últimas
 * Con 40 páginas, botones para todas son inmanejables; con las últimas 5
 */
function paginasVisibles(pagina: number, totalPaginas: number): (number | "...")[] {
  if (totalPaginas <= 7) {
    return Array.from({ length: totalPaginas }, (_, indice) => indice + 1);
  }

  const resultado: (number | "...")[] = [1];
  const desde = Math.max(2, pagina - 1);
  const hasta = Math.min(totalPaginas - 1, pagina + 1);

  if (desde > 2) resultado.push("...");
  for (let i = desde; i <= hasta; i++) resultado.push(i);
  if (hasta < totalPaginas - 1) resultado.push("...");

  resultado.push(totalPaginas);

  return resultado;
}

/**
 * Estado controlado de la búsqueda con espera.
 *
 * Sin esto, escribir "San José" dispara seis requests: uno por tecla. Con 350 ms
 * de espera hay uno solo, y el usuario ni lo nota.
 */
export function useBusquedaDiferida(valorInicial = "", esperaMs = 350) {
  const [texto, setTexto] = useState(valorInicial);
  const [busqueda, setBusqueda] = useState(valorInicial);

  useEffect(() => {
    const temporizador = setTimeout(() => setBusqueda(texto.trim()), esperaMs);
    return () => clearTimeout(temporizador);
  }, [texto, esperaMs]);

  return { texto, setTexto, busqueda };
}