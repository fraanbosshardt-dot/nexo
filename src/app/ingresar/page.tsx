import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthShell } from "@/components/brand";
import { ActionForm, Submit } from "@/components/forms";
import { loginAction } from "@/app/actions/auth";
import { getSession } from "@/lib/auth/session";
import { GoogleButton, GoogleNotice } from "@/components/google-button";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ nueva?: string; google?: string }> }) {
  const { nueva, google } = await searchParams;
  const s = await getSession();
  if (s && (!s.user.totpEnabledAt || s.twoFactorVerified)) redirect("/app");
  return (
    <AuthShell>
      <h1>Ingresá a tu cuenta</h1>
      <p className="sub">¿No tenés cuenta? <Link className="lnk" href="/registro">Creala gratis</Link></p>
      {nueva && <p className="notice">Listo, ya podés ingresar con tu contraseña nueva.</p>}
      <GoogleNotice code={google} />
      <GoogleButton desde="ingresar" />
      <ActionForm action={loginAction} >
        <label className="field">Correo<input name="email" type="email" autoComplete="username" placeholder="nombre@correo.com" required autoFocus /></label>
        <label className="field">Contraseña<input name="password" type="password" autoComplete="current-password" placeholder="Tu contraseña" required /></label>
        <div className="auth-row">
          <label className="simtg"><input type="checkbox" name="remember" defaultChecked /><span>Mantener la sesión iniciada</span></label>
        </div>
        <Submit className="btn pri auth-btn" pending="Entrando…">Ingresar</Submit>
      </ActionForm>
      <p className="sub"><Link className="lnk" href="/recuperar">Olvidé mi contraseña</Link></p>
    </AuthShell>
  );
}
