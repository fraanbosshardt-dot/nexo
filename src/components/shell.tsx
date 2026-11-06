"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "./icons";
import type { ModuleState } from "@/lib/modules";

type Item = { href: string; label: string; icon: IconName; module?: keyof ModuleState; badge?: number; match?: string };

function groups(overdue: number): [string, Item[]][] {
  return [
    ["", [{ href: "/app", label: "Inicio", icon: "home", match: "/app$" }]],
    ["Mi dinero", [
      { href: "/app/movimientos", label: "Movimientos", icon: "list" },
      { href: "/app/cuentas", label: "Cuentas", icon: "wallet" },
      { href: "/app/cereal", label: "Ventas de cereal", icon: "grain", module: "cereal" },
    ]],
    ["Pagos y deudas", [
      { href: "/app/proximos", label: "Próximos pagos", icon: "list", badge: overdue },
      { href: "/app/tarjetas", label: "Tarjetas", icon: "card", module: "tarjetas" },
      { href: "/app/deudas", label: "Deudas y préstamos", icon: "bank", module: "deudas" },
      { href: "/app/calendario", label: "Calendario", icon: "cal", module: "calendario" },
    ]],
    ["Planificar", [
      { href: "/app/flujo", label: "Flujo de caja", icon: "flow", module: "flujo" },
      { href: "/app/presupuestos", label: "Presupuestos", icon: "pie", module: "presupuestos" },
      { href: "/app/objetivos", label: "Objetivos", icon: "target", module: "objetivos" },
      { href: "/app/simulador", label: "Simulador", icon: "sliders", module: "simulador" },
    ]],
    ["Patrimonio", [
      { href: "/app/inversiones", label: "Inversiones", icon: "chart", module: "inversiones" },
      { href: "/app/patrimonio", label: "Patrimonio neto", icon: "scale", module: "inversiones" },
    ]],
    ["Análisis", [
      { href: "/app/alertas", label: "Alertas y consejos", icon: "spark", module: "alertas" },
      { href: "/app/informes", label: "Informes", icon: "file", module: "informes" },
    ]],
  ];
}
const SETTINGS: Item[] = [
  { href: "/app/configuracion", label: "Configuración", icon: "gear", match: "/app/configuracion(?!.*funciones)" },
  { href: "/app/configuracion?tab=funciones", label: "Funciones", icon: "toggle", match: "__funciones" },
  { href: "/app/categorias", label: "Categorías", icon: "tag" },
  { href: "/app/recurrentes", label: "Recurrentes", icon: "repeat", module: "reglas" },
  { href: "/app/importar", label: "Importar y exportar", icon: "db" },
  { href: "/app/ayuda", label: "Ayuda", icon: "spark" },
];

export function Shell({ children, modules, overdue, userName, plan, isAdmin, logout }: { children: React.ReactNode; modules: ModuleState; overdue: number; userName: string; plan: string; isAdmin: boolean; logout: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const isOn = (i: Item) => {
    if (i.match === "__funciones") return false;
    return i.match ? new RegExp(`^${i.match}`).test(path) : path === i.href || path.startsWith(i.href + "/");
  };
  const link = (i: Item) =>
    i.module && !modules[i.module] ? null : (
      <Link key={i.href} href={i.href} className={isOn(i) ? "on" : ""} onClick={() => setOpen(false)}>
        <Icon name={i.icon} />
        <span>{i.label}</span>
        {!!i.badge && <span className="badge">{i.badge}</span>}
      </Link>
    );
  const initials = userName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "N";
  return (
    <div className="app">
      <aside className={`side ${open ? "open" : ""}`} aria-label="Menú principal">
        <div className="brand"><div className="brand-mark">N</div><div><b>NEXO</b><small>Espacio personal</small></div></div>
        {groups(overdue).map(([g, items]) => {
          const links = items.map(link).filter(Boolean);
          return links.length ? <nav className="navg" key={g || "inicio"}>{g && <h6>{g.toUpperCase()}</h6>}{links}</nav> : null;
        })}
        <div style={{ flex: 1 }} />
        <nav className="navg"><h6>AJUSTES</h6>{SETTINGS.map(link)}</nav>
      </aside>
      <div className="main">
        <header className="top">
          <button className="ibtn menu-btn" aria-label="Abrir menú" onClick={() => setOpen(!open)}><Icon name="menu" /></button>
          <span style={{ flex: 1 }} />
          <Link className="ibtn" href="/app/movimientos/nuevo" aria-label="Nuevo movimiento"><Icon name="plus" /></Link>
          <button className="avatar" style={{ border: 0, cursor: "pointer" }} aria-label="Tu cuenta" onClick={() => setMenu(true)}>{initials}</button>
        </header>
        <main className="view">{children}</main>
      </div>
      {open && <div className="drawer-bg" onClick={() => setOpen(false)} />}
      {menu && (
        <>
          <div className="drawer-bg" onClick={() => setMenu(false)} />
          <aside className="panel" aria-label="Tu cuenta">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div className="avatar" style={{ width: 44, height: 44, fontSize: 15 }}>{initials}</div>
              <div><h2 style={{ fontSize: 17 }}>{userName}</h2><p className="sub">Plan {plan === "PRO" ? "Pro" : "Gratis"}</p></div>
            </div>
            <div className="list">
              {[...(isAdmin ? [["Panel interno (administración)", "/admin"]] : []), ["Tu plan", "/app/configuracion?tab=plan"], ["Configuración", "/app/configuracion"], ["Funciones", "/app/configuracion?tab=funciones"], ["Seguridad", "/app/configuracion?tab=seguridad"], ["Términos y condiciones", "/terminos"], ["Política de privacidad", "/privacidad"]].map(([l, h]) => (
                <Link key={h} className="li" href={h} onClick={() => setMenu(false)} style={{ textDecoration: "none", color: "inherit" }}><div className="grow">{l}</div><span className="mut">›</span></Link>
              ))}
            </div>
            <form action={logout}><button className="btn" type="submit">Cerrar sesión</button></form>
            <button className="btn ghost" onClick={() => setMenu(false)}>Cerrar</button>
          </aside>
        </>
      )}
    </div>
  );
}
