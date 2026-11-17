import { describe, expect, it } from "vitest";

import { rangoDiaActualAgenda } from "./agenda.service";

describe("rangoDiaActualAgenda", () => {
  it("devuelve los límites del día actual en la zona de Asunción", () => {
    const rango = rangoDiaActualAgenda();
    const desde = new Date(rango.desde);
    const hasta = new Date(rango.hasta);
    const diaLocal = (fecha: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Asuncion",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(fecha);

    expect(desde.getTime()).toBeLessThan(hasta.getTime());
    expect(hasta.getTime() - desde.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(diaLocal(desde)).toBe(diaLocal(new Date()));
  });
});
