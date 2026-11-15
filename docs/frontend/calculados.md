# Frontend — Movimientos calculados

Un calculado es un fijo cuyo monto/tipo se derivan; el front construye la fórmula y muestra el resultado derivado que ya viene en el `MovementItem` (`calculated` / `hasCalculated` / `amountCents` con signo). El origen puede ser fijo, único o cuota: el front **enruta siempre por `calculated.sourceType`**. Contrato en `docs/data-model/calculados.md` §Contrato de movimientos calculados; reglas en RF-MCALC-001..011.

## Creación — desde fijo, único o cuota

- **No hay tab "calculado"** en el modal de carga (RF-MCALC-001). El único disparador es la acción **"Crear movimiento calculado"** del kebab de un ítem fijo, único o cuota en `/mes`. `movement-item-row.tsx` la ofrece en cualquier origen **no** calculado (`!movement.calculated`): no hay calculado-de-calculado.

## `calculated-form.tsx`

- **Sin selector Gasto/Ingreso:** el tipo se **deriva** del signo+monto final (`final > 0 → INCOME`, `≤ 0 → EXPENSE`). Segmented de **operador** (`+ − × ÷ %`), input de **operando** con affordance (`$` para ADD/SUB, `%` para PCT, factor para MUL/DIV), segmented de **signo** (Positivo/Negativo) y **preview en vivo** (expresión + cifra + badge de tipo derivado).
- **Escalado del operando:** el form escala el float al entero que espera el backend (ADD/SUB `×100`, MUL/DIV `×1_000_000`, PCT `×100`) y desescala al editar. Escala en `docs/data-model/calculados.md` §Escalado del operando.
- **`lib/formula.ts` — builder compartido.** `descaleOperand` y `buildFormulaExpression` viven ahí; los reusa `MovementDetailCard` (RF-VM-007) para su bloque "Fórmula".
- **Base del preview según origen.** Origen **único** y **cuota**: `movement.calculated.sourceAmountCents` (en cuota, el monto por cuota); si es `null`, el preview muestra `—`. Origen **fijo** (creación y edición): la base se **resuelve en vivo** contra el offset del selector "Mes del monto base", consultando los movimientos del mes de referencia de ese offset. Si no está disponible, `—` con la expresión en forma abstracta; nunca una cifra calculada sobre otro mes.
- **Gotcha — la resolución del mes de referencia corre también con offset `0`.** Con `0` el mes de referencia es el visualizado: reusa la query cacheada de `/mes` (misma key), sin red extra. En tests implica mockear `useMovements` **por mes** (`mockImplementation`): un `mockReturnValue` estático oculta errores de resolución del offset.
- **Operando 0 con DIV/PCT** se bloquea en el front (submit deshabilitado + error) además del backend (RN-017).
- **Categorías filtradas por el tipo derivado** en vivo.

## Indicación padre/hijo (RF-MCALC-007)

- En `movement-item-row.tsx`: si el ítem **es** calculado → chip **"Calculado"** (`Link2`) + segmento **"desde {Origen}"** (`calculated.sourceDescription`); si **es padre** (`hasCalculated`) → ícono `GitBranch`.
- **Borrado — enrutado por `sourceType`.** `handleDelete` en `month-view-client.tsx`: origen **fijo** → `DeleteRecurringDialog`; origen **único o cuota** → `DeleteRecurringDialog variant="calculated-simple"` (borrado total, RF-MCALC-009). En las dos variantes el cliente manda `fromCurrentMonth = true` con el mes visualizado; el backend ignora ambos para calculados de único/cuota.

## Datos (`use-calculated`)

- **Enrutado por `sourceType`:** `fijo` → `/recurring/:id/calculated`, `unico` → `/transactions/:id/calculated`, `cuota` → `/installments/:id/calculated` (POST y PATCH). El borrado reutiliza `deleteRecurring` (`DELETE /recurring/:id`) en los tres casos.
- **`CreateCalculatedRequest` es una unión:** con `startMonth` para origen **fijo**, **sin** `startMonth` para único/cuota (lo deriva el backend — RF-MCALC-008). `CalculatedInfo` trae `sourceType`/`sourceId` y `sourceChainId` **nullable** (null en único/cuota).
- Invalida toda la familia `["movements"]` por prefijo.
- **`type` NO se envía** en ningún body. Editar un calculado va **siempre** por este hook: `PATCH /recurring/:id` rechaza calculados con `400`.
