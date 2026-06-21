# Roadmap de desarrollo — Control v1.2

> Documento de referencia con el orden de construcción de **Control v1.2**, fase por fase, respetando las dependencias reales entre módulos.
>
> **Esta es la continuación de v1.1.** Las Fases 0–7 de v1.0 ([`roadmap.md`](roadmap.md)) y las Fases 1.1.0–1.1.8 de v1.1 ([`roadmap-v1.1.md`](roadmap-v1.1.md)) ya están **completas** y quedan como **registro histórico**. Este documento cubre exclusivamente el alcance nuevo de v1.2.
>
> Cada fase equivale a una rama. Cada fase pasa por su propio ciclo **plan → aprobación → delegación** antes de implementar; este roadmap define **qué** se construye y en **qué orden**, no reemplaza ese ciclo.

## Documentos relacionados

- **Roadmap v1.0 (histórico):** `roadmap.md`
- **Roadmap v1.1 (histórico):** `roadmap-v1.1.md`
- **Requerimientos funcionales:** `requirements.md`
- **Definiciones de pantalla:** `screens.md`
- **Modelo de datos:** `data-model.md`
- **Estándares técnicos:** `technical.md`
- **Lenguaje visual:** `design.md`

---

## Convenciones del roadmap

Las mismas que v1.0 y v1.1:

- **Una rama por fase.** Cada fase trabaja en su propia rama; nunca se commitea directamente a `main`.
- **Backend primero.** Donde una fase toca backend y frontend, el backend va primero para fijar el contrato (DTOs / shapes de respuesta) y luego el frontend lo consume. Donde además participa diseño, el spec visual de `control-design` precede a la implementación de `control-frontend`.
- **Tests en el mismo PR.** Los tests viajan en el mismo PR que el feature que cubren (política de `technical.md`).
- **Docs en el mismo PR.** La documentación (`requirements.md`, `screens.md`, `data-model.md`, `features.md` y lo que aplique) se actualiza junto con el código que la motiva. Donde una fase **reabre una decisión cerrada en una versión previa**, la actualización de `requirements.md` / `screens.md` / `data-model.md` ocurre **al implementar esa fase** (ver más abajo).

---

## Reaperturas de decisiones cerradas

Dos fases de v1.2 **reabren explícitamente** decisiones que estaban cerradas en sentido contrario. Se documentan acá como tales para que quede registro de que **`requirements.md`, `screens.md` y `data-model.md` se actualizarán al implementar cada una de esas fases** (no antes):

- **Filtro por categoría — reabierto en la fase 1.2.1.** v1.1 (RF-VM-006, fase 1.1.6) lo definió **por pantalla**: un único control en `/mes` que define el set de categorías a mostrar/computar para toda la vista. v1.2 lo reabre: el filtro pasa a ser **por listado** (Únicos / Fijos / Cuotas) y se le suma un **filtro de tipo** (Gasto / Ingreso / Ambos) también por listado.
- **Moneda implícita — reabierta en la fase 1.2.3.** El modelo de datos definía la **moneda como implícita en v1, sin campo de moneda**, con todos los montos en **centavos sin moneda asociada**. v1.2 lo reabre: introduce **moneda explícita (ARS/USD)** y **cotización ARS↔USD por movimiento**, y `amountCents` pasa a significar **centavos de la moneda original del movimiento**.
- **Set fijo de monedas — reabierto en la fase 1.2.4.** La 1.2.3 cerró **"set fijo ARS/USD, sin alta de monedas"** y la cotización como "ARS por 1 USD". La fase **1.2.4** reabre esa decisión: el set pasa a un **set curado de 4 (ARS/USD/EUR/BRL)** —sin monedas arbitrarias—, la semántica de la cotización se generaliza a **"unidades de la default por 1 unidad de la moneda del movimiento"** (Opción A) con cruces derivados vía **pivote USD**, y se suma una **tabla de cotizaciones de referencia** (global, interna, no editable) que pre-carga la cotización del movimiento. `requirements.md` / `screens.md` / `data-model.md` se actualizaron al implementar la fase.

---

## Resumen de fases

