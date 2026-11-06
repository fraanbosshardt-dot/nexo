import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { PageHead } from "@/components/page";

// Secciones que se construyen en las próximas fases. Se muestran para que el menú esté completo.
const SECTIONS: Record<string, { title: string; crumb: string; phase: number; text: string }> = {
  tarjetas: { title: "Tarjetas de crédito", crumb: "Pagos y deudas", phase: 4, text: "Resúmenes, pago mínimo y compras en cuotas que se reparten solas en los próximos meses." },
  deudas: { title: "Deudas y préstamos", crumb: "Pagos y deudas", phase: 4, text: "Cronograma de cuotas con sistema francés, alemán o americano, tasas opcionales y cancelación total." },
  flujo: { title: "Flujo de caja", crumb: "Planificar", phase: 3, text: "Cuánto entra, cuánto sale y con cuánto terminás cada mes, con los pendientes y las reglas recurrentes." },
  presupuestos: { title: "Presupuestos", crumb: "Planificar", phase: 5, text: "Límites por categoría con lo gastado y lo comprometido del mes." },
  objetivos: { title: "Objetivos de ahorro", crumb: "Planificar", phase: 5, text: "Metas con el aporte mensual que necesitás para llegar a tiempo." },
  simulador: { title: "Simulador", crumb: "Planificar", phase: 5, text: "Escenarios Base, Optimista, Pesimista y Personalizado sin tocar tus datos reales." },
  inversiones: { title: "Inversiones", crumb: "Patrimonio", phase: 6, text: "Plazos fijos, fondos, CEDEARs, bonos y cripto, con capital invertido y rendimiento." },
  patrimonio: { title: "Patrimonio neto", crumb: "Patrimonio", phase: 6, text: "Todo lo que tenés menos todo lo que debés, con su evolución." },
  alertas: { title: "Alertas y consejos", crumb: "Análisis", phase: 7, text: "Avisos de meses en rojo, deudas caras y vencimientos acumulados." },
  informes: { title: "Informes", crumb: "Análisis", phase: 7, text: "Reportes guardados y exportación a CSV, Excel y PDF." },
  recurrentes: { title: "Reglas recurrentes", crumb: "Ajustes", phase: 3, text: "Sueldos, servicios y cuotas que se repiten solos, sin duplicar al regenerar." },
  importar: { title: "Importar y exportar", crumb: "Ajustes", phase: 7, text: "Traer planillas, extractos y bases de datos como un lote que se puede revertir." },
  cereal: { title: "Ventas de cereal", crumb: "Mi dinero", phase: 6, text: "Quintales, precio por tonelada e impuesto al cheque; cada venta suma su neto a tus ingresos." },
};

export async function generateMetadata({ params }: { params: Promise<{ seccion: string }> }): Promise<Metadata> {
  return { title: SECTIONS[(await params).seccion]?.title ?? "NEXO" };
}

export default async function Coming({ params }: { params: Promise<{ seccion: string }> }) {
  await requireWorkspace();
  const s = SECTIONS[(await params).seccion];
  if (!s) notFound();
  return (
    <>
      <PageHead crumb={s.crumb} title={s.title} />
      <div className="card hero">
        <div><div className="lbl">Próximamente · Fase {s.phase}</div><p style={{ fontSize: 16, maxWidth: "52ch", margin: "8px 0 14px" }}>{s.text}</p>
          <div className="acts"><Link className="btn" href="/prototipo.html" target="_blank">Ver cómo va a quedar en el prototipo</Link></div></div>
        <div className="hero-side"><div className="hrow"><span>Ya podés usar</span><b>Cuentas, movimientos y pendientes</b></div><div className="hrow"><span>Esta sección</span><b>Fase {s.phase}</b></div></div>
      </div>
    </>
  );
}
