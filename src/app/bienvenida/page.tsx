import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/session";
import { MODULES, USES } from "@/lib/modules";
import { COUNTRIES } from "@/lib/countries";
import { Onboarding } from "./onboarding";
import { switchWorkspaceAction } from "@/app/actions/sharing";

export const metadata: Metadata = { title: "Bienvenida", robots: { index: false, follow: false } };

export default async function WelcomePage() {
  const { user, workspace } = await requireWorkspace({ allowNotOnboarded: true });
  if (workspace.onboardedAt) redirect("/app");
  // País sugerido: el que informa Vercel según la conexión; si no, el idioma del navegador.
  const h = await headers();
  const geo = h.get("x-vercel-ip-country") ?? h.get("accept-language")?.match(/-([A-Z]{2})/)?.[1] ?? "AR";
  const detected = COUNTRIES.some((c) => c.code === geo);
  const guess = detected ? geo : "AR";
  // Si está en un espacio compartido, puede volver a ese sin armar el propio.
  const shared = user.memberships.find((m) => m.role !== "OWNER" && m.workspace.onboardedAt);
  return (
    <>
      {shared && (
        <form action={switchWorkspaceAction} className="welcome-back">
          <input type="hidden" name="workspaceId" value={shared.workspaceId} />
          <span>¿Querías volver al espacio compartido?</span>
          <button className="btn sm" type="submit">Volver al espacio compartido</button>
        </form>
      )}
      <Onboarding firstName={user.name.split(" ")[0]} uses={USES} modules={MODULES} guessCountry={guess} detected={detected} />
    </>
  );
}
