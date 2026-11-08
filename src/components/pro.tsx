import { PageHead } from "./page";
import { Icon } from "./icons";
import { startTrialAction } from "@/app/actions/modules";
import { PRO_FEATURES } from "@/server/plans";

// Para una función Pro en plan Gratis: una tarjeta chica que explica qué es y ofrece la prueba gratis.
export function ProGate({ title, crumb, text, trialUsed }: { title: string; crumb: string; text: string; trialUsed: boolean }) {
  return (
    <>
      <PageHead crumb={crumb} title={title} />
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="chead"><span className="pill b"><Icon name="lock" />Pro</span></div>
        <p style={{ fontSize: 15, margin: "0 0 14px", maxWidth: "56ch" }}>{text}</p>
        <div className="acts" style={{ alignItems: "center" }}>
          {!trialUsed && <form action={startTrialAction}><button className="btn pri" type="submit">Probar gratis 14 días</button></form>}
          <a className="btn" href="/app/configuracion?tab=plan">Ver planes</a>
        </div>
        <p className="sub" style={{ marginTop: 14 }}>Pro también suma: {PRO_FEATURES.filter((f) => !f.beta).slice(0, 4).map((f) => f.name.toLowerCase()).join(", ")}.</p>
      </div>
    </>
  );
}
