# NEXO

Plataforma de finanzas personales y planificación patrimonial, pensada para Argentina: pesos y dólares, cuotas, tarjetas, deudas, flujo de caja, presupuestos, objetivos, inversiones y ventas de granos.

La arquitectura, las reglas del motor financiero y el plan por fases están en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Qué funciona hoy

- Registro, inicio de sesión y verificación en dos pasos con Google Authenticator.
- Introducción que arma el menú según para qué vas a usar la app.
- Cuentas, ingresos, gastos y transferencias (también entre pesos y dólares).
- Pendientes, pagos parciales, atrasados que no se borran, conciliación y reversas.
- Inicio con el disponible del mes, lo que falta cobrar y pagar, y los últimos movimientos.
- Categorías, configuración, funciones activables, landing y legales.
- El prototipo completo de todas las pantallas, en `/prototipo.html`.

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
