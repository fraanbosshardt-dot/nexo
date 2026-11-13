// Fondo de la portada: como un video desenfocado, pero hecho con código (no pesa nada y carga al instante).
// Manchas de los verdes del logo que se mueven lento y, detrás, pedazos de la app fuera de foco que flotan.
// Con "reducir movimiento" queda quieto. Es decorativo: los lectores de pantalla lo saltean.
export function LandingSky() {
  return (
    <div className="lx-sky" aria-hidden="true">
      <span className="blob b1" /><span className="blob b2" /><span className="blob b3" /><span className="blob b4" />
      <div className="ghost g1"><small>Te queda hasta el cobro</small><b>$ 184.250</b><i><i /></i></div>
      <div className="ghost g2"><em>!</em><span><b>Vence en 3 días</b><small>Visa · $ 48.300</small></span></div>
      <div className="ghost g3"><div className="gbars"><i style={{ height: "38%" }} /><i style={{ height: "52%" }} /><i style={{ height: "46%" }} /><i style={{ height: "70%" }} /><i style={{ height: "64%" }} /><i style={{ height: "88%" }} /></div></div>
      <div className="ghost g4"><span><b>Sueldo</b><small>Cobrado · 1 de dic.</small></span><b className="pos">+$ 1.250.000</b></div>
      <div className="ghost g5"><svg viewBox="0 0 200 80"><path d="M4 70 C 50 66, 70 40, 110 36 S 170 14, 196 6" /></svg></div>
      <div className="ghost g6"><span><b>Cuota 3 de 6</b><small>Heladera · Mastercard</small></span><b>$ 52.000</b></div>
      <span className="veil" />
    </div>
  );
}
