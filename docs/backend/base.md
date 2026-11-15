# Backend — base

> Lo transversal del backend: se lee siempre. Cada módulo tiene su archivo en `docs/backend/` (índice en `docs/backend.md`; mapa general en `docs/README.md`). Estándares comunes (sobre de respuesta, exception filter, logging, validación, testing, migraciones, env, deploy) en `docs/technical.md`.

## Stack

- **NestJS + TypeScript + PostgreSQL + Prisma**
- Puerto: `3001`
- `JwtAuthGuard` global — valida token y extrae `userId` para scopear todos los recursos

## Arranque (bootstrap)

### CORS

`src/main.ts` habilita CORS al arrancar (`app.enableCors({ origin: CORS_ORIGIN, credentials: true })`). Sin esto, el browser bloquea toda request cross-origin del frontend con error de preflight.

- **`CORS_ORIGIN` es configurable por env** (`src/config/env.schema.ts`): string, opcional, default `http://localhost:3000`. En staging/prod se setea con el dominio real del frontend.
- **Acepta UN SOLO origin (string), no una lista.** Para múltiples origins hay que ajustar el schema y el `enableCors` para que acepten array.
- **`credentials: true`** permite que el frontend mande `Authorization`/cookie cross-origin.

## Estructura y capas

Organización **por módulo/recurso**: un módulo NestJS por entidad.

```
backend/src/
├── movements/        (lista unificada del mes + reportes)
├── transactions/     (movimientos únicos)
├── recurring/        (fijos y calculados)
├── installments/     (cuotas)
├── categories/
├── payment-methods/
├── preferences/
├── simulations/
├── history/          (historial de cambios + deshacer)
├── users/
├── auth/
├── common/           (helpers transversales a varios módulos)
└── prisma/
```

### Capas dentro de cada módulo

- **Controller** — solo HTTP. Recibe la request, valida (DTOs), llama al service y devuelve. Cero lógica de negocio.
- **Service** — la lógica de negocio del recurso. Es la **API pública del módulo**.
- **Repository** — encapsula todas las queries Prisma del recurso. El service nunca esparce queries crudas.
- **DTOs** — shape de entrada/salida de cada endpoint y su validación.

### Propiedad de dominio (cada módulo es dueño de lo suyo)

- **La lógica de un recurso vive únicamente en su módulo.** Guardar, editar o calcular un installment es responsabilidad exclusiva de `installments`; existe **un solo** método para cada operación, en `InstallmentsService`.
- **Ningún módulo accede a los datos de otro por su cuenta.** Si necesita operar sobre installments, **llama a `InstallmentsService`**; nunca toca su repositorio ni su tabla, ni reimplementa la lógica.
- **Una sola fuente de verdad por operación.**
- **Regla de oro:** un módulo le habla a otro solo a través de su **Service**, nunca a través de su Repository ni de su tabla.
- Excepciones documentadas: `MovementsRepository` y `SimulationsService` leen agregaciones de `Transaction` por su repositorio (ver `docs/backend/simulacion.md` §Dependencia unidireccional); el undo y el reaper del historial mutan por Prisma directo (ver `docs/backend/historial.md` §Excepción arquitectónica).

## Capa de datos (Prisma)

El acceso a la DB pasa por **Prisma 7**. `PrismaModule` es **global** y exporta `PrismaService` (integrado en `AppModule`); en runtime `PrismaService` arma el driver adapter con la URL del `ConfigService`. Detalle de Prisma 7 (URL en `prisma.config.ts`, adapter obligatorio, carga de `.env`) en `docs/technical.md` §Migraciones.

### Entidades

La fuente de verdad de tipos, campos y constraints es `backend/prisma/schema.prisma`; modelo completo en `docs/data-model/entidades.md` (índice en `docs/data-model.md`). Acá, qué representa cada una:

| Entidad | Representa |
|---------|-----------|
| `User` | Cuenta. `passwordHash` nullable (cuentas solo-Google no lo tienen) y `timezone` IANA "de casa". |
| `Category` | Clasificación de movimientos, por usuario. Soft delete. |
| `PaymentMethod` | Método de pago, por usuario. Soft delete. |
| `Transaction` | Movimiento único (gasto o ingreso en un instante). Borrado lógico (`deletedAt`). |
| `Recurring` | Movimiento fijo (cadena de filas por `chainId`) o calculado. |
| `InstallmentGroup` | Grupo de cuotas. `amountCents` es el monto **por cuota**; `totalInstallments` es la cantidad. |
| `UserPreferences` | Preferencias. **1:1 con `User`** (`userId` único, `onDelete: Cascade`); contenido en un `Json` `data` (default `{}`). |
| `HistoryEntry` | Entrada del historial: una fila por edición, eliminación o reapertura, con el estado previo en un `snapshot Json`. Contrato en `docs/data-model/historial.md` §Historial de cambios; shape del snapshot en `src/history/history.types.ts`. |
| `Simulation` | Simulación de categoría: `userId` + `categoryId` + tramo (`startMonth`, `endMonth`). **Borrado físico**, índice único `(userId, categoryId)`. |

