import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/session";
import { MODULES, USES } from "@/lib/modules";
import { COUNTRIES } from "@/lib/countries";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = { title: "Bienvenida" };

export default async function WelcomePage() {
  const { user, workspace } = await requireWorkspace({ allowNotOnboarded: true });
  if (workspace.onboardedAt) redirect("/app");
  // País sugerido: el que informa Vercel según la conexión; si no, el idioma del navegador.
  const h = await headers();
  const geo = h.get("x-vercel-ip-country") ?? h.get("accept-language")?.match(/-([A-Z]{2})/)?.[1] ?? "AR";
  const detected = COUNTRIES.some((c) => c.code === geo);
  const guess = detected ? geo : "AR";
  return <Onboarding firstName={user.name.split(" ")[0]} uses={USES} modules={MODULES} guessCountry={guess} detected={detected} />;
}