| Fase | Nombre | Rama | Apps | Depende de |
|---|---|---|---|---|
| 1.2.0 | Fixes de /mes (flechas + reorder) | `fix/month-view-polish` | Design→Front | — |
| 1.2.1 | Filtros por listado | `feat/per-list-filters` | Back→Front | 1.1.0 |
| 1.2.2 | Toggle "por categoría" en reporte | `feat/report-category-toggle` | Front+Design | 1.1.5 |
| 1.2.3 | Multi-moneda ARS/USD + settings | `feat/multi-currency` | Back→Front+Design | 1.1.0 |
| 1.2.4 | Monedas configurables (set curado ARS/USD/EUR/BRL) + tabla de cotizaciones de referencia | `feat/configurable-currencies` | Back→Front+Design | 1.2.3 |

> El "origen" de cada fase refiere a los pendientes del TODO del `README.md` (F1–F4, P3 y los dos fixes de 1.1.3/1.1.4). Se anota como trazabilidad del origen de cada fase.
>
> **Estado:** las fases 1.2.0–1.2.4 están **completas**.

---

## Fase 1.2.0 — Fixes de /mes: flechas + reorder (origen: fix 1.1.3 + fix 1.1.4)

**Objetivo:** pulir dos comportamientos introducidos en v1.1 que quedaron con rebabas: la posición de las flechas de navegación de período y la UX del modo de reordenamiento de secciones de `/mes`.

**Fix de flechas (origen: fix de 1.1.3):**
- Las flechas de navegación de período deben ser **estáticas y centradas en el eje vertical**, sin desplazarse al cambiar el alto del contenido (deben quedar centradas como cuando el listado ocupa todo el alto disponible).
- Aplica a **`/mes`** y a **reportes** (mismo patrón de flechas).

**Fix de reorder (origen: fix de 1.1.4):**
- Al entrar en **modo orden**, **todas las secciones colapsan**.
- El ítem (sección) arrastrado **no flota con el mouse**: solo **sube o baja** dentro de su box, sin despegarse del contenedor.

**Qué hace diseño + frontend:**
- `control-design` ajusta el spec visual de ambos fixes (posición estática/centrada de las flechas y comportamiento del modo orden).
- `control-frontend` implementa ambos ajustes.

**Pantallas involucradas:**
- Vista del mes — `/mes`.
- Reportes — `/reportes` (patrón de flechas).

**Rama:** `fix/month-view-polish`
**Depende de:** —

---

## Fase 1.2.1 — Filtros por listado (origen: F4)

> **Reabre la decisión de v1.1** (RF-VM-006, fase 1.1.6: filtro por categoría **por pantalla**). `requirements.md` y `screens.md` se actualizan al implementar esta fase.

**Objetivo:** dar control de filtrado **por cada listado** de `/mes` (Únicos / Fijos / Cuotas), combinando un filtro de tipo con el filtro de categoría — que deja de ser por pantalla y pasa a ser por listado. **Consume las preferencias de usuario (1.1.0).**

**Definición funcional:**
- **Triple switch Gasto / Ingreso / Ambos**, **por cada listado** (no por pantalla).
- **Filtro por categoría**, también **por cada listado** (set de categorías a mostrar/computar; default: todas).
- El estado de ambos filtros se **persiste por listado** vía las preferencias de usuario (1.1.0).
- **Totales del mes = suma de lo visible** tras aplicar cada filtro en sus tres listados.

**Qué hace el backend:**
- Soporta filtrar movimientos y totales por **tipo** (Gasto/Ingreso/Ambos) y por **set de categorías**, **por sección**.

**Qué hace el frontend:**
- Controles de filtro (triple switch + categorías) **por listado**, con persistencia del estado por listado en las preferencias (1.1.0).
- Recalcula listas y totales del mes según los filtros aplicados en cada listado.

**Pantallas involucradas:**
- Vista del mes — `/mes`.

**Rama:** `feat/per-list-filters`
**Depende de:** 1.1.0.

---

## Fase 1.2.2 — Toggle "por categoría" en reporte (origen: F3)

**Objetivo:** sumar a la card **Ingresos vs. Gastos** un modo que muestre los datos **desglosados por categoría**, sin agregar un tipo de reporte nuevo. **Consume los reportes configurables (1.1.5).**

