import Link from "next/link";
import { Reveal } from "@/components/landing-fx";
import { CuotasDemo, DemoTabs, PriceSwitch, QuedaDemo } from "@/components/landing-demo";
import { LandingSky } from "@/components/landing-sky";
import { MonthStory } from "@/components/landing-month";
import { LandingMotion } from "@/components/landing-motion";
import { Showcase } from "@/components/landing-show";
import { PublicShell } from "@/components/public-shell";
import { AppCta } from "@/components/app-cta";
import { PLAN_FEATURES } from "@/lib/modules";
import { getDb } from "@/lib/db";
import { planSettings, priceLabel, PRICES_DEFAULT } from "@/server/plans";
import { jsonLd, SITE } from "@/lib/seo";
import { BRAND } from "@/lib/brand";

// Se sirve desde caché y se renueva sola cada 10 minutos: abre al instante.
export const revalidate = 600;

const N = BRAND.name;
const svg = (d: string, extra?: React.ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} />{extra}</svg>;
const CHECK = svg("M5 12l5 5L20 7");


const STRIP = ["Pesos y dólares", "Tarjetas en cuotas", "Préstamos", "Servicios y alquiler", "Sueldo o cobros variables", "Ventas de cereal", "Objetivos de ahorro"];

// Planilla, app del banco y Guafra (la última columna siempre es "sí").
const VS: [string, string, string, string][] = [
  ["Todas tus cuentas y tarjetas juntas", "A mano", "Solo las de ese banco", "Sí"],
  ["Cuotas repartidas mes a mes", "A mano", "Solo esa tarjeta", "Solas"],
  ["Cuánto podés gastar hasta el cobro", "No", "No", "Sí"],
  ["Avisos antes de que un mes quede en rojo", "No", "No", "Sí"],
  ["Cómo vienen los próximos meses", "Con fórmulas", "No", "Sí"],
  ["Pesos y dólares juntos", "Con fórmulas", "Por separado", "Sí"],
];
const SAFE: [React.ReactNode, string, string][] = [
  [svg("M6 10V7a6 6 0 0 1 12 0v3M5 10h14v11H5z"), "Sin claves del banco", "No nos conectamos a tu banco ni te pedimos sus contraseñas. Nunca."],
  [svg("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4"), "Verificación en dos pasos", "Sumá un código del celular a tu contraseña, o ingresá con Google."],
  [svg("M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16"), "Conexión cifrada", "Todo viaja cifrado y cada acceso del equipo queda registrado."],
  [svg("M12 3v12M7 10l5 5 5-5M5 21h14"), "Tus datos son tuyos", "Descargalos o borrá tu cuenta cuando quieras. No los vendemos."],
];
const FAQ: [string, string][] = [
  [`¿${N} se conecta con mi banco?`, "No. Cargás tus saldos y movimientos, importás un CSV o subís el resumen en PDF. Nunca te pedimos la contraseña de tu banco."],
  ["¿Es gratis de verdad?", "Sí. El plan Gratis incluye casi todo, no vence y no pide tarjeta. Pro suma funciones avanzadas y lo probás 14 días gratis."],
  ["¿Sirve si mis ingresos cambian todos los meses?", "Sí. Cargás un monto estimado y, cuando cobrás, ponés lo que realmente entró y la fecha."],
  ["¿Las compras con tarjeta se cuentan dos veces?", "No. La compra es el gasto. Pagar el resumen es pasar plata de tu cuenta a la tarjeta, así que no suma otra vez."],
  ["¿Puedo usarlo en el celular?", "Sí. Funciona en cualquier navegador y se instala como app en la pantalla de inicio, sin pasar por la tienda."],
  ["¿Sirve en mi país y con mi moneda?", "Sí. Elegís tu país y tu moneda al registrarte, y podés usar pesos y dólares a la vez. La cotización se actualiza sola."],
  ["¿Puedo invitar a alguien?", "Sí. Desde Configuración → Plan copiás tu link. Cuando la otra persona se registra y termina la bienvenida, los dos reciben un mes de Pro."],
  ["¿Cómo cancelo Pro?", "Desde Configuración, cuando quieras. Dentro de los 10 días de contratarlo te devolvemos todo."],
];

