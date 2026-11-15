# Backend — Movimientos calculados (RecurringModule)

Un **calculado es un fijo** cuyo `amountCents` y `type` **no se ingresan ni se persisten**: se **derivan al vuelo** en lectura del monto de su origen vía fórmula. Vive en `RecurringModule`. El origen puede ser **fijo, único o cuota** (RF-MCALC-008). Endpoints y shape en `docs/data-model/calculados.md` §Contrato de movimientos calculados (rutas: `POST|PATCH /recurring/:id/calculated`, `/transactions/:id/calculated`, `/installments/:id/calculated`); reglas en RF-MCALC-001..010 / RN-017/018/019.

## Origen y enganche por FK

- El `Recurring` calculado engancha al origen por **una sola** de tres FK: **fijo** → `sourceChainId` (`chainId` del fijo); **único** → `sourceMovementId` (FK a `Transaction`, `onDelete: Cascade`); **cuota** → `sourceInstallmentGroupId` (FK a `InstallmentGroup`, `onDelete: Cascade`). **Exactamente una no-null** en un calculado; las tres null = fijo normal. Exclusión mutua **validada en el service**.
- `startMonth` del calculado: el backend lo deriva del origen para único (mes del `Transaction`) y cuota (`grupo.startMonth`); para fijo viene en el body. **Único:** la cadena se acota a **un mes** con `deletedFrom = nextMonth`. **Cuota:** `deletedFrom = null`; el rango lo da on-the-fly `totalInstallments`.

## `chainId` — identidad de cadena estable

- Todo `Recurring` tiene **`chainId`** (`@default(cuid())`). Un "fijo lógico" es una **cadena de filas** con el mismo `chainId`; en el **split** de edición **R2 hereda el `chainId` de R1** — el `id` de fila cambia, el `chainId` no (`docs/backend/fijos.md` §Inmutabilidad del pasado).
- El calculado **vincula al origen por `sourceChainId` = `chainId` del origen** (NO un `Recurring.id`), así el vínculo **sobrevive a los splits** (RF-MCALC-004). El calculado tiene además su **propia** `chainId`.
- **Script de mantenimiento `backend/scripts/restitch-recurring-chains.ts`** (`pnpm restitch:recurring-chains`): re-une en una sola cadena grupos con múltiples `chainId` de un mismo fijo (identidad = descripción) cuyos tramos no se solapan; solo re-apunta `chainId` / `sourceChainId`, sin tocar montos ni fechas. El split de edición hereda el `chainId` y no fragmenta.

## Derivación on-the-fly (no persistida)

Análogo a RN-006. Cada calculado se inyecta en la lista de **su tipo de origen**:

- **Calculado de fijo** → `findFijosByMonth` (y `getFijosTotalsByMonth`). **De único** → `findUnicosByMonth`. **De cuota** → la proyección de cuotas del mes. Cada uno busca los calculados por su FK y los emite con `origin` = tipo del origen.
- La fila persiste **placeholders** (`amountCents = 0`, `type = EXPENSE`) que **NUNCA** se usan para mostrar.
- `amountCents = applyFormula(montoOrigen, operator, operand, sign)`; `type` se **deriva del signo**: `> 0 → INCOME`, `≤ 0 → EXPENSE`. Para **cuota**, `montoOrigen` = **monto por cuota**; para **único**, el monto del `Transaction`.
- **Presencia gobernada SOLO por el origen.** Un calculado aparece en el mes **sii el origen aparece**: fijo → fila del origen activa en el mes, heredando frecuencia, actividad y **skip** del origen (no aplicar `isOnFrequency` con el `startMonth` **propio** del calculado: desalinea con step > 1); único → solo el mes del único; cuota → cada mes de `startMonth ≤ mes < startMonth + totalInstallments`.
- **Orden de cada lista por `Math.abs(amountCents)` DESC**, porque un calculado puede ser negativo.
- Método de pago, `autoDebit`, `currency` y `exchangeRate` se heredan del origen al vuelo (`docs/backend/metodos-pago.md`).

## Detección de derivados en el origen (`hasCalculated` + `calculatedChildren`)

El `MovementItem` de un **origen** expone `hasCalculated` y `calculatedChildren` (shape `CalculatedChild` en `docs/data-model/movimientos.md` §Contrato de movimientos del mes), para los **tres orígenes**, con alcance **estrictamente el mes consultado**:

- Por cada origen se buscan los calculados que lo referencian por su FK y que **aparecen ese mes** (misma regla de presencia). Un derivado que no cae en el mes (frecuencia o skip del origen) **no entra**.
- `calculatedChildren` = esos derivados con su monto derivado y convertido a la default; `hasCalculated = calculatedChildren.length > 0`.
- Un calculado **nunca es padre** (RF-MCALC-001): `hasCalculated: false`, `calculatedChildren: []`.

## Imputación a totales (RN-019)

Cada calculado suma `|final|` al bucket de su **type derivado** (totales del mes y reportes, para los tres orígenes — RF-MCALC-010). Nunca hay restas a un bucket. Un calculado skippeado por su origen no suma.

## Eliminación — tres caminos (RF-MCALC-005/009)

`DELETE /recurring/:id` (contrato uniforme: `currentMonth`/`fromCurrentMonth` siempre presentes):

- **(a) Calculado de único o cuota** → **borrado lógico total**, **ignorando** el boundary (espeja su origen, RF-MCALC-009).
- **(b) Calculado de fijo** → `applyBoundaryToChain(chainId, boundary)` sobre su propia cadena, sin tocar el origen.
- **(c) Fijo normal** → `applyBoundaryToChain(chainId, boundary)` (`docs/backend/fijos.md` §Eliminación) y `cascadeDeleteCalculados(chainId, boundary)`, que aplica el **mismo** boundary a cada calculado de **fijo** vinculado.

**Cascada del origen único/cuota → la aplica el service, no la DB.** La FK declara `onDelete: Cascade`, pero el origen se borra **lógicamente**: la fila no desaparece y la cascada de la DB no se dispara. El borrado del origen llama a `RecurringService.cascadeSoftDeleteBySourceMovement` / `cascadeSoftDeleteBySourceInstallmentGroup`, que marcan `deletedAt` en el calculado. Así deshacer la eliminación del origen restaura también sus calculados (RN-024).

## Gotchas

- **`validateCategory` con `skipScopeCheck = true`:** el `type` es derivado y varía mes a mes, no hay un type fijo contra el cual validar el scope; se acepta cualquier categoría compatible con `BOTH`.
- **`PATCH /recurring/:id` y `PATCH /recurring/:id/calculated` se excluyen mutuamente:** el primero rechaza `400` si el `:id` es calculado; el segundo, `400` si no lo es. En el split del calculado, R2 hereda `chainId`, la FK de origen y la fórmula.
- **Nunca persistir el monto/tipo derivado.** Escribir `amountCents`/`type` de un calculado es un bug: son placeholders.
