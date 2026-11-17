import { Box, Breadcrumb, Flex, Heading, Text } from "@chakra-ui/react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Encabezado de página.
 *
 * Centraliza título, migas y acciones para que todas las pantallas del sistema
 * compartan la misma jerarquía visual. Una app con 20 módulos se ve
 * artesanal si cada uno inventa su propio encabezado.
 */
export function PageHeader({
  titulo,
  descripcion,
  migas,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  migas?: string[];
  acciones?: ReactNode;
}) {
  return (
    <Box mb={{ base: "5", md: "6" }}>
      {migas && migas.length > 0 && (
        <Breadcrumb.Root mb="2">
          <Breadcrumb.List gap="1.5" color="ink.500" fontSize="xs">
            {migas.map((miga, indice) => {
              const esUltimo = indice === migas.length - 1;

              return (
                <Breadcrumb.Item key={miga}>
                  {esUltimo ? (
                    <Breadcrumb.Link
                      color="ink.800"
                      fontWeight="semibold"
                      cursor="default"
                    >
                      {miga}
                    </Breadcrumb.Link>
                  ) : (
                    <>
                      <Breadcrumb.Link
                        color="ink.500"
                        fontWeight="medium"
                        _hover={{ color: "ink.800" }}
                      >
                        {miga}
                      </Breadcrumb.Link>
                      <ChevronRight size={13} color="var(--chakra-colors-ink-400)" />
                    </>
                  )}
                </Breadcrumb.Item>
              );
            })}
          </Breadcrumb.List>
        </Breadcrumb.Root>
      )}

      <Flex
        align={{ base: "flex-start", md: "center" }}
        justify="space-between"
        gap="4"
        direction={{ base: "column", md: "row" }}
      >
        <Box minW={0}>
          <Heading
            as="h1"
            size={{ base: "lg", md: "xl" }}
            fontWeight="bold"
            color="ink.900"
            letterSpacing="-0.015em"
          >
            {titulo}
          </Heading>

          {descripcion && (
            <Text color="ink.600" mt="1" fontSize={{ base: "sm", md: "md" }}>
              {descripcion}
            </Text>
          )}
        </Box>

        {acciones && (
          <Flex gap="2" flexShrink={0} w={{ base: "full", md: "auto" }} wrap="wrap">
            {acciones}
          </Flex>
        )}
      </Flex>
    </Box>
  );
}

/** Tarjeta de contenido: superficie base de todo el sistema. */
export function Panel({
  children,
  padding = { base: "4", md: "5" },
  flush,
  ...rest
}: {
  children: ReactNode;
  padding?: string | Record<string, string>;
  flush?: boolean;
} & Record<string, unknown>) {
  return (
    <Box
      bg="white"
      borderRadius="lg"
      borderWidth="1px"
      borderColor="ink.200"
      boxShadow="sm"
      p={flush ? "0" : padding}
      {...rest}
    >
      {children}
    </Box>
  );
}

/** Cabecera de un panel, con título a la izquierda y acciones a la derecha. */
export function PanelHeader({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  return (
    <Flex
      align="center"
      justify="space-between"
      gap="3"
      px={{ base: "4", md: "5" }}
      py="3.5"
      borderBottomWidth="1px"
      borderColor="ink.200"
      wrap="wrap"
    >
      <Box minW={0}>
        <Text fontWeight="semibold" color="ink.900" fontSize="md">
          {titulo}
        </Text>
        {descripcion && (
          <Text fontSize="xs" color="ink.500" mt="0.5">
            {descripcion}
          </Text>
        )}
      </Box>

      {acciones && (
        <Flex gap="2" flexShrink={0}>
          {acciones}
        </Flex>
      )}
    </Flex>
  );
}