const TOUR = [
  { tag: "Inicio", title: "Tu número del día", text: "Apenas abrís la app ves cuánto podés gastar hasta tu próximo cobro y cuánto te queda por día." },
  { tag: "Tarjetas", title: "Las cuotas, en su mes", text: "Cada compra en cuotas se reparte sola. Ves cuánto te llega en cada resumen, sin sumar a mano." },
  { tag: "Próximos pagos", title: "Lo que vence, por fecha", text: "Atrasado, esta semana y los meses que vienen. Pagás o cobrás con un toque y se descuenta solo." },
  { tag: "Flujo de caja", title: "Cómo terminan los próximos meses", text: "Lo que entra, lo que sale y lo comprometido, mes por mes. Si alguno va a quedar en rojo, te avisa antes." },
];

function ScreenHome() {
  return (<div className="lx-pane">
    <div className="lx-hi"><div><small>Lunes 9 de noviembre</small><b>Hola, Martín</b></div><span>M</span></div>
    <div className="lx-hero-card"><small>Te queda hasta tu cobro del 1 de dic.</small><b>$ 184.250</b><small>Podés gastar $ 8.010 por día</small><i><i /></i></div>
    <div className="lx-list"><b>Esta semana</b>
      <div><span><b>12</b>nov</span><span>Visa · cuota 3 de 12</span><b className="n">−$ 48.300</b></div>
      <div><span><b>15</b>nov</span><span>Alquiler</span><b className="n">−$ 420.000</b></div>
    </div>
  </div>);
}
function ScreenCards() {
  return (<div className="lx-pane">
    <div className="lx-hi"><div><small>Tarjetas</small><b>Visa · cierra el 5</b></div><span>V</span></div>
    <div className="lx-card-vis"><small>Próximo resumen</small><b>$ 312.480</b><small>Vence el 12 de diciembre</small></div>
    <div className="lx-list"><b>Cuotas que vienen</b>
      <div><span><b>3/12</b></span><span>Heladera</span><b>$ 48.300</b></div>
      <div><span><b>2/6</b></span><span>Zapatillas</span><b>$ 21.500</b></div>
      <div><span><b>5/18</b></span><span>Celular</span><b>$ 39.900</b></div>
    </div>
  </div>);
}
function ScreenNext() {
  return (<div className="lx-pane">
    <div className="lx-hi"><div><small>Pagos y deudas</small><b>Próximos pagos</b></div><span>P</span></div>
    <div className="lx-list"><b className="lx-red">Atrasado</b>
      <div><span><b>3</b>nov</span><span>Luz</span><b className="n">−$ 38.900</b></div>
    </div>
    <div className="lx-list"><b>Esta semana</b>
      <div><span><b>12</b>nov</span><span>Visa</span><b className="n">−$ 312.480</b></div>
      <div><span><b>15</b>nov</span><span>Alquiler</span><b className="n">−$ 420.000</b></div>
    </div>
    <div className="lx-list"><b>Diciembre</b>
      <div><span><b>1</b>dic</span><span>Sueldo</span><b className="p">+$ 1.250.000</b></div>
    </div>
  </div>);
}
function ScreenFlow() {
  const m: [string, number, boolean][] = [["nov", 46, false], ["dic", 72, false], ["ene", 30, true], ["feb", 58, false], ["mar", 64, false], ["abr", 80, false]];
  return (<div className="lx-pane">
    <div className="lx-hi"><div><small>Proyección</small><b>Flujo de caja</b></div><span>F</span></div>
    <div className="lx-flow">
      <div className="lx-flow-bars">{m.map(([l, h, r]) => <span key={l}><i className={r ? "r" : ""} style={{ height: `${h}%` }} /><small>{l}</small></span>)}</div>
      <div className="lx-flow-alert"><b>Enero viene justo</b><small>Te faltarían $ 62.000. Mirá qué podés mover.</small></div>
    </div>
  </div>);
}

