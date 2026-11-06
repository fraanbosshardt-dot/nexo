import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-main" style={{ minHeight: "100vh" }}>
      <div className="auth-card" style={{ textAlign: "center", alignItems: "center" }}>
        <h1>No encontramos esta página</h1>
        <p className="sub">Puede que el enlace esté mal o que ya no exista.</p>
        <Link className="btn pri" href="/">Ir al inicio</Link>
      </div>
    </main>
  );
}
