import { describe, expect, it } from "vitest";
import { renderEmail, type EmailPurpose } from "@/lib/email-template";

const base = "https://somosguafra.com";
describe("diseño de los correos", () => {
  it.each<EmailPurpose>(["welcome", "verification", "password", "security", "billing", "support"])("incluye la acción y el formulario de contacto para %s", (purpose) => {
    const html = renderEmail({ purpose, subject: "Tu cuenta", text: "Hola Ana:\n\nListo." }, base);
    expect(html).toContain('role="presentation"');
    expect(html).toContain(`${base}/contacto`);
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain("undefined");
  });
  it("escapa nombres, asuntos y respuestas sin permitir HTML aportado por usuarios", () => {
    const html = renderEmail({ purpose: "support", subject: '<img src=x onerror="alert(1)">', text: '<script>alert("hola")</script>\n\nhttps://evil.example/test' }, base);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('<img src=x');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain('href="https://evil.example');
  });
  it("destaca el código y preserva el enlace de verificación", () => {
    const html = renderEmail({ purpose: "verification", subject: "Confirmá tu correo", text: `Hola Ana:\n\nTu código para confirmar el correo es: 123456\n\n${base}/verificar-correo/token-firmado` }, base);
    expect(html).toContain("TU CÓDIGO DE VERIFICACIÓN");
    expect(html).toContain("123456");
    expect(html).toContain(`${base}/verificar-correo/token-firmado`);
    expect(html.indexOf("TU CÓDIGO DE VERIFICACIÓN")).toBeLessThan(html.indexOf("Hola Ana"));
  });
  it("no permite redirigir el botón mediante una ruta a otro dominio", () => {
    const html = renderEmail({ purpose: "password", subject: "Contraseña", text: "Hola", action: { label: "Entrar", path: "//evil.example" } }, base);
    expect(html).not.toContain('href="https://evil.example');
    expect(html).toContain(`${base}/recuperar`);
  });
  it("no interpreta un código citado en una respuesta de soporte como verificación", () => {
    const html = renderEmail({ purpose: "support", subject: "Respuesta (C-ABC123)", text: "Tu código es: 123456" }, base);
    expect(html).toContain("TU NÚMERO DE CONSULTA");
    expect(html).not.toContain("TU CÓDIGO DE VERIFICACIÓN");
  });
});
