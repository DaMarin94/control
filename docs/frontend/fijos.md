# Frontend — Movimientos fijos

Carga, edición, eliminación y reapertura de fijos. Se crean desde el tab **Fijo** del modal de carga; editar, eliminar y reabrir se cablean desde la Vista del mes. Fila y card de detalle en `docs/frontend/vista-mes-y-dashboard.md`.

## `recurring-form.tsx`

- Tipo **Gasto** (default) / **Ingreso**; monto en pesos; categoría filtrada por scope (reusa `CATEGORIES_QUERY_KEY`); descripción opcional. **Sin fecha ni hora** — el fijo opera a nivel mes (RF-MF-001).
- **En edición el tipo es read-only** (RF-MF-003). **Gotcha:** react-hook-form no registra un campo `type` deshabilitado; hay que mantener un `<input type="hidden">` con el valor para que RHF lo registre y Zod lo valide.
- **Gotcha — schema Zod compartido entre crear/editar: TODO campo del schema necesita un `defaultValue` que valide, aunque no se renderice en ese modo.** Si un `defaultValue` no pasa la validación, `handleSubmit` bloquea el submit **en silencio** (síntoma: "Guardar no hace nada"). Caso: `startMonth` solo se renderiza en crear; en edición se inicializa con `getCurrentMonth()` **solo para satisfacer el schema** — NO se envía en el PATCH. Defensa: pasar a `handleSubmit` un `onInvalid` que loguee los errores.
- **Gotcha — el `useEffect` de `reset()`/sync depende del `id` primitivo, NO del objeto de dominio.** El `Recurring` que precarga el form se construye **inline en el JSX del padre** (`movementItemToRecurring`): es una referencia nueva en cada render. Depender del objeto dispararía un `reset` espurio en cada re-render del padre (refetch on focus, invalidaciones) y **pisaría lo tipeado**. El effect depende de `recurring?.id`. El mismo patrón `movementItemTo*` alimenta los forms de único y cuota: verificar que esos effects tampoco dependan del objeto completo (riesgo no confirmado).

## `delete-recurring-dialog.tsx`

- Confirmación **sin opciones** (RF-MF-004): la eliminación aplica **siempre desde el mes visualizado inclusive**. El cliente fija `fromCurrentMonth = true` y `currentMonth` = mes visualizado (`viewMonth`, fallback `getCurrentMonth()`). Misma regla para los calculados (ver `docs/frontend/calculados.md`).
- Muestra un **callout de advertencia** cuando `movement.hasCalculated` (los calculados asociados también se eliminan — RF-MCALC-005).

## Datos (`use-recurring`)

- Mutaciones `createRecurring`, `updateRecurring`, `deleteRecurring`.
- **Invalida toda la familia `["movements"]` por prefijo:** un fijo afecta muchos meses.
- **El front calcula `currentMonth` / `startMonth` y los manda al backend.** `deleteRecurring` envía `fromCurrentMonth` como string literal `"true"`/`"false"`.
- **Gotchas:**
  - En `updateRecurring`, para **limpiar** la descripción se envía `description: null` **explícito** (`undefined` significa "no cambiar").
  - El mapeo `MovementItem → Recurring` para editar sigue el mismo patrón que el de únicos (el ítem no trae todos los campos del recurso).

## Reapertura (`recurring-reopen-modal.tsx`, RF-MF-008)

- **Dos hooks propios, fuera de `use-recurring`:** `useReopenPreview` (`GET /recurring/:id/reopen-preview`, key `["reopen-preview", id, currentMonth]`, `staleTime: 0` + `gcTime: 0`, `retry: false`) y `useReopenRecurring` (`POST /recurring/:id/reopen`; invalida `["movements"]`, `["history"]` e `isReportsQuery` — ver `docs/frontend/graficos.md` §Datos). Contrato en `docs/data-model/reapertura.md` §Contrato de reapertura de fijos.
- **Los reemplazos se mandan solo si el preview los marca `requires*`**; el backend rechaza con `400` los no requeridos. `paymentMethodId: null` ("sin método") es distinto de omitirlo.
