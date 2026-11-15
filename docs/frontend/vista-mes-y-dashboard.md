# Frontend — Vista del mes y Dashboard

Las dos pantallas de visualización, sobre el endpoint unificado `GET /movements?month=YYYY-MM` (contrato en `docs/data-model/movimientos.md` §Contrato de movimientos del mes; backend en `docs/backend/movimientos-mes.md`).

## El dashboard vive en `/`

El dashboard es `src/app/(app)/page.tsx` en **`/`** (no hay `/dashboard`). Redirects de auth en `docs/frontend/base.md` §Pantallas y protección de rutas.

## Dashboard (`/`)

- **Encabezado con el mes actual** (sin navegación entre meses).
- **Resumen financiero** del mes (gastos / ingresos / balance) leído de `data.totals`.
- Botón **"Nuevo movimiento"** (abre el modal de carga) y enlace **"Ver todos"** → `/mes`.
- **Estado vacío:** totales en cero y CTA **"Cargá tu primer movimiento"** que abre el modal.
- **No lista movimientos** (la lista vive en `/mes`).
- Widget de reportes: `docs/frontend/graficos.md` §Puntos de uso.

## Vista del mes (`/mes`)

- Lee el mes de **`?month=YYYY-MM`** (default: `getCurrentMonth`).
- **`month-view-client.tsx` envuelve su contenido en `PeriodNav`** para prev / next, que cambia `?month=` (`prevMonth` / `nextMonth`). El rótulo del mes (`formatMonthLabel`) va al **header `.phead`** en ≥1288px (`@arrows:`); en ≤1287px el header lleva un **stepper compacto**. Siempre `canGoPrev`/`canGoNext`. El `px-10` y el padding vertical los agrega `month-view-client.tsx` sobre `children`; `page.tsx` no lleva `max-w-280 mx-auto` (ver `docs/frontend/period-nav.md`).
- **Rótulo de estado del mes — discriminante de TRES estados, separado de `isCurrentMonth`.** Copy y regla en `docs/screens.md`. El valor sale de comparar el mes visualizado con el mes en curso (anterior / igual / posterior) y alimenta **solo presentación**: la sub-línea del header y la prop `statusLabel` del disparador compacto (`month-jump-popover.tsx`), con el **mismo string**. **`isCurrentMonth` es otra cosa y es booleano:** es el alcance temporal de los límites (`evaluateItemLimitMark(..., isCurrentMonth)`, RF-LIM-003/004) y el discriminante de los simulados. Volverlo ternario o derivar de él el rótulo cambia qué límites marcan.
- **Lista agrupada en secciones colapsables + reordenables Únicos / Fijos / Cuotas** (RF-VM-005). Las **tres se muestran siempre**; una sección vacía muestra cabecera completa + empty inline propio. Se renderizan con `AccordionSection` / `SortableSection` (ver `docs/frontend/base.md` §Sistema de componentes). Cada ítem es `movement-item-row` (ver abajo); su cuerpo abre `MovementDetailCard` y el kebab expone **Editar**, **Duplicar** y **Eliminar** (más las acciones propias de cada tipo), que abren el flujo según el origen: únicos → `TransactionModal` (`edit-single` / `duplicate-single`) / `DeleteTransactionDialog`; fijos → `TransactionModal` (`edit-fixed` / `duplicate-fixed`) / `delete-recurring-dialog`; cuotas → `TransactionModal` (`edit-installment` / `duplicate-installment`) / `delete-installment-dialog`.
- **Filtros por listado (RF-VM-006) — filtrado y totales en cliente.** Cada sección tiene su disparador de filtro de **tipo + categoría** (`SectionFilterPopover`), como `filterSlot` de `AccordionSection` (oculto en modo orden). **`month-view-client.tsx` filtra cada lista en cliente y recalcula los totales** sobre lo visible: los `data.totals` del backend **no se usan en `/mes`** (sí en el dashboard). `useMovements(month)` se llama **sin** `categories`.
- **RN-019 tiene UN único punto de implementación en el frontend: `src/lib/movements.ts`.** `sumMovementTotals(items) → { expense, income }` (magnitud al bucket del `type`) y `groupSubtotalCents(items) → number` (neto income − expense; delega en el anterior). **Todo componente que calcule totales o subtotales importa de ahí.**
- **`lib/movements.ts` también nuclea el display por ítem:** `formatConvertedAmountDisplay(movement, defaultCurrency)` (cifra convertida con signo/símbolo, contemplando el signo del calculado en `amountCents`) y `FREQUENCY_LABEL: Record<number, string>` (etiqueta en minúscula por `frequency` 1..12; capitalizada en la card). Los reusan `MovementItemRow` y `MovementDetailCard`.
- **Orden de la sección Únicos (RF-VM-001).** Lo aplica **`sortUnicosBySort` en `lib/movements.ts`**, client-side, sobre el array **ya filtrado** (`"amount"` → magnitud DESC; `"date"` → `occurredAt` DESC, desempate por monto DESC). Lo dispara `SectionSortButton`; se persiste en la preferencia `unicosSort` (default `"amount"`, shape en `docs/data-model/preferencias.md`). Solo Únicos.
- **`MovementItem.amountCents` puede ser NEGATIVO** (calculados `EXPENSE`). Al bucketear por tipo **siempre `Math.abs()`** (lo hace `sumMovementTotals`); sumar el crudo resta el gasto y diverge del dashboard. El pill contador y el subtotal de cada sección reflejan lo filtrado. Estado persistido en la preferencia `monthListFilters` (patrón optimista); shape, defaults y back-compat en `docs/data-model/filtro-categorias.md` §Preferencia `monthListFilters` — replicarlos. Es **por pantalla, no por mes**. La preferencia `monthCategoryFilter` está deprecada (no se lee ni migra).
- **Estado de secciones desde la preferencia `monthSections`.** Colapsado/expandido y orden se leen y persisten vía `usePreferences` (patrón optimista, ver `docs/frontend/base.md` §Preferencias de usuario). Shape y regla de **back-compat / normalización** en `docs/data-model/preferencias.md` → `monthSections`; replicarla en el consumidor.
  - **Gotcha modo orden:** al **entrar** en modo orden todas las secciones se **colapsan de forma transitoria** (estado local, **NO se persiste**); al **salir** se **restaura el colapso previo** sin pisar `monthSections.collapsed`. Es deliberado.
