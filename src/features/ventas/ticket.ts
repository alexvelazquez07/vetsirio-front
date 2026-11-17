import { formatoImpresion, type ConfiguracionImpresion } from "@/features/settings/impresion";
import {
  formatCantidad,
  formatFechaCalendario,
  formatHora,
  formatMoneda,
  formatMonedaUSD,
} from "@/lib/formato";
import type { Venta } from "./ventas.service";

/* ─────────────────────────────── Tipos del ticket ─────────────────────────────── */

export interface TicketOrganizacion {
  nombre: string;
  razonSocial?: string | null;
  ruc?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  colorPrimario?: string | null;
  timbrado?: string | null;
  timbradoVencimiento?: string | null;
  establecimiento?: string | null;
  puntoVenta?: string | null;
}

export interface TicketItemDatos {
  descripcion: string;
  cantidad: string | number;
  precioUnitario?: string | number;
  total: string | number;
}

export interface TicketPagoDatos {
  metodo: string;
  monto: string | number;
  referencia?: string | null;
}

export interface TicketVentaDatos {
  numeroComprobante: string;
  fechaEmision: string;
  tipoComprobante?: string | null;
  timbrado?: string | null;
  establecimiento?: string | null;
  puntoExpedicion?: string | null;
  moneda: string;
  condicionPago?: string | null;
  estado?: string | null;
  cliente?: { nombre?: string | null; documento?: string | null } | null;
  vendedor?: string | null;
  items: TicketItemDatos[];
  subtotal?: string | number | null;
  iva5?: string | number | null;
  iva10?: string | number | null;
  exenta?: string | number | null;
  total: string | number;
  pagos?: TicketPagoDatos[];
}

export const ETIQUETAS_METODO: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta_debito: "Tarjeta débito",
  tarjeta_credito: "Tarjeta crédito",
  transferencia: "Transferencia",
  giro: "Giro",
};

/* ───────────────────────────── Datos desde una venta ───────────────────────────── */

/** Adapta la venta que devuelve la API al formato que consume el ticket. */
export function ticketDesdeVenta(
  venta: Venta,
  organizacion: TicketOrganizacion,
): TicketVentaDatos {
  const nombreCliente =
    venta.cliente?.nombreCompleto || venta.cliente?.razonSocial || null;

  return {
    numeroComprobante: venta.numeroComprobante,
    fechaEmision: venta.fechaEmision,
    tipoComprobante: venta.tipoComprobante,
    // El timbrado es un snapshot de la venta: si hoy la veterinaria tiene uno
    // nuevo, reimprimir una venta vieja no debe convertirla en factura.
    timbrado: venta.timbrado || null,
    establecimiento: venta.establecimiento || organizacion.establecimiento,
    puntoExpedicion: venta.puntoExpedicion || organizacion.puntoVenta,
    moneda: venta.moneda,
    condicionPago: venta.condicionPago,
    estado: venta.estado,
    cliente: venta.cliente
      ? { nombre: nombreCliente, documento: venta.cliente.documento }
      : null,
    vendedor: [venta.usuario?.nombre, venta.usuario?.apellido]
      .filter(Boolean)
      .join(" "),
    items: (venta.items ?? []).map((item) => ({
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.costoUnitario,
      total: item.total,
    })),
    subtotal: venta.subtotal,
    iva5: venta.iva5,
    iva10: venta.iva10,
    exenta: venta.exenta,
    total: venta.total,
    pagos: (venta.pagos ?? []).map((pago) => ({
      metodo: pago.metodo,
      monto: pago.monto,
      referencia: pago.referencia,
    })),
  };
}

/* ─────────────────────────────── Impresión ─────────────────────────────── */

/**
 * Abre el diálogo de impresión del navegador con el ticket ya maquetado.
 *
 * Se usa un iframe oculto en lugar de `window.open` para que los bloqueadores
 * de ventanas emergentes no interfieran con la autoimpresión.
 */