**Enums:** `MovementType` (`EXPENSE` | `INCOME`), `CategoryScope` (`BOTH` | `EXPENSE` | `INCOME`), `HistoryTargetKind` (`UNICO` | `FIJO` | `CUOTA`) y `HistoryAction` (`EDIT` | `DELETE` | `REOPEN`).

### Decisiones de modelado (no obvias)

- **`onDelete`:**
  - `Cascade` en las FK `userId` — borrar un usuario borra todos sus movimientos y categorías.
  - `Restrict` en las FK `categoryId` — impide borrar físicamente una categoría referenciada. Como las categorías usan soft delete, es el último firewall a nivel DB.
- **Borrado por entidad:** `Transaction`, `Recurring`, `InstallmentGroup`, `Category` y `PaymentMethod` usan **borrado lógico** (`deletedAt`). En movimientos el borrado físico llega con la purga de la entrada de historial (`docs/backend/historial.md`); en `Category`/`PaymentMethod` no llega nunca. `Simulation` es la única que se borra **físicamente** (RF-SIM-004). `Recurring.deletedFrom` es otra cosa: el boundary por mes de un fijo vivo (ver `docs/data-model/entidades.md` §Decisiones de negocio → borrado lógico).
- **Fechas:** `Transaction.occurredAt` es `@db.Timestamptz` (UTC) + `timezone` IANA por registro (ver `docs/technical.md` §Fechas y zonas horarias). `createdAt`/`updatedAt` son de sistema.
- **Mes como `String "YYYY-MM"`:** `Recurring.startMonth` / `Recurring.deletedFrom` / `InstallmentGroup.startMonth`. Fijos y cuotas operan a nivel mes.
- **Montos en centavos (`Int`)** en todas las entidades de movimiento (RN-002). **IDs `cuid()`.**
- **Sin `@@unique([userId, name])` en `Category`** — la unicidad de nombre se valida en aplicación (RN-014; ver `docs/backend/categorias.md`).
- **Índices:** `(userId, occurredAt)` en `Transaction`; `userId` en `Category`, `Recurring` e `InstallmentGroup`.

### Filtro de borrado lógico (`src/common/soft-delete.helper.ts`)

Un movimiento con `deletedAt != null` **no aparece en ninguna lectura de negocio**: listados, totales, reportes, selectores y contadores (RF-HIST-006). El filtro **no se copia a mano**: vive en `src/common/soft-delete.helper.ts` y lo usan **todos** los repositorios que leen `Transaction` / `Recurring` / `InstallmentGroup`:

- **`NOT_DELETED`** — fragmento de `where` de Prisma (`{ deletedAt: null }`), para el ORM.
- **`NOT_DELETED_TRANSACTION_SQL` / `NOT_DELETED_RECURRING_SQL` / `NOT_DELETED_INSTALLMENT_SQL`** — fragmentos `Prisma.sql` equivalentes, uno por alias (`t` / `r` / `ig`), para los `$queryRaw` de `movements.repository.ts` (se componen anidados dentro del template).

**Por qué está centralizado:** un `deletedAt` olvidado **no rompe nada visible**: vuelve a incluir eliminados e **infla totales y reportes en silencio**. Toda query nueva sobre esas tres tablas arranca con el filtro puesto.

**No aplica al módulo `history`:** el undo y el reaper leen y mutan registros eliminados a propósito.

### Migraciones y seed

- Aplicar con `prisma migrate deploy` (prod/CI). Generación de migraciones y seed en `docs/technical.md` §Migraciones de base de datos.

## Módulos

