# Backend

## Stack

- **NestJS + TypeScript + PostgreSQL + Prisma**
- Puerto: `3001`
- JwtAuthGuard global — valida token y extrae `userId` para scopear todos los recursos

## Arranque (bootstrap)

### CORS

`src/main.ts` habilita CORS al arrancar (`app.enableCors({ origin: CORS_ORIGIN, credentials: true })`). Sin esto, el browser bloquea toda request cross-origin del frontend con error de preflight.

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
| `UserPreferences` | Preferencias del usuario. **1:1 con `User`** (`userId` único, `onDelete: Cascade`); contenido en un campo `Json` `data` (default `{}`). Blob extensible para sumar prefs sin migraciones. |

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
| `movements` | `GET /movements`, `GET /movements/reports`, `GET /movements/reports/annual-unicos`, `GET /movements/reports/annual-cuotas` | Lista unificada del mes + serie de reportes agregada + grilla anual de Únicos + gantt anual de Cuotas (transacciones + recurrentes + cuotas) |
| `transactions` | `/transactions` | Movimientos únicos (CRUD) |
| `recurring` | `/recurring` | Movimientos fijos (crear, editar, eliminar) |
| `installments` | `/installments` | Grupos de cuotas (crear, editar, eliminar) |
| `categories` | `/categories` | Categorías (CRUD + soft delete) |
| `preferences` | `/preferences` | Preferencias de usuario (blob JSON, lectura/escritura) |
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

### `GET /movements/reports?year=YYYY&categories=`
Devuelve la serie **anual agregada** del usuario para los reportes (RF-REP-001/002/005): ingreso/gasto por cada uno de los 12 meses y el gasto mensual desglosado por categoría. Acepta un **filtro de categorías** opcional (`categories`, lista separada por comas; omitido = todas). No devuelve movimientos individuales. **Renombre de `GET /movements/annual`** (RF-REP-005). Contrato completo en la sección **Movimientos del mes (MovementsModule)**.

### `GET /movements/reports/annual-unicos?year=YYYY&categories=&currency=&today=`
Devuelve la **grilla anual día × mes de gastos Únicos** y el footer de métricas mensuales para la card `unique-grid` (RF-REP-010). Solo agrega **Únicos de tipo gasto (`EXPENSE`)**. Contrato (params y shape) en `docs/data-model.md`, §Contrato de reporte anual de Únicos; reglas de cálculo en la sección **Movimientos del mes (MovementsModule)** → Reporte anual de Únicos.

### `GET /movements/reports/annual-cuotas?year=YYYY&categories=&currency=`
Devuelve el **gantt anual de gastos en Cuotas** (una barra por compra en cuotas que intersecta el año, empaquetadas en renglones) para la card `installment-gantt` (RF-REP-011). Solo agrega **cuotas de tipo gasto (`EXPENSE`)**. **No usa `today`.** Contrato (params y shape) en `docs/data-model.md`, §Contrato de reporte anual de Cuotas; reglas de cálculo en la sección **Movimientos del mes (MovementsModule)** → Reporte anual de Cuotas.

### `POST /transactions` · `PATCH /transactions/:id` · `DELETE /transactions/:id`
CRUD de movimientos únicos. El monto siempre en centavos (entero > 0). El instante se guarda en UTC más la zona original del registro (ver fechas/timezone en `docs/technical.md`).

### `POST /recurring` · `PATCH /recurring/:id` · `DELETE /recurring/:id` · `POST|PATCH /recurring/:id/calculated`
Gestión de movimientos fijos y calculados. El PATCH y el DELETE reciben el mes actual (`currentMonth`) para resolver la inmutabilidad del pasado; el DELETE además usa `fromCurrentMonth` (query) para controlar desde cuándo deja de aparecer el fijo. Los **calculados** usan endpoints propios `POST|PATCH /recurring/:id/calculated`. Contrato completo en la sección **Movimientos fijos (RecurringModule)** y **Movimientos calculados**. **No hay `GET /recurring/:id`.**

### `POST /installments` · `PATCH /installments/:id` · `DELETE /installments/:id`
Gestión de grupos de cuotas. **Solo `EXPENSE` en v1** (rechaza `INCOME` con `400`). El PATCH edita el grupo completo in-place (RF-MC-003). El DELETE es **hard delete del grupo entero** (todas las cuotas, pasadas y futuras). **No hay `GET /installments/:id`**: el front prefilea desde el `MovementItem` de `/movements`. Contrato completo en la sección **Movimientos en cuotas (InstallmentsModule)**.

### `GET /categories` · `POST /categories` · `PATCH /categories/:id` · `DELETE /categories/:id`
CRUD de categorías. El DELETE es soft delete (`deletedAt`). Ver el contrato completo en la sección **Categorías (CategoriesModule)**.

### `GET /preferences` · `PUT /preferences`
Lectura y escritura del blob JSON de preferencias del usuario autenticado. El `PUT` **reemplaza el blob entero** (no mergea) y hace upsert. Ver el contrato completo en la sección **Preferencias de usuario (PreferencesModule)**.

## Movimientos únicos (TransactionsModule)

CRUD completo, **scopeado por `userId` del JWT** (un usuario nunca ve ni toca movimientos de otro). Todas las respuestas exitosas devuelven el shape de Transaction, con la **categoría embebida**. Shape en `docs/data-model.md`, §Contrato de movimiento único.

### Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /transactions` | `{ type, amountCents, categoryId, occurredAt, timezone, description? }` | `201` · `data: Transaction` | `400` |
| `GET /transactions/:id` | — | `200` · `data: Transaction` | `404` |
| `PATCH /transactions/:id` | parcial (cualquier campo de POST) | `200` · `data: Transaction` | `400` · `404` |
| `DELETE /transactions/:id` | — | `204 No Content` | `404` |
| `POST /transactions/:id/calculated` | calculado desde el único `:id` | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /transactions/:id/calculated` | edita el calculado de único `:id` | `200` · `data: Recurring` | `400` · `404` |

- **`POST /transactions`** — `amountCents` entero **en centavos** (`> 0`); `occurredAt` ISO 8601 en **UTC**; `timezone` IANA. `400` por validación de DTO o por categoría inválida (ver Validación de categoría abajo).
- **`GET /transactions/:id`** — `404` si no existe o no es del usuario.
- **`PATCH /transactions/:id`** — body parcial (cualquier campo del POST). **Reaplica todas las validaciones** (RN-002 monto, RN-010 scope). `404` si no existe o no es del usuario.
- **`DELETE /transactions/:id`** — **hard delete** (permanente, RF-MU-003; la entidad no tiene `deletedAt`). **`204` sin cuerpo.** `404` si no existe o no es del usuario. Si el único tiene calculados derivados (`sourceMovementId`), la FK `onDelete: Cascade` los borra enteros (ver §Movimientos calculados, Eliminación).
- **`POST|PATCH /transactions/:id/calculated`** — calculado de origen único; contrato en `docs/data-model.md`, §Contrato de movimientos calculados; mecánica en §Movimientos calculados (abajo).

> **El listado del mes no vive en `transactions`:** es `GET /movements?month=YYYY-MM` (ver **Movimientos del mes (MovementsModule)**), que unifica únicos + fijos + cuotas y agrega los totales. De `transactions` solo quedan los cuatro endpoints de la tabla de arriba (`POST`, `GET /:id`, `PATCH`, `DELETE`).

### Validación de categoría (RN-010) — siempre 400, nunca 409

Se valida en **create y update**. El movimiento exige una categoría **propia, activa y con scope compatible**:

- **Scope (RN-010):** `EXPENSE` requiere categoría con scope `EXPENSE` o `BOTH`; `INCOME` requiere `INCOME` o `BOTH`.
- Categoría **inexistente, ajena (de otro usuario), eliminada (soft delete) o con scope incompatible** son todas **`400 BadRequest`** — es validación de input, **no `409`**.
- **No revela ajenidad:** si la categoría es de otro usuario, el error es **idéntico** al de "inexistente" — no filtra si el `id` existe en la DB de otro.

## Movimientos del mes (MovementsModule)

Endpoint unificado que devuelve **todos los movimientos del mes más los totales**, scopeado por `userId` del JWT. Devuelve las tres listas (`unicos`, `fijos`, `cuotas`) con sus datos.

### `GET /movements?month=YYYY-MM`

- **`month` (`YYYY-MM`) es el único query param y es obligatorio:** si falta o tiene formato inválido, `400`. **No recibe `timezone`** (a diferencia del endpoint eliminado): el mes de cada movimiento se calcula con la zona propia del registro (ver Bucketeo abajo).

> Shape de la respuesta (`data`, `totals`, `MovementItem`) y reglas de orden / nullabilidad / `skipped` en `docs/data-model.md`, §Contrato de movimientos del mes. Abajo solo lo propio de la implementación backend (bucketeo SQL, totales, integración de orígenes).

### Bucketeo por mes (definitivo) — por la zona propia de cada registro

El mes de un movimiento se determina con la **`timezone` guardada en cada registro**, no con una zona pasada por query. Se calcula en SQL con `date_trunc('month', "occurredAt" AT TIME ZONE timezone)` comparado contra el mes pedido, vía **`$queryRaw` parametrizado** (Prisma 7 no expresa `AT TIME ZONE` de forma idiomática; el raw va parametrizado por seguridad, sin interpolar strings). Así dos movimientos cargados en zonas distintas caen cada uno en su mes correcto, sin depender de la zona del request.

### Categoría soft-deleted incluida (RF-CAT-004)

El join de movimientos y el cálculo de totales **no filtran por `Category.deletedAt`**: un movimiento histórico muestra su categoría embebida aunque esté eliminada, y **sigue contando en los totales** (RF-VM-002). El soft delete de categoría no saca movimientos de los cálculos.

### Totales

- **Los totales suman movimientos, no categorías** (`amountCents` de cada movimiento del mes). `balanceCents = incomeCents - expenseCents`, sin piso (negativo si los gastos superan los ingresos). Agregan únicos + fijos + cuotas.
- **Gotcha BigInt → Number:** `SUM(...)` en Postgres devuelve `BIGINT`, que llega como `BigInt` de JS desde `$queryRaw`. El repositorio lo castea con `Number(...)` antes de serializar; sin el cast, `JSON.stringify` falla sobre `BigInt`.

### Por qué un módulo propio

`MovementsModule` es un módulo separado (no vive dentro de `transactions`) para poder **unificar `transactions` + `recurring` + `installments`** en una sola respuesta sin generar dependencia circular entre esos módulos. Consume cada origen a través de su `Service` (regla de propiedad de dominio: nunca toca repositorios ni tablas ajenas).

### Integración de fijos en `/movements`

`MovementsModule` puebla la lista `fijos` y suma los fijos activos a los totales del mes llamando a `RecurringService` (regla de propiedad de dominio: nunca toca la tabla `recurrings`).

- **`findFijosByMonth` usa Prisma ORM normal** (no `$queryRaw`, no `AT TIME ZONE`): los fijos operan **a nivel mes**, sin día/hora/zona, así que no hay bucketeo por timezone que resolver.
- **Condición de actividad en un mes:** `startMonth <= month AND (deletedFrom IS NULL OR deletedFrom > month)` **más** la condición de frecuencia `isOnFrequency(startMonth, frequency, month)` (RN-016). El rango se compara **léxicamente sobre strings `YYYY-MM`** —válido porque ese formato ordena cronológicamente como texto (`"2026-02" < "2026-10"`)— y la frecuencia se aplica en JS (ver **Cálculo de aparición de fijos por mes**). Se corresponde con RF-MF-002 / RF-MF-006.
- **Los totales del mes suman únicos + fijos activos.** El `MovementItem` de un fijo viene con `occurredAt` y `timezone` en `null`, y con `frequency` / `skipped` poblados (ver shape en `docs/data-model.md`). **Un fijo anulado para el mes (`skipped: true`, RF-MF-005) se incluye en la lista pero se excluye de los totales.**

### Integración de cuotas en `/movements`

`MovementsModule` puebla la lista `cuotas` y suma las cuotas del mes a los totales llamando a `InstallmentsService` (regla de propiedad de dominio: nunca toca la tabla `installmentGroups`).

- **Cálculo on-the-fly (RN-006):** no hay filas por instancia mensual. Se consultan los grupos con `startMonth <= month` (comparación léxica de strings `YYYY-MM`, como los fijos) y se filtra en JS por `month < addMonths(startMonth, totalInstallments)`. Una cuota cae en el mes si `startMonth <= month < addMonths(startMonth, totalInstallments)`.
- **Número de cuota del mes (1-based):** `monthDiff(startMonth, month) + 1`. Va al campo `installment.number`; `installment.total = totalInstallments`. El `MovementItem` de una cuota trae `occurredAt`/`timezone` en `null` (sin día/hora) y `installment` poblado (en únicos/fijos `installment` es `null`).
- **Helpers `addMonths` / `monthDiff`** exportados desde `movements.repository.ts` — reusarlos, no reimplementar aritmética de meses.
- **Los totales del mes suman únicos + fijos + cuotas.**

### Serie de reportes (`GET /movements/reports?year=YYYY&categories=`)

Endpoint **agregado** para los reportes (RF-REP-001/002/005), scopeado por `userId` del JWT (RN-003). Devuelve totales por mes y el gasto mensual desglosado por categoría para un año — **no** devuelve movimientos individuales. **No modifica `GET /movements` mensual**: es un endpoint aparte, que reutiliza el mismo criterio de bucketeo (RN-015) sin introducir reglas de zona nuevas.

- **`year` (`YYYY`) obligatorio:** exactamente **4 dígitos**, rango **1900–2200**. Si falta, no tiene 4 dígitos o cae fuera de rango → `400`. `401` global por JWT inválido/ausente.
- **`categories` (lista de `categoryId`s separados por comas) opcional:** **omitido = todas las categorías** (sin filtro). El front lo manda con la **coma literal** (`categories=id1,id2`).
- **`currency` opcional (override de display, RF-REP-007):** una de las 4 monedas, **case-sensitive**. En `getReportsMovements`, el `displayCurrency` que alimenta todas las conversiones es `currencyOverride ?? userSettings.defaultCurrency`: omitido convierte a la default del usuario; presente y válido convierte a esa moneda. **Presente vacío o fuera del set → `400`.** El resto de la conversión (re-ruteo por pivote USD con la tabla de referencia del mes) es idéntico al de la default. Contrato del param en `docs/data-model.md`, §Contrato de serie de reportes.

> Shape de la respuesta (`ReportMovementsResponse` / `ReportMonth` / `ReportCategory`), invariante de consistencia y reglas de `months` / `categories` / `earliestYear` en `docs/data-model.md`, §Contrato de serie de reportes. Abajo solo cómo se calcula cada parte en el backend.

#### Cómo se computa cada parte (bucketeo, mismo criterio que el mensual — RN-015)

- **`months[*]` (12 meses).** Cada `incomeCents` / `expenseCents` suma **únicos + fijos activos + cuotas activas** con el mismo bucketeo que `GET /movements` mensual, sin regla de zona nueva:
  - **únicos** por `date_trunc('month', "occurredAt" AT TIME ZONE timezone)` (la zona propia del registro);
  - **fijos** por `startMonth <= mes AND (deletedFrom IS NULL OR deletedFrom > mes)` **más** `isOnFrequency(startMonth, frequency, mes)`, **excluyendo los meses anulados** (`skippedMonths.has(mes)` → no suma; RF-MF-005);
  - **cuotas** por `startMonth <= mes < addMonths(startMonth, totalInstallments)`.
- **`categories[*]`.** El desglose por categoría **no filtra por `Category.deletedAt`** (incluye soft-deleted con gasto histórico, igual que el mensual). Orden por gasto anual total DESC, desempate por `categoryId` ASC.
- **`earliestYear`.** Mínimo entre el año del mes local de cualquier único (`AT TIME ZONE`) y el año del `startMonth` de cualquier fijo o cuota; `null` si el usuario no tiene movimientos.
- **`availableCategories`.** Universo de categorías con gasto `EXPENSE` del año, computado **independiente del filtro `categories`** (igual que `earliestYear`): es el superconjunto estable que alimenta la leyenda-filtro del front. Incluye soft-deleted con gasto histórico; orden por gasto anual DESC, desempate `categoryId` ASC. Shape en `docs/data-model.md`, §Contrato de serie de reportes.

#### Filtro de categorías (RF-REP-005)

- **Afecta Forma 1 y Forma 2.** El filtro restringe qué movimientos cuentan: en `months[*]` (Forma 1: `incomeCents`/`expenseCents`) **y** en `categories[*]` (Forma 2: las bandas apiladas). Una categoría omitida no aparece en ninguna de las dos.
- **`earliestYear` y `availableCategories` IGNORAN el filtro** — se calculan sobre **todos** los movimientos del usuario (del año, en el caso de `availableCategories`), para que ni los límites de navegación de año (RF-REP-002) ni la leyenda-filtro salten al cambiar el filtro.
- **Filtrado in-memory, NO en SQL/ORM:** se trae el universo de movimientos del año y se filtra en JS con un **`Set` de `categoryId`s** pedidos (omitido = sin filtrar). El invariante `SUM(bandas por categoría) == expenseCents del mes` **se mantiene con el filtro activo** (ambos lados se computan sobre el mismo conjunto filtrado).

### Reporte anual de Únicos (`GET /movements/reports/annual-unicos`)

Grilla anual día × mes y footer de métricas mensuales para la card `unique-grid` (RF-REP-010), scopeado por `userId` del JWT. Contrato (params, shape `AnnualUnicosResponse` / `AnnualUnicosFooter`) en `docs/data-model.md`, §Contrato de reporte anual de Únicos. Reglas de negocio:

- **Solo Únicos de tipo gasto (`EXPENSE`).** La grilla y el footer suman **únicamente** movimientos únicos (`Transaction`) con `type = EXPENSE`. **Fijos, cuotas y calculados no entran** (a diferencia de `GET /movements/reports`, que agrega los tres orígenes). Las cifras vienen **convertidas a la moneda de display** (`currency` del param o la default del usuario) con el mismo re-ruteo por pivote USD que el resto.
- **Bucketeo día/mes por la zona propia del registro** (RN-015), igual que el resto de los reportes: el día y el mes de un único se determinan con su `timezone` guardada (`AT TIME ZONE`).
- **Grilla 31 × 12 (`grid[day-1][month-1]`).** Centavos enteros en `currency`. Un día inexistente del mes (ej. 30/feb) queda en **0**, indistinguible de un día sin gasto (el front lo resuelve por calendario).
- **Breakdown por celda.** Además de `grid`, el endpoint emite `breakdown[day-1][month-1]` con el desglose por categoría (`{ categoryId, amount }`, centavos de `currency`, DESC) de cada día; sin `name`/`color` (los resuelve el front por `availableCategories`). Shape en `docs/data-model.md`, §Contrato de reporte anual de Únicos.
- **Divisor del promedio diario (`dailyAvg`):**
  - mes **en curso** del año en curso → **día actual** (del param `today`, fecha local del usuario; sin `today`, el back cae a `new Date()` UTC);
  - mes ya **terminado** (incluye meses de años pasados) → **cantidad de días del mes**;
  - mes **futuro** → `dailyAvg = null`.
- **`pctVsPrev` — % de diferencia vs. mes anterior.** `ROUNDDOWN((promDiarioActual × 100 / promDiarioPrevio) − 100, 2)` — **trunca hacia cero** (no redondea). El mes anterior de **enero es diciembre del año previo** (continuidad temporal; requiere consultar datos **fuera del año pedido**). Si `promDiarioPrevio == 0` → `null`.
- **`inflationPct`.** `InflationRate.monthlyVariation` (puntos %) del mes; `null` si no hay fila de IPC para ese mes. **Primer consumidor de `InflationRate`** en el producto.
- **Unidad de inflación.** `InflationRate.monthlyVariation` es la **unidad canónica del sistema: puntos porcentuales** (ej. `3.5` = 3,5 %). La serie de INDEC (`apis.datos.gob.ar`) entrega la variación en **fracción** (ej. `0.035`); la ingesta del IPC la convierte **×100 al persistir**, antes de cotas y circuit breaker, de modo que DB, validaciones y comparaciones quedan todas en puntos %. El endpoint expone `inflationPct` directamente en puntos %; el cálculo de `pctVsPrevAdj` usa `inflationPct/100`.
- **`pctVsPrevAdj` — % ajustado por inflación.** Igual que `pctVsPrev`, pero el promedio del mes anterior se **infla por la variación IPC del mes en curso** antes de comparar. `null` si falta el IPC, si el promedio previo es 0, o si el mes en curso no tiene dato de IPC.
- **`colorAnchorCents`.** El endpoint emite el ancla de la escala de color de las celdas: **15 USD reconvertido a `currency` con el TC de enero del año del reporte** (`pivotRatesForYear`, clamp al mes disponible; USD = 1500). Tope de la rampa de color, no una cotización de negocio. Shape en `docs/data-model.md`, §Contrato de reporte anual de Únicos.

### Reporte anual de Cuotas (`GET /movements/reports/annual-cuotas`)

Gantt anual de barras horizontales para la card `installment-gantt` (RF-REP-011), scopeado por `userId` del JWT. Contrato (params, shape `CuotasGanttResponse` / `CuotasGanttBar`) en `docs/data-model.md`, §Contrato de reporte anual de Cuotas. Reglas de negocio:

- **Solo cuotas de tipo gasto (`EXPENSE`) que intersectan el año.** Entra todo plan de cuotas que **toca** el año pedido: el que empieza antes y sigue dentro, o el que empieza dentro y sigue (o termina) después. Fijos, únicos y calculados no entran. Las cifras vienen **convertidas a la moneda de display** (`currency` del param o la default del usuario).
- **Filtro de categorías antes del packing.** El subconjunto de `categories` (tres estados, RF-REP-002) se aplica **antes** de calcular renglones: el packing opera sobre las barras ya filtradas.
- **Packing (asignación de renglones).** Las barras se ordenan por **origen de la cuota** (`startMonth` ASC, mes de la primera cuota; desempate `createdAt` ASC) y se ubican en renglones; `rowIndex` arranca en `0` (renglón pegado al eje). Una barra **reusa** un renglón si **no entra en conflicto con ninguno** de los intervalos ya asignados a ese renglón —conflicto = menos de 1 mes de descanso a cualquiera de los dos lados—, **aprovechando huecos intermedios** (una barra puede ubicarse entre dos ya colocadas si hay ≥1 mes de descanso a cada lado). Se elige el renglón **más bajo** que la admita; si ninguno sirve, se abre uno nuevo por encima. Por el orden por `startMonth` ASC, la de origen más temprano queda en el renglón más cercano al eje. Calculado en el backend sobre el subconjunto ya filtrado. El front invierte el eje al renderizar (ver `docs/frontend.md`).
- **Rango real de la barra.** Cada barra emite `realStartMonth`/`realEndMonth` (`YYYY-MM`) con el período **completo** del plan (primera y última cuota), **sin recortar al año** —distinto de `startMonthIndex`/`endMonthIndex`, que se clampean a 0–11—; el front los usa para el rango del tooltip. Ver `docs/data-model.md`, §Contrato de reporte anual de Cuotas.
- **Conversión del monto por cuota — TC del primer mes visible de la barra.** Si `startMonth` del plan cae **dentro** del año, se usa el TC de **ese mes**; si es **anterior** al año, se usa el TC de **enero del año** (`YYYY-01`). Vía `pivotRatesForYear` con clamp al mes disponible. Coherente con la regla de que las cuotas usan el TC oficial del mes de la instancia.

## Movimientos fijos (RecurringModule)

Gestión de movimientos fijos, **scopeada por `userId` del JWT**. El módulo expone **crear, editar y eliminar**; el listado del mes lo arma `MovementsModule` (sección anterior). **No existe `GET /recurring/:id`**: el front prefilea el formulario de edición desde el `MovementItem` que ya trae `/movements`, sin un GET extra.

### Endpoints

| Endpoint | Entrada | Éxito | Errores |
|----------|---------|-------|---------|
| `POST /recurring` | `{ type, amountCents, categoryId, startMonth, frequency?, description? }` | `201` · `data: Recurring` | `400` |
| `PATCH /recurring/:id` | `{ amountCents?, categoryId?, description?, currentMonth }` | `200` · `data: Recurring` | `400` · `404` |
| `POST /recurring/:id/skip` | `{ month }` (`YYYY-MM`) | `200` · `data: { skipped, month }` | `400` · `404` |
| `POST /recurring/:id/calculated` | calculado desde el fijo `:id` | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /recurring/:id/calculated` | edita el calculado `:id` | `200` · `data: Recurring` | `400` · `404` |
| `DELETE /recurring/:id` | query: `currentMonth`, `fromCurrentMonth` | `204 No Content` | `404` |

