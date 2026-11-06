import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthShell } from "@/components/brand";
import { ActionForm, PasswordStrength, Submit } from "@/components/forms";
import { signupAction } from "@/app/actions/auth";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignupPage() {
  if (await getSession()) redirect("/app");
  return (
    <AuthShell>
      <h1>Crear cuenta</h1>
      <p className="sub">¿Ya tenés cuenta? <Link className="lnk" href="/ingresar">Iniciá sesión</Link></p>
      <ActionForm action={signupAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label className="field">Nombre<input name="name" autoComplete="name" placeholder="Cómo te llamamos" required autoFocus /></label>
        <label className="field">Correo<input name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required /></label>
        <PasswordStrength />
        <label className="simtg">
          <input type="checkbox" name="terms" required />
          <span>Acepto los <Link className="lnk" href="/terminos" target="_blank">términos y condiciones</Link> y la <Link className="lnk" href="/privacidad" target="_blank">política de privacidad</Link>.</span>
        </label>
        <Submit className="btn pri auth-btn" pending="Creando tu cuenta…">Crear cuenta</Submit>
      </ActionForm>
      <p className="pub-note">Después podés activar la verificación en dos pasos con Google Authenticator, en Configuración → Seguridad.</p>
    </AuthShell>
  );
}
