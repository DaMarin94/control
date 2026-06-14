# Backend

## Stack

- **NestJS + TypeScript + PostgreSQL + Prisma**
- Puerto: `3001`
- JwtAuthGuard global — valida token y extrae `userId` para scopear todos los recursos

## Arranque (bootstrap)

### CORS

`src/main.ts` habilita CORS al arrancar (`app.enableCors({ origin: CORS_ORIGIN, credentials: true })`). Sin esto, el browser bloquea toda request cross-origin del frontend con error de preflight (era el bug que se corrigió).

- **`CORS_ORIGIN` es configurable por env** (declarada en `src/config/env.schema.ts`): string, opcional, default `http://localhost:3000` (el frontend local). En staging/prod se setea con el dominio real del frontend.
- **Acepta UN SOLO origin (string), no una lista.** Para soportar múltiples origins hay que ajustar el schema (`CORS_ORIGIN`) y el `enableCors` para que acepten array.
- **`credentials: true`** permite que el frontend mande `Authorization`/cookie cross-origin.

## Estructura y capas

Organización **por módulo/recurso**: un módulo NestJS por entidad.

```
backend/src/
├── movements/      (lista unificada del mes)
├── transactions/   (movimientos únicos)
├── recurring/      (fijos)
├── installments/   (cuotas)
├── categories/
├── users/
├── auth/
└── prisma/
```

### Capas dentro de cada módulo

- **Controller** — solo HTTP. Recibe la request, valida (DTOs), llama al service y devuelve. Cero lógica de negocio.
- **Service** — la lógica de negocio del recurso. Es la **API pública del módulo**: lo que otros módulos pueden llamar.
- **Repository** — encapsula todas las queries Prisma del recurso. El service nunca esparce queries crudas; siempre pasa por el repositorio.
- **DTOs** — definen el shape de entrada/salida de cada endpoint y su validación.

### Propiedad de dominio (cada módulo es dueño de lo suyo)

- **La lógica de un recurso vive únicamente en su módulo.** Guardar, editar o calcular un installment es responsabilidad exclusiva del módulo `installments`. Existe **un solo** método para cada operación, y vive en `InstallmentsService`.
- **Ningún módulo accede a los datos de otro por su cuenta.** Si un módulo necesita operar sobre installments, **llama a `InstallmentsService`** (la API pública del módulo). Nunca toca el repositorio ni la tabla de installments directamente, ni reimplementa esa lógica.
- **Una sola fuente de verdad por operación.** No se duplica la lógica de un recurso en otro módulo. Si la regla de guardado de un installment cambia, cambia en un solo lugar y todos los que lo usan quedan correctos automáticamente.
- **Regla de oro:** un módulo le habla a otro solo a través de su **Service**, nunca a través de su Repository ni de su tabla.

## Capa de datos (Prisma)

El acceso a la DB pasa por **Prisma 7**. `PrismaModule` es **global** y exporta `PrismaService` (integrado en `AppModule`); los services lo inyectan y los repositorios de cada módulo se construyen encima. El detalle de Prisma 7 (URL en `prisma.config.ts`, driver adapter obligatorio, carga de `.env`) está en `docs/technical.md`, sección Migraciones.

### Entidades

La fuente de verdad de tipos, campos y constraints es `backend/prisma/schema.prisma`. Acá se resume qué representa cada una y las decisiones de modelado, no el schema completo.

| Entidad | Representa |
|---------|-----------|
| `User` | Cuenta. Tiene `passwordHash` nullable (cuentas solo-Google no lo tienen) y `timezone` IANA "de casa". |
| `Category` | Clasificación de movimientos, por usuario. Soft delete. |
| `Transaction` | Movimiento único (gasto o ingreso en un instante). Hard delete. |
| `Recurring` | Movimiento fijo mensual (plantilla activa desde un mes). |
| `InstallmentGroup` | Grupo de cuotas. `amountCents` es el monto **por cuota**, no el total; `totalInstallments` es la cantidad. |

**Enums:** `MovementType` (`EXPENSE` | `INCOME`) y `CategoryScope` (`BOTH` | `EXPENSE` | `INCOME`).

### Decisiones de modelado (no obvias)

