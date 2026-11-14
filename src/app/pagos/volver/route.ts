import { after } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { selectBillingWorkspace } from "@/server/billing-return";
import { reconcileWorkspaceBilling } from "@/server/billing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const ws = new URL(req.url).searchParams.get("espacio") ?? "";
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(ws)) redirect("/app");
  const session = await getSession();
  if (!session || (session.user.totpEnabledAt && !session.twoFactorVerified)) {
    (await cookies()).set("somosguafra_after", `/pagos/volver?espacio=${encodeURIComponent(ws)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 60 });
    redirect(session ? "/verificar" : "/ingresar");
  }
  const db = getDb();
  if (!await selectBillingWorkspace(db, session.userId, ws)) redirect("/app");
  // Recuperar un webhook demorado sin hacer esperar la navegación ni iniciar otro cobro.
  after(async () => {
    try {
      const recent = await db.auditLog.count({ where: { action: "billing.return_sync", userId: session.userId, workspaceId: ws, createdAt: { gte: new Date(Date.now() - 60_000) } } });
      if (recent) return;
      await db.auditLog.create({ data: { action: "billing.return_sync", userId: session.userId, workspaceId: ws } });
      await reconcileWorkspaceBilling(db, ws);
    } catch (error) { console.error("[billing return]", error); }
  });
  redirect("/app?pago=recibido");
}
