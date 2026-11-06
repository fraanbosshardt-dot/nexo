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
