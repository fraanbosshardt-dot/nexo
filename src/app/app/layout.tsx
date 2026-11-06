import { Shell } from "@/components/shell";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { logoutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, modules, plan } = await requireWorkspace();
  const overdue = await getDb().obligation.count({
    where: { workspaceId: workspace.id, status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: todayIn(workspace.timezone) } },
  });
  return (
    <Shell modules={modules} overdue={overdue} userName={user.name} plan={plan} logout={logoutAction}>
      {children}
    </Shell>
  );
}