- **`onDelete`:**
  - `Cascade` en las FK `userId` — borrar un usuario borra todos sus movimientos y categorías.
  - `Restrict` en las FK `categoryId` — impide borrar físicamente una categoría mientras la referencien movimientos. Como las categorías usan soft delete, el caso no debería ocurrir; el `Restrict` es el último firewall a nivel DB.
- **Borrado por entidad:** `Transaction` es **hard delete** (sin `deletedAt`); `Category` es **soft delete** (`deletedAt`). `Recurring` no se borra físicamente: usa `deletedFrom` para dejar de aparecer desde un mes.
- **Fechas:** `Transaction.occurredAt` es `@db.Timestamptz` (UTC) + `timezone` IANA por registro (ver `docs/technical.md`, Fechas y zonas horarias). El resto de timestamps (`createdAt`, `updatedAt`) son de sistema.
- **Mes como `String "YYYY-MM"`:** `Recurring.startMonth` / `Recurring.deletedFrom` / `InstallmentGroup.startMonth`. Fijos y cuotas operan a nivel mes, sin día ni hora.
- **Montos en centavos (`Int`)** en todas las entidades de movimiento (RN-002). **IDs `cuid()`.**
- **Sin `@@unique([userId, name])` en `Category`** — la unicidad de nombre se valida en lógica de aplicación (comparación normalizada + flujo crear-o-reactivar). Ver `docs/data-model.md` y RN-014.
- **Índices:** `(userId, occurredAt)` en `Transaction` para la consulta de movimientos por mes; `userId` en `Category`, `Recurring` e `InstallmentGroup`.

### Migraciones y seed

- Aplicar con `prisma migrate deploy` (prod/CI) o `prisma migrate dev` (desarrollo). La migración inicial ya está aplicada.
- Seed de desarrollo: `pnpm db:seed` (solo desarrollo). Detalle en `docs/technical.md`.

## Módulos

| Módulo | Ruta base | Descripción |
|--------|-----------|-------------|
| `movements` | `GET /movements` | Lista unificada del mes (transacciones + recurrentes + cuotas) |
| `transactions` | `/transactions` | Movimientos únicos (CRUD) |
| `recurring` | `/recurring` | Movimientos fijos (crear, editar, eliminar) |
| `installments` | `/installments` | Grupos de cuotas (crear, editar, eliminar) |
| `categories` | `/categories` | Categorías (CRUD + soft delete) |
| `users` | — | Creación de cuenta + categorías por defecto |
| `auth` | `/auth` | Registro, login y Google; emisión y validación del JWT (guard global) |
| `prisma` | — | PrismaService |

## Endpoints

El formato de toda respuesta (sobre `{ success, statusCode, data | error }`) está definido en `docs/technical.md`. Los DTOs y shapes concretos se definen al implementar cada endpoint.

### DELETE → `204 No Content`, sin body (convención del backend)

Los cuatro DELETE (`DELETE /categories/:id`, `/transactions/:id`, `/recurring/:id`, `/installments/:id`) responden **`204 No Content` sin cuerpo**, de forma deliberada y consistente — cada controller lo declara con `@HttpCode(HttpStatus.NO_CONTENT)`.

- **El `ResponseInterceptor` NO aplica al 204.** Aunque el interceptor envuelve las respuestas exitosas en el sobre `{ success, statusCode, data }`, en un `204` Express descarta el body: el cliente recibe un **204 vacío** (no el sobre). Por eso el front no debe intentar parsear JSON en un 204 (ver gotcha de `apiRequest` en `.claude/agents/control-frontend.md`).
- Los errores **nunca** llegan como 204: el `AllExceptionsFilter` siempre responde 4xx/5xx con body JSON. Un 204 es siempre éxito.

### `GET /movements?month=YYYY-MM`
Devuelve todos los movimientos del mes **más los totales**: transacciones únicas, recurrentes activos y cuotas que caen en el mes. Los recurrentes y cuotas se calculan on-the-fly — no hay filas generadas por instancia mensual. Contrato completo en la sección **Movimientos del mes (MovementsModule)**.

### `POST /transactions` · `PATCH /transactions/:id` · `DELETE /transactions/:id`
CRUD de movimientos únicos. El monto siempre en centavos (entero > 0). El instante se guarda en UTC más la zona original del registro (ver fechas/timezone en `docs/technical.md`).

