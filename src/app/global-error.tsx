"use client";
// Último recurso: si falla todo el sitio, una página simple y amable.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, background: "#F6F8FC", color: "#1F1F1F" }}>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontWeight: 400, fontSize: 26 }}>Algo salió mal</h1>
          <p>Guafra no pudo cargar. Tus datos están a salvo. Probá de nuevo en un momento.</p>
          <button type="button" onClick={() => reset()} style={{ marginTop: 12, padding: "10px 20px", borderRadius: 20, border: 0, background: "#1A5FD0", color: "#fff", fontSize: 15, cursor: "pointer" }}>Probar de nuevo</button>
        </div>
      </body>
    </html>
  );
}