export function imprimirTicket(
  datos: TicketVentaDatos,
  organizacion: TicketOrganizacion,
  configuracion: ConfiguracionImpresion,
): void {
  if (typeof document === "undefined") return;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const ventana = iframe.contentWindow;
  if (!ventana) {
    iframe.remove();
    return;
  }

  ventana.document.open();
  ventana.document.write(
    construirDocumentoTicket(datos, organizacion, configuracion),
  );
  ventana.document.close();

  const lanzar = () => {
    try {
      ventana.focus();
      ventana.print();
    } finally {
      window.setTimeout(() => iframe.remove(), 1_000);
    }
  };

  esperarImagenes(ventana.document).then(() => {
    window.setTimeout(lanzar, 150);
  });
}

function esperarImagenes(documento: Document): Promise<void> {
  const imagenes = Array.from(documento.images);
  if (imagenes.length === 0) return Promise.resolve();

  return Promise.all(
    imagenes.map(
      (imagen) =>
        new Promise<void>((resolver) => {
          if (imagen.complete) {
            resolver();
            return;
          }
          imagen.addEventListener("load", () => resolver(), { once: true });
          imagen.addEventListener("error", () => resolver(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

function construirDocumentoTicket(
  datos: TicketVentaDatos,
  organizacion: TicketOrganizacion,
  configuracion: ConfiguracionImpresion,
): string {
  const formato = formatoImpresion(configuracion.formato);
  const copias = Math.min(3, Math.max(1, Math.trunc(configuracion.copias)));
  const cuerpo = construirCuerpoTicket(datos, organizacion, configuracion);
  const copiasHtml = Array.from({ length: copias }, () => cuerpo).join(
    '<div class="tk-corte"></div>',
  );

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escaparHtml(datos.numeroComprobante)}</title>
<style>
  @page { size: ${formato.anchoMm}mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${estilosTicket(configuracion)}
</style>
</head>
<body>${copiasHtml}</body>
</html>`;
}

/* ─────────────────────────── Construcción del HTML ─────────────────────────── */

export function estilosTicket(configuracion: ConfiguracionImpresion): string {
  const formato = formatoImpresion(configuracion.formato);
  const compacto = configuracion.formato === "ticket_58";

  return `
.tk-ticket {
  position: relative;
  width: ${formato.anchoMm}mm;
  max-width: 100%;
  box-sizing: border-box;
  padding: ${compacto ? "2.5mm 2.5mm 4mm" : "4mm 4mm 5mm"};
  background: #fff;
  color: #111;
  font-family: "Courier New", Consolas, ui-monospace, monospace;
  font-size: ${compacto ? "8.4pt" : "10.2pt"};
  line-height: 1.35;
  overflow: hidden;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.tk-ticket * { box-sizing: border-box; }
.tk-centro { text-align: center; }
.tk-logo {
  display: block;
  margin: 0 auto ${compacto ? "1.5mm" : "2.5mm"};
  max-width: ${compacto ? "16mm" : "24mm"};
  max-height: ${compacto ? "11mm" : "16mm"};
  object-fit: contain;
  filter: grayscale(1);
}
.tk-negocio { font-size: ${compacto ? "10.5pt" : "12.5pt"}; font-weight: 700; line-height: 1.2; }
.tk-sub { font-size: ${compacto ? "7.6pt" : "8.6pt"}; color: #333; }
.tk-sep { border-top: 1px dashed #555; margin: ${compacto ? "1.6mm 0" : "2.2mm 0"}; }
.tk-titulo {
  text-align: center;
  font-size: ${compacto ? "9.5pt" : "11pt"};
  font-weight: 700;
  letter-spacing: 0.4px;
  margin: 0.5mm 0 1.5mm;
}
.tk-fila {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2mm;
}
.tk-fila > span:first-child { flex: 0 0 auto; }
.tk-fila > span:last-child, .tk-fila > b:last-child { text-align: right; word-break: break-word; }
.tk-etiqueta { font-weight: 700; }
.tk-items { margin-top: 1mm; }
.tk-item { margin-bottom: ${compacto ? "1.2mm" : "1.8mm"}; }
.tk-item-linea { display: flex; align-items: flex-start; gap: 1.2mm; }
.tk-item-cant { flex: 0 0 auto; min-width: 6mm; color: #333; }
.tk-item-desc { flex: 1 1 auto; min-width: 0; word-break: break-word; }
.tk-item-total { flex: 0 0 auto; text-align: right; font-variant-numeric: tabular-nums; }
.tk-item-sub { padding-left: 7.2mm; font-size: ${compacto ? "7.2pt" : "8pt"}; color: #555; }
.tk-totales { margin-top: 0.5mm; }
.tk-total-final {
  display: flex;
  justify-content: space-between;
  gap: 2mm;
  margin-top: 1.2mm;
  padding-top: 1.2mm;
  border-top: 1px solid #111;
  font-size: ${compacto ? "10.5pt" : "12pt"};
  font-weight: 700;
}
.tk-pie {
  margin-top: ${compacto ? "2mm" : "3mm"};
  text-align: center;
  font-size: ${compacto ? "7.8pt" : "8.8pt"};
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}
.tk-nota { text-align: center; font-size: ${compacto ? "7pt" : "7.8pt"}; color: #444; margin-top: 1.2mm; }
.tk-anulada {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(180, 35, 24, 0.28);
  font-size: ${compacto ? "26pt" : "34pt"};
  font-weight: 800;
  letter-spacing: 2px;
  transform: rotate(-24deg);
  pointer-events: none;
}
.tk-corte { border-top: 1px dashed #777; margin: 3mm 0; }
`;
}

export function construirCuerpoTicket(
  datos: TicketVentaDatos,
  organizacion: TicketOrganizacion,
  configuracion: ConfiguracionImpresion,
): string {
  const titulo = tituloComprobante(datos);
  const esTicket = titulo === "TICKET DE VENTA";
  const filas: string[] = [];

  filas.push('<div class="tk-ticket">');

  if (configuracion.mostrarLogo && organizacion.logoUrl) {
    filas.push(
      `<img class="tk-logo" src="${escaparHtml(organizacion.logoUrl)}" alt="" />`,
    );
  }

  filas.push(
    `<div class="tk-centro tk-negocio">${escaparHtml(organizacion.nombre)}</div>`,
  );

  for (const linea of subcabeceraNegocio(organizacion)) {
    filas.push(`<div class="tk-centro tk-sub">${escaparHtml(linea)}</div>`);
  }

  filas.push('<div class="tk-sep"></div>');
  filas.push(`<div class="tk-titulo">${escaparHtml(titulo)}</div>`);

  if (configuracion.mostrarDatosFiscales) {
    if (datos.timbrado) {
      filas.push(fila("Timbrado:", datos.timbrado));
      if (organizacion.timbradoVencimiento) {
        filas.push(
          fila(
            "Vto. timbrado:",
            formatFechaCalendario(organizacion.timbradoVencimiento),
          ),
        );
      }
    }

  filas.push(
    fila("Comprobante: ", datos.numeroComprobante),
    fila(
      "Fecha Emisión: ",
      `${formatFechaCalendario(datos.fechaEmision)} ${formatHora(datos.fechaEmision)}`,
    ),
  );
   /* if (datos.establecimiento || datos.puntoExpedicion) {
      filas.push(
        fila(
          "Establecimiento",
          `${datos.establecimiento ?? "001"}-${datos.puntoExpedicion ?? "001"}`,
        ),
      );
    }*/
  }

  if (datos.condicionPago) {
    filas.push(
      fila(
        "Condición",
        datos.condicionPago === "credito" ? "Crédito" : "Contado",
      ),
    );
  }

  if (configuracion.mostrarVendedor && datos.vendedor) {
    filas.push(fila("Vendedor", datos.vendedor));
  }

  if (configuracion.mostrarCliente && datos.cliente) {
    filas.push('<div class="tk-sep"></div>');
    if (datos.cliente.nombre) {
      filas.push(fila("Cliente: ", datos.cliente.nombre));
    }
    if (configuracion.mostrarDocumentoCliente && datos.cliente.documento) {
      filas.push(fila("R.U.C / C.I : ", datos.cliente.documento));
    }
  }

  filas.push('<div class="tk-sep"></div>');
  filas.push('<div class="tk-items">');

  for (const item of datos.items) {
    const cantidad = Number(item.cantidad) || 1;
    const unitario = item.precioUnitario ?? (Number(item.total) || 0) / cantidad;

    filas.push('<div class="tk-item">');
    filas.push('<div class="tk-item-linea">');
    filas.push(
      `<span class="tk-item-cant">${escaparHtml(formatCantidad(item.cantidad))}×</span>`,
    );
    filas.push(
      `<span class="tk-item-desc">${escaparHtml(item.descripcion)}</span>`,
    );
    filas.push(
      `<span class="tk-item-total">${escaparHtml(dinero(datos.moneda, item.total))}</span>`,
    );
    filas.push("</div>");

    if (cantidad !== 1) {
      filas.push(
        `<div class="tk-item-sub">${escaparHtml(dinero(datos.moneda, unitario))} c/u</div>`,
      );
    }

    filas.push("</div>");
  }

  filas.push("</div>");
  filas.push('<div class="tk-sep"></div>');
  filas.push('<div class="tk-totales">');

  if (configuracion.mostrarDesgloseIva) {
    if (esVerdadero(datos.subtotal)) {
      filas.push(total("Subtotal", dinero(datos.moneda, datos.subtotal)));
    }
    if (esVerdadero(datos.iva5)) {
      filas.push(total("IVA 5 %", dinero(datos.moneda, datos.iva5)));
    }
    if (esVerdadero(datos.iva10)) {
      filas.push(total("IVA 10 %", dinero(datos.moneda, datos.iva10)));
    }
    if (esVerdadero(datos.exenta)) {
      filas.push(total("Exenta", dinero(datos.moneda, datos.exenta)));
    }
  }

  filas.push(
    `<div class="tk-total-final"><span>TOTAL</span><span>${escaparHtml(
      dinero(datos.moneda, datos.total),
    )}</span></div>`,
  );
  filas.push("</div>");

  if (configuracion.mostrarPagos && datos.pagos && datos.pagos.length > 0) {
    filas.push('<div class="tk-sep"></div>');
    for (const pago of datos.pagos) {
      filas.push(
        fila(
          ETIQUETAS_METODO[pago.metodo] ?? pago.metodo,
          dinero(datos.moneda, pago.monto),
        ),
      );
    }
  }

  if (configuracion.mensajePie.trim()) {
    filas.push(
      `<div class="tk-pie">${escaparHtml(configuracion.mensajePie.trim())}</div>`,
    );
  }

  if (esTicket) {
    filas.push('<div class="tk-nota">Documento no válido como factura</div>');
  }

  if (datos.estado === "ANULADA") {
    filas.push('<div class="tk-anulada">ANULADA</div>');
  }

  filas.push("</div>");

  return filas.join("");
}

/* ────────────────────────────── Utilidades ────────────────────────────── */

export function tituloComprobante(datos: TicketVentaDatos): string {
  if (datos.tipoComprobante === "factura_credito_fiscal") {
    return "FACTURA CRÉDITO FISCAL";
  }
  if (datos.tipoComprobante === "ticket" || !datos.timbrado) {
    return "TICKET DE VENTA";
  }
  return "FACTURA DE VENTA";
}

function subcabeceraNegocio(organizacion: TicketOrganizacion): string[] {
  const lineas: string[] = [];
  if (organizacion.razonSocial && organizacion.razonSocial !== organizacion.nombre) {
    lineas.push(organizacion.razonSocial);
  }
  if (organizacion.ruc) lineas.push(`RUC ${organizacion.ruc}`);
  if (organizacion.direccion) lineas.push(organizacion.direccion);
  if (organizacion.telefono) lineas.push(`Tel. ${organizacion.telefono}`);
  if (organizacion.email) lineas.push(organizacion.email);

  return lineas;
}

function fila(etiqueta: string, valor: string | null | undefined): string {
  return `<div class="tk-fila"><span class="tk-etiqueta">${escaparHtml(
    etiqueta,
  )}</span><span>${escaparHtml(valor ?? "")}</span></div>`;
}

function total(etiqueta: string, valor: string): string {
  return `<div class="tk-fila"><span>${escaparHtml(
    etiqueta,
  )}</span><span>${escaparHtml(valor)}</span></div>`;
}

function esVerdadero(valor: string | number | null | undefined): boolean {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) && Math.abs(numero) > 0.004;
}

function dinero(moneda: string, valor: string | number | null | undefined): string {
  return moneda === "USD" ? formatMonedaUSD(valor) : formatMoneda(valor);
}

function escaparHtml(valor: unknown): string {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => {
    switch (caracter) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return caracter;
    }
  });
}