- **`type`, `startMonth` y `frequency` no son editables** por PATCH: solo `amountCents`, `categoryId` y `description` (RF-MF-003). El `startMonth` del POST es el mes actual que envía el front.
- **`frequency`:** opcional en el `POST`, default **`MONTHLY`** si se omite. Set cerrado: `MONTHLY | BIMONTHLY | QUARTERLY | BIANNUAL | ANNUAL` (`400` si el valor no es del enum). Es **inmutable** (como `type`): no se acepta en PATCH; en el split (abajo) la fila nueva R2 la **hereda del original**. La respuesta del `POST` incluye `frequency`. Detalle del cálculo "¿este fijo aparece en este mes?" en **Cálculo de aparición de fijos por mes** (abajo).
- **`POST /recurring/:id/skip` — toggle de anulación:** anula / des-anula la aparición de un fijo en un mes puntual (RF-MF-005). Body `{ month: "YYYY-MM" }`. Es un **toggle**: si ya existe el skip `(fijo, mes)` lo borra (`data: { skipped: false, month }`); si no existe lo crea (`data: { skipped: true, month }`). `404` si el fijo no existe o no es del usuario; `400` si el `month` no cumple `YYYY-MM`. **No valida** que el mes sea una aparición real del fijo según su frecuencia (solo formato y ownership) — esa validación semántica es del frontend, que ya tiene el ítem del mes. Un mes anulado **se sigue listando** en `GET /movements` con `skipped: true` pero **no suma** a los totales ni a la serie anual.
- **Validación de categoría:** idéntica a la de movimientos únicos — categoría propia, activa y con scope compatible (RN-010); inexistente / ajena / eliminada / scope incompatible son todas `400` (ver `validateCategory` abajo).

