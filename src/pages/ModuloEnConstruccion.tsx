import { Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { Construction } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader, Panel } from "@/components/layout/PageHeader";

/**
 * Pantalla de módulo en construcción.
 *
 * Existe para que el menú y el ruteo estén completos desde el primer día: se
 * puede navegar toda la aplicación y ver la estructura real, aunque los módulos
 * se hagan de a uno. Es preferible a un menú vacío o a pantallas en blanco que
 * rompen el flujo de pruebas.
 */
export function ModuloEnConstruccion({
  titulo,
  descripcion,
  icono: Icono = Construction,
  volverA,
}: {
  titulo: string;
  descripcion: string;
  icono?: typeof Construction;
  volverA?: { texto: string; to: string };
}) {
  return (
    <Box>
      <PageHeader titulo={titulo} descripcion={descripcion} />

      <Panel>
        <Flex
          direction="column"
          align="center"
          textAlign="center"
          py={{ base: "12", md: "16" }}
          px="6"
        >
          <Flex
            align="center"
            justify="center"
            w="14"
            h="14"
            borderRadius="full"
            bg="brand.subtle"
            color="brand.fg"
            mb="5"
          >
            <Icono size={26} strokeWidth={1.9} />
          </Flex>

          <Heading as="h2" size="md" fontWeight="bold" color="ink.900">
            Módulo en construcción
          </Heading>

          <Text
            fontSize="sm"
            color="ink.600"
            mt="2"
            maxW="28rem"
            lineHeight="1.7"
          >
            Esta pantalla forma parte del menú y del ruteo, pero la lógica de
            negocio todavía no está conectada. El andamiaje ya está: permisos,
            aislamiento por veterinaria y componentes listos.
          </Text>

          <Link to={volverA?.to ?? "/"}>
            <Button mt="6" colorPalette="brand" variant="outline" size="sm">
              {volverA?.texto ?? "Volver al inicio"}
            </Button>
          </Link>
        </Flex>
      </Panel>
    </Box>
  );
}