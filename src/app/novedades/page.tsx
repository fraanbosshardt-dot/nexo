import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Novedades",
  description: "Todo lo nuevo de Guafra, mes a mes: funciones que se suman, mejoras en el celular y cambios que nos pidieron quienes la usan todos los días.",
  alternates: { canonical: "/novedades" },
};
export const revalidate = 300;

export default async function News() {
  const news = await getDb().productNews.findMany({ orderBy: { publishedAt: "desc" }, take: 50 });
  return (
    <PublicShell>
      <section className="ws-hero">
        <div className="ws-w">
          <p className="ws-eyebrow">Novedades</p>
          <h1 className="ws-h1">Lo nuevo, <em>mes a mes.</em></h1>
          <p className="ws-lead">Funciones que se suman y mejoras que nos pidieron quienes la usan todos los días.</p>
        </div>
      </section>
      <section className="ws-w news-w" style={{ paddingBottom: "clamp(64px,8vw,112px)" }}>
        <div style={{ maxWidth: 820 }}>
        {news.length ? news.map((n) => (
          <article key={n.id} className="news-item">
            <time dateTime={n.publishedAt.toISOString()}>{fmtDate(n.publishedAt)}</time>
            <h2>{n.title}</h2>
            <p>{n.body}</p>
          </article>
        )) : (
          <div className="news-empty">
            <span className="news-empty-ic" aria-hidden="true">✦</span>
            <div><b>Todavía no publicamos novedades.</b><p>Cuando sumemos algo nuevo a Guafra, lo vas a ver acá primero.</p></div>
          </div>
        )}
        </div>
      </section>
    </PublicShell>
  );
}