### Inmutabilidad del pasado vía "split al editar"

Un **fijo lógico** es una **cadena de filas `Recurring`** en el tiempo, no una sola fila. El PATCH recibe `currentMonth` (el mes actual real, calculado por el front) y decide según dónde cae respecto del `startMonth` de la fila editada (`R`):

- **`currentMonth > R.startMonth`** (el fijo ya corrió meses pasados) → **split**: se cierra la fila vieja (`deletedFrom = currentMonth`, deja de aparecer desde el mes actual) y se **crea una fila nueva** R2 (`startMonth = currentMonth`) con los valores nuevos. La respuesta trae la **fila nueva, con otro `id`**. Así los meses pasados conservan los valores viejos y el actual/futuro toman los nuevos. R2 **hereda `deletedFrom` de la fila original** (además de `type`, `categoryId` y `description`) para preservar una terminación previa: si el fijo ya tenía una eliminación futura programada (`deletedFrom` no nulo), R2 debe respetarla; de lo contrario el gasto reaparecería después del mes en que se había eliminado.
- **`currentMonth <= R.startMonth`** (la fila no tiene pasado todavía) → se **edita en su lugar**, sin crear filas nuevas.

Esto materializa "el pasado es inmutable" (RF-MF-003) sin generar filas por instancia mensual.

