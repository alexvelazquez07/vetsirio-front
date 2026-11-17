import { Box, Flex, Text } from "@chakra-ui/react";
import {
  Building2,
  ChevronDown,
  CreditCard,
  KeyRound,
  LogOut,
  Settings,
  Stethoscope,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Avatar } from "@/components/ui/avatar";
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { useAuth } from "@/features/auth/auth.store";
import { useSalida } from "@/features/auth/salida.store";

/**
 * Menú de usuario, en el extremo derecho de la barra superior.
 *
 * Reúne la identidad de quien está usando el sistema y la forma de salir. Antes
 * había un bloque de usuario en el pie del sidebar que cerraba la sesión en el
 * primer clic, sin menú ni confirmación: un botón que destruye la sesión de
 * golpe es un accidente esperando, y en tablet ese bloque era además un
 * cuadrado de 32 px sin etiqueta.
 *
 * Está en la barra superior y no en el sidebar por dos razones concretas: es la
 * posición donde la gente busca su propia cuenta sin pensarlo, y es la única
 * que sigue visible en móvil, donde el sidebar vive oculto tras un drawer.
 *
 * No se incluye "Mi perfil" porque esa pantalla todavía no existe y un enlace a
 * una ruta inexistente es peor que la ausencia del enlace.
 *
 * Nota sobre `onClick` en vez de `onSelect`: Ark UI emite la selección sobre el
 * ítem *destacado*, no sobre el que se hizo clic, así que `onSelect` depende de
 * que un estado interno ya se haya sincronizado. Para dos acciones que son
 * "navegar a" y "salir", `onClick` es determinista y no cambia nada observable:
 * el menú igual se cierra, porque lo cierra la máquina, no el handler.
 */
export function MenuUsuario() {
  const { usuario, veterinaria, puede } = useAuth();
  const { solicitar } = useSalida();

  const navegar = useNavigate();

  if (!usuario) return null;

  const nombre = `${usuario.nombre} ${usuario.apellido}`.trim();
  const abreAConfiguracion = puede("configuracion.ver");
  const abreAMiPlan = puede("suscripcion.ver");

  return (
    <MenuRoot positioning={{ placement: "bottom-end" }}>
      <MenuTrigger
        asChild
        aria-label={`Menú de ${nombre}`}
        borderRadius="lg"
        px={{ base: "1.5", sm: "2.5" }}
        py="1.5"
        borderWidth="1px"
        borderColor="transparent"
        _hover={{ bg: "ink.100", borderColor: "ink.200" }}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "brand.500",
          outlineOffset: "2px",
        }}
      >
        <button type="button">
          <Flex align="center" gap="2.5">
            <AvatarUsuario nombre={nombre} fotoUrl={usuario.fotoUrl} />

            {/* El nombre sólo aparece cuando hay lugar. En móvil queda el
                avatar, que igual tiene su aria-label en el disparador. */}
            <Box display={{ base: "none", lg: "block" }} textAlign="left" minW={0}>
              <Text
                fontSize="sm"
                fontWeight="semibold"
                color="ink.900"
                lineHeight="1.2"
                maxW="10rem"
                truncate
              >
                {nombre}
              </Text>
              <Text
                fontSize="xs"
                color="ink.500"
                lineHeight="1.3"
                maxW="10rem"
                truncate
                style={{ textTransform: "capitalize" }}
              >
                {veterinaria?.nombreComercial ?? usuario.rol.nombre}
              </Text>
            </Box>

            <ChevronDown size={14} color="var(--chakra-colors-ink-400)" aria-hidden="true" />
          </Flex>
        </button>
      </MenuTrigger>

      <MenuContent
        bg="white"
        borderColor="ink.200"
        boxShadow="xl"
        p="0"
        minW="19rem"
        overflow="hidden"
        style={{ zIndex: "popover" }}
      >
        {/* ── Identidad ─────────────────────────────────────────────── */}
        <Box
          px="4"
          py="3.5"
          backgroundGradient="to-br"
          gradientFrom="brand.subtle"
          gradientTo="white"
          borderBottomWidth="1px"
          borderColor="ink.200"
        >
          <Text
            fontSize="2xs"
            fontWeight="bold"
            letterSpacing="wider"
            textTransform="uppercase"
            color="brand.fg"
          >
            Sesión iniciada
          </Text>

          <Text mt="1" fontSize="md" fontWeight="bold" color="ink.900" truncate>
            {nombre}
          </Text>
          <Text fontSize="xs" color="ink.600" truncate>
            {usuario.email}
          </Text>

          <Flex mt="2.5" gap="1.5" flexWrap="wrap">
            <EtiquetaRol nombre={usuario.rol.nombre} />

            {veterinaria?.nombreComercial && (
              <EtiquetaContexto
                icono={Building2}
                texto={veterinaria.nombreComercial}
              />
            )}
          </Flex>
        </Box>

        {/* ── Acciones ──────────────────────────────────────────────── */}
        <Box p="1.5">
          {abreAMiPlan && (
            <MenuItem
              value="mi-plan"
              borderRadius="md"
              py="2"
              fontSize="sm"
              color="ink.700"
              onClick={() => navegar("/suscripcion")}
            >
              <Flex align="center" gap="2.5">
                <CreditCard size={15} aria-hidden="true" />
                Mi plan
              </Flex>
            </MenuItem>
          )}

          <MenuItem
            value="cambiar-password"
            borderRadius="md"
            py="2"
            fontSize="sm"
            color="ink.700"
            onClick={() => navegar("/cambiar-password")}
          >
            <Flex align="center" gap="2.5">
              <KeyRound size={15} aria-hidden="true" />
              Cambiar contraseña
            </Flex>
          </MenuItem>

          <MenuItem
            value="configuracion"
            borderRadius="md"
            py="2"
            fontSize="sm"
            color="ink.700"
            disabled={!abreAConfiguracion}
            onClick={() => {
              if (!abreAConfiguracion) return;
              navegar("/configuracion");
            }}
          >
            <Flex align="center" gap="2.5">
              <Settings size={15} aria-hidden="true" />
              Configuración
            </Flex>
          </MenuItem>
        </Box>

        <MenuSeparator borderColor="ink.200" />

        {/* ── Salida ────────────────────────────────────────────────── */}
        <Box p="1.5">
          <MenuItem
            value="cerrar-sesion"
            borderRadius="md"
            py="2"
            fontSize="sm"
            fontWeight="medium"
            color="danger.700"
            bg="danger.50"
            _hover={{ bg: "danger.100" }}
            onClick={solicitar}
          >
            <Flex align="center" gap="2.5">
              <LogOut size={15} aria-hidden="true" />
              Cerrar sesión
            </Flex>
          </MenuItem>
        </Box>
      </MenuContent>
    </MenuRoot>
  );
}

