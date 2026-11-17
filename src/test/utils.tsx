import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement, ReactNode } from "react";

import { system } from "@/theme/system";

/**
 * Helpers de render para pruebas de componentes.
 *
 * Montar un componente de Chakra fuera del provider falla con un error
 * confuso: "useContext returned undefined. Seems you forgot to wrap component
 * within <ChakraProvider />". Estos envoltorios lo resuelven una vez para todas
 * las pruebas y además permiten sumar el router y el cliente de queries
 * cuando el componente los necesita.
 */

export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // En pruebas no hay servidor: reintentar sólo multiplica los tiempos de
      // espera y termina en errores que no dicen nada del componente.
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface Opciones extends Omit<RenderOptions, "wrapper"> {
  /** Con router simulado, para componentes que usan useNavigate o useLocation. */
  conRouter?: boolean;
  /** Con cliente de React Query, para componentes que usan useQuery o useMutation. */
  conQuery?: boolean;
  /** Ruta inicial del router simulado. */
  ruta?: string;
}

/**
 * Monta un componente con los providers que necesita.
 *
 * El orden de los providers importa y no es arbitrario: el router tiene que
 * quedar por fuera de cualquier componente que use sus hooks, que es el mismo
 * error que secuestró la aplicación cuando ProveedorAuth quedó por fuera del
 * BrowserRouter.
 *
 * El `rerender` que se devuelve está reescrito para volver a envolver el
 * componente. El de Testing Library reemplaza el árbol entero por lo que se le
 * pase, así que el `rerender(<Algo />)` más obvío deja al componente sin
 * `ChakraProvider` y revienta con un error que no tiene nada que ver con lo que
 * se está probando. Reconstruir el envoltorio en cada llamada evita esa
 * trampa sin obligar a cada test a acordarse de él.
 */
export function renderConChakra(ui: ReactElement, opciones: Opciones = {}): RenderResult {
  const { conRouter = false, conQuery = false, ruta = "/", ...resto } = opciones;

  // Se crea una sola vez y se reutiliza en cada rerender: instanciarlo dentro
  // del envoltorio daría un cliente distinto en cada pasada y perderíamos el
  // estado de las consultas, con lo que los tests que dependen de datos
  // cacheados se volverían intermitentes.
  const queryClient = conQuery ? crearQueryClient() : null;

  const envolver = (elemento: ReactNode): ReactElement => {
    let contenido = elemento;

    if (conRouter) {
      contenido = <MemoryRouter initialEntries={[ruta]}>{contenido}</MemoryRouter>;
    }

    if (queryClient) {
      contenido = <QueryClientProvider client={queryClient}>{contenido}</QueryClientProvider>;
    }

    return <ChakraProvider value={system}>{contenido}</ChakraProvider>;
  };

  const resultado = render(envolver(ui), resto);

  return {
    ...resultado,
    // La firma tiene que aceptar ReactNode y no ReactElement porque es la que
    // declara RenderResult; si se estrecha, el objeto devuelto deja de ser
    // asignable a RenderResult.
    rerender: (elemento: ReactNode) => resultado.rerender(envolver(elemento)),
    unmount: () => resultado.unmount(),
  };
}