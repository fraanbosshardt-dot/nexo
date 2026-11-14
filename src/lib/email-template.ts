// HTML de correo: tablas e imágenes HTTPS, sin scripts, formularios ni CSS externo.
// También se conserva la versión de texto para lectores de correo y accesibilidad.
export type EmailPurpose = "welcome" | "verification" | "password" | "security" | "billing" | "support";
export type EmailContent = { purpose: EmailPurpose; subject: string; text: string; action?: { label: string; path: string } };

const THEMES: Record<EmailPurpose, { label: string; hint: string; action: string }> = {
  welcome: { label: "TU CUENTA, LISTA", hint: "Un lugar para ordenar tu plata y mirar lo que viene.", action: "Empezar en somosguafra" },
  verification: { label: "CONFIRMÁ TU CUENTA", hint: "Un paso más para que tu cuenta quede protegida.", action: "Confirmar mi correo" },
  password: { label: "ACCESO A TU CUENTA", hint: "Tu acceso, siempre en tus manos.", action: "Elegir mi contraseña" },
  security: { label: "SEGURIDAD DE TU CUENTA", hint: "Te avisamos para que tengas el control.", action: "Revisar mi cuenta" },
  billing: { label: "TU SUSCRIPCIÓN PRO", hint: "El estado de tu plan, con toda la información a mano.", action: "Ver mi suscripción" },
  support: { label: "ESTAMOS PARA AYUDARTE", hint: "Tu consulta tiene un lugar y un equipo para responderla.", action: "Ir a Contacto" },
};

export const escapeEmailHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const emailBrandText = (text: string) => text.replace(/Somos Guafra/g, "somosguafra");

export function renderEmail(content: EmailContent, base: string): string {
  content = { ...content, subject: emailBrandText(content.subject), text: emailBrandText(content.text) };
  const origin = new URL(base).origin;
  const theme = THEMES[content.purpose];
  const text = content.text.replace(/\r\n/g, "\n").trim().replace(/\n(?:—\n)?(?:Somos Guafra|somosguafra)$/, "").trim();
  const urls = text.match(/https?:\/\/[^\s<>]+/g) ?? [];
  const firstParty = (raw: string) => { try { const u = new URL(raw); return u.origin === origin && ["https:", "http:"].includes(u.protocol) ? u : null; } catch { return null; } };
  let actionUrl: URL | null = null;
  if (content.action?.path.startsWith("/") && !content.action.path.startsWith("//")) actionUrl = firstParty(new URL(content.action.path, origin).href);
  if (!actionUrl) actionUrl = urls.map(firstParty).find((u) => u !== null) ?? null;
  const defaults: Record<EmailPurpose, string> = { welcome: "/bienvenida", verification: "/confirmar-correo", password: "/recuperar", security: "/app/configuracion?tab=seguridad", billing: "/app/configuracion?tab=plan", support: "/contacto" };
  if (!actionUrl) actionUrl = new URL(defaults[content.purpose], origin);
  let label = content.action?.label || theme.action;
  if (!content.action && actionUrl.pathname.startsWith("/verificar-correo/")) label = "Confirmar mi correo";
  if (!content.action && actionUrl.pathname === "/app/ayuda") label = "Ver mi consulta";
  if (!content.action && actionUrl.pathname.startsWith("/admin/")) label = "Abrir en el panel";
  const code = ["welcome", "verification"].includes(content.purpose) ? text.match(/código[^\n]*?:\s*(\d{6})\b/i)?.[1] : undefined;
  const ticket = content.purpose === "support" ? (content.subject.match(/\bC-[A-Z0-9]{4,12}\b/) ?? text.match(/\bC-[A-Z0-9]{4,12}\b/))?.[0] : undefined;
  const inline = (value: string) => {
    // Solo convierte enlaces del propio sitio. Todo contenido aportado por usuarios se escapa.
    const parts = value.split(/(https?:\/\/[^\s<>]+)/g);
    return parts.map((part) => { const u = firstParty(part); return u ? `<a href="${escapeEmailHtml(u.href)}" style="color:#16493A;text-decoration:underline;word-break:break-word">${u.pathname.startsWith("/verificar-correo/") ? "Confirmar mi correo" : u.pathname.startsWith("/recuperar") ? "Recuperar mi acceso" : "Abrir en somosguafra"}</a>` : escapeEmailHtml(part); }).join("").replace(/\n/g, "<br>");
  };
  const paragraphs = text.split(/\n\s*\n/).filter((p) => !/^https?:\/\/\S+$/.test(p.trim())).map((p) => {
    if (code) p = p.replace(new RegExp(`Tu código[^\\n]*?:\\s*${code}`, "i"), "Confirmá tu correo con este código.");
    return `<p style="margin:0 0 18px;color:#42534B;font-size:16px;line-height:1.75;word-break:break-word">${inline(p)}</p>`;
  }).join("");
  const callout = code ? `<tr><td style="padding:0 40px 26px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EFF5EB;border:1px solid #DCE8D4;border-radius:16px"><tr><td align="center" style="padding:22px"><p style="margin:0 0 10px;font-size:12px;letter-spacing:1.5px;color:#50614E">TU CÓDIGO DE VERIFICACIÓN</p><p style="margin:0;font:700 34px/1.3 'Courier New',monospace;letter-spacing:8px;color:#16493A">${code}</p><p style="margin:10px 0 0;font-size:12px;color:#647360">Vence en 30 minutos. No lo compartas.</p></td></tr></table></td></tr>` : ticket ? `<tr><td style="padding:0 40px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EFF5EB;border-radius:14px"><tr><td style="padding:18px 22px;color:#52614B;font-size:13px">TU NÚMERO DE CONSULTA<br><strong style="display:block;padding-top:6px;font-size:22px;letter-spacing:2px;color:#16493A">${ticket}</strong></td></tr></table></td></tr>` : "";
  const preheader = theme.hint;
  const esc = escapeEmailHtml;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(content.subject)}</title><style>@media(max-width:620px){.outer{padding:20px 10px!important}.pad{padding-left:24px!important;padding-right:24px!important}.headline{font-size:26px!important}.button{display:block!important}}</style></head>
