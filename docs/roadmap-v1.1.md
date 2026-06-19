# Roadmap de desarrollo — Control v1.1

> Documento de referencia con el orden de construcción de **Control v1.1**, fase por fase, respetando las dependencias reales entre módulos.
>
> **Esta es la continuación de v1.0.** Las Fases 0–7 de v1.0 ya están **completas** y viven en [`roadmap.md`](roadmap.md), que queda como **registro histórico** de la primera versión. Este documento cubre exclusivamente el alcance nuevo de v1.1.
>
> Cada fase equivale a una rama. Cada fase pasa por su propio ciclo **plan → aprobación → delegación** antes de implementar; este roadmap define **qué** se construye y en **qué orden**, no reemplaza ese ciclo.

## Documentos relacionados

- **Roadmap v1.0 (histórico):** `roadmap.md`
- **Requerimientos funcionales:** `requirements.md`
- **Definiciones de pantalla:** `screens.md`
- **Modelo de datos:** `data-model.md`
- **Estándares técnicos:** `technical.md`
- **Lenguaje visual:** `design.md`

---

## Convenciones del roadmap

Las mismas que v1.0:

- **Una rama por fase.** Cada fase trabaja en su propia rama; nunca se commitea directamente a `main`.
- **Backend primero.** Donde una fase toca backend y frontend, el backend va primero para fijar el contrato (DTOs / shapes de respuesta) y luego el frontend lo consume. Donde además participa diseño, el spec visual de `control-design` precede a la implementación de `control-frontend`.
- **Tests en el mismo PR.** Los tests viajan en el mismo PR que el feature que cubren (política de `technical.md`).
- **Docs en el mismo PR.** La documentación (`requirements.md`, `screens.md`, `data-model.md`, `features.md` y lo que aplique) se actualiza junto con el código que la motiva. Donde una fase **reabre una decisión cerrada en v1.0**, la actualización de `requirements.md` / `screens.md` ocurre **al implementar esa fase** (ver más abajo).

---

## Reaperturas de decisiones cerradas en v1.0

Dos fases de v1.1 **reabren explícitamente** decisiones que en v1.0 estaban cerradas en sentido contrario. Se documentan acá como tales para que quede registro de que **`requirements.md` y `screens.md` se actualizarán al implementar cada una de esas fases** (no antes):

- **Color de categoría — reabierto en la fase 1.1.2.** v1.0 lo definía como **no editable**: pool fijo de ~10 colores, auto-asignado por el sistema, sin elección del usuario (RF-CAT-005: "El usuario no puede elegir ni modificar el color en v1"). v1.1 lo reabre: el usuario **elige y edita** el color desde una matriz de colores.
- **Navegación del dashboard — reabierta en la fase 1.1.5.** v1.0 definía el dashboard como **solo mes en curso, sin navegación** (RF-DASH-001: "El dashboard muestra siempre el mes actual — no tiene navegación entre meses"; RF-DASH-002: totales del mes en curso). v1.1 lo reabre: el dashboard pasa a **navegar mes/año** a través del widget de reporte que monta (fase 1.1.5).

---

## Resumen de fases

| Fase | Nombre | Puntos | Rama | Apps | Depende de |
|---|---|---|---|---|---|
| 1.1.0 | Preferencias de usuario (cimiento) | ST1 | `feat/user-preferences` | Back→Front | — |
| 1.1.1 | Fijos extendidos | P1+P2 | `feat/recurring-v2` | Back→Front | — |
| 1.1.2 | Color de categorías | P3 | `feat/category-color` | Back→Front+Design | — |
| 1.1.3 | Navegación con flechas | P4 | `feat/period-nav` | Design→Front | — |
| 1.1.4 | Vista del mes: colapsar/reordenar | P5+P6 | `feat/month-sections` | Front | 1.1.0 |
| 1.1.5 | Reportes configurables | P8 | `feat/reports` | Back→Front+Design | 1.1.0, 1.1.3 |
| 1.1.6 | Filtro por categoría | P9 | `feat/category-filter` | Back→Front | 1.1.0 |
| 1.1.7 | Movimientos calculados | P7 | `feat/computed-movements` | Back→Front+Design | 1.1.1 |

> Los "Puntos" (P1–P9, ST1) refieren a los pendientes registrados en el TODO del `README.md`. Se listan acá solo como trazabilidad del origen de cada fase.

---

## Fase 1.1.0 — Preferencias de usuario (cimiento)

