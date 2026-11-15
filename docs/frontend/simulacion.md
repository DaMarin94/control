# Frontend — Simulación de categoría (`/mes` — RF-SIM-001..005)

Toda la feature vive en `/mes`: la entrada es el **popover de filtro de la sección Únicos** y la salida son filas simuladas mezcladas en esa sección. Spec visual en `docs/design.md`; contrato en `docs/data-model/simulacion.md` §Simulación de categoría.

## Componentes

- **`components/movements/simulation-band.tsx`** — bloque "Simulación" del popover de Únicos: botón de alta (siempre presente) + lista de las simulaciones (activa / pausada), cada fila con su **propio tramo** (`formatSimulationSpan`: dos extremos si todavía no arrancó, solo el fin si ya arrancó), su acción de extender (RF-SIM-005) y de eliminar, más una **nota general constante** de la regla de arranque (`formatHorizonBandNote`).
  - **Gotcha — recibe `currentMonth` y `viewedMonth`, dos meses distintos que no se colapsan.** `currentMonth` es el mes en curso real (decide si el tramo ya arrancó: "Proyecta de… a…" vs "Proyecta hasta…"); `viewedMonth` es el mes de la ruta `/mes` (comparado contra el `endMonth` de cada fila, decide si muestra "Extender"). Tratarlos como el mismo valor rompe el disparador fuera del mes en curso.
- **`components/movements/simulate-category-modal.tsx`** — selector sobre el universo de candidatas: lista **solo las elegibles** (`isEligibleCandidate`, ≥3 meses con datos y sin simulación activa) — las demás quedan **ocultas**, no deshabilitadas —, con la nota de elegibilidad al pie (`formatEligibilityNote`) y los **cuatro** estados vacíos por causa (`getCandidatesEmptyCause` / `formatCandidatesEmpty`).
- **`components/movements/delete-simulation-dialog.tsx`** — confirmación de la eliminación.
- **`components/movements/simulated-movement-row.tsx`** — fila simulada dentro de Únicos. **No interactiva** (sin kebab, sin card de detalle) con la **misma geometría** que `movement-item-row.tsx`: cambia el tratamiento, nunca el grid (si no, la columna de montos se desalinea).
- **`lib/simulations.ts`** — helpers puros: `isMonthWithinSimulationSpan` (pertenencia de un mes al tramo de **una** simulación — `effectiveStartMonth..endMonth` —, evaluada simulación por simulación) y el copy sensible al conteo. El resto del copy vive inline en los componentes.

## `SectionFilterPanel` — `footerSlot` y anclaje invertible

Hechos estructurales de `components/ui/section-filter-popover.tsx`:

- **`footerSlot` es un render-prop `(closePopover) => ReactNode`, no un prop de dominio.** Mantiene al componente —en `ui/`, usado por las tres secciones— **agnóstico de simulaciones**: solo Únicos lo pasa. Recibe `closePopover` para que sus acciones cierren el popover **antes** de abrir el modal o la confirmación ("un solo overlay a la vez"). Cualquier bloque futuro del pie entra por acá.
- **Anclaje invertible:** abre hacia abajo por preferencia y **hacia arriba si no entra**, con `max-height` clampeado cuando no entra en ningún lado. Mismo mecanismo de dos pasadas que `KebabMenu` / `use-listbox-popover.ts`, pero **no reusa `useListboxPosition`**: ese hook ancla por la izquierda con el ancho del trigger, y este panel ancla por la **derecha** con ancho fijo.
- **Tener una simulación NO enciende el punto indicador del disparador**: ese punto significa solo "sección filtrada".

## Datos (`use-simulations`)

- **`useSimulations()`** (`GET /simulations`) y **`useSimulationCandidates(enabled)`** (`GET /simulations/candidates`, **solo mientras el modal está abierto**).
- **Manda `today` con la fecha local del navegador** (`getLocalTodayString()`) en las **tres** llamadas: los dos `GET` y el `POST` de `useCreateSimulation`. Con el fallback UTC del backend, ventana histórica y tramo quedarían corridos un mes en UTC−N cerca de fin de mes (contrato en `docs/data-model/simulacion.md` §Simulación de categoría → Endpoints).
- **`today` es un elemento extra de la query key; las claves exportadas son el prefijo.** `SIMULATIONS_QUERY_KEY` (`["simulations"]`) y `SIMULATION_CANDIDATES_QUERY_KEY` (`["simulations","candidates"]`) son las **base**; las queries reales agregan `today` al final. Invalidar siempre con las base — mismo gotcha de prefijo que `MOVEMENTS_QUERY_KEY` (`docs/frontend/vista-mes-y-dashboard.md` §Datos (`use-movements`)).
- **Crear y eliminar invalidan la familia `["movements"]` por prefijo:** una simulación afecta todos los meses de su tramo.
- **El alta es múltiple y el endpoint responde `201` siempre**, incluso si fallaron todas las categorías. Los rechazos llegan en `failed[]` con su **mensaje legible**, y el modal los muestra en la fila de esa categoría.
- **Si la llamada lanza** (400 de body inválido, 500, red), el hook sintetiza un **mensaje genérico único** ("No se pudo crear la simulación. Intentá de nuevo.") y lo replica como una entrada de `failed` por cada `categoryId` pedido.
