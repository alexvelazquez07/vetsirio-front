import { describe, expect, it } from "vitest";

import { resolverDestinoNotificacion } from "@/features/notificaciones/notificaciones.rutas";

const todoPermitido = () => true;
const nadaPermitido = () => false;

describe("resolverDestinoNotificacion", () => {
  it("traduce el enlace viejo /dashboard al inicio real", () => {
    expect(resolverDestinoNotificacion("/dashboard", todoPermitido)).toEqual({
      accion: "navegar",
      ruta: "/",
    });
  });

  it("navega a una ruta existente cuando hay permiso", () => {
    expect(resolverDestinoNotificacion("/suscripcion", todoPermitido)).toEqual({
      accion: "navegar",
      ruta: "/suscripcion",
    });
  });

  it("no navega si falta el permiso de la sección", () => {
    expect(resolverDestinoNotificacion("/suscripcion", nadaPermitido)).toEqual({
      accion: "sin-permiso",
    });
  });

  it("no navega a rutas que no existen", () => {
    expect(
      resolverDestinoNotificacion("/pantalla-inexistente", todoPermitido),
    ).toEqual({ accion: "sin-destino" });
  });

  it("ignora query, hash y barra final", () => {
    expect(
      resolverDestinoNotificacion("/suscripcion/?desde=aviso#plan", todoPermitido),
    ).toEqual({ accion: "navegar", ruta: "/suscripcion" });
  });

  it("rechaza URLs externas o vacías", () => {
    expect(
      resolverDestinoNotificacion("https://ejemplo.com", todoPermitido),
    ).toEqual({ accion: "sin-destino" });
    expect(resolverDestinoNotificacion(null, todoPermitido)).toEqual({
      accion: "sin-destino",
    });
  });

  it("deja entrar al inicio aunque el rol no tenga panel.ver", () => {
    // La ruta índice no tiene guarda de permisos en App.tsx.
    expect(resolverDestinoNotificacion("/", nadaPermitido)).toEqual({
      accion: "navegar",
      ruta: "/",
    });
  });
});
