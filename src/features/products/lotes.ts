const DIA_MS = 24 * 60 * 60 * 1000;

export interface EstadoLote {
  color: "gray" | "red" | "orange" | "green";
  texto: string;
  dias: number | null;
  vencido: boolean;
  porVencer: boolean;
}

function fechaCalendarioLocal(fecha: string): Date | null {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!coincidencia) return null;

  const [, anio, mes, dia] = coincidencia;
  const fechaLocal = new Date(
    Number(anio),
    Number(mes) - 1,
    Number(dia),
    0,
    0,
    0,
    0,
  );

  return Number.isNaN(fechaLocal.getTime()) ? null : fechaLocal;
}

export function estadoLote(
  fecha: string | null | undefined,
  hoy = new Date(),
): EstadoLote {
  if (!fecha) {
    return {
      color: "gray",
      texto: "Sin vencimiento",
      dias: null,
      vencido: false,
      porVencer: false,
    };
  }

  const vence = fechaCalendarioLocal(fecha);
  if (!vence) {
    return {
      color: "gray",
      texto: "Sin vencimiento",
      dias: null,
      vencido: false,
      porVencer: false,
    };
  }

  const referencia = new Date(hoy);
  referencia.setHours(0, 0, 0, 0);
  const dias = Math.round((vence.getTime() - referencia.getTime()) / DIA_MS);

  if (dias < 0) {
    return {
      color: "red",
      texto: `Vencido hace ${Math.abs(dias)} d`,
      dias,
      vencido: true,
      porVencer: false,
    };
  }

  if (dias === 0) {
    return {
      color: "red",
      texto: "Vence hoy",
      dias,
      vencido: true,
      porVencer: false,
    };
  }

  if (dias <= 30) {
    return {
      color: "orange",
      texto: `Vence en ${dias} d`,
      dias,
      vencido: false,
      porVencer: true,
    };
  }

  return {
    color: "green",
    texto: "Vigente",
    dias,
    vencido: false,
    porVencer: false,
  };
}
