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
    cta: { href: "/registro", label: "Hacerlo con Somos Guafra, gratis" },
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
    cta: { href: "/productores", label: "Ver Somos Guafra para productores" },
  },
  {
    slug: "fondo-de-emergencia",
    title: "Fondo de emergencia: cuánto necesitás y cómo armarlo",
    description: "Qué es un fondo de emergencia, cuántos meses de gastos tiene que cubrir, dónde guardarlo y cómo juntarlo de a poco aunque ganes poco.",
    date: "2026-11-11", minutes: 5, tag: "Ahorro",
    intro: "Es la plata que te salva cuando algo sale mal: te quedás sin un ingreso, se rompe el auto o aparece un gasto de salud. Tenerlo cambia cómo vivís el resto del mes.",
    sections: [
      { h: "Cuánto tiene que cubrir", p: ["Lo más recomendado es entre 3 y 6 meses de tus gastos fijos: vivienda, servicios, comida, transporte, salud y cuotas. No de todo lo que gastás, solo de lo que pagás sí o sí.", "Si trabajás por tu cuenta, tus ingresos cambian mucho o mantenés a otras personas, apuntá a 6 meses o más."] },
      { h: "Empezá con una meta chica", p: ["Juntar 6 meses de golpe es imposible para casi todos. Empezá por un mes: es una meta alcanzable y ya te cubre la mayoría de los imprevistos.", "Apartá un monto fijo el mismo día que cobrás, antes de gastar. Aunque sea poco, lo que importa es que sea todos los meses."] },
      { h: "Dónde guardarlo", p: ["Tiene que estar disponible enseguida y no perder valor: una cuenta que pague intereses o un plazo fijo corto que se renueva solo.", "Evitá inversiones que pueden bajar justo cuando las necesitás, y no lo mezcles con la cuenta del día a día: si lo ves, lo gastás."] },
      { h: "Cuándo usarlo (y cuándo no)", p: ["Es para urgencias de verdad: algo que no podías prever y que no puede esperar. Unas vacaciones o un celular nuevo no son emergencias: para eso armá un objetivo aparte.", "Si lo usás, la prioridad del mes siguiente es volver a llenarlo."] },
    ],
    cta: { href: "/herramientas/fondo-de-emergencia", label: "Calcular mi fondo de emergencia" },
  },
  {
    slug: "como-funciona-el-plazo-fijo",
    title: "Cómo funciona un plazo fijo y cuánto ganás",
    description: "Qué es un plazo fijo, cómo se calcula el interés con la TNA, qué es la TEA y cuándo conviene renovar capital más intereses.",
    date: "2026-11-11", minutes: 4, tag: "Inversiones",
    intro: "Le prestás plata al banco por un tiempo fijo y te la devuelve con intereses. Es de las inversiones más simples, y entender la tasa te ayuda a comparar.",
    sections: [
      { h: "Cómo se calcula", p: ["El interés es: monto × TNA × días / 365. Con 100.000 al 36% anual durante 30 días ganás unos 2.959.", "La TNA es la tasa que informa el banco. No es lo que ganás en un año, salvo que dejes la plata 365 días seguidos."] },
      { h: "TEA: lo que ganás si renovás", p: ["Si al vencer volvés a invertir capital más intereses, el siguiente plazo gana sobre un monto más grande. Eso es interés compuesto, y la TEA lo refleja: siempre es un poco mayor que la TNA."] },
      { h: "Qué mirar antes de hacerlo", p: ["Comparalo con la inflación esperada: si los precios suben más que la tasa, tu plata compra menos al final aunque el número sea más grande.", "Fijate el plazo mínimo y si podés cancelarlo antes. La plata del fondo de emergencia conviene en plazos cortos."] },
    ],
    cta: { href: "/herramientas/plazo-fijo", label: "Calcular cuánto gano" },
  },
  {
    slug: "regla-50-30-20",
    title: "La regla 50/30/20 para armar tu presupuesto",
    description: "Cómo repartir lo que cobrás entre necesidades, gustos y ahorro con la regla 50/30/20, y cómo adaptarla si tus gastos fijos son más altos.",
    date: "2026-11-11", minutes: 4, tag: "Día a día",
    intro: "Es la forma más simple de empezar un presupuesto: tres partes y una sola cuenta. No tiene que ser exacta, sirve como punto de partida.",
    sections: [
      { h: "Las tres partes", p: ["50% para necesidades: vivienda, servicios, comida, transporte, salud y el mínimo de tus deudas.", "30% para gustos: salidas, ropa, viajes, suscripciones y todo lo que podrías dejar si hiciera falta.", "20% para ahorro: fondo de emergencia, objetivos y pagar deudas antes de tiempo."] },
      { h: "Si las necesidades pasan del 50%", p: ["Es muy común, sobre todo con alquiler. No te frustres: empezá ahorrando lo que puedas, aunque sea un 5%, y revisá si algún gasto fijo se puede bajar (planes, servicios, seguros)."] },
      { h: "Cómo sostenerlo", p: ["Apartá el ahorro apenas cobrás, no lo que sobra a fin de mes: casi nunca sobra.", "Revisalo una vez al mes con lo que gastaste de verdad. Ver los números reales ayuda más que cualquier regla."] },
    ],
    cta: { href: "/herramientas/presupuesto-50-30-20", label: "Calcular mi 50/30/20" },
  },
  {
    slug: "como-salir-de-deudas",
    title: "Cómo salir de las deudas paso a paso",
    description: "Un plan simple para salir de deudas: listarlas, frenar las nuevas, elegir cuál pagar primero (método avalancha o bola de nieve) y evitar el pago mínimo.",
    date: "2026-11-11", minutes: 5, tag: "Deudas",
    intro: "Salir de deudas no depende de un truco, sino de un orden. Con una lista y un criterio para elegir cuál pagar primero, cada mes avanzás.",
    sections: [
      { h: "1. Hacé la lista completa", p: ["Anotá cada deuda con lo que debés, la cuota, la tasa y el vencimiento: tarjetas, préstamos, cuotas, lo que le debés a alguien. Ver todo junto da miedo, pero es el primer paso para ordenarlo."] },
      { h: "2. Frená las deudas nuevas", p: ["Mientras pagás, evitá sumar cuotas. Si usás la tarjeta, que sea solo por lo que podés pagar completo al vencimiento."] },
      { h: "3. Elegí cuál pagar primero", p: ["Método avalancha: pagás el mínimo de todas y lo que sobra va a la de tasa más alta. Es el que menos intereses te cobra.", "Método bola de nieve: lo que sobra va a la deuda más chica. Pagás algo más de intereses, pero ves resultados rápido y eso ayuda a seguir."] },
      { h: "4. Nunca solo el pago mínimo", p: ["El mínimo de la tarjeta casi no baja la deuda: el resto genera intereses muy altos. Aunque sea un poco más que el mínimo, se nota mes a mes."] },
    ],
    cta: { href: "/registro", label: "Ordenar mis deudas en Somos Guafra" },
  },
];

export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug);