| Módulo | Ruta base | Descripción | Doc |
|--------|-----------|-------------|-----|
| `movements` | `/movements`, `/movements/reports*` | Lista unificada del mes + reportes | `backend/movimientos-mes.md`, `backend/graficos.md` |
| `transactions` | `/transactions` | Movimientos únicos | `backend/unicos.md` |
| `recurring` | `/recurring` | Fijos y calculados | `backend/fijos.md`, `backend/calculados.md` |
| `installments` | `/installments` | Grupos de cuotas | `backend/cuotas.md` |
| `categories` | `/categories` | Categorías (CRUD + soft delete) + `CategoryValidatorService` | `backend/categorias.md` |
| `payment-methods` | `/payment-methods` | Métodos de pago (CRUD + soft delete) | `backend/metodos-pago.md` |
| `preferences` | `/preferences` | Preferencias de usuario (blob JSON) | `backend/preferencias.md` |
| `history` | `/history` | Historial de cambios + deshacer | `backend/historial.md` |
| `simulations` | `/simulations` | Simulaciones de categoría + derivación de los simulados del mes | `backend/simulacion.md` |
| `users` | — | Creación de cuenta + categorías por defecto | §Autenticación |
| `auth` | `/auth` | Registro, login y Google; emisión y validación del JWT | §Autenticación |
| `prisma` | — | PrismaService | §Capa de datos |

## Endpoints

Formato de toda respuesta (sobre `{ success, statusCode, data | error }`) en `docs/technical.md`. Contratos (params y shapes) en `docs/data-model/` (índice en `docs/data-model.md`); mecánica en el archivo de cada módulo.

### DELETE → `204 No Content`, sin body (convención del backend)

Los DELETE responden **`204 No Content` sin cuerpo** — cada controller lo declara con `@HttpCode(HttpStatus.NO_CONTENT)`: `DELETE /categories/:id`, `/payment-methods/:id`, `/simulations/:id`.

- **Excepción — los tres DELETE de movimientos** (`/transactions/:id`, `/recurring/:id`, `/installments/:id`) responden **`200` con `{ historyEntryId }`**: un `204` no puede llevar cuerpo. Contrato en `docs/data-model/historial.md` §Historial de cambios → `historyEntryId`.
- **El `ResponseInterceptor` NO aplica al 204:** Express descarta el body y el cliente recibe un **204 vacío** (no el sobre). El front no parsea JSON en un 204 (ver `docs/technical.md` §Frontend — capa centralizada de llamadas).
- Los errores **nunca** llegan como 204: el `AllExceptionsFilter` siempre responde 4xx/5xx con body JSON.

### Índice de endpoints

| Endpoints | Resumen | Detalle |
|---|---|---|
| `GET /movements?month=YYYY-MM` | Movimientos del mes (únicos + fijos + cuotas + simulados) más totales; fijos y cuotas on-the-fly | `backend/movimientos-mes.md` |
| `GET /movements/reports?year=&categories=&currency=&types=&direction=&includeSimulated=&projectFixed=&today=` | Serie anual agregada (12 meses + desglose por categoría); no devuelve movimientos individuales | `backend/graficos.md` §Serie de reportes |
| `GET /movements/reports/annual-unicos?year=&categories=&currency=&today=&anchorAmountCents=&anchorCurrency=` | Grilla día × mes de gastos Únicos + footer de métricas (card `unique-grid`) | `backend/graficos.md` §Reporte anual de Únicos |
| `GET /movements/reports/annual-cuotas?year=&categories=&currency=` | Gantt anual de gastos en Cuotas (card `installment-gantt`); no usa `today` | `backend/graficos.md` §Reporte anual de Cuotas |
| `GET /movements/reports/annual-inflation-income?year=&categories=&currency=&today=` | Inflación vs Ingresos + tendencias OLS (card `inflation-income`) | `backend/graficos.md` §Reporte anual de Inflación vs Ingresos |
| `GET /movements/reports/fijos-historico?rangeMonths=&currency=&today=&chainId=` | Serie de los últimos N meses por fijo (card `fixed-evolution` y su variante acotada); no acepta `categories` | `backend/graficos.md` §Detalle histórico de Fijos |
| `POST /transactions` · `GET/PATCH/DELETE /transactions/:id` · `POST /transactions/:id/skip` · `POST\|PATCH /transactions/:id/calculated` | Únicos | `backend/unicos.md` |
| `POST /recurring` · `PATCH/DELETE /recurring/:id` · `POST /recurring/:id/skip` · `POST\|PATCH /recurring/:id/calculated` · `GET /recurring/:id/reopen-preview` · `POST /recurring/:id/reopen` | Fijos, anulación, calculados y reapertura. **No hay `GET /recurring/:id`** | `backend/fijos.md`, `backend/calculados.md` |
| `POST /installments` · `PATCH/DELETE /installments/:id` · `POST /installments/:id/skip` · `POST\|PATCH /installments/:id/calculated` | Cuotas. Solo `EXPENSE` en v1. **No hay `GET /installments/:id`** | `backend/cuotas.md` |
| `GET/POST /categories` · `POST /categories/:id/reactivate` · `PATCH/DELETE /categories/:id` | Categorías | `backend/categorias.md` |
| `GET/POST /payment-methods` · `POST /payment-methods/:id/reactivate` · `PATCH/DELETE /payment-methods/:id` | Métodos de pago | `backend/metodos-pago.md` |
| `GET /preferences` · `PUT /preferences` | Blob de preferencias; el `PUT` reemplaza entero (upsert) | `backend/preferencias.md` |
| `POST /simulations` · `GET /simulations` · `GET /simulations/candidates` · `PATCH /simulations/:id/extend` · `DELETE /simulations/:id` | Simulaciones. `POST` = alta múltiple que responde `201` aun con fallos por categoría; `DELETE` = borrado físico, sin historial. El `POST`, los dos `GET` y el `PATCH` aceptan `today` | `backend/simulacion.md` |
| `GET /history` · `POST /history/:id/undo` | Historial + deshacer (sin body, resuelve la cadena solo; responde `200 { undone: true }`) | `backend/historial.md` |
| `POST /auth/register` · `POST /auth/login` · `POST /auth/google` | Auth | §Autenticación |
| `GET /health` | Health check (público) | `docs/technical.md` §Deploy |

