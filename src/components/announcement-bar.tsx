"use client";
// Aviso de novedades arriba de la app: se cierra con la × y, si no lo cerrás, se oculta solo a los 7 días de verlo
// por primera vez (en este dispositivo). Si el texto cambia, es un aviso nuevo y vuelve a aparecer.
import { useEffect, useState } from "react";
import { Icon } from "./icons";

const DAYS = 7;
const keyOf = (text: string) => { let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0; return `nexo-ann-${(h >>> 0).toString(36)}`; };

export function AnnouncementBar({ text, tone, link }: { text: string; tone: "info" | "warn"; link: string | null }) {
  const [show, setShow] = useState(false);
  const key = keyOf(text);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const st = raw ? (JSON.parse(raw) as { seen: number; closed?: boolean }) : { seen: Date.now() };
      if (!raw) localStorage.setItem(key, JSON.stringify(st));
      setShow(!st.closed && Date.now() - st.seen < DAYS * 864e5);
    } catch { setShow(true); }
  }, [key]);
  if (!show) return null;
  const close = () => { setShow(false); try { localStorage.setItem(key, JSON.stringify({ seen: Date.now(), closed: true })); } catch { /* sin almacenamiento */ } };
  return (
    <div className={`notice ${tone === "warn" ? "a" : "b"} app-ann ann-bar`} role="status">
      <Icon name={tone === "warn" ? "info" : "spark"} />
      <span>{text}{link && <> <a className="lnk" href={link}>Ver más</a></>}</span>
      <button type="button" className="ann-x" aria-label="Cerrar el aviso" onClick={close}>×</button>
    </div>
  );
}