- **Se actualiza al mutar** por invalidación de la query del mes.

## `movement-item-row.tsx`

- **Fila glanceable (RF-VM-001 / RF-VM-007):** identidad (badge de origen "Único"/"Fijo"/"Cuotas", nombre, categoría), un discriminador en columna propia y el monto convertido en una línea. Fijos: **etiqueta de frecuencia** (`FREQUENCY_LABEL[frequency]`, rótulos de RF-MF-006); cuotas: **"Cuota X/N"** (`installment.number` / `installment.total`); únicos: fecha `DD Mmm`. El **detalle secundario** (método de pago, moneda/valor original, débito automático, hora del único, arranque y vigencia del fijo, plan de la cuota, fórmula del calculado) vive en `MovementDetailCard`. **Null-safety:** `occurredAt` / `timezone` pueden venir `null` (fijos y cuotas) — no pasarlos a `formatDate` / `formatTime` sin chequear.
- **Apertura de la card:** el **cuerpo** es clickeable (`role="button"`, `Enter`/`Espacio`) y abre `MovementDetailCard`; el **kebab** es un botón hermano que corta la propagación (ver `docs/frontend/base.md`, gotcha del scrim). Anatomía en `docs/design.md`.
- Indicación padre/hijo de calculados: `docs/frontend/calculados.md`.

## `MovementDetailCard` (card de detalle, RF-VM-007)

