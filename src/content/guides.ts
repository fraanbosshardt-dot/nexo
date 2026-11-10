// Guías prácticas del sitio (para buscadores y para quien recién empieza). Información general, no asesoramiento.
export type Guide = {
  slug: string; title: string; description: string; date: string; minutes: number; tag: string;
  intro: string; sections: { h: string; p: string[] }[]; cta: { href: string; label: string };
};

export const GUIDES: Guide[] = [
  {
    slug: "como-organizar-el-sueldo",
    title: "Cómo organizar el sueldo para llegar a fin de mes",
    description: "Un método simple en cinco pasos para ordenar el sueldo: separar lo fijo, saber cuánto podés gastar por día y armar un fondo para imprevistos.",
    date: "2026-11-10", minutes: 5, tag: "Día a día",
    intro: "No hace falta una planilla complicada. Con cinco pasos sabés cuánto podés gastar cada día sin llegar en rojo al próximo cobro.",
    sections: [
      { h: "1. Anotá lo que entra y cuándo", p: ["Empezá por la fecha y el monto de tu cobro. Si cobrás en partes o tu ingreso cambia, anotá lo que esperás y después corregilo con lo real."] },
      { h: "2. Separá lo fijo apenas cobrás", p: ["Alquiler, expensas, servicios, colegio, cuotas de tarjeta y préstamos. Sumalos y apartalos el mismo día del cobro: esa plata ya tiene dueño.", "Mirá también lo que vence antes del próximo cobro, no solo en el mes: es lo que de verdad compromete tu saldo."] },
      { h: "3. Calculá cuánto podés gastar por día", p: ["Lo que te queda después de lo fijo, dividido por los días que faltan para cobrar, es tu límite diario. Si un día gastás de más, el resto de los días baja un poco: así no te enterás a fin de mes."] },
      { h: "4. Armá un fondo para imprevistos", p: ["La recomendación más común es juntar de a poco entre 3 y 6 meses de tus gastos fijos. Empezá con una meta chica, por ejemplo un mes, y no lo uses para el día a día."] },
      { h: "5. Revisalo una vez por semana", p: ["Cinco minutos alcanzan: qué vence esta semana, si algún pago cambió y cómo viene el mes. Lo importante es enterarte antes, no después."] },
    ],
    cta: { href: "/registro", label: "Hacerlo con NEXO, gratis" },
  },
  {
    slug: "conviene-pagar-en-cuotas",
    title: "¿Conviene pagar en cuotas o de contado?",
    description: "Cuándo conviene comprar en cuotas sin interés, cuándo conviene el descuento de contado y cómo saber si las cuotas te entran todos los meses.",
    date: "2026-11-10", minutes: 4, tag: "Tarjetas",
    intro: "La respuesta depende de tres cosas: si las cuotas tienen interés, si hay descuento por pagar de contado y si la cuota te entra todos los meses, no solo el primero.",
    sections: [
      { h: "Cuotas sin interés", p: ["Si el precio en cuotas es igual al de contado, las cuotas te permiten pagar de a poco con la misma plata. Con precios que suben mes a mes, además, cada cuota pesa menos que la anterior en tu bolsillo.", "La condición es que la cuota te entre todos los meses: si se suma a otras cuotas y algún mes no llegás, terminás pagando intereses en la tarjeta, que suelen ser de los más altos."] },
      { h: "Descuento de contado", p: ["Si pagando de contado te hacen un descuento, compará ese descuento con lo que te ahorrarías pagando en cuotas. Un buen descuento de contado puede ganarle a las cuotas sin interés, sobre todo si son pocas."] },
      { h: "Cuotas con interés", p: ["Fijate el CFT (costo financiero total), no solo la tasa: incluye intereses, impuestos y otros cargos. Multiplicá la cuota por la cantidad de cuotas y compará con el precio de contado: la diferencia es lo que pagás de más."] },
      { h: "La pregunta clave: ¿te entra todos los meses?", p: ["Sumá la cuota nueva a las que ya tenés y a tus gastos fijos, mes por mes. Si en algún mes quedás por debajo de cero, conviene más cuotas, otra compra o esperar."] },
    ],
    cta: { href: "/herramientas/cuotas", label: "Probar la calculadora de cuotas" },
  },
  {
    slug: "que-es-el-cft",
    title: "Qué es el CFT y por qué importa más que la tasa",
    description: "El costo financiero total (CFT) suma intereses, impuestos, seguros y comisiones. Por qué es el número correcto para comparar préstamos y compras en cuotas.",
    date: "2026-11-10", minutes: 3, tag: "Préstamos",
    intro: "Dos préstamos con la misma tasa pueden costar muy distinto. El CFT es el número que lo muestra.",
    sections: [
      { h: "TNA, TEA y CFT", p: ["La TNA (tasa nominal anual) es la tasa \"de lista\". La TEA (tasa efectiva anual) muestra lo que pagás en un año cuando los intereses se suman mes a mes. El CFT suma además impuestos, seguros, comisiones y otros cargos."] },
      { h: "Por qué comparar por CFT", p: ["Un préstamo con tasa más baja pero con seguro y comisiones caras puede terminar costando más. Al comparar dos ofertas, mirá el CFT de las dos, con impuestos incluidos."] },
      { h: "Dónde encontrarlo", p: ["Los bancos y emisores de tarjetas tienen que informarlo en la oferta, en el contrato y en el resumen. Si no lo ves, pedilo antes de firmar."] },
    ],
    cta: { href: "/herramientas/prestamo", label: "Calcular un préstamo" },
  },
  {
    slug: "impuesto-al-cheque-venta-de-granos",
    title: "Impuesto al cheque en la venta de granos: cómo calcular el neto",
    description: "Cómo calcular lo que realmente te queda de una venta de soja, maíz o trigo: precio por tonelada, quintales, impuesto al cheque y otros descuentos.",
    date: "2026-11-10", minutes: 4, tag: "Agro",
    intro: "Entre lo que dice el boleto y lo que llega a la cuenta hay varios descuentos. Saber el neto de cada venta te deja planificar el mes con números reales.",
    sections: [
      { h: "Del precio al bruto", p: ["El bruto es la cantidad vendida por el precio. Recordá que 1 tonelada son 10 quintales: si vendés 700 quintales a $ 340.000 la tonelada, son 70 toneladas y el bruto es de $ 23.800.000."] },
      { h: "El impuesto al cheque", p: ["El impuesto a los créditos y débitos en cuentas bancarias tiene una alícuota general de 0,6% sobre cada acreditación y 0,6% sobre cada débito. Por eso muchos productores calculan 1,2% del bruto cuando la plata entra y después sale de la cuenta.", "Según tu situación, una parte puede computarse a cuenta de otros impuestos: consultalo con tu contador."] },
      { h: "Otros descuentos", p: ["Comisión del acopio o corredor, flete, secada, paritarias y otros gastos se restan del bruto. Sumalos todos para no sobreestimar lo que vas a cobrar."] },
      { h: "Planificar con ventas mes a mes", p: ["Si vendés todos los meses, cargá un monto aproximado por mes y reemplazalo por la venta real cuando la hagas. Así ves la plata que viene sin contarla dos veces."] },
    ],
    cta: { href: "/productores", label: "Ver NEXO para productores" },
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
