import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAdmin } from "@/lib/auth/admin";
import { googleEnabled } from "@/lib/auth/google";
import { adminDevLoginAction } from "@/app/actions/admin";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Panel interno · Ingresar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const MSG: Record<string, string> = {
  nolista: "Ese correo de Google no está en la lista del equipo. Pedile a un dueño que te sume.",
  cancelado: "Cancelaste el ingreso con Google.",
  fallo: "No pudimos terminar el ingreso con Google. Probá de nuevo.",
  off: "Falta configurar Google (GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).",
};

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  if (await getAdmin()) redirect("/admin");
  const { google } = await searchParams;
  const dev = process.env.NODE_ENV === "development";
  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <span className="adm-login-ico"><Icon name="shield" /></span>
        <h1>Panel interno de NEXO</h1>
        <p className="sub">Solo para el equipo. Se entra con una cuenta de Google que esté en la lista.</p>
        {google && MSG[google] && <p className="auth-err" role="alert">{MSG[google]}</p>}
        {googleEnabled() ? (
          <a className="btn auth-btn gbtn" href="/api/auth/google?desde=admin">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Entrar con Google
          </a>
        ) : <p className="notice">{MSG.off}</p>}
        {dev && (
          <form action={adminDevLoginAction} className="adm-dev">
            <small>Solo en tu computadora (modo desarrollo): entrar sin Google con un correo de la lista.</small>
            <div className="acts"><input className="adm-q" name="email" type="email" placeholder="correo@de.la.lista" required /><button className="btn" type="submit">Entrar</button></div>
          </form>
        )}
        <p className="pub-note">La sesión del panel dura 8 horas y es aparte de la cuenta de la app. Cada cambio queda registrado con tu correo.</p>
      </div>
    </div>
  );
}