function Phone() {
  return (
    <div className="lx-phone-wrap">
      <span className="lx-halo" aria-hidden="true" />
      <div className="lx-phone" role="img" aria-label={`La pantalla de Inicio de ${N} en un celular, con datos de ejemplo`}>
        <div className="lx-screen">
          <div className="lx-notch"><span /></div>
          <div className="lx-hi"><div><small>Lunes 9 de noviembre</small><b>Hola, Martín</b></div><span>M</span></div>
          <div className="lx-hero-card">
            <small>Te queda hasta tu cobro del 1 de dic.</small>
            <b data-count="184250" data-prefix="$ ">$ 184.250</b>
            <small>Podés gastar $ 8.010 por día</small>
            <i><i /></i>
          </div>
          <div className="lx-quick">{[["−", "Gasto"], ["+", "Ingreso"], ["⇄", "Pasar"], ["▤", "Cuotas"]].map(([s, l]) => <span key={l}><em>{s}</em>{l}</span>)}</div>
          <div className="lx-list">
            <b>Próximos pagos</b>
            {[["12", "nov", "Visa · cuota 3 de 12", "−$ 48.300", "n"], ["15", "nov", "Alquiler", "−$ 420.000", "n"], ["1", "dic", "Sueldo", "+$ 1.250.000", "p"]].map(([d, m, t, v, c]) => (
              <div key={t}><span><b>{d}</b>{m}</span><span>{t}</span><b className={c}>{v}</b></div>
            ))}
          </div>
          <div className="lx-tabs"><span className="on">Inicio</span><span>Movimientos</span><span>Pagos</span><span>Más</span></div>
        </div>
      </div>
      <div className="lx-float a" aria-hidden="true"><span className="w">!</span><span><b>Vence en 3 días</b><small>Visa · $ 48.300</small></span></div>
      <div className="lx-float b" aria-hidden="true"><span className="g">{svg("M12 21V9M12 9c0-3 2-5 6-5 0 4-2 6-6 6zM12 13c0-3-2-5-6-5 0 4 2 6 6 6z")}</span><span><b>Venta de soja · por cobrar</b><small className="p">+$ 2.450.000 · 10 dic</small></span></div>
    </div>
  );
}

