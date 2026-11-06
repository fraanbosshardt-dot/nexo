# NEXO — Pendientes y completados

Regla general: la primera vista de cada pantalla muestra solo lo indispensable. El detalle va detrás de "⋯", "Ver más" o una pantalla propia.
Cuando algo se termina, pasa a "Completado" con la fecha.

## Pendientes

### Necesitan algo tuyo
- [ ] G8. Ingresar con Google. Necesita que crees el acceso en Google Cloud (lo hacemos juntos).
- [ ] Z1. Conectar Railway (base) y Vercel (despliegue). Requiere tu autorización y que inicies sesión.
- [ ] Z2. Cargar las claves reales para activar lo que ya está programado: RESEND_API_KEY y EMAIL_FROM (emails), CRON_SECRET (tarea diaria), MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET y precios (Mercado Pago). Están explicadas en .env.example.
- [ ] Z3. Decidir el precio de Pro en pesos (u otra moneda) para Mercado Pago.

### Para la próxima vuelta
- [ ] P1. Asistente con IA (Pro): hoy figura como "próximamente".
- [ ] P2. Espacio compartido (Pro): invitar hasta 3 personas.
- [ ] P3. Revisión con capturas pantalla por pantalla en celular (se revisó que nada se corra de costado; falta mirar cada una con calma).

## Completado

- [x] 05/11/2026 — Prototipo navegable completo (versión 11), publicado como artefacto.
- [x] 06/11/2026 — App real, Fase 1 y núcleo de Fase 2: registro e inicio de sesión con dos pasos, introducción, cuentas, movimientos, pendientes, pagos parciales, transferencias, conciliación, reversas, categorías, configuración, landing y legales. 28 pruebas automáticas. Subido a GitHub.
- [x] 06/11/2026 — Sin subrayados, sin barra de desplazamiento en el menú, nada de "hecho en Argentina"; país y moneda de una lista amplia con zona horaria automática.
- [x] 06/11/2026 — Reglas recurrentes, calendario, flujo de caja, tarjetas y cuotas, deudas con cancelación total, presupuestos, objetivos, simulador (¿puedo comprarlo en cuotas? y escenarios), inversiones, bienes, patrimonio y ventas de cereal. Free y Pro con prueba de 14 días.
- [x] 07/11/2026 — Diseño nuevo sobrio en toda la app real (estilo calendario de escritorio, sin animaciones), revisado en escritorio y celular.
- [x] 07/11/2026 — Bienvenida nueva: país detectado, para qué la usás, cuenta con varios ingresos fijos, resumen con vista previa de Inicio, barra de progreso simple.
- [x] 07/11/2026 — Menú lateral sin textos encimados, "Nuevo movimiento" en la barra superior, contenido centrado.
- [x] 07/11/2026 — Seguridad: los formularios nunca mandan los datos en la dirección, aunque se envíen antes de que cargue la página.
- [x] 07/11/2026 — Pantallas que faltaban: Alertas y consejos, Informes (Pro), Importar y exportar (CSV con vista previa, deshacer importación, descarga de movimientos y respaldo completo), Ayuda con consultas a soporte. Se borró la página provisoria.
- [x] 07/11/2026 — Panel interno con datos reales: resumen (usuarios, nuevos, activos, Pro, prueba, ingreso por mes, activación), usuarios (cambiar plan, suspender, quitar dos pasos), planes y funciones con precios, soporte con respuesta y actividad. Comando npm run admin -- email.
- [x] 07/11/2026 — Próximos pagos en una sola lista por fecha, con pagos y cobros juntos, filtros y totales de la semana. Calendario como pestaña.
- [x] 07/11/2026 — Inicio responde "¿cuánto puedo gastar?": te queda hasta tu próximo cobro, por día, esta semana, lo último cargado y una alerta.
- [x] 07/11/2026 — Cargar un gasto en 5 segundos: importe y concepto, categoría sugerida, última cuenta usada; otra fecha, cuenta, estado y repetir en "Más opciones".
- [x] 07/11/2026 — Editar un movimiento ya cargado, y aviso "Guardado · Deshacer".
- [x] 07/11/2026 — Buscar en toda la app desde la barra superior.
- [x] 07/11/2026 — Recuperar contraseña por email (enlace de un uso, vence en 1 hora, cierra las sesiones). Sin clave de email, el enlace sale en la consola del servidor.
- [x] 07/11/2026 — Avisos por email un día antes de cada vencimiento, con opción de apagarlos en Configuración. Tarea diaria programada en vercel.json.
- [x] 07/11/2026 — Cotizaciones automáticas (open.er-api.com, sin clave) con cruzadas desde el dólar; la manual siempre gana.
- [x] 07/11/2026 — Cobro de Pro con Mercado Pago: suscripción mensual o anual, notificaciones con firma verificada, cancelar, y facturas. Queda apagado hasta cargar las claves.
- [x] 07/11/2026 — Se puede instalar en el celular como app (manifest e ícono).
- [x] 07/11/2026 — Ayuda en contexto ("?") para TNA, TEA y CFT.
- [x] 07/11/2026 — Filtros de Movimientos siempre visibles; flujo de caja sin "Hipotéticos"; panel del avatar simple; menú más corto (Calendario dentro de Próximos, Inversiones y Patrimonio juntos, Categorías, Pagos que se repiten e Importar dentro de Configuración).
- [x] 07/11/2026 — Fechas cortas ("10 nov") en toda la app; estados vacíos con una acción; funciones Pro con una tarjeta chica y "Probar gratis 14 días".
- [x] 07/11/2026 — 42 pruebas automáticas (se sumaron firma de Mercado Pago, cotizaciones cruzadas y fechas).
