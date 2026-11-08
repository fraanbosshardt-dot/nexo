"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SavedToast } from "./saved-toast";
import { Icon, type IconName } from "./icons";
import type { ModuleState } from "@/lib/modules";
import { QuickAdd, openQuickAdd } from "@/components/quick-add";
import { BigTextToggle } from "@/components/big-text";

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
      { href: "/app/proximos", label: "Próximos pagos", icon: "clock", badge: overdue, match: "/app/(proximos|calendario)" },
      { href: "/app/tarjetas", label: "Tarjetas", icon: "card", module: "tarjetas" },
      { href: "/app/deudas", label: "Deudas y préstamos", icon: "bank", module: "deudas" },
    ]],
    ["Planificar", [
      { href: "/app/flujo", label: "Flujo de caja", icon: "flow", module: "flujo" },
      { href: "/app/presupuestos", label: "Presupuestos", icon: "pie", module: "presupuestos" },
      { href: "/app/objetivos", label: "Objetivos", icon: "target", module: "objetivos" },
      { href: "/app/simulador", label: "Simulador", icon: "sliders", module: "simulador" },
    ]],
    ["Patrimonio", [
      { href: "/app/patrimonio", label: "Inversiones y patrimonio", icon: "scale", module: "inversiones", match: "/app/(patrimonio|inversiones)" },
    ]],
    ["Análisis", [
      { href: "/app/alertas", label: "Alertas y consejos", icon: "bell", module: "alertas" },
      { href: "/app/informes", label: "Informes", icon: "file", module: "informes" },
    ]],
  ];
}
const SETTINGS: Item[] = [
  { href: "/app/configuracion", label: "Configuración", icon: "gear", match: "/app/(configuracion|categorias|recurrentes|importar)" },
  { href: "/app/ayuda", label: "Ayuda", icon: "help" },
];

const Mark = () => <span className="brand-mark">N</span>;

export function Shell({ children, modules, overdue, userName, plan, isAdmin, logout }: { children: React.ReactNode; modules: ModuleState; overdue: number; userName: string; plan: string; isAdmin: boolean; logout: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  // Esc cierra el menú del celular y el de tu cuenta; al abrir el de tu cuenta, el foco va adentro.
  useEffect(() => {
    if (!open && !menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setMenu(false); } };
    window.addEventListener("keydown", onKey);
    if (menu) setTimeout(() => (document.querySelector(".panel a, .panel button") as HTMLElement | null)?.focus(), 0);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, menu]);
  const isOn = (i: Item) => {
    if (i.match === "__funciones") return false;
    return i.match ? new RegExp(`^${i.match}`).test(path) : path === i.href || path.startsWith(i.href + "/");
  };
  const link = (i: Item) =>
    i.module && !modules[i.module] ? null : (
      <Link key={i.href} href={i.href} className={isOn(i) ? "on" : ""} onClick={() => setOpen(false)}>
        <Icon name={i.icon} />
        <span>{i.label}</span>
        {!!i.badge && <span className="badge" aria-label={`${i.badge} atrasados`}>{i.badge}</span>}
      </Link>
    );
  const initials = userName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "N";
  const tab = (href: string, label: string, icon: IconName, exact = false) => {
    const on = exact ? path === href : path === href || path.startsWith(href + "/");
    return <Link href={href} className={on ? "on" : ""}><Icon name={icon} />{label}</Link>;
  };
  return (
    <div className="app">
      <header className="top">
        <button className="ibtn menu-btn" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="menu" /></button>
        <Link href="/app" className="brand" aria-label="NEXO, ir al inicio"><Mark /><b>NEXO</b></Link>
        <form action="/app/buscar" className="search top-search" role="search"><input name="q" placeholder="Buscar movimientos, cuentas, categorías…" aria-label="Buscar" /></form>
        <span style={{ flex: 1 }} />
        <Link className="ibtn top-search-btn" href="/app/buscar" aria-label="Buscar"><Icon name="search" /></Link>
        <Link href="/app/movimientos/nuevo" className="btn pri top-new"><Icon name="plus" />Nuevo movimiento</Link>
        {modules.alertas && <Link className="ibtn" href="/app/alertas" aria-label="Alertas"><Icon name="bell" />{overdue > 0 && <span className="dot" />}</Link>}
        <Link className="ibtn" href="/app/ayuda" aria-label="Ayuda"><Icon name="help" /></Link>
        <Link className="ibtn" href="/app/configuracion" aria-label="Configuración"><Icon name="gear" /></Link>
        <button className="avatar" style={{ border: 0, cursor: "pointer" }} aria-label="Tu cuenta" aria-haspopup="dialog" aria-expanded={menu} title={userName} onClick={() => setMenu(true)}>{initials}</button>
      </header>
      <aside className={`side ${open ? "open" : ""}`} aria-label="Menú principal">
        <Link href="/app" className="brand" onClick={() => setOpen(false)}><Mark /><b>NEXO</b></Link>
        {groups(overdue).map(([g, items]) => {
          const links = items.map(link).filter(Boolean);
          return links.length ? <nav className="navg" key={g || "inicio"}>{g && <h6>{g}</h6>}{links}</nav> : null;
        })}
        <nav className="navg"><h6>Ajustes</h6>{SETTINGS.map(link)}{isAdmin && link({ href: "/admin", label: "Panel interno", icon: "shield" })}</nav>
        <div className="side-big m-only"><BigTextToggle compact /></div>
      </aside>
      <div className="main">
        <main className="view">{children}</main>
        <Suspense fallback={null}><SavedToast /></Suspense>
        <QuickAdd />
      </div>
      <nav className="tabbar" aria-label="Accesos rápidos">
        {tab("/app", "Inicio", "home", true)}
        {tab("/app/movimientos", "Movimientos", "list")}
        <button type="button" className="plus" aria-label="Cargar un movimiento" onClick={() => openQuickAdd("EXPENSE")}><span><Icon name="plus" /></span></button>
        {tab("/app/proximos", "Próximos", "clock")}
        <button onClick={() => setOpen(true)} aria-expanded={open}><Icon name="menu" />Más</button>
      </nav>
      {open && <div className="drawer-bg" onClick={() => setOpen(false)} />}
      {menu && (
        <>
          <div className="drawer-bg" onClick={() => setMenu(false)} />
          <aside className="panel" role="dialog" aria-modal="true" aria-label="Tu cuenta">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div className="avatar" style={{ width: 44, height: 44, fontSize: 16, margin: 0 }}>{initials}</div>
              <div><h2>{userName}</h2><p className="sub" style={{ margin: 0, color: "var(--muted)" }}>Plan {plan === "PRO" ? "Pro" : "Gratis"}</p></div>
            </div>
            <div className="list">
              {[...(isAdmin ? [["Panel interno", "/admin"]] : []), ["Tu plan", "/app/configuracion?tab=plan"], ["Configuración", "/app/configuracion"]].map(([l, h]) => (
                <Link key={h} className="li" href={h} onClick={() => setMenu(false)} style={{ textDecoration: "none", color: "inherit" }}><div className="grow">{l}</div><span className="mut">›</span></Link>
              ))}
            </div>
            <div className="acts">
              <form action={logout}><button className="btn" type="submit">Cerrar sesión</button></form>
              <button className="btn ghost" onClick={() => setMenu(false)}>Cerrar</button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
