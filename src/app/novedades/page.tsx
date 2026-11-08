import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Novedades",
  description: "Lo nuevo de NEXO, la app para ordenar tu plata mes a mes.",
  alternates: { canonical: "/novedades" },
};
export const revalidate = 300;

export default async function News() {
  const news = await getDb().productNews.findMany({ orderBy: { publishedAt: "desc" }, take: 50 });
  return (
    <PublicShell>
      <section className="lp-w" style={{ paddingBlock: "48px 72px", maxWidth: 760 }}>
        <h1 style={{ fontWeight: 400, fontSize: 36, margin: "0 0 8px" }}>Novedades</h1>
        <p className="sub" style={{ margin: "0 0 32px" }}>Lo que fuimos sumando a NEXO.</p>
        {news.length ? news.map((n) => (
          <article key={n.id} className="news-item">
            <time dateTime={n.publishedAt.toISOString()}>{fmtDate(n.publishedAt)}</time>
            <h2>{n.title}</h2>
            <p>{n.body}</p>
          </article>
        )) : <p className="sub">Pronto vas a ver acá lo nuevo.</p>}
      </section>
    </PublicShell>
  );
}
