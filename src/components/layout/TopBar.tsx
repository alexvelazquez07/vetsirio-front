import { chakra, Box, Flex, Text } from "@chakra-ui/react";
import {
  HelpCircle,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/features/auth/auth.store";
import { MENU } from "@/routes/menu";
import { MenuUsuario } from "./MenuUsuario";
import { NotificacionesMenu } from "./NotificacionesMenu";

/**
 * Barra superior.
 *
 * El botón de la izquierda es el control del menú lateral en cualquier ancho:
 * en móvil y tablet abre el drawer; en escritorio pliega o despliega la
 * columna fija. Vive acá y no flotando sobre el borde del sidebar porque así
 * queda siempre entero, con el mismo tamaño de toque y sobre una superficie
 * clara donde se lee sin esfuerzo.
 */

interface TopBarProps {
  onAbrirMenu: () => void;
  /** El drawer está abierto. Se refleja en aria-expanded del botón. */
  menuAbierto: boolean;
  /** El sidebar de escritorio está plegado. */
  colapsada: boolean;
  onToggleColapsar: () => void;
}

export function TopBar({
  onAbrirMenu,
  menuAbierto,
  colapsada,
  onToggleColapsar,
}: TopBarProps) {
  const ubicacion = useLocation();

  const titulo = obtenerTitulo(ubicacion.pathname);

  return (
    <Flex
      as="header"
      align="center"
      gap="3"
      h="16"
      px={{ base: "3", md: "5" }}
      bg="white"
      borderBottomWidth="1px"
      borderColor="ink.200"
      position="sticky"
      top="0"
      zIndex="sticky"
      flexShrink={0}
    >
      {/* Móvil y tablet: abre el drawer de navegación. */}
      <BotonNavegacion
        display={{ base: "flex", lg: "none" }}
        onClick={onAbrirMenu}
        etiqueta="Abrir menú"
        resaltado={menuAbierto}
        aria-expanded={menuAbierto}
        aria-controls="menu-lateral">
        <MenuIcon size={20} strokeWidth={2.2} />
      </BotonNavegacion>

      {/* Escritorio: pliega o despliega la columna fija. */}
      <BotonNavegacion
        display={{ base: "none", lg: "flex" }}
        onClick={onToggleColapsar}
        etiqueta={colapsada ? "Expandir menú" : "Contraer menú"}
        aria-expanded={!colapsada}
        aria-controls="navegacion-lateral">
        {colapsada ? (
          <PanelLeftOpen size={19} strokeWidth={2} />
        ) : (
          <PanelLeftClose size={19} strokeWidth={2} />
        )}
      </BotonNavegacion>

      <Box minW={0} flex="1">
        <Text
          fontWeight="bold"
          fontSize={{ base: "md", md: "lg" }}
          color="ink.900"
          truncate
        >
          {titulo}
        </Text>
      </Box>

      <Flex align="center" gap="1" flexShrink={0}>
        <BuscadorRapido />

        <NotificacionesMenu />

        <PopoverRoot positioning={{ placement: "bottom-end" }}>
          <PopoverTrigger asChild>
            <chakra.button
              as="button"
              type="button"
              display={{ base: "none", sm: "flex" }}
              alignItems="center"
              justifyContent="center"
              w="10"
              h="10"
              borderRadius="md"
              color="ink.600"
              _hover={{ bg: "ink.100", color: "ink.900" }}
              aria-label="Ayuda">
              <HelpCircle size={20} />
            </chakra.button>
          </PopoverTrigger>

          <PopoverContent bg="white" borderColor="ink.200" boxShadow="xl" maxW="18rem">
            <Text fontWeight="semibold" color="ink.900">
              ¿Necesitás ayuda?
            </Text>
            <Text fontSize="sm" color="ink.600">
              Escribinos por WhatsApp o llamanos. También podés extender tu
              período de prueba desde la pantalla de suscripción.
            </Text>
          </PopoverContent>
        </PopoverRoot>

        {/* Separador antes del avatar: separa las utilidades globales de la
            identidad de la persona. Sin él, el avatar parece otro botón más. */}
        <Box
          w="1px"
          h="6"
          bg="ink.200"
          mx="1.5"
          display={{ base: "none", sm: "block" }}
          aria-hidden="true"
        />

        {/* Avatar al final, a la derecha: es la posición donde la gente busca su
            propia cuenta sin pensarlo, y es el único acceso a la sesión en
            móvil, donde el sidebar vive oculto tras el drawer. */}
        <MenuUsuario />
      </Flex>

      {/* El aviso de trial vive en <BannerTrial>, montado en AppShell. No se
          duplica acá para que haya un solo lugar que lo controla. */}
    </Flex>
  );
}

function BotonNavegacion({
  etiqueta,
  resaltado = false,
  children,
  ...resto
}: Omit<ComponentProps<typeof chakra.button>, "children"> & {
  etiqueta: string;
  /** El panel que controla está abierto. */
  resaltado?: boolean;
  children: ReactNode;
}) {
  return (
    <chakra.button
      as="button"
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      {...resto}
      alignItems="center"
      justifyContent="center"
      w="10"
      h="10"
      flexShrink={0}
      borderRadius="lg"
      borderWidth="1px"
      borderColor={resaltado ? "brand.300" : "ink.200"}
      bg={resaltado ? "brand.subtle" : "ink.50"}
      color={resaltado ? "brand.fg" : "ink.700"}
      boxShadow="xs"
      cursor="pointer"
      transition="background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease"
      _hover={{
        bg: resaltado ? "brand.muted" : "ink.100",
        borderColor: resaltado ? "brand.400" : "ink.300",
        color: resaltado ? "brand.fg" : "ink.900",
      }}
      _active={{ transform: "scale(0.94)" }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "brand.500",
        outlineOffset: "2px",
      }}
      _motionReduce={{ transition: "none", transform: "none" }}>
      {children}
    </chakra.button>
  );
}

