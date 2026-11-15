# Backend — Categorías (CategoriesModule)

CRUD **scopeado por `userId` del JWT**. Las respuestas exitosas devuelven el shape de categoría. Shape y `movementCount` en `docs/data-model/categorias.md` §Contrato de categorías.

## Endpoints

| Endpoint | Body | Éxito | Errores |
|----------|------|-------|---------|
| `GET /categories` | — | `200` · `data: Categoria[]` | — |
| `POST /categories` | `{ name, scope?, color? }` | `201` · `data: Categoria` | `400` · `409` (dos casos) |
| `POST /categories/:id/reactivate` | — (ignora el body) | `200` · `data: Categoria` | `404` · `409` |
| `PATCH /categories/:id` | `{ name?, scope?, color? }` | `200` · `data: Categoria` | `400` · `404` · `409` |
| `DELETE /categories/:id` | — | `204 No Content` | `404` |

- **`GET /categories`** — solo activas (`deletedAt` null), por **nombre ascendente**, cada una con `movementCount`.
- **`POST /categories`** — `name` obligatorio y no vacío; `scope` opcional (default `BOTH`); **`color` opcional**, debe pertenecer a la matriz de 40 (case-insensitive, se normaliza a mayúsculas). Sin `color`, el backend asigna el "menos usado" como red de seguridad (el front siempre lo envía). Dos casos de `409`:
  - **Colisión con una activa** (RN-008): `error.message` = `"Ya existe una categoría activa..."`, **sin** `error.data`. Bloqueo duro.
  - **Colisión con una eliminada / reactivable** (RF-CAT-002, A3): `error.data = { reactivable: true, category: { id, name, scope, color } }`. El front usa ese `id` para ofrecer reactivar.
  - `400`: nombre vacío o faltante, `scope` inválido, o `color` fuera de la matriz.
- **`POST /categories/:id/reactivate`** — reactiva una soft-deleted. Vuelve **exactamente como estaba** (mismo `id`, `name`, `scope`, `color`); lo tipeado en el form de alta **se ignora**. `404` si no existe o no es del usuario; `409` si ya está activa.
- **`PATCH /categories/:id`** — `name`, `scope` y/o **`color`** (editable; debe pertenecer a la matriz, se almacena en mayúsculas; fuera de la matriz es `400`). `409` si el nombre colisiona con otra activa (RN-014). `404` si no existe, no es del usuario o está eliminada.
- **`DELETE /categories/:id`** — soft delete (`deletedAt`). **`204` sin cuerpo. No es idempotente**: borrar una ya eliminada devuelve `404`. También `404` si no existe o no es del usuario.

## Pool de colores (RF-CAT-005)

- **Única fuente:** `backend/src/categories/color-pool.ts`. El frontend la espeja (`docs/frontend/categorias.md` §Paleta de colores).
- **`COLOR_MATRIX` — set elegible (40).** 8 hues × 5 tonalidades (rojo, naranja, oro, verde, teal, azul, violeta, magenta; filas L1 clara → L5 oscura). Lo que el usuario puede elegir.
- **`COLOR_POOL` — pool base de 8.** **Subconjunto explícito** de la matriz (uno por hue, fila vívida) en un **orden propio salteado por la rueda cromática** —no una fila posicional de `COLOR_MATRIX`—, por eso es un **array explícito**:
  `#E23B3B`, `#1AA5B0`, `#E3B92E`, `#8B4FD4`, `#E8863A`, `#3B7DE0`, `#35A65A`, `#D94A9E`.
  Los primeros 4 son los de las categorías por defecto (`docs/backend/base.md` §Categorías por defecto al alta). `AuthService` y `CategoriesService` importan del mismo módulo; no hay colores hardcodeados.
- **Validación: `isValidCategoryColor()` / `normalizeColorHex()`.** El `color` de `POST`/`PATCH` se **normaliza a mayúsculas** y se **valida contra la matriz** en los DTOs vía **`@IsColorInMatrix`**; fuera de la matriz es `400`. Sin hex libre.
- **`assignColor()` — default "menos usado" sobre `COLOR_POOL`.** Sin `color` en el `POST`, se asigna el de `COLOR_POOL` **menos usado** entre las categorías **activas** del usuario; en empate, el **primero en orden de definición**. El menos-usado se calcula **sobre los 8 base**, no sobre los 40. El color no se reasigna al editar.
- **Script de mantenimiento `backend/scripts/reassign-category-colors.ts`** (`pnpm reassign:category-colors`): reasigna el color de **cada** categoría (activas + soft-deleted) por usuario, en orden estable (`createdAt`, `id`), con la misma lógica "menos usado" sobre `COLOR_POOL`. **Dry-run por defecto**; `--execute` aplica, previo **backup JSON** del estado anterior.

## Normalización y unicidad (RN-014)

- Unicidad de nombre entre activas validada en **aplicación, no en la DB** (no hay `@@unique`). Compara con `normalizeName()`: trim + lowercase + NFD + strip de diacríticos (`"comida" = "Comida" = "Cómida"`). El `name` se **almacena tal cual**; la normalización es solo para comparar.

## `ReactivableConflictException` — extensión del exception filter

- **`ReactivableConflictException`** (409) es el único error que adjunta `error.data` estructurado. El Global Exception Filter lleva un campo `data` **opcional** en el sobre de error: solo lo usan los casos reactivables (categorías y métodos de pago). Shape en `docs/data-model/categorias.md` §Payload reactivable en errores (409).

## `CategoryValidatorService` — validador de categoría de movimientos

Vive en `backend/src/categories/`, exportado por `CategoriesModule`. Valida existencia + pertenencia al `userId` + activa + scope (RN-010). Lo **inyectan** `transactions`, `recurring`, `installments` y `simulations`; ninguno reimplementa la lógica. Errores de categoría en movimientos son **`400`** (no `409`) y una categoría ajena no se distingue de una inexistente (`docs/backend/unicos.md` §Validación de categoría). Admite `skipScopeCheck` (calculados y simulaciones).
