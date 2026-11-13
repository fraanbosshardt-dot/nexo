// Plan actual de quien está con la sesión iniciada (para la sección de precios del sitio, que se sirve desde caché).
// Sin sesión responde { logged: false }. No devuelve datos personales.
import { getSession } from "@/lib/auth/session";
import { effectivePlan } from "@/server/plans";
import { pickMembership } from "@/server/sharing";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession().catch(() => null);
  if (!s) return Response.json({ logged: false }, { headers: { "cache-control": "no-store" } });
  const m = pickMembership(s.user.memberships, s.user.activeWorkspaceId);
  const sub = m?.workspace.subscription ?? null;
  const plan = effectivePlan(sub);
  const trial = plan === "PRO" && sub?.status === "TRIALING" && sub.trialEndsAt ? sub.trialEndsAt.toISOString().slice(0, 10) : null;
  const paid = plan === "PRO" && !trial && !!sub?.providerRef && sub.status === "ACTIVE";
  return Response.json({ logged: true, plan, trial, paid, owner: m?.role === "OWNER" }, { headers: { "cache-control": "no-store" } });
}
