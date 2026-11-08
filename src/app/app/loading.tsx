// Se muestra al instante mientras el servidor arma la pantalla, para que tocar un botón se sienta rápido.
export default function Loading() {
  return (
    <div className="sk" aria-busy="true" aria-label="Cargando">
      <div className="sk-line" style={{ width: 120, height: 12 }} />
      <div className="sk-line" style={{ width: "min(320px,70%)", height: 28 }} />
      <div className="sk-card" style={{ height: 180 }} />
      <div className="sk-grid"><div className="sk-card" style={{ height: 220 }} /><div className="sk-card" style={{ height: 220 }} /></div>
    </div>
  );
}
