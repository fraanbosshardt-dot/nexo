# Somos Guafra — Arquitectura

## 1. Producto en una frase

Saber en cualquier momento cuánto tengo, cuánto debo, cuánto voy a cobrar y cuánto voy a tener, para decidir sin comprometer lo que viene.

## 2. Stack y por qué

| Pieza | Elección | Motivo |
|---|---|---|
| App web | Next.js 16 (App Router) + React 19 + TypeScript 5.9 | Un solo proyecto con páginas, servidor y API. Se despliega directo en Vercel. |
| Base de datos | PostgreSQL (Railway en producción; PGlite en la computadora, sin Docker) | Relacional, con transacciones y decimales exactos. |
| Acceso a datos | Prisma 7 con `@prisma/adapter-pg` | Tipos generados del modelo y migraciones versionadas. |
| Validación | Zod 4 en cada acción del servidor | Nada entra a la base sin validar. |
| Estilos | CSS propio portado del prototipo + Tailwind 4 (solo utilidades) | Mantiene el diseño aprobado. |
| Pruebas | Vitest 4 sobre PostgreSQL real (PGlite en memoria) | Las reglas financieras se prueban contra la misma migración de producción. |
| Dinero | `decimal.js` con redondeo half-even a 2 decimales | Nunca se usan números de punto flotante para importes. |

Se eligió un monolito modular, sin microservicios: es lo más simple de mantener para el MVP y escala bien hasta miles de usuarios.

## 3. Estructura de carpetas

```
prisma/              modelo de datos (schema.prisma) y migraciones
src/app/             páginas y rutas (App Router)
  actions/           acciones del servidor (formularios): validan, autorizan y llaman al motor
  app/               la aplicación con sesión (Inicio, Movimientos, Cuentas, Próximos pagos…)
  (legal)/[doc]      términos, privacidad y botón de arrepentimiento
  api/health         chequeo de salud
src/server/          motor financiero (ledger.ts) y creación de espacios (workspace.ts)
src/lib/             dinero, fechas, contraseñas, TOTP, cifrado, sesión, módulos y planes
src/components/      piezas de interfaz compartidas
tests/               pruebas automáticas
prototipo/           prototipo navegable aprobado (también en /prototipo.html)
```

Capas: **interfaz** (páginas y componentes) → **acciones** (validación y permisos) → **motor** (`src/server`, reglas de negocio) → **datos** (Prisma). El motor recibe el cliente de base como parámetro, así se prueba sin la interfaz.

## 4. Modelo de datos (resumen)

- **Identidad:** `User`, `Session` (token guardado como hash), `Workspace` (espacio financiero), `Membership` (rol), `Subscription` (plan Gratis o Pro).
- **Dinero:** `Account`, `Category`, `Transaction` (movimiento real de dinero), `Obligation` (lo que hay que pagar o cobrar), `RecurringRule`.
- **Obligaciones especiales:** `Debt` + `DebtInstallment`, `CreditCard` + `CardStatement` + `InstallmentPlan`.
- **Planificación y patrimonio:** `Budget` + `BudgetLine`, `Goal` + `GoalContribution`, `Investment` + `InvestmentMovement`, `Asset`, `Valuation`, `GrainSale`.
- **Soporte:** `ExchangeRate`, `ImportBatch`, `AuditLog`.

Todas las tablas financieras tienen `workspaceId`.

## 5. Reglas del motor financiero

