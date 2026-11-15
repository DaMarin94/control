# 3.10 Módulo: Multi-moneda

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Modelo de datos: `docs/data-model/entidades.md` (moneda explícita, set curado) y `docs/data-model/settings.md` (contrato de settings y tabla de cotizaciones de referencia).

La moneda es **explícita**: cada movimiento lleva su **moneda + cotización**; los totales se expresan en una **única moneda default** del usuario, convertida en vivo. La cotización del movimiento se **pre-carga desde una tabla de cotizaciones de referencia** (interna, no editable por UI).

El alcance es un **set curado de 4 monedas (ARS / USD / EUR / BRL)**, sin alta de monedas arbitrarias por el usuario. La conversión es **100% de display**: cambiar la moneda default re-expresa los totales sin tocar ningún dato guardado. La **cotización es manual y por movimiento**: la tabla de referencia solo pre-carga un valor inicial editable, nunca reescribe lo guardado.

---

## RF-CUR-001 — Moneda y cotización por movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | Cada movimiento (único, fijo, cuota) se carga en una **moneda** de un **set curado de 4 (ARS / USD / EUR / BRL)** y lleva una **cotización** = unidades de la moneda default del usuario por 1 unidad de la moneda del movimiento. El monto se ingresa y se guarda en **centavos de la moneda original** del movimiento. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Flujo principal:**
1. En el formulario de carga, debajo del monto, el usuario elige la **moneda** (ARS / USD / EUR / BRL) y, si corresponde, la **cotización**.
2. La cotización viene **pre-cargada** con la **cotización de referencia del mes** (RF-CUR-003) y es **editable**.
3. El usuario confirma; el sistema guarda monto (centavos de la moneda original), moneda y cotización.

**Criterios de aceptación:**
- [ ] El set de monedas es un **set curado de 4: ARS, USD, EUR, BRL**. No hay alta de monedas arbitrarias por el usuario.
- [ ] El monto se guarda en **centavos de la moneda original** del movimiento (no convertido).
- [ ] La cotización son **unidades de la default por 1 unidad de la moneda del movimiento**, con decimales (no centavos), y debe ser **> 0** (validación; ver RF-CUR-005 / `docs/data-model/entidades.md`). Para un movimiento cuya moneda coincide con la default, la cotización es `1` y el bloque puede ocultarse.
- [ ] El campo de cotización es **editable**; los cruces no triviales (p. ej. EUR con default BRL) se derivan vía el pivote USD para el pre-fill, pero el valor guardado es el que confirma el usuario.
- [ ] La presentación del bloque moneda/cotización en el formulario está en `docs/screens.md` §Formulario y `docs/design/moneda.md`.

**Notas:**
- La cotización solo es **semánticamente necesaria** cuando la moneda del movimiento difiere de la default; cuando coinciden, el bloque se **oculta** y la cotización es `1`. El label del par en el formulario es `{moneda del movimiento}→{default}`. Presentación en `docs/screens.md` §Formulario.

---

## RF-CUR-002 — Moneda por defecto del usuario

| Campo | Detalle |
|---|---|
| **Descripción** | Cada usuario tiene una **moneda por defecto** (una del set curado, default ARS) configurable en `/configuracion`. Es la moneda en la que se expresan los **totales** de `/mes`, del dashboard y de los reportes. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] La moneda default se configura en la pantalla **`/configuracion`** (ver `docs/screens.md`), eligiendo entre las **4 monedas curadas (ARS / USD / EUR / BRL)** y arrancando en **ARS** para todo usuario.
- [ ] Todos los **totales** (gastos / ingresos / balance del mes, series de reportes) se muestran **en la moneda default vigente**.
- [ ] Cambiar la moneda default **no modifica ningún movimiento guardado** (RF-CUR-005): solo re-expresa los totales (conversión de display, en vivo).
- [ ] Contrato de lectura/escritura en `docs/data-model/settings.md`.

---

## RF-CUR-003 — Pre-carga editable de la cotización de referencia del mes

| Campo | Detalle |
|---|---|
| **Descripción** | El campo de cotización del formulario arranca **pre-cargado** con la **cotización de referencia del mes** del movimiento (derivada de la tabla de referencia, RF-CUR-006), donde el usuario puede aceptarla o editarla. Si la tabla no tiene dato para ese mes/moneda, cae al último cambio usado (`lastExchangeRate`). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Criterios de aceptación:**
- [ ] El campo de cotización arranca **pre-cargado** con la cotización de referencia del mes (vía `GET /settings/reference-rate`; ver `docs/data-model/settings.md`).
- [ ] La granularidad del mes que pide el pre-fill sigue la del tipo (RF-CUR-004): en fijos el mes de aparición, en cuotas el `startMonth` del grupo, en únicos el mes del movimiento.
- [ ] Si la tabla de referencia no tiene dato (`exchangeRate: null`), se usa como **fallback** el último cambio real del usuario (`lastExchangeRate`; ≠ el default `1` — ver `docs/data-model/settings.md`).
- [ ] El copy de la nota del campo es **"Cotización de referencia del mes"**.
- [ ] El valor pre-cargado es **editable** en cada carga.

