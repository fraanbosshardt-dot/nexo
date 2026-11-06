# NEXO — Pendientes y completados

Regla general para todas las pantallas: la primera vista muestra solo lo indispensable. El detalle va detrás de "⋯", "Ver más" o una pantalla propia.

## Pendientes

_Sin pendientes de este pedido._ Próximo paso sugerido: empezar la Fase 1 con código real (Next.js, base de datos, cuentas de usuario y verificación en dos pasos reales).

## Completado (05/11/2026, versión 10 del prototipo)

### Producto público
- [x] P1. Landing con animaciones: cotización del dólar que corre arriba, ejemplo de la app que se arma solo, secciones que aparecen al bajar, planes, preguntas frecuentes y pie con legales. Respeta "reducir movimiento" del sistema.
- [x] P2. Registro, inicio de sesión y verificación en dos pasos (Google Authenticator, con QR y clave). "Continuar con Google" y "Entrar a la demo". Todo simulado: no se envía nada.
- [x] P3. Planes: Gratis (casi todo) y Pro a US$ 5/mes o US$ 48/año. Pro suma: flujo a 5 años y día a día, simulador, asistente con IA, módulo Agro, informes avanzados con Excel y PDF, importación avanzada, espacio compartido, sin límites y soporte prioritario. Las funciones Pro muestran una pantalla para mejorar el plan.
- [x] P4. Términos y condiciones, política de privacidad (Ley 25.326) y botón de arrepentimiento (Ley 24.240 y Resolución 424/2020). Borradores para revisar con un abogado.

### Personalización
- [x] P5. Introducción en 5 pasos: para qué la vas a usar, moneda y zona horaria, funciones (pre elegidas según lo anterior), primera cuenta y resumen. Arma el menú a medida.
- [x] P6. Ventas de cereal pasa a ser el módulo "Agro: ventas de granos": apagado por defecto, se prende en la introducción ("Soy productor agropecuario") o en Funciones. Es Pro.

### App
- [x] P7. Cada cuenta abre su propia pantalla: saldo, entró y salió en el mes, saldo de los últimos 30 días, movimientos, conciliar, editar y desactivar.
- [x] P8. Cada deuda abre su propia pantalla: lo que falta, próxima cuota, fin de pagos, cancelación, y detrás de "Ver más": cronograma, condiciones y más acciones.
- [x] P9. Tarjetas: arriba solo lo que hay que pagar, el disponible y el próximo resumen. El resto quedó plegado.
- [x] P10. Flujo de caja: sin gráfico grande. Muestra "Hoy → Fin de mes → 6 meses → 1 año", avisa qué meses dan negativo y lista mes a mes con barras.
- [x] P11. Simulador: los 4 escenarios son tarjetas ordenadas y cada una dice qué cambia.
- [x] P12. Configuración en pestañas (General, Cotizaciones, Seguridad, Plan, Tus datos), sin espacios vacíos. Zona horaria de Buenos Aires con la hora actual. Cotizaciones "en vivo" que se actualizan solas (simulado; en la app real, por API).
- [x] P13. Categorías en tarjetas, con pestañas Gastos e Ingresos, subcategorías como etiquetas y botón para agregar subcategorías.
- [x] P14. Exportar movimientos (vista previa y copiar; en la app real se descarga).
- [x] P15. Recurrentes desde el formulario del gasto o ingreso ("¿Se repite?"); Reglas recurrentes lo explica.
- [x] P16. Asistente con IA preparado como función Pro, apagado por ahora.
- [x] P17. Inversiones y Patrimonio se mantienen como estaban (el usuario los aprobó).

### Negocio
- [x] P18. Panel interno: resumen (usuarios, activos, Pro, ingreso mensual, altas por mes, funciones más usadas), usuarios (buscar, filtrar, cambiar plan, suspender, restablecer dos pasos), suscripciones, pagos (Mercado Pago y Stripe listos para conectar), planes y funciones (precios y qué incluye Gratis, con efecto inmediato en la app), soporte y auditoría.

## Aplicados antes

1. "Disponible para usar" por mes.
2. "+ Nueva cuenta" con formulario propio.
3. "¿Se repite?" en gastos e ingresos.
4. Ventas de cereal integradas al motor (quintales, precio por tonelada, impuesto al cheque).
5. Categoría nueva desde el formulario.
