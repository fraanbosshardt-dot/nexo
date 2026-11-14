// Textos legales del sitio. Conviene que los revise un abogado antes de lanzar con publicidad.
// El nombre de la marca y los datos del titular salen de src/lib/brand.ts.
import { BRAND } from "@/lib/brand";

export type LegalDoc = { title: string; short: string; intro: string; sections: [string, string][] };
const N = BRAND.name;
const TITULAR = `${BRAND.owner}, CUIT ${BRAND.cuit}, ${BRAND.country}`;
const CONTACTO = "el formulario de Contacto del sitio (/contacto)";

export const LEGAL: Record<string, LegalDoc> = {
  terminos: {
    title: "Términos y condiciones",
    short: "Términos",
    intro: `Las reglas para usar ${N}, escritas para que se entiendan. Al crear una cuenta las aceptás.`,
    sections: [
      ["Quién presta el servicio", `${N} es un servicio de organización de finanzas personales de titularidad de ${TITULAR}. La atención es exclusivamente en línea: no hay oficinas abiertas al público. Para cualquier consulta o reclamo usá ${CONTACTO}, que te da un número de trámite.`],
      ["Qué hace y qué no hace " + N, `${N} te ayuda a registrar, ordenar y proyectar tu información financiera. No es un banco ni una billetera: no mueve dinero, no recibe depósitos y no da crédito. Tampoco se conecta con tus cuentas bancarias ni te pide sus claves.`],
      ["No es asesoramiento financiero", `La información, los cálculos, las proyecciones y las calculadoras de ${N} son estimaciones basadas en los datos que cargás y tienen fin informativo y educativo. No constituyen asesoramiento financiero, impositivo, legal ni de inversión, ni una recomendación para comprar o vender ningún activo. Antes de tomar decisiones importantes consultá con un profesional matriculado.`],
      ["Tu cuenta", "Tenés que ser mayor de 18 años. Sos responsable de la información que cargás y de mantener segura tu contraseña. Te recomendamos activar la verificación en dos pasos. Podés eliminar tu cuenta cuando quieras desde Configuración."],
      ["Planes y pagos", `El plan Gratis no tiene costo ni vencimiento. El plan Pro se cobra por mes o por año, a través de Mercado Pago, en pesos argentinos o su equivalente informado antes de pagar, con impuestos incluidos cuando corresponda. La suscripción se renueva sola hasta que la des de baja. Si cambia el precio, te avisamos con al menos 30 días de anticipación y podés darte de baja antes de que se aplique.`],
      ["Funciones en beta", "Algunas funciones están marcadas como Beta: ya se pueden usar, pero todavía las estamos mejorando y pueden cambiar. Te pedimos que revises sus resultados."],
      ["Baja, arrepentimiento y reembolsos", "Podés dar de baja Pro cuando quieras, por el mismo medio que usaste para contratarlo y sin trámites extra. Tenés 10 días corridos desde la contratación para arrepentirte y recibir la devolución total (Ley 24.240 de Defensa del Consumidor y Resolución 424/2020). El detalle está en la Política de reembolsos."],
      ["Uso aceptable", `No podés usar ${N} para actividades ilegales, intentar acceder a cuentas de otras personas, copiar el servicio de forma automatizada ni afectar su funcionamiento. Si eso pasa, podemos suspender la cuenta.`],
      ["Propiedad intelectual", `La marca, el diseño y el software de ${N} pertenecen a su titular. Tus datos son tuyos: podés descargarlos o borrarlos cuando quieras.`],
      ["Responsabilidad", "Hacemos lo posible para que el servicio funcione sin interrupciones y con información correcta, y hacemos copias de seguridad. No respondemos por decisiones tomadas en base a las proyecciones, por datos cargados con errores ni por cortes de proveedores externos, en la medida en que lo permita la ley."],
      ["Cambios en estos términos", "Si los cambiamos de forma importante, te avisamos con anticipación dentro de la app. Si no estás de acuerdo, podés dar de baja tu cuenta."],
      ["Ley aplicable y reclamos", `Rigen las leyes de la ${BRAND.country}. Si tenés un problema, escribinos primero desde ${CONTACTO} eligiendo el área Reclamos. También podés hacer tu reclamo ante Defensa del Consumidor, en la Ventanilla Única Federal. Para cualquier conflicto son competentes los tribunales que correspondan según la Ley 24.240.`],
    ],
  },
  privacidad: {
    title: "Política de privacidad",
    short: "Privacidad",
    intro: "Qué datos guardamos, para qué, y cómo los cuidamos. La versión corta: tus datos son tuyos, no los vendemos y nunca te pedimos la clave del banco.",
    sections: [
      ["Responsable de los datos", `El responsable de los datos es el titular de ${N}, identificado en los Términos y condiciones (/terminos). Para ejercer tus derechos usá ${CONTACTO} con el área Privacidad y datos.`],
      ["Qué datos guardamos", "Tu nombre, tu correo, la información financiera que cargás (cuentas, movimientos, deudas, objetivos) y datos técnicos básicos de uso, como el dispositivo, la dirección IP y la fecha de ingreso."],
      ["Qué no guardamos", `Nunca te pedimos ni guardamos contraseñas de bancos, billeteras o tarjetas, ni números completos de tarjeta. Tu contraseña de ${N} se guarda como un hash que no se puede revertir. Los pagos los procesa Mercado Pago: nosotros no vemos los datos de tu tarjeta.`],
      ["Para qué los usamos", "Para que la aplicación funcione, calcular tus saldos y proyecciones, mandarte los avisos que activaste, responder tus consultas, prevenir fraudes y mejorar el servicio. No vendemos ni alquilamos tus datos y no los usamos para publicidad de terceros."],
      ["Con quién los compartimos", "Solo con proveedores que necesitamos para dar el servicio (alojamiento y base de datos, envío de correos, cobros e inicio de sesión con Google), que los tratan por nuestra cuenta y bajo confidencialidad, o cuando lo exija una autoridad competente. Algunos de estos proveedores alojan la información fuera de Argentina, con niveles de protección adecuados."],
      ["Cómo los protegemos", "Conexión cifrada (HTTPS), secretos cifrados en la base, verificación en dos pasos opcional, accesos internos limitados por rol, registro de auditoría de cada acción del equipo y copias de seguridad de la base."],
      ["Tus derechos", "Podés acceder, corregir, actualizar o eliminar tus datos cuando quieras, en forma gratuita, de acuerdo con la Ley 25.326 de Protección de los Datos Personales. Desde Configuración podés descargar todos tus datos o borrar tu cuenta. La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, atiende las denuncias y reclamos por incumplimientos."],
      ["Cuánto tiempo los guardamos", "Mientras tu cuenta esté activa. Si la eliminás, borramos tus datos en hasta 30 días, salvo lo que la ley nos obligue a conservar (por ejemplo, comprobantes de pago)."],
      ["Cookies", "Usamos solo las cookies necesarias para que inicies sesión y la app funcione. El detalle está en la Política de cookies."],
      ["Cambios", "Si cambiamos esta política de forma importante, te avisamos antes de que entre en vigencia."],
    ],
  },
  reembolsos: {
    title: "Política de reembolsos",
    short: "Reembolsos",
    intro: "Cuándo te devolvemos la plata y cómo pedirlo. Sin letra chica.",
    sections: [
      ["Arrepentimiento: 10 días, devolución total", "Si contrataste Pro, tenés 10 días corridos desde la contratación para arrepentirte, sin dar motivos y sin costo. Te devolvemos el 100% de lo que pagaste, por el mismo medio de pago."],
      ["Cómo pedirlo", `Usá el botón de arrepentimiento del pie del sitio o ${CONTACTO} con el área Arrepentimiento, desde el correo de tu cuenta. Te damos un número de trámite en el momento, que sirve como constancia.`],
      ["Cuándo llega", "Hacemos la devolución dentro de los 10 días hábiles de tu pedido. El tiempo en que la ves reflejada depende de Mercado Pago y de tu banco o tarjeta (en tarjetas de crédito puede aparecer en el próximo resumen)."],
      ["Después de los 10 días", "Podés dar de baja Pro cuando quieras: no se te vuelve a cobrar y seguís con Pro hasta el final del período que ya pagaste. No devolvemos períodos parciales ya iniciados, salvo que lo exija la ley."],
      ["Cobros por error", "Si se te cobró dos veces o algo que no contrataste, escribinos con el área Planes y pagos: lo revisamos y, si corresponde, te devolvemos el total."],
      ["Si no quedás conforme", "Podés dejar un reclamo con el área Reclamos o acudir a Defensa del Consumidor, en la Ventanilla Única Federal."],
    ],
  },
  cookies: {
    title: "Política de cookies",
    short: "Cookies",
    intro: "Usamos lo mínimo indispensable. Sin publicidad y sin rastreo de terceros.",
    sections: [
      ["Qué es una cookie", "Es un archivo chico que el sitio guarda en tu navegador para recordar algo, por ejemplo que ya iniciaste sesión."],
      ["Las que usamos", `Solo cookies necesarias: la de tu sesión (para que no tengas que ingresar en cada pantalla), la del panel interno para el equipo y una de seguridad durante el inicio de sesión con Google. También guardamos en tu dispositivo preferencias como el modo claro u oscuro y el tamaño de letra.`],
      ["Las que no usamos", "No usamos cookies de publicidad, de redes sociales ni de seguimiento entre sitios. No vendemos información de navegación."],
      ["Medición de visitas", "En las páginas públicas del sitio (no dentro de la app) contamos visitas de forma agregada con Vercel Web Analytics, que no usa cookies ni guarda datos que te identifiquen. Sirve para saber qué páginas se leen más."],
      ["Cómo borrarlas", "Podés borrar las cookies desde la configuración de tu navegador. Si borrás la de sesión, vas a tener que ingresar de nuevo."],
    ],
  },
  arrepentimiento: {
    title: "Botón de arrepentimiento",
    short: "Arrepentimiento",
    intro: "Si contrataste Pro y te arrepentiste, lo cancelás acá en un minuto.",
    sections: [
      ["Qué es", "Tenés 10 días corridos desde la contratación para arrepentirte, sin dar motivos y sin costo. Te devolvemos el total (Ley 24.240 y Resolución 424/2020)."],
      ["Cómo pedirlo", "Tocá el botón de abajo y completá el formulario con el correo de tu cuenta. Te damos un número de trámite en el momento y te lo mandamos por correo."],
      ["Qué pasa después", "Cancelamos Pro y hacemos la devolución dentro de los 10 días hábiles por el mismo medio de pago. Tus datos quedan como estaban, en el plan Gratis."],
      ["Dar de baja", "Más allá del arrepentimiento, podés dar de baja Pro cuando quieras, sin trámites extra."],
    ],
  },
};
