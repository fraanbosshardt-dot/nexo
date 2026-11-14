# Somos Guafra

Sitio: https://somosguafra.com · Repositorio: https://github.com/fraanbosshardt-dot/somosguafra

Plataforma de finanzas personales y planificación patrimonial, pensada para Argentina: pesos y dólares, cuotas, tarjetas, deudas, flujo de caja, presupuestos, objetivos, inversiones y ventas de granos.

La arquitectura, las reglas del motor financiero y el plan por fases están en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Qué funciona hoy

- Autenticación con correo o Google, verificación de correo, TOTP, recuperación y revocación de sesiones.
- Cuentas, transferencias entre monedas, movimientos, pendientes, pagos parciales y conciliación.
- Tarjetas por resumen o por compra, cuotas, suscripciones, PDF, deudas y préstamos.
- Recurrentes, calendario, flujo de caja, presupuestos, objetivos y escenarios guardados.
- Inversiones, patrimonio, ventas y stock de cereal; cotizaciones y tasas manuales.
- Informes, comparación interanual, importación CSV/Excel/OFX y exportaciones CSV/Excel/PDF/JSON.
- Espacios compartidos con permisos, soporte, referidos, planes y panel interno.
- Suscripciones de Mercado Pago con períodos de acceso conciliados y correo transaccional en cola.
- Landing, herramientas públicas, guías, contacto, novedades y documentos legales.

La demo antigua fue retirada de producción. Sus URLs redirigen a Herramientas.
El flujo de dinero y sus casos de prueba están documentados en [docs/SUSCRIPCIONES.md](docs/SUSCRIPCIONES.md).

## Correr en tu computadora (Windows, sin Docker)

Necesitás Node.js 20.19 o más nuevo.

```bash
npm install
```

Copiá `.env.example` como `.env` y completá `AUTH_SECRET` (el archivo explica cómo generarla).

En una terminal, levantá la base local (queda corriendo):

```bash
npm run db:local
```

En otra terminal, aplicá las migraciones y arrancá la app:

```bash
npm run db:migrate
```

```bash
npm run dev
```

Abrí http://localhost:3000.

## Pruebas

```bash
npm test
```

Corren contra un PostgreSQL real en memoria, con la misma migración que producción.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | App en modo desarrollo |
| `npm run build` | Compila para producción |
| `npm test` | Pruebas automáticas |
| `npm run typecheck` | Revisa los tipos |
| `npm run db:local` | PostgreSQL local con PGlite (puerto 5434) |
| `npm run db:migrate` | Aplica las migraciones a la base de `DATABASE_URL` |
