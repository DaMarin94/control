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
├── history/        (historial de cambios + deshacer)
├── users/
├── auth/
├── common/         (helpers transversales a varios módulos)
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
| `Transaction` | Movimiento único (gasto o ingreso en un instante). Borrado lógico (`deletedAt`). |
| `Recurring` | Movimiento fijo mensual (plantilla activa desde un mes). |
| `InstallmentGroup` | Grupo de cuotas. `amountCents` es el monto **por cuota**, no el total; `totalInstallments` es la cantidad. |
| `UserPreferences` | Preferencias del usuario. **1:1 con `User`** (`userId` único, `onDelete: Cascade`); contenido en un campo `Json` `data` (default `{}`). Blob extensible para sumar prefs sin migraciones. |
| `HistoryEntry` | Entrada del historial de cambios: una fila por edición o eliminación de un movimiento, con el estado previo en un `snapshot Json`. Modelo, índices y contrato en `docs/data-model.md` §Historial de cambios; shape del snapshot en `src/history/history.types.ts`. |
| `Simulation` | Simulación de categoría: `userId` + `categoryId` y nada más. **Borrado físico** e índice único `(userId, categoryId)`. Modelo y contrato en `docs/data-model.md` §Simulación de categoría. |

**Enums:** `MovementType` (`EXPENSE` | `INCOME`), `CategoryScope` (`BOTH` | `EXPENSE` | `INCOME`), `HistoryTargetKind` (`UNICO` | `FIJO` | `CUOTA`) y `HistoryAction` (`EDIT` | `DELETE`).

### Decisiones de modelado (no obvias)

- **`onDelete`:**
  - `Cascade` en las FK `userId` — borrar un usuario borra todos sus movimientos y categorías.
  - `Restrict` en las FK `categoryId` — impide borrar físicamente una categoría mientras la referencien movimientos. Como las categorías usan soft delete, el caso no debería ocurrir; el `Restrict` es el último firewall a nivel DB.
- **Borrado por entidad:** las tres tablas de movimiento (`Transaction`, `Recurring`, `InstallmentGroup`) y las dos de metadato (`Category`, `PaymentMethod`) usan **borrado lógico** (`deletedAt`). En movimientos el borrado físico llega recién con la purga de la entrada de historial (ver §Historial de cambios); en `Category`/`PaymentMethod` no llega nunca (el registro queda para que los movimientos históricos lo sigan mostrando). `Simulation` es la única que se borra **físicamente** (RF-SIM-004). `Recurring` tiene además `deletedFrom`, que es otra cosa: el boundary por mes de un fijo vivo (ortogonalidad en `docs/data-model.md` §Decisiones de negocio → borrado lógico).
- **Fechas:** `Transaction.occurredAt` es `@db.Timestamptz` (UTC) + `timezone` IANA por registro (ver `docs/technical.md`, Fechas y zonas horarias). El resto de timestamps (`createdAt`, `updatedAt`) son de sistema.
- **Mes como `String "YYYY-MM"`:** `Recurring.startMonth` / `Recurring.deletedFrom` / `InstallmentGroup.startMonth`. Fijos y cuotas operan a nivel mes, sin día ni hora.
- **Montos en centavos (`Int`)** en todas las entidades de movimiento (RN-002). **IDs `cuid()`.**
- **Sin `@@unique([userId, name])` en `Category`** — la unicidad de nombre se valida en lógica de aplicación (comparación normalizada + flujo crear-o-reactivar). Ver `docs/data-model.md` y RN-014.
- **Índices:** `(userId, occurredAt)` en `Transaction` para la consulta de movimientos por mes; `userId` en `Category`, `Recurring` e `InstallmentGroup`.

### Filtro de borrado lógico (`src/common/soft-delete.helper.ts`)

Un registro de movimiento con `deletedAt != null` **no debe aparecer en ninguna lectura de negocio**: listados, totales, reportes, selectores y contadores (RF-HIST-006). El filtro **no se copia a mano** en cada query — vive centralizado en `src/common/soft-delete.helper.ts` y lo usan **todos** los repositorios que leen `Transaction` / `Recurring` / `InstallmentGroup` (`transactions`, `recurring`, `installments`, `movements`):

- **`NOT_DELETED`** — constante con el fragmento de `where` de Prisma (`{ deletedAt: null }`), para las queries del ORM.
- **`NOT_DELETED_TRANSACTION_SQL` / `NOT_DELETED_RECURRING_SQL` / `NOT_DELETED_INSTALLMENT_SQL`** — fragmentos `Prisma.sql` equivalentes, uno por alias de tabla ya usado en el codebase (`t` / `r` / `ig`), para los **7 `$queryRaw` de `movements.repository.ts`** (Prisma no acepta el objeto de filtro del ORM en SQL crudo; los fragmentos se componen anidados dentro del template).

**Por qué está centralizado:** un `deletedAt` olvidado **no rompe nada visible** — no tira error, no falla un tipo. Simplemente vuelve a incluir movimientos eliminados e **infla totales y reportes en silencio**. Toda query nueva sobre esas tres tablas arranca con el filtro puesto.

**No aplica al módulo `history`:** el undo y el reaper necesitan leer y mutar registros ya eliminados a propósito, y por eso acceden a Prisma sin el filtro (ver §Historial de cambios).

### Migraciones y seed

- Aplicar con `prisma migrate deploy` (prod/CI) o `prisma migrate dev` (desarrollo). La migración inicial ya está aplicada.
- Seed de desarrollo: `pnpm db:seed` (solo desarrollo). Detalle en `docs/technical.md`.

## Módulos

| Módulo | Ruta base | Descripción |
|--------|-----------|-------------|
| `movements` | `GET /movements`, `GET /movements/reports`, `GET /movements/reports/annual-unicos`, `GET /movements/reports/annual-cuotas`, `GET /movements/reports/annual-inflation-income` | Lista unificada del mes + serie de reportes agregada + grilla anual de Únicos + gantt anual de Cuotas + series anuales de Inflación vs Ingresos (transacciones + recurrentes + cuotas) |
| `transactions` | `/transactions` | Movimientos únicos (CRUD) |
| `recurring` | `/recurring` | Movimientos fijos (crear, editar, eliminar) |
| `installments` | `/installments` | Grupos de cuotas (crear, editar, eliminar) |
| `categories` | `/categories` | Categorías (CRUD + soft delete) |
| `payment-methods` | `/payment-methods` | Métodos de pago (CRUD + soft delete) |
| `preferences` | `/preferences` | Preferencias de usuario (blob JSON, lectura/escritura) |
| `history` | `/history` | Historial de cambios: listado de entradas + deshacer (simple y en cadena) |
| `simulations` | `/simulations` | Simulaciones de categoría: crear, listar, candidatas y eliminar + derivación de los movimientos simulados del mes |
| `users` | — | Creación de cuenta + categorías por defecto |
| `auth` | `/auth` | Registro, login y Google; emisión y validación del JWT (guard global) |
| `prisma` | — | PrismaService |

## Endpoints

El formato de toda respuesta (sobre `{ success, statusCode, data | error }`) está definido en `docs/technical.md`. Los DTOs y shapes concretos se definen al implementar cada endpoint.

### DELETE → `204 No Content`, sin body (convención del backend)

Los DELETE responden **`204 No Content` sin cuerpo**, de forma deliberada y consistente — cada controller lo declara con `@HttpCode(HttpStatus.NO_CONTENT)`: `DELETE /categories/:id`, `/payment-methods/:id`, `/simulations/:id`.

- **Excepción — los tres DELETE de movimientos** (`/transactions/:id`, `/recurring/:id`, `/installments/:id`) responden **`200` con `{ historyEntryId }`**: tienen que devolver el id de la entrada de historial y un `204` no puede llevar cuerpo. Contrato en `docs/data-model.md`, §Historial de cambios → `historyEntryId`.
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

### `GET /movements/reports/annual-inflation-income?year=YYYY&categories=&currency=&today=`
Devuelve las **series anuales de Inflación vs Ingresos** (12 meses: inflación IPC, variación % del ingreso y variación ajustada por inflación) más las **dos rectas de tendencia OLS** para la card `inflation-income` (RF-REP-012). Solo agrega movimientos de tipo **ingreso (`INCOME`)**. Contrato (params y shape) en `docs/data-model.md`, §Contrato de reporte anual de Inflación vs Ingresos; reglas de cálculo en la sección **Movimientos del mes (MovementsModule)** → Reporte anual de Inflación vs Ingresos.

### `POST /transactions` · `PATCH /transactions/:id` · `DELETE /transactions/:id`
CRUD de movimientos únicos. El monto siempre en centavos (entero > 0). El instante se guarda en UTC más la zona original del registro (ver fechas/timezone en `docs/technical.md`).