**Definición funcional:**
- **Toggle** sobre la card **Ingresos vs. Gastos** para alternar entre la vista actual y una vista **desglosada por categoría**.
- Reusa los datos que el endpoint de reportes **ya devuelve** (`months` + `categories`). **No hay desglose de ingresos por categoría** → en principio **sin cambio de contrato** (se confirma al planificar la fase).
- El **modo elegido se persiste** en la config de la card (vía la persistencia de configuración de cards de 1.1.5 / preferencias 1.1.0).

**Qué hace el frontend + diseño:**
- `control-design` define la presentación del toggle y de la vista por categoría dentro de la card.
- `control-frontend` implementa el toggle, la vista por categoría y la persistencia del modo en la config de la card.

**Pantallas involucradas:**
- Reportes — `/reportes`.
- Dashboard — `/` (si monta la card Ingresos vs. Gastos).

**Rama:** `feat/report-category-toggle`
**Depende de:** 1.1.5.

---

## Fase 1.2.3 — Multi-moneda ARS/USD + settings (origen: F1)

> **Reabre la decisión de modelo de datos** (moneda implícita en v1, sin campo de moneda; `amountCents` sin moneda asociada). `requirements.md`, `screens.md` y `data-model.md` se actualizan al implementar esta fase.

**Objetivo:** permitir cargar cada movimiento en una **moneda particular** con una **cotización particular**, sumando siempre los totales en una **única moneda default** del usuario. Es la fase **más grande** de v1.2: toca el modelo de datos y agrega una capa de conversión a totales y reportes.

**Set de monedas y configuración:**
- Set **fijo ARS / USD** (no hay alta de monedas arbitrarias).
- Nueva sección **`/configuracion`** (link nuevo en el sidebar) que arranca con **solo** la **moneda por defecto del usuario**, como contenedor para ajustes futuros.

**Modelo de datos (decisión cerrada — "Opción A"):**
- Cada movimiento guarda: **monto en centavos de su moneda original** + la **moneda** + una **cotización ARS↔USD** (con decimales, no centavos).
- En el movimiento cargado en la **moneda default**, la cotización viene **pre-cargada con el último cambio usado** y es **editable**.
- `amountCents` pasa a significar **centavos de la moneda original del movimiento** (ver reapertura arriba).

**Granularidad de la cotización:**
- **Únicos:** cotización **por movimiento**.
- **Fijos:** cotización **por mes de aparición**, editable mes a mes (entra al modelo de cadena de los fijos).
- **Calculados:** **heredan** moneda y cotización del **origen**.

**Conversión y back-compat:**
- **Conversión 100% visual y en vivo:** los totales de `/mes` y de reportes se computan en la **moneda default vigente**; cambiar la moneda default **nunca** toca lo guardado.
- **Back-compat:** todos los movimientos existentes quedan en **ARS**.

**Visualización:**
- El ítem de `/mes` muestra el **monto original + moneda**, además del **valor convertido** que entra a los totales.

**Qué hace el backend (primero):**
- Modela moneda + cotización por movimiento (Opción A), con la granularidad por tipo (únicos / fijos por mes / calculados heredan).
- Agregación de totales y reportes con **conversión** a la moneda default vigente.
- Persiste la **moneda por defecto** del usuario y el **último cambio usado** para pre-cargarlo.

**Qué hace el frontend + diseño (después):**
- `control-design` define el spec de **`/configuracion`** y de la **presentación de moneda/cotización** en formularios e ítems.
- `control-frontend` implementa `/configuracion` (moneda default), el selector de moneda + campo de cotización en los formularios (con pre-carga editable del último cambio), y la visualización de monto original + convertido en `/mes`.

**Pantallas involucradas:**
- Configuración — `/configuracion` (nueva).
- Vista del mes — `/mes`.
- Reportes — `/reportes`.
- Formulario de carga de movimiento (modal).

**Rama:** `feat/multi-currency`
**Depende de:** 1.1.0.

---

## Fase 1.2.4 — Monedas configurables (set curado ARS/USD/EUR/BRL) + tabla de cotizaciones de referencia (origen: P3)

> **Estado: completa.** **Reabre la decisión cerrada en la 1.2.3** ("set fijo ARS/USD, sin alta de monedas"). `requirements.md`, `screens.md` y `data-model.md` se actualizaron al implementar la fase.

**Origen:** pedido del usuario durante la 1.2.3; se relaciona con el ítem **P3** del TODO del `README.md` (reportes con cambio de moneda por card).

