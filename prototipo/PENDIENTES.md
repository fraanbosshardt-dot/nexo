# Finan — Pendientes y completados

Regla general: la primera vista de cada pantalla muestra solo lo indispensable. El detalle va detrás de "⋯", "Ver más" o una pantalla propia.
Cuando algo se termina, pasa a "Completado" con la fecha.

## Pendientes

### Funciones para pulir (de a una)
- [ ] F2. Préstamos: impuesto sobre los intereses (ej. IVA) y seguro sobre el saldo, para que el francés dé igual que el banco.
- [ ] F3. Flujo de caja cuando los ingresos no se repiten (ver Z8: "Estimar con mi promedio", "Simular un ingreso" o las dos).
- [ ] F4. Leer resúmenes en PDF de varios bancos y ajustar los formatos que no reconozca (ver P6; necesita resúmenes reales).
- [ ] F5. Probar en la pantalla la protección contra cobros y pagos duplicados (ya programada y con pruebas).
- [ ] F6. Deudas: adelantar cuotas o precancelación parcial (elegir si baja la cuota o el plazo).
- [ ] F7. Deudas: resumen más claro (intereses totales y pagados, costo real según tus cuotas, qué parte de tus ingresos se va en cuotas, con aviso).
- [ ] F8. Deudas: plata que te deben (préstamos que hiciste vos), como cobros esperados.
- [ ] F9. Deudas: refinanciar (rearmar las cuotas desde la que sigue sin perder lo pagado).
- [ ] F10. Deudas: subir el cronograma en Excel (además de PDF y pegado).

### Necesitan algo tuyo
- [ ] Z2. Cargar las claves reales en Vercel para activar lo que ya está programado: RESEND_API_KEY y EMAIL_FROM (emails), CRON_SECRET (tarea diaria), MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET (Mercado Pago: el Access Token de producción y la clave secreta de Webhooks de la aplicación Finan). Están explicadas en .env.example.
- [ ] Z3. Decidir el precio de Pro en pesos (u otra moneda) para Mercado Pago.
- [ ] Z4. Pasar la base de Railway al plan Hobby.
- [ ] Z5. Cargar los correos de contacto por área y los links de redes en Panel → Ajustes → Contacto y redes.
- [ ] Z7. Que un abogado revise los legales (términos, privacidad, reembolsos, cookies, arrepentimiento) antes de hacer publicidad, incluido si alcanza con no tener domicilio físico.
- [ ] Z9. Activar la medición de visitas en Vercel (proyecto → Analytics → Enable). El código ya está puesto; sin activarlo no mide nada.
- [ ] Z10. Cargar el precio de Pro en pesos en Panel → Ajustes → Precio de Pro (por mes y por año). Mientras esté vacío, la web muestra el de dólares.
- [ ] Z11. Activar copias automáticas de la base en Railway (con el plan Hobby). Hoy se hacen a mano antes de cada cambio.
- [ ] Z12. Con el dominio nuevo: dar de alta Search Console y enviar /sitemap.xml.
- [ ] Z8. Decidir cómo mostrar el flujo de caja cuando los ingresos no se repiten: "Estimar con mi promedio", "Simular un ingreso" o las dos.
- [ ] Z13. Mover la app y la base a la costa este de EE.UU. (Vercel `iad1` y Railway us-east), más cerca de Latinoamérica: ~50-70 ms menos por pedido. Se hace desde Vercel y Railway; avisame y cambio `vercel.json`.
- [ ] Z15. Dominio para Finan: finan.com, finan.app y finanapp.com están ocupados; getfinan.com, usefinan.com y finanhq.com estaban libres el 11/11/2026. Antes de lanzar, buscar "Finan" en el registro de marcas (INPI y los países donde se venda). Cuando haya dominio: cambiar APP_URL en Vercel y la URL del webhook en Mercado Pago (hoy apunta a nexo-eight-sage.vercel.app).
- [ ] Z16. Activar los avisos en el celular: correr npm run vapid y cargar VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT (mailto:tu correo) en Vercel. Sin las claves, la opción no aparece.
- [ ] Z14. Mercado Pago ahora cobra el precio en pesos de Panel → Ajustes → Precio de Pro (el mismo que se muestra). Cargalo ahí; `MP_PRICE_MONTHLY`, `MP_PRICE_YEARLY` y `MP_CURRENCY` ya no se usan y se pueden borrar de Vercel.

