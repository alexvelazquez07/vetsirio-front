import {
  esFormatoHoja,
  type ConfiguracionImpresion,
} from "@/features/settings/impresion";
import { imprimirHoja } from "./hoja";
import {
  imprimirTicket,
  type TicketOrganizacion,
  type TicketVentaDatos,
} from "./ticket";

/**
 * Imprime el comprobante en el formato configurado.
 *
 * El ticket térmico se arma como HTML y el autoimpresor de hoja completa se
 * genera como PDF. La pantalla de ventas no tiene que saber cuál es cuál.
 */
export async function imprimirComprobante(
  datos: TicketVentaDatos,
  organizacion: TicketOrganizacion,
  configuracion: ConfiguracionImpresion,
): Promise<void> {
  if (esFormatoHoja(configuracion.formato)) {
    await imprimirHoja(datos, organizacion, configuracion);
    return;
  }

  imprimirTicket(datos, organizacion, configuracion);
}
