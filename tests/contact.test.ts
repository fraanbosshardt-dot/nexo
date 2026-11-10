import { describe, expect, it } from "vitest";
import { isArea, ticketCode, validateContact } from "@/server/contact";
import { LEGAL } from "@/content/legal";
import { BRAND } from "@/lib/brand";

describe("Contacto", () => {
  it("número de trámite corto y sin letras confusas", () => {
    for (let i = 0; i < 200; i++) expect(ticketCode()).toMatch(/^C-[A-HJ-NP-Z2-9]{6}$/);
  });
  it("valida área, correo y mensaje", () => {
    const ok = { area: "soporte", name: "Ana", email: "ana@mail.com", subject: "No veo mis cuotas", body: "Cargué la tarjeta y no aparecen." };
    expect(validateContact(ok)).toBeNull();
    expect(validateContact({ ...ok, area: "otra" })).toMatch(/área/);
    expect(validateContact({ ...ok, email: "ana" })).toMatch(/correo/);
    expect(validateContact({ ...ok, body: "hola" })).toMatch(/más/);
    expect(isArea("arrepentimiento")).toBe(true);
  });
  it("los legales nombran al titular y tienen reembolsos y cookies", () => {
    expect(Object.keys(LEGAL)).toEqual(expect.arrayContaining(["terminos", "privacidad", "reembolsos", "cookies", "arrepentimiento"]));
    expect(JSON.stringify(LEGAL.terminos)).toContain(BRAND.cuit);
    expect(JSON.stringify(LEGAL.terminos)).toMatch(/No es asesoramiento financiero/);
    expect(JSON.stringify(LEGAL)).not.toContain("soporte@nexo.app");
  });
});