### `POST /recurring` · `PATCH /recurring/:id` · `DELETE /recurring/:id`
Gestión de movimientos fijos. El PATCH y el DELETE reciben el mes actual (`currentMonth`) para resolver la inmutabilidad del pasado; el DELETE además usa `fromCurrentMonth` (query) para controlar desde cuándo deja de aparecer el fijo. Contrato completo en la sección **Movimientos fijos (RecurringModule)**. **No hay `GET /recurring/:id`.**

### `POST /installments` · `PATCH /installments/:id` · `DELETE /installments/:id`
Gestión de grupos de cuotas. **Solo `EXPENSE` en v1** (rechaza `INCOME` con `400`). El PATCH edita el grupo completo in-place (RF-MC-003). El DELETE es **hard delete del grupo entero** (todas las cuotas, pasadas y futuras). **No hay `GET /installments/:id`**: el front prefilea desde el `MovementItem` de `/movements`. Contrato completo en la sección **Movimientos en cuotas (InstallmentsModule)**.

### `GET /categories` · `POST /categories` · `PATCH /categories/:id` · `DELETE /categories/:id`
CRUD de categorías. El DELETE es soft delete (`deletedAt`). Ver el contrato completo en la sección **Categorías (CategoriesModule)**.

## Movimientos únicos (TransactionsModule)

CRUD completo, **scopeado por `userId` del JWT** (un usuario nunca ve ni toca movimientos de otro). Todas las respuestas exitosas devuelven el shape de Transaction, con la **categoría embebida**.

### Shape de Transaction

```
Transaction = {
  id, userId,
  categoryId,
  type: "EXPENSE" | "INCOME",
  amountCents: int,                  // entero en centavos, siempre > 0 (RN-002)
  description: string | null,
  occurredAt: string,                // ISO 8601 en UTC (instante, no fecha de calendario)
  timezone: string,                  // IANA del registro (ej. "America/Argentina/Buenos_Aires"), RN-004
  createdAt, updatedAt,
  category: { id, name, color, scope }  // embebida en toda respuesta
}
```

- **La categoría viene embebida** (`{ id, name, color, scope }`) en toda respuesta exitosa — el front no necesita un GET extra de categorías para mostrar nombre y color del movimiento.

### Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /transactions` | `{ type, amountCents, categoryId, occurredAt, timezone, description? }` | `201` · `data: Transaction` | `400` |
| `GET /transactions/:id` | — | `200` · `data: Transaction` | `404` |
| `PATCH /transactions/:id` | parcial (cualquier campo de POST) | `200` · `data: Transaction` | `400` · `404` |
| `DELETE /transactions/:id` | — | `204 No Content` | `404` |

- **`POST /transactions`** — `amountCents` entero **en centavos** (`> 0`); `occurredAt` ISO 8601 en **UTC**; `timezone` IANA. `400` por validación de DTO o por categoría inválida (ver Validación de categoría abajo).
- **`GET /transactions/:id`** — `404` si no existe o no es del usuario.
- **`PATCH /transactions/:id`** — body parcial (cualquier campo del POST). **Reaplica todas las validaciones** (RN-002 monto, RN-010 scope). `404` si no existe o no es del usuario.
- **`DELETE /transactions/:id`** — **hard delete** (permanente, RF-MU-003; la entidad no tiene `deletedAt`). **`204` sin cuerpo.** `404` si no existe o no es del usuario.

> **`GET /transactions?month&timezone` fue eliminado (Fase 5).** El listado del mes ya **no** vive en `transactions`: lo reemplaza `GET /movements?month=YYYY-MM` (ver la sección **Movimientos del mes (MovementsModule)**), que unifica únicos + fijos + cuotas y agrega los totales. De `transactions` solo quedan los cuatro endpoints de la tabla de arriba (`POST`, `GET /:id`, `PATCH`, `DELETE`).

### Validación de categoría (RN-010) — siempre 400, nunca 409

Se valida en **create y update**. El movimiento exige una categoría **propia, activa y con scope compatible**:

- **Scope (RN-010):** `EXPENSE` requiere categoría con scope `EXPENSE` o `BOTH`; `INCOME` requiere `INCOME` o `BOTH`.
- Categoría **inexistente, ajena (de otro usuario), eliminada (soft delete) o con scope incompatible** son todas **`400 BadRequest`** — es validación de input, **no `409`**.
- **No revela ajenidad:** si la categoría es de otro usuario, el error es **idéntico** al de "inexistente" — no filtra si el `id` existe en la DB de otro.