### Cálculo de aparición de fijos por mes — frecuencia (P2) y skips (P1)

La lógica "¿este fijo aparece en este mes?" está **centralizada en dos helpers exportados desde `movements.repository.ts`** y reutilizada por `findFijosByMonth`, la proyección anual y los tests:

- **`frequencyStep(frequency)`** → paso en meses: `MONTHLY=1`, `BIMONTHLY=2`, `QUARTERLY=3`, `BIANNUAL=6`, `ANNUAL=12`.
- **`isOnFrequency(startMonth, frequency, month)`** → `monthDiff(startMonth, month) % frequencyStep(frequency) === 0`. La frecuencia está **anclada al `startMonth`**.

Un fijo aparece en `month` si: `startMonth <= month` **y** (`deletedFrom IS NULL OR deletedFrom > month`) **y** `isOnFrequency(startMonth, frequency, month)` (RN-016). El primer par de condiciones (rango de actividad) se filtra en Prisma por comparación léxica de `YYYY-MM`; la condición de frecuencia se aplica en JS sobre los candidatos. **Cualquier cambio al cálculo de fijos por mes debe pasar por estos helpers, no re-duplicarse.**

**Skips (P1 — RF-MF-005):**
- En `findFijosByMonth`, cada fijo incluye sus skips del mes consultado (`include: { skips: { where: { month } } }`); `skipped = skips.length > 0`. El fijo anulado **se incluye igual en la lista** con `skipped: true`; **excluirlo de los totales es responsabilidad del caller** (`MovementsService`).
- En la **proyección anual**, los skips se cargan como **`Map<recurringId, Set<month>>` en una sola query** (`recurringSkip.findMany` por `recurring.userId`, en paralelo con los fijos) para evitar el N+1 que produciría un `include` anidado. Para cada mes del año se descarta el fijo si `skippedMonths.has(mes)` (no suma al anual), además de aplicar `isOnFrequency`.

### Eliminación (DELETE con `currentMonth` y `fromCurrentMonth`)

- **`boundary = fromCurrentMonth ? currentMonth : nextMonth(currentMonth)`** — el mes desde el cual el fijo deja de aparecer. `fromCurrentMonth = false` (checkbox desmarcado, default) → deja de aparecer desde el mes **siguiente**; `true` (checkbox marcado) → desde el mes **actual inclusive** (RF-MF-004).
- **Si `boundary <= startMonth`** (el fijo no aparecería en ningún mes) → **hard delete físico** de la fila. **Si no** → set `deletedFrom = boundary` (soft, sigue visible en los meses anteriores al `boundary`). El pasado nunca se toca.

### Gotchas

- **`fromCurrentMonth` llega como string** (`"true"` / `"false"`) en los query params; NestJS **no lo castea a boolean**. Hay que parsearlo explícitamente.
- **Validación de categoría consolidada:** la lógica de validación de categoría vive en **`CategoryValidatorService`** (módulo `categories`). Los tres módulos de movimientos lo inyectan. Ver sección **Movimientos en cuotas** abajo.

## Movimientos calculados

