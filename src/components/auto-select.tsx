"use client";
// Un selector que aplica el cambio apenas elegís (sin botón "Ver"). Sin JavaScript, el formulario tiene su botón oculto.
export function AutoSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
