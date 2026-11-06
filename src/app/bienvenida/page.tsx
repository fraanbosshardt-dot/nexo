import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/session";
import { MODULES, USES } from "@/lib/modules";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = { title: "Bienvenida" };

export default async function WelcomePage() {
  const { user, workspace } = await requireWorkspace({ allowNotOnboarded: true });
  if (workspace.onboardedAt) redirect("/app");
  return <Onboarding firstName={user.name.split(" ")[0]} uses={USES} modules={MODULES} />;
}