Un **calculado es un fijo** cuyo `amountCents` y `type` **no se ingresan ni se persisten**: se **derivan al vuelo** en lectura del monto de su movimiento de origen vía fórmula. Vive en el mismo `RecurringModule`. El origen puede ser **fijo, único o cuota** (RF-MCALC-008): el enganche es por **una de tres FK mutuamente excluyentes** (ver §Origen y enganche por FK). Endpoints y shape en `docs/data-model.md`, §Contrato de movimientos calculados; reglas en RF-MCALC-001..010 / RN-017/018/019. Lo no obvio:

### Origen y enganche por FK

- El `Recurring` calculado engancha al origen por **una sola** de tres FK, según el tipo: **fijo** → `sourceChainId` (`chainId` del fijo); **único** → `sourceMovementId` (FK a `Transaction`, `onDelete: Cascade`); **cuota** → `sourceInstallmentGroupId` (FK a `InstallmentGroup`, `onDelete: Cascade`). **Exclusión mutua** (exactamente una no-null en un calculado; las tres null = fijo normal) **validada en el service**.
- `startMonth` del calculado: lo deriva el backend del origen para único (mes del `Transaction`) y cuota (`grupo.startMonth`); para fijo viene en el body. **Único:** se acota la cadena a **un mes** con `deletedFrom = nextMonth`. **Cuota:** `deletedFrom = null`; el rango lo da on-the-fly `totalInstallments`.

### `chainId` — identidad de cadena estable

- Todo `Recurring` tiene un **`chainId`** (`@default(cuid())`). Un "fijo lógico" es una **cadena de filas** con el mismo `chainId`; en el **split** de edición (cierra R1, abre R2), **R2 hereda el `chainId` de R1** — el `id` de fila cambia, el `chainId` no.
- El calculado **vincula al origen por `sourceChainId` = `chainId` del origen** (NO un `Recurring.id` de fila). Así el vínculo **sobrevive a los splits** del origen (RF-MCALC-004). El calculado tiene además su **propia** `chainId` nueva (es su propia cadena, independiente).
- **Limitación conocida/aceptada:** las cadenas partidas por splits **anteriores** a la migración de `chainId` quedaron con `chainId`s separados (no se reagruparon retroactivamente).

### Derivación on-the-fly (Forma 2, no persistida)

Análogo a RN-006 (fijos/cuotas no generan filas por mes). Cada calculado se inyecta en la lista de **su tipo de origen**:

- **Calculado de fijo** → `findFijosByMonth` (y `getFijosTotalsByMonth`). **Calculado de único** → `findUnicosByMonth`. **Calculado de cuota** → la proyección de cuotas del mes. Cada uno busca los calculados por su FX (`sourceChainId` / `sourceMovementId` / `sourceInstallmentGroupId`) y los emite en esa lista con `origin` = tipo del origen.
- La fila del calculado persiste **placeholders** (`amountCents = 0`, `type = EXPENSE`) que **NUNCA** se usan para mostrar.
- Para cada calculado, `amountCents = applyFormula(montoOrigen, operator, operand, sign)` y `type` se **deriva del signo**: `> 0 → INCOME`, `≤ 0 → EXPENSE` (default `0 = EXPENSE`). Para **cuota**, `montoOrigen` = **monto por cuota** del grupo (no el total); para **único**, el monto del `Transaction`.
- **Presencia gobernada SOLO por el origen.** Un calculado aparece en el mes **sii el origen aparece en ese mes**: fijo → fila activa en el mes (no aplicar `isOnFrequency` con su **propio** `startMonth` — desalinea con step > 1, fue causa de un bug; hereda frecuencia, actividad y **skip** del origen); único → solo el mes del único; cuota → cada mes del rango `startMonth ≤ mes < startMonth + totalInstallments` del grupo.
- **Orden de cada lista por `Math.abs(amountCents)` DESC**, porque un calculado puede ser negativo y no debe quedar relegado al final.

### Imputación a totales (RN-019)

Cada calculado suma `|final|` al bucket de su **type derivado** (totales del mes y proyección anual de `/reportes`, incluidos los de único y cuota — RF-MCALC-010). El balance `ingresos − gastos` queda intacto; nunca hay restas a un bucket. Un calculado skippeado (por el origen fijo) no suma.

### Eliminación — tres caminos (RF-MCALC-005/009)

`DELETE /recurring/:id` (contrato uniforme: `currentMonth`/`fromCurrentMonth` siempre presentes):

- **(a) Calculado de único o cuota** (`sourceMovementId` o `sourceInstallmentGroupId` no-null) → **hard-delete total** del calculado, **ignorando** el boundary (no hay split — espeja su origen, RF-MCALC-009).
- **(b) Calculado de fijo** (`sourceChainId` no-null) → `applyBoundaryToChain(chainId, boundary)` sobre su propia cadena, sin tocar el origen.
- **(c) Fijo normal** (las tres FK null) → `applyBoundaryToChain(chainId, boundary)` (por fila: `boundary <= startMonth` → hard delete; si no → `deletedFrom = boundary`) y `cascadeDeleteCalculados(chainId, boundary)` que aplica el **mismo** boundary a cada cadena de calculado de **fijo** vinculada (`sourceChainId = chainId del origen`).

**Cascada del origen único/cuota → la da la DB.** El calculado de único/cuota engancha por FK `onDelete: Cascade`; borrar el `Transaction` (`DELETE /transactions/:id`) o el `InstallmentGroup` (`DELETE /installments/:id`) **borra entero** el calculado sin pasar por `RecurringService` (no hay split — RF-MCALC-005/009).

### Gotchas

- **`validateCategory` con `skipScopeCheck = true`** para calculados: como el `type` es derivado y varía mes a mes, no hay un type fijo contra el cual validar el scope; se acepta cualquier categoría compatible con `BOTH`.
- **`PATCH /recurring/:id` y `PATCH /recurring/:id/calculated` se excluyen mutuamente:** el primero rechaza `400` si el `:id` es calculado; el segundo, `400` si no lo es. En el split del calculado, R2 hereda `chainId`, la FK de origen (`sourceChainId` / `sourceMovementId` / `sourceInstallmentGroupId`) y la fórmula del original.
- **Exactamente una FK de origen no-null por calculado** (`sourceChainId` / `sourceMovementId` / `sourceInstallmentGroupId`); las tres null = fijo normal. La exclusión mutua se valida en el service.
- **Nunca persistir el monto/tipo derivado.** Si se agrega lógica que escribe `amountCents`/`type` de un calculado, es un bug: esos campos son placeholders.

