"use client";
// Si algo falla dentro de la app, se muestra esto en lugar de la pantalla técnica. Tus datos no se pierden.
import Link from "next/link";
import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="empty" role="alert" style={{ padding: "48px 24px" }}>
      <h2 style={{ margin: "0 0 8px", fontWeight: 400 }}>Algo salió mal</h2>
      <p style={{ margin: "0 0 16px" }}>No pudimos mostrar esta pantalla. Tus datos están a salvo. Probá de nuevo en un momento.</p>
      <div className="acts" style={{ justifyContent: "center" }}>
        <button className="btn pri" type="button" onClick={() => reset()}>Probar de nuevo</button>
        <Link className="btn" href="/app">Ir al inicio</Link>
      </div>
      {error.digest && <p className="sub" style={{ marginTop: 14 }}>Código para soporte: {error.digest}</p>}
    </div>
  );
}
