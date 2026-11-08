"use client";

// Botón "Cerrar" para un panel desplegable (<details>): lo pliega y vuelve a mostrar el título.
export function CloseDetails({ label = "Cerrar" }: { label?: string }) {
  return (
    <button
      type="button"
      className="btn sm"
      onClick={(e) => {
        const d = e.currentTarget.closest("details");
        if (!d) return;
        d.open = false;
        d.querySelector("summary")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }}
    >
      {label}
    </button>
  );
}