1. **Obligación ≠ movimiento.** Un pendiente (`Obligation`) no mueve dinero. El dinero se mueve solo con un `Transaction`. Un pago es un `Transaction` vinculado a su obligación: el importe no se duplica.
2. **Tres fechas distintas:** `economicPeriod` (a qué mes corresponde), `dueDate` (cuándo vence) y `effectiveDate` (cuándo se movió el dinero). Pagar en noviembre un gasto de octubre lo deja en octubre.
3. **Pagos parciales:** el resto queda pendiente; el estado pasa a `PARTIAL` y luego a `SETTLED`.
4. **Lo vencido no se borra:** una obligación sigue pendiente hasta que se paga o se cancela a mano.
5. **Transferencias:** dos movimientos unidos por `transferGroupId`. No cuentan como ingreso ni gasto y no cambian el patrimonio. Entre monedas distintas se guarda la cotización usada; el importe original nunca se modifica.
6. **Saldo:** saldo inicial + entradas − salidas, calculado siempre desde el libro.
7. **Disponible del mes:** saldo de las cuentas en la moneda principal (sin inversiones) − todo lo que falta pagar en el mes, incluido lo atrasado.
8. **No se mezclan monedas** sin una regla de conversión explícita.
9. **Correcciones trazables:** no se edita el pasado. Revertir crea un movimiento opuesto (`reversalOfId`) y reabre el pendiente si correspondía. La conciliación crea un ajuste registrado.
10. **Idempotencia:** cada formulario manda una clave única; reenviar el mismo formulario no duplica el movimiento.
11. **Aislamiento:** todo se filtra por `workspaceId`. Un id de otro espacio se trata como inexistente.

## 6. Seguridad

- Contraseñas con scrypt (N = 2^15) y sal propia. Nunca se guardan ni se registran en logs.
- Sesiones en base de datos; la cookie es `httpOnly`, `sameSite=lax` y `secure` en producción. El token se guarda solo como hash SHA-256.
- Verificación en dos pasos (TOTP, RFC 6238), compatible con Google Authenticator. El secreto se guarda cifrado con AES-256-GCM (`AUTH_SECRET`).
- Freno a intentos de ingreso: 8 fallos en 15 minutos por correo.
- Acciones del servidor de Next.js con chequeo de origen incluido; validación con Zod en cada una.
- Cabeceras de seguridad (HSTS, nosniff, frame-deny, referrer-policy).
- Registro de auditoría de ingresos, cambios de seguridad y reversas.
- Nunca se piden ni guardan credenciales bancarias.

## 7. Plan por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Base técnica, autenticación con dos pasos, modelo de datos, diseño, introducción, landing y legales | **Hecha** |
| 2 | Cuentas, ingresos, gastos, transferencias, pendientes, pagos parciales, conciliación y reversas | **Hecha (núcleo)** |
| 3 | Reglas recurrentes, calendario y flujo de caja | Implementada |
| 4 | Deudas y préstamos, tarjetas, cuotas y cancelación anticipada | Implementada |
| 5 | Presupuestos, objetivos y simulador | Implementada |
| 6 | Inversiones, bienes, patrimonio y ventas de granos | Implementada |
| 7 | Informes, exportaciones, importación y alertas (sin asistente con IA) | Implementadas |
| 8 | Cobros con Mercado Pago, panel interno y funciones comerciales (sin Stripe) | Implementados; ver SUSCRIPCIONES.md |

## 8. Pruebas de aceptación

Cubiertas hoy en `tests/ledger.test.ts`: 1 (transferencia no es ingreso), 2 (previsto no cambia el saldo), 3 (lo vencido sigue pendiente), 4 (octubre pagado en noviembre), 8 (saldo = suma cronológica), 9 (pago parcial), 10 (monedas y cotización), 11 (inversiones separadas del disponible) y 12 (aislamiento entre usuarios). Además: reversas, importe final distinto del previsto, conciliación e idempotencia.

Las pruebas de recurrencias, tarjetas y cancelación anticipada están en tests/rules.test.ts, tests/statements.test.ts y la familia tests/debts-*.test.ts. La suite completa, incluidas suscripciones y límites de seguridad, se ejecuta con npm test.

## 9. Despliegue

- **Base de datos (Railway):** crear un servicio PostgreSQL y copiar su `DATABASE_URL`.
- **App (Vercel):** importar el repositorio y cargar las variables `DATABASE_URL`, `AUTH_SECRET` y `APP_URL`. El script `vercel-build` genera el cliente, aplica las migraciones (`prisma migrate deploy`) y compila.
- **Salud:** `GET /api/health` responde `{ ok: true, db: "up" }` cuando la base está conectada.
