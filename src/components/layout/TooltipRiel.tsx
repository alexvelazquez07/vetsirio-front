import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

/**
 * Tooltip para el riel plegado del sidebar.
 *
 * Es CSS puro en lugar de la primitiva <Tooltip> porque el riel es estrecho y
 * el tooltip tiene que asomarse hacia la derecha del todo, pegado al borde de
 * la pantalla. El portal de la primitiva lo posiciones respecto al trigger, que
 * en un riel de 64px deja el texto cortado en pantallas chicas.
 *
 * Se comparte en su propio módulo y no dentro de <Sidebar> porque lo usan
 * también el menú de usuario y el buscador, que viven fuera del sidebar.
 *
 * `opacity` en lugar de unmount: aparece y desaparece sin sacar el nodo del
 * árbol, así que no hay re-layout al hover.
 */
export function TooltipRiel({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: ReactNode;
}) {
  return (
    <Box position="relative" role="group" w="full">
      {children}
      <Box
        position="absolute"
        left="calc(100% + 12px)"
        top="50%"
        transform="translateY(-50%)"
        px="2.5"
        py="1.5"
        borderRadius="md"
        bg="ink.900"
        color="white"
        fontSize="xs"
        fontWeight="medium"
        whiteSpace="nowrap"
        opacity="0"
        pointerEvents="none"
        transition="opacity 0.15s ease"
        zIndex="popover"
        boxShadow="lg"
        _groupHover={{ opacity: 1 }}
      >
        {etiqueta}
      </Box>
    </Box>
  );
}