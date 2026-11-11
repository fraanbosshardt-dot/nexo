import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/brand";
import { getDb } from "@/lib/db";
import { checkVerifyToken } from "@/server/account-mail";

export const metadata: Metadata = { title: "Confirmar correo", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const user = await checkVerifyToken(db, token);
  if (user && !user.emailVerified) await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  return (
    <AuthShell>
      <h1>{user ? "Listo, tu correo quedó confirmado" : "El enlace venció o no es válido"}</h1>
      <p className="sub">{user ? "Gracias. Así podemos avisarte de vencimientos y ayudarte si alguna vez perdés la contraseña." : "Entrá a la app y tocá «Reenviar» en el aviso de arriba para recibir uno nuevo."}</p>
      <Link className="btn pri auth-btn" href="/app">Ir a la app</Link>
    </AuthShell>
  );
}
