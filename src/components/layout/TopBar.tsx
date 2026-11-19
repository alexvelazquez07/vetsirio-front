import { chakra, Box, Flex, Text } from "@chakra-ui/react";
import {
  HelpCircle,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { MENU } from "@/routes/menu";
import { BuscadorGlobal } from "./BuscadorGlobal";
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
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);

  const titulo = obtenerTitulo(ubicacion.pathname);

  // Ctrl/Cmd + K y "/" abren el buscador. "/" se ignora mientras se escribe en
  // un campo: ahí la barra es un carácter, no un atajo. El diálogo sólo se
  // monta al abrirse, así el árbol cerrado no consulta la API ni pide un
  // QueryClient en las pruebas de la barra.
  useEffect(() => {
    const alPresionar = (evento: KeyboardEvent) => {
      const objetivo = evento.target;
      const escribiendo =
        objetivo instanceof HTMLElement &&
        (objetivo.tagName === "INPUT" ||
          objetivo.tagName === "TEXTAREA" ||
          objetivo.tagName === "SELECT" ||
          objetivo.isContentEditable);

      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        setBuscadorAbierto(true);
        return;
      }

      if (evento.key === "/" && !escribiendo) {
        evento.preventDefault();
        setBuscadorAbierto(true);
      }
    };

    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, []);

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
        <chakra.button
          type="button"
          onClick={() => setBuscadorAbierto(true)}
          aria-label="Buscar mascotas y módulos"
          title="Buscar mascotas y módulos (Ctrl+K)"
          aria-keyshortcuts="Control+K"
          display="flex"
          alignItems="center"
          justifyContent={{ base: "center", md: "flex-start" }}
          gap="2"
          w={{ base: "10", md: "auto" }}
          h="10"
          px={{ base: "0", md: "3" }}
          borderRadius="lg"
          color="ink.500"
          bg="ink.50"
          borderWidth="1px"
          borderColor="ink.200"
          cursor="pointer"
          transition="background 0.15s ease, border-color 0.15s ease, color 0.15s ease"
          _hover={{ bg: "ink.100", color: "ink.800", borderColor: "ink.300" }}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "brand.500",
            outlineOffset: "2px",
          }}>
          <Search size={17} />
          <Text fontSize="sm" display={{ base: "none", md: "block" }}>
            Buscar…
          </Text>
          <chakra.kbd
            display={{ base: "none", lg: "block" }}
            ml="2"
            px="1.5"
            py="0.5"
            borderRadius="sm"
            bg="white"
            borderWidth="1px"
            borderColor="ink.200"
            fontFamily="mono"
            fontSize="xs"
            color="ink.500">
            /
          </chakra.kbd>
        </chakra.button>

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

      {buscadorAbierto && (
        <BuscadorGlobal
          abierto={buscadorAbierto}
          onCerrar={() => setBuscadorAbierto(false)}
        />
      )}
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