**Objetivo:** introducir un mecanismo de persistencia de preferencias del usuario (ST1) que sobreviva a la navegación y al cierre de sesión. Es el **cimiento** sobre el que se apoyan varias fases posteriores: secciones colapsadas y su orden en la vista del mes (1.1.4), configuración de reportes (1.1.5) y filtros por categoría (1.1.6). Va primero porque esas fases lo consumen.

**Qué hace el backend (`control-backend`):**
- Entidad nueva `UserPreferences`: **una fila por usuario**, con el contenido guardado como **blob JSON estructurado** (no una columna por preferencia). El motivo del blob es poder **sumar nuevas preferencias sin migraciones** de esquema.
- Lectura y escritura de las preferencias del usuario autenticado.
- Las preferencias se **cargan en la sesión de Auth.js al loguear** (se piden una vez al backend en el login) y se **persisten en DB al mutar**.

**Qué hace el frontend (`control-frontend`):**
- Integración con la sesión de Auth.js para exponer las preferencias cargadas al iniciar sesión.
- Mecanismo para mutar una preferencia: actualiza el estado de sesión y persiste en DB.
- En esta fase **no** hay UI de producto que use las preferencias todavía; se entrega el cimiento. Las primeras consumidoras llegan en 1.1.4, 1.1.5 y 1.1.6.

**Pantallas involucradas:** ninguna (cimiento de datos/sesión).

**Rama:** `feat/user-preferences`
**Depende de:** —

---

## Fase 1.1.1 — Fijos extendidos (P1 + P2)

**Objetivo:** extender los movimientos fijos con dos capacidades nuevas: anular un fijo en un mes puntual (P1) y dar al fijo una periodicidad distinta de la mensual (P2). Es independiente del resto de v1.1: no consume preferencias ni reportes.

**P1 — anular un fijo por un mes puntual:**
- Se modela como un **registro aparte `(fijo, mes)`** — un set de meses salteados por fijo. Es **distinto** de `deletedFrom`: `deletedFrom` significa "el fijo deja de existir de acá en adelante"; el skip significa "esta única aparición no cuenta, pero el fijo sigue vivo".
- Es **reversible**: la acción es un **toggle** (anular / des-anular) sobre la aparición del fijo en ese mes.
- La acción se dispara **desde el ítem del fijo en `/mes`**.
- El mes anulado **se sigue mostrando** en la lista, **no suma a los totales** del mes, y tiene **diferenciación visual** (el detalle visual lo define `control-design`).

**P2 — periodicidad:**
- Set **cerrado** de frecuencias: **mensual (default), bimestral, trimestral, semestral, anual**. No hay frecuencias libres ni custom.
- La frecuencia está **anclada al `startMonth`**: un fijo bimestral que arranca en marzo aparece en marzo, mayo, julio, etc.
- **Back-compat:** todos los fijos existentes quedan como **mensual**.
- El **cálculo on-the-fly** de qué fijo cae en cada mes consultado respeta la frecuencia (sigue sin generar filas por instancia, igual que v1.0).
- El skip de P1 anula **una** de las apariciones que dicta la frecuencia.

**Qué hace el backend:**
- Modela el registro de meses salteados `(fijo, mes)` y el atributo de frecuencia sobre el fijo.
- Endpoints / contrato para el toggle de anulación y para crear/editar un fijo con su frecuencia.
- Ajusta el cálculo on-the-fly de fijos por mes para contemplar frecuencia y skips, y para excluir del total los meses anulados.

**Qué hace el frontend:**
- Selector de **frecuencia** en el formulario de carga (tab Fijo), default mensual.
- Acción de **anular / des-anular** sobre el ítem del fijo en `/mes`.
- Renderizado del ítem fijo anulado con su **diferenciación visual** (spec de `control-design`).

**Pantallas involucradas:**
- Formulario de carga de movimiento (modal, tab **Fijo**).
- Vista del mes — `/mes`.

**Rama:** `feat/recurring-v2`
**Depende de:** —

---

## Fase 1.1.2 — Color de categorías (P3)

> **Reabre la decisión de v1.0** (RF-CAT-005: color no editable, pool fijo auto-asignado). `requirements.md` y `screens.md` se actualizan al implementar esta fase.

**Objetivo:** permitir al usuario **elegir y editar** el color de una categoría.

