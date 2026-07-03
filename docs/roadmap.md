# Roadmap — Control

> **Working doc descartable.** Es un documento de trabajo: refleja el estado actual de lo pendiente y se **borra al cerrar la versión**. No es registro histórico ni fuente de verdad permanente. Los RF/RN definitivos de cada item se escriben en `requirements.md` (y las pantallas en `screens.md`, el modelo en `data-model.md`) **cuando el item se implementa**, no antes.

Orden de ejecución: **P5 → P1 → P3 → P4 → P2**.

P2 (Límites y Alertas) es el item más grande y transversal, está en fase de descubrimiento y vive en documento aparte: `docs/roadmap-limites-alertas.md`. Va **último**.

---

## P5 — Botón de refrescar por reporte

Botón "refrescar" per-card en la barra de controles de la cabecera (`CardControls` en `report-card.tsx`). Reusa el `refetch` que ya expone `useReports`; refetchea **solo esa card**.

**Alcance.** Los 5 tipos de card de `/reportes` (income-expense, by-category, unique-grid, installment-gantt, inflation-income) **y** el widget income-expense del dashboard.

**Comportamiento.**
- Oculto/deshabilitado en modo orden (RF-REP-009), como el resto de los controles.
- Feedback: solo spinner mientras refetchea, **sin toast**. La card ya tiene su propio estado de error.
- Backend sin cambios.

Ubicación, ícono y estado de carga los define control-design (spec) antes de implementar.

**Agentes.** control-design (spec visual) → control-frontend.

---

## P1 — Mejorar el pool de colores

Ampliar y diferenciar la paleta de colores de categorías: colores más distintos entre sí.

**Estado actual.** Matriz de 70 colores (7 tonalidades × 10 hues) **duplicada** en dos archivos que deben mantenerse en sync (gotcha):
- `backend/src/categories/color-pool.ts` — `COLOR_MATRIX`, base = fila T4 = `COLOR_POOL`.
- `frontend/src/types/category.ts` — `CATEGORY_COLOR_PALETTE`, `CATEGORY_BASE_COLORS`.

**Definición.**
- **Liderado por control-design:** propone la paleta nueva completa. Libertad total de estructura; **única regla dura: máxima separación perceptual** entre colores. El usuario la aprueba antes de que se escriba código.
- **Implementación back+front:** reemplazar la matriz en ambos archivos (en sync). Se mantiene el concepto de "menos usado" sobre un subset base designado por diseño. El mecanismo de validación no cambia — solo su contenido.
- **Migración de datos:** una data migration que **reasigna un color aleatorio de la paleta nueva a TODAS las categorías existentes** (son pocas). Nota: si conviene, distribuir estilo "menos usado" para evitar duplicados — a decidir en la fase.

**Agentes.** control-design (paleta) → control-backend + control-frontend → control-analyst documenta el cambio de matriz / RN-013 cuando se implemente.

---

## P3 — Anular cualquier tipo de gasto (únicos y cuotas)

Extender la anulación (skip) a todos los tipos de movimiento.

**Estado actual.** Anular (skip) existe solo para **fijos**: tabla `RecurringSkip(recurringId, month)`, toggle `POST /recurring/:id/skip`, cada ítem trae `skipped` en `GET /movements`. Únicos y cuotas hoy tienen `skipped: false` fijo.

**Definición.**
- Se extiende a únicos y cuotas reusando el **mismo patrón** de fijos: la acción vive en el **kebab del ítem** (anular / des-anular, toggle reversible). **Sin ojito, sin ícono nuevo.**
- **Modelo:**
  - **Único →** flag booleano en la fila (`Transaction.skipped`, default false). No hay "mes puntual": es una fila, así que el rótulo va **sin "este mes"**.
  - **Cuota →** nueva tabla `InstallmentSkip(installmentGroupId, month)`, análoga a `RecurringSkip` (unicidad `(groupId, month)`, cascade). Anula **solo la instancia de ese mes**, no el grupo entero.
- **Backend:** dos endpoints toggle nuevos; `skipped` en el contrato de únicos (del flag) y de cuotas (de la tabla). El anulado **no suma a los totales del mes NI a los reportes** (income-expense, by-category, anuales) — extender la exclusión que hoy solo cubre fijos.
- Aplica a **cualquier dirección** (gasto o ingreso). La diferenciación visual de "anulado" existente se extiende a únicos y cuotas.
- **Edge (para la fase):** un calculado-de-cuota hereda el skip de su cuota origen, igual que hoy el calculado-de-fijo hereda del fijo.

**Agentes.** control-backend (modelo + endpoints + contrato + exclusión en reportes) → control-frontend; control-analyst escribe los RF nuevos.

---

## P4 — Métodos de pago

Nueva característica de todos los movimientos: asociar cada gasto/ingreso a un método de pago (tarjeta de crédito, débito, efectivo).

**Modelo.**
- Entidad `PaymentMethod` **espejo de `Category`**: del usuario, soft delete, el histórico conserva la referencia, pantalla propia de configuración CRUD.
- `paymentMethodId` **opcional** en las tres tablas de movimiento (`Transaction`, `Recurring`, `InstallmentGroup`); FK como `categoryId`.
- **Tipos extensibles:** hoy crédito / débito / efectivo, pero el modelo **NO debe requerir migración para sumar tipos futuros** (patrón string + allowlist en código, estilo `CurrencyQuote.variant`; la forma exacta la confirma backend/analyst al implementar).
- **Campos por tipo:**
  - crédito → fecha de cierre + fecha de cobro
  - débito → sin campos extra
  - efectivo → sin campos extra
- **"Débito automático" es flag del MOVIMIENTO, no del método:** aparece en el form de carga cuando el método elegido es de tipo débito, no como atributo de `PaymentMethod`.

**Formulario de carga.** Selector de método de pago **opcional** en los tres tabs, análogo a categoría. **Sin "+ Nuevo" inline.**

**Límite v1 — informativo.** Las fechas de cierre/cobro se **guardan y se muestran** de forma descriptiva, pero **NO mueven el mes de imputación** del gasto.

**v2 (fuera de alcance v1 — stub).** Candidato futuro; cuando P4 se implemente, esta nota se promueve a `requirements.md` §fuera de alcance:
- imputación por cierre de tarjeta (el gasto con crédito cae en el mes del resumen),
- proyección de resúmenes,
- "cuándo cae el cobro".

**Ruta.** control-analyst produce RF + definición de pantalla (con este framing) y el usuario los aprueba **ANTES** de que backend/frontend toquen nada. Luego: control-backend → control-frontend → control-design.

---

## P2 — Límites y Alertas

Último. Item más grande y transversal, en fase de descubrimiento. Documento propio: **`docs/roadmap-limites-alertas.md`**.
