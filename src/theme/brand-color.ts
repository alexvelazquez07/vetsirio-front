const COLOR_POR_DEFECTO = "#0D9E87";
const TONOS: Record<number, number> = {
  50: 0.92,
  100: 0.82,
  200: 0.64,
  300: 0.42,
  400: 0.2,
  500: 0,
  600: -0.14,
  700: -0.3,
  800: -0.46,
  900: -0.62,
};

function mezclarConBlanco(valor: number, proporcion: number): number {
  return Math.round(valor + (255 - valor) * proporcion);
}

function mezclarConNegro(valor: number, proporcion: number): number {
  return Math.round(valor * (1 - proporcion));
}

function ajustarTono(color: string, ajuste: number): string {
  const canales = color.match(/[a-f\d]{2}/gi);
  if (!canales) return COLOR_POR_DEFECTO;

  const hex = canales.map((canal) => {
    const valor = Number.parseInt(canal, 16);
    const ajustado =
      ajuste > 0
        ? mezclarConBlanco(valor, ajuste)
        : mezclarConNegro(valor, Math.abs(ajuste));
    return ajustado.toString(16).padStart(2, "0");
  });

  return `#${hex.join("")}`.toUpperCase();
}

export function crearEscalaMarca(colorPrimario: string): Record<number, string> {
  const color = /^#[0-9A-Fa-f]{6}$/.test(colorPrimario)
    ? colorPrimario
    : COLOR_POR_DEFECTO;

  return Object.fromEntries(
    Object.entries(TONOS).map(([tono, ajuste]) => [
      Number(tono),
      ajuste === 0 ? color.toUpperCase() : ajustarTono(color, ajuste),
    ]),
  );
}

export function aplicarColorDeMarca(colorPrimario: string | null | undefined): void {
  const escala = crearEscalaMarca(colorPrimario ?? COLOR_POR_DEFECTO);

  for (const [tono, color] of Object.entries(escala)) {
    document.documentElement.style.setProperty(`--chakra-colors-brand-${tono}`, color);
  }
}
