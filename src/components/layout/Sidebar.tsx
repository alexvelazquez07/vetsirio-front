import { Accordion, Box, chakra, Flex, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { ChevronDown, X as XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import isotipo from "@/assets/img/03_isotipo_V_oscuro.png";
import { DrawerRoot, DrawerBackdrop, DrawerBody, DrawerContent } from "@/components/ui/drawer";
import { useAuth } from "@/features/auth/auth.store";
import { MENU, type GrupoMenu } from "@/routes/menu";
import { urlDeArchivo } from "@/services/api";

/**
 * Barra lateral de navegación.
 *
 *  · Escritorio (≥ lg): columna fija, plegable a un riel de íconos.
 *  · Tablet: la misma columna, plegada de entrada.
 *  · Móvil: drawer con overlay.
 *
 * Acordeón de un solo grupo abierto: al abrir otro grupo, el anterior se cierra.
 * Al cambiar de pantalla (incluso desde un enlace externo) se abre el grupo que
 * la contiene y se cierra el resto. La persona puede cerrar el grupo activo
 * porque la sincronización sólo corre cuando cambia la ruta, no en cada render.
 *
 * En el riel plegado se muestra un ícono por grupo, no uno por módulo: al pasar
 * el mouse (o al enfocar con el teclado) se abre un panel flotante con el nombre
 * del grupo y sus módulos. Así el riel deja de ser una fila de íconos anónimos
 * y cada uno se explica solo, sin perder el ancho que recupera la tabla.
 *
 * Movimiento: sólo responde a acciones de la persona (abrir un grupo, pasar el
 * mouse). Los ítems entran escalonados al desplegar un grupo y todo se apaga
 * con `prefers-reduced-motion`.
 */

const ANCHO_EXPANDIDO = "16rem";
const ANCHO_RIEL = "4.25rem";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Entrada de cada ítem al desplegar el grupo. */
const entradaItem = keyframes`
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
`;

/** Entrada del panel flotante del riel plegado. */
const entradaFlyout = keyframes`
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const FOCO = {
  outline: "2px solid",
  outlineColor: "brand.400",
  outlineOffset: "-2px",
} as const;

interface SidebarProps {
  colapsada: boolean;
  onNavegar?: () => void;
  /** El drawer móvil ya dibuja su propia cabecera con la marca. */
  mostrarMarca?: boolean;
}

export function Sidebar({ colapsada, onNavegar, mostrarMarca = true }: SidebarProps) {
  const { usuario, puede } = useAuth();
  const ubicacion = useLocation();

  /** Un solo grupo abierto a la vez (array por contrato de Accordion). */
  const [grupoAbierto, setGrupoAbierto] = useState<string[]>([]);

  const activo = useCallback(
    (ruta: string) =>
      ruta === "/" ? ubicacion.pathname === "/" : ubicacion.pathname.startsWith(ruta),
    [ubicacion.pathname],
  );

  /** Filtra por permisos: un módulo sin permiso no aparece en absoluto. */
  const grupos = useMemo(
    () =>
      MENU.map((grupo) => ({
        ...grupo,
        items: grupo.items.filter((item) => {
          if (item.permiso === "__superadmin__") {
            return usuario?.rol.nombre === "superadmin";
          }
          return !item.permiso || puede(item.permiso);
        }),
      })).filter((grupo) => grupo.items.length > 0),
    [puede, usuario],
  );

  const grupoActivo = useMemo(
    () => grupos.find((grupo) => grupo.items.some((item) => activo(item.ruta)))?.id,
    [grupos, activo],
  );

  /** Al cambiar de pantalla: abre su grupo y cierra los demás. */
  useEffect(() => {
    if (grupoActivo) setGrupoAbierto([grupoActivo]);
  }, [grupoActivo]);

  return (
    <Flex
      direction="column"
      h="100%"
      bg="ink.950"
      color="ink.100"
      borderRightWidth="1px"
      borderColor="whiteAlpha.100"
      overflow="hidden"
    >
      {/* ── Marca ─────────────────────────────────────────────────────── */}
      {mostrarMarca && (
        <Flex
          align="center"
          px={colapsada ? "3" : "4"}
          h="16"
          flexShrink={0}
          borderBottomWidth="1px"
          borderColor="whiteAlpha.100"
          justify={colapsada ? "center" : "flex-start"}
        >
          <MarcaVetSirio colapsada={colapsada} />
        </Flex>
      )}

      {/* ── Navegación ────────────────────────────────────────────────── */}
      <Box
        flex="1"
        overflowY="auto"
        overflowX="hidden"
        py="3"
        css={{
          scrollbarWidth: "thin",
          scrollbarColor: "var(--chakra-colors-whiteAlpha-200) transparent",
        }}
      >
        {colapsada ? (
          <GruposEnRiel grupos={grupos} activo={activo} onNavegar={onNavegar} />
        ) : (
          <Accordion.Root
            collapsible
            lazyMount
            unmountOnExit
            variant="plain"
            value={grupoAbierto}
            onValueChange={({ value }) => setGrupoAbierto(value)}
          >
            {grupos.map((grupo) => (
              <GrupoNavegacion
                key={grupo.id}
                grupo={grupo}
                activo={activo}
                abierto={grupoAbierto.includes(grupo.id)}
                onNavegar={onNavegar}
              />
            ))}
          </Accordion.Root>
        )}
      </Box>

      {/*
        El avatar y el cierre de sesión no viven acá: están en la barra
        superior, junto a las notificaciones, y se ven en móvil aunque el menú
        lateral esté oculto tras el drawer.
      */}
    </Flex>
  );
}

/** Isotipo de VetSirio, siempre visible. El nombre de la veterinaria va como subtítulo. */
function MarcaVetSirio({ colapsada = false }: { colapsada?: boolean }) {  
  const { veterinaria } = useAuth();

  return (
    <Flex
      align="center"
      gap="3"
      minW={0}
      w="full"
      justify={colapsada ? "center" : "flex-start"}
    >
      <chakra.img
        src={isotipo}
        alt="VetSirio"
        w="10"
        h="auto"
        flexShrink={0}
        draggable={false}
        userSelect="none"
      />

      {!colapsada && (
        <Box minW={0} flex="1">
          <Text fontWeight="bold" fontSize="md" lineHeight="1.2" truncate color="white">
            VetSirio
          </Text>
          <Text fontSize="xs" color="ink.400" truncate>
            Tu sistema de gestión
          </Text>
        </Box>
      )}
    </Flex>
  );
}

/** Riel plegado: un ícono por grupo, con su panel de módulos. */
function GruposEnRiel({
  grupos,
  activo,
  onNavegar,
}: {
  grupos: GrupoMenu[];
  activo: (ruta: string) => boolean;
  onNavegar?: () => void;
}) {
  return (
    <Flex direction="column" align="center" gap="1.5" px="2.5">
      {grupos.map((grupo) => (
        <GrupoEnRiel key={grupo.id} grupo={grupo} activo={activo} onNavegar={onNavegar} />
      ))}
    </Flex>
  );
}

/**
 * Un grupo del riel.
 *
 * El panel se posiciona con `position: fixed` calculado desde el botón: el
 * contenedor del riel tiene `overflow`, así que un `absolute` quedaría
 * recortado justo donde tiene que asomar el panel. Al seguir siendo hijo del
 * mismo bloque, el orden de tabulación queda botón → módulos → grupo
 * siguiente, sin necesidad de un portal.
 */
function GrupoEnRiel({
  grupo,
  activo,
  onNavegar,
}: {
  grupo: GrupoMenu;
  activo: (ruta: string) => boolean;
  onNavegar?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null);

  const botonRef = useRef<HTMLButtonElement>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const primerEnlaceRef = useRef<HTMLAnchorElement>(null);
  const temporizador = useRef<number | null>(null);

  const contieneActivo = grupo.items.some((item) => activo(item.ruta));
  const IconoGrupo = grupo.icono;
  const idPanel = `riel-panel-${grupo.id}`;

  const cancelar = useCallback(() => {
    if (temporizador.current !== null) {
      window.clearTimeout(temporizador.current);
      temporizador.current = null;
    }
  }, []);

  useEffect(() => cancelar, [cancelar]);

  /** Calcula dónde asomar el panel y lo abre. */
  const mostrar = useCallback(() => {
    const boton = botonRef.current;
    if (!boton) return;

    const rect = boton.getBoundingClientRect();
    // Alto aproximado (cabecera + un renglón por módulo): alcanza para que el
    // panel no se salga por abajo en ventanas bajas. El mínimo de 76px lo deja
    // debajo de la barra superior, que es sticky y mide 64px.
    const alto = 52 + grupo.items.length * 40;
    const top = Math.min(
      Math.max(76, rect.top),
      Math.max(76, window.innerHeight - alto - 12),
    );

    setPosicion({ top, left: rect.right + 8 });
    setAbierto(true);
  }, [grupo.items.length]);

  const abrir = useCallback(
    (demora = 70) => {
      cancelar();
      temporizador.current = window.setTimeout(mostrar, demora);
    },
    [cancelar, mostrar],
  );

  const mantenerAbierto = useCallback(() => {
    cancelar();
    setAbierto(true);
  }, [cancelar]);

  const cerrar = useCallback(
    (demora = 140) => {
      // Si el foco está dentro del panel, cerrarlo dejaría a la persona sin
      // dónde estar: el teclado sigue navegando aunque el mouse se haya ido.
      const focoAdentro =
        contenedorRef.current?.contains(document.activeElement) &&
        document.activeElement !== botonRef.current;

      if (focoAdentro) return;

      cancelar();
      temporizador.current = window.setTimeout(() => {
        setAbierto(false);
        setPosicion(null);
      }, demora);
    },
    [cancelar],
  );

  /**
   * Abre el panel. `enfocar` sólo es verdadero cuando la acción vino del
   * teclado: con el mouse, mover el foco al primer módulo sorprendería y
   * rompería el hover.
   */
  const abrirPanel = useCallback(
    (enfocar: boolean) => {
      cancelar();
      mostrar();
      if (enfocar) {
        window.requestAnimationFrame(() => primerEnlaceRef.current?.focus());
      }
    },
    [cancelar, mostrar],
  );

  // El riel se puede desplazar o la ventana cambiar de tamaño: el panel está
  // anclado a coordenadas de pantalla, así que se cierra en vez de quedar
  // flotando lejos de su ícono.
  useEffect(() => {
    if (!abierto) return;

    const alMover = () => {
      setAbierto(false);
      setPosicion(null);
    };

    window.addEventListener("scroll", alMover, true);
    window.addEventListener("resize", alMover);

    return () => {
      window.removeEventListener("scroll", alMover, true);
      window.removeEventListener("resize", alMover);
    };
  }, [abierto]);

  return (
    <Box
      ref={contenedorRef}
      position="relative"
      w="full"
      onPointerEnter={() => abrir()}
      onPointerLeave={() => cerrar()}
      onFocusCapture={() => {
        cancelar();
        if (!abierto) mostrar();
      }}
      onBlurCapture={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) {
          cerrar(0);
        }
      }}
      onKeyDown={(evento) => {
        if (evento.key === "Escape" && abierto) {
          evento.stopPropagation();
          setAbierto(false);
          setPosicion(null);
          botonRef.current?.focus();
        }
      }}>
      <chakra.button
        ref={botonRef}
        type="button"
        onClick={(evento) => abrirPanel(evento.detail === 0)}
        onKeyDown={(evento) => {
          if (evento.key === "ArrowRight" || evento.key === "ArrowDown") {
            evento.preventDefault();
            abrirPanel(true);
          }
        }}
        aria-label={grupo.etiqueta}
        aria-expanded={abierto}
        aria-controls={idPanel}
        title={grupo.etiqueta}
        display="flex"
        alignItems="center"
        justifyContent="center"
        w="full"
        h="10"
        borderRadius="lg"
        cursor="pointer"
        bg={contieneActivo ? "brand.500" : abierto ? "whiteAlpha.100" : "transparent"}
        color={contieneActivo ? "white" : abierto ? "white" : "ink.400"}
        boxShadow={
          contieneActivo
            ? "0 4px 12px color-mix(in srgb, var(--chakra-colors-brand-500) 35%, transparent)"
            : "none"
        }
        transition={`background 0.2s ${EASE}, color 0.2s ${EASE}, transform 0.2s ${EASE}`}
        _hover={{
          bg: contieneActivo ? "brand.600" : "whiteAlpha.100",
          color: "white",
          transform: "scale(1.06)",
        }}
        _active={{ transform: "scale(0.96)" }}
        _focusVisible={FOCO}
        _motionReduce={{ transition: "none", transform: "none" }}>
        <IconoGrupo size={19} strokeWidth={contieneActivo ? 2.4 : 1.9} />
      </chakra.button>

      {abierto && posicion && (
        <Box
          position="fixed"
          top={`${posicion.top}px`}
          left={`${posicion.left}px`}
          zIndex="popover"
          animation={`${entradaFlyout} 0.16s ${EASE} both`}
          _motionReduce={{ animation: "none" }}
          onPointerEnter={mantenerAbierto}
          onPointerLeave={() => cerrar()}>
          <Box
            id={idPanel}
            role="group"
            aria-label={grupo.etiqueta}
            bg="ink.900"
            color="ink.100"
            borderWidth="1px"
            borderColor="whiteAlpha.200"
            borderRadius="xl"
            boxShadow="xl"
            minW="13.5rem"
            maxW="16rem"
            py="2"
            overflow="hidden">
            <Flex
              align="center"
              gap="2"
              px="3"
              pb="1.5"
              mb="1"
              borderBottomWidth="1px"
              borderColor="whiteAlpha.100">
              <Box color="brand.300" display="flex" flexShrink={0}>
                <IconoGrupo size={13} strokeWidth={2.2} />
              </Box>
              <Text
                fontSize="10px"
                fontWeight="bold"
                letterSpacing="0.08em"
                textTransform="uppercase"
                color="ink.400"
                truncate>
                {grupo.etiqueta}
              </Text>
            </Flex>

            <Flex direction="column" gap="0.5" px="1.5">
              {grupo.items.map((item, indice) => {
                const estaActivo = activo(item.ruta);
                const Icono = item.icono;

                return (
                  <Flex
                    key={item.ruta}
                    asChild
                    position="relative"
                    align="center"
                    gap="2.5"
                    px="2.5"
                    py="2"
                    borderRadius="md"
                    fontSize="sm"
                    fontWeight={estaActivo ? "semibold" : "medium"}
                    color={estaActivo ? "white" : "ink.200"}
                    bg={estaActivo ? "whiteAlpha.200" : "transparent"}
                    transition="background 0.15s ease, color 0.15s ease"
                    _hover={{ bg: "whiteAlpha.100", color: "white" }}
                    _focusVisible={FOCO}>
                    <NavLink
                      ref={indice === 0 ? primerEnlaceRef : undefined}
                      to={item.ruta}
                      onClick={() => {
                        setAbierto(false);
                        setPosicion(null);
                        onNavegar?.();
                      }}
                      aria-current={estaActivo ? "page" : undefined}>
                      {/* Barra de acento: ubica la pantalla actual dentro del
                          grupo sin llenar el ítem de color. */}
                      <Box
                        position="absolute"
                        left="0"
                        top="50%"
                        transform="translateY(-50%)"
                        w="2px"
                        h="4"
                        borderRadius="full"
                        bg="brand.400"
                        opacity={estaActivo ? 1 : 0}
                        aria-hidden="true"
                      />
                      <Icono size={16} strokeWidth={estaActivo ? 2.4 : 2} />
                      <Text truncate>{item.etiqueta}</Text>
                    </NavLink>
                  </Flex>
                );
              })}
            </Flex>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function GrupoNavegacion({
  grupo,
  activo,
  abierto,
  onNavegar,
}: {
  grupo: GrupoMenu;
  activo: (ruta: string) => boolean;
  abierto: boolean;
  onNavegar?: () => void;
}) {
  const { id, etiqueta, icono: IconoGrupo, items } = grupo;
  const contieneActivo = items.some((item) => activo(item.ruta));
  const resaltado = abierto || contieneActivo;

  return (
    <Accordion.Item value={id} px="3" mb="1">
      <Accordion.ItemTrigger
        className="group"
        py="2"
        px="2"
        gap="2.5"
        borderRadius="lg"
        cursor="pointer"
        color={resaltado ? "white" : "ink.300"}
        fontSize="sm"
        fontWeight="semibold"
        bg={abierto ? "whiteAlpha.50" : "transparent"}
        transition={`background 0.2s ${EASE}, color 0.2s ${EASE}`}
        _hover={{ bg: "whiteAlpha.100", color: "white" }}
        _focusVisible={FOCO}
        _motionReduce={{ transition: "none" }}
      >
        {/* Ícono del grupo en una pastilla: se tiñe con el color de marca
            cuando el grupo está abierto o guarda la pantalla actual. */}
        <Flex
          align="center"
          justify="center"
          w="7"
          h="7"
          flexShrink={0}
          borderRadius="md"
          bg={
            resaltado
              ? "color-mix(in srgb, var(--chakra-colors-brand-500) 28%, transparent)"
              : "whiteAlpha.100"
          }
          color={resaltado ? "brand.300" : "ink.400"}
          transition={`background 0.2s ${EASE}, color 0.2s ${EASE}`}
          _groupHover={{ color: "brand.300" }}
          _motionReduce={{ transition: "none" }}
        >
          <IconoGrupo size={15} strokeWidth={2.2} />
        </Flex>

        <Text flex="1" minW={0} truncate textAlign="start">
          {etiqueta}
        </Text>

        {/* Grupo cerrado que guarda la pantalla actual: un punto evita que
            parezca que se perdió la navegación. */}
        {contieneActivo && !abierto && (
          <Box w="1.5" h="1.5" borderRadius="full" bg="brand.400" flexShrink={0} />
        )}

        <Accordion.ItemIndicator
          color="ink.500"
          display="flex"
          transition={`transform 0.25s ${EASE}`}
          _motionReduce={{ transition: "none" }}
        >
          <ChevronDown size={14} />
        </Accordion.ItemIndicator>
      </Accordion.ItemTrigger>

      <Accordion.ItemContent>
        <Flex direction="column" gap="0.5" pt="1" pb="2" pl="5" position="relative">
          {/* Guía vertical: los ítems se leen como hijos del grupo. */}
          <Box
            position="absolute"
            left="4"
            top="1"
            bottom="2"
            w="1px"
            bg="whiteAlpha.100"
            aria-hidden="true"
          />

          {items.map((item, indice) => {
            const estaActivo = activo(item.ruta);
            const Icono = item.icono;

            return (
              <Flex
                key={item.ruta}
                asChild
                className="group"
                position="relative"
                align="center"
                gap="2.5"
                px="3"
                py="2"
                borderRadius="lg"
                fontSize="sm"
                fontWeight={estaActivo ? "semibold" : "medium"}
                color={estaActivo ? "white" : "ink.300"}
                bg={
                  estaActivo
                    ? "linear-gradient(90deg, color-mix(in srgb, var(--chakra-colors-brand-500) 30%, transparent), transparent)"
                    : "transparent"
                }
                transition={`background 0.2s ${EASE}, color 0.2s ${EASE}`}
                animation={`${entradaItem} 0.28s ${EASE} ${indice * 30}ms both`}
                _hover={{
                  bg: estaActivo ? undefined : "whiteAlpha.100",
                  color: "white",
                }}
                _focusVisible={FOCO}
                _motionReduce={{ animation: "none", transition: "none" }}
              >
                <NavLink
                  to={item.ruta}
                  onClick={onNavegar}
                  aria-current={estaActivo ? "page" : undefined}
                >
                  {/* Barra de acento: crece desde el centro al activarse. */}
                  <Box
                    position="absolute"
                    left="0"
                    top="50%"
                    w="3px"
                    h="5"
                    borderRadius="full"
                    bg="brand.400"
                    transformOrigin="center"
                    transform={`translateY(-50%) scaleY(${estaActivo ? 1 : 0})`}
                    opacity={estaActivo ? 1 : 0}
                    transition={`transform 0.3s ${EASE}, opacity 0.2s ease`}
                    aria-hidden="true"
                    _motionReduce={{ transition: "none" }}
                  />

                  <Box
                    display="flex"
                    color={estaActivo ? "brand.300" : "inherit"}
                    transition={`transform 0.2s ${EASE}, color 0.2s ${EASE}`}
                    _groupHover={{ transform: "translateX(2px)" }}
                    _motionReduce={{ transition: "none", transform: "none" }}
                  >
                    <Icono size={17} strokeWidth={estaActivo ? 2.4 : 1.9} />
                  </Box>
                  <Text truncate>{item.etiqueta}</Text>
                </NavLink>
              </Flex>
            );
          })}
        </Flex>
      </Accordion.ItemContent>
    </Accordion.Item>
  );
}

// ============================================================================
//  Contenedores por tamaño de pantalla
// ============================================================================

/**
 * Columna fija para escritorio. En tablet arranca plegada.
 *
 * El control para plegarla no vive acá: está en la barra superior, junto al
 * resto de las utilidades. Flotando sobre el borde quedaba medio dentro del
 * sidebar oscuro y medio sobre el contenido claro, así que se leía cortado.
 */
export function SidebarDesktop({ colapsada }: { colapsada: boolean }) {
  return (
    <Box
      as="nav"
      id="navegacion-lateral"
      aria-label="Navegación principal"
      display={{ base: "none", lg: "block" }}
      w={colapsada ? ANCHO_RIEL : ANCHO_EXPANDIDO}
      flexShrink={0}
      transition={`width 0.25s ${EASE}`}
      position="sticky"
      top="0"
      h="100dvh"
      zIndex="docked"
      _motionReduce={{ transition: "none" }}
    >
      <Sidebar colapsada={colapsada} />
    </Box>
  );
}

/** Drawer de navegación para móvil. */
export function SidebarMovil({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  return (
    <DrawerRoot
      open={abierto}
      onOpenChange={(detalle) => {
        if (!detalle.open) onCerrar();
      }}
      placement="start"
      size="xs"
    >
      <DrawerBackdrop />
      {/*
        El id conecta con el `aria-controls` del botón hamburguesa. Sin él, el
        atributo apunta a algo que no existe y un lector de pantalla no puede
        anunciar qué es lo que ese botón abre.
      */}
      <DrawerContent id="menu-lateral" bg="ink.950" maxW="17rem">
        <DrawerBody p="0">
          <Flex direction="column" h="100dvh">
            <Flex
              align="center"
              justify="space-between"
              gap="2"
              px="4"
              h="16"
              flexShrink={0}
              borderBottomWidth="1px"
              borderColor="whiteAlpha.100"
            >
              <Box minW={0} flex="1">
                <MarcaVetSirio />
              </Box>

              <chakra.button
                type="button"
                onClick={onCerrar}
                p="2"
                flexShrink={0}
                borderRadius="md"
                color="ink.300"
                cursor="pointer"
                transition="background 0.15s ease, color 0.15s ease"
                _hover={{ bg: "whiteAlpha.100", color: "white" }}
                _focusVisible={FOCO}
                aria-label="Cerrar menú"
              >
                <XIcon size={20} />
              </chakra.button>
            </Flex>

            <Box flex="1" overflow="hidden">
              <Sidebar colapsada={false} onNavegar={onCerrar} mostrarMarca={false} />
            </Box>
          </Flex>
        </DrawerBody>
      </DrawerContent>
    </DrawerRoot>
  );
}