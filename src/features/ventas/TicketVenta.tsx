import {
  formatoImpresion,
  type ConfiguracionImpresion,
} from "@/features/settings/impresion";
import {
  construirCuerpoTicket,
  estilosTicket,
  type TicketOrganizacion,
  type TicketVentaDatos,
} from "./ticket";

/**
 * Muestra el mismo HTML que se manda a la impresora.
 *
 * No se reimplementa el ticket con componentes Chakra a propósito: cualquier
 * diferencia entre la vista previa y el papel termina siendo una sorpresa
 * desagradable en el mostrador.
 */
export function TicketPreview({
  datos,
  organizacion,
  configuracion,
}: {
  datos: TicketVentaDatos;
  organizacion: TicketOrganizacion;
  configuracion: ConfiguracionImpresion;
}) {
  const formato = formatoImpresion(configuracion.formato);

  return (
    <div
      aria-label={`Vista previa del ticket de ${formato.etiqueta}`}
      style={{
        width: formato.anchoPx,
        maxWidth: "100%",
        overflow: "hidden",
        borderRadius: 6,
        background: "#fff",
        boxShadow: "0 12px 32px -12px rgba(16, 24, 40, 0.35)",
      }}
    >
      <style>{estilosTicket(configuracion)}</style>
      <div
        dangerouslySetInnerHTML={{
          __html: construirCuerpoTicket(datos, organizacion, configuracion),
        }}
      />
    </div>
  );
}