### `POST /recurring` · `PATCH /recurring/:id` · `DELETE /recurring/:id` · `POST|PATCH /recurring/:id/calculated`
Gestión de movimientos fijos y calculados. El PATCH y el DELETE reciben el mes actual (`currentMonth`) para resolver la inmutabilidad del pasado; el DELETE además usa `fromCurrentMonth` (query) para controlar desde cuándo deja de aparecer el fijo. Los **calculados** usan endpoints propios `POST|PATCH /recurring/:id/calculated`. Contrato completo en la sección **Movimientos fijos (RecurringModule)** y **Movimientos calculados**. **No hay `GET /recurring/:id`.**

### `POST /installments` · `PATCH /installments/:id` · `DELETE /installments/:id`
Gestión de grupos de cuotas. **Solo `EXPENSE` en v1** (rechaza `INCOME` con `400`). El PATCH edita el grupo completo in-place (RF-MC-003). El DELETE es **borrado lógico del grupo entero** (todas las cuotas, pasadas y futuras). **No hay `GET /installments/:id`**: el front prefilea desde el `MovementItem` de `/movements`. Contrato completo en la sección **Movimientos en cuotas (InstallmentsModule)**.

### `GET /categories` · `POST /categories` · `PATCH /categories/:id` · `DELETE /categories/:id`
CRUD de categorías. El DELETE es soft delete (`deletedAt`). Ver el contrato completo en la sección **Categorías (CategoriesModule)**.

### `GET /payment-methods` · `POST /payment-methods` · `POST /payment-methods/:id/reactivate` · `PATCH /payment-methods/:id` · `DELETE /payment-methods/:id`
CRUD de métodos de pago. El DELETE es soft delete (`deletedAt`). Ver el contrato completo en la sección **Métodos de pago (PaymentMethodsModule)**.

### `GET /preferences` · `PUT /preferences`
Lectura y escritura del blob JSON de preferencias del usuario autenticado. El `PUT` **reemplaza el blob entero** (no mergea) y hace upsert. Ver el contrato completo en la sección **Preferencias de usuario (PreferencesModule)**.

### `POST /simulations` · `GET /simulations` · `GET /simulations/candidates` · `DELETE /simulations/:id`
Simulaciones de categoría (RF-SIM-001..004). El `DELETE` es **borrado físico**, no registra historial y no es deshacible. El `POST` y los dos `GET` aceptan `today` (`YYYY-MM-DD`, opcional) para fijar el mes en curso del cálculo, con el mismo parseo y el mismo `400` ante formato inválido; el `DELETE` no. Contrato completo (y el gotcha del fallback UTC) en `docs/data-model.md`, §Simulación de categoría; mecánica en la sección **Simulación de categoría (SimulationsModule)**.

### `GET /history` · `POST /history/:id/undo`
Listado de entradas vigentes del historial de cambios y deshacer. El `POST` **no lleva body** y resuelve por sí solo el undo en cadena cuando la entrada está bloqueada (RF-HIST-004); responde `200` con `{ undone: true }` (no es un DELETE, no aplica la convención del 204). Contrato completo en `docs/data-model.md`, §Historial de cambios; mecánica en la sección **Historial de cambios (HistoryModule)**.

## Movimientos únicos (TransactionsModule)

CRUD completo, **scopeado por `userId` del JWT** (un usuario nunca ve ni toca movimientos de otro). Todas las respuestas exitosas devuelven el shape de Transaction, con la **categoría embebida**. Shape en `docs/data-model.md`, §Contrato de movimiento único.

### Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /transactions` | `{ type, amountCents, categoryId, occurredAt, timezone, description? }` | `201` · `data: Transaction` | `400` |
| `GET /transactions/:id` | — | `200` · `data: Transaction` | `404` |
| `PATCH /transactions/:id` | parcial (cualquier campo de POST) | `200` · `data: Transaction & { historyEntryId }` | `400` · `404` |
| `DELETE /transactions/:id` | — | `200` · `data: { historyEntryId }` | `404` |
| `POST /transactions/:id/skip` | — (sin body) | `200` · `data: { skipped }` | `404` |
| `POST /transactions/:id/calculated` | calculado desde el único `:id` | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /transactions/:id/calculated` | edita el calculado de único `:id` | `200` · `data: Recurring` | `400` · `404` |

- **`POST /transactions`** — `amountCents` entero **en centavos** (`> 0`); `occurredAt` ISO 8601 en **UTC**; `timezone` IANA. `400` por validación de DTO o por categoría inválida (ver Validación de categoría abajo).
- **`GET /transactions/:id`** — `404` si no existe o no es del usuario.
- **`PATCH /transactions/:id`** — body parcial (cualquier campo del POST). **Reaplica todas las validaciones** (RN-002 monto, RN-010 scope). `404` si no existe o no es del usuario.
- **`DELETE /transactions/:id`** — **borrado lógico** (`deletedAt`, RF-MU-003 / RF-HIST-006; reversible desde `/historial`). **`200` con `{ historyEntryId }`** (excepción a la convención de DELETE; ver `docs/data-model.md`, §Historial de cambios → `historyEntryId`). `404` si no existe o no es del usuario. Si el único tiene calculados derivados (`sourceMovementId`), se les aplica **cascada lógica** vía `RecurringService.cascadeSoftDeleteBySourceMovement` (ver §Movimientos calculados, Eliminación).
- **`POST /transactions/:id/skip` — toggle de anulación (RF-MU-005):** anula / des-anula el único, **sin body**. Es un **toggle** del flag `Transaction.skipped`: si estaba en `false` lo pone en `true` (`data: { skipped: true }`) y viceversa. Sin alcance temporal (anula la fila entera). `404` si el único no existe o no es del usuario. Un único anulado **se sigue listando** en `GET /movements` con `skipped: true` pero **no suma** a totales ni reportes.
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
- **Arranque y fin del fijo se resuelven por cadena (`loadChainBounds`, RF-MF-007 / RF-VM-007).** El helper `loadChainBounds(chainIds)` resuelve, por cada `chainId`, los dos bordes del fijo lógico en una sola query que trae las filas de la cadena:
  - **`startMonth`** (arranque) = el `startMonth` **mínimo** de la cadena (la **primera** fila).
  - **`endMonth`** (fin/vigencia) = el `deletedFrom` de la fila con **mayor `startMonth`** de la cadena (la **fila vigente**), `"YYYY-MM"` exclusivo; `null` = activo indefinidamente.
  **Gotcha estructural:** tras un split de edición (RF-MF-003) la fila **vigente** tiene el `startMonth` del **último split**, no el del fijo — mostrar ese campo afirmaría un arranque falso; y su `deletedFrom` es la terminación real del fijo. Por eso ambos bordes se resuelven **por cadena**, no por la fila suelta. Un **calculado de fijo** resuelve sus bordes por **su propio `chainId`** (no `sourceChainId`): muestra su propio arranque y su propio fin, no los del origen.

### Integración de cuotas en `/movements`

`MovementsModule` puebla la lista `cuotas` y suma las cuotas del mes a los totales llamando a `InstallmentsService` (regla de propiedad de dominio: nunca toca la tabla `installmentGroups`).

- **Cálculo on-the-fly (RN-006):** no hay filas por instancia mensual. Se consultan los grupos con `startMonth <= month` (comparación léxica de strings `YYYY-MM`, como los fijos) y se filtra en JS por `month < addMonths(startMonth, totalInstallments)`. Una cuota cae en el mes si `startMonth <= month < addMonths(startMonth, totalInstallments)`.
- **Número de cuota del mes (1-based):** `monthDiff(startMonth, month) + 1`. Va al campo `installment.number`; `installment.total = totalInstallments`. El `MovementItem` de una cuota trae `occurredAt`/`timezone` en `null` (sin día/hora) y `installment` poblado (en únicos/fijos `installment` es `null`).
- **Helpers `addMonths` / `monthDiff`** exportados desde `movements.repository.ts` — reusarlos, no reimplementar aritmética de meses.
- **Gotcha — `addMonths` soporta offsets negativos que cruzan el límite de año vía módulo verdadero.** El cálculo del mes destino usa `((month % 12) + 12) % 12` (módulo verdadero, no `%` de JS, que devuelve negativos): con eso `addMonths('2026-03', -3) = '2025-12'`. Imprescindible porque la **proyección de fijos (RF-REP-015)** arma su ventana con offsets negativos `[hoy-12 .. hoy]`; un módulo ingenuo desfasaría el año al retroceder más allá de enero.
- **Los totales del mes suman únicos + fijos + cuotas.**
- **Anulados excluidos de los totales del mes.** Igual que un fijo anulado, un **único anulado** (flag `Transaction.skipped`, RF-MU-005) y una **cuota anulada** (`InstallmentSkip` del mes, RF-MC-004) **se incluyen en la lista** con `skipped: true` pero **no suman** a `totals`; sus **calculados** heredan el estado del origen (RN-020).

### Integración de movimientos simulados en `/movements`

`MovementsService` pide los ítems simulados del mes a `SimulationsService` (regla de propiedad de dominio: nunca toca la tabla `simulations`) y los **mezcla dentro de la lista `unicos`**, reordenando el conjunto por magnitud DESC con el mismo criterio que `findUnicosByMonth`. Pasan por el **mismo** filtro de categorías y suman a los totales como cualquier único. Shape y campos nulos del ítem en `docs/data-model.md`, §Contrato de movimientos del mes → `simulated`; derivación en §Simulación de categoría (SimulationsModule).

### Serie de reportes (`GET /movements/reports?year=YYYY&categories=`)

Endpoint **agregado** para los reportes (RF-REP-001/002/005), scopeado por `userId` del JWT (RN-003). Devuelve totales por mes y el gasto mensual desglosado por categoría para un año — **no** devuelve movimientos individuales. **No modifica `GET /movements` mensual**: es un endpoint aparte, que reutiliza el mismo criterio de bucketeo (RN-015) sin introducir reglas de zona nuevas.

- **`year` (`YYYY`) obligatorio:** exactamente **4 dígitos**, rango **1900–2200**. Si falta, no tiene 4 dígitos o cae fuera de rango → `400`. `401` global por JWT inválido/ausente.
- **`categories` (lista de `categoryId`s separados por comas) opcional:** **omitido = todas las categorías** (sin filtro). El front lo manda con la **coma literal** (`categories=id1,id2`).
- **`currency` opcional (override de display, RF-REP-007):** una de las 4 monedas, **case-sensitive**. En `getReportsMovements`, el `displayCurrency` que alimenta todas las conversiones es `currencyOverride ?? userSettings.defaultCurrency`: omitido convierte a la default del usuario; presente y válido convierte a esa moneda. **Presente vacío o fuera del set → `400`.** El resto de la conversión (re-ruteo por pivote USD con la tabla de referencia del mes) es idéntico al de la default. Contrato del param en `docs/data-model.md`, §Contrato de serie de reportes.
- **`types` y `direction` opcionales (RF-REP-014):** `types` (CSV de `fijo`/`cuota`/`unico`, semántica de 3 estados igual que `categories`; valor fuera del set → `400`) y `direction` (`expense`/`income`/`both`, default `both`; fuera del set → `400`). El controller parsea ambos y los pasa a `getReportsMovements`; contrato y mapeo persistencia→query en `docs/data-model.md`, §Contrato de serie de reportes. Comportamiento abajo.
- **`projectFixed` y `today` opcionales (RF-REP-015):** `projectFixed=true` activa la proyección de fijos a futuro; ausente o cualquier otro valor = off. `today` (`YYYY-MM-DD`) fija el corte real/proyectado; ausente = ahora UTC; solo relevante con `projectFixed=true`. **Capacidad retenida del backend: hoy ningún consumidor del frontend manda estos params** (ninguna pantalla monta control de proyección). Contrato en `docs/data-model.md`, §Contrato de serie de reportes; regla de cálculo abajo.

> Shape de la respuesta (`ReportMovementsResponse` / `ReportMonth` / `ReportCategory`), invariante de consistencia y reglas de `months` / `categories` / `earliestYear` en `docs/data-model.md`, §Contrato de serie de reportes. Abajo solo cómo se calcula cada parte en el backend.

#### Cómo se computa cada parte (bucketeo, mismo criterio que el mensual — RN-015)

- **`months[*]` (12 meses).** Cada `incomeCents` / `expenseCents` suma **únicos + fijos activos + cuotas activas** con el mismo bucketeo que `GET /movements` mensual, sin regla de zona nueva:
  - **únicos** por `date_trunc('month', "occurredAt" AT TIME ZONE timezone)` (la zona propia del registro), **excluyendo los anulados** (flag `Transaction.skipped` → no suma; RF-MU-005);
  - **fijos** por `startMonth <= mes AND (deletedFrom IS NULL OR deletedFrom > mes)` **más** `isOnFrequency(startMonth, frequency, mes)`, **excluyendo los meses anulados** (`skippedMonths.has(mes)` → no suma; RF-MF-005);
  - **cuotas** por `startMonth <= mes < addMonths(startMonth, totalInstallments)`, **excluyendo las instancias anuladas** (`InstallmentSkip` del mes → no suma; RF-MC-004).
- **Exclusión de anulados — transversal.** Un movimiento anulado (`skipped: true`) queda fuera de **todas** las agregaciones: totales de `GET /movements`, series `income-expense` y desglose `by-category` de `GET /movements/reports`, y los reportes anuales (Únicos, Cuotas —con el matiz del gantt, ver §Reporte anual de Cuotas—, Inflación vs Ingresos). Aplica por igual a únicos, cuotas, fijos y sus calculados (el calculado hereda el skip del origen; RN-020).
- **`categories[*]`.** El desglose por categoría **no filtra por `Category.deletedAt`** (incluye soft-deleted con gasto histórico, igual que el mensual). Orden por gasto anual total DESC, desempate por `categoryId` ASC.
- **`earliestYear`.** Mínimo entre el año del mes local de cualquier único (`AT TIME ZONE`) y el año del `startMonth` de cualquier fijo o cuota; `null` si el usuario no tiene movimientos.
- **`availableCategories`.** Universo de categorías con gasto `EXPENSE` del año, computado **independiente del filtro `categories`** (igual que `earliestYear`): es el superconjunto estable que alimenta la leyenda-filtro del front. Incluye soft-deleted con gasto histórico; orden por gasto anual DESC, desempate `categoryId` ASC. Shape en `docs/data-model.md`, §Contrato de serie de reportes.

#### Filtro de categorías (RF-REP-005)

- **Afecta Forma 1 y Forma 2.** El filtro restringe qué movimientos cuentan: en `months[*]` (Forma 1: `incomeCents`/`expenseCents`) **y** en `categories[*]` (Forma 2: las bandas apiladas). Una categoría omitida no aparece en ninguna de las dos.
- **`earliestYear` y `availableCategories` IGNORAN el filtro** — se calculan sobre **todos** los movimientos del usuario (del año, en el caso de `availableCategories`), para que ni los límites de navegación de año (RF-REP-002) ni la leyenda-filtro salten al cambiar el filtro.
- **Filtrado in-memory, NO en SQL/ORM:** se trae el universo de movimientos del año y se filtra en JS con un **`Set` de `categoryId`s** pedidos (omitido = sin filtrar). El invariante `SUM(bandas por categoría) == expenseCents del mes` **se mantiene con el filtro activo** (ambos lados se computan sobre el mismo conjunto filtrado).

#### Filtros de tipo y dirección (RF-REP-014)

Sobre los **totales mensuales** (`incomeCents`/`expenseCents`), `getReportsMovements` aplica además, con el **mismo criterio de imputación que RN-015**, dos filtros combinables (AND) con el de categorías:

- **Tipo de movimiento** — `Set` de `["fijo","cuota","unico"]` (3 estados igual que categorías: `null` = todos, `Set` vacío = ninguno → totales en cero, subconjunto = los pedidos). Acota qué orígenes aportan a las series.
- **Dirección** — `both` (default, sin filtro) / `expense` (suma solo gastos) / `income` (suma solo ingresos).
- **Solo totales.** Los filtros de tipo/dirección afectan `months[*]`; `categories[*]`, `availableCategories` y `earliestYear` se calculan **ignorándolos** (superconjunto estable, igual que ante el filtro de categorías).
- **Gotcha — dirección y tipo de un calculado se resuelven al vuelo, no por la fila origen:**
  - La **dirección** (income/expense) de un movimiento **calculado** la fija su `derivedType` —el signo del monto tras aplicar `formulaSign`—, no el `type` de la fila origen: un calculado puede **invertir** el signo del origen (un calculado-de-fijo de gasto puede resultar `INCOME`, y viceversa). El filtro `direction` se aplica sobre ese `derivedType`.
  - El **tipo de movimiento** de un calculado se **hereda de su fuente**: un calculado-de-fijo cuenta como `fijo`, un calculado-de-cuota como `cuota`, un calculado-de-único como `unico`. El filtro `types` matchea por ese tipo heredado, no por una categoría propia del calculado.

#### Proyección de fijos a futuro (RF-REP-015) — capacidad retenida, no consumida por el frontend

El motor vive en `src/common/projection.helper.ts` (`computeFixedBasketProjection`), junto a la regresión de RF-SIM-002 — ver §Simulación de categoría → Infraestructura de proyección compartida. El endpoint conserva esta capacidad, pero **ninguna pantalla la pide hoy** (no hay control de proyección en el frontend). Con `projectFixed=true`, los meses **posteriores a `today`** del año pedido se marcan `projected: true` (ver `docs/data-model.md`, §Contrato de serie de reportes) y suman, sobre el dato real, la proyección de los fijos. Sin el param (caso actual) todos los meses vienen `projected: false` y los totales son los de siempre.

- **Solo fijos.** En el tramo futuro solo se proyectan los **fijos** (cuotas y únicos **no** se extienden a futuro). Los fijos de gasto extienden `expenseCents`; los de ingreso, `incomeCents`. El mes futuro de cada línea vale **solo** el valor proyectado de fijos.
- **Método — esqueleto determinista × tasa de crecimiento de fijos, por línea.** La proyección se calcula **por línea** (gasto e ingreso por separado). Para cada mes futuro `m` (meses hacia adelante desde hoy): `valor_línea(m) = canasta_conocida(m) × (1 + tasa_precio)^m`, compuesto, sin truncar decimales intermedios; el redondeo va solo al valor final.
- **`canasta_conocida(m)` — esqueleto determinista por mes.** Suma del monto de los fijos en alcance **activos en el mes futuro `m`** según el criterio de actividad de la serie real (RN-016: `startMonth ≤ mes`, no eliminado en el mes, `isOnFrequency`), cada uno a su **último monto conocido** (segmento vigente de su cadena de splits `Recurring`, RN-005). Solo fijos —normales y calculados-de-fijo—; cuotas y únicos no. Reusa la misma imputación mensual del tramo real, extendida a meses futuros: las altas con `startMonth` futuro, las bajas (`deletedFrom`) y la cadencia (anual/bimestral) entran acá de forma determinista, **no** vía la tasa.
- **`tasa_precio` — crecimiento propio de cada fijo, ponderado por tamaño, 12 meses.** Tasa mensual medida **por línea** sobre las cadenas de fijo **activas hoy** en alcance (solo fijos). Por cada cadena `i`: se toma su **monto más viejo dentro de `[hoy-12 .. hoy-1]`** (el mes más antiguo, hasta 12 atrás, en que esa cadena estaba activa) como `old_i` a `n_i` meses, y su monto de hoy `today_i`; `growth_i = (today_i / old_i)^(1/n_i) − 1`. `tasa_precio = Σ(today_i · growth_i) / Σ(today_i)` sobre las cadenas con historia previa. Una cadena **sin monto previo en la ventana** (alta reciente) o con `old_i <= 0` se **excluye de la tasa** (pero sigue en `canasta_conocida`, así un alta no infla la tasa).
- **Piso en 0 — sin bajas.** `max(0, tasa_precio)` sobre el agregado final (nunca proyecta bajas). Si ninguna cadena tiene historia previa en la ventana, `tasa_precio = 0` (proyección plana al esqueleto).
- **Racional (estructural).** Se mide el crecimiento real de cada fijo sobre su propia historia, ponderado por tamaño, en vez de anclar en un único mes común de la ventana: los fijos que varían cuentan aunque tengan pocos meses de historia, los planos aportan ~0, y las altas no inflan la tasa (las absorbe la canasta determinista).
- **Sin IPC.** El pronóstico **no** usa `InflationRate` en ningún caso (ni motor, ni mezcla, ni fallback). Un fijo nunca editado no aporta señal a la tasa (su crecimiento propio es 0) y contribuye plano a su monto real.
- **Skips.** No cuentan para la tasa (ausencia puntual, no cambio de precio); sí afectan `canasta_conocida(m)` (un mes skippeado aporta 0 de ese fijo ese mes).
- **Limitación de moneda.** La proyección se calcula enteramente sobre la serie en **moneda de display**: los montos de las puntas y del esqueleto se toman ya convertidos con el TC de sus propios meses, y el crecimiento hacia adelante no vuelve a convertir. Proyectar en moneda propia exigiría tipos de cambio futuros que el sistema no tiene.
- **Horizonte ilimitado.** La proyección no se corta a fin de año: un año **completamente futuro** ⇒ los 12 meses vienen proyectados.
- **Respeta los filtros de RF-REP-014.** `direction` / `types` / `categories` acotan qué fijos entran tanto en el esqueleto como en el cómputo de la tasa, con el mismo criterio que aplican al tramo real (un `types` sin `fijo` deja el tramo futuro sin proyección de fijos; `direction=income` proyecta solo los fijos de ingreso, etc.).
- **Gotcha — el desglose por categoría no incluye fijos futuros.** Con `projectFixed=true`, `categories[*]` **no** recibe contribución de fijos en los meses proyectados (la proyección solo alimenta los totales de línea `incomeCents`/`expenseCents`). Nota técnica sin efecto en producto: ninguna pantalla consume la proyección.

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
- **Ancla de la escala de color (`anchorUsdCents` / `colorAnchorCents`).** El techo de la rampa de color es **editable por card** (RF-REP-010) vía los params `anchorAmountCents` + `anchorCurrency` (all-or-nothing; contrato en `docs/data-model.md`). `getAnnualUnicosReport` computa el ancla en dos pasos: (1) convierte `(anchorAmountCents, anchorCurrency) → USD cents` con el TC de **enero del año pedido** (`pivotRatesForYear` + `deriveExchangeRate`, mismo mecanismo que alimenta `colorAnchorCents`); USD es passthrough; **`Math.round`**; **fallback: sin `ReferenceRate` de enero → default `1500`** (mismo criterio defensivo del resto del reporte). Sin override, el ancla es `1500` (15 USD). El resultado se emite en `anchorUsdCents`. (2) Reconvierte ese USD a la moneda de display (`currency`) con el mismo TC de enero → `colorAnchorCents`. Tope de la rampa de color, no una cotización de negocio. Shape en `docs/data-model.md`, §Contrato de reporte anual de Únicos.

### Reporte anual de Cuotas (`GET /movements/reports/annual-cuotas`)

Gantt anual de barras horizontales para la card `installment-gantt` (RF-REP-011), scopeado por `userId` del JWT. Contrato (params, shape `CuotasGanttResponse` / `CuotasGanttBar`) en `docs/data-model.md`, §Contrato de reporte anual de Cuotas. Reglas de negocio:

- **Solo cuotas de tipo gasto (`EXPENSE`) que intersectan el año.** Entra todo plan de cuotas que **toca** el año pedido: el que empieza antes y sigue dentro, o el que empieza dentro y sigue (o termina) después. Fijos, únicos y calculados no entran. Las cifras vienen **convertidas a la moneda de display** (`currency` del param o la default del usuario).
- **Filtro de categorías antes del packing.** El subconjunto de `categories` (tres estados, RF-REP-002) se aplica **antes** de calcular renglones: el packing opera sobre las barras ya filtradas.
- **Packing (asignación de renglones).** Las barras se ordenan por **origen de la cuota** (`startMonth` ASC, mes de la primera cuota; desempate `createdAt` ASC) y se ubican en renglones; `rowIndex` arranca en `0` (renglón pegado al eje). Una barra **reusa** un renglón si **no entra en conflicto con ninguno** de los intervalos ya asignados a ese renglón —conflicto = menos de 1 mes de descanso a cualquiera de los dos lados—, **aprovechando huecos intermedios** (una barra puede ubicarse entre dos ya colocadas si hay ≥1 mes de descanso a cada lado). Se elige el renglón **más bajo** que la admita; si ninguno sirve, se abre uno nuevo por encima. Por el orden por `startMonth` ASC, la de origen más temprano queda en el renglón más cercano al eje. Calculado en el backend sobre el subconjunto ya filtrado. El front invierte el eje al renderizar (ver `docs/frontend.md`).
- **Rango real de la barra.** Cada barra emite `realStartMonth`/`realEndMonth` (`YYYY-MM`) con el período **completo** del plan (primera y última cuota), **sin recortar al año** —distinto de `startMonthIndex`/`endMonthIndex`, que se clampean a 0–11—; el front los usa para el rango del tooltip. Ver `docs/data-model.md`, §Contrato de reporte anual de Cuotas.
- **Conversión del monto por cuota — TC del primer mes visible de la barra.** Si `startMonth` del plan cae **dentro** del año, se usa el TC de **ese mes**; si es **anterior** al año, se usa el TC de **enero del año** (`YYYY-01`). Vía `pivotRatesForYear` con clamp al mes disponible. Coherente con la regla de que las cuotas usan el TC oficial del mes de la instancia.
- **Gotcha estructural — el gantt NO considera la anulación (skip) de cuotas.** `getAnnualCuotasReport` renderiza **una barra por plan de cuotas con un monto estático por cuota** (no una suma mensual agregada), así que la anulación de una instancia mensual (`InstallmentSkip`, RF-MC-004) **no mapea** sobre esta vista: la barra representa el plan completo, no el gasto real mes a mes. Es deliberado —no es un bug a "corregir"—: a diferencia de los totales del mes y de la serie `income-expense` (que sí excluyen los meses anulados), el gantt muestra la estructura del plan, no la imputación mensual.

### Reporte anual de Inflación vs Ingresos (`GET /movements/reports/annual-inflation-income`)

Series anuales en **puntos porcentuales** para la card `inflation-income` (RF-REP-012), scopeado por `userId` del JWT. Contrato (params, shape `AnnualInflationIncomeResponse` / `InflationIncomeMonth` / `TrendLine`) en `docs/data-model.md`, §Contrato de reporte anual de Inflación vs Ingresos. Reglas de negocio:

- **Total de ingreso del mes (insumo).** Suma de movimientos **`INCOME`** imputados al mes —únicos por su mes local (`AT TIME ZONE`, RN-015) + fijos/cuotas aplicables a nivel mes—, convertida a la moneda de display (`currency` del param o la default) con el mismo re-ruteo por pivote USD que el resto. El **mes en curso** usa el total **a la fecha** (`today`); los **meses futuros** no se computan (`incomePct`/`incomePctAdj` → `null`). El repo expone **`getUnicosIncomeForMonth`** para la parte de únicos; fijos y cuotas se suman vía sus services (propiedad de dominio).
- **`incomePct` — variación % MoM del ingreso.** `ROUNDDOWN((ingresoActual × 100 / ingresoPrevio) − 100, 2)`, **trunca hacia cero** (no redondea). El mes previo de **enero es diciembre del año anterior** (continuidad temporal; **requiere consultar el ingreso fuera del año pedido**, igual que `pctVsPrev` de Únicos). `null` si `ingresoPrevio == 0` o el mes es futuro.
- **`incomePctAdj` — variación ajustada por inflación.** Igual que `incomePct`, pero el ingreso del mes previo se **infla por la variación IPC del mes en curso** (`incomePctAdj` usa `inflationPct/100`) antes de comparar — misma semántica que `pctVsPrevAdj` del reporte de Únicos. `null` si falta el IPC del mes, si `ingresoPrevio == 0` o si el mes es futuro.
- **`inflationPct`.** `InflationRate.monthlyVariation` (puntos %, unidad canónica del sistema; ver Reporte anual de Únicos para la conversión ×100 en la ingesta) del mes; `null` si no hay fila de IPC.
- **Tendencias OLS (`incomeTrend` / `incomeAdjTrend`).** Recta de mínimos cuadrados ajustada sobre los **puntos no nulos** de `incomePct` e `incomePctAdj` respectivamente (x = índice de mes 0–11). Emite `{ slope, intercept, points }`; `points` = la recta evaluada en los 12 meses, **`null` si la serie madre tiene < 2 puntos no nulos**. El helper **`computeLinearTrend`** (exportado) encapsula el ajuste; reusarlo, no reimplementar.
- **`earliestYear` y `availableCategories` ignoran el filtro `categories`** (superconjunto estable, mismo criterio que la serie de reportes). `availableCategories` es el universo de categorías con **ingreso (`INCOME`)** del año (no de gasto, a diferencia de los otros reportes). El filtro `categories` sí restringe qué ingresos cuentan en las series.

## Movimientos fijos (RecurringModule)

Gestión de movimientos fijos, **scopeada por `userId` del JWT**. El módulo expone **crear, editar y eliminar**; el listado del mes lo arma `MovementsModule` (sección anterior). **No existe `GET /recurring/:id`**: el front prefilea el formulario de edición desde el `MovementItem` que ya trae `/movements`, sin un GET extra.

### Endpoints

| Endpoint | Entrada | Éxito | Errores |
|----------|---------|-------|---------|
| `POST /recurring` | `{ type, amountCents, categoryId, startMonth, frequency?, description? }` | `201` · `data: Recurring` | `400` |
| `PATCH /recurring/:id` | `{ amountCents?, categoryId?, description?, currentMonth }` | `200` · `data: Recurring & { historyEntryId }` | `400` · `404` |
| `POST /recurring/:id/skip` | `{ month }` (`YYYY-MM`) | `200` · `data: { skipped, month }` | `400` · `404` |
| `POST /recurring/:id/calculated` | calculado desde el fijo `:id` | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /recurring/:id/calculated` | edita el calculado `:id` | `200` · `data: Recurring` | `400` · `404` |
| `DELETE /recurring/:id` | query: `currentMonth`, `fromCurrentMonth` | `200` · `data: { historyEntryId }` | `404` |

