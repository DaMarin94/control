# Contrato de configuración del usuario (settings)

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Reglas funcionales: módulo 3.10 (`docs/requirements/multi-moneda.md`, RF-CUR-002/003/006). Decisión "Moneda explícita, set curado": `entidades.md`.

Lectura y escritura de los ajustes de cuenta del usuario autenticado: la **moneda por defecto** y el **último cambio usado**. Alimenta la pantalla `/configuracion` (ver `docs/screens.md`) y el fallback de cotización de los formularios. **JWT requerido** (scope por `userId` del token); `401` global si falta o es inválido.

| Endpoint | Body / Query | Éxito | Errores |
|----------|------|-------|---------|
| `GET /settings` | — | `200` · `data: Settings` | `401` |
| `PATCH /settings` | `{ defaultCurrency?, lastExchangeRate? }` | `200` · `data: Settings` (persistido) | `400` · `401` |
| `GET /settings/reference-rate` | `?month=YYYY-MM&currency=XXX` | `200` · `data: ReferenceRateResponse` | `400` · `401` |

```
Settings = {
  defaultCurrency: "ARS" | "USD" | "EUR" | "BRL",   // moneda en la que se expresan los totales/reportes (default ARS)
  lastExchangeRate: number | null                   // último cambio real ingresado (default por 1 unidad de la otra moneda); null si nunca ingresó una cotización ≠ 1
}
```

- **`GET /settings`** — sin body. Devuelve la moneda default y el último cambio del usuario. `lastExchangeRate` es **`null`** mientras el usuario no haya ingresado una cotización real (el default `1` de los movimientos no lo setea — ver `entidades.md`, "Moneda explícita, set curado").
- **`PATCH /settings`** — body parcial: `defaultCurrency` (una de las 4 monedas) y/o `lastExchangeRate` (número > 0). Devuelve el `Settings` persistido. `400` si algún campo es inválido (moneda fuera del set, cotización ≤ 0).
- **Cambiar `defaultCurrency` no toca ningún movimiento** (RF-CUR-005): solo cambia la moneda en la que `GET /movements` y `GET /movements/reports` sirven los totales convertidos. Es la contraparte de "Conversión = capa de display" (`entidades.md`).

### `GET /settings/reference-rate` — pre-fill de cotización del mes

Devuelve la cotización de referencia a usar como **pre-fill** del campo de cotización del formulario, para un mes y una moneda de movimiento. Query: `month` (`YYYY-MM`) y `currency` (una de las 4 monedas), ambos requeridos.

```
ReferenceRateResponse = {
  currency: "ARS" | "USD" | "EUR" | "BRL",          // la moneda del movimiento pedida
  defaultCurrency: "ARS" | "USD" | "EUR" | "BRL",   // la default vigente del usuario
  yearMonth: "YYYY-MM",                             // el mes pedido
  exchangeRate: number | null                       // unidades de la default por 1 unidad de `currency`, derivado de la tabla del mes
}
```

- **`exchangeRate`** = unidades de la **default** por 1 unidad de `currency`, **derivado del pivote `USD`** sobre las filas `ReferenceRate` del `yearMonth` (ver §Tabla de cotizaciones de referencia). Es **`1`** si `currency == defaultCurrency`; es **`null`** si el mes no tiene dato de referencia para derivar el cruce (el front cae al fallback `lastExchangeRate`).
- **`400`** si `month` o `currency` faltan o son inválidos (formato / fuera del set).

### Tabla de cotizaciones de referencia (`ReferenceRate`)

Tabla **global** (sin `userId`), **interna y no editable por UI**, que guarda una cotización de referencia por `(currency, yearMonth)`. Es **valor por copia, no FK**: solo alimenta el pre-fill de la cotización del movimiento (`GET /settings/reference-rate`) y la conversión de display; el movimiento conserva su propia `exchangeRate` editable.

- **Clave única `(currency, yearMonth)`.** `currency` es una de las 4 monedas; `yearMonth` en formato `"YYYY-MM"`. Global: una sola tabla compartida por todos los usuarios.
- **`rate` (`Decimal`) = unidades de la moneda por 1 `USD`.** El **pivote es `USD`**: cada fila expresa cuántas unidades de esa moneda vale 1 USD en ese mes. **`USD` NO tiene fila** (pivote implícito, `rate = 1`).
- **Derivación de cualquier cruce vía el pivote `USD`.** Para obtener "unidades de A por 1 unidad de B" en un mes, se combinan `rate(A)` y `rate(B)` del mes (con `USD` = 1 implícito). De ahí salen tanto los pares triviales (los que tocan USD) como los no triviales (EUR↔BRL, etc.). Si falta alguna de las filas necesarias del mes → el cruce no se puede derivar → `null`.
- **Sembrada por seed idempotente** (`backend/prisma/seed-reference-rates.ts`): **54 filas** = 3 monedas (ARS, EUR, BRL; USD no lleva fila) × 18 meses (2025-01 … 2026-06). Idempotente (upsert por la clave única). En **producción** se corre con `pnpm seed:rates` (directo, sin gate ni dry-run). En **desarrollo** queda incluido en `pnpm db:seed` (y en `prisma migrate dev`), porque `prisma/seed.ts` invoca `seedReferenceRates`.
- **`ReferenceRate` se alimenta del oficial.** La sincronización externa (`POST /settings/reference-rates/sync`, RF-FX-001) escribe `ReferenceRate.rate` con la cotización **oficial** del mes (ARS oficial de dolarapi; EUR/BRL de Frankfurter). La conversión interna del producto usa **solo** `ReferenceRate`; las **variantes** (blue, etc.) se guardan aparte en `CurrencyQuote` y **no** alimentan la conversión (no hay UI para elegir variante). Ver `cotizaciones.md`.