## Movimientos del mes (MovementsModule)

Endpoint unificado que devuelve **todos los movimientos del mes más los totales**, scopeado por `userId` del JWT. Reemplaza al eliminado `GET /transactions?month&timezone` (Fase 5). Su estructura está diseñada para incorporar fijos y cuotas en Fases 6/7 sin rehacer el contrato; hoy solo `unicos` trae datos.

### `GET /movements?month=YYYY-MM`

- **`month` (`YYYY-MM`) es el único query param y es obligatorio:** si falta o tiene formato inválido, `400`. **No recibe `timezone`** (a diferencia del endpoint eliminado): el mes de cada movimiento se calcula con la zona propia del registro (ver Bucketeo abajo).

```
data = {
  month: "YYYY-MM",
  totals: {
    expenseCents: int,   // suma de gastos del mes
    incomeCents: int,    // suma de ingresos del mes
    balanceCents: int    // incomeCents - expenseCents (puede ser negativo)
  },
  movements: {
    unicos: [MovementItem],   // ordenados por amountCents DESC (desempate: occurredAt DESC)
    fijos:  [MovementItem],   // ordenados por amountCents DESC (desempate: createdAt DESC)
    cuotas: [MovementItem]    // ordenados por amountCents DESC (desempate: id ASC)
  }
}
```

### Orden de las listas — por `amountCents` DESC

Los tres grupos (`unicos`, `fijos`, `cuotas`) vienen ordenados por **`amountCents` descendente** (monto más alto primero). Como `amountCents` es siempre positivo, el orden es por **magnitud**, sin distinguir `EXPENSE` de `INCOME`. El desempate estable, cuando los montos son iguales, es por grupo:

- **`unicos`** — `occurredAt` DESC (más reciente primero).
- **`fijos`** — `createdAt` DESC.
- **`cuotas`** — `id` ascendente (CUID, determinístico).

```
MovementItem = {
  id: string,
  origin: "unico" | "fijo" | "cuota",        // discriminador del tipo de movimiento
  type: "EXPENSE" | "INCOME",
  amountCents: int,
  description: string | null,
  occurredAt: string | null,                 // ISO 8601 en UTC; null en fijos y cuotas
  timezone: string | null,                   // IANA del registro; null en fijos y cuotas
  installment: {                             // presente solo en cuotas; null en únicos y fijos
    number: int,                             //   nro de cuota del mes (1-based)
    total: int,                              //   totalInstallments del grupo
    startMonth: "YYYY-MM"                    //   mes de inicio del grupo
  } | null,
  category: { id, name, color, scope }       // embebida; puede estar soft-deleted (ver abajo)
}
```

### Bucketeo por mes (definitivo) — por la zona propia de cada registro

El mes de un movimiento se determina con la **`timezone` guardada en cada registro**, no con una zona pasada por query. Se calcula en SQL con `date_trunc('month', "occurredAt" AT TIME ZONE timezone)` comparado contra el mes pedido, vía **`$queryRaw` parametrizado** (Prisma 7 no expresa `AT TIME ZONE` de forma idiomática; el raw va parametrizado por seguridad, sin interpolar strings).

- Esto **reemplaza el criterio provisorio de Fase 4** (rango UTC calculado con la `timezone` del query param) y salda esa deuda técnica: dos movimientos cargados en zonas distintas caen cada uno en su mes correcto, sin depender de la zona del request.

### Categoría soft-deleted incluida (RF-CAT-004)

El join de movimientos y el cálculo de totales **no filtran por `Category.deletedAt`**: un movimiento histórico muestra su categoría embebida aunque esté eliminada, y **sigue contando en los totales** (RF-VM-002). El soft delete de categoría no saca movimientos de los cálculos (ver bitácora 2026-06-08).

### Totales

- **Los totales suman movimientos, no categorías** (`amountCents` de cada movimiento del mes). `balanceCents = incomeCents - expenseCents`, sin piso (negativo si los gastos superan los ingresos). Desde Fase 7 agregan únicos + fijos + cuotas.
- **Gotcha BigInt → Number:** `SUM(...)` en Postgres devuelve `BIGINT`, que llega como `BigInt` de JS desde `$queryRaw`. El repositorio lo castea con `Number(...)` antes de serializar; sin el cast, `JSON.stringify` falla sobre `BigInt`.

