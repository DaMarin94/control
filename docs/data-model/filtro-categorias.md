# Filtro de categorías — query param `categories` y filtros de la Vista del mes

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Mecanismo de preferencias (blob, `PUT /preferences`): `preferencias.md`.

## Query param `categories`

> Destino canónico del contrato del param `categories`. Lo consumen **`GET /movements/reports?year=YYYY`** (filtro de reportes, RF-REP-002), **`GET /movements/reports/annual-unicos?year=YYYY`** (filtro de la grilla anual de Únicos, RF-REP-010), **`GET /movements/reports/annual-cuotas?year=YYYY`** (filtro del gantt anual de Cuotas, RF-REP-011) y **`GET /movements/reports/annual-inflation-income?year=YYYY`** (filtro del reporte de Inflación vs Ingresos, RF-REP-012), con la misma semántica de tres estados. `GET /movements?month=YYYY-MM` lo **acepta** también, pero **`/mes` no lo envía**: el filtro de la Vista del mes vive en el frontend (filtros por listado, RF-VM-006; ver §Preferencia `monthListFilters`).

El param distingue **tres estados** —y, en particular, distingue **"ausente" de "presente y vacío"**:

| Estado | URL | Resultado |
|---|---|---|
| **Todas** (default) | `categories` **ausente** | sin filtro |
| **Ninguna** | `categories=` (**presente, vacío**) | resultado vacío: listas vacías + totales/serie en **cero** |
| **Subconjunto** | `categories=id1,id2` (comas **sin URL-encode**) | solo esas categorías |

- El filtro afecta **gastos e ingresos** (ambos tienen categoría).
- Con **"todas"** (ausente) se incluyen movimientos cuya categoría está **soft-deleted** (RF-CAT-004). Con **subconjunto**, solo entran los `id`s del set.
- En reportes, **`earliestYear` ignora el filtro siempre** y **`yearRange` siempre lo respeta** (ver `informes.md`, §Contrato de serie de reportes y §Rango de años navegable).
- Front: los tres estados derivan de la preferencia/`categoryIds` correspondiente — **`null`/ausente → omitir el param**, **`[]` → `categories=`**, **lista → `categories=id1,id2`**. La coma va **literal** (no `URLSearchParams`).

### Preferencia `monthListFilters` — filtros por listado de la Vista del mes (RF-VM-006)

> **Destino canónico** del contrato de los filtros de `/mes`. Clave del blob `UserPreferences` (ver `preferencias.md`). El filtro es **uno por sección**, con dos controles propios por sección (tipo + categoría). Persiste **por pantalla** (no por mes). El filtrado de `/mes` ocurre **100% en el frontend**.

```
monthListFilters: {
  unicos: { type: "ALL" | "EXPENSE" | "INCOME", categories: string[] | null },
  fijos:  { type: "ALL" | "EXPENSE" | "INCOME", categories: string[] | null },
  cuotas: { type: "ALL" | "EXPENSE" | "INCOME", categories: string[] | null }
}
```

- **`type`** — filtro de tipo de la sección: `"ALL"` (Ambos, default) / `"EXPENSE"` (Gasto) / `"INCOME"` (Ingreso).
- **`categories`** — filtro de categoría de la sección, con la **misma semántica de 3 estados** que el resto del proyecto: **`null` = todas** (default, sin filtro), **`[]` = ninguna** (sección vacía), **lista = subconjunto** de `categoryId`s.
- **Default por sección:** `{ type: "ALL", categories: null }`.
- **Normalización** (igual que `monthSections`): si `monthListFilters` **no existe** → default por sección; si falta una sección o trae claves/valores raros → se completa/normaliza esa sección al default.
- Es **independiente** del filtro de reportes (clave `reports`) y del filtro efímero del dashboard.
- El back no valida ni conoce esta clave (`preferencias.md`).

### Preferencia `monthCategoryFilter` — filtro de la Vista del mes (RF-VM-006) — **DEPRECADA**

> Deprecada. Se conserva en el tipo, pero **`/mes` no la lee ni la escribe** y su valor **no se migra** a `monthListFilters` (que arranca con su default).

```
monthCategoryFilter: string[] | null
```

- **`null` / ausente = todas**. **`[]` = ninguna**. **lista = subconjunto** de `categoryId`s (mismos tres estados que el param `categories`).