- **`type`, `startMonth` y `frequency` no son editables** por PATCH: solo `amountCents`, `categoryId` y `description` (RF-MF-003). El `startMonth` del POST es el mes actual que envía el front.
- **`frequency`:** **entero 1..12** (meses entre apariciones), opcional en el `POST`, default **`1`** (mensual) si se omite. `400` si no es entero o cae fuera de 1..12 (validado en el DTO; no hay CHECK en la DB). Es **inmutable** (como `type`): no se acepta en PATCH; en el split (abajo) la fila nueva R2 la **hereda del original**. La respuesta del `POST` incluye `frequency`. Detalle del cálculo "¿este fijo aparece en este mes?" en **Cálculo de aparición de fijos por mes** (abajo).
- **`POST /recurring/:id/skip` — toggle de anulación:** anula / des-anula la aparición de un fijo en un mes puntual (RF-MF-005). Body `{ month: "YYYY-MM" }`. Es un **toggle**: si ya existe el skip `(fijo, mes)` lo borra (`data: { skipped: false, month }`); si no existe lo crea (`data: { skipped: true, month }`). `404` si el fijo no existe o no es del usuario; `400` si el `month` no cumple `YYYY-MM`. **No valida** que el mes sea una aparición real del fijo según su frecuencia (solo formato y ownership) — esa validación semántica es del frontend, que ya tiene el ítem del mes. Un mes anulado **se sigue listando** en `GET /movements` con `skipped: true` pero **no suma** a los totales ni a la serie anual.
- **Validación de categoría:** idéntica a la de movimientos únicos — categoría propia, activa y con scope compatible (RN-010); inexistente / ajena / eliminada / scope incompatible son todas `400` (ver `validateCategory` abajo).