<body style="margin:0;padding:0;background:#F3F5EF;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%"><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F5EF"><tr><td class="outer" align="center" style="padding:40px 20px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px"><tr><td style="padding:0 6px 24px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td><img src="${esc(origin)}/email-logo.png" width="40" height="40" alt="" style="display:block;border:0;border-radius:12px"></td><td style="padding-left:12px;color:#16493A;font-size:20px;font-weight:700;letter-spacing:-.5px">somosguafra</td></tr></table></td></tr><tr><td style="background:#FFFFFF;border:1px solid #DFE6DA;border-radius:24px;overflow:hidden"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="pad" style="padding:36px 40px 18px"><span style="font-size:10px;line-height:1.6;letter-spacing:1.8px;font-weight:700;color:#467342;background:#EDF5E6;border:1px solid #DDEBD4;border-radius:20px;padding:8px 12px;display:inline-block">${theme.label}</span><h1 class="headline" style="margin:22px 0 12px;color:#173D30;font-size:30px;font-weight:700;line-height:1.2;letter-spacing:-.8px;word-break:break-word">${esc(content.subject)}</h1><p style="margin:0;color:#788475;font-size:14px;line-height:1.6">${esc(theme.hint)}</p></td></tr>${callout}<tr><td class="pad" style="padding:12px 40px 8px">${paragraphs}</td></tr><tr><td class="pad" style="padding:0 40px 32px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#16493A" style="border-radius:12px;mso-padding-alt:16px 24px"><a class="button" href="${esc(actionUrl.href)}" style="display:inline-block;padding:16px 24px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;border:1px solid #16493A;border-radius:12px">${esc(label)} &nbsp;→</a></td></tr></table></td></tr><tr><td class="pad" style="padding:22px 40px;background:#F8FAF5;border-top:1px solid #E7EDDF;border-radius:0 0 24px 24px"><p style="margin:0;font-size:13px;line-height:1.7;color:#6C7967">¿Necesitás ayuda? <a href="${esc(origin)}/contacto" style="font-weight:700;color:#16493A;text-decoration:underline">Escribinos desde Contacto</a>.<br>Para seguir la conversación, usá el formulario. No respondas a esta dirección automática.</p></td></tr></table></td></tr><tr><td align="center" style="padding:24px 20px 0"><p style="margin:0 0 7px;color:#51624B;font-size:12px;font-weight:700">Tu plata, más clara.</p><p style="margin:0;color:#8A9585;font-size:11px;line-height:1.7">somosguafra · Finanzas personales en tu moneda.<br>Un correo de servicio para acompañar una acción de tu cuenta.</p></td></tr></table></td></tr></table></body></html>`;
}
