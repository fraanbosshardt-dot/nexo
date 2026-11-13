import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { can, ROLE_NAMES, type Perm } from "@/server/admin-team";
import { adminLogoutAction } from "@/app/actions/admin";
import { AdminNav } from "./nav";
import { LogoMark } from "@/components/logo-mark";

export const metadata: Metadata = { title: { default: "Panel interno", template: "%s · Panel Guafra" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const SECTIONS: { href: string; label: string; icon: string; perm: Perm }[] = [
  { href: "/admin", label: "Resumen", icon: "chart", perm: "view" },
  { href: "/admin/usuarios", label: "Clientes", icon: "user", perm: "view" },
  { href: "/admin/cobros", label: "Cobros y cupones", icon: "card", perm: "view" },
  { href: "/admin/soporte", label: "Soporte", icon: "help", perm: "view" },
  { href: "/admin/consultas", label: "Consultas del sitio", icon: "info", perm: "view" },
  { href: "/admin/comunicaciones", label: "Comunicaciones", icon: "bell", perm: "view" },
  { href: "/admin/finanzas", label: "Finanzas", icon: "wallet", perm: "owner" },
  { href: "/admin/sistema", label: "Sistema y seguridad", icon: "shield", perm: "view" },
  { href: "/admin/actividad", label: "Actividad", icon: "clock", perm: "view" },
  { href: "/admin/equipo", label: "Equipo", icon: "lock", perm: "owner" },
  { href: "/admin/ajustes", label: "Ajustes", icon: "gear", perm: "owner" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const items = SECTIONS.filter((s) => can(admin.role, s.perm)).map(({ href, label, icon }) => ({ href, label, icon }));
  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-bar">
          <Link href="/admin" className="brand" style={{ textDecoration: "none" }}><LogoMark /><b className="wordmark">guafra</b></Link>
          <span className="pill b">Panel interno</span>
          <span style={{ flex: 1 }} />
          <span className="adm-who"><b>{admin.name ?? admin.email}</b><small>{admin.email} · {ROLE_NAMES[admin.role]}</small></span>
          <form action={adminLogoutAction}><button className="btn sm" type="submit">Salir</button></form>
        </div>
      </header>
      <div className="adm-wrap">
        <AdminNav items={items} />
        <main className="adm-main">{children}</main>
      </div>
    </div>
  );
}