### Por qué un módulo propio

`MovementsModule` es un módulo separado (no vive dentro de `transactions`) para poder **unificar `transactions` + `recurring` + `installments`** en una sola respuesta sin generar dependencia circular entre esos módulos. Consume cada origen a través de su `Service` (regla de propiedad de dominio: nunca toca repositorios ni tablas ajenas).

### Integración de fijos en `/movements` (Fase 6)

`MovementsModule` puebla la lista `fijos` y suma los fijos activos a los totales del mes llamando a `RecurringService` (regla de propiedad de dominio: nunca toca la tabla `recurrings`).

- **`findFijosByMonth` usa Prisma ORM normal** (no `$queryRaw`, no `AT TIME ZONE`): los fijos operan **a nivel mes**, sin día/hora/zona, así que no hay bucketeo por timezone que resolver.
- **Condición de actividad en un mes:** `startMonth <= month AND (deletedFrom IS NULL OR deletedFrom > month)`. La comparación es **léxica de strings `YYYY-MM`** — válida porque ese formato ordena cronológicamente como texto (`"2026-02" < "2026-10"`). Se corresponde con RF-MF-002.
- **Totales del mes ahora suman únicos + fijos activos** (antes solo únicos). El `MovementItem` de un fijo viene con `occurredAt` y `timezone` en `null` (ver shape en `docs/data-model.md`).

### Integración de cuotas en `/movements` (Fase 7)

`MovementsModule` puebla la lista `cuotas` y suma las cuotas del mes a los totales llamando a `InstallmentsService` (regla de propiedad de dominio: nunca toca la tabla `installmentGroups`).

- **Cálculo on-the-fly (RN-006):** no hay filas por instancia mensual. Se consultan los grupos con `startMonth <= month` (comparación léxica de strings `YYYY-MM`, como los fijos) y se filtra en JS por `month < addMonths(startMonth, totalInstallments)`. Una cuota cae en el mes si `startMonth <= month < addMonths(startMonth, totalInstallments)`.
- **Número de cuota del mes (1-based):** `monthDiff(startMonth, month) + 1`. Va al campo `installment.number`; `installment.total = totalInstallments`. El `MovementItem` de una cuota trae `occurredAt`/`timezone` en `null` (sin día/hora) y `installment` poblado (en únicos/fijos `installment` es `null`).
- **Helpers `addMonths` / `monthDiff`** exportados desde `movements.repository.ts` — reusarlos, no reimplementar aritmética de meses.
- **Totales del mes ahora suman únicos + fijos + cuotas.**

## Movimientos fijos (RecurringModule)

Gestión de movimientos fijos, **scopeada por `userId` del JWT**. El módulo expone **crear, editar y eliminar**; el listado del mes lo arma `MovementsModule` (sección anterior). **No existe `GET /recurring/:id`**: el front prefilea el formulario de edición desde el `MovementItem` que ya trae `/movements`, sin un GET extra.

### Endpoints

| Endpoint | Entrada | Éxito | Errores |
|----------|---------|-------|---------|
| `POST /recurring` | `{ type, amountCents, categoryId, startMonth, description? }` | `201` · `data: Recurring` | `400` |
| `PATCH /recurring/:id` | `{ amountCents?, categoryId?, description?, currentMonth }` | `200` · `data: Recurring` | `400` · `404` |
| `DELETE /recurring/:id` | query: `currentMonth`, `fromCurrentMonth` | `204 No Content` | `404` |

- **`type` y `startMonth` no son editables** por PATCH: solo `amountCents`, `categoryId` y `description` (RF-MF-003). El `startMonth` del POST es el mes actual que envía el front.
- **Validación de categoría:** idéntica a la de movimientos únicos — categoría propia, activa y con scope compatible (RN-010); inexistente / ajena / eliminada / scope incompatible son todas `400` (ver `validateCategory` abajo).

### Inmutabilidad del pasado vía "split al editar"

Un **fijo lógico** es una **cadena de filas `Recurring`** en el tiempo, no una sola fila. El PATCH recibe `currentMonth` (el mes actual real, calculado por el front) y decide según dónde cae respecto del `startMonth` de la fila editada (`R`):

