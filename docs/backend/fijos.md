# Backend — Movimientos fijos (RecurringModule)

Gestión de fijos, **scopeada por `userId` del JWT**. El módulo expone **crear, editar, eliminar, anular y reabrir**; el listado del mes lo arma `MovementsModule` (`docs/backend/movimientos-mes.md`). **No existe `GET /recurring/:id`**: el front prefilea la edición desde el `MovementItem` de `/movements`. Los calculados viven en el mismo módulo: `docs/backend/calculados.md`.

## Endpoints

| Endpoint | Entrada | Éxito | Errores |
|----------|---------|-------|---------|
| `POST /recurring` | `{ type, amountCents, categoryId, startMonth, frequency?, description? }` | `201` · `data: Recurring` | `400` |
| `PATCH /recurring/:id` | `{ amountCents?, categoryId?, description?, currentMonth }` | `200` · `data: Recurring & { historyEntryId }` | `400` · `404` |
| `POST /recurring/:id/skip` | `{ month }` (`YYYY-MM`) | `200` · `data: { skipped, month }` | `400` · `404` |
| `POST /recurring/:id/skip` | `{ from, to, action }` | `200` · `data: { action, from, to, affectedCount }` | `400` · `404` |
| `POST /recurring/:id/calculated` | calculado desde el fijo `:id` | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /recurring/:id/calculated` | edita el calculado `:id` | `200` · `data: Recurring` | `400` · `404` |
| `DELETE /recurring/:id` | query: `currentMonth`, `fromCurrentMonth` | `200` · `data: { historyEntryId }` | `404` |
| `GET /recurring/:id/reopen-preview` | query: `currentMonth` | `200` · `data: ReopenPreview` | `400` · `404` |
| `POST /recurring/:id/reopen` | `{ currentMonth, reopenMonth, amountCents, categoryId?, paymentMethodId?, calculatedCategories? }` | `200` · `data: ReopenResult` | `400` · `404` |

- **`type`, `startMonth` y `frequency` no son editables** por PATCH: solo `amountCents`, `categoryId` y `description` (RF-MF-003). El `startMonth` del POST es el mes actual que envía el front.
- **`frequency`:** **entero 1..12** (meses entre apariciones), opcional en el `POST`, default **`1`**. `400` si no es entero o cae fuera de 1..12 (validado en el DTO; no hay CHECK en la DB). **Inmutable**; en el split la fila nueva la **hereda**. La respuesta del `POST` la incluye.
- **Validación de categoría:** idéntica a únicos (`docs/backend/unicos.md` §Validación de categoría), vía `CategoryValidatorService`.
- **Reapertura (RF-MF-008):** contrato en `docs/data-model/reapertura.md` §Contrato de reapertura de fijos; mecánica abajo.
- Método de pago y `autoDebit`: `docs/backend/metodos-pago.md` §Método y débito automático en movimientos.

## Anulación de apariciones — `POST /recurring/:id/skip` (RF-MF-005)

**Dos shapes de body mutuamente excluyentes, discriminados por qué campos llegan — no hay campo `scope`.** El DTO valida solo formato (`YYYY-MM`, `action` en el set); **exclusividad y completitud del combo se validan en el controller** (`class-validator` no expresa un XOR entre shapes) y los límites del rango, en el service.

| Body | Semántica | `data` |
|---|---|---|
| `{ month: "YYYY-MM" }` | **Toggle** puntual: si existe el skip `(fila, mes)` lo borra, si no lo crea. | `{ skipped: boolean, month }` |
| `{ from, to, action: "skip" \| "unskip" }` | Operación **explícita** (el sentido lo declara el cliente) e **idempotente en los dos sentidos** sobre `[from, to]` inclusive. | `{ action, from, to, affectedCount }` |

- **Responde `200`, no `201`:** no crea un recurso direccionable. Mismo criterio que `POST /transactions/:id/skip` y `POST /installments/:id/skip`.
- **`affectedCount` = apariciones reales** del fijo (según frecuencia) en `[from, to]`, **independiente de cuántas filas se escribieron o borraron**.
- **El rango opera sobre la cadena (`chainId`), no sobre la fila `:id`.** Resuelve mes por mes qué fila cubre cada mes, así un rango que cruza un split alcanza las filas anteriores. El `unskip` **borra por `chainId` + rango** (todos los `RecurringSkip` de la cadena con `month` en `[from, to]`), no por la lista de apariciones: limpia también anulaciones en filas superadas por un split posterior.
- **Todo el rango en una transacción.**
- **Límites del rango validados en el servidor:** `from <= to`, piso = arranque de la cadena, techo = último mes de aparición cuando la última fila tiene `deletedFrom`, largo máximo 24 meses inclusive (RF-MF-005 → Reglas del rango).
- **Errores:** `400` si el body mezcla `month` con campos de rango, si falta alguno de `from` / `to` / `action`, si el mes es inválido o si el rango viola sus límites. `404` si el fijo no existe o no es del usuario.
- **El alcance puntual no valida aparición** (solo formato y ownership; la validación semántica es del frontend, que ya tiene el ítem). El de rango **sí** filtra por aparición, con el criterio de §Cálculo de aparición, **anclaje post-split incluido**.
- Un mes anulado **se sigue listando** en `GET /movements` con `skipped: true` pero **no suma** a totales ni a la serie anual.

## Inmutabilidad del pasado vía "split al editar"

Un **fijo lógico** es una **cadena de filas `Recurring`** con el mismo `chainId` (ver `docs/backend/calculados.md` §`chainId`). El PATCH recibe `currentMonth` (mes actual real, calculado por el front) y decide según el `startMonth` de la fila editada (`R`):

- **`currentMonth > R.startMonth`** → **split**: se cierra la fila vieja (`deletedFrom = currentMonth`) y se **crea R2** (`startMonth = currentMonth`) con los valores nuevos. La respuesta trae **R2, con otro `id`**. R2 **hereda `chainId`, `type`, `categoryId`, `description`, `frequency` y `deletedFrom`** de la original: heredar `deletedFrom` preserva una terminación futura ya programada (si no, el gasto reaparecería después del mes en que se eliminó).
- **`currentMonth <= R.startMonth`** (la fila no tiene pasado) → se **edita en su lugar**.

Materializa "el pasado es inmutable" (RF-MF-003) sin generar filas por instancia mensual.

## Cálculo de aparición de fijos por mes — frecuencia y skips

La lógica "¿este fijo aparece en este mes?" está **centralizada en `isOnFrequency`, exportado desde `movements.repository.ts`**, y la reusan `findFijosByMonth`, la proyección anual, los reportes y los tests:

- **`isOnFrequency(startMonth, frequency, month)`** → `monthDiff(startMonth, month) % frequency === 0` (RN-016). La frecuencia está **anclada al `startMonth`**.
- **Anclaje tras un split — el `startMonth` es el de la fila que cubre el mes, no el arranque de la cadena.** Con `frequency > 1` eso puede correr las apariciones respecto del arranque original (RF-MF-007). Es deliberado y es el criterio **único**: listado del mes, reportes y anulación por rango lo evalúan igual, así el conjunto de meses coincide con lo que muestra `GET /movements`.

Un fijo aparece en `month` si: `startMonth <= month` **y** (`deletedFrom IS NULL OR deletedFrom > month`) **y** `isOnFrequency(startMonth, frequency, month)`. El rango de actividad se filtra en Prisma por comparación léxica de `YYYY-MM`; la frecuencia se aplica en JS sobre los candidatos. **Todo cambio al cálculo de fijos por mes pasa por estos helpers, no se re-duplica.**

**Skips (RF-MF-005):**
- En `findFijosByMonth`, cada fijo incluye sus skips del mes (`include: { skips: { where: { month } } }`); `skipped = skips.length > 0`. El fijo anulado **se incluye en la lista**; **excluirlo de los totales es responsabilidad del caller** (`MovementsService`).
- En la **proyección anual**, los skips se cargan como **`Map<recurringId, Set<month>>` en una sola query** (`recurringSkip.findMany` por `recurring.userId`, en paralelo con los fijos), para evitar el N+1 de un `include` anidado. Cada mes se descarta si `skippedMonths.has(mes)`, además de aplicar `isOnFrequency`.

## Eliminación (DELETE con `currentMonth` y `fromCurrentMonth`)

- **`boundary = fromCurrentMonth ? currentMonth : nextMonth(currentMonth)`** — el mes desde el cual deja de aparecer. `false` (default) → desde el mes **siguiente**; `true` → desde el mes **actual inclusive** (RF-MF-004).
- **El boundary se aplica fila por fila con `applyBoundaryToChain(chainId, boundary)`** (privado de `RecurringService`, compartido con la cascada a calculados). Por cada fila:
  - **`boundary <= startMonth`** (no aparecería en ningún mes) → **borrado lógico** (`deletedAt`, RF-HIST-006), **no** físico: el snapshot del historial necesita la fila para restaurarla.
  - **`deletedFrom` nulo o mayor que el boundary** → `deletedFrom = boundary`.
  - **`deletedFrom <= boundary`** (ya terminó antes) → no se toca. El pasado nunca se toca.
- Cascada a calculados vinculados: `docs/backend/calculados.md` §Eliminación.

## Reapertura de un fijo terminado (RF-MF-008)

`RecurringService.reopen` / `getReopenPreview`; escritura en `RecurringRepository.applyReopen`. Notación: **V** = fila vigente de la cadena (mayor `startMonth` entre las vivas), **E** = `V.deletedFrom` (fin), **X** = `reopenMonth`.

- **Espejos** = calculados de **fijo** con `sourceChainId` = `chainId` del origen cuya fila vigente tiene `deletedFrom == E`. Los de otro fin no se tocan.
- **Por cadena** (origen y cada espejo), todo en **una** `prisma.$transaction`:
  1. **V pasa a `deletedFrom = X`.** Sigue cubriendo el relleno `[E, X)` con su monto, categoría y método viejos.
  2. **Se crea la fila N:** misma `chainId`, `startMonth = X`, `deletedFrom = null`, monto nuevo; el resto se hereda de V salvo los reemplazos de categoría/método. `autoDebit` vía `PaymentMethodValidatorService.resolveAutoDebit(métodoEfectivo, V.autoDebit)`. En los espejos N conserva la fórmula, el `sourceChainId` y los placeholders.
  3. **Anulaciones de relleno:** cada mes de `[E, X)` con `isOnFrequency(V.startMonth, V.frequency, m)` recibe un `RecurringSkip` sobre V (origen) y sobre la V de cada espejo, en los mismos meses. Los skips preexistentes no se recrean (`skipDuplicates`) ni entran al snapshot.
- **La cadencia se re-ancla sola en X:** el ancla es el `startMonth` de la fila que cubre el mes (§Cálculo de aparición), así que N ancla en X sin tocar `isOnFrequency` ni `findFijosByMonth`. Mismo mecanismo que el split.
- **`X == E`:** sin relleno ni skips; V conserva su fin y N arranca en E.
- **Historial:** una sola entrada `REOPEN` (`targetId` = `chainId` del origen), grabada después de la transacción. Snapshot `FijoReopenSnapshot` (`src/history/history.types.ts`): `{ kind: 'reopen', reopenMonth, row, newRowId, skips, next, mirrors[] }` — `row` = V antes de mutar, `skips` = los creados, `next` = monto/categoría/método/`autoDebit` efectivos de N, `mirrors[]` = `{ row, newRowId, skips }` por espejo.
- **Deshacer** (LIFO, `HistoryService.undoFijo`): por el origen y cada espejo, borra los skips creados (los ya des-anulados no están: no falla), borra N y restaura `V.deletedFrom = E`. Sin bloqueo adicional por des-anulaciones posteriores en el relleno.

## Gotchas

- **`fromCurrentMonth` llega como string** (`"true"` / `"false"`) en query; NestJS **no lo castea a boolean**. Parsearlo explícitamente.
