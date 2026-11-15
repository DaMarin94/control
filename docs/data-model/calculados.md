# Contrato de movimientos calculados

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Reglas funcionales: submódulo 3.4.b (`docs/requirements/calculados.md`, RF-MCALC-001..011) y RN-017/018/019. Decisiones de modelado (fijo + vínculo + fórmula, identidad de cadena): `entidades.md`. Shape en `GET /movements` (`CalculatedInfo`, `CalculatedChild`): `movimientos.md`.

Endpoints propios del calculado, en el `RecurringModule` (el calculado **es** un fijo). El **origen** puede ser fijo, único o cuota: cada tipo de origen tiene su par `POST`/`PATCH` propio, según desde dónde se dispara la acción. **JWT requerido**; scope por `userId` del token. Mecánica de implementación (cadena, derivación, cascada) en `docs/backend/calculados.md`.

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `POST /recurring/:id/calculated` | `{ categoryId, startMonth, formulaOperator, formulaOperand, formulaSign, description?, sourceMonthOffset? }` | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /recurring/:id/calculated` | `{ currentMonth, categoryId?, description?, formulaOperator?, formulaOperand?, formulaSign?, sourceMonthOffset? }` | `200` · `data: Recurring & { historyEntryId }` | `400` · `404` |
| `POST /transactions/:id/calculated` | `{ categoryId, formulaOperator, formulaOperand, formulaSign, description? }` (sin `startMonth`) | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /transactions/:id/calculated` | `{ currentMonth, categoryId?, description?, formulaOperator?, formulaOperand?, formulaSign? }` | `200` · `data: Recurring & { historyEntryId }` | `400` · `404` |
| `POST /installments/:id/calculated` | `{ categoryId, formulaOperator, formulaOperand, formulaSign, description? }` (sin `startMonth`) | `201` · `data: Recurring` | `400` · `404` |
| `PATCH /installments/:id/calculated` | `{ currentMonth, categoryId?, description?, formulaOperator?, formulaOperand?, formulaSign? }` | `200` · `data: Recurring & { historyEntryId }` | `400` · `404` |

- **`:id` del POST** identifica el **origen** según la ruta: fijo (`/recurring/:id`, id de la fila activa del fijo), único (`/transactions/:id`) o grupo de cuotas (`/installments/:id`). El calculado se crea como una cadena `Recurring` nueva vinculada al origen.
- **`startMonth` solo en el POST de fijo.** Para **único** y **cuota** el backend lo **deriva del origen**: único → `startMonth = mes del Transaction`; cuota → `startMonth = grupo.startMonth`. El body de único/cuota **no** lleva `startMonth`.
- **El body NO acepta `type`** (en ninguno): el tipo se **deriva del signo** del monto al vuelo (RF-MCALC-003); si el front lo envía, la whitelist de class-validator lo descarta.
- **`formulaOperator`** ∈ `{ ADD, SUB, MUL, DIV, PCT }`. **`formulaSign`** ∈ `{ 1, -1 }`. **`formulaOperand`** es un **entero escalado** (ver §Escalado del operando).
- **`sourceMonthOffset` — solo en el par de fijo.** Entero **0..12**, opcional, **default `0`** (mismo mes): desplaza hacia atrás el **mes de referencia** del que sale la base de la fórmula (RF-MCALC-011). Un valor no entero o fuera de `0..12` → **`400`**. Los pares de **`/transactions/:id/calculated`** y **`/installments/:id/calculated`** **no** lo aceptan; si el front lo envía, la whitelist de class-validator lo descarta.
- **Sin `currency` / `exchangeRate`.** Los `POST`/`PATCH .../calculated` **no** aceptan `currency` ni `exchangeRate`: el calculado **hereda** ambos del origen al vuelo (RF-CUR-004). Si el front los envía, la whitelist de class-validator los descarta. En cambio, los `create`/`edit` de **únicos, fijos y cuotas** sí los aceptan (`currency?: "ARS"|"USD"|"EUR"|"BRL"`, default `ARS`; `exchangeRate?: number > 0`, default `1`) — ver `entidades.md`, "Moneda explícita, set curado".
- **`POST` — errores (los tres):** `400` si el origen es **a su vez un calculado** (sin encadenamiento — solo aplica al de fijo), si `formulaOperand = 0` con `DIV`/`PCT` (RN-017), o si la categoría es inválida (inexistente/ajena/eliminada). `404` si el origen no existe o no es del usuario. La categoría se valida con scope `BOTH` (`skipScopeCheck`) porque el tipo del calculado es derivado.
- **`PATCH` — split y errores:** `currentMonth` (`YYYY-MM`) **requerido** en los tres; usa la **misma mecánica de split del pasado** que `PATCH /recurring/:id`. Editables: `categoryId`, `description`, `formulaOperator`, `formulaOperand`, `formulaSign` y —solo en el de fijo— `sourceMonthOffset`. **No** editable el vínculo al origen. `400` si el `:id` **no es un calculado** del tipo esperado, `formulaOperand = 0` con `DIV`/`PCT`, o `sourceMonthOffset` fuera de `0..12`. `404` si no existe o no es del usuario.
- **`PATCH /recurring/:id` (fijo normal) rechaza con `400` si el `:id` es un calculado** (y los `PATCH .../calculated` exigen que lo sea): cada tipo se edita por su endpoint.
- **Acotamiento de cadencia.** Calculado de **único:** el backend fija `deletedFrom = nextMonth` para acotar la cadena a **un solo mes** (el del único). Calculado de **cuota:** `deletedFrom = null`; el rango lo determina **on-the-fly** el `totalInstallments` del grupo (`startMonth ≤ mes < startMonth + totalInstallments`).
- **`DELETE /recurring/:id` — tres caminos.** El endpoint es **uniforme** (los query `currentMonth` y `fromCurrentMonth` son requeridos por contrato), pero el comportamiento depende del calculado:
  - **(a) Calculado de único o cuota** → **hard-delete total** del calculado (ignora `currentMonth`/`fromCurrentMonth`): no hay split, espejando que su origen tampoco se borra por mes (RF-MCALC-009).
  - **(b) Calculado de fijo** → `boundary` sobre su cadena (split del pasado), sin tocar el origen ni otros calculados (RF-MCALC-006).
  - **(c) Fijo normal** → `boundary` sobre su cadena y **cascada** del mismo `boundary` a sus calculados de fijo. La cascada origen→calculado de **único/cuota** la resuelve la **DB por FK `onDelete: Cascade`** (no pasa por este endpoint: el origen se borra desde `/transactions` o `/installments`).

