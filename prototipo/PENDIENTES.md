# NEXO — Pendientes y completados

Regla general: la primera vista de cada pantalla muestra solo lo indispensable. El detalle va detrás de "⋯", "Ver más" o una pantalla propia.
Cuando algo se termina, pasa a "Completado" con la fecha.

## Pendientes

### Necesitan algo tuyo
- [ ] Z2. Cargar las claves reales para activar lo que ya está programado: RESEND_API_KEY y EMAIL_FROM (emails), CRON_SECRET (tarea diaria), MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET y precios (Mercado Pago). Están explicadas en .env.example.
- [ ] Z3. Decidir el precio de Pro en pesos (u otra moneda) para Mercado Pago.
- [ ] Z4. Pasar la base de Railway al plan Hobby.
- [ ] Z5. Cargar los correos de contacto por área y los links de redes en Panel → Ajustes → Contacto y redes.
- [ ] Z6. Nombre y dominio nuevos: avisar y se cambian (el nombre y los datos del titular están en src/lib/brand.ts).
- [ ] Z7. Que un abogado revise los legales (términos, privacidad, reembolsos, cookies, arrepentimiento) antes de hacer publicidad, incluido si alcanza con no tener domicilio físico.
- [ ] Z8. Decidir cómo mostrar el flujo de caja cuando los ingresos no se repiten: "Estimar con mi promedio", "Simular un ingreso" o las dos.

### Probar con una persona real
- [ ] T1. Ingreso al panel interno con Google, con tu cuenta.
- [ ] T2. La bienvenida nueva, de punta a punta.
- [ ] T3. Consultas del sitio: abrirla desde el panel y responder una consulta.

### Para la próxima vuelta
- [ ] P7. Publicar en Play Store y App Store (con Capacitor, la misma app empaquetada). Necesita tus cuentas de desarrollador: Google US$25 una vez, Apple US$99 por año.
- [ ] P8. Notificaciones en el celular (además del email) para los vencimientos.
- [ ] P6. Probar la lectura de PDF con resúmenes reales de varios bancos (Galicia, Santander, BBVA, Nación, Macro, Mercado Pago) y ajustar los formatos que no reconozca.
- [ ] P4. Cuando esté publicado: dar de alta el sitio en Google Search Console y enviar el sitemap (/sitemap.xml).
- [ ] P5. Más herramientas gratis que atraen búsquedas: plazo fijo, conversor de monedas, fondo de emergencia, presupuesto 50/30/20.
- [ ] P1. Asistente con IA (Pro): hoy figura como "próximamente".
- [ ] P2. Espacio compartido (Pro): invitar hasta 3 personas.
- [ ] P9. Funciones Pro en Beta que faltan terminar: exportar a Excel y PDF, importar Excel y OFX, saldo día a día en el flujo de caja.
- [ ] P10. Gestos en el celular: deslizar un movimiento para pagarlo o borrarlo.
- [ ] P11. Modo sin conexión para ver los datos sin internet.
- [ ] P12. "Letra más grande" guardada en la cuenta (hoy queda solo en el dispositivo).
- [ ] P13. Movimientos: "Listo, quedó guardado" aparece dos veces (cartel y aviso de abajo); dejar uno solo.
- [ ] P14. Facturas de AFIP para los cobros de Pro.

### Sitio: marketing y SEO (etapa 3)
- [ ] M1. Guías o blog con artículos que la gente busca en Google.
- [ ] M2. Newsletter y programa de referidos.
- [ ] M3. Medición de visitas sin cookies de publicidad.
- [ ] M4. Testimonios de usuarios reales, cuando los haya (nunca inventados).