- **`currentMonth > R.startMonth`** (el fijo ya corrió meses pasados) → **split**: se cierra la fila vieja (`deletedFrom = currentMonth`, deja de aparecer desde el mes actual) y se **crea una fila nueva** (`startMonth = currentMonth`) con los valores nuevos. La respuesta trae la **fila nueva, con otro `id`**. Así los meses pasados conservan los valores viejos y el actual/futuro toman los nuevos.
- **`currentMonth <= R.startMonth`** (la fila no tiene pasado todavía) → se **edita en su lugar**, sin crear filas nuevas.

Esto materializa "el pasado es inmutable" (RF-MF-003) sin generar filas por instancia mensual.

### Eliminación (DELETE con `currentMonth` y `fromCurrentMonth`)

- **`boundary = fromCurrentMonth ? currentMonth : nextMonth(currentMonth)`** — el mes desde el cual el fijo deja de aparecer. `fromCurrentMonth = false` (checkbox desmarcado, default) → deja de aparecer desde el mes **siguiente**; `true` (checkbox marcado) → desde el mes **actual inclusive** (RF-MF-004).
- **Si `boundary <= startMonth`** (el fijo no aparecería en ningún mes) → **hard delete físico** de la fila. **Si no** → set `deletedFrom = boundary` (soft, sigue visible en los meses anteriores al `boundary`). El pasado nunca se toca.

### Gotchas

- **`fromCurrentMonth` llega como string** (`"true"` / `"false"`) en los query params; NestJS **no lo castea a boolean**. Hay que parsearlo explícitamente.
- **Validación de categoría consolidada (Fase 7):** la lógica que en Fases 4/6 estaba duplicada entre `TransactionsService` y `RecurringService` se extrajo a **`CategoryValidatorService`** (módulo `categories`). Los tres módulos de movimientos lo inyectan. Ver sección **Movimientos en cuotas** abajo.

## Movimientos en cuotas (InstallmentsModule)

Gestión de grupos de cuotas, **scopeada por `userId` del JWT**. El módulo expone **crear, editar y eliminar**; el listado del mes lo arma `MovementsModule` (ver **Integración de cuotas en `/movements`**). **No existe `GET /installments/:id`**: el front prefilea el formulario de edición desde el `MovementItem` que ya trae `/movements`.

### Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /installments` | `{ type, amountCents, totalInstallments, startMonth, categoryId, description? }` | `201` · `data: InstallmentGroup` | `400` |
| `PATCH /installments/:id` | `{ type?, amountCents?, totalInstallments?, startMonth?, categoryId?, description? }` | `200` · `data: InstallmentGroup` | `400` · `404` |
| `DELETE /installments/:id` | — | `204 No Content` | `404` |

- **Solo `EXPENSE` en v1:** el endpoint **rechaza `INCOME` con `400`** (resuelve la contradicción RF-MC-001 vs "Fuera de alcance: Ingreso en cuotas" — ver bitácora 2026-06-09). `amountCents` es el monto **por cuota** (entero `> 0`, RN-002), no el total. `totalInstallments` es la cantidad (entero `> 0`). `startMonth` es `YYYY-MM`.
- **`PATCH /installments/:id` — edita el grupo completo in-place (RF-MC-003).** Campos editables: monto por cuota, cantidad, mes de inicio, categoría, descripción. **El `type` no se edita.** **No hay split ni inmutabilidad del pasado** (a diferencia de los fijos): la edición aplica a todas las instancias del grupo. `404` si no existe o no es del usuario.
- **`DELETE /installments/:id` — hard delete del grupo entero.** Borra **físicamente** todas las cuotas (pasadas y futuras): `InstallmentGroup` no tiene `deletedFrom` ni soft delete. **`204` sin cuerpo.** `404` si no existe o no es del usuario.
- **Validación de categoría:** idéntica a únicos y fijos (propia, activa, scope compatible RN-010); inexistente / ajena / eliminada / scope incompatible son todas `400`, nunca `409`; categoría ajena no se distingue de inexistente. Se delega en `CategoryValidatorService` (ver abajo).

### `CategoryValidatorService` — validador de categoría consolidado

La validación de categoría (existencia + pertenece al `userId` + activa + scope RN-010) que en Fases 4/6 estaba **duplicada** en `TransactionsService` y `RecurringService` se extrajo a **`CategoryValidatorService`**, en `backend/src/categories/`, exportado por `CategoriesModule`. Los tres módulos de movimientos (`transactions`, `recurring`, `installments`) lo **inyectan** en vez de reimplementar la lógica.

