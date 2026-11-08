"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

// Menú del panel: a la izquierda en la computadora, una fila que se desliza en el celular.
export function AdminNav({ items }: { items: { href: string; label: string; icon: string }[] }) {
  const path = usePathname();
  const on = (h: string) => (h === "/admin" ? path === "/admin" : path.startsWith(h));
  return (
    <nav className="adm-nav" aria-label="Secciones del panel">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={on(i.href) ? "on" : ""} aria-current={on(i.href) ? "page" : undefined}>
          <Icon name={i.icon as never} /><span>{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}