### Inmutabilidad del pasado vía "split al editar"

Un **fijo lógico** es una **cadena de filas `Recurring`** en el tiempo, no una sola fila. El PATCH recibe `currentMonth` (el mes actual real, calculado por el front) y decide según dónde cae respecto del `startMonth` de la fila editada (`R`):

- **`currentMonth > R.startMonth`** (el fijo ya corrió meses pasados) → **split**: se cierra la fila vieja (`deletedFrom = currentMonth`, deja de aparecer desde el mes actual) y se **crea una fila nueva** R2 (`startMonth = currentMonth`) con los valores nuevos. La respuesta trae la **fila nueva, con otro `id`**. Así los meses pasados conservan los valores viejos y el actual/futuro toman los nuevos. R2 **hereda `deletedFrom` de la fila original** (además de `type`, `categoryId` y `description`) para preservar una terminación previa: si el fijo ya tenía una eliminación futura programada (`deletedFrom` no nulo), R2 debe respetarla; de lo contrario el gasto reaparecería después del mes en que se había eliminado.
- **`currentMonth <= R.startMonth`** (la fila no tiene pasado todavía) → se **edita en su lugar**, sin crear filas nuevas.

Esto materializa "el pasado es inmutable" (RF-MF-003) sin generar filas por instancia mensual.

### Cálculo de aparición de fijos por mes — frecuencia (P2) y skips (P1)

La lógica "¿este fijo aparece en este mes?" está **centralizada en el helper `isOnFrequency` exportado desde `movements.repository.ts`** y reutilizada por `findFijosByMonth`, la proyección anual y los tests:

- **`isOnFrequency(startMonth, frequency, month)`** → `monthDiff(startMonth, month) % frequency === 0`, con `frequency` el entero 1..12 directo (RN-016). La frecuencia está **anclada al `startMonth`**.

Un fijo aparece en `month` si: `startMonth <= month` **y** (`deletedFrom IS NULL OR deletedFrom > month`) **y** `isOnFrequency(startMonth, frequency, month)` (RN-016). El primer par de condiciones (rango de actividad) se filtra en Prisma por comparación léxica de `YYYY-MM`; la condición de frecuencia se aplica en JS sobre los candidatos. **Cualquier cambio al cálculo de fijos por mes debe pasar por estos helpers, no re-duplicarse.**

**Skips (P1 — RF-MF-005):**
- En `findFijosByMonth`, cada fijo incluye sus skips del mes consultado (`include: { skips: { where: { month } } }`); `skipped = skips.length > 0`. El fijo anulado **se incluye igual en la lista** con `skipped: true`; **excluirlo de los totales es responsabilidad del caller** (`MovementsService`).
- En la **proyección anual**, los skips se cargan como **`Map<recurringId, Set<month>>` en una sola query** (`recurringSkip.findMany` por `recurring.userId`, en paralelo con los fijos) para evitar el N+1 que produciría un `include` anidado. Para cada mes del año se descarta el fijo si `skippedMonths.has(mes)` (no suma al anual), además de aplicar `isOnFrequency`.

### Eliminación (DELETE con `currentMonth` y `fromCurrentMonth`)

- **`boundary = fromCurrentMonth ? currentMonth : nextMonth(currentMonth)`** — el mes desde el cual el fijo deja de aparecer. `fromCurrentMonth = false` (checkbox desmarcado, default) → deja de aparecer desde el mes **siguiente**; `true` (checkbox marcado) → desde el mes **actual inclusive** (RF-MF-004).
- **El boundary se aplica fila por fila con `applyBoundaryToChain(chainId, boundary)`** (helper privado de `RecurringService`, compartido por el DELETE de fijos y por la cascada a calculados). Por cada fila de la cadena:
  - **`boundary <= startMonth`** (la fila no aparecería en ningún mes) → **borrado lógico** de la fila (`deletedAt`, RF-HIST-006), **no** borrado físico: el snapshot del historial necesita que la fila siga existiendo para poder restaurarla.
  - **`deletedFrom` nulo o mayor que el boundary** → set `deletedFrom = boundary` (la fila sigue visible en los meses anteriores).
  - **`deletedFrom <= boundary`** (la fila ya terminó antes) → no se toca. El pasado nunca se toca.

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
- **Cadenas legacy fragmentadas.** Las cadenas partidas por splits **anteriores** a la migración de `chainId` quedaron con `chainId`s separados. Se **re-unen** con el script de mantenimiento `backend/scripts/restitch-recurring-chains.ts` (`pnpm restitch:recurring-chains`), que agrupa por **identidad = descripción del fijo** (única por fijo) y fusiona en una sola cadena los grupos con múltiples `chainId` cuyos tramos no se solapan; solo re-apunta `chainId` / `sourceChainId`, sin tocar montos ni fechas. Es limpieza de una sola vez: el split de edición en curso ya hereda el `chainId` y no fragmenta.

