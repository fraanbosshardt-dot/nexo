import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/brand";
import { ActionForm, PasswordStrength, Submit } from "@/components/forms";
import { resetPasswordAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Contraseña nueva" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthShell>
      <h1>Elegí una contraseña nueva</h1>
      <p className="sub">Al guardarla se cierran las sesiones abiertas en otros dispositivos.</p>
      <ActionForm action={resetPasswordAction}>
        <input type="hidden" name="token" value={token} />
        <PasswordStrength />
        <Submit className="btn pri auth-btn" pending="Guardando…">Guardar contraseña</Submit>
      </ActionForm>
      <p className="sub"><Link className="lnk" href="/recuperar">Pedir otro enlace</Link></p>
    </AuthShell>
  );
}
