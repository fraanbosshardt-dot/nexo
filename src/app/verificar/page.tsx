import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthShell } from "@/components/brand";
import { ActionForm, OtpInput, Submit } from "@/components/forms";
import { logoutAction, verifyLoginCodeAction } from "@/app/actions/auth";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Verificación" };

export default async function VerifyPage() {
  const s = await getSession();
  if (!s) redirect("/ingresar");
  if (!s.user.totpEnabledAt || s.twoFactorVerified) redirect("/app");
  return (
    <AuthShell>
      <h1>Verificá que sos vos</h1>
      <p className="sub">Escribí el código de 6 números que muestra Google Authenticator.</p>
      <ActionForm action={verifyLoginCodeAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <OtpInput />
        <Submit className="btn pri auth-btn" pending="Verificando…">Verificar</Submit>
      </ActionForm>
      <form action={logoutAction}><button className="lnk" type="submit">Usar otra cuenta</button></form>
    </AuthShell>
  );
}
