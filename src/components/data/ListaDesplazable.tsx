import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

/**
 * Contenedor para listas de registros dentro de paneles y diálogos.
 *
 * Deja la tarjeta con una altura estable: muestra unas tres filas y, a partir
 * de ahí, activa scroll interno en vez de seguir creciendo con cada registro.
 */
export function ListaDesplazable({
  children,
  maxH = "15rem",
}: {
  children: ReactNode;
  maxH?: string | Record<string, string>;
}) {
  return (
    <Box
      maxH={maxH}
      overflowY="auto"
      overscrollBehavior="contain"
      pr="1"
      mr="-1"
    >
      {children}
    </Box>
  );
}
