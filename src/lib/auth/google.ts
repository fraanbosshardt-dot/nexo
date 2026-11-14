// Ingreso con Google (OpenID Connect, flujo con código + PKCE). Sin librerías: solo fetch al servidor de Google.
// Se activa cargando GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.
import { createHash, randomBytes } from "node:crypto";

export const GOOGLE_COOKIE = "somosguafra_g";
export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const googleRedirectUri = (base: string) => `${base}/api/auth/google/callback`;

const b64 = (n: number) => randomBytes(n).toString("base64url");

export type GoogleStart = { state: string; verifier: string; nonce: string; desde: "ingresar" | "registro" | "admin" };

export function startGoogle(base: string, desde: GoogleStart["desde"]) {
  const st: GoogleStart = { state: b64(24), verifier: b64(48), nonce: b64(24), desde };
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(base),
    response_type: "code",
    scope: "openid email profile",
    state: st.state,
    nonce: st.nonce,
    code_challenge: createHash("sha256").update(st.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${q}`, cookie: JSON.stringify(st) };
}

export function readStart(raw: string | undefined): GoogleStart | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v?.state === "string" && typeof v?.verifier === "string" && typeof v?.nonce === "string" ? { ...v, desde: v.desde === "registro" || v.desde === "admin" ? v.desde : "ingresar" } : null;
  } catch {
    return null;
  }
}

export type GoogleProfile = { sub: string; email: string; name: string };

// Revisa el id_token que devuelve Google. Llega directo del servidor de Google por HTTPS,
// así que alcanza con revisar emisor, destinatario, vencimiento, nonce y que el correo esté verificado.
export function checkIdToken(idToken: string, opts: { clientId: string; nonce: string; now?: number }): GoogleProfile | null {
  const part = idToken.split(".")[1];
  if (!part) return null;
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (p.iss !== "https://accounts.google.com" && p.iss !== "accounts.google.com") return null;
  if (p.aud !== opts.clientId) return null;
  if (typeof p.exp !== "number" || p.exp < now - 60) return null;
  if (p.nonce !== opts.nonce) return null;
  if (p.email_verified !== true && p.email_verified !== "true") return null;
  if (typeof p.sub !== "string" || !p.sub || typeof p.email !== "string" || !p.email.includes("@")) return null;
  const email = p.email.trim().toLowerCase();
  const name = (typeof p.name === "string" && p.name.trim()) || email.split("@")[0];
  return { sub: p.sub, email, name: name.slice(0, 80) };
}

export async function exchangeCode(code: string, verifier: string, base: string): Promise<string | null> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: googleRedirectUri(base),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { id_token?: string };
  return j.id_token ?? null;
}