## Completado
- [x] 09/11/2026 — Categorías editables (nombre y dónde van), botón ☰ que oculta o muestra el menú en la compu, "Para confirmar" ordenado, landing desde caché y estilos del sitio fuera de la app, pantallas recién vistas al instante, calendario con 7 días en el celular y revisión responsive de 31 páginas.
- [x] 09/11/2026 — Landing con animaciones al bajar: cascada, celular con profundidad, números que cuentan, recorrido del celular por cada función, tabla con tildes, línea de pasos, barra de lectura, brillo en botones e inclinación de tarjetas.
- [x] 09/11/2026 — Landing nueva (diseño aprobado en artefacto), Contacto por 7 áreas con número de trámite, "Consultas del sitio" en el panel, correos por área y redes en Ajustes, legales con datos del titular, reembolsos, cookies y aviso de que no es asesoramiento financiero, Quiénes somos, Seguridad y pie nuevo con Defensa del Consumidor.
- [x] 08/11/2026 — Revisión general (A1 a A19): confirmar antes de borrar o cancelar; movimientos con totales exactos y "Ver más"; próximo cobro después de hoy; pantalla amable ante errores; título "Registrar cobro"; sesión una vez por pantalla; Inicio calcula una vez y muestra primero lo principal; índice para categorías; próximos pagos en paralelo; letra mínima 12 px y "Letra más grande"; menús con Esc; foco visible; botones de 44 px en el celular; palabras más claras (corrección de saldo); "Listo, guardado" con cargar otro y ver o anular; primeros pasos en Inicio; ayuda "?" en proyectado, fue el total, por cobrar y flujo; buscador sin acentos que encuentra deudas y ventas de cereal.
- [x] 08/11/2026 — Revisión de tu papá (R1 a R9): aviso en el flujo cuando los ingresos no se repiten (por eso daba déficit desde 2027), "Corresponde al mes" con cualquier mes y que sigue a la fecha, movimientos entre dos fechas, fecha hasta en pagos que se repiten (al crear y al editar), volver a Próximos pagos después de guardar, consejo para cargar la soja como cobro que se repite, borrar pagos que se repiten, "Terminar" explicado y con sección Terminadas, "Cambiar desde una fecha" ahora cambia también el día.
- [x] 08/11/2026 — Panel interno completo con ingreso propio (Google + lista blanca, roles Dueño/Soporte/Solo mirar): resumen con gráficos, clientes y ficha (sin montos), Pro regalado o reservado por correo, cobros y cupones, soporte con prioridades y respuestas guardadas, avisos en la app, correos masivos, novedades (/novedades), finanzas (ingresos contra gastos), sistema y seguridad, actividad, equipo, ajustes y mantenimiento, descargas para el contador.
- [x] 08/11/2026 — Bienvenida rediseñada (4 pasos cortos con vista previa en vivo), ingresos que varían, "Para confirmar" en Inicio (cobré/pagué con un toque u otro monto y fecha), "Fue el total" y "usar para los próximos meses", borrar categorías sin perder movimientos, descargar mis datos y borrar mi cuenta, ícono de configuración corregido, app más rápida (región junto a la base, menos consultas, pantalla de carga).
- [x] 07/11/2026 — Ingresar con Google: proyecto NEXO en Google Cloud (publicado), claves en Vercel y botón en ingresar y registro.
- [x] 07/11/2026 — App en el celular revisada pantalla por pantalla (375 px): montos, botones, fechas, buscador, presupuestos, flujo, ayudas y tablas ya no se enciman ni se cortan. La computadora sigue igual.
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
- [x] 07/11/2026 — Landing para buscadores: título y descripción, imagen para compartir en redes, sitemap, robots, datos estructurados (organización, aplicación y preguntas frecuentes), idioma español general, la app y el panel interno fuera de Google, una fuente menos para cargar más rápido.
- [x] 07/11/2026 — Herramientas gratis y públicas: ¿Puedo comprarlo en cuotas?, calculadora de préstamos (francés, alemán, americano, con TEA) y glosario. La calculadora de cuotas está en la landing, en lugar del ejemplo con números inventados.
- [x] 07/11/2026 — Movimiento suave solo en la landing (aparición al bajar y cambios al pasar el mouse), sin esconder nada y apagable con "reducir movimiento".
- [x] 07/11/2026 — Tarjetas: estado real (al día, a pagar o atrasado, mirando todos los resúmenes sin pagar), lo que debés en total, y "Cargar un resumen" a mano con cierre, vencimiento, total, mínimo y las cuotas que siguen. La deuda anterior se carga como saldo de la tarjeta, no como gasto nuevo.
- [x] 07/11/2026 — Leer el resumen desde el PDF (Pro, hasta 5 por mes): se lee en el servidor, sin IA ni costo, no se guarda el archivo y nada se guarda sin que lo revises y confirmes.
- [x] 07/11/2026 — Seguridad: máximo 5 códigos de dos pasos fallidos (después se cierra la sesión), máximo 10 cuentas por hora desde la misma conexión, política de contenido del navegador, archivos de hasta 6 MB.
- [x] 07/11/2026 — Arreglado: la tarjeta decía "Al día" aunque hubiera un resumen anterior sin pagar.
- [x] 07/11/2026 — Landing rehecha sin líneas: tarjetas suaves con íconos en círculo, pasos numerados, preguntas en tarjetas, más espacio entre secciones. Animación al bajar que siempre funciona (si Windows tiene las animaciones apagadas, es un fundido sin movimiento) y con respaldo para que nada quede oculto.
- [x] 07/11/2026 — App instalable en el celular: íconos para Android y iPhone, pantalla completa, accesos directos (cargar un gasto, próximos pagos), botón "Instalar app" en Inicio y Configuración (en iPhone muestra cómo hacerlo) y página "Sin conexión". El service worker solo guarda diseño e íconos, nunca datos financieros.
- [x] 07/11/2026 — Landing: barra semitransparente al bajar y desplazamiento suave al tocar las secciones; planes centrados.
- [x] 07/11/2026 — Base de datos en Railway: proyecto "nexo" con PostgreSQL, acceso público activado, las 4 migraciones aplicadas (32 tablas). La dirección está en .env.railway (fuera de GitHub). Para correr un comando contra Railway: node scripts/with-railway.mjs <comando>.
- [x] 07/11/2026 — Publicado en Vercel: https://nexo-eight-sage.vercel.app (plan Hobby), conectado a la base de Railway. Variables cargadas: DATABASE_URL, AUTH_SECRET, CRON_SECRET, DB_POOL_MAX y APP_URL. Cada cambio que se sube a GitHub se publica solo.
