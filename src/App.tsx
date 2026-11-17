import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/toaster";
import { ProveedorAuth } from "@/features/auth/auth.store";
import { CambiarPasswordPage } from "@/features/auth/CambiarPasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RecuperarPasswordPage } from "@/features/auth/RecuperarPasswordPage";
import { RegistroPage } from "@/features/auth/RegistroPage";
import { RestablecerPasswordPage } from "@/features/auth/RestablecerPasswordPage";
import { AdminPage } from "@/features/admin/AdminPage";
import { CajaPage } from "@/features/caja/CajaPage";
import { EgresosPage } from "@/features/caja/EgresosPage";
import { ClientesPage } from "@/features/clients/ClientesPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { FacturacionPage } from "@/features/facturacion/FacturacionPage";
import { ConfiguracionPage } from "@/features/settings/ConfiguracionPage";
import { ProveedoresPage } from "@/features/suppliers/ProveedoresPage";
import { PacientesPage } from "@/features/patients/PacientesPage";
import { PersonalPage } from "@/features/personal/PersonalPage";
import { AgendaPage } from "@/features/agenda/AgendaPage";
import { GroomingPage } from "@/features/grooming/GroomingPage";
import { CargaInicialStockPage } from "@/features/products/CargaInicialStockPage";
import { ProductoPage } from "@/features/products/ProductoPage";
import { ComprasPage } from "@/features/purchases/ComprasPage";
import { VentasPage } from "@/features/ventas/VentasPage";
import { TratamientosPage } from "@/features/tratamientos/TratamientosPage";
import { ServiciosPage } from "@/features/servicios/ServiciosPage";
import { ConsultasPage } from "@/features/consultations/ConsultasPage";
import { SuscripcionPage } from "@/features/subscription/SuscripcionPage";
import { VacunacionesPage } from "@/features/vaccinations/VacunacionesPage";
import {
  NoEncontrado,
  RutaConPermiso,
  RutaPrivada,
  SoloVisitantes,
} from "@/routes/AppRoutes";
import { system } from "@/theme/system";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Los datos de una veterinaria cambian poco y el usuario no tolera
      // esperar: una ventana corta con revalidaciÃ³n al recuperar el foco.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (fallo, error) => {
        // Reintentar un 401/403 sÃ³lo retrasa el error: el servidor ya decidiÃ³.
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return fallo < 2;
      },
    },
    mutations: { retry: false },
  },
});

/**
 * Prefijo de la URL donde se sirve el build.
 *
 * Vite lo expone en BASE_URL: "/vetsirio/" en producción (ver `base` en
 * vite.config.ts) y "/" en desarrollo. React Router necesita la forma sin barra
 * final, o `undefined` cuando la app vive en la raíz.
 */
const BASENAME = import.meta.env.BASE_URL.replace(/\/+$/, "") || undefined;

