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
      <p className="sub">{user ? "Gracias. Tu cuenta ya tiene el correo confirmado." : "Abrí la pantalla de confirmación para ingresar tu código o pedir uno nuevo."}</p>
      <Link className="btn pri auth-btn" href={user ? "/app" : "/confirmar-correo"}>{user ? "Ir a la app" : "Confirmar mi correo"}</Link>
    </AuthShell>
  );
}
