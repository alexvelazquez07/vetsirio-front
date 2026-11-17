/** Etiquetas legibles de los roles; el slug técnico se conserva en la API. */
const ETIQUETAS_ROL: Record<string, string> = {
  admin: "Administrador",
  veterinario: "Veterinario",
  recepcionista: "Recepcionista",
  peluquero: "Peluquero",
  farmacia: "Farmacia",
};

/** Paleta de Chakra usada para distinguir cada rol en listados y tarjetas. */
export const COLOR_ROL: Record<string, string> = {
  admin: "purple",
  veterinario: "brand",
  recepcionista: "blue",
  peluquero: "pink",
  farmacia: "orange",
};

export function nombreRol(nombre: string): string {
  return ETIQUETAS_ROL[nombre] ?? nombre;
}