- **Una sola fuente de verdad:** si la regla de validación de categoría cambia, cambia en un solo lugar. Se mantiene el comportamiento previo: errores de categoría en movimientos son **`400`** (no `409`), y categoría ajena no se distingue de inexistente.

## Categorías (CategoriesModule)

CRUD completo, **scopeado por `userId` del JWT** (un usuario nunca ve ni toca categorías de otro). Todas las respuestas exitosas devuelven el shape de categoría.

### Shape de categoría

```
Categoria = {
  id, userId,
  name,                              // string, almacenado tal cual lo tipeó el usuario
  scope: "BOTH" | "EXPENSE" | "INCOME",
  color: "#hex",                     // del pool, no editable
  deletedAt: null,                   // siempre null en las respuestas (solo se devuelven activas)
  createdAt, updatedAt,
  movementCount: number              // derivado, solo lectura
}
```

- **`movementCount`** = suma de las filas de `transactions` + `recurrings` + `installmentGroups` que referencian la categoría (las 3 relaciones de movimiento). Es un dato calculado de solo lectura; el usuario no lo edita. Cero si no tiene movimientos. (Independiente de los totales de dinero del mes — ver RF-CAT-006 / RF-VM-002.)

### Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `GET /categories` | — | `200` · `data: Categoria[]` | — |
| `POST /categories` | `{ name, scope? }` | `201` · `data: Categoria` | `400` · `409` (dos casos, ver abajo) |
| `POST /categories/:id/reactivate` | — (ignora el body) | `200` · `data: Categoria` | `404` · `409` |
| `PATCH /categories/:id` | `{ name?, scope? }` | `200` · `data: Categoria` | `400` · `404` · `409` |
| `DELETE /categories/:id` | — | `204 No Content` | `404` |

- **`GET /categories`** — solo activas (`deletedAt` null), ordenadas por **nombre ascendente**, cada una con su `movementCount`.
- **`POST /categories`** — `name` obligatorio y no vacío; `scope` opcional (default `BOTH`). El campo **`color` NO se acepta**: enviarlo es `400`. Dos casos de `409`:
  - **Colisión con una categoría activa** (RN-008): `error.message` = `"Ya existe una categoría activa..."`, **sin** `error.data`. Es un bloqueo duro de duplicado.
  - **Colisión con una categoría eliminada / reactivable** (RF-CAT-002, A3): `error.data = { reactivable: true, category: { id, name, scope, color } }`. El front usa ese `id` para ofrecer reactivar. Ver `ReactivableConflictException` abajo.
  - `400`: nombre vacío o faltante, `scope` inválido, o campo no permitido (`color`).
- **`POST /categories/:id/reactivate`** — reactiva una categoría soft-deleted. Vuelve **exactamente como estaba** (mismo `id`, `name`, `scope`, `color`); lo que el usuario haya tipeado en el form de alta **se ignora**. `404` si no existe o no es del usuario; `409` si ya está activa.
- **`PATCH /categories/:id`** — `name` y/o `scope`. El **`color` NO es editable**: enviarlo es `400`. `409` si el nuevo nombre colisiona con otra categoría activa (RN-014). `404` si no existe, no es del usuario, o está eliminada.
- **`DELETE /categories/:id`** — soft delete (marca `deletedAt`). **`204` sin cuerpo.** **No es idempotente**: borrar una categoría **ya eliminada** devuelve `404` (no `204`). También `404` si no existe o no es del usuario.

### Pool de colores (RF-CAT-005)

- **Única fuente:** `backend/src/categories/color-pool.ts`. 10 colores fijos:
  `#4F86C6`, `#E07B54`, `#6DBF67`, `#A98BD6`, `#E8C84A`, `#5BC4B8`, `#E06B8B`, `#8B9DBF`, `#C47D3E`, `#7DBF9E`.
  Los primeros 4 son los que en Fase 2 eran "provisorios" para las categorías por defecto — ahora son parte del pool oficial. `AuthService` y `CategoriesService` importan el pool del mismo módulo; no hay colores hardcodeados sueltos.