**Definición funcional:**
- El usuario elige el color desde una **matriz de colores tipo Office** — a modo de ejemplo, ~10 colores base × ~7 tonalidades. **Los valores concretos de la paleta y el layout del picker los define `control-design`**, no este roadmap.
- **No** hay entrada de hex libre: solo colores de la matriz.
- El color es **editable** tanto al **crear** como al **editar** la categoría.
- **Default al crear:** el sistema **auto-asigna como valor inicial el color menos usado** (se conserva el espíritu de la asignación automática de v1.0 como punto de partida), pero el usuario **puede cambiarlo**.
- Botón **"aleatorio"**: toma un color **de la matriz** (no un hex arbitrario).

**Qué hace el backend:**
- Acepta y persiste el color elegido al crear y al editar una categoría (en lugar de asignarlo de forma fija e inmutable).
- Mantiene la lógica de "color menos usado" como **default inicial** cuando el usuario no especifica uno.

**Qué hace el frontend + diseño:**
- `control-design` define el spec visual del **picker de matriz** (paleta concreta, layout, comportamiento del botón "aleatorio", presencia en los modos crear/editar).
- `control-frontend` implementa el picker en el modal de crear / editar categoría.

**Pantallas involucradas:**
- Gestión de categorías — `/categorias` (modal de crear / editar categoría).

**Rama:** `feat/category-color`
**Depende de:** —

---

## Fase 1.1.3 — Navegación con flechas (P4)

**Objetivo:** introducir un patrón visual de navegación de período: **flechas gigantes a los costados del contenido** — `‹ contenido ›` — donde la flecha izquierda va al período anterior y la derecha al siguiente.

**Definición funcional:**
- Aplica a **`/mes`** (las flechas cambian el **mes**) y a los **reportes** (cambian el **año**).
- En pantallas grandes, las flechas **aprovechan el padding de los costados** de la pantalla, sin limitarse al ancho del contenedor de contenido.
- El **spec visual** (tamaño, ubicación exacta, comportamiento responsive, jerarquía) lo define `control-design`. Esta es una fase **design-driven**.
- El **dashboard hereda este patrón** a través del widget de reporte que monta en la fase 1.1.5; no se cablea acá por separado.

**Qué hace diseño + frontend:**
- `control-design` define el patrón visual de las flechas de navegación de período.
- `control-frontend` lo implementa sobre `/mes` (navegación de mes) reemplazando / unificando la navegación de período existente, dejando el patrón listo para reutilizar en reportes (1.1.5).

**Pantallas involucradas:**
- Vista del mes — `/mes`.
- (Reportes y dashboard reutilizan el patrón en la fase 1.1.5.)

**Rama:** `feat/period-nav`
**Depende de:** —

---

## Fase 1.1.4 — Vista del mes: colapsar + reordenar (P5 + P6)

**Objetivo:** dar control al usuario sobre la presentación de las tres secciones de `/mes` (Únicos / Fijos / Cuotas): poder **colapsarlas** y **reordenarlas**, persistiendo ambas cosas. **Consume las preferencias de usuario (1.1.0).**

**P5 — colapsar (acordeón):**
- Las tres secciones de `/mes` son **colapsables tipo acordeón** (expandir / colapsar cada una).
- El estado colapsado/expandido se **persiste por usuario** (ST1, vía 1.1.0).

**P6 — reordenar secciones:**
- El usuario puede **reordenar solo las secciones** entre sí mediante **drag**. **No** se reordenan los ítems dentro de cada sección: esos siguen ordenados por **monto descendente**, como en v1.0.
- El orden de las secciones se **persiste** (ST1, vía 1.1.0).
- La **UX del disparador del reordenamiento** — un "modo orden / edición" donde la página entra en estado editable para arrastrar — la define `control-design`.

> **Nota futura (fuera de alcance de v1.1):** un **dashboard personalizable** donde el usuario elija qué se muestra. Queda registrado como idea posterior, no entra en v1.1.

**Qué hace el frontend:**
- Acordeón colapsable de las tres secciones de `/mes`, leyendo/escribiendo el estado en las preferencias (1.1.0).
- Drag-to-reorder de secciones, con persistencia del orden en las preferencias.
- Modo de reordenamiento según el spec de `control-design`.

**Pantallas involucradas:**
- Vista del mes — `/mes`.

**Rama:** `feat/month-sections`
**Depende de:** 1.1.0.

---

## Fase 1.1.5 — Reportes configurables (P8)