### Escalado del operando (entero, sin floats)

El `formulaOperand` se persiste y viaja como **entero escalado**, distinto por operador, para no propagar floats (RN-002/RN-017). El front escala al enviar y desescala al editar; el backend aplica la fórmula con la escala correspondiente. Constantes en `backend/src/recurring/formula.helper.ts`.

| Operador | Significado del operando | Escala | Ejemplo |
|---|---|---|---|
| `ADD` / `SUB` | monto en **centavos** | `× 100` (igual que `amountCents`) | `$500` → `50000` |
| `MUL` / `DIV` | **factor** crudo | `× FACTOR_SCALE` (`1_000_000`) | `1.5` → `1_500_000` |
| `PCT` | **porcentaje** | `× PCT_SCALE` (`100`) | `10%` → `1000`; `1.5%` → `150` |

El **resultado** de la fórmula se redondea a centavos enteros y se multiplica por `formulaSign` (RN-017/018).

### Campos de `Recurring` para calculados (shape de respuesta)

El `Recurring` que devuelven los endpoints (y que el front recibe) incluye, además de los campos del fijo normal, los de cadena y calculado (`backend/prisma/schema.prisma`):

- **`chainId`** — identidad estable de la cadena del fijo lógico; la comparten todas las filas del fijo a través de los splits (ver `entidades.md`, "Identidad de cadena estable del fijo"). Presente en **todo** `Recurring`.
- **`sourceChainId`** — `null` en fijos normales y en calculados de único/cuota; el **`chainId` del origen** en calculados de **fijo** (vínculo a la cadena, no a una fila).
- **`sourceMovementId`** — FK nullable a `Transaction`, `onDelete: Cascade`. No-null **solo** en calculados de **único** (vínculo al único de origen).
- **`sourceInstallmentGroupId`** — FK nullable a `InstallmentGroup`, `onDelete: Cascade`. No-null **solo** en calculados de **cuota** (vínculo al grupo de origen).
- **Invariante de origen:** en un **calculado**, exactamente **uno** de `{ sourceChainId, sourceMovementId, sourceInstallmentGroupId }` es no-null (el resto null). Los **tres null** = fijo normal. La exclusión mutua la valida el service. Borrar el `Transaction` / `InstallmentGroup` de origen **cascadea** (FK `onDelete: Cascade`) y borra entero el calculado.
- **`formulaOperator` / `formulaOperand` / `formulaSign`** — `null` en fijos normales; la fórmula (con operando escalado) en calculados.
- **`sourceMonthOffset`** — `Int @default(0)`, **no nullable** (presente en toda fila `Recurring`, incluidos fijos normales y calculados de único/cuota, donde vale `0`). Rango **0..12**: meses que se retrocede desde el mes de aparición para ubicar el **mes de referencia** del que sale la base de la fórmula (RF-MCALC-011). Solo tiene efecto en calculados de **fijo**.

### Columnas placeholder de un calculado (trampa del modelo)

En una fila `Recurring` que es un **calculado**, estas columnas **no tienen valor de negocio**: se persisten con un relleno fijo y leerlas como si fueran el dato real produce un bug silencioso (moneda o monto equivocados, sin error visible).

| Columna | Qué se persiste (placeholder) | De dónde sale el dato real |
|---|---|---|
| `amountCents` | `0` | resultado de la fórmula aplicada al **monto del origen**, derivado al vuelo |
| `type` | `EXPENSE` | signo del resultado de la fórmula (RN-018) |
| `currency` | la `defaultCurrency` del usuario | la **moneda del origen** |
| `exchangeRate` | `1` | la **cotización del origen** |
| `anchorCurrency` | la `defaultCurrency` del usuario | el **`anchorCurrency` del origen** |

**Regla:** todo consumidor que necesite monto, tipo, moneda o cotización de un calculado resuelve primero su **origen** por `sourceChainId` / `sourceMovementId` / `sourceInstallmentGroupId` (invariante arriba) y lee esos campos de ahí. La derivación al vuelo la hacen `GET /movements` (ver `movimientos.md`, `MovementItem.amountCents` / `type`) y `GET /history` (ver `formula.currency` en `historial.md`); mecánica en `docs/backend/calculados.md`.