- **Asignación (determinística):** al crear una categoría se elige el color del pool **menos usado** entre las categorías **activas** del usuario; en empate gana el **primero en orden de definición**. Las 4 categorías por defecto del alta toman los primeros 4 colores en orden. El color no se reasigna al editar.

### Normalización y unicidad (RN-014)

- La unicidad de nombre entre activas se valida a **nivel de aplicación, no en la DB** (no hay `@@unique`). La comparación usa `normalizeName()`: trim + lowercase + NFD + strip de diacríticos (`"comida" = "Comida" = "Cómida"`). El `name` se **almacena tal cual lo tipeó el usuario**; la normalización es solo para comparar.

### Manejo de errores — extensión del filter

- **`ReactivableConflictException`** (409): el único error que adjunta `error.data` estructurado (`{ reactivable, category }`). Para soportarlo, el Global Exception Filter se extendió de forma **mínima** con un campo `data` **opcional** en el sobre de error: solo lo lleva este caso; el resto de los errores no incluyen `data`. Permite al front ofrecer Reactivar/Cancelar sin un endpoint extra de búsqueda.

## Autenticación

El `AuthModule` es el **emisor del JWT**: el backend es la autoridad de identidad y firma el token que el frontend reenvía en cada request (ver `docs/architecture.md`, Flujo de autenticación).

### Endpoints

Todas las respuestas usan el sobre `{ success, statusCode, data }`. El payload de éxito (`data`) de los tres endpoints es `{ accessToken, user }`, donde `user = { id, email, name|null, image|null }`.

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /auth/register` | `{ email, password }` (`password` ≥ 8) | `201` | `400` validación · `409` email ya registrado |
| `POST /auth/login` | `{ email, password }` | `200` | `400` validación · `401` credenciales inválidas |
| `POST /auth/google` | `{ email (req), name?, image?, googleId?, idToken? }` | `200` | — |

- **`POST /auth/login` — mensaje genérico.** Ante credenciales inválidas devuelve `401` con el mensaje fijo `"Credenciales inválidas"`. **No distingue** si falló el email o la contraseña (RF-AUTH-005, A1) — es deliberado, para no revelar qué emails existen.
- **`POST /auth/google` — upsert.** Crea o actualiza el usuario por email. Las categorías por defecto se crean **solo si es alta nueva** (`skipDuplicates`); un usuario existente no las vuelve a generar. El `idToken` aún **no se verifica server-side** (ver gotchas).

### Hashing de contraseña

El `passwordHash` se calcula con **argon2id** (no bcrypt). Las cuentas creadas solo con Google no tienen `passwordHash`.

### JWT

- Algoritmo **HS256**, firmado con `JWT_SECRET`.
- Claims: `sub = userId` (cuid del usuario), `iat`, `exp` (**30 días**).
- El frontend trata el token como **opaco**: lo guarda y lo reenvía, no lo decodifica.

### Guard global y rutas públicas (RNF-001)

- **`JwtAuthGuard` es global:** toda request exige un JWT válido. **Todo endpoint nuevo está protegido por defecto** — no hace falta decorar nada para que lo esté.
- Para exponer una ruta **sin** auth, decorarla con **`@Public()`** (`src/auth/public.decorator.ts`). Hoy lo llevan los tres endpoints de auth y `GET /health`.
- El guard inyecta `request.user = { userId }` a partir del claim `sub`.

### Categorías por defecto al alta (RF-CAT-001)

Al crear una cuenta nueva (por cualquiera de los dos métodos), el backend genera estas 4 categorías, todas con `scope: BOTH`, tomando los **primeros 4 colores del pool** en orden:

| Categoría | Color |
|-----------|-------|
| Consumibles | `#4F86C6` |
| Tarjeta de crédito | `#E07B54` |
| Gastos fijos | `#6DBF67` |
| Servicios | `#A98BD6` |

`AuthService` importa el pool central (`src/categories/color-pool.ts`) — ya no hay hex hardcodeados sueltos. Estos 4 colores dejaron de ser provisorios: son los primeros 4 del pool oficial (ver más abajo, **Pool de colores**). No se duplican si el usuario ya existía.

## Reglas de negocio implementadas

<!-- Documentar reglas no obvias a medida que se implementen. -->
<!-- Ejemplo:
- El endpoint GET /movements filtra recurrentes donde startMonth <= mes consultado y (deletedFrom es null o deletedFrom > mes consultado)
-->
