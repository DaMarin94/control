# Backend — Movimientos del mes (MovementsModule)

Endpoint unificado que devuelve **todos los movimientos del mes más los totales**, scopeado por `userId` del JWT: las listas `unicos`, `fijos` y `cuotas`. Shape (`data`, `totals`, `MovementItem`) y reglas de orden / nullabilidad / `skipped` en `docs/data-model/movimientos.md` §Contrato de movimientos del mes. Acá, la implementación. Los reportes del mismo módulo están en `docs/backend/graficos.md`.

## `GET /movements?month=YYYY-MM`

- **`month` (`YYYY-MM`) es obligatorio:** si falta o es inválido, `400`. **No recibe `timezone`**: el mes de cada movimiento se calcula con la zona propia del registro. Acepta `today` (`YYYY-MM-DD`) para resolver el mes en curso en la zona del usuario (contrato en `docs/data-model/movimientos.md`).

## Bucketeo por mes — por la zona propia de cada registro

El mes de un movimiento se determina con la **`timezone` guardada en cada registro**. Se calcula en SQL con `date_trunc('month', "occurredAt" AT TIME ZONE timezone)` comparado contra el mes pedido, vía **`$queryRaw` parametrizado** (Prisma 7 no expresa `AT TIME ZONE` de forma idiomática; el raw va parametrizado, sin interpolar strings). Dos movimientos cargados en zonas distintas caen cada uno en su mes correcto.

## Categoría soft-deleted incluida (RF-CAT-004)

El join de movimientos y el cálculo de totales **no filtran por `Category.deletedAt`**: un movimiento muestra su categoría aunque esté eliminada y **sigue contando en los totales** (RF-VM-002).

## Totales

- **Los totales suman movimientos, no categorías.** `balanceCents = incomeCents - expenseCents`, sin piso. Agregan únicos + fijos + cuotas (+ simulados).
- **Gotcha BigInt → Number:** `SUM(...)` devuelve `BIGINT`, que llega como `BigInt` desde `$queryRaw`. El repositorio lo castea con `Number(...)`; sin el cast, `JSON.stringify` falla.
- **Anulados excluidos de los totales.** Un fijo anulado para el mes (RF-MF-005), un único anulado (`Transaction.skipped`, RF-MU-005) y una cuota anulada (`InstallmentSkip`, RF-MC-004) **se incluyen en la lista** con `skipped: true` pero **no suman**; sus calculados heredan el estado del origen (RN-020).

## Por qué un módulo propio

`MovementsModule` está separado de `transactions` para **unificar `transactions` + `recurring` + `installments`** sin dependencia circular entre esos módulos. Consume cada origen a través de su `Service`.

## Integración de fijos en `/movements`

Puebla `fijos` y suma los fijos activos a los totales vía `RecurringService`.

- **`findFijosByMonth` usa Prisma ORM normal** (no `$queryRaw`): los fijos operan a nivel mes, sin bucketeo por timezone.
- **Condición de actividad:** `startMonth <= month AND (deletedFrom IS NULL OR deletedFrom > month)` **más** `isOnFrequency(startMonth, frequency, month)` (RN-016). El rango se compara **léxicamente sobre strings `YYYY-MM`** (ordenan cronológicamente como texto); la frecuencia se aplica en JS (ver `docs/backend/fijos.md` §Cálculo de aparición de fijos por mes).
- El `MovementItem` de un fijo viene con `occurredAt` y `timezone` en `null`, y con `frequency` / `skipped` poblados.
- **Arranque y fin del fijo se resuelven por cadena (`loadChainBounds`, RF-MF-007 / RF-VM-007).** Por cada `chainId`, en una sola query:
  - **`startMonth`** (arranque) = el `startMonth` **mínimo** de la cadena (la primera fila).
  - **`endMonth`** (fin) = el `deletedFrom` de la fila con **mayor `startMonth`** (la vigente), `"YYYY-MM"` exclusivo; `null` = activo indefinidamente.
  **Gotcha estructural:** tras un split de edición la fila vigente tiene el `startMonth` del **último split**, no el del fijo; y su `deletedFrom` es la terminación real. Por eso ambos bordes se resuelven **por cadena**. Un **calculado de fijo** resuelve sus bordes por **su propio `chainId`** (no `sourceChainId`).
- **`evolutionAvailable`** (RF-VM-009): ver `docs/backend/graficos.md` §Detalle histórico de Fijos.

## Integración de cuotas en `/movements`

Puebla `cuotas` y suma las cuotas del mes vía `InstallmentsService`.

- **Cálculo on-the-fly (RN-006):** grupos con `startMonth <= month` (comparación léxica) filtrados en JS por `month < addMonths(startMonth, totalInstallments)`.
- **Número de cuota del mes (1-based):** `monthDiff(startMonth, month) + 1` → `installment.number`; `installment.total = totalInstallments`. `occurredAt`/`timezone` en `null`; en únicos/fijos `installment` es `null`.
- **Helpers `addMonths` / `monthDiff`** exportados desde `movements.repository.ts` — reusarlos.
- **Gotcha — `addMonths` soporta offsets negativos que cruzan el año vía módulo verdadero** (`((month % 12) + 12) % 12`; el `%` de JS devuelve negativos): `addMonths('2026-03', -3) = '2025-12'`. Imprescindible para las ventanas hacia atrás (proyección de fijos, lookback).

## Integración de movimientos simulados en `/movements`

`MovementsService` pide los ítems simulados del mes a `SimulationsService` y los **mezcla dentro de `unicos`**, reordenando por magnitud DESC con el mismo criterio que `findUnicosByMonth`. Pasan por el mismo filtro de categorías y suman a los totales como cualquier único. Shape en `docs/data-model/movimientos.md` → `simulated`; derivación en `docs/backend/simulacion.md`.

## Integración de calculados y método de pago

- Calculados inyectados en la lista de su origen + `hasCalculated` / `calculatedChildren`: `docs/backend/calculados.md`.
- `paymentMethod` embebido y `autoDebit`: `docs/backend/metodos-pago.md` §Método y débito automático en movimientos.
