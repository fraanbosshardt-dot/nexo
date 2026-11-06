import Link from "next/link";

export function PageHead({ crumb, title, desc, actions }: { crumb?: string; title: string; desc?: string; actions?: React.ReactNode }) {
  return (
    <div className="ph">
      <div>
        {crumb && <div className="crumb">{crumb}</div>}
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {actions && <div className="acts">{actions}</div>}
    </div>
  );
}

export function Tabs({ items, current }: { items: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <nav className="tabs">
      {items.map((t) => (
        <Link key={t.key} href={t.href} className={t.key === current ? "on" : ""}>{t.label}</Link>
      ))}
    </nav>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div>
      <div className="sub" style={{ margin: 0 }}>{label}</div>
      <b className={`num ${tone ?? ""}`} style={{ fontSize: 16 }}>{value}</b>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

// Pestañas de Configuración: también llevan a Categorías, Pagos que se repiten e Importar, que salieron del menú.
export function SettingsTabs({ current, rules = true }: { current: string; rules?: boolean }) {
  const items = [
    { key: "general", label: "General", href: "/app/configuracion" },
    { key: "funciones", label: "Funciones", href: "/app/configuracion?tab=funciones" },
    { key: "categorias", label: "Categorías", href: "/app/categorias" },
    ...(rules ? [{ key: "recurrentes", label: "Pagos que se repiten", href: "/app/recurrentes" }] : []),
    { key: "importar", label: "Importar y exportar", href: "/app/importar" },
    { key: "seguridad", label: "Seguridad", href: "/app/configuracion?tab=seguridad" },
    { key: "plan", label: "Plan", href: "/app/configuracion?tab=plan" },
    { key: "datos", label: "Tus datos", href: "/app/configuracion?tab=datos" },
  ];
  return <Tabs current={current} items={items} />;
}
