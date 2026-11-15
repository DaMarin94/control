# Frontend — Historial de cambios (`/historial` — RF-HIST-001..007)

Pantalla de consulta y deshacer. Spec visual en `docs/design.md`; contrato en `docs/data-model/historial.md` §Historial de cambios.

## Componentes

- **`app/(app)/historial/page.tsx`** → monta `components/history/history-client.tsx` (Client Component), dueño de la query, del estado del modal de confirmación y de la mutación de deshacer.
- **`history-entry-row.tsx`** — una entrada: identidad del movimiento, operación, momento y su acción (deshacer / bloqueada).
- **`history-changes-block.tsx`** + **`history-change-row.tsx`** — el bloque "Qué cambió" y cada fila de campo.
- **`types/history.ts`** — espejo del contrato de la API.

## `lib/history.ts` — único traductor de entrada a presentación

**Toda** traducción de un `HistoryEntry`/`HistoryChange` a texto pasa por este módulo: rótulos de campo y de tipo de movimiento, formateo de monto / fórmula / fecha / momento, y `describeHistoryChange`, que convierte una fila del contrato en una forma **neutra sin JSX** (`HistoryChangeDisplay`) que los componentes solo pintan. También resuelve el resumen de una línea (`pickSummaryChange` + `summarizeHistoryChange`) del modal de deshacer en cadena.

- **Los componentes no formatean por su cuenta.** La misma fila se pinta en la lista y en el modal, con **direcciones de lectura opuestas** (`HistoryChangeDirection: "list" | "modal"`): el traductor decide qué valor va a cada lado.
- **El discriminador de "modo de valor único" es `"next" in change`**, no `next == null` — ver `docs/data-model/historial.md` §Historial de cambios. `sidesOf` lo respeta; toda lógica nueva sobre `changes` también.

## Datos (`use-history`)

- **`useHistory()`** — `GET /history`, query key `["history"]`, gate-ada con `isAuthenticated`.
- **`useUndoHistory()`** — `POST /history/:id/undo` (sin body; el backend resuelve el undo en cadena).
- **Invalidación tras deshacer: tres familias.** `["history"]`, **`["movements"]`** y **todas las de reportes** (`isReportsQuery`, ver `docs/frontend/graficos.md` §Datos) — deshacer **restaura o revierte movimientos reales**.

## Deshacer desde el toast (RF-HIST-007) — invariante del `groupId`

El toast de éxito de editar / eliminar / reabrir lleva "Deshacer" sobre el `historyEntryId` que devuelve la mutación (contrato en `docs/data-model/historial.md` §Historial de cambios → `historyEntryId`). Lo emiten los 4 forms de movimiento, los 3 diálogos de borrado y el modal de reapertura (con el `chainId` del fijo como `groupId`); el puente al contrato de acción del toast es **`lib/toast-undo.ts`** (traduce el resultado de `undo()` a `ToastActionOutcome`). Copy y comportamiento visual en `docs/design.md`.

**Para un mismo movimiento, el `groupId` del toast de EDICIÓN y el de ELIMINACIÓN tiene que ser idéntico**: así el segundo reemplaza al primero (un aviso por movimiento). Si divergen, quedan dos toasts y el viejo ofrece deshacer una entrada ya **bloqueada** por RF-HIST-004.

| Forma | `groupId` |
|---|---|
| Único | `Transaction.id` |
| Cuotas | `InstallmentGroup.id` |
| Fijo normal y **calculado de fijo** | **`chainId`** del ítem — el id de fila cambia en cada split del PATCH, el `chainId` no (ver `docs/data-model/entidades.md` → `chainId`) |
| Calculado de **único** y de **cuota** | **id de fila** — su edición es siempre in-place, el id es estable |