### Derivación on-the-fly (Forma 2, no persistida)

Análogo a RN-006 (fijos/cuotas no generan filas por mes). Cada calculado se inyecta en la lista de **su tipo de origen**:

- **Calculado de fijo** → `findFijosByMonth` (y `getFijosTotalsByMonth`). **Calculado de único** → `findUnicosByMonth`. **Calculado de cuota** → la proyección de cuotas del mes. Cada uno busca los calculados por su FX (`sourceChainId` / `sourceMovementId` / `sourceInstallmentGroupId`) y los emite en esa lista con `origin` = tipo del origen.
- La fila del calculado persiste **placeholders** (`amountCents = 0`, `type = EXPENSE`) que **NUNCA** se usan para mostrar.
- Para cada calculado, `amountCents = applyFormula(montoOrigen, operator, operand, sign)` y `type` se **deriva del signo**: `> 0 → INCOME`, `≤ 0 → EXPENSE` (default `0 = EXPENSE`). Para **cuota**, `montoOrigen` = **monto por cuota** del grupo (no el total); para **único**, el monto del `Transaction`.
- **Presencia gobernada SOLO por el origen.** Un calculado aparece en el mes **sii el origen aparece en ese mes**: fijo → fila activa en el mes (no aplicar `isOnFrequency` con su **propio** `startMonth` — desalinea con step > 1, fue causa de un bug; hereda frecuencia, actividad y **skip** del origen); único → solo el mes del único; cuota → cada mes del rango `startMonth ≤ mes < startMonth + totalInstallments` del grupo.
- **Orden de cada lista por `Math.abs(amountCents)` DESC**, porque un calculado puede ser negativo y no debe quedar relegado al final.

### Detección de derivados en el origen (`hasCalculated` + `calculatedChildren`)

El `MovementItem` de un ítem **origen** expone sus calculados derivados: `hasCalculated` (booleano) y `calculatedChildren` (la lista; shape `CalculatedChild` en `docs/data-model.md`, §Contrato de movimientos del mes). Se resuelve para los **tres orígenes** —único, fijo y cuota pueden ser padres (RF-MCALC-008)— con alcance **estrictamente el mes consultado**:

- Por cada ítem origen se buscan los calculados que lo referencian por su FK (`sourceChainId` para fijo, `sourceMovementId` para único, `sourceInstallmentGroupId` para cuota) y que **aparecen ese mes** (misma regla de presencia gobernada por el origen). Un derivado que no cae en el mes (por frecuencia o skip del origen) **no entra**.
- `calculatedChildren` = esos derivados con su monto ya derivado al vuelo y convertido a la default; `hasCalculated = calculatedChildren.length > 0`.
- Un calculado **nunca es padre** (RF-MCALC-001): su `hasCalculated` es `false` y su `calculatedChildren` es `[]` (sin encadenamiento).

### Imputación a totales (RN-019)

Cada calculado suma `|final|` al bucket de su **type derivado** (totales del mes y proyección anual de `/reportes`, incluidos los de único y cuota — RF-MCALC-010). El balance `ingresos − gastos` queda intacto; nunca hay restas a un bucket. Un calculado skippeado (por el origen fijo) no suma.

### Eliminación — tres caminos (RF-MCALC-005/009)

`DELETE /recurring/:id` (contrato uniforme: `currentMonth`/`fromCurrentMonth` siempre presentes):

- **(a) Calculado de único o cuota** (`sourceMovementId` o `sourceInstallmentGroupId` no-null) → **borrado lógico total** del calculado, **ignorando** el boundary (no hay split — espeja su origen, RF-MCALC-009).
- **(b) Calculado de fijo** (`sourceChainId` no-null) → `applyBoundaryToChain(chainId, boundary)` sobre su propia cadena, sin tocar el origen.
- **(c) Fijo normal** (las tres FK null) → `applyBoundaryToChain(chainId, boundary)` (ver §Movimientos fijos → Eliminación) y `cascadeDeleteCalculados(chainId, boundary)`, que aplica el **mismo** boundary a cada cadena de calculado de **fijo** vinculada (`sourceChainId = chainId del origen`).

**Cascada del origen único/cuota → la aplica el service, no la DB.** La FK del calculado de único/cuota declara `onDelete: Cascade`, pero como el origen ahora se borra **lógicamente** la fila nunca desaparece y la cascada de la DB **no se dispara**. El borrado del origen llama explícitamente a `RecurringService.cascadeSoftDeleteBySourceMovement` / `cascadeSoftDeleteBySourceInstallmentGroup`, que marcan `deletedAt` en las filas del calculado (no hay split — RF-MCALC-005/009). Es lo que permite que deshacer la eliminación del origen restaure también sus calculados (RN-024).

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
| `PATCH /installments/:id` | `{ type?, amountCents?, totalInstallments?, startMonth?, categoryId?, description? }` | `200` · `data: InstallmentGroup & { historyEntryId }` | `400` · `404` |
| `DELETE /installments/:id` | — | `200` · `data: { historyEntryId }` | `404` |
| `POST /installments/:id/skip` | `{ month }` (`YYYY-MM`) | `200` · `data: { skipped, month }` | `400` · `404` |
| `POST /installments/:id/calculated` | calculado desde el grupo `:id` | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /installments/:id/calculated` | edita el calculado de cuota `:id` | `200` · `data: Recurring` | `400` · `404` |

- **Solo `EXPENSE` en v1:** el endpoint **rechaza `INCOME` con `400`** (resuelve la contradicción RF-MC-001 vs "Fuera de alcance: Ingreso en cuotas"). `amountCents` es el monto **por cuota** (entero `> 0`, RN-002), no el total. `totalInstallments` es la cantidad (entero `> 0`). `startMonth` es `YYYY-MM`.
- **`PATCH /installments/:id` — edita el grupo completo in-place (RF-MC-003).** Campos editables: monto por cuota, cantidad, mes de inicio, categoría, descripción. **El `type` no se edita.** **No hay split ni inmutabilidad del pasado** (a diferencia de los fijos): la edición aplica a todas las instancias del grupo. `404` si no existe o no es del usuario.
- **`DELETE /installments/:id` — borrado lógico del grupo entero.** Marca `deletedAt` en el grupo: dejan de aparecer **todas** las cuotas (pasadas y futuras), en un solo paso — `InstallmentGroup` no tiene `deletedFrom`, no hay boundary por mes. Reversible desde `/historial` (RF-HIST-003). **`200` con `{ historyEntryId }`** (excepción a la convención de DELETE; ver `docs/data-model.md`, §Historial de cambios → `historyEntryId`). `404` si no existe o no es del usuario. Si el grupo tiene calculados derivados (`sourceInstallmentGroupId`), se les aplica **cascada lógica** vía `RecurringService.cascadeSoftDeleteBySourceInstallmentGroup` (ver §Movimientos calculados, Eliminación).
- **`POST /installments/:id/skip` — toggle de anulación de una instancia mensual (RF-MC-004):** anula / des-anula la cuota de un mes puntual, body `{ month: "YYYY-MM" }`. Es un **toggle** sobre `InstallmentSkip(installmentGroupId, month)`: si ya existe lo borra (`data: { skipped: false, month }`); si no, lo crea (`data: { skipped: true, month }`). Anula **solo** esa instancia mensual, sin tocar el resto del grupo. `404` si el grupo no existe o no es del usuario; `400` si el `month` no cumple `YYYY-MM`. Una cuota anulada **se sigue listando** en `GET /movements` con `skipped: true` pero **no suma** a totales ni reportes.
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
- **`POST /categories`** — `name` obligatorio y no vacío; `scope` opcional (default `BOTH`); **`color` opcional**: debe pertenecer a la matriz de 40 (case-insensitive, se normaliza a mayúsculas). Si **no** llega `color`, el backend asigna el "menos usado" como red de seguridad (el front igualmente siempre lo envía). Dos casos de `409`:
  - **Colisión con una categoría activa** (RN-008): `error.message` = `"Ya existe una categoría activa..."`, **sin** `error.data`. Es un bloqueo duro de duplicado.
  - **Colisión con una categoría eliminada / reactivable** (RF-CAT-002, A3): `error.data = { reactivable: true, category: { id, name, scope, color } }`. El front usa ese `id` para ofrecer reactivar. Ver `ReactivableConflictException` abajo.
  - `400`: nombre vacío o faltante, `scope` inválido, o `color` fuera de la matriz.
- **`POST /categories/:id/reactivate`** — reactiva una categoría soft-deleted. Vuelve **exactamente como estaba** (mismo `id`, `name`, `scope`, `color`); lo que el usuario haya tipeado en el form de alta **se ignora**. `404` si no existe o no es del usuario; `409` si ya está activa.
- **`PATCH /categories/:id`** — `name`, `scope` y/o **`color`** (el color **es editable**; debe pertenecer a la matriz, case-insensitive, se almacena en mayúsculas — fuera de la matriz es `400`). `409` si el nuevo nombre colisiona con otra categoría activa (RN-014). `404` si no existe, no es del usuario, o está eliminada.
- **`DELETE /categories/:id`** — soft delete (marca `deletedAt`). **`204` sin cuerpo.** **No es idempotente**: borrar una categoría **ya eliminada** devuelve `404` (no `204`). También `404` si no existe o no es del usuario.

### Pool de colores (RF-CAT-005)

- **Única fuente:** `backend/src/categories/color-pool.ts`.
- **`COLOR_MATRIX` — set elegible (40 colores).** Matriz de 8 hues × 5 tonalidades (hues rojo, naranja, oro, verde, teal, azul, violeta, magenta; filas L1 clara → L5 oscura). Es el conjunto de colores que el usuario puede elegir al crear/editar una categoría.
- **`COLOR_POOL` — pool base de 8.** Es un **subconjunto explícito** de la matriz (uno por hue, fila vívida) en un **orden propio salteado por la rueda cromática** —**no** una fila posicional de `COLOR_MATRIX`—, por eso es un **array explícito** y no derivado por posición. Los 8 colores base:
  `#E23B3B`, `#1AA5B0`, `#E3B92E`, `#8B4FD4`, `#E8863A`, `#3B7DE0`, `#35A65A`, `#D94A9E`.
  Los primeros 4 son los de las categorías por defecto. `AuthService` y `CategoriesService` importan del mismo módulo; no hay colores hardcodeados sueltos.
