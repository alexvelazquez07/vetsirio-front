import { Box, Flex } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { ProveedorSalida } from "@/features/auth/salida.store";
import { BannerTrial } from "@/features/subscription/BannerTrial";
import { SidebarDesktop, SidebarMovil } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * Estructura de la aplicación una vez autenticado.
 *
 * El estado del pliegue se guarda en localStorage porque es una preferencia
 * del usuario, no del sistema: nadie quiere retomar el trabajo con el sidebar
 * plegado cada vez que recarga.
 *
 * En tablet el sidebar arranca plegado porque 768px no alcanza para menú
 * desplegado más una tabla de clientes. En escritorio arranca desplegado.
 *
 * <ProveedorSalida> envuelve todo porque la salida de sesión tiene que estar
 * disponible desde la barra superior y desde el sidebar a la vez, y ser una sola
 * operación con una sola animación. Al navegar a `/login` este proveedor se
 * desmonta y con él se va la capa de cierre.
 */
export function AppShell() {
  return (
    <ProveedorSalida>
      <Estructura />
    </ProveedorSalida>
  );
}

function Estructura() {
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const ubicacion = useLocation();

  const [colapsada, setColapsada] = useState(() => {
    if (typeof window === "undefined") return false;

    const guardado = window.localStorage.getItem("vetsirio:sidebar-colapsada");

    if (guardado !== null) return guardado === "true";

    // Primer arranque sin preferencia guardada: plegado en tablet, expandido
    // en escritorio. Se decide por el ancho en vez de por el dispositivo para
    // que redimensionar la ventana no deje el estado incoherente.
    return window.innerWidth < 1200;
  });

  useEffect(() => {
    window.localStorage.setItem("vetsirio:sidebar-colapsada", String(colapsada));
  }, [colapsada]);

  // Cerrar el drawer al navegar es lo que la gente espera en móvil: si queda
  // abierto, el contenido nuevo queda detrás de un panel oscuro.
  useEffect(() => {
    setMenuMovilAbierto(false);
  }, [ubicacion.pathname]);

  return (
    <Flex minH="100dvh" bg="ink.50">
      <SidebarDesktop colapsada={colapsada} />

      <SidebarMovil abierto={menuMovilAbierto} onCerrar={() => setMenuMovilAbierto(false)} />

      <Flex direction="column" flex="1" minW={0} position="relative">
        <TopBar
          onAbrirMenu={() => setMenuMovilAbierto(true)}
          menuAbierto={menuMovilAbierto}
          colapsada={colapsada}
          onToggleColapsar={() => setColapsada((previo) => !previo)}
        />

        <BannerTrial />

        <Box
          as="main"
          flex="1"
          px={{ base: "4", md: "6", xl: "8" }}
          py={{ base: "5", md: "6" }}
          maxW="100%"
        >
          <Outlet />
        </Box>
      </Flex>
    </Flex>
  );
}