**Objetivo:** convertir la pantalla `/anual` de v1.0 en una pantalla de **reportes configurable**, donde el usuario arma su propia vista a partir de cards de reporte. **Consume las preferencias de usuario (1.1.0)** y el **patrón de navegación con flechas (1.1.3)**.

> **Reabre la decisión de v1.0** sobre la navegación del dashboard (RF-DASH-001/002: solo mes en curso, sin navegación). `requirements.md` y `screens.md` se actualizan al implementar esta fase.

**Renombre de la pantalla:**
- `/anual` → **`/reportes`** (ruta + componentes + link del sidebar). El link del sidebar pasa a llamarse **"Reportes"** (en v1.0 era "Anual").

**Pantalla configurable:**
- El usuario **arma su vista** con **cards de reporte** que **agrega** mediante un recuadro **"[+]"** y puede **quitar**.
- La **primera vez**, la pantalla está **vacía** — solo el recuadro "[+]". A medida que el usuario configura, esa configuración **persistida es su pantalla**.

**Tipos de reporte disponibles:**
- Los **2 actuales** de v1.0: **Ingresos vs. Gastos** (Forma 1) y **Gastos por categoría apilado** (Forma 2).
- Sumar nuevos tipos de reporte sería su **propia mini-fase futura** (fuera de alcance de 1.1.5).

**Persistencia y configuración por card (ST1, vía 1.1.0):**
- Cada card persiste: **tipo** + **año** + **categorías seleccionadas** (default: todas).
- La navegación de **año es independiente por card**.

**Widget de reporte autónomo:**
- Las **flechas de navegación de año** (patrón de 1.1.3) y el **check / destildar de categorías** son **parte del propio widget**, no chrome de la página.

**Dashboard:**
- El dashboard monta el widget **Ingresos vs. Gastos** con **navegación de mes/año ACTIVA** — esto **concreta la reapertura** de RF-DASH-001/002.
- En el dashboard, el **check de categorías es efímero**: **no se persiste**; al recargar vuelve a "todas". (A diferencia de las cards de `/reportes`, que sí persisten su selección.)

**Qué hace el backend:**
- Ajusta / extiende la agregación de reportes para soportar la **selección de categorías** por reporte (filtrar qué categorías entran en el gráfico). Se apoya en el endpoint de agregación anual existente de v1.0.

**Qué hace el frontend + diseño:**
- `control-design` define el spec visual de la pantalla configurable, del recuadro "[+]", de las cards y del widget autónomo (flechas + check de categorías embebidos).
- `control-frontend` implementa la pantalla `/reportes`, el alta/baja de cards, la persistencia de su configuración (1.1.0), el widget autónomo, y el montaje del widget en el dashboard con navegación activa y check efímero.

**Pantallas involucradas:**
- Reportes — `/reportes` (renombre de `/anual`).
- Dashboard — `/`.

**Rama:** `feat/reports`
**Depende de:** 1.1.0, 1.1.3.

---

## Fase 1.1.6 — Filtro por categoría (P9)

**Objetivo:** permitir al usuario filtrar la vista de `/mes` por categoría, para ver totales incluyendo o excluyendo ciertas categorías. **Consume las preferencias de usuario (1.1.0).**

**Definición funcional:**
- El filtro vive en **`/mes`**: un control **por pantalla** que define un **set de categorías a mostrar / computar** (default: todas).
- El estado del filtro se **recuerda** vía ST1 (1.1.0).
- **No es un filtro global:** no contamina otras pantallas.

> **Nota de estructura.** El filtro de categorías **dentro de los reportes** **no** se construye acá: viaja con el **widget autónomo** en la fase **1.1.5** (el check/destildar de categorías es parte del widget). La fase 1.1.6 cubre **específicamente** el filtro de `/mes`.

**Qué hace el backend:**
- Soporta filtrar los movimientos / totales del mes por el set de categorías seleccionado.

**Qué hace el frontend:**
- Control de filtro por categoría en `/mes`, con persistencia del set seleccionado en las preferencias (1.1.0), recalculando lista y totales del mes según la selección.

**Pantallas involucradas:**
- Vista del mes — `/mes`.

**Rama:** `feat/category-filter`
**Depende de:** 1.1.0.

---

## Fase 1.1.7 — Movimientos calculados (P7)

**Objetivo:** permitir crear un **movimiento calculado** cuyo monto se deriva, mediante una fórmula, del monto de un movimiento **fijo** de origen, mes a mes y en vivo.

