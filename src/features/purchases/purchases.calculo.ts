export type PorcentajeIvaCompra = 0 | 5 | 10;

export interface LineaCalculoCompra {
  cantidad: number;
  costoUnitario: number;
  porcentajeIva: PorcentajeIvaCompra;
}

export interface TotalesCompra {
  subtotal: number;
  iva5: number;
  iva10: number;
  exenta: number;
  iva: number;
  total: number;
}

export function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function calcularLineaCompra(linea: LineaCalculoCompra) {
  const costoConIva = linea.costoUnitario;
  const subtotalConIva = redondear2(linea.cantidad * costoConIva);

  const factorIva = 1 + linea.porcentajeIva / 100;
  const subtotalSinIva = redondear2(subtotalConIva / factorIva);
  const montoIva = redondear2(subtotalConIva - subtotalSinIva);

  return {
    subtotal: subtotalSinIva,
    montoIva,
    total: subtotalConIva,
  };
}

export function calcularTotalesCompra(
  lineas: LineaCalculoCompra[],
): TotalesCompra {
  const totales: TotalesCompra = {
    subtotal: 0,
    iva5: 0,
    iva10: 0,
    exenta: 0,
    iva: 0,
    total: 0,
  };

  for (const linea of lineas) {
    const calculo = calcularLineaCompra(linea);

    totales.subtotal = redondear2(totales.subtotal + calculo.subtotal);
    totales.total = redondear2(totales.total + calculo.total);
    totales.iva = redondear2(totales.iva + calculo.montoIva);

    if (linea.porcentajeIva === 5) {
      totales.iva5 = redondear2(totales.iva5 + calculo.montoIva);
    } else if (linea.porcentajeIva === 10) {
      totales.iva10 = redondear2(totales.iva10 + calculo.montoIva);
    } else {
      totales.exenta = redondear2(totales.exenta + calculo.subtotal);
    }
  }

  return totales;
}

export function fechaHoyCalendario(): string {
  const ahora = new Date();
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