export default async function Landing() {
  const ps = await planSettings(getDb()).catch(() => ({ prices: PRICES_DEFAULT, pricesArs: null }));
  const pm = priceLabel(ps, "monthly"), py = priceLabel(ps, "yearly");
  const free = PLAN_FEATURES.filter((f) => f.plan === "free");
  const pro = PLAN_FEATURES.filter((f) => f.plan === "pro");
  const plans = (price: string, period: string) => (
    <div className="lx-plans">
      <div className="lx-plan" style={{ "--i": 0 } as React.CSSProperties}>
        <div><h3>Gratis</h3><p>Para ordenar tu plata del día a día.</p></div>
        <div className="lx-price"><b>$ 0</b><span>para siempre</span></div>
        <Link className="ws-btn" href="/registro">Crear cuenta gratis</Link>
        <ul>{free.map((f) => <li key={f.name}>{CHECK}{f.name}</li>)}</ul>
      </div>
      <div className="lx-plan pro" style={{ "--i": 1 } as React.CSSProperties}>
        <span className="lx-reco">Recomendado</span>
        <div><h3>Pro</h3><p>Para planificar todo el año.</p></div>
        <div className="lx-price"><b>{price}</b><span>por {period}</span></div>
        <a className="ws-btn pri lx-shine" href="/suscribirme?ciclo=mensual">Suscribirme a Pro</a>
        <a className="lx-link" href="/suscribirme?ciclo=anual" style={{ textAlign: "center", fontSize: 14 }}>o pagá el año: {py.text}</a>
        <ul><li>{CHECK}Todo lo de Gratis</li>{pro.map((f) => <li key={f.name}>{CHECK}<span>{f.name}{f.beta && <> <span className="lx-beta">Beta</span></>}</span></li>)}</ul>
      </div>
    </div>
  );
  const ld = [
    { "@context": "https://schema.org", "@type": "Organization", name: N, url: SITE.url, logo: `${SITE.url}/icon.svg`, founder: { "@type": "Person", name: BRAND.owner }, taxID: BRAND.cuit, contactPoint: { "@type": "ContactPoint", contactType: "customer support", url: `${SITE.url}/contacto`, availableLanguage: "es" } },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: N, url: SITE.url, applicationCategory: "FinanceApplication", operatingSystem: "Web, Android, iOS", inLanguage: "es", description: SITE.description,
      offers: [{ "@type": "Offer", name: "Gratis", price: "0", priceCurrency: "USD" }, { "@type": "Offer", name: "Pro", price: String(pm.amount), priceCurrency: pm.currency }] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ];
  return (
    // Igual para todos (sale de caché); "Ir a la app" se decide en el navegador.
    <PublicShell>
      <LandingMotion />
      {ld.map((d, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={jsonLd(d)} />)}

      {/* Portada: fondo animado y desenfocado (hecho con código), título grande y el celular que asoma abajo */}
      <section className="lx-top lx-dark">
        <LandingSky />
        <div className="ws-w lx-hero lx-hero-c">
          <div className="lx-copy">
            <a className="lx-news" href="#agro"><span>Nuevo</span>Ventas de cereal mes a mes, proyectadas<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg></a>
            <h1 className="ws-h1 lx-h1"><span className="lx-line">Sabé cuánto podés gastar</span> <em className="lx-line">hasta tu próximo cobro.</em></h1>
            <p className="ws-lead">Tus cuentas, tarjetas en cuotas, deudas y vencimientos en un solo lugar, en pesos y en dólares. {N} te dice hoy con cuánta plata llegás a fin de mes.</p>
            <div className="lx-ctas">
              <AppCta className="ws-btn pri lx-big lx-shine" label="Empezar gratis" />
              <a className="ws-btn lx-big lx-ghost" href="#demo">Probalo sin registrarte</a>
            </div>
            <ul className="lx-trust"><li>{CHECK}Gratis para siempre</li><li>{CHECK}Sin tarjeta</li><li>{CHECK}Nunca te pedimos la clave del banco</li></ul>
          </div>
          <Phone />
        </div>
      </section>

      <section className="lx-strip" aria-label="Qué podés ordenar">
        <div className="ws-w"><div className="lx-strip-track">
          <span>Todo en un lugar:</span>{STRIP.map((t) => <em key={t}>{t}</em>)}
          <span className="dup" aria-hidden="true">Todo en un lugar:</span>{STRIP.map((t) => <em key={"d" + t} className="dup" aria-hidden="true">{t}</em>)}
        </div></div>
      </section>

      {/* Funciones: una tarjeta grande con la app desenfocada atrás */}
      <section className="ws-w ws-sec" id="funciones">
        <Reveal className="ws-head c"><p className="ws-eyebrow">Funciones</p><h2 className="ws-h2">Todo lo que hoy anotás a mano, pero que se calcula solo.</h2></Reveal>
        <Showcase items={TOUR} screens={[<ScreenHome key="h" />, <ScreenCards key="c" />, <ScreenNext key="n" />, <ScreenFlow key="f" />]} />
      </section>

      {/* Un mes con Guafra: se cuenta mientras bajás */}
      <section className="lx-month-sec" id="como">
        <div className="ws-w ws-sec">
          <Reveal className="ws-head"><p className="ws-eyebrow">Un mes con {N}</p><h2 className="ws-h2">Del cobro al próximo cobro, sin sorpresas.</h2><p className="ws-lead">Bajá y mirá cómo te acompaña durante un mes. Datos de ejemplo.</p></Reveal>
          <MonthStory />
        </div>
      </section>

      {/* Demo */}
      <section className="lx-demo-sec" id="demo">
        <div className="ws-w ws-sec lx-two">
          <Reveal className="lx-two-copy"><p className="ws-eyebrow">Probalo ahora</p><h2 className="ws-h2">¿Cuánto te queda? ¿Te alcanza en cuotas?</h2><p className="ws-lead">Mové los valores y mirá la respuesta al instante. Sin registrarte. En {N} estas cuentas se hacen solas con tus datos reales.</p></Reveal>
          <DemoTabs titles={["¿Cuánto te queda?", "¿Te alcanza en cuotas?"]}>{[<QuedaDemo key="q" />, <CuotasDemo key="c" />]}</DemoTabs>
        </div>
      </section>

      {/* Planilla vs Guafra */}
      <section className="ws-soft">
        <div className="ws-w ws-sec lx-two">
          <Reveal className="lx-two-copy"><p className="ws-eyebrow">Por qué {N}</p><h2 className="ws-h2">La planilla te muestra el pasado. {N} te muestra lo que viene.</h2><p className="ws-lead">Una planilla depende de que te acuerdes de todo, y la app del banco solo ve lo suyo. {N} junta todo, repite tus pagos fijos, reparte las cuotas y te avisa antes de que un mes quede en rojo.</p></Reveal>
          <Reveal className="lx-vs">
            <table>
              <thead><tr><th scope="col"><span className="sr-only">Qué</span></th><th scope="col">Planilla</th><th scope="col">App del banco</th><th scope="col">{N}</th></tr></thead>
              <tbody>{VS.map(([t, x, b, g], i) => <tr key={t} style={{ "--r": i } as React.CSSProperties}><th scope="row">{t}</th><td>{x}</td><td>{b}</td><td><span className="lx-yes"><svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength={1} d="M5 12l5 5L20 7" /></svg>{g}</span></td></tr>)}</tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* Para el campo */}
      <section className="ws-navy" id="agro">
        <div className="ws-w ws-sec lx-two">
          <Reveal className="lx-two-copy">
            <p className="ws-eyebrow">Para el campo · Pro</p>
            <h2 className="ws-h2">Si vendés cereal todos los meses, {N} ya lo cuenta.</h2>
            <p className="ws-lead">Cargás cuánto pensás vender por mes y lo ves proyectado en tu flujo de caja, aunque todavía no lo hayas cobrado. Cuando liquidás, ponés el monto real.</p>
            <Link className="lx-link" style={{ color: "#8EC4A0" }} href="/productores">Ver todo para productores →</Link>
            <ul className="lx-ticks">
              <li>{CHECK}Ventas de soja, maíz, trigo o girasol, mes a mes</li>
              <li>{CHECK}Lo que está por cobrar suma en lo proyectado</li>
              <li>{CHECK}Gasoil, insumos y arrendamientos junto con los gastos de tu casa</li>
            </ul>
          </Reveal>
          <Reveal className="lx-grain">
            <div className="lx-grain-h"><b>Ventas de cereal</b><small>Datos de ejemplo</small></div>
            {[["10", "nov", "Soja · 70 t", "Cobrado", "+$ 2.380.000", "ok"], ["10", "dic", "Soja · 72 t", "Por cobrar · proyectado", "+$ 2.450.000", "wait"], ["10", "ene", "Maíz · 110 t", "Por cobrar · proyectado", "+$ 2.090.000", "wait"]].map(([d, m, t, s, v, k], i) => (
              <div key={t + m} className={`lx-grain-r ${k}`} style={{ "--r": i } as React.CSSProperties}><span><b>{d}</b>{m}</span><span><b>{t}</b><small>{k === "wait" && <i className="lx-dot" aria-hidden="true" />}{s}</small></span><b>{v}</b></div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Seguridad */}
      <section className="ws-w ws-sec" id="seguridad">
        <div className="lx-sec-head">
          <Reveal className="ws-head" ><p className="ws-eyebrow">Seguridad</p><h2 className="ws-h2">Tus datos, cuidados como corresponde.</h2></Reveal>
          <Link className="lx-link" href="/seguridad">Cómo protegemos tu información →</Link>
        </div>
        <div className="ws-grid">{SAFE.map(([ic, t, d], i) => <Reveal key={t} className="ws-card" tilt style={{ "--i": i } as React.CSSProperties}><span className="ws-ic">{ic}</span><h3>{t}</h3><p>{d}</p></Reveal>)}</div>
      </section>

      {/* Precios */}
      <section className="ws-soft" id="planes">
        <div className="ws-w ws-sec lx-pricing">
          <Reveal className="ws-head c"><p className="ws-eyebrow">Precios</p><h2 className="ws-h2">Empezá gratis. Pasate a Pro cuando lo necesites.</h2></Reveal>
          <PriceSwitch monthly={plans(pm.text, "mes")} yearly={plans(py.text, "año")} />
          <p className="ws-fine" style={{ textAlign: "center" }}>Beta: ya se puede usar y la seguimos mejorando, sin costo extra. Cancelás cuando quieras y tenés 10 días para arrepentirte con <Link href="/reembolsos">devolución total</Link>.</p>
        </div>
      </section>

      {/* Preguntas */}
      <section className="ws-w ws-sec lx-faq" id="preguntas">
        <Reveal className="ws-head c"><h2 className="ws-h2">Preguntas frecuentes</h2></Reveal>
        <div>{FAQ.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div>
        <p className="ws-fine" style={{ textAlign: "center", marginTop: 24 }}>¿Otra duda? <Link href="/contacto">Escribinos</Link>.</p>
      </section>

      {/* Cierre */}
      <section className="ws-w lx-final-wrap">
        <Reveal className="lx-final">
          <div><h2 className="ws-h2">Ordená tu plata hoy. Es gratis.</h2><p>Cinco minutos para empezar. Sin tarjeta.</p></div>
          <AppCta className="ws-btn lx-big lx-shine" label="Crear mi cuenta" />
        </Reveal>
      </section>
    </PublicShell>
  );
}
