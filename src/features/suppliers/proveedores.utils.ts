export function formatearRucProveedor(valor: string): string {
  const digitos = valor.replace(/\D/g, "");

  if (digitos.length < 8 || digitos.length > 11) return digitos;

  return `${digitos.slice(0, -1)}-${digitos.slice(-1)}`;
}