## Movimientos en cuotas (InstallmentsModule)

Gestión de grupos de cuotas, **scopeada por `userId` del JWT**. El módulo expone **crear, editar y eliminar**; el listado del mes lo arma `MovementsModule` (ver **Integración de cuotas en `/movements`**). **No existe `GET /installments/:id`**: el front prefilea el formulario de edición desde el `MovementItem` que ya trae `/movements`.

### Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /installments` | `{ type, amountCents, totalInstallments, startMonth, categoryId, description? }` | `201` · `data: InstallmentGroup` | `400` |
| `PATCH /installments/:id` | `{ type?, amountCents?, totalInstallments?, startMonth?, categoryId?, description? }` | `200` · `data: InstallmentGroup` | `400` · `404` |
| `DELETE /installments/:id` | — | `204 No Content` | `404` |
| `POST /installments/:id/calculated` | calculado desde el grupo `:id` | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /installments/:id/calculated` | edita el calculado de cuota `:id` | `200` · `data: Recurring` | `400` · `404` |

- **Solo `EXPENSE` en v1:** el endpoint **rechaza `INCOME` con `400`** (resuelve la contradicción RF-MC-001 vs "Fuera de alcance: Ingreso en cuotas"). `amountCents` es el monto **por cuota** (entero `> 0`, RN-002), no el total. `totalInstallments` es la cantidad (entero `> 0`). `startMonth` es `YYYY-MM`.
- **`PATCH /installments/:id` — edita el grupo completo in-place (RF-MC-003).** Campos editables: monto por cuota, cantidad, mes de inicio, categoría, descripción. **El `type` no se edita.** **No hay split ni inmutabilidad del pasado** (a diferencia de los fijos): la edición aplica a todas las instancias del grupo. `404` si no existe o no es del usuario.
- **`DELETE /installments/:id` — hard delete del grupo entero.** Borra **físicamente** todas las cuotas (pasadas y futuras): `InstallmentGroup` no tiene `deletedFrom` ni soft delete. **`204` sin cuerpo.** `404` si no existe o no es del usuario. Si el grupo tiene calculados derivados (`sourceInstallmentGroupId`), la FK `onDelete: Cascade` los borra enteros (ver §Movimientos calculados, Eliminación).
- **`POST|PATCH /installments/:id/calculated`** — calculado de origen cuota (deriva del **monto por cuota**); contrato en `docs/data-model.md`, §Contrato de movimientos calculados; mecánica en §Movimientos calculados (abajo).
- **Validación de categoría:** idéntica a únicos y fijos (propia, activa, scope compatible RN-010); inexistente / ajena / eliminada / scope incompatible son todas `400`, nunca `409`; categoría ajena no se distingue de inexistente. Se delega en `CategoryValidatorService` (ver abajo).

### `CategoryValidatorService` — validador de categoría consolidado

La validación de categoría (existencia + pertenece al `userId` + activa + scope RN-010) que en Fases 4/6 estaba **duplicada** en `TransactionsService` y `RecurringService` se extrajo a **`CategoryValidatorService`**, en `backend/src/categories/`, exportado por `CategoriesModule`. Los tres módulos de movimientos (`transactions`, `recurring`, `installments`) lo **inyectan** en vez de reimplementar la lógica.

- **Una sola fuente de verdad:** si la regla de validación de categoría cambia, cambia en un solo lugar. Se mantiene el comportamiento previo: errores de categoría en movimientos son **`400`** (no `409`), y categoría ajena no se distingue de inexistente.

## Categorías (CategoriesModule)

CRUD completo, **scopeado por `userId` del JWT** (un usuario nunca ve ni toca categorías de otro). Todas las respuestas exitosas devuelven el shape de categoría. Shape y `movementCount` en `docs/data-model.md`, §Contrato de categoría.

### Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `GET /categories` | — | `200` · `data: Categoria[]` | — |
| `POST /categories` | `{ name, scope?, color? }` | `201` · `data: Categoria` | `400` · `409` (dos casos, ver abajo) |
| `POST /categories/:id/reactivate` | — (ignora el body) | `200` · `data: Categoria` | `404` · `409` |
| `PATCH /categories/:id` | `{ name?, scope?, color? }` | `200` · `data: Categoria` | `400` · `404` · `409` |
| `DELETE /categories/:id` | — | `204 No Content` | `404` |

- **`GET /categories`** — solo activas (`deletedAt` null), ordenadas por **nombre ascendente**, cada una con su `movementCount`.
- **`POST /categories`** — `name` obligatorio y no vacío; `scope` opcional (default `BOTH`); **`color` opcional**: debe pertenecer a la matriz de 70 (case-insensitive, se normaliza a mayúsculas). Si **no** llega `color`, el backend asigna el "menos usado" como red de seguridad (el front igualmente siempre lo envía). Dos casos de `409`:
  - **Colisión con una categoría activa** (RN-008): `error.message` = `"Ya existe una categoría activa..."`, **sin** `error.data`. Es un bloqueo duro de duplicado.
  - **Colisión con una categoría eliminada / reactivable** (RF-CAT-002, A3): `error.data = { reactivable: true, category: { id, name, scope, color } }`. El front usa ese `id` para ofrecer reactivar. Ver `ReactivableConflictException` abajo.
  - `400`: nombre vacío o faltante, `scope` inválido, o `color` fuera de la matriz.
- **`POST /categories/:id/reactivate`** — reactiva una categoría soft-deleted. Vuelve **exactamente como estaba** (mismo `id`, `name`, `scope`, `color`); lo que el usuario haya tipeado en el form de alta **se ignora**. `404` si no existe o no es del usuario; `409` si ya está activa.
- **`PATCH /categories/:id`** — `name`, `scope` y/o **`color`** (el color **es editable**; debe pertenecer a la matriz, case-insensitive, se almacena en mayúsculas — fuera de la matriz es `400`). `409` si el nuevo nombre colisiona con otra categoría activa (RN-014). `404` si no existe, no es del usuario, o está eliminada.
- **`DELETE /categories/:id`** — soft delete (marca `deletedAt`). **`204` sin cuerpo.** **No es idempotente**: borrar una categoría **ya eliminada** devuelve `404` (no `204`). También `404` si no existe o no es del usuario.

### Pool de colores (RF-CAT-005)

- **Única fuente:** `backend/src/categories/color-pool.ts`.
- **`COLOR_MATRIX` — set elegible (70 colores).** Matriz de 7 tonalidades × 10 hues (estilo Office). Es el conjunto de colores que el usuario puede elegir al crear/editar una categoría. La **fila T4** de la matriz es el pool de 10 base (ver `COLOR_POOL`).
- **`COLOR_POOL` — pool de 10 (fila base T4), sin cambios.** Los 10 colores base:
  `#4F86C6`, `#E07B54`, `#6DBF67`, `#A98BD6`, `#E8C84A`, `#5BC4B8`, `#E06B8B`, `#8B9DBF`, `#C47D3E`, `#7DBF9E`.
  Los primeros 4 son los de las categorías por defecto. `AuthService` y `CategoriesService` importan del mismo módulo; no hay colores hardcodeados sueltos.
- **Validación: `isValidCategoryColor()` / `normalizeColorHex()`.** El `color` recibido en `POST`/`PATCH` se **normaliza a mayúsculas** (`normalizeColorHex()`) y se **valida contra la matriz** (`isValidCategoryColor()`) en los DTOs vía el validador **`@IsColorInMatrix`**; un color fuera de la matriz es `400`. Solo colores de la matriz, sin hex libre.
- **`assignColor()` — default "menos usado", sobre la fila base T4 (`COLOR_POOL`), sin cambios.** Cuando el `POST` no trae `color` (red de seguridad — el front siempre lo envía), se asigna el color de `COLOR_POOL` **menos usado** entre las categorías **activas** del usuario; en empate gana el **primero en orden de definición**. Las 4 categorías por defecto del alta toman los primeros 4 colores en orden. El cálculo del menos-usado se hace **sobre los 10 base**, no sobre los 70. El color no se reasigna al editar; el usuario lo cambia explícitamente.

### Normalización y unicidad (RN-014)

- La unicidad de nombre entre activas se valida a **nivel de aplicación, no en la DB** (no hay `@@unique`). La comparación usa `normalizeName()`: trim + lowercase + NFD + strip de diacríticos (`"comida" = "Comida" = "Cómida"`). El `name` se **almacena tal cual lo tipeó el usuario**; la normalización es solo para comparar.

### Manejo de errores — extensión del filter

- **`ReactivableConflictException`** (409): el único error que adjunta `error.data` estructurado. Para soportarlo, el Global Exception Filter se extendió de forma **mínima** con un campo `data` **opcional** en el sobre de error: solo lo lleva este caso; el resto de los errores no incluyen `data`. Shape de `error.data` en `docs/data-model.md`, §Payload reactivable en errores (409).

## Preferencias de usuario (PreferencesModule)

Lectura y escritura del blob JSON de preferencias, **scopeado por `userId` del JWT** (un usuario nunca ve ni toca preferencias de otro). El blob es **abierto/extensible** — las claves las definen sus consumidores (secciones colapsadas/orden de `/mes`, reportes, filtro por categoría), no este módulo. Endpoints, semántica de reemplazo completo (no merge) y modelo en `docs/data-model.md`, §Contrato de preferencias de usuario y entidad `UserPreferences`. Abajo, lo propio de la implementación backend.

### Back-compat de usuarios sin fila (no se crea en lectura)

La fila `UserPreferences` **no se crea al leer**. Tanto `GET /preferences` como el armado del `AuthResponse` en los flujos de login devuelven **`{}`** cuando el usuario no tiene fila. La fila se materializa solo:

- en el **`PUT`** (upsert al mutar la primera preferencia), o
- en el **alta de cuenta nueva** — `register` y `google` con usuario nuevo crean la fila junto con las categorías por defecto (no en el `google` de un usuario que ya existía).

### `buildAuthResult` es `async`

El helper que arma el `AuthResponse` de los tres flujos de auth es **`async`** porque lee las preferencias del usuario. Relevante para quien lo **llame o lo mockee** (hay que `await`-earlo).

### Gotchas

- **Prisma 7 + tipo `Json` (cast obligatorio).** El campo `Json` tiene tipado estricto en `create` / `update` / `upsert`: un `Record<string, unknown>` **no es asignable directo** al input de Prisma. Requiere un cast (`as any` con comentario explicativo). El comportamiento en runtime es correcto; el cast es solo para el type-checker.
- **Tests e2e que levantan `AppModule` necesitan `userPreferences` en el mock de `PrismaService`.** Como `PreferencesModule` vive en `AppModule` y `AuthService` lo usa, el mock de `PrismaService` de cualquier e2e que arranque `AppModule` debe exponer `userPreferences` con `findUnique`, `upsert` y `create` — análogo al gotcha de `installmentGroup`. Sin esto, los flujos de auth (que leen preferencias) rompen en el setup del test.

## Autenticación

El `AuthModule` es el **emisor del JWT**: el backend es la autoridad de identidad y firma el token que el frontend reenvía en cada request (ver `docs/architecture.md`, Flujo de autenticación).

### Endpoints

Todas las respuestas usan el sobre `{ success, statusCode, data }`. El payload de éxito (`data`) de los tres endpoints es `{ accessToken, user, preferences }`, donde `user = { id, email, name|null, image|null }` y `preferences` es el **blob JSON de preferencias** del usuario (`{}` si no tiene fila; ver sección Preferencias de usuario). El armado lo hace `buildAuthResult`, que es **`async`** porque lee las preferencias.

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

`AuthService` importa el pool central (`src/categories/color-pool.ts`); no hay hex hardcodeados sueltos. Estos 4 colores son los primeros 4 del pool oficial (ver más abajo, **Pool de colores**). No se duplican si el usuario ya existía.

El alta nueva también crea la fila de **preferencias de usuario** (`UserPreferences`, blob `{}`) junto con las categorías por defecto — `register` y `google` con usuario nuevo (no el `google` de un usuario existente). Ver sección **Preferencias de usuario**.

## Reglas de negocio implementadas

<!-- Documentar reglas no obvias a medida que se implementen. -->
<!-- Ejemplo:
- El endpoint GET /movements filtra recurrentes donde startMonth <= mes consultado y (deletedFrom es null o deletedFrom > mes consultado)
-->
