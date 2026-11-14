// Comprar Pro desde el sitio, en un solo camino:
// - sin sesión: crear cuenta (o ingresar) y, apenas entra, va a pagar;
// - con Pro ya pago: no deja comprar otra vez;
// - en Gratis o en la prueba gratis: directo a Mercado Pago.
// Después de pagar vuelve a la app.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { pickMembership } from "@/server/sharing";

export const dynamic = "force-dynamic";
const AFTER_COOKIE = "somosguafra_after";

export async function GET(req: Request) {
  const anual = new URL(req.url).searchParams.get("ciclo") === "anual";
  const target = `/suscribirme?ciclo=${anual ? "anual" : "mensual"}`;
  const s = await getSession();
  if (!s || (s.user.totpEnabledAt && !s.twoFactorVerified)) {
    // Se recuerda adónde iba (30 minutos): después de crear la cuenta o ingresar, sigue a pagar.
    (await cookies()).set(AFTER_COOKIE, target, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 60 });
    redirect(s ? "/verificar" : "/registro?pro=1");
  }
  const m = pickMembership(s.user.memberships, s.user.activeWorkspaceId);
  if (!m) redirect("/registro?pro=1");
  if (m.role !== "OWNER") redirect("/app/configuracion?soloduenio=1");
  const sub = m.workspace.subscription;
  // Ya tiene Pro activo (pago o regalado): no se compra dos veces.
  if (sub?.plan === "PRO" && sub.status === "ACTIVE") redirect("/app/configuracion?tab=plan&yatenes=1");
  const { needsVerifiedEmail } = await import("@/server/email-verify");
  if (needsVerifiedEmail(s.user)) redirect("/app/configuracion?tab=plan&verificar=pro");
  const { billingConfig, startCheckout } = await import("@/server/billing");
  const db = getDb();
  if (!(await billingConfig(db)).enabled) redirect("/app/configuracion?tab=plan");
  const { appUrl } = await import("@/lib/email");
  const trialEnd = sub?.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt > new Date() ? sub.trialEndsAt : null;
  const link = await startCheckout(db, m.workspace.id, s.user.email, anual ? "yearly" : "monthly", `${appUrl()}/app/configuracion?tab=plan&pago=1`, undefined, trialEnd);
  const { audit } = await import("@/lib/auth/session");
  await audit("billing.checkout_started", { userId: s.user.id, workspaceId: m.workspace.id, meta: { cycle: anual ? "yearly" : "monthly", from: "sitio" } });
  redirect(link);
}