- **Modal read-only sobre `ModalShell`** (variante `dialog`, con `closeOnScrimClick` → cierra por ✕/Esc/scrim). **No dispara fetch:** renderiza el `MovementItem` que la lista ya tiene; sin estados de carga/vacío/error propios. **Sin footer ni controles de acción** — las acciones viven en el kebab de la fila.
- **Dos vistas — estado `view: "detail" | "evolution"` (RF-VM-009).** Se resetea a `"detail"` por construcción (`movement-item-row` monta/desmonta la card). El rango de la vista evolución vive en `EvolutionView`, así que cada entrada arranca en 1 año. En `"evolution"` la card pasa `wide` y un `onEscape` que vuelve a `"detail"`; el canvas es la variante acotada de `FixedEvolutionCard` (ver `docs/frontend/graficos.md` §Card `fixed-evolution`).
- **Gate del acceso "Ver evolución":** `origin === "fijo" && calculated === null && !simulated && chainId !== null`. Grisado si `!evolutionAvailable`, con **`aria-disabled`** (no `disabled`: tiene que seguir enfocable y mostrar el tooltip). El acceso y "Volver al detalle" comparten `NAV_ROW_BOX` / `NAV_ROW_ENABLED`.
- **Gotcha — Esc con el listbox de rango abierto.** Los handlers de Esc del shell y de `useListboxDismiss` están en `document` y el del shell corre primero. En vista evolución, el `onEscape` de la card hace `return` si existe un `[role="listbox"]` en el DOM: el primer Esc cierra el listbox, el segundo vuelve al detalle.
- **Gotcha — foco inicial de `EvolutionView`.** Enfoca el trigger del `RangeSelect` con `querySelector('button[aria-haspopup="listbox"]')` sobre su wrapper; depende de que sea el **único** botón con ese atributo en la variante acotada.
- **Contenido condicional por tipo y por dato presente:** método de pago (sublínea de crédito `closingDay`/`paymentDay` solo si `type === "CREDIT"`), cross-rate (`currency ≠ default`), débito automático, hora del único, frecuencia + vigencia del fijo (`startMonth`/`endMonth`), plan de la cuota, origen + fórmula del calculado. Anatomía en `docs/design.md` §Card de detalle de movimiento.
- **`CalculatedChildrenBlock` — derivados del origen.** Si el ítem es **origen** de calculados (`hasCalculated`), lista sus derivados del mes desde `calculatedChildren` (contrato en `docs/data-model/movimientos.md`). Read-only, **no clickeable**. Cada fila: nombre + monto. **El signo se deriva del `type`** de cada `CalculatedChild` (`EXPENSE` ⇒ negativo, `INCOME` ⇒ positivo) porque `convertedAmountCents` viene como magnitud.
- **Reusa helpers:** `formatConvertedAmountDisplay` y `FREQUENCY_LABEL` (`lib/movements.ts`); `formatMonthShort` / `formatDate` / `formatTime` / `formatCurrency` (`lib/format.ts`); `descaleOperand` + `buildFormulaExpression` (`lib/formula.ts`).

## Datos (`use-movements`)

- **`useMovements(month, categoryIds?)`** sobre `GET /movements?month=`. **Query key como función:** **`MOVEMENTS_QUERY_KEY(month, categoriesKey?, today?)`**.
- **Manda `today` con la fecha local del navegador** (`getLocalTodayString()` de `lib/format.ts`) para que el backend resuelva el **mes en curso** en la zona del usuario (contrato en `docs/data-model/movimientos.md`). Define qué meses son futuros y cuáles traen simulados (RN-028): con el default UTC del backend, una zona UTC−N vería el mes en curso corrido.
- **GOTCHA ESTRUCTURAL — `today` es el 4º elemento OPCIONAL de la query key, y tiene que seguir siéndolo.** `MOVEMENTS_QUERY_KEY(month)` devuelve `["movements", month, null]` (3 elementos) y `useMovements` usa `["movements", month, categoriesKey, today]` (4). Los 3 son un **prefijo válido** de la key real e `invalidateQueries` matchea **por prefijo**: así las mutaciones de `use-transactions.ts` alcanzan la query del mes. Convertir `today` en elemento **incondicional** (aunque sea `null`) rompe el prefijo y las invalidaciones dejan de matchear **en silencio**.
- Reusar esta clave para invalidar — no inventar otra.

## Mapeo `MovementItem → Transaction` (para editar)

- `MovementItem` **no trae `userId` / `createdAt` / `updatedAt`** y **`categoryId` se deriva de `category.id`**. La Vista del mes arma el `Transaction` que esperan `TransactionModal` / `DeleteTransactionDialog`.

## Gotcha — `<Suspense>` + `useSearchParams`

- `/mes` usa **`useSearchParams()`**, que en Next.js 15 **obliga a envolver el componente en `<Suspense>`** (si no, el build falla). `(app)/mes/page.tsx` envuelve `MonthViewWrapper` en `<Suspense>`.

## Animación de acordeón sin JS — técnica grid-rows (`AccordionSection`)

- **Animar `height:auto` en CSS, sin medir el DOM:** el cuerpo usa **`grid-template-rows: 0fr ↔ 1fr`** en un contenedor `overflow-hidden`, con **`min-h-0`** en el hijo. `prefers-reduced-motion` quita la transición. Reusarlo para cualquier colapsable futuro.
- **Testing:** `grid-rows-[0fr]` no oculta del DOM en jsdom — ver `docs/frontend/base.md` §Testing — gotchas.

## Navegación entre pantallas

Las pantallas autenticadas se navegan por el **sidebar global** (`docs/frontend/navegacion.md`) y por los **accesos de cada pantalla** (enlace "Ver todos", acción "Ir a ver" del toast, URL). Ambos conviven.