**Definición funcional:**
- **Único punto de creación:** en `/mes`, los ítems **fijos** suman una tercera acción —además de editar y eliminar— **"crear movimiento desde este"**. Es la **única** forma de crear un movimiento calculado; no se elige "calculado" desde el formulario normal. Los movimientos **únicos** y **cuotas** no tienen esta acción.
- **Origen:** siempre un **fijo**. El movimiento **calculado es también un fijo**.
- **Monto derivado por mes y en vivo:** el monto del calculado se obtiene de una **fórmula** aplicada al monto del origen **en ese mes**, y aplica a **todos los meses donde el origen existe**. El vínculo es **vivo**: si el monto del origen cambia (incluida la variación mes a mes propia del modelo de cadena de los fijos de v1.0), el monto del calculado se **recalcula**. **Se descarta** la idea preliminar de "valor congelado": ya **no** es estático.
- **Qué se persiste:** la **fórmula** y el **vínculo al movimiento de origen** (necesarios justamente para poder recalcular cuando el origen cambia).
- **Fórmulas:** operaciones básicas sobre el monto del origen — **+ − × ÷ %**, con un operando/constante.
- **Campos propios del calculado:** tiene su **propio tipo (Gasto/Ingreso), categoría y descripción** (ej.: origen = sueldo/Ingreso, calculado = ahorro/Gasto). Lo único que viene de la fórmula es el **monto**.
- **El calculado sigue el ciclo de vida del origen:** si el origen se **elimina**, el calculado se elimina; si el origen se **anula en un mes** (P1, fase 1.1.1), el calculado se anula ese mes; si cambia la **frecuencia** del origen (P2, fase 1.1.1), el calculado matchea esa presencia. Por esta dependencia, **1.1.7 depende de 1.1.1**.
- **Sin encadenamiento:** un movimiento calculado **no** puede ser origen de otro calculado (solo un fijo "normal" puede ser origen).
- **Varios hijos:** un mismo fijo origen **puede** tener **varios** movimientos calculados derivados.
- **Indicación visual:** en `/mes` debe verse cuándo un movimiento **tiene hijo** o **es hijo de** otro. El spec visual lo define `control-design`.

**Qué hace el backend:**
- Modela el movimiento calculado como un fijo con fórmula + referencia al fijo de origen.
- Recalcula el monto on-the-fly por mes a partir del origen.
- Propaga el ciclo de vida del origen (eliminación, anulación mensual, frecuencia) al calculado.

**Qué hace el frontend + diseño:**
- `control-frontend` implementa la acción "crear movimiento desde este" en los ítems fijos de `/mes` y el formulario del calculado (tipo/categoría/descripción propios + selección de fórmula).
- `control-design` define la indicación visual de la relación padre/hijo.

**Pantallas involucradas:**
- Vista del mes — `/mes`.
- Formulario de carga de movimiento (modal).

**Rama:** `feat/computed-movements`
**Depende de:** 1.1.1.

---

## Criterio del orden

El orden de las fases de v1.1 sigue las dependencias reales y el riesgo de cada una:

- **El cimiento de preferencias (1.1.0) va primero** porque lo **consumen varias fases**: secciones colapsadas/orden (1.1.4), reportes configurables (1.1.5) y filtro por categoría (1.1.6). Construirlo antes evita rehacer esas fases.
- **Fijos extendidos (1.1.1) es independiente** del resto de v1.1 (no consume preferencias ni reportes), así que puede ir en cualquier momento; se ubica temprano por no tener dependencias.
- **Las fases chicas y design-driven (1.1.2 color, 1.1.3 flechas) van en el medio:** son acotadas y, en el caso de las flechas, dejan listo un patrón que reutiliza 1.1.5.
- **Reportes (1.1.5) y filtro (1.1.6) van al final del grueso** por ser las **más grandes** y por depender del cimiento (1.1.0) y del patrón de flechas (1.1.3).
- **Movimientos calculados (1.1.7) van al final** porque **dependen de 1.1.1** (el calculado sigue el ciclo de vida del fijo de origen: anulación mensual de P1 y frecuencia de P2) y son un **agregado sobre los fijos**. Su alcance ya está **definido en firme**; se ubican al final por esa dependencia, no por incertidumbre.

---

## Continuación

v1.1 está **completa**. La continuación del proyecto vive en [`roadmap-v1.2.md`](roadmap-v1.2.md), que cubre los ítems nuevos del TODO del `README.md` (F1, F3, F4 y los dos fixes de 1.1.3 / 1.1.4).
