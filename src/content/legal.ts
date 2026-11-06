// Borradores para revisar con un abogado antes de publicar.
export const LEGAL: Record<string, { title: string; sections: [string, string][] }> = {
  terminos: {
    title: "Términos y condiciones",
    sections: [
      ["Quiénes somos", "NEXO es una aplicación de organización de finanzas personales. Estos términos regulan el uso del sitio y de la aplicación. Al crear una cuenta aceptás estos términos."],
      ["Qué hace y qué no hace NEXO", "NEXO te ayuda a registrar, ordenar y proyectar tu información financiera. No es un banco, no mueve dinero, no da asesoramiento financiero ni de inversión personalizado, y los cálculos y proyecciones son estimaciones basadas en los datos que cargás."],
      ["Tu cuenta", "Sos responsable de la información que cargás y de mantener segura tu contraseña. Te recomendamos activar la verificación en dos pasos. Podés pedir la eliminación de tu cuenta en cualquier momento."],
      ["Planes y pagos", "El plan Gratis no tiene costo ni vencimiento. El plan Pro se cobra por mes o por año en dólares estadounidenses, o su equivalente en pesos al momento del cobro, e incluye impuestos cuando corresponda. La suscripción se renueva sola hasta que la des de baja."],
      ["Baja y arrepentimiento", "Podés dar de baja Pro cuando quieras con el mismo medio que usaste para contratarlo. Además, tenés 10 días corridos desde la contratación para arrepentirte y pedir la devolución total, con el botón de arrepentimiento (Ley 24.240 de Defensa del Consumidor y Resolución 424/2020)."],
      ["Uso aceptable", "No podés usar NEXO para actividades ilegales, intentar acceder a cuentas de otras personas ni afectar el funcionamiento del servicio."],
      ["Responsabilidad", "Hacemos lo posible para que el servicio funcione sin interrupciones y con información correcta, pero no respondemos por decisiones tomadas en base a las proyecciones ni por datos cargados con errores."],
      ["Cambios", "Si cambiamos estos términos te avisamos con anticipación por correo o dentro de la app."],
      ["Ley aplicable", "Rigen las leyes de la República Argentina. Cualquier conflicto se resuelve ante los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires, sin perjuicio de los derechos que te da la ley como consumidor."],
    ],
  },
  privacidad: {
    title: "Política de privacidad",
    sections: [
      ["Qué datos guardamos", "Tu nombre, tu correo, la información financiera que cargás (cuentas, movimientos, deudas, objetivos) y datos técnicos básicos de uso, como el dispositivo y la fecha de ingreso."],
      ["Qué no guardamos", "Nunca te pedimos ni guardamos contraseñas de bancos, billeteras o tarjetas. Tu contraseña de NEXO se guarda como un hash que no se puede revertir."],
      ["Para qué los usamos", "Para que la aplicación funcione, calcular tus saldos y proyecciones, mandarte los avisos que activaste y mejorar el servicio. No vendemos tus datos."],
      ["Con quién los compartimos", "Solo con proveedores que necesitamos para dar el servicio (alojamiento, correo, cobros), bajo acuerdos de confidencialidad, o cuando lo exija la ley."],
      ["Cómo los protegemos", "Cifrado en tránsito, secretos cifrados en la base, verificación en dos pasos, accesos internos limitados y registro de auditoría."],
      ["Tus derechos", "Podés acceder, corregir, actualizar o eliminar tus datos cuando quieras, de acuerdo con la Ley 25.326 de Protección de los Datos Personales, escribiendo a soporte@nexo.app. La Agencia de Acceso a la Información Pública es el órgano de control y atiende denuncias por incumplimientos."],
      ["Cuánto tiempo", "Mientras tu cuenta esté activa. Si la eliminás, borramos tus datos en hasta 30 días, salvo lo que la ley nos obligue a conservar."],
      ["Cambios", "Si cambiamos esta política te avisamos antes de que entre en vigencia."],
    ],
  },
  arrepentimiento: {
    title: "Botón de arrepentimiento",
    sections: [
      ["Qué es", "Si contrataste NEXO Pro, tenés 10 días corridos desde la contratación para arrepentirte, sin dar motivos y sin costo. Te devolvemos el total."],
      ["Cómo pedirlo", "Escribí a soporte@nexo.app desde el correo de tu cuenta con el asunto “Arrepentimiento”. Te respondemos con un número de trámite en 24 horas."],
      ["Dar de baja", "Más allá del arrepentimiento, podés dar de baja Pro cuando quieras, sin trámites extra."],
    ],
  },
};