### Probar con una persona real
- [ ] T8. Compartir el espacio con alguien real (invitación por correo, aceptar, solo mirar) y recibir un aviso en el celular (Android e iPhone con la app instalada).
- [ ] T6. Deslizar un pago en Próximos pagos desde el celular (no se pudo probar con el dedo en la compu).
- [ ] T7. Abrir en Excel el archivo de Exportar → Movimientos (Excel) y guardar un reporte en PDF desde el celular y la compu.
- [ ] T4. Importar un extracto real de Mercado Pago (CSV desde la app o la web de MP) y revisar que entren bien los movimientos.
- [ ] T5. Recibir los correos nuevos (confirmar correo, contraseña cambiada, ingreso nuevo) cuando esté cargada la clave de Resend.
- [ ] T1. Ingreso al panel interno con Google, con tu cuenta.
- [ ] T2. La bienvenida nueva, de punta a punta.
- [ ] T3. Consultas del sitio: abrirla desde el panel y responder una consulta.

### Para la próxima vuelta
- [ ] P7. Publicar en Play Store y App Store (con Capacitor, la misma app empaquetada). Necesita tus cuentas de desarrollador: Google US$25 una vez, Apple US$99 por año.
- [ ] P6. Probar la lectura de PDF con resúmenes reales de varios bancos (Galicia, Santander, BBVA, Nación, Macro, Mercado Pago) y ajustar los formatos que no reconozca.
- [ ] P4. Cuando esté publicado: dar de alta el sitio en Google Search Console y enviar el sitemap (/sitemap.xml).
- [ ] P1. Asistente con IA (Pro): hoy figura como "próximamente".
- [ ] P11. Modo sin conexión para ver los datos sin internet.
- [ ] P14. Facturas de AFIP para los cobros de Pro.

### Sitio: marketing y SEO (etapa 3)
- [ ] M2. Newsletter.
- [ ] M4. Testimonios de usuarios reales, cuando los haya (nunca inventados).

