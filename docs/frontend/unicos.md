# Frontend — Movimientos únicos (y modal de carga)

El modal de carga se invoca desde el dashboard (`/`), el sidebar y `/mes`; editar, duplicar y eliminar se cablean desde la Vista del mes (ver `docs/frontend/vista-mes-y-dashboard.md`). Este archivo cubre además lo compartido por los tres forms de movimiento (modal, moneda/cotización, duplicar).

## Modal de carga (`components/movements/transaction-modal.tsx`)

- **Props como discriminated union por `mode`**:
  - **`"create"`** — tabs **Único / Fijo / Cuotas**. Renderiza `TransactionForm`, `RecurringForm` o `InstallmentForm`.
  - **`"edit-single"` / `"edit-fixed"` / `"edit-installment"`** — sin tabs; form del tipo, precargado con un `Transaction` / `Recurring` / grupo de cuotas (RF-MU-002, RF-MF-003, RF-MC-003).
  - **`"duplicate-single"` / `"duplicate-fixed"` / `"duplicate-installment"`** — sin tabs, título "Duplicar"; form del tipo en **modo creación**, alimentado por la prop `*Prefill` (RF-VM-008; ver §Duplicar).
  - **`"create-calculated"` / `"edit-calculated"`** — sin tabs; `CalculatedForm` (ver `docs/frontend/calculados.md`).
- **`"create"` es el único modo con tabs**: el tipo de un movimiento no se elige fuera del alta en blanco (RF-CM-001).

## transaction-form

- Tipo **Gasto** (default) / **Ingreso**; monto **en pesos** (a centavos al enviar); selector de categoría **filtrado por scope** (RN-010) que reusa `CATEGORIES_QUERY_KEY`; fecha + hora (default: ahora); descripción opcional.
- **Estados:** Guardando; **Sin categorías disponibles** (link a `/configuracion/categorias`); **Error backend** — el modal **queda abierto y conserva los datos** (RNF-008).

## Moneda y cotización en los forms de movimiento (multi-moneda)

Aplica a los **tres** forms (`transaction-form`, `recurring-form`, `installment-form`). Regla funcional en `docs/requirements/multi-moneda.md`.

- **Los effects de pre-carga de la cotización (`referenceRate` / `lastExchangeRate`) no pisan un valor precargado** — se comportan igual que en edición cuando el form corre con `prefill` (ver §Duplicar).
- **`onSubmit` con `currency === defaultCurrency` envía `exchangeRate = 1` hardcodeado** — **no parsea el input de cotización**, que en ese caso está fuera del DOM (solo se renderiza cuando `currency !== defaultCurrency`). El backend ignora `exchangeRate` cuando `currency === anchorCurrency`. **Gotcha:** no volver a parsear el input oculto; el `1` es deliberado.

## Duplicar — prefill desacoplado de `isEditing` (RF-VM-008)

Aplica a los **tres** forms. Regla funcional en RF-VM-008.

- **`isEditing` gobierna dos cosas a la vez**: "precargar valores" y "PATCH vs POST" (`isEditing = entidad !== null`). Duplicar necesita **lo primero sin lo segundo**: la pre-carga entra por la prop **`prefill`**, que llena los `defaultValues` **sin** activar `isEditing` (el submit es un **POST**). No colapsar ambas cosas en `isEditing`.
- **Todo effect que pre-cargue un campo desde una fuente externa** (cotización, `referenceRate` / `lastExchangeRate`, moneda default) trata el modo prefill **como edición** y no pisa el valor copiado. Por eso la nota del campo lee **"Cotización modificada"**.
- **Los mappers de prefill son propios: `movementItemTo*Prefill`, separados de los `movementItemTo*` de edición.** Los de edición rellenan campos con **dummies válidos solo para el PATCH** (p. ej. `startMonth: getCurrentMonth()`, `createdAt: ""`) que el contrato de edición no envía; reusarlos en un POST haría nacer el duplicado con el mes de inicio equivocado.

## Crear desde el dashboard

- Botón **"Nuevo movimiento"** en `/` abre el modal. Al guardar → toast con acción **"Ir a ver"** que navega a `/mes?month=YYYY-MM`.

## Editar / eliminar — cableados desde la Vista del mes

- `TransactionModal` selecciona el flujo por `mode` (`"create"` / `"edit-single"`).
- `DeleteTransactionDialog` acepta `transaction` (confirmación antes del borrado lógico).
- La Vista del mes pasa el movimiento de la lista (mapeo `MovementItem → Transaction` en `docs/frontend/vista-mes-y-dashboard.md`).

## Datos (`use-transactions`)

- **`useTransactions()`** expone `createTransaction`, `updateTransaction(id, data)`, `deleteTransaction(id, month)`.
- **La lista del mes no vive acá:** se lee con `useMovements(month)`.
- **Invalidación al mutar:** las mutaciones invalidan **`MOVEMENTS_QUERY_KEY(month)`**, **prefijo** de la key de `useMovements` (gotcha de la key en `docs/frontend/vista-mes-y-dashboard.md` §Datos (`use-movements`) — no agregarle elementos).
- **Gotcha — `deleteTransaction` recibe `month` explícito:** el `DELETE` solo devuelve `{ historyEntryId }`, así que el llamador deriva el `month` del `occurredAt` del movimiento y lo pasa.

## Helpers (`lib/format.ts`)

Ver `docs/frontend/base.md` §Helpers (`lib/format.ts`).
