// Solo proveedores de Web Push conocidos. La persona no puede elegir un servidor arbitrario.
export function validPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    const host = u.hostname.toLowerCase();
    return u.protocol === "https:" && !u.username && !u.password && (!u.port || u.port === "443") && !u.hash && u.pathname !== "/" &&
      (host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" || host === "web.push.apple.com" || /^[a-z0-9-]+\.push\.apple\.com$/.test(host));
  } catch { return false; }
}

export function validPushKeys(p256dh: unknown, auth: unknown): boolean {
  return typeof p256dh === "string" && typeof auth === "string" && /^[\w-]{87}$/.test(p256dh) && /^[\w-]{22}$/.test(auth) &&
    Buffer.from(p256dh, "base64url").length === 65 && Buffer.from(p256dh, "base64url")[0] === 4 && Buffer.from(auth, "base64url").length === 16;
}

export function sameOrigin(req: Request) {
  const expected = new URL(process.env.APP_URL || req.url).origin;
  return req.headers.get("origin") === expected;
}
