import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLAVE_EMAIL_RECORDADO,
  guardarEmailRecordado,
  leerEmailRecordado,
  olvidarEmailRecordado,
} from "./emailRecordado";

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("emailRecordado", () => {
  it("guarda el correo normalizado y lo lee", () => {
    guardarEmailRecordado("  ana@vet.com  ");

    expect(window.localStorage.getItem(CLAVE_EMAIL_RECORDADO)).toBe("ana@vet.com");
    expect(leerEmailRecordado()).toBe("ana@vet.com");
  });

  it("no guarda un correo vacío", () => {
    guardarEmailRecordado("   ");

    expect(leerEmailRecordado()).toBe("");
  });

  it("devuelve cadena vacía cuando no hay nada guardado", () => {
    expect(leerEmailRecordado()).toBe("");
  });

  it("borra el correo guardado", () => {
    guardarEmailRecordado("ana@vet.com");

    olvidarEmailRecordado();

    expect(leerEmailRecordado()).toBe("");
  });

  it("no rompe si el navegador bloquea el almacenamiento", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });

    expect(() => guardarEmailRecordado("ana@vet.com")).not.toThrow();
    expect(leerEmailRecordado()).toBe("");
    expect(() => olvidarEmailRecordado()).not.toThrow();
  });
});
