import { describe, expect, it } from "vitest";

import { urlFotoPaciente } from "./patients.service";

describe("urlFotoPaciente", () => {
  it("resuelve una ruta pública de uploads contra el origen del backend", () => {
    expect(urlFotoPaciente("/uploads/generales/1/avatar.jpg")).toBe(
      `${window.location.origin}/uploads/generales/1/avatar.jpg`,
    );
  });

  it("conserva URLs absolutas de almacenamiento", () => {
    expect(urlFotoPaciente("https://imagenes.example.test/avatar.jpg")).toBe(
      "https://imagenes.example.test/avatar.jpg",
    );
  });

  it("no produce una URL para pacientes sin foto", () => {
    expect(urlFotoPaciente(null)).toBeUndefined();
  });
});
