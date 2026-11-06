import { PageHead } from "./page";
import { startTrialAction } from "@/app/actions/modules";
import { PRO_FEATURES } from "@/server/plans";

// Pantalla para funciones Pro cuando el plan es Gratis: explica qué es y ofrece la prueba gratis.
export function ProGate({ title, crumb, text, trialUsed }: { title: string; crumb: string; text: string; trialUsed: boolean }) {
  return (
    <>
      <PageHead crumb={crumb} title={title} />
      <div className="card hero">
        <div>
          <div className="lbl">Función Pro</div>
          <p style={{ fontSize: 16, maxWidth: "52ch", margin: "8px 0 14px" }}>{text}</p>
          {trialUsed ? (
            <p className="sub">Tu prueba gratis ya terminó. Los cobros de Pro se habilitan pronto; mientras tanto, escribinos desde Ayuda.</p>
          ) : (
            <form action={startTrialAction}><button className="btn pri" type="submit">Probar Pro gratis por 14 días</button></form>
          )}
        </div>
        <div className="hero-side">{PRO_FEATURES.slice(0, 6).map((f) => <div className="hrow" key={f.key}><span>{f.name}</span><b className="pos">✓</b></div>)}</div>
      </div>
    </>
  );
}
