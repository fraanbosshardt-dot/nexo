import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/brand";
import { ActionForm, Submit } from "@/components/forms";
import { requestResetAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPage() {
  return (
    <AuthShell>
      <h1>Recuperá tu contraseña</h1>
      <p className="sub">Escribí el correo de tu cuenta y te mandamos un enlace para elegir una nueva.</p>
      <ActionForm action={requestResetAction}>
        <label className="field">Correo<input name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required autoFocus /></label>
        <Submit className="btn pri auth-btn" pending="Enviando…">Mandarme el enlace</Submit>
      </ActionForm>
      <p className="sub"><Link className="lnk" href="/ingresar">Volver a ingresar</Link></p>
    </AuthShell>
  );
}
