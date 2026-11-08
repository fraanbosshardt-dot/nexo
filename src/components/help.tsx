// "?" chico que explica en una línea una palabra difícil. Funciona sin JavaScript (details/summary).
const GLOSSARY: Record<string, string> = {
  TNA: "Tasa nominal anual: el interés por año que informa el banco, sin contar la capitalización. Es la que se usa para calcular las cuotas.",
  TEA: "Tasa efectiva anual: lo que pagás de interés en un año sumando la capitalización. Siempre es igual o mayor que la TNA.",
  CFT: "Costo financiero total: el interés más todos los gastos (seguros, comisiones, impuestos). Es el número para comparar préstamos.",
  frances: "Sistema francés: pagás siempre la misma cuota. Al principio es casi todo interés y al final casi todo capital.",
  aleman: "Sistema alemán: devolvés lo mismo de capital cada mes. La cuota empieza alta y va bajando.",
  americano: "Sistema americano: pagás solo intereses y el capital entero en la última cuota.",
  disponible: "Lo que tenés en tus cuentas, menos lo que vence antes de tu próximo cobro. No incluye inversiones ni tarjetas.",
  proyectado: "Sale de tus pagos que se repiten: es lo que esperás para esa fecha. Todavía no está guardado como pendiente. Lo podés pagar por adelantado o cancelar solo esa vez.",
  total: "Marcalo si lo que cargás es todo lo de esta vez, aunque sea un monto distinto al esperado. Así no queda nada pendiente. Destildalo si fue una parte y falta el resto.",
  porcobrar: "Lo que tenés para cobrar y todavía no entró: ventas de cereal, alquileres, sueldo. No está en tus cuentas, por eso no se suma al número grande.",
  flujo: "Cuánta plata vas a tener mes a mes, sumando lo que tenés hoy, lo que vas a cobrar y lo que vas a pagar. Incluye lo que se repite.",
  periodo: "A qué mes corresponde el gasto o el ingreso, aunque se pague otro día. Por ejemplo, el alquiler de noviembre pagado el 2 de diciembre.",
};

export function Help({ term, text }: { term: keyof typeof GLOSSARY | string; text?: string }) {
  const body = text ?? GLOSSARY[term];
  if (!body) return null;
  return (
    <details className="help">
      <summary aria-label={`Qué es ${term}`}>?</summary>
      <span role="note">{body}</span>
    </details>
  );
}
