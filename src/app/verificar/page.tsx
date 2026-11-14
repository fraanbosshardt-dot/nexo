import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthShell } from "@/components/brand";
import { ActionForm, OtpInput, Submit } from "@/components/forms";
import { logoutAction, verifyLoginCodeAction } from "@/app/actions/auth";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Verificación", robots: { index: false, follow: false } };

export default async function VerifyPage() {
  const s = await getSession();
  if (!s) redirect("/ingresar");
  if (!s.user.totpEnabledAt || s.twoFactorVerified) redirect("/app");
  return (
    <AuthShell>
      <div className="vf">
        <span className="vf-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 18h4M12 8v3l2 1" /></svg></span>
        <h1>Revisá tu app de códigos</h1>
        <p className="sub">Abrí Google Authenticator (o la que uses) y escribí el código de 6 números de <b>Somos Guafra</b>. Cambia cada 30 segundos.</p>
        <ActionForm action={verifyLoginCodeAction} className="vf-form">
          <OtpInput autoSubmit />
          <Submit className="btn pri auth-btn" pending="Verificando…">Verificar</Submit>
        </ActionForm>
        <div className="vf-links">
          <a className="lnk" href="/contacto?area=soporte">¿Perdiste el celular? Escribinos</a>
          <form action={logoutAction}><button className="lnk" type="submit">Usar otra cuenta</button></form>
        </div>
      </div>
    </AuthShell>
  );
}