export default function App() {
  return (
    <ChakraProvider value={system}>
      <QueryClientProvider client={queryClient}>
        {/*
          El orden de los providers importa y no es arbitrario:
          BrowserRouter va ANTES de ProveedorAuth porque el store de sesiÃ³n
          usa useNavigate para mandar al login y a la ruta que el usuario
          intentaba visitar. Con el Router afuera, useNavigate revienta con
          "may be used only in the context of a <Router> component".
        */}
        <BrowserRouter basename={BASENAME}>
          <ProveedorAuth>
            <Routes>
              {/* â”€â”€ PÃºblico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <Route element={<SoloVisitantes />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/registro" element={<RegistroPage />} />
                <Route
                  path="/recuperar-password"
                  element={<RecuperarPasswordPage />}
                />
              </Route>

              {/*
                Restablecer queda FUERA de SoloVisitantes a propósito: el
                enlace del correo tiene que funcionar aunque el navegador tenga
                una sesión abierta. Si estuviera dentro, SoloVisitantes mandaría
                al inicio y el token nunca se usaría.
              */}
              <Route
                path="/restablecer-password"
                element={<RestablecerPasswordPage />}
              />

              {/* ── Privado ────────────────────────────────────────────── */}
              <Route element={<RutaPrivada />}>
                {/* Cambio obligatorio de contraseña: vive fuera del AppShell
                    para que no se pueda navegar al resto de la app mientras
                    el usuario sigue con una clave temporal. */}
                <Route
                  path="cambiar-password"
                  element={<CambiarPasswordPage />}
                />

                <Route element={<AppShell />}>
                  <Route index element={<DashboardPage />} />

                  {/* Cada mÃ³dulo con su permiso. La pantalla va conectada
                      a un permiso real aunque todavÃ­a no tenga lÃ³gica: asÃ­
                      el andamiaje de autorizaciÃ³n queda probado de entrada. */}
                  <Route
                    element={
                      <RutaConPermiso permiso="citas.ver" />
                    }
                  >
                    <Route
                      path="agenda"
                      element={<AgendaPage />}
                    />
                  </Route>

                  <Route
                    element={<RutaConPermiso permiso="clientes.ver" />}
                  >
                    <Route path="clientes" element={<ClientesPage />} />
                  </Route>

                  <Route
                    element={<RutaConPermiso permiso="pacientes.ver" />}
                  >
                    <Route
                      path="pacientes"
                      element={<PacientesPage />}
                    />
                  </Route>

                  <Route
                    element={<RutaConPermiso permiso="consultas.ver" />}
                  >
                    <Route path="consultas" element={<ConsultasPage />} />
                  </Route>

                  <Route
                    element={
                      <RutaConPermiso permiso="vacunaciones.ver" />
                    }
                  >
                    <Route
                      path="vacunaciones"
                      element={<VacunacionesPage />}
                    />
                  </Route>

                  <Route
                    element={<RutaConPermiso permiso="tratamientos.ver" />}
                  >
                    <Route
                      path="tratamientos"
                      element={<TratamientosPage />}
                    />
                  </Route>

                  <Route
                    element={<RutaConPermiso permiso="grooming.ver" />}
                  >
                    <Route path="grooming" element={<GroomingPage />} />
                  </Route>

                  <Route
                    element={<RutaConPermiso permiso="productos.ver" />}
                  >
                    <Route path="productos" element={<ProductoPage />} />
                  </Route>

                  <Route
                    element={<RutaConPermiso permiso="stock.ajustar" />}
                  >
                    <Route
                      path="inventario/carga-inicial"
                      element={<CargaInicialStockPage />}
                    />
                  </Route>

                  <Route
                    element={<RutaConPermiso permiso="ventas.ver" />}
                  >
                    <Route path="ventas" element={<VentasPage />} />
                    <Route path="ventas/nueva" element={<VentasPage />} />
                  </Route>

                   <Route
                     element={<RutaConPermiso permiso="servicios.ver" />}
                   >
                     <Route path="servicios" element={<ServiciosPage />} />
                   </Route>

                  <Route
                    element={<RutaConPermiso permiso="proveedores.ver" />}
                  >
                    <Route path="proveedores" element={<ProveedoresPage />} />
                  </Route>

                  <Route
                    element={<RutaConPermiso permiso="facturas.ver" />}
                  >
                    <Route path="compras" element={<ComprasPage />} />
                    <Route path="facturacion" element={<FacturacionPage />} />
                  </Route>

                  <Route
                    element={<RutaConPermiso permiso="caja.ver" />}
                  >
                    <Route path="caja" element={<CajaPage />} />
                  </Route>

                  <Route
                    element={<RutaConPermiso permiso="caja.egresos" />}
                  >
                    <Route path="egresos" element={<EgresosPage />} />
                  </Route>

                  <Route
                    element={<RutaConPermiso permiso="usuarios.ver" />}
                  >
                    <Route path="personal" element={<PersonalPage />} />
                  </Route>

                  <Route
                    element={
                      <RutaConPermiso permiso="configuracion.ver" />
                    }
                  >
                    <Route path="configuracion" element={<ConfiguracionPage />} />
                  </Route>

                  {/* El plan es una decisión del dueño de la veterinaria:
                      sólo el rol admin (y el SuperAdmin) lo ve. El trial
                      vencido no bloquea esta pantalla, pero el permiso sí. */}
                  <Route
                    element={<RutaConPermiso permiso="suscripcion.ver" />}
                  >
                    <Route path="suscripcion" element={<SuscripcionPage />} />
                  </Route>

                  {/* El permiso "__superadmin__" no existe en la base: sólo
                      lo satisface el rol superadmin, que tiene todo por
                      definición. Es la única pantalla que cruza veterinarias. */}
                  <Route
                    element={
                      <RutaConPermiso permiso="__superadmin__" />
                    }
                  >
                    <Route path="admin" element={<AdminPage />} />
                  </Route>

                  <Route path="*" element={<NoEncontrado />} />
                </Route>
              </Route>
            </Routes>

            <Toaster />
          </ProveedorAuth>
        </BrowserRouter>
      </QueryClientProvider>
    </ChakraProvider>
  );
}