/**
 * Botón de búsqueda.
 *
 * Abre un diálogo con todos los módulos filtrables. Se implementa como
 * popover simple: una dependencia de "command palette" no aporta tanto como
 * cuesta, y con 20 ítems un buscador con foco y flechas alcanza y sobra.
 */
function BuscadorRapido() {
  return (
    <PopoverRoot positioning={{ placement: "bottom-end" }}>
      <PopoverTrigger asChild>
        <chakra.button
          as="button"
          type="button"
          alignItems="center"
          gap="2"
          display={{ base: "none", md: "flex" }}
          h="10"
          px="3"
          borderRadius="md"
          color="ink.500"
          bg="ink.50"
          borderWidth="1px"
          borderColor="ink.200"
          _hover={{ bg: "ink.100", color: "ink.800", borderColor: "ink.300" }}>
          <Search size={16} />
          <Text fontSize="sm">Buscar…</Text>
          <Text
            fontSize="xs"
            px="1.5"
            py="0.5"
            borderRadius="sm"
            bg="white"
            borderWidth="1px"
            borderColor="ink.200"
            ml="2"
          >
            /
          </Text>
        </chakra.button>
      </PopoverTrigger>

      <PopoverContent bg="white" borderColor="ink.200" boxShadow="xl" p="0" w="22rem">
        <BuscadorModulos />
      </PopoverContent>
    </PopoverRoot>
  );
}


function BuscadorModulos() {
  const navegar = useNavigate();
  const { puede } = useAuth();
  const [termino, setTermo] = useState("");

  const filtrados = MENU.flatMap((grupo) =>
    grupo.items
      .filter((item) => {
        if (item.permiso === "__superadmin__") return false;
        return !item.permiso || puede(item.permiso);
      })
      .filter((item) =>
        item.etiqueta.toLowerCase().includes(termino.toLowerCase()),
      )
      .map((item) => ({ ...item, grupo: grupo.etiqueta })),
  );

  return (
    <Box>
      <Flex align="center" gap="2" px="3" py="2.5" borderBottomWidth="1px" borderColor="ink.200">
        <Search size={16} color="var(--chakra-colors-ink-400)" />
        <chakra.input
          autoFocus
          placeholder="Buscar un módulo…"
          value={termino}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTermo(e.target.value)}
          border="none"
          outline="none"
          w="full"
          fontSize="sm"
          color="ink.900"
          _placeholder={{ color: "ink.400" }}
        />
      </Flex>

      <Box maxH="18rem" overflowY="auto" p="2">
        {filtrados.length === 0 ? (
          <Text p="3" fontSize="sm" color="ink.500" textAlign="center">
            Ningún módulo coincide con «{termino}».
          </Text>
        ) : (
          filtrados.map((item) => {
            const Icono = item.icono;

            return (
              <chakra.button
                key={item.ruta}
                as="button"
                type="button"
                w="full"
                alignItems="center"
                gap="2.5"
                px="2.5"
                py="2"
                borderRadius="md"
                _hover={{ bg: "ink.50" }}
                onClick={() => navegar(item.ruta)}
                textAlign="left">
                <Flex
                  align="center"
                  justify="center"
                  w="7"
                  h="7"
                  borderRadius="md"
                  bg="brand.subtle"
                  color="brand.fg"
                  flexShrink={0}
                >
                  <Icono size={15} />
                </Flex>

                <Box minW={0} flex="1">
                  <Text fontSize="sm" fontWeight="medium" color="ink.900" truncate>
                    {item.etiqueta}
                  </Text>
                  <Text fontSize="xs" color="ink.500">
                    {item.grupo}
                  </Text>
                </Box>
              </chakra.button>
            );
          })
        )}
      </Box>
    </Box>
  );
}

/** Deriva el título de la barra a partir de la ruta. */
function obtenerTitulo(ruta: string): string {
  if (ruta === "/") return "Inicio";

  for (const grupo of MENU) {
    for (const item of grupo.items) {
      if (item.ruta !== "/" && ruta.startsWith(item.ruta)) {
        return item.etiqueta;
      }
    }
  }

  return "VetSirio";
}