/**
 * Avatar con respaldo a iniciales.
 *
 * El color no es aleatorio: se deriva del nombre para que la misma persona
 * tenga siempre el mismo color. Se usa el hash del nombre en lugar de un
 * contador porque cualquier lista ordenada cambiaría los colores entre
 * despliegues, y el usuario asocia su color con su foto.
 *
 * Se delega en la primitiva <Avatar> del proyecto en lugar de armar el `img` a
 * mano: esa primitiva ya resuelve el respaldo a iniciales y el error cuando la
 * URL de la foto está rota, que es el caso habitual con archivos subidos.
 */
function AvatarUsuario({
  nombre,
  fotoUrl,
  size = "sm",
}: {
  nombre: string;
  fotoUrl: string | null;
  size?: "sm" | "md";
}) {
  return (
    <Avatar
      size={size}
      name={nombre}
      src={fotoUrl ?? undefined}
      bg={colorDeAvatar(nombre)}
      color="white"
      fontWeight="bold"
      flexShrink={0}
    />
  );
}

/** Etiqueta del rol. El texto va capitalizado porque el rol llega en minúsculas. */
function EtiquetaRol({ nombre }: { nombre: string }) {
  return (
    <Flex
      as="span"
      display="inline-flex"
      align="center"
      gap="1"
      px="1.5"
      py="0.5"
      borderRadius="sm"
      bg="brand.muted"
      color="brand.fg"
      fontSize="2xs"
      fontWeight="semibold"
      textTransform="capitalize"
      maxW="full"
    >
      <Stethoscope size={11} aria-hidden="true" />
      <Text as="span" truncate>
        {nombre}
      </Text>
    </Flex>
  );
}

/** Contexto de la cuenta: la veterinaria a la que pertenece la sesión. */
function EtiquetaContexto({
  icono: Icono,
  texto,
}: {
  icono: typeof Building2;
  texto: string;
}) {
  return (
    <Flex
      as="span"
      display="inline-flex"
      align="center"
      gap="1"
      px="1.5"
      py="0.5"
      borderRadius="sm"
      bg="ink.100"
      color="ink.700"
      fontSize="2xs"
      fontWeight="medium"
      maxW="full"
    >
      <Icono size={11} aria-hidden="true" />
      <Text as="span" truncate>
        {texto}
      </Text>
    </Flex>
  );
}

/** Paleta de colores para los avatares sin foto. */
const COLORES_AVATAR = [
  "brand.600",
  "purple.600",
  "blue.600",
  "cyan.600",
  "teal.600",
  "green.600",
  "orange.600",
  "pink.600",
];

/**
 * Elige un color estable a partir del nombre.
 *
 * Un hash djb2: es corto, sin dependencias y reparte bien para nombres cortos
 * como "Ana" o "Luis", que con un hash de suma se amontonarían en el mismo
 * índice.
 */
function colorDeAvatar(nombre: string): string {
  let hash = 5381;

  for (let i = 0; i < nombre.length; i += 1) {
    hash = ((hash << 5) + hash + nombre.charCodeAt(i)) >>> 0;
  }

  return COLORES_AVATAR[hash % COLORES_AVATAR.length];
}