- **Validación: `isValidCategoryColor()` / `normalizeColorHex()`.** El `color` recibido en `POST`/`PATCH` se **normaliza a mayúsculas** (`normalizeColorHex()`) y se **valida contra la matriz** (`isValidCategoryColor()`) en los DTOs vía el validador **`@IsColorInMatrix`**; un color fuera de la matriz es `400`. Solo colores de la matriz, sin hex libre.
- **`assignColor()` — default "menos usado", sobre el pool base (`COLOR_POOL`).** Cuando el `POST` no trae `color` (red de seguridad — el front siempre lo envía), se asigna el color de `COLOR_POOL` **menos usado** entre las categorías **activas** del usuario; en empate gana el **primero en orden de definición**. Las 4 categorías por defecto del alta toman los primeros 4 colores en orden. El cálculo del menos-usado se hace **sobre los 8 base**, no sobre los 40. El color no se reasigna al editar; el usuario lo cambia explícitamente.
- **Reasignación masiva de colores.** El script de mantenimiento `backend/scripts/reassign-category-colors.ts` (`pnpm reassign:category-colors`) reasigna el color de **cada** categoría (activas + soft-deleted) por usuario, recorriéndolas en orden estable (`createdAt`, `id`) y aplicando la misma lógica "menos usado" sobre `COLOR_POOL`. **Dry-run por defecto**; `--execute` aplica los cambios, previo **backup JSON** del estado anterior. Es limpieza de una sola vez.

### Normalización y unicidad (RN-014)

- La unicidad de nombre entre activas se valida a **nivel de aplicación, no en la DB** (no hay `@@unique`). La comparación usa `normalizeName()`: trim + lowercase + NFD + strip de diacríticos (`"comida" = "Comida" = "Cómida"`). El `name` se **almacena tal cual lo tipeó el usuario**; la normalización es solo para comparar.

### Manejo de errores — extensión del filter

- **`ReactivableConflictException`** (409): el único error que adjunta `error.data` estructurado. Para soportarlo, el Global Exception Filter se extendió de forma **mínima** con un campo `data` **opcional** en el sobre de error: solo lo lleva este caso; el resto de los errores no incluyen `data`. Shape de `error.data` en `docs/data-model.md`, §Payload reactivable en errores (409).

## Métodos de pago (PaymentMethodsModule)

CRUD completo, **scopeado por `userId` del JWT** (un usuario nunca ve ni toca métodos de otro). Todas las respuestas exitosas devuelven el shape de método de pago. Shape, campos condicionales y `movementCount` en `docs/data-model.md`, §Métodos de pago.

### Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `GET /payment-methods` | — | `200` · `data: PaymentMethod[]` | — |
| `POST /payment-methods` | `{ name, type, icon?, closingDay?, paymentDay? }` | `201` · `data: PaymentMethod` | `400` · `409` (dos casos, ver abajo) |
| `POST /payment-methods/:id/reactivate` | — (ignora el body) | `200` · `data: PaymentMethod` | `404` · `409` |
| `PATCH /payment-methods/:id` | `{ name?, type?, icon?, closingDay?, paymentDay? }` | `200` · `data: PaymentMethod` | `400` · `404` · `409` |
| `DELETE /payment-methods/:id` | — | `204 No Content` | `404` |

- **`GET /payment-methods`** — solo activos (`deletedAt` null), ordenados por **nombre ascendente**, cada uno con su `movementCount`.
- **`POST /payment-methods`** — `name` obligatorio y no vacío; `type` obligatorio (allowlist, sin default); `icon` opcional (fallback silencioso a `card`). Dos casos de `409`, análogos a categorías:
  - **Colisión con un método activo** (RN-021): `error.message`, **sin** `error.data`. Bloqueo duro de duplicado.
  - **Colisión con un método eliminado / reactivable** (RF-PM-001 A4): `error.data = { reactivable: true, paymentMethod: { id, name, type, icon } }`. Ver `ReactivableConflictException` en la sección Categorías.
  - `400`: nombre vacío o faltante, `type` fuera de la allowlist, o `closingDay`/`paymentDay` fuera de 1-31.
- **`POST /payment-methods/:id/reactivate`** — reactiva uno soft-deleted; vuelve **exactamente como estaba** (lo tipeado en el form se ignora). `404` si no existe o no es del usuario; `409` si ya está activo.
- **`PATCH /payment-methods/:id`** — todos los campos opcionales. **Al cambiar `type` se descartan los campos condicionales que no aplican** al nuevo tipo (p. ej. pasar a `DEBIT` o `CASH` limpia `closingDay`/`paymentDay`). `409` si el nuevo nombre colisiona con otro activo. `404` si no existe, no es del usuario, o está eliminado.
- **`DELETE /payment-methods/:id`** — soft delete (`deletedAt`). **`204` sin cuerpo. No es idempotente**: borrar uno **ya eliminado** devuelve `404`.

### Campos condicionales por tipo

`closingDay`/`paymentDay` solo aplican a `CREDIT`; `DEBIT` y `CASH` no tienen campos condicionales. Los que no corresponden al `type` se descartan al crear/editar y se persisten `null`. Los días son **1-31 e informativos**: el clamp al último día del mes es responsabilidad del **consumo/display**, no mueve imputación (RN-021). El **débito automático** no es campo del método: es un flag **del movimiento** (ver §Método y débito automático en movimientos).

### Allowlists en código (`payment-method-constants.ts`)

`type` (`CREDIT`/`DEBIT`/`CASH`) e `icon` (set curado de **12 claves**, default/fallback **`card`**) **no son enums de Prisma**: son strings validados contra una allowlist en `backend/src/payment-methods/payment-method-constants.ts` (mismo criterio que `CurrencyQuote.variant`, extensible sin migración).

- **Diferencia con el color de categorías:** un `icon` fuera del set **no rechaza con `400`** — cae **silenciosamente a `card`** (`normalizePaymentMethodIcon`). Un `type` fuera de la allowlist **sí** es `400`.
- La allowlist de íconos se **duplica back/front** y debe mantenerse en sync — mismo patrón que el pool de colores; ver `docs/frontend.md`, §Métodos de pago (íconos).

### Método y débito automático en movimientos + herencia del calculado

`GET /movements` embebe `paymentMethod: { id, name, icon, type, closingDay, paymentDay } | null` en cada ítem (`null` si no tiene) y expone `autoDebit: boolean | null` **a nivel del ítem** (fuera del objeto `paymentMethod`). `closingDay`/`paymentDay` (día del mes 1-31) se pueblan **solo para `type === "CREDIT"`** (null en `DEBIT`/`CASH`) y alimentan la sublínea del crédito de la card de detalle (RF-VM-007). El **calculado hereda método y `autoDebit` de su origen**: se **derivan al vuelo, nunca persiste unos propios** (mismo tratamiento que `currency`/`exchangeRate`). Contrato del ítem en `docs/data-model.md`, §Contrato de movimientos del mes.

**`autoDebit` es campo del movimiento, no del método** (RN-021). Es columna `autoDebit Boolean?` en `Transaction`, `Recurring` e `InstallmentGroup`. Los bodies `POST`/`PATCH` de transactions / recurring / installments aceptan `autoDebit?: boolean` (el **calculado no**, lo hereda). **Regla de persistencia** — validador `resolveAutoDebit`: solo se guarda `true`/`false` si el **método efectivo del movimiento es de tipo `DEBIT`**; sin método o con método `CREDIT`/`CASH` se fuerza a `null` aunque el body pida `true`.

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

## Simulación de categoría (SimulationsModule)

Crea, lista y elimina simulaciones (RF-SIM-001..004) y **deriva los movimientos simulados** que `GET /movements` embebe en la sección Únicos. Contrato de API y modelo en `docs/data-model.md`, §Simulación de categoría; reglas de cálculo en `requirements.md`, RN-028/029.

### Dependencia unidireccional `Movements → Simulations`

`MovementsService` inyecta `SimulationsService` y le pide `getSimulatedItemsForMonth(userId, month, today)`; **nunca al revés**. `SimulationsService` no depende de `MovementsService` ni de `MovementsModule`, y el sentido de la flecha **no se puede invertir ni volver bidireccional**: sería un ciclo de módulos de Nest.

**Consecuencia:** la serie de ajuste de la regresión necesita agregaciones de `Transaction` por mes y categoría, y `SimulationsService` las lee **directo por su propio repositorio** en vez de pedírselas a `TransactionsService`. Es el mismo precedente que `MovementsRepository`, que ya bypasea `TransactionsService` por el mismo motivo (§Movimientos del mes → "Por qué un módulo propio").

### Los reportes nunca consultan simulaciones

Ningún endpoint de `/movements/reports*` toca `SimulationsService`: los reportes analizan lo **real** (RN-029). La única superficie que ve movimientos simulados es `GET /movements`.

### Infraestructura de proyección compartida (`src/common/projection.helper.ts`)

Las dos proyecciones a futuro del backend viven en el **mismo módulo**, como **funciones puras exportadas** (no una clase `@Injectable`): así se importan desde `MovementsService` y desde `SimulationsService` sin tocar la lista de providers de los specs unitarios existentes.

| Función | Consumidor | Método |
|---|---|---|
| `computeFixedBasketProjection` | RF-REP-015 (proyección de fijos en la serie de reportes) | esqueleto determinista × tasa de encarecimiento por cadena |
| `fitCategoryRegression` + `evaluateRegressionAt` | RF-SIM-002 (simulación de categoría) | regresión lineal por mínimos cuadrados |

**Lo que comparten es la infraestructura, no la matemática:** cada fórmula es propia y ninguna reusa la de la otra. Un cálculo nuevo se suma acá; no se lo mete adentro de la fórmula ajena.

- **Gotcha — `fitCategoryRegression` NO saltea puntos.** Los 12 valores de la ventana entran siempre, incluidos los ceros (RN-028: la ausencia es dato). Es lo contrario de `computeLinearTrend` (reporte de Inflación vs Ingresos), que ignora los `null`. Quién decide si hay datos suficientes es el **caller** (mínimo de 3 meses **con únicos**); la función solo ajusta la recta.

### Derivación del movimiento simulado

- **`getSimulatedItemsForMonth` corta temprano y devuelve `[]`** si el mes pedido no es futuro respecto del mes en curso, si cae fuera del horizonte, si el usuario no tiene simulaciones o si la simulación está **pausada** (`monthsWithData < 3`). El consumidor no evalúa ninguna de esas condiciones.
- **Ventana, horizonte y posición del eje viven en `simulation-window.helper.ts`** (`resolveTodayMonthKey` / `buildWindowMonths` / `computeHorizonEndMonth` / `axisPositionFor`), no dispersos en el service — reusarlos, no reimplementar la aritmética de RN-028.
- **Serie de ajuste convertida por el mes de cada único** (no por el TC de hoy): mismo criterio que `getAnnualUnicosAggregated`. El signo lo pone el `type` del único (ingreso `+`, gasto `−`) al agregarse por mes.
- **`400` no revelador al crear.** La validación de categoría reusa `CategoryValidatorService` con `skipScopeCheck`: una simulación **no tiene `type` fijo** (su dirección la decide el cálculo mes a mes), así que cualquier `scope` de categoría es válido.
- **El `409` está en dos capas.** El chequeo previo cubre el caso normal; el catch del `P2002` del índice único solo blinda una carrera concurrente.

## Historial de cambios (HistoryModule)

Registra ediciones y eliminaciones de movimientos y permite deshacerlas (RF-HIST-001..006). Contrato de API y modelo en `docs/data-model.md`, §Historial de cambios; shape del snapshot por `targetKind × action` en `src/history/history.types.ts`.

### Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `GET /history` | — | `200` · `data: HistoryEntryDto[]` | — |
| `POST /history/:id/undo` | — | `200` · `data: { undone: true }` | `404` |

### Captura

La captura vive en los **services de dominio** (`transactions`, `recurring`, `installments`), no en el módulo de historial: cada uno arma el snapshot del estado previo **antes** de mutar y llama a `HistoryService.record(...)`. La entrada se graba después de que la mutación terminó bien.

- **La cascada no genera entradas propias (RN-024).** Eliminar un origen con calculados derivados produce **una** entrada; los calculados que caen viajan **dentro** de ese mismo snapshot. Deshacerla los restaura junto con el origen.
- **`targetId` agrupa por movimiento lógico, no por fila** (ver `docs/data-model.md`): en fijos y calculados es el `chainId`, así que el split de edición no parte la pila LIFO.

### Retención y purga

Una entrada se conserva hasta que ocurre **lo primero** de estas dos (RF-HIST-005): que el movimiento acumule más de **5 entradas** (se descarta la más vieja al grabar la sexta) o que la entrada cumpla **31 días**.

- **Reaper.** Al purgarse una entrada de **eliminación**, el movimiento que estaba con borrado lógico se **borra físicamente**: la eliminación deja de ser reversible y el registro desaparece de la DB. Purgar una entrada de edición solo borra la entrada.
- **La purga es lazy, no agendada.** `@nestjs/schedule` no es dependencia del proyecto, así que no hay cron: la purga corre **al leer el historial y al deshacer**. **Consecuencia:** un usuario que nunca abre `/historial` no purga sus entradas vencidas hasta su próxima visita — sus movimientos eliminados siguen ocupando espacio (invisibles para el resto de la app) más allá de los 31 días.

### Deshacer

- **LIFO por movimiento.** Solo se puede deshacer la entrada más reciente de un `targetId`; deshacer una anterior implica deshacer primero todas sus posteriores. Un mismo endpoint resuelve los dos casos: dado el `id`, arma la cadena de entradas a deshacer y la recorre **de la más reciente a la más antigua**.
- **Atómico.** Toda la cadena —restaurar el estado y borrar cada entrada— corre dentro de **una sola `prisma.$transaction`**. Si algo falla, no queda nada restaurado a medias.
- **No deja rastro** (RF-HIST-003): deshacer borra las entradas involucradas y no crea ninguna.

### Excepción arquitectónica — el undo y el reaper mutan por Prisma directo

`HistoryService.undo()` y el reaper escriben en `Transaction`, `Recurring` e `InstallmentGroup` **directamente por Prisma**, sin pasar por los services de esos módulos. Rompe deliberadamente la regla general de §Propiedad de dominio ("un módulo le habla a otro solo a través de su Service"). Dos razones:

1. **El undo en cadena necesita una única transacción de DB.** Threadear un cliente transaccional (`Prisma.TransactionClient`) a través de `TransactionsService`, `RecurringService` e `InstallmentsService` —y de sus repositorios— sería una modificación invasiva de tres módulos para un solo consumidor.
2. **Evita una dependencia circular de módulos:** los tres services de movimiento ya dependen de `HistoryService` para capturar.

**La captura NO es excepción:** vive donde corresponde, en los services de dominio. La excepción se limita a la restauración y al borrado físico, y no debe extenderse a operaciones nuevas sin discutirlo.

### Qué campos emite cada entrada

El backend decide qué filas del bloque "Qué cambió" emite; **el frontend no filtra ni decide omisiones** —pinta lo que recibe—. Además del set aplicable por tipo de objetivo (ver `history.service.ts`), dos campos tienen reglas propias:

- **`exchangeRate` (`Cotización`) se emite solo si es informativa:** cuando hay **conversión real** (la moneda del movimiento difiere de su `anchorCurrency`) o cuando la **moneda cambió** en esa edición. Un movimiento en la misma moneda que su ancla tiene cotización `1` por definición: mostrarla es ruido.
- **`currency` (`Moneda`) en una entrada de eliminación se omite** cuando la moneda del movimiento coincide **a la vez** con su `anchorCurrency` y con la **moneda default vigente** del usuario — es decir, cuando no aporta nada frente a lo que el usuario ya ve por defecto. Si el usuario cambió su default desde que se cargó el movimiento, la moneda **sí** se emite.

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
