import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthShell } from "@/components/brand";
import { ActionForm, PasswordStrength, Submit } from "@/components/forms";
import { signupAction } from "@/app/actions/auth";
import { getSession } from "@/lib/auth/session";
import { GoogleButton, GoogleNotice } from "@/components/google-button";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  if (await getSession()) redirect("/app");
  return (
    <AuthShell>
      <h1>Creá tu cuenta</h1>
      <p className="sub">¿Ya tenés cuenta? <Link className="lnk" href="/ingresar">Iniciá sesión</Link></p>
      <GoogleNotice code={google} />
      <GoogleButton desde="registro" />
      <ActionForm action={signupAction} >
        <label className="field">Nombre<input name="name" autoComplete="name" placeholder="Tu nombre" required autoFocus /></label>
        <label className="field">Correo<input name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required /></label>
        <PasswordStrength />
        <label className="simtg">
          <input type="checkbox" name="terms" required />
          <span>Acepto los <Link className="lnk" href="/terminos" target="_blank">términos y condiciones</Link> y la <Link className="lnk" href="/privacidad" target="_blank">política de privacidad</Link>.</span>
        </label>
        <Submit className="btn pri auth-btn" pending="Creando tu cuenta…">Crear cuenta</Submit>
      </ActionForm>
      <p className="pub-note">Si entrás con Google, aceptás los <Link className="lnk" href="/terminos">términos</Link> y la <Link className="lnk" href="/privacidad">política de privacidad</Link>. Después podés activar la verificación en dos pasos con Google Authenticator, en Configuración → Seguridad.</p>
    </AuthShell>
  );
}