---

## RF-CUR-004 — Granularidad de la cotización por tipo de movimiento

| Campo | Detalle |
|---|---|
| **Descripción** | La cotización tiene distinta granularidad según el tipo de movimiento: por movimiento en únicos, por mes de aparición en fijos, por grupo en cuotas; los calculados la heredan del origen. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | — |

**Granularidad:**
- **Únicos:** una cotización **por movimiento**.
- **Fijos:** una cotización **por mes de aparición**, editable mes a mes; editar la cotización de un mes en adelante usa la **misma mecánica de split del pasado** que cualquier edición de fijo (RN-005), preservando los meses ya corridos.
- **Cuotas:** **una** cotización por **grupo** (todas las cuotas comparten la del grupo).
- **Calculados:** **heredan** moneda y cotización del **origen** —no se eligen ni se persisten propias—; se derivan al vuelo junto con el monto.

**Criterios de aceptación:**
- [ ] Cada único guarda su propia cotización; cada grupo de cuotas, una sola para todo el grupo.
- [ ] Un fijo puede tener cotizaciones distintas en meses distintos; cambiarla mes-en-adelante no toca los meses pasados.
- [ ] Un calculado muestra y computa con la moneda y cotización **de su origen** en el mes; no expone campos de moneda/cotización propios.
- [ ] Modelado de la granularidad en `docs/data-model/entidades.md` (decisión de moneda explícita).

---

## RF-CUR-005 — Conversión a la moneda default (capa de display, en vivo)

| Campo | Detalle |
|---|---|
| **Descripción** | Los totales y reportes se computan convirtiendo cada movimiento desde su moneda original (con su cotización) a la **moneda default vigente** del usuario. La conversión es **100% visual y en vivo**: nunca reescribe lo guardado. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | — |

**Criterios de aceptación:**
- [ ] Los totales de `/mes`, del dashboard y las series de reportes se expresan en la **moneda default vigente**, convirtiendo cada movimiento con su cotización.
- [ ] Cambiar la moneda default **re-expresa** los totales al instante, **sin** modificar ningún movimiento (monto, moneda ni cotización originales quedan intactos).
- [ ] El ítem de `/mes` muestra el **monto original + moneda** y el **valor convertido** que entra a los totales (ver `docs/screens.md` §Vista del mes y `docs/design/moneda.md`).
- [ ] Un movimiento en la moneda default (ARS por defecto) lleva cotización `1`: un usuario que nunca cambió la moneda opera todo en ARS.
- [ ] Los endpoints sirven los totales/series **ya convertidos** (`convertedAmountCents`); contrato en `docs/data-model/movimientos.md` (movimientos del mes) y `docs/data-model/informes.md` (serie de reportes).

---

## RF-CUR-006 — Tabla de cotizaciones de referencia (interna, no editable)

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema mantiene una **tabla de cotizaciones de referencia** por `(moneda, mes)`, **global** (compartida por todos los usuarios), **interna y no editable por la UI**. Sirve de **valor por defecto (copia, no FK)** para pre-cargar la cotización de cada movimiento según su mes (RF-CUR-003); el movimiento conserva su cotización propia y editable. |
| **Actor** | Sistema |
| **Prioridad** | Media |
| **Precondiciones** | — |

**Criterios de aceptación:**
- [ ] La tabla es **global** (no por usuario) e **interna**: **no hay UI** para crear, editar ni ver sus valores. `/configuracion` no la expone para edición (RF-CUR-002; la consulta de solo lectura de los datos externos es RF-SYNC-002).
- [ ] El **pivote es USD**: cada valor expresa unidades de la moneda por 1 USD; **USD no tiene fila** (pivote implícito = 1). Cualquier cruce entre monedas se **deriva vía USD** (p. ej. EUR↔BRL).
- [ ] El pre-fill del formulario consume esta tabla vía `GET /settings/reference-rate?month&currency`, que devuelve la cotización **unidades de la default por 1 unidad de la moneda del movimiento**, o `null` si el mes/moneda no tiene dato (RF-CUR-003 cae al fallback).
- [ ] La tabla es **valor por copia**: pre-carga, no vincula. Cambiar un valor de referencia (p. ej. por una sincronización, módulo 3.12) **no** reescribe la cotización de ningún movimiento ya guardado.
- [ ] Modelado, clave única, seed y contrato del endpoint en `docs/data-model/settings.md`.
