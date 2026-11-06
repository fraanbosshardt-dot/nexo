# NEXO — Pendientes y completados

Regla general: la primera vista de cada pantalla muestra solo lo indispensable. El detalle va detrás de "⋯", "Ver más" o una pantalla propia.

## Pendientes (pedido del 06/11/2026, app real)

### Diseño, en toda la web
- [ ] D1. Sin subrayado en ningún enlace (landing y app).
- [ ] D2. Sin barra de desplazamiento visible en el menú lateral.
- [ ] D3. Animaciones suaves, sin saltos bruscos.
- [ ] D4. Revisar cada pantalla con capturas en escritorio y celular: nada en blanco, nada montado, todo adaptable.

### Internacional
- [ ] I1. No es solo para Argentina: sacar "hecho en Argentina" y "Pensado para cómo se vive acá".
- [ ] I2. Al registrarse se elige país y moneda de una lista amplia; la zona horaria se calcula sola según el país.

### Introducción
- [ ] O1. Mejorar la introducción: más clara, más corta y más linda.

### Funciones (todo terminado, sin pantallas a medias)
- [ ] F1. Reglas recurrentes (también desde el formulario del gasto), calendario y flujo de caja.
- [ ] F2. Tarjetas de crédito y compras en cuotas.
- [ ] F3. Deudas y préstamos, con cronograma y cancelación total.
- [ ] F4. Presupuestos, objetivos y simulador de escenarios.
- [ ] F5. Simulador "¿Puedo comprarlo en cuotas?": responde sí o no según tu dinero y muestra cómo queda tu saldo mes a mes.
- [ ] F6. Inversiones, bienes, patrimonio y ventas de cereal.
- [ ] F7. Alertas y consejos, informes, importar y exportar.

### Negocio
- [ ] N1. Revisar qué queda en Gratis y qué en Pro, y bloquear de verdad lo que es Pro.
- [ ] N2. Panel interno para el dueño con datos reales: usuarios, planes, suscripciones, funciones por plan, soporte y auditoría. Solo entra el administrador.

### Al final, juntos
- [ ] Z1. Conectar Railway, Vercel, la API de cotizaciones y los cobros, y repasar qué más mejorar.

## Para mañana (estado al 06/11/2026)

- R0. Hecho el 07/11: nexo-v2 rehecho con estilo sobrio tipo calendario de escritorio (blanco, líneas finas, un azul, Roboto, sin animaciones). Falta tu visto bueno.
- R1. Revisar el rediseño completo (prototipo/nexo-v2.html, artefacto https://claude.ai/artifact/9gNbpFVT5Tt6X6Pdr2BJGR). Si se aprueba, pasar ese diseño a la app real (globals.css, shell, todas las pantallas).
- R2. App real: faltan Alertas, Informes, Importar y exportar (con rutas de exportación CSV y respaldo), Ayuda y el Panel interno del dueño. Después borrar la página provisoria [seccion].
- R3. Revisión con capturas de todas las pantallas en escritorio y celular.
- R4. Conectar Railway (base) y Vercel (despliegue), cotizaciones por API y cobros. Requiere autorización y que inicies sesión.

## Completado

- [x] 05/11/2026 — Prototipo navegable completo (versión 11), publicado como artefacto.
- [x] 06/11/2026 — App real, Fase 1 y núcleo de Fase 2: registro e inicio de sesión con dos pasos, introducción, cuentas, movimientos, pendientes, pagos parciales, transferencias, conciliación, reversas, categorías, configuración, landing y legales. 28 pruebas automáticas. Subido a GitHub.
