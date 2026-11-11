"use client";
import { createContext, startTransition, useActionState, useContext, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type FormState = { error?: string; ok?: string } | null;
type Action = (state: FormState, fd: FormData) => Promise<FormState>;

const Pending = createContext(false);

// Formulario que muestra el error o la confirmación que devuelve la acción del servidor.
// Se envía con onSubmit (y no con action=) para que, si hay un error, no se borre lo escrito.
export function ActionForm({ action, children, className, style, id }: { action: Action; children: ReactNode; className?: string; style?: React.CSSProperties; id?: string }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form
      id={id}
      className={className}
      style={style}
      // Si se envía antes de que cargue la página, que nunca mande los datos en la dirección (ni la contraseña).
      method="post"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => run(fd));
      }}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      {state?.error && <p className="auth-err" role="alert">{state.error}</p>}
      {state?.ok && <p className="notice g" role="status">{state.ok}</p>}
    </form>
  );
}

export function Submit({ children, className = "btn pri", pending = "Guardando…" }: { children: ReactNode; className?: string; pending?: string }) {
  const busy = useContext(Pending);
  return (
    <button className={className} type="submit" disabled={busy} aria-busy={busy}>
      {busy ? pending : children}
    </button>
  );
}

// Botón para formularios simples (action={...}): se desactiva apenas se toca, así no se envía dos veces.
export function OnceButton({ children, className = "btn pri sm", pending = "Guardando…" }: { children: ReactNode; className?: string; pending?: string }) {
  const { pending: busy } = useFormStatus();
  return <button className={className} type="submit" disabled={busy} aria-busy={busy}>{busy ? pending : children}</button>;
}

export function PasswordStrength({ name = "password", id = "su-pass" }: { name?: string; id?: string }) {
  const [v, setV] = useState("");
  const score = (v.length >= 8 ? 1 : 0) + (/\d/.test(v) ? 1 : 0) + (/[A-ZÁÉÍÓÚ]/.test(v) ? 1 : 0) + (/[^\w]/.test(v) ? 1 : 0);
  const color = score < 2 ? "var(--red)" : score < 3 ? "var(--amber)" : "var(--green)";
  return (
    <>
      <label className="field" htmlFor={id}>
        Contraseña
        <input id={id} name={name} type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={v} onChange={(e) => setV(e.target.value)} required />
      </label>
      <div className="pw"><i style={{ width: `${score * 25}%`, background: color }} /></div>
      <p className="sub">{v ? ["Muy débil", "Débil", "Aceptable", "Buena", "Muy buena"][score] : "Usá 8 caracteres o más, con al menos un número."}</p>
    </>
  );
}

// Campo de código de 6 números, con espacio en el medio para leerlo mejor.
export function OtpInput({ name = "code" }: { name?: string }) {
  const [v, setV] = useState("");
  return (
    <label className="field">
      Código de 6 números
      <input
        name={name}
        className="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        placeholder="000 000"
        value={v}
        autoFocus
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "").slice(0, 6);
          setV(d.length > 3 ? `${d.slice(0, 3)} ${d.slice(3)}` : d);
        }}
      />
    </label>
  );
}