## Autenticación

El `AuthModule` es el **emisor del JWT**: el backend es la autoridad de identidad y firma el token que el frontend reenvía en cada request (ver `docs/architecture.md`).

### Endpoints

El payload de éxito (`data`) de los tres endpoints es `{ accessToken, user, preferences }`, con `user = { id, email, name|null, image|null }` y `preferences` = blob de preferencias (`{}` si no tiene fila; ver `docs/backend/preferencias.md`). Lo arma `buildAuthResult`, **`async`** porque lee las preferencias.

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /auth/register` | `{ email, password }` (`password` ≥ 8) | `201` | `400` validación · `409` email ya registrado |
| `POST /auth/login` | `{ email, password }` | `200` | `400` validación · `401` credenciales inválidas |
| `POST /auth/google` | `{ email (req), name?, image?, googleId?, idToken? }` | `200` | — |

- **`POST /auth/login` — mensaje genérico.** Ante credenciales inválidas, `401` con `"Credenciales inválidas"`. **No distingue** email de contraseña (RF-AUTH-005, A1): no revela qué emails existen.
- **`POST /auth/google` — upsert** por email. Categorías por defecto **solo si es alta nueva** (`skipDuplicates`). El `idToken` **no se verifica server-side**.

### Hashing de contraseña

**argon2id** (RN-012). Las cuentas solo-Google no tienen `passwordHash`.

### JWT

- **HS256**, firmado con `JWT_SECRET`.
- Claims: `sub = userId` (cuid), `iat`, `exp` (**30 días**).
- El frontend lo trata como **opaco**: lo guarda y lo reenvía.

### Guard global y rutas públicas (RNF-001)

- **`JwtAuthGuard` es global:** **todo endpoint nuevo está protegido por defecto**.
- Para una ruta **sin** auth, decorarla con **`@Public()`** (`src/auth/public.decorator.ts`). Lo llevan los tres endpoints de auth y `GET /health`.
- El guard inyecta `request.user = { userId }` a partir del claim `sub`.

### Categorías por defecto al alta (RF-CAT-001)

Al crear una cuenta nueva (por cualquiera de los dos métodos) se generan 4 categorías, todas `scope: BOTH`, con los **primeros 4 colores de `COLOR_POOL`** en orden:

| Categoría | Color |
|-----------|-------|
| Consumibles | `#E23B3B` |
| Tarjeta de crédito | `#1AA5B0` |
| Gastos fijos | `#E3B92E` |
| Servicios | `#8B4FD4` |

`AuthService` importa el pool central (`src/categories/color-pool.ts`; ver `docs/backend/categorias.md` §Pool de colores); no hay hex sueltos. No se duplican si el usuario ya existía. Las categorías por defecto son lógica de alta, no un seed (`docs/technical.md` §Categorías por defecto vs seed).

El alta nueva también crea la fila `UserPreferences` (blob `{}`) — `register` y `google` con usuario nuevo (no el `google` de un usuario existente).
