# Backend — Historial de cambios (HistoryModule)

Registra ediciones y eliminaciones de movimientos y reaperturas de fijos, y permite deshacerlas (RF-HIST-001..006, RF-MF-008). Contrato de API y modelo en `docs/data-model/historial.md` §Historial de cambios; shape del snapshot por `targetKind × action` en `src/history/history.types.ts`.

## Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `GET /history` | — | `200` · `data: HistoryEntryDto[]` | — |
| `POST /history/:id/undo` | — | `200` · `data: { undone: true }` | `404` |

El `POST` no es un DELETE: no aplica la convención del 204.

## Captura

Vive en los **services de dominio** (`transactions`, `recurring`, `installments`), no en este módulo: cada uno arma el snapshot del estado previo **antes** de mutar y llama a `HistoryService.record(...)`. La entrada se graba después de que la mutación terminó bien. Las mutaciones devuelven el `historyEntryId` (`docs/backend/base.md` §Endpoints).

- **La cascada no genera entradas propias (RN-024).** Eliminar un origen con calculados produce **una** entrada; los calculados que caen viajan **dentro** del mismo snapshot y se restauran con él. Igual con los espejos de una reapertura (`docs/backend/fijos.md` §Reapertura).
- **`targetId` agrupa por movimiento lógico, no por fila** (`docs/data-model/historial.md`): en fijos y calculados es el `chainId`, así el split de edición no parte la pila LIFO.

## Retención y purga

Una entrada se conserva hasta **lo primero** de (RF-HIST-005): que el movimiento acumule más de **5 entradas** (se descarta la más vieja al grabar la sexta) o que la entrada cumpla **31 días**.

- **Reaper.** Al purgarse una entrada de **eliminación**, el movimiento con borrado lógico se **borra físicamente**: deja de ser reversible y desaparece de la DB. Purgar una entrada de edición o de reapertura solo borra la entrada.
- **La purga es lazy, no agendada.** `@nestjs/schedule` no es dependencia del proyecto: no hay cron; la purga corre **al leer el historial y al deshacer**. **Consecuencia:** un usuario que nunca abre `/historial` no purga sus entradas vencidas — sus movimientos eliminados siguen ocupando espacio (invisibles para el resto de la app) más allá de los 31 días.

## Deshacer

- **LIFO por movimiento.** Solo se deshace la entrada más reciente de un `targetId`; deshacer una anterior implica deshacer primero sus posteriores. El mismo endpoint resuelve los dos casos: dado el `id`, arma la cadena y la recorre **de la más reciente a la más antigua** (RF-HIST-004).
- **Atómico.** Toda la cadena —restaurar y borrar cada entrada— corre en **una sola `prisma.$transaction`**.
- **No deja rastro** (RF-HIST-003): deshacer borra las entradas involucradas y no crea ninguna.

## Excepción arquitectónica — el undo y el reaper mutan por Prisma directo

`HistoryService.undo()` y el reaper escriben en `Transaction`, `Recurring` e `InstallmentGroup` **directamente por Prisma** y **sin el filtro de borrado lógico** (`docs/backend/base.md` §Filtro de borrado lógico), rompiendo deliberadamente la regla de propiedad de dominio. Dos razones:

1. **El undo en cadena necesita una única transacción de DB.** Threadear un `Prisma.TransactionClient` por `TransactionsService`, `RecurringService` e `InstallmentsService` —y sus repositorios— sería una modificación invasiva de tres módulos para un solo consumidor.
2. **Evita una dependencia circular:** los tres services de movimiento ya dependen de `HistoryService` para capturar.

**La captura NO es excepción.** La excepción se limita a la restauración y al borrado físico, y no se extiende a operaciones nuevas sin discutirlo.

## Qué campos emite cada entrada

El backend decide qué filas del bloque "Qué cambió" emite; **el frontend no filtra ni decide omisiones**. Además del set aplicable por tipo de objetivo (`history.service.ts`), dos campos tienen reglas propias:

- **`exchangeRate` (`Cotización`) se emite solo si es informativa:** hay **conversión real** (moneda del movimiento ≠ su `anchorCurrency`) o la **moneda cambió** en esa edición. Misma moneda que el ancla ⇒ cotización `1` ⇒ ruido.
- **`currency` (`Moneda`) en una entrada de eliminación se omite** cuando coincide **a la vez** con su `anchorCurrency` y con la **moneda default vigente** del usuario. Si el usuario cambió su default desde la carga, **sí** se emite.
