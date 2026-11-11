import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { supportTicketAction } from "@/app/actions/modules";

export const metadata: Metadata = { title: "Ayuda" };

const FAQ: [string, string][] = [
  ["¿Qué diferencia hay entre Movimientos y Próximos pagos?", "Movimientos es lo que ya pasó: plata que entró o salió. Próximos pagos es lo que falta pagar o cobrar. Cuando registrás un pago pendiente, pasa a Movimientos."],
  ["¿Cómo cargo una compra en cuotas?", "Agregá tu tarjeta en Tarjetas con el día de cierre y de vencimiento. Después cargá la compra desde la tarjeta y elegí la cantidad de cuotas. Cada cuota aparece en el mes que vence."],
  ["¿Las compras con tarjeta se cuentan dos veces?", "No. La compra es el gasto. Pagar el resumen es pasar plata de tu cuenta a la tarjeta, así que no suma como gasto otra vez."],
  ["¿Por qué lo invertido no aparece en Disponible?", "Porque no lo podés gastar hoy. Lo ves en Inversiones y en Patrimonio neto."],
  ["Me equivoqué en un movimiento", "Abrilo desde Movimientos: podés corregir el concepto, la categoría, la fecha o el importe, o anularlo. Anular crea un movimiento al revés, así tu historial queda completo y el saldo vuelve a estar bien."],
  ["El saldo de una cuenta no coincide con el del banco", "Entrá a la cuenta y tocá «Corregir el saldo». Escribís lo que ves en el banco y se agrega una corrección por la diferencia, sin tocar tus movimientos."],
  ["¿Cómo cargo el sueldo, el alquiler o los servicios una sola vez?", "Cargalos como pago o cobro que se repite (desde Nuevo movimiento → Más opciones, o en Configuración → Pagos que se repiten). Aparecen solos en Próximos pagos todos los meses. Si el monto cambia, marcalos como variables y al pagar ponés el real."],
  ["¿Cómo armo un presupuesto?", "En Presupuestos, tocá «Armar el presupuesto» y poné un límite solo a las categorías que quieras controlar. Lo que gastes y lo que tengas pendiente se descuenta solo, y el mes siguiente lo podés copiar."],
  ["¿Puedo compartir mis cuentas con mi pareja o mi familia?", "Sí, con Pro. En Configuración → Compartir invitás por correo hasta 3 personas, que pueden cargar y editar o solo mirar. Cada una entra con su propia cuenta."],
  ["¿Cómo recibo avisos de vencimientos?", "Por email, el día antes de cada vencimiento (se apagan en Configuración → Seguridad). También podés activar los avisos en el celular desde Configuración → General; en iPhone, primero instalá la app en la pantalla de inicio."],
  ["¿Cómo apago una función que no uso?", "En Configuración, pestaña Funciones. Lo que apagás desaparece del menú y tus datos quedan guardados."],
  ["¿Se conecta con mi banco?", "No. Cargás tus movimientos o importás el extracto del banco o de Mercado Pago (CSV; con Pro también Excel y OFX), desde Configuración → Importar y exportar. Nunca te pedimos la clave del banco."],
];

export default async function Help() {
  const { user, plan } = await requireWorkspace();
  const tickets = await getDb().supportTicket.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <>
      <PageHead crumb="Ajustes" title="Ayuda" desc="Respuestas rápidas y una forma de escribirnos." />
      <div className="grid g32">
        <div className="card">
          <div className="chead"><h3>Preguntas frecuentes</h3></div>
          <div className="list">{FAQ.map(([q, a]) => <details className="li" key={q} style={{ display: "block" }}><summary style={{ cursor: "pointer", listStyle: "none" }}>{q}</summary><p className="sub" style={{ margin: "8px 0 0", fontSize: 14 }}>{a}</p></details>)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="chead"><h3>Escribinos</h3></div>
            <ActionForm action={supportTicketAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label className="field">Asunto<input name="subject" maxLength={140} required /></label>
              <label className="field">Contanos qué pasó<textarea name="body" rows={5} maxLength={4000} required /></label>
              <div><Submit pending="Enviando…">Enviar</Submit></div>
              {plan === "PRO" && <p className="sub" style={{ margin: 0 }}>Con Pro te respondemos primero.</p>}
            </ActionForm>
          </div>
          {tickets.length > 0 && (
            <div className="card">
              <div className="chead"><h3>Tus consultas</h3></div>
              <div className="list">
                {tickets.map((t) => (
                  <div className="li" key={t.id} style={{ display: "block" }}>
                    <div className="t">{t.subject}</div>
                    <div className="s">{fmtDate(t.createdAt)} · {t.status === "CLOSED" ? "Cerrada" : t.reply ? "Respondida" : "Esperando respuesta"}</div>
                    {t.reply && <p className="notice" style={{ marginTop: 8 }}><span><b>Finan:</b> {t.reply}</span></p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
