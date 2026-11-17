import { ChakraProvider } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { VentaForm } from "@/features/ventas/VentaForm";
import { system } from "@/theme/system";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

createRoot(document.getElementById("root")!).render(
  <ChakraProvider value={system}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div style={{ maxWidth: "76rem", margin: "0 auto", padding: 24 }}>
          <VentaForm onGuardar={() => {}} />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  </ChakraProvider>,
);
