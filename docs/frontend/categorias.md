# Frontend — Categorías (`/configuracion/categorias`)

CRUD de categorías. Sección Categorías del hub (ver `docs/frontend/configuracion.md`). Componentes co-ubicados bajo `app/(app)/configuracion/categorias/` (`categories-list`, `category-form-modal`, `delete-category-dialog`, `reactivation-prompt`).

## Pantalla

Lista de categorías **activas**: por fila el color, el nombre, el scope legible (`AMBOS` / `GASTO` / `INGRESO`) y el contador `"N movimientos"`. Botón "Nueva categoría". Acciones por fila: **Editar**, **Eliminar**. Estados: Cargando, Con datos, Vacío.

- **Modal único crear/editar:** "Nueva categoría" lo abre vacío; "Editar" pre-cargado. Campos: nombre, scope (`Select` nativo) y **color** (`ColorPicker`).
- **`ColorPicker` (grid 8×5).** Matriz de 40 colores, presente en crear y editar. En **crear** arranca con el **menos-usado** pre-seleccionado (`getLeastUsedBaseColor()`, replica `assignColor` del backend sobre los 8 base); en **editar**, con el color actual. Botón **"aleatorio"**. El front siempre envía `color`.
- **Eliminar:** diálogo de confirmación antes del soft delete.

## Flujo de reactivación (409 reactivable)

Al crear, si el backend responde `409` con `error.data.reactivable`, el modal **no muestra un error de duplicado**: muestra "Ya tenés una categoría 'X' eliminada. ¿Querés reactivarla?" con **Reactivar / Cancelar**. El prompt aclara que vuelve con su **configuración original (scope y color)** — los valores del form se ignoran. Reactivar llama a `POST /categories/:id/reactivate` con el `id` de `error.data.category`.

- **`isReactivableError`** — type guard sobre el `ApiError` para discriminar este caso del `409` de colisión-con-activa. El `ApiError` porta `data?: unknown` desde `apiRequest`.

## Datos

- **`use-categories`** — React Query, clave **`["categories"]`** (`CATEGORIES_QUERY_KEY`). Todas las mutaciones (crear, editar, eliminar, reactivar) invalidan esa clave.
- El selector de categorías de los forms de movimiento **reusa `CATEGORIES_QUERY_KEY`** para compartir caché.

## Paleta de colores — espejo del backend (gotcha)

La matriz vive como **constante propia del front** en `types/category.ts` (`CATEGORY_COLOR_PALETTE` = los 40; `CATEGORY_BASE_COLORS` = los 8 base, en el orden de asignación, no derivados por slice). Es un **espejo** de `COLOR_MATRIX` / `COLOR_POOL` en `backend/src/categories/color-pool.ts` — **no hay paquete compartido**. **Gotcha:** cambiar la paleta exige actualizar **ambos lados**. `getLeastUsedBaseColor()` también replica el criterio de `assignColor` (ver `docs/backend/categorias.md` §Pool de colores).

## Uso dual de `CategoryFormModal` (standalone vs inline)

El mismo `CategoryFormModal` se usa en **dos modos**, diferenciados **solo por props opcionales**:

- **Standalone (`/configuracion/categorias`):** el selector de scope ofrece `AMBOS` / `GASTO` / `INGRESO`, default **"Ambos"**.
- **Inline (desde los forms de movimiento, RF-MU-004):** props **`lockScopeToType`** y **`onCreated`**:
  - `lockScopeToType` (`EXPENSE` / `INCOME`) **restringe el scope** a ese tipo + "Ambos" y **preselecciona el tipo exacto**.
  - Al crear o reactivar, el modal **devuelve la categoría vía `onCreated`** para que el form la **autoseleccione**.
  - **Cuotas pasan `lockScopeToType="EXPENSE"` fijo.**
- **`ReactivationPrompt.onReactivated` propaga la categoría reactivada hacia arriba**; `CategoryFormModal` la reenvía por `onCreated`.

## Apilado de modales — gotcha de z-index

Cuando `CategoryFormModal` se abre **inline** sobre el modal de movimiento:

- **`TransactionModal`**: **`z-40`**.
- **`CategoryFormModal`**: **`z-50`**.
- **`ReactivationPrompt`**: **`z-50`** — **reemplaza** al `CategoryFormModal` en el DOM, no se apila.

> Más modales apilados deben **extender esta escala** (no reusar `z-50` para un nivel que deba quedar por encima del `CategoryFormModal`).
