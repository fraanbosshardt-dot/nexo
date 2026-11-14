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
      ["Tu cuenta", "Tenés que ser mayor de 18 años. Sos responsable de la información que cargás y de mantener segura tu contraseña. Te recomendamos activar la verificación en dos pasos. Podés descargar tus datos y solicitar la eliminación desde Configuración → Seguridad. Antes de eliminar una cuenta con Pro pago activo, tenés que cancelar la suscripción para detener los cobros."],
      ["Planes y pagos", `El plan Gratis no tiene costo ni vencimiento. El plan Pro se cobra por mes o por año, a través de Mercado Pago, en pesos argentinos, al precio informado antes de pagar, con impuestos incluidos cuando corresponda. La suscripción se renueva sola hasta que la des de baja. Si cambia el precio, te avisamos con al menos 30 días de anticipación y podés darte de baja antes de que se aplique.`],
      ["Prueba y activación de Pro", "La prueba gratis dura 14 días, se puede activar una sola vez y no pide tarjeta. Al terminar vuelve a Gratis si no contrataste una suscripción. Si autorizás una suscripción durante la prueba, el inicio de los cobros se programa para cuando termine. El acceso pago se habilita por los períodos confirmados como pagados por Mercado Pago; volver del sitio de pago no acredita por sí solo un pago."],
      ["Funciones en beta", "Algunas funciones están marcadas como Beta: ya se pueden usar, pero todavía las estamos mejorando y pueden cambiar. Te pedimos que revises sus resultados."],
      ["Baja, arrepentimiento y reembolsos", "Podés dar de baja Pro desde Configuración → Plan o solicitarlo desde Contacto → Planes y pagos. La baja detiene las renovaciones y mantiene el acceso hasta que termine el período ya pagado. Tenés 10 días corridos desde la contratación para arrepentirte y recibir la devolución total (artículo 34 de la Ley 24.240, artículo 1110 del Código Civil y Comercial y Disposición 954/2025). El detalle está en la Política de reembolsos."],
      ["Uso aceptable", `No podés usar ${N} para actividades ilegales, intentar acceder a cuentas de otras personas, copiar el servicio de forma automatizada ni afectar su funcionamiento. Si eso pasa, podemos suspender la cuenta.`],
      ["Propiedad intelectual", `La marca, el diseño y el software de ${N} pertenecen a su titular. Tus datos son tuyos: podés descargarlos o borrarlos cuando quieras.`],
      ["Responsabilidad", "Hacemos lo posible para que el servicio funcione sin interrupciones y con información correcta, y ofrecemos herramientas para que descargues una copia de tus datos. No respondemos por decisiones tomadas en base a las proyecciones, por datos cargados con errores ni por cortes de proveedores externos, en la medida en que lo permita la ley."],
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
      ["Para qué los usamos", "Para que la aplicación funcione, calcular tus saldos y proyecciones, enviarte las comunicaciones de cuenta y pagos, mostrarte los avisos de la app o las notificaciones de dispositivo que actives, responder tus consultas, prevenir fraudes y mejorar el servicio. No vendemos ni alquilamos tus datos y no los usamos para publicidad de terceros."],
      ["Comunicaciones por correo", "Usamos el correo para bienvenida, confirmación de cuenta, recuperación y seguridad del acceso, pagos y respuestas a consultas. No enviamos campañas de email marketing ni resúmenes de tus finanzas por correo."],
      ["Proveedores y espacios compartidos", "Usamos Vercel para alojar la app, Railway para la base de datos, Resend para enviar correos, Mercado Pago para procesar pagos y Google si elegís ese inicio de sesión. Cada proveedor recibe los datos necesarios para esa función. Algunos pueden procesarlos fuera de Argentina. Si invitás a alguien a tu espacio, esa persona accede a su información según el permiso que le asignes. También podemos entregar información cuando lo exija una autoridad competente."],
      ["Cómo los protegemos", "Conexión cifrada (HTTPS), contraseñas guardadas como hashes, secretos de verificación en dos pasos cifrados, verificación en dos pasos opcional, permisos por rol y registro de acciones del equipo. Desde Configuración podés descargar una copia de tus datos."],
      ["Tus derechos", "Podés acceder, corregir, actualizar o eliminar tus datos cuando quieras, en forma gratuita, de acuerdo con la Ley 25.326 de Protección de los Datos Personales. Desde Configuración podés descargar todos tus datos o borrar tu cuenta. La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, atiende las denuncias y reclamos por incumplimientos."],
      ["Cuánto tiempo los guardamos", "Mientras tu cuenta esté activa. Si la eliminás, borramos tus datos en hasta 30 días, salvo lo que la ley nos obligue a conservar (por ejemplo, comprobantes de pago)."],
      ["Cookies", "Usamos cookies de sesión y seguridad, y otras para continuar una compra, aceptar invitaciones o reconocer referidos. El detalle está en la Política de cookies."],
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
      ["Cancelar y pedir una devolución son gestiones distintas", "Cancelar Pro detiene las renovaciones y conserva el acceso ya pagado. Para pedir una devolución, usá Arrepentimiento o Planes y pagos. El número de trámite confirma que recibimos tu solicitud; la devolución se confirma cuando se procesa en Mercado Pago."],
      ["Cobros por error", "Si se te cobró dos veces o algo que no contrataste, escribinos con el área Planes y pagos: lo revisamos y, si corresponde, te devolvemos el total."],
      ["Si no quedás conforme", "Podés dejar un reclamo con el área Reclamos o acudir a Defensa del Consumidor, en la Ventanilla Única Federal."],
    ],
  },
  cookies: {
    title: "Política de cookies",
    short: "Cookies",
    intro: "Qué guardamos en tu navegador para la sesión, la seguridad, las preferencias y las invitaciones. Sin cookies publicitarias.",
    sections: [
      ["Qué es una cookie", "Es un archivo chico que el sitio guarda en tu navegador para recordar algo, por ejemplo que ya iniciaste sesión."],
      ["Sesión y seguridad", "somosguafra_session mantiene tu sesión: dura 12 horas, o hasta 30 días si elegís recordarla. somosguafra_in dura lo mismo y solo indica que hay una sesión para adaptar los botones del sitio. somosguafra_admin es exclusiva del equipo y dura 8 horas. somosguafra_g protege el inicio de sesión con Google y vence a los 10 minutos."],
      ["Compras, invitaciones y referidos", "somosguafra_after recuerda durante 30 minutos el plan que elegiste antes de ingresar o registrarte. somosguafra_invite conserva durante 1 hora una invitación a un espacio. Si llegás con un enlace de referido, somosguafra_ref guarda su código hasta 30 días para reconocer la invitación al crear tu cuenta; se elimina cuando se utiliza. Estas cookies no se usan para publicidad entre sitios."],
      ["Preferencias del dispositivo", "Guardamos el tema claro u oscuro y el tamaño de letra en el almacenamiento local del navegador. Se conservan hasta que los cambies o borres los datos del sitio. Son distintos de las cookies de sesión."],
      ["Las que no usamos", "No usamos cookies de publicidad, de redes sociales ni de seguimiento entre sitios. No vendemos información de navegación."],
      ["Medición de visitas", "En las páginas públicas del sitio (no dentro de la app) contamos visitas de forma agregada con Vercel Web Analytics, que no usa cookies ni guarda datos que te identifiquen. Sirve para saber qué páginas se leen más."],
      ["Cómo borrarlas", "Podés borrar las cookies desde la configuración de tu navegador. Si borrás la de sesión, vas a tener que ingresar de nuevo."],
    ],
  },
  arrepentimiento: {
    title: "Botón de arrepentimiento",
    short: "Arrepentimiento",
    intro: "Si contrataste Pro y te arrepentiste, podés pedir la cancelación y la devolución desde acá.",
    sections: [
      ["Qué es", "Tenés 10 días corridos desde la contratación para arrepentirte, sin dar motivos y sin costo. Te devolvemos el total (artículo 34 de la Ley 24.240, artículo 1110 del Código Civil y Comercial y Disposición 954/2025)."],
      ["Cómo pedirlo", "Tocá el botón de abajo y completá el formulario con el correo de tu cuenta. Te damos un número de trámite en el momento y te lo mandamos por correo."],
      ["Qué pasa después", "Cancelamos Pro y hacemos la devolución dentro de los 10 días hábiles por el mismo medio de pago. Tus datos quedan como estaban, en el plan Gratis."],
      ["Dar de baja", "Más allá del arrepentimiento, podés dar de baja Pro cuando quieras, sin trámites extra."],
    ],
  },
};
