"use client";
// Abre el diálogo de impresión del navegador, donde se elige "Guardar como PDF".
export function PrintButton() {
  return <button type="button" className="btn pri no-print" onClick={() => window.print()}>Imprimir o guardar como PDF</button>;
}
