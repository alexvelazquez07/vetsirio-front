/**
 * Correo recordado para el acceso.
 *
 * Vive en `localStorage` y no en el backend: es una preferencia del navegador,
 * no un dato de la cuenta. El servidor nunca recibe que se eligió recordarlo.
 *
 * Además de "Recordar mi correo" en el login, lo usan los flujos de
 * recuperación y de alta: si la persona acaba de escribir su correo para
 * restablecer la contraseña o de crear la cuenta, sería absurdo pedírselo otra
 * vez al volver al acceso.
 */

export const CLAVE_EMAIL_RECORDADO = "vetsirio:email-recordado";

/** Lee el correo guardado, si existe. Nunca lanza. */
export function leerEmailRecordado(): string {
  try {
    return window.localStorage.getItem(CLAVE_EMAIL_RECORDADO) ?? "";
  } catch {
    return "";
  }
}

/**
 * Guarda el correo para precargarlo en el próximo acceso.
 *
 * Se normaliza con `trim` porque los formularios suelen enviar el valor tal
 * cual se escribió, y un espacio al final terminaría dentro del input.
 */
export function guardarEmailRecordado(email: string): void {
  const limpio = email.trim();

  if (!limpio) return;

  try {
    window.localStorage.setItem(CLAVE_EMAIL_RECORDADO, limpio);
  } catch {
    // Si el navegador bloquea el almacenamiento, el login sigue funcionando:
    // sólo se pierde la comodidad de tener el correo precargado.
  }
}

/** Borra el correo guardado cuando la persona desmarca "Recordar mi correo". */
export function olvidarEmailRecordado(): void {
  try {
    window.localStorage.removeItem(CLAVE_EMAIL_RECORDADO);
  } catch {
    // Mismo caso que al guardar: no hay nada que hacer ni que informar.
  }
}
