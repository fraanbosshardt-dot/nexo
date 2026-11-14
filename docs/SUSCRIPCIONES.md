# Suscripciones y períodos de acceso

La autorización de cobro de Mercado Pago y el acceso a Pro son estados diferentes.

## Reglas

- Gratis no vence. Una prueba se inicia explícitamente, una sola vez por espacio, por 14 × 24 horas. No puede pisar una suscripción ni un checkout en curso.
- Un preapproval autorizado permite futuras renovaciones; por sí solo no concede Pro indefinido. El acceso depende de la prueba vigente, pagos aprobados no revocados o una concesión manual.
- Cada factura autorizada tiene un ID único y un período. Se usa `debit_date` del proveedor, no el día en que llegó el webhook. Si falta, se usa la aprobación y finalmente la creación de la factura. Sin fecha válida, no se procesa.
- Mensual significa un mes calendario, ajustado al último día válido; anual, doce meses. Se conserva la hora exacta. Ejemplos: 31/01 → 28/02 (29 en bisiesto); 29/02 anual → 28/02 siguiente. Las fechas del plan se presentan en la zona horaria del espacio.
- Los webhooks repetidos no suman meses. El mismo ID actualiza la misma factura; acceso y estado se concilian bajo bloqueo del espacio. Se consulta el pago real para detectar devoluciones y contracargos, aunque el resumen de la factura esté atrasado.
- Un rechazo no extiende el acceso. Tampoco revoca otros períodos pagados. Un reembolso total o contracargo deja de cubrir su período; una devolución parcial se registra y mantiene el vencimiento original. El importe neto se refleja en los números del panel.
- Cancelar detiene todos los acuerdos externos conocidos del espacio y conserva el acceso ya cubierto. Un fallo externo no se presenta como baja confirmada. Cancelar no equivale a devolver dinero; las devoluciones se tramitan por soporte y Mercado Pago.
- Cambiar de mensual a anual crea una autorización con inicio al final del período cubierto. Se detiene el acuerdo anterior antes de confirmar el cambio; si falla, se intenta detener el nuevo para evitar dos renovaciones. El webhook de un acuerdo cancelado no reemplaza el actual.
- Al eliminar una cuenta, primero se bloquean nuevas altas de cobro y se cancelan los acuerdos de todos los espacios propios. Si no se puede confirmar, no se borra la cuenta ni el vínculo necesario para reintentar.
- Los planes manuales y regalos no pisan acuerdos de pago en curso. Hay que cancelar primero las renovaciones desde el panel.
- Los precios y descuentos se fijan en el acuerdo al crear el checkout y se cotejan con el proveedor. La página pública y el checkout leen los mismos precios de Ajustes. No se acepta un pago por otro importe/moneda como si cubriera la suscripción.

## Persistencia e idempotencia

`BillingAgreement` conserva cada autorización, incluyendo anteriores y checkouts pendientes. `Invoice` conserva el vínculo, estado del pago, importe devuelto y fechas de cobertura. La migración importa los acuerdos anteriores y preserva `legacyPaidUntil` hasta poder conciliar su historial; no recalcula cobros históricos sin evidencia.

Los checkouts se reservan bajo bloqueo antes del POST externo. Un segundo intento reutiliza un checkout pendiente compatible. Ante un resultado incierto no se hace otro POST a ciegas: se busca por pagador y se verifica la referencia completa. Después de 30 minutos, si la búsqueda completa no encuentra el acuerdo, se permite crear una nueva solicitud. No se depende únicamente de que el proveedor admita idempotencia en `/preapproval`.

Los avisos de cobro y baja entran en `EmailOutbox` dentro de la misma transacción que su estado. La entrega usa una clave única por evento, una reserva temporal y reintentos; un error de Resend no deshace ni oculta una cancelación. Se guarda el ID del envío cuando está disponible. No se envían correos de marketing ni recordatorios financieros personales.

## Operación

- Requiere `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, precio mensual/anual ARS y el webhook `https://somosguafra.com/api/pagos/mercadopago` configurado en Mercado Pago para suscripciones y pagos.
- La firma se comprueba con HMAC y ventana temporal; URL y cuerpo no pueden indicar IDs distintos. El servidor consulta recursos del proveedor; no confía en montos o estados enviados por el navegador.
- La tarea diaria existente reconcilia un lote de acuerdos y recupera correos pendientes sin crear cobros. Los webhooks son el mecanismo principal de actualización; la tarea es el respaldo. En una caída del webhook la reparación automática puede demorarse hasta el siguiente lote diario. Vigilar `billing.reconcile_failed`, checkouts `uncertain` y la cola del panel.
- En caso de caída prolongada de Mercado Pago, no afirmar que la cancelación se completó. Reintentar cuando vuelva o gestionarla en el panel oficial y luego conciliar. Ningún sistema local puede garantizar una modificación externa durante una indisponibilidad del proveedor.
- Las devoluciones reales se realizan desde Mercado Pago por una persona autorizada. Esta revisión no hizo transacciones, cancelaciones ni devoluciones sobre suscripciones reales.

## Pruebas

`tests/billing.test.ts` ejecuta el ciclo con API simulada y PostgreSQL local: alta antes/después de prueba, doble clic, orden de eventos, renovación duplicada, rechazo, devolución total/parcial, contracargo, cambio anual, cancelación fallida, baja administrativa, concesiones y fechas límite. `tests/billing-mail.test.ts` verifica cola y reintentos. `tests/workspace-permissions.test.ts` comprueba autorización independiente del transporte.

Antes de modificar la integración, ejecutar `npm test`, `npm run typecheck` y una compilación con una base local. Una simulación no sustituye la aceptación de punta a punta con cuentas y tarjetas de prueba oficiales de Mercado Pago; nunca usar cobros reales como prueba automática.

Referencias de proveedor: [preapproval](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/get-preapproval/get), [facturas autorizadas](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/get-authorized-payment/get), [búsqueda de facturas](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/authorized-payment-search/get).