## Completado
- [x] 12/11/2026 — Orden visual: al cargar un resumen, las cuotas que siguen van en un bloque opcional y el botón Guardar queda abajo, separado, con su explicación; la lista de tarjetas muestra la tarjeta a un lado y los datos al otro (Al día / A pagar, próximo resumen, disponible y uso del límite). Préstamos: al pagar una cuota, lo que ponés es la cuota real de ese mes ("Fue el total" ya marcado), el cronograma la toma y se puede usar ese monto para las próximas cuotas.
- [x] 12/11/2026 — Tarjetas en dos modos. Al crearla se pregunta "¿Cómo querés usar la tarjeta?": solo el resumen (lo más fácil: una vez por mes el total o el PDF, cuenta como un gasto del mes en "Tarjeta de crédito" y el próximo se estima igual al último) o cada compra (detallado, con todo lo profesional). Se cambia desde Editar. Avisos para no cargar mal: en Nuevo movimiento, si el concepto parece el resumen de una tarjeta, pregunta y lleva a cargarlo ahí; al cargar el resumen avisa fechas raras, cierre distinto al habitual, mínimo mayor al total, resumen ya cargado y diferencias grandes con las compras; no deja sumar una compra a un resumen ya cargado del banco (se contaría dos veces) y una compra olvidada de un resumen que Finan cerró solo lo actualiza; al pagar avisa si es menos que el mínimo o más que el total; el cierre y el vencimiento no pueden ser el mismo día.
- [x] 12/11/2026 — Lectura del resumen en PDF mejorada: lee el PDF por posición, como una tabla (títulos arriba y valores abajo, como muchos bancos), y separa pesos y dólares. Si la tarjeta tiene dólares, el mismo formulario carga los dos resúmenes; si no los tiene y el PDF trae dólares, avisa cómo activarlos. Falta probarlo con resúmenes reales de varios bancos (ver P6).
- [x] 12/11/2026 — Tarjeta más simple: arriba solo cuánto pagás (o "Al día"), una tabla con el próximo resumen, lo que debés y las cuotas (con una columna por moneda) y dos botones: Cargar resumen y Registrar compra. El resto quedó en "Más opciones" como mosaico. Una tarjeta nueva muestra los 3 pasos: cargá el resumen → aparece en Próximos pagos → lo pagás. Al pagar un resumen se elige: el total, el mínimo u otro monto. La otra moneda se elige solo si marcás la opción. Préstamos: "Tus cuotas" ordenado en dos pestañas (Pegar del banco / Una por una) y las tasas sin los signos de pregunta.
- [x] 12/11/2026 — Tarjetas de crédito completas: editar y eliminar la tarjeta (o darla de baja); cambiar el cierre y el vencimiento de un mes puntual; pesos y dólares (u otra moneda) en la misma tarjeta, cada moneda con su resumen y el límite compartido con la cotización oficial; suscripciones y débitos automáticos que se cargan solos; adelantar cuotas; devoluciones y reintegros; pagar menos que el total (lo que falta pasa al próximo resumen con el interés de la TNA de financiación, si se cargó); cargos fijos del resumen; al leer el PDF, las compras que faltan en Finan se suman de un toque; uso del límite con aviso (también en Alertas); en qué se fue cada resumen por categoría, comparado con el anterior; tarjetas adicionales con gastos por persona. Lo profesional quedó en "Más detalles".
- [x] 12/11/2026 — F1. Deudas y préstamos, formulario nuevo: lo ideal es subir el contrato en PDF (se lee sin IA, no se guarda el archivo) y Finan completa acreedor, monto, cuotas, cuota, tasas, fechas, sistema y el cronograma completo; vos lo revisás antes de guardar. A mano alcanza con 5 datos (a quién, cuánto, cuántas cuotas, cuánto pagás por mes, primera cuota): con la cuota del banco el francés da igual que el banco y la tasa sale de ahí. "Mis cuotas cambian": pegar el cronograma o cargar/corregir cuota por cuota (cada una con su fecha e importe). Lo técnico quedó en "Más detalles".
- [x] 12/11/2026 — Cuentas agrupadas por tipo (Efectivo, Bancos, Billeteras virtuales, En otra moneda, Inversiones) con el total de cada grupo. Dentro de cada grupo se ordenan arrastrando desde ⠿ (mouse, dedo o flechas del teclado) y ese orden se usa también al elegir cuenta en los formularios.
- [x] 12/11/2026 — Sin duplicados entre lo cargado a mano y lo pendiente: si cargás un cobro o pago que ya figuraba en Próximos pagos (mismo concepto, fecha cercana), se une con ese y queda con el importe real. Al cobrar un pendiente que ya cargaste a mano, Finan te avisa y con "Es el mismo" lo une. "Sí, lo cobré" en Inicio hace lo mismo.
- [x] 12/11/2026 — Lo cargado a futuro (Próximos pagos) se puede corregir o eliminar: tocás el concepto y cambiás concepto, importe, fecha, categoría y notas. Si se repite, el cambio es solo para esa vez. En una cuota de préstamo se puede cambiar el monto (sirve para cuotas que no son todas iguales). Eliminar borra lo cargado por error; si se repite, lo saca solo esa vez. El resumen de la tarjeta y los cobros de cereal se corrigen desde su pantalla.
- [x] 12/11/2026 — Deudas y préstamos: cada préstamo se puede editar o eliminar desde su pantalla. Si todavía no registraste pagos en Finan, se corrige todo (monto, cuotas, tasa, cuota, fechas, sistema) y el cronograma se arma de nuevo; la plata que entró en la cuenta también se corrige. Con pagos registrados se cambian nombre, tipo y notas. Eliminar borra las cuotas, los pagos registrados y la plata que entró (el saldo vuelve a como estaba).
- [x] 12/11/2026 — Movimientos: si te equivocás, se corrige o se elimina (ya no queda "anulado"). Se corrige el concepto, el importe, la categoría, la cuenta (en la misma moneda), la fecha y el mes. Eliminar borra del todo y deshace lo que dependía: las dos partes de una transferencia, las cuotas de una compra con tarjeta, el aporte a una inversión u objetivo, y el pago de un pendiente (que vuelve a quedar por pagar). Los cobros de cereal y los préstamos se corrigen desde su pantalla. El "Deshacer" del aviso de guardado también borra.
- [x] 12/11/2026 — Pulido, segunda vuelta: Informes empieza en el primer mes con datos (y el gráfico toma bien el máximo); Importar con dos botones claros, Revisar e Importar; Ayuda con preguntas sobre corregir saldo, pagos que se repiten, presupuestos, compartir, avisos e importar; en la bienvenida, los campos del ingreso aparecen a la vista; textos sin términos solo de Argentina (impuesto sobre el cobro en Agro, gastos fijos sin "expensas"); el panel interno muestra el estado de los avisos en el celular. Revisado también el panel interno y la vista de compu.
- [x] 12/11/2026 — Pulido (revisión pantalla por pantalla con datos reales, en el celular): Inicio sin transferencias repetidas ni avisos duplicados; Registrar pago propone la cuenta correcta y confirma al volver; Calendario con lista del día al tocarlo; "próxima" fecha correcta en Pagos que se repiten; Cuentas avisa saldos negativos; Presupuestos sin "te queda" negativo cuando no hay límites y con "quedan / de más"; Flujo y Simulador entran en el celular y el Simulador baja al resultado; Inversiones no inventa ganancia y guarda lo que ya tenías; textos más claros en Deudas, Objetivos y Plan; montos que no se cortan; errores de formulario más claros.
- [x] 11/11/2026 — P2. Espacio compartido (Pro): el dueño invita por correo hasta 3 personas con permiso de "carga y edita" o "solo mira" (Configuración → Compartir). Se acepta con la cuenta de ese mismo correo; cada uno elige qué espacio ve desde el menú de su cuenta. Quien solo mira no puede guardar nada. Si el dueño borra su cuenta, su espacio se borra entero.
- [x] 11/11/2026 — P8. Avisos en el celular (Web Push, sin librerías): se activan en Configuración, llegan el día antes de cada vencimiento y viajan sin datos (el celular pide el detalle a la app). En iPhone hace falta instalar la app primero.
- [x] 11/11/2026 — P10. Gestos en el celular: en Próximos pagos, deslizar un pago o cobro hacia la izquierda muestra Pagar/Cobrar y Cancelar (con confirmación). En la compu no cambia nada.
- [x] 11/11/2026 — P9. Funciones Pro en Beta terminadas: saldo día a día en el flujo de caja (próximos 60 días, con el día más bajo), exportar movimientos a Excel (.xlsx real), reporte del mes para imprimir o guardar como PDF, e importar Excel (.xlsx) y OFX/QFX del banco.
- [x] 11/11/2026 — Sin "Hecho en Argentina" en el pie de página ni "Hecho para la Argentina" en Quiénes somos: la plataforma es para cualquier país.
- [x] 11/11/2026 — P15. Arreglado el aviso de React: el contenido de todas las páginas quedaba fuera del <body> en el layout raíz.
- [x] 11/11/2026 — P12. "Letra más grande" se guarda en la cuenta y se aplica en todos tus dispositivos.
- [x] 11/11/2026 — P5. Cuatro herramientas gratis nuevas: plazo fijo, conversor de monedas (cotización oficial), fondo de emergencia y presupuesto 50/30/20, con preguntas frecuentes, imagen para compartir y en el sitemap.
- [x] 11/11/2026 — M1. Cuatro guías nuevas (ya son 8): fondo de emergencia, cómo funciona el plazo fijo, regla 50/30/20 y cómo salir de las deudas (en lugar de aguinaldo, que solo aplica a algunos países).
- [x] 11/11/2026 — Nombre nuevo de la app: Finan (en toda la app, correos, ícono con la F y el panel interno).
- [x] 11/11/2026 — Mercado Pago: aplicación Finan creada (Suscripciones) y notificaciones (webhook) configuradas en modo prueba y productivo, con el evento Planes y suscripciones.
- [x] 11/11/2026 — A20. Agro: stock de cereal sin vender con precio de referencia; suma al patrimonio y baja solo al cargar una venta (vuelve si se borra).
- [x] 11/11/2026 — A21. Importar el extracto de Mercado Pago: el importador reconoce sus columnas (entradas y salidas separadas, fecha con hora) y saltea saldos y filas en cero.
- [x] 11/11/2026 — A15. Ventas de cereal: el arreglo de ventas viejas pasa al mantenimiento de cada 15 minutos, ya no corre en cada visita.
- [x] 11/11/2026 — A16. Primeros pasos según el uso: con el módulo Agro, en lugar de "Cargá tu sueldo" aparece "Cargá tu venta de cereal o estimá los meses".
- [x] 11/11/2026 — A17. "Para confirmar" muestra el total y un botón "Ver N más en Próximos pagos" si hay más de 3.
- [x] 11/11/2026 — P13. Movimientos: "Listo, quedó guardado" aparece una sola vez.
- [x] 11/11/2026 — A11. El freno de intentos de ingreso también cuenta por conexión (30 fallos en 15 minutos), además de por correo.
- [x] 11/11/2026 — A12. Confirmar el correo al registrarse con contraseña: se manda un enlace (firmado, vence en 7 días) y la app muestra un aviso con "Mandame el enlace" hasta confirmarlo. Con Google ya viene confirmado.
- [x] 11/11/2026 — A13. Aviso por email al cambiar la contraseña y al entrar desde un navegador o dispositivo nuevo.
- [x] 11/11/2026 — A14. Notificaciones de Mercado Pago: revisado y se dejan como están. Cada aviso vuelve a consultar el estado real en Mercado Pago, así que repetir uno viejo no cambia nada; rechazarlos por antigüedad podía perder reintentos de pagos reales.
- [x] 11/11/2026 — A5. Inicio y Cuentas muestran el saldo de hoy: lo cargado con fecha futura no se suma antes de tiempo.
- [x] 11/11/2026 — A6. "Prevista" pasa a "estimada" en toda la app (también en los datos guardados). Una venta estimada que pasó ya no aparece como "cobro atrasado": la alerta invita a cargar la venta.
- [x] 11/11/2026 — A7. El CSV de movimientos ya no deja pasar fórmulas que Excel ejecute al abrirlo.
- [x] 11/11/2026 — A8. Movimientos trae de a 200 desde la base y los totales se calculan ahí: no carga 20.000 filas de una vez.
- [x] 11/11/2026 — A9. La tarea diaria solo revisa a quien quiere avisos y procesa de a 20 en paralelo, con hasta 5 minutos.
- [x] 11/11/2026 — A10. Pruebas automáticas en GitHub (tipos y pruebas) en cada cambio a main.
- [x] 11/11/2026 — A1. Un solo precio: Mercado Pago cobra el precio en pesos del panel, el mismo que se muestra. Sin precio cargado, el cobro queda apagado.
- [x] 11/11/2026 — A2. Al cancelar Pro, o si Mercado Pago pausa la suscripción, Pro sigue hasta el fin del período pagado. Configuración muestra hasta cuándo.
- [x] 11/11/2026 — A3. Un doble toque ya no registra el cobro o el pago dos veces: el pendiente se bloquea mientras se registra y el botón se desactiva.
- [x] 11/11/2026 — A4. Inicio: la venta de cereal estimada no cuenta como plata segura en "te queda" ni en el fin de mes; se muestra aparte "si se cumple lo estimado".
- [x] 10/11/2026 — Revisión de la landing (reporte) y todo lo que se podía hacer sin claves: Ingresar fuera de Google y Crear cuenta con su dirección, imágenes para compartir en calculadoras y páginas clave, descripciones completas, datos de la empresa para Google, "Ir a la app" si hay sesión (sin perder velocidad), precio en pesos desde el panel, secciones "Para quién es", "Todo lo que incluye" y "Herramientas gratis", Herramientas/Glosario/Novedades con el diseño nuevo, página Para productores, 4 guías (/guias), medición de visitas sin cookies (Vercel) y programa de referidos (1 mes de Pro para los dos, tope de 12).
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