**Objetivo:** pasar del **set fijo ARS/USD** a un **set curado de monedas**, con una **tabla de cotizaciones de referencia por mes** que sirve de **valor por defecto (copia, no FK)** para la cotización de cada movimiento.

**Decisiones cerradas:**
- **Set curado de 4 monedas — `ARS`, `USD`, `EUR`, `BRL`** (se sumaron `EUR` y `BRL` a 1.2.3). **No** hay alta de monedas arbitrarias por el usuario; `Currency` sigue siendo un enum cerrado.
- **Pivote `USD`.** La conversión se generaliza: cada cotización es "unidades de la default por 1 unidad de la moneda del movimiento" y los cruces no triviales (EUR↔BRL, etc.) se **derivan vía el pivote USD**, no se guardan pares.
- **Tabla de cotizaciones de referencia: global, interna, NO editable por UI.** `(moneda, mes)`, `rate` = unidades de la moneda por 1 USD; **USD sin fila** (pivote implícito = 1). Es **valor por copia, no FK**: pre-carga la cotización del movimiento, que sigue editable.
- **Semántica per-movimiento = Opción A.** `exchangeRate` = "unidades de la default por 1 unidad de la moneda del movimiento" — preserva la UX de 1.2.3 y es back-compat perfecto.
- **Cotización manual, sin APIs externas** (rige la decisión v1): la tabla de referencia se siembra por seed; no se inventan cotizaciones en runtime.

**Relación con la 1.2.3:** la conversión sigue siendo **capa de display** (no toca lo guardado). El **pre-fill** del campo de cotización pasó a servirse desde la **tabla de referencia del mes** (`GET /settings/reference-rate`); `lastExchangeRate` quedó como **fallback** cuando la tabla no tiene dato.

**Lo construido:**
- **Backend:** modelo `ReferenceRate` global `(currency, yearMonth)` + seed idempotente (`seed-reference-rates.ts`, 54 filas; `pnpm seed:rates` en prod, incluido en `pnpm db:seed` en dev); enum `Currency` a 4; `defaultCurrency` / `currency` a 4 en settings y DTOs; endpoint `GET /settings/reference-rate?month&currency` (deriva el cruce vía pivote USD; `null` si no hay dato). Contrato en `data-model.md`.
- **Frontend + diseño:** selector de 4 monedas en `/configuracion` y en los formularios; bloque de cotización con label `{moneda}→{default}`, oculto cuando la moneda coincide con la default; copy "Cotización de referencia del mes"; pre-fill vía `useReferenceRate` con fallback a `lastExchangeRate`.

**Pantallas involucradas:**
- Configuración — `/configuracion`.
- Vista del mes — `/mes`.
- Formulario de carga de movimiento (modal).

**Rama:** `feat/configurable-currencies`
**Depende de:** 1.2.3.

---

## Criterio del orden

El orden de las fases de v1.2 sigue el criterio aprobado **chico → grande**, respetando dependencias y riesgo:

- **Los fixes (1.2.0) van primero:** son chicos, **sin dependencias**, y dan valor inmediato sobre comportamientos que ya están en producción.
- **Filtros por listado (1.2.1) y toggle de reporte (1.2.2) van a continuación:** features acotados que se apoyan en cimientos ya existentes — preferencias de usuario (1.1.0) y reportes configurables (1.1.5) — sin tocar el modelo de datos.
- **Multi-moneda (1.2.3) va al final de lo implementado** por ser la **más grande y riesgosa**: toca el modelo de datos y agrega una capa de conversión a totales y reportes. Al ser conversión de **capa de display**, el rework sobre 1.2.1/1.2.2 queda **acotado** (los filtros y el toggle operan sobre datos ya convertidos a la moneda default vigente).
- **Monedas configurables (1.2.4) cierra v1.2:** es una **expansión** de la 1.2.3 que **reabre** su decisión de set fijo. Se cerró sobre un **set curado de 4** (no monedas arbitrarias), acotando su tamaño, y reusó la capa de display de 1.2.3 generalizando la cotización a la Opción A con pivote USD.
- **F2 (convención de _ordering_ en query params del API, del TODO) queda diferido, fuera de v1.2:** sigue **sin haber un listado** paginado o grande que lo justifique; se diseñará cuando aparezca el primer listado que lo amerite.
