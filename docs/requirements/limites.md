# 3.13 Módulo: Límites

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Shape de la clave `limits`: `docs/data-model/preferencias.md`, §`limits`. Catálogo de efectos visuales y su mapeo por anclaje en `docs/design/limites.md`; arquitectura en `docs/frontend/limites.md`.

El usuario configura **límites** sobre datos de la Vista del mes (`/mes`), del dashboard y de los reportes. Se gestionan desde la solapa **Límites** de `/configuracion` (pantalla 9 de `docs/screens.md`). Persisten por usuario en el blob de preferencias (clave `limits`); el backend la trata como blob opaco (igual que `theme` / `reports`). Evaluación 100% client-side.

Un **límite** observa un dato (identificado por una **key** de un catálogo hardcodeado), lo compara contra un umbral y, si la condición se cumple, dispara un efecto de una de **dos naturalezas**:

- **Marca visual pasiva** (RF-LIM-003) — al renderizar, resalta el dato cuando cruza el umbral. Read-path; sobre datos ya en pantalla. No altera montos, totales ni ningún dato guardado.
- **Alerta activa** (RF-LIM-004) — al guardar un movimiento, si el resultado proyectado cruzaría el umbral, un aviso **no bloqueante** de confirmación. Write-path; proyecta el estado post-movimiento.

**Alcance por naturaleza:** la marca pasiva cubre **todas** las superficies cableadas — la Vista del mes (`/mes`), el dashboard y los 5 reportes de `/reportes` (keys en RF-LIM-003). La alerta activa se acota a las **7 keys de nivel mes** (`mes.*`), las únicas que un movimiento que se está por guardar modifica en el acto (RF-LIM-004).

Además, un **popover informativo de solo lectura** (RF-LIM-005) lista, por superficie, qué límites la observan. No marca ni avisa — informa; es una pieza independiente de las dos naturalezas.

---

## RF-LIM-001 — Anatomía de un límite

| Campo | Detalle |
|---|---|
| **Descripción** | Un límite es una **condición única** sobre un dato: `dato {operador} umbral`. Al cumplirse dispara su efecto según la naturaleza: una **marca visual** (pasiva, RF-LIM-003) o una **alerta al guardar** (activa, RF-LIM-004). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Composición de un límite:**
- **Anclaje (key):** el dato que observa, elegido de un catálogo hardcodeado de keys (el "lenguaje común" entre los datos que las emiten y la config que las consume). Las keys cableadas abarcan las superficies de `/mes`, dashboard y reportes (ver RF-LIM-003).
- **Naturaleza:** `pasiva` (marca visual) o `activa` (alerta al guardar). La activa solo es elegible sobre las 7 keys `mes.*` (RF-LIM-004); las de dashboard/reportes solo admiten pasiva.
- **Refinamiento (condicional):** algunas keys acotan a una **sección** de `/mes` (Únicos / Fijos / Cuotas) o a una **categoría**. La key de sección exige sección; la de categoría-del-mes exige categoría; la de monto de ítem admite categoría **opcional** (ausente = cualquier ítem).
- **Operador:** uno de `mayor que` / `mayor o igual` / `menor que` / `menor o igual` / `igual a`. En la naturaleza **activa** se restringe por la polaridad del anclaje (RF-LIM-004).
- **Umbral:** un **número puro, sin moneda**. La app es equivalente en cuanto a monedas; no se modela moneda en el umbral ni hay conversión en la evaluación. Su tipo (monto / porcentaje / entero) lo fija la unidad de la key.
- **Alcance temporal** *(solo pasiva)*: `todos los meses` (default) marca cualquier mes navegado que cruce el umbral; `mes en curso` marca solo el mes real de hoy. **No aplica a la activa** (siempre proyecta sobre el mes destino del movimiento, RF-LIM-004).
- **Efecto** *(solo pasiva)*: el estilo visual de la marca, elegido de un subset válido según el anclaje (catálogo de efectos en `docs/design.md`). La activa no lleva efecto (avisa, no marca).
- **Nombre (opcional):** rótulo del usuario; ausente = placeholder derivado de la key + la condición.
- **Estado (`enabled`):** activo / inactivo sin borrar la regla.

**Criterios de aceptación:**
- [ ] Un límite es exactamente **una** condición `dato {operador} umbral`. No hay condiciones compuestas (AND/OR) ni umbrales escalonados; un efecto escalonado se arma con **varios límites** sobre la misma key con distinto umbral/efecto.
- [ ] El umbral es un **número puro**: no lleva moneda y se compara directo contra el número del anclaje en la unidad de la key.
- [ ] El límite es **semántico, no atado a un widget**: se vincula a la key (+ refinamiento), no a una instancia concreta; alcanza todo anclaje que emita esa key.
- [ ] La naturaleza es **pasiva** (marca visual, no altera dato/total/movimiento) o **activa** (aviso no bloqueante al guardar, no altera lo que persiste el usuario).

---

## RF-LIM-002 — Gestión de límites (panel de Configuración)

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario administra sus límites desde la solapa **Límites** de `/configuracion`: los lista, crea, elimina y activa/desactiva. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Operaciones:**
- **Crear** — un formulario progresivo: elegir la key → (si aplica) refinamiento → **naturaleza** (pasiva / activa) → operador + umbral → *(rama pasiva)* alcance temporal + efecto → nombre opcional. La rama **activa** omite el alcance temporal y el efecto.
- **Eliminar** — quita el límite, con confirmación inline.
- **Activar / desactivar** — toggle `enabled` sin borrar la regla.

**Criterios de aceptación:**
- [ ] La solapa Límites lista todos los límites del usuario con su nombre (o placeholder derivado), la key legible, su naturaleza (pasiva/activa), su condición (operador + umbral), el switch `enabled` y —solo en pasiva— un preview del efecto.
- [ ] Crear un límite se hace desde un modal con formulario progresivo; el picker de key ofrece las keys cableadas de **todas** las superficies (`/mes`, dashboard y reportes, RF-LIM-003), agrupadas por superficie con rótulos legibles.
- [ ] El selector de **naturaleza** habilita **activa solo** para las 7 keys `mes.*`; para keys de dashboard/reportes solo ofrece pasiva.
- [ ] En la rama **pasiva** el picker de efecto ofrece **solo el subset válido** del anclaje elegido (con preview) y se pide el alcance temporal; en la rama **activa** ambos se **omiten** y los operadores se restringen por la polaridad del anclaje (RF-LIM-004).
- [ ] El **signo válido del umbral depende de la unidad** del dato observado (catálogo `lib/limits/catalog.ts`): las unidades `money` y `count` exigen umbral **positivo** (`money` > 0; `count` entero ≥ 1); `signed-money` (Balance) y `percent` **admiten valores negativos** (son magnitudes con signo). El panel **bloquea el submit** y avisa en el campo cuando el umbral viola la regla de su unidad.
- [ ] **No se edita** un límite existente: para cambiarlo se elimina y se crea de nuevo (el toggle `enabled` permite desactivar sin borrar).
- [ ] Eliminar pide confirmación inline antes de quitar el límite.
- [ ] Cada cambio persiste el blob completo vía `PUT /preferences` (`{ ...preferences, limits: [...] }`), semántica de reemplazo total.

---

## RF-LIM-003 — Marca visual pasiva (todas las superficies)

| Campo | Detalle |
|---|---|
| **Descripción** | Al renderizar cualquier superficie cableada (`/mes`, dashboard, reportes), cada dato que emite una key evalúa los límites que la referencian; si un límite habilitado cruza el umbral, el dato recibe su marca visual. |
| **Actor** | Sistema |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene al menos un límite habilitado sobre una key cableada. |

**Anclajes cableados de `/mes`:**

| Key | Dato | Refinamiento |
|---|---|---|
| `mes.total.gasto` | Total de gastos del mes | — |
| `mes.total.ingreso` | Total de ingresos del mes | — |
| `mes.balance` | Balance del mes (ingresos − gastos) | — |
| `mes.seccion.subtotal` | Subtotal de una sección | sección (obligatorio) |
| `mes.seccion.conteo` | Cantidad de ítems de una sección | sección (obligatorio) |
| `mes.item.monto` | Monto de una línea de movimiento | categoría (opcional) |
| `mes.categoria.gastoMes` | Total gastado en una categoría en el mes (derivado) | categoría (obligatorio) |

**Anclajes cableados del dashboard:** el resumen mensual reutiliza las keys `mes.total.gasto` / `mes.total.ingreso` / `mes.balance` (mes en curso); el widget efímero Ingresos vs. Gastos emite las keys `reporte.ie.*` de la tabla siguiente. El dashboard no tiene keys propias.

**Anclajes cableados de los 5 reportes de `/reportes`:**

| Superficie | Key | Dato | Refinamiento |
|---|---|---|---|
| Ingresos vs Gastos | `reporte.ie.gastoMes` | Gasto de un mes (serie anual) | — |
| Ingresos vs Gastos | `reporte.ie.ingresoMes` | Ingreso de un mes (serie anual) | — |
| Gastos por categoría | `reporte.cat.gastoMesCategoria` | Gasto de una categoría en un mes | categoría (obligatorio) |
| Gastos por categoría | `reporte.cat.gastoMesTotal` | Total de gasto apilado del mes | — |
| Gastos Únicos | `reporte.unicos.celda` | Gasto Único de un día (celda) | — |
| Gastos Únicos | `reporte.unicos.mesTotal` | Total mensual de Únicos (footer) | — |
| Gastos Únicos | `reporte.unicos.promedioDiario` | Promedio diario del mes (footer) | — |
| Gastos Únicos | `reporte.unicos.pctVsPrev` | % de diferencia vs. mes anterior (footer) | — |
| Gastos Únicos | `reporte.unicos.inflacionMes` | Inflación IPC del mes (footer) | — |
| Gastos Únicos | `reporte.unicos.pctVsPrevAjustado` | % vs. mes anterior ajustado por inflación (footer) | — |
| Gastos en Cuotas | `reporte.cuotas.montoPorCuota` | Monto por cuota de una compra (barra) | — |
| Gastos en Cuotas | `reporte.cuotas.cantidadCuotas` | Cantidad total de cuotas del plan (barra) | — |
| Inflación vs Ingresos | `reporte.infl.inflacionMes` | Inflación IPC del mes (serie) | — |
| Inflación vs Ingresos | `reporte.infl.ingresoVarMes` | Variación % mensual del ingreso nominal (serie) | — |
| Inflación vs Ingresos | `reporte.infl.ingresoVarAjustado` | Variación % mensual del ingreso ajustada por inflación (serie) | — |

**Criterios de aceptación:**
- [ ] Un dato cruza el umbral → recibe la marca del efecto configurado; si no cruza, no cambia.
- [ ] `mes.categoria.gastoMes` es un **dato derivado** (no hay número propio renderizado): el front lo calcula y marca cada fila de la categoría cruzada.
- [ ] Un dato observado por **varios límites** que cruzan a la vez muestra **una sola marca** (la más fuerte); la descripción accesible enumera todos los límites cruzados.
- [ ] El **alcance temporal** filtra la marca: `mes en curso` solo marca el mes real de hoy; `todos los meses` marca cualquier mes navegado.
- [ ] **Cero impacto con config vacía (regla dura, RN-022):** sin límites configurados (o todos deshabilitados), cada superficie se ve **exactamente igual** que sin la feature. Ningún anclaje cambia de estilo.

---

## RF-LIM-004 — Alerta activa (aviso al guardar un movimiento)

| Campo | Detalle |
|---|---|
| **Descripción** | Al guardar un movimiento, el sistema **proyecta** el estado resultante del mes y, si cruzaría uno o más límites de naturaleza **activa**, muestra un aviso **no bloqueante** de confirmación que enumera los cruces. El usuario decide continuar o cancelar; el guardado **nunca** se bloquea. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene al menos un límite activo habilitado sobre una key `mes.*`. |

**Alcance:** aplica a los **cuatro** formularios de carga de movimiento — único, fijo, cuota y **calculado** — en creación y edición.

**Flujo principal:**
1. El usuario completa un formulario de movimiento y presiona **Guardar**.
2. El sistema proyecta el dato post-movimiento y evalúa los límites activos.
3. **Sin cruces →** el movimiento se guarda como siempre, sin fricción (no aparece ningún aviso).
4. **Con ≥1 cruce →** el sistema muestra un aviso que enumera el/los límite(s) que se cruzarían, con acciones **"Guardar igual"** y **"Cancelar"**.

**Flujos alternativos:**
- *A1 — "Guardar igual":* el movimiento se persiste (el aviso no bloquea).
- *A2 — "Cancelar":* vuelve al formulario sin guardar.

**Keys admitidas y polaridad del operador:** la activa se acota a las **7 keys `mes.*`**. El operador se ofrece según la **polaridad** del anclaje:

| Key | Polaridad | Operadores |
|---|---|---|
| `mes.total.gasto` | techo (no superar) | `>` / `≥` |
| `mes.seccion.subtotal` | techo | `>` / `≥` |
| `mes.seccion.conteo` | techo | `>` / `≥` |
| `mes.categoria.gastoMes` | techo | `>` / `≥` |
| `mes.item.monto` | techo | `>` / `≥` |
| `mes.balance` | piso (no caer por debajo) | `<` / `≤` |
| `mes.total.ingreso` | piso (no caer por debajo) | `<` / `≤` |

**Reglas de proyección:**
- **Mes de proyección:** un **único** proyecta sobre **su** mes; un **fijo**, **cuota** o **calculado recurrente** se chequea contra el **mes en curso** (mes real de hoy).
- **Qué proyecta cada movimiento:** un **gasto** proyecta `mes.total.gasto`, `mes.balance`, el `mes.seccion.subtotal`+`mes.seccion.conteo` de **su** sección y el `mes.categoria.gastoMes` de **su** categoría (el refinamiento dispara solo si coincide con la sección/categoría del movimiento). Un **ingreso** proyecta `mes.total.ingreso` y `mes.balance`.
- **`mes.item.monto` es chequeo directo** del monto del movimiento (no acumula): aplica a **cualquier** tipo y dirección.
- **`mes.seccion.conteo`** proyecta el conteo actual de la sección **+ 1**.
- **Edición reemplaza, no suma:** se proyecta con el valor **nuevo**, excluyendo la contribución previa del movimiento editado.
- **Movimiento anulado no proyecta:** un movimiento que se guarda/edita ya anulado no dispara ningún cruce.
- **Moneda:** el monto se convierte a la moneda canónica **antes** de comparar (el umbral es número puro).

**Criterios de aceptación:**
- [ ] El aviso aparece **solo** cuando la proyección cruza ≥1 límite activo; sin cruces el guardado es idéntico al de sin la feature (cero fricción).
- [ ] El aviso **no bloquea**: "Guardar igual" persiste el movimiento, "Cancelar" vuelve al formulario.
- [ ] Se enumeran **todos** los límites activos que se cruzarían con el guardado.
- [ ] La activa solo se evalúa sobre las 7 keys `mes.*`; los datos de reportes no la disparan.
- [ ] El operador de un límite activo respeta la polaridad de su anclaje (techo `>`/`≥`, piso `<`/`≤`).
- [ ] Aplica a los cuatro formularios (único / fijo / cuota / calculado), en creación y edición.

---

## RF-LIM-005 — Popover informativo de límites por superficie

| Campo | Detalle |
|---|---|
| **Descripción** | Cada superficie con límites cableados expone un **ícono informativo** que abre un **popover de solo lectura** con el **listado de los límites que la observan**, agrupados por naturaleza. **No marca ni avisa: informa.** No resalta ningún dato (a diferencia de la marca pasiva, RF-LIM-003) ni interrumpe el guardado (a diferencia del aviso activo, RF-LIM-004); solo enumera qué límites están mirando esa superficie, crucen o no. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene al menos un límite sobre una key cableada de la superficie. |

**Superficies con popover:** la superficie de un límite la fija su **key** (catálogo de RF-LIM-003): `/mes` (las 7 keys `mes.*`) y **una superficie por tipo de reporte** — Ingresos vs Gastos, Gastos por categoría, Gastos Únicos, Gastos en Cuotas, Inflación vs Ingresos. La superficie es el **tipo de reporte, no la instancia de card**: dos cards del mismo tipo listan **el mismo** conjunto de límites.

**No** aparece en el Dashboard: ni el resumen mensual ni el widget efímero Ingresos vs. Gastos lo montan, **aunque ese widget comparta tipo y keys con la card Ingresos vs Gastos de `/reportes`**. Es una **asimetría deliberada**: el Dashboard es superficie de vistazo, sin chrome de listado; las marcas pasivas sí operan ahí (RF-LIM-003).

**Condición de aparición:** el ícono se monta **solo si hay ≥1 límite** —**habilitado o no**— cuya key pertenece a la superficie. Con **cero** límites para la superficie el ícono **no se renderiza** (no reserva espacio). Que el ícono exista es, en sí, la señal de "esta superficie tiene al menos un límite observándola".

**Contenido del popover:** el **listado de los límites** de la superficie, **agrupado por naturaleza** — los **pasivos** (marca visual, RF-LIM-003) bajo un grupo y los **activos** (aviso al guardar, RF-LIM-004) bajo otro. Como los activos solo existen sobre keys `mes.*`, el **grupo de activos aparece únicamente en `/mes`**; las cards de `/reportes` solo tienen el grupo de pasivos.

Cada ítem del listado muestra:

| Dato | Regla |
|---|---|
| **Dato observado** (rótulo del anclaje) | **Siempre**, aunque el límite tenga nombre propio. Es la razón de ser del popover: nombrar qué de esta pantalla se está mirando. |
| **Nombre del límite** | El rótulo que le puso el usuario, si lo tiene. Sin nombre propio, el rótulo del anclaje **hace de nombre** y no se repite. |
| **Condición** | Operador + umbral, tal cual se configuró: número puro, sin moneda (RF-LIM-001). |
| **Refinamiento** | La **categoría** (con su color) o la **sección** que acota el límite, cuando lo tiene. |
| **Estado** | Un límite con `enabled: false` **se lista igual** —el popover informa la config completa—, atenuado y etiquetado como desactivado. No produce marca ni aviso, pero el usuario ve que existe y está apagado. |
| **Alcance temporal** | Los **pasivos** de alcance `mes en curso` llevan un **qualifier** que lo enuncia; los de `todos los meses` (default) **no** lo llevan (es la norma; anotarla sería ruido); los **activos** nunca (no usan alcance temporal). |

- **No muestra el efecto visual** del límite pasivo: el popover dice **qué se observa**, no cómo se pinta. El efecto se ve en la propia superficie cuando el dato cruza.
- **Orden:** dentro de cada grupo, el **orden de configuración** del usuario — el mismo de la sección Límites de `/configuracion` (RF-LIM-002). Los deshabilitados **no** se segregan al final: quedan en su posición, atenuados.

**Listado de configuración, no de evaluación:** el popover enumera **la config**, no el resultado de evaluarla. No depende del **período** que la superficie muestra (el mes navegado en `/mes`, el año de la card en `/reportes`), ni del filtro, la moneda o la representación de la card, ni de si algún límite **cruza** en ese momento; el listado no se achica ni cambia al navegar. Por eso un límite pasivo de alcance `mes en curso` **se lista igual** cuando el período mostrado lo vuelve inaplicable —`/mes` parado en otro mes, o una card anual donde solo alcanza al punto del mes en curso dentro de los 12—: el qualifier enuncia el **alcance del límite**, verdad idéntica en toda superficie, y el usuario deriva de ahí el efecto local. El listado no afirma que algo esté cruzado.

**Comportamiento:**
- Es **solo lectura**: no edita, no activa/desactiva y **no navega** a la sección Límites de Configuración (RF-LIM-002). Su única interacción son las vías de apertura y cierre.
- Abre por click/tap (y, en desktop, también por hover); cierra por click-fuera, Esc o re-clic. No bloquea el fondo.

**Criterios de aceptación:**
- [ ] El ícono aparece en las 5 cards de `/reportes` y en `/mes`, y **nunca** en el Dashboard.
- [ ] El ícono se monta **solo** con ≥1 límite (habilitado o no) para la superficie; con cero, no se renderiza.
- [ ] El popover **lista** los límites de la superficie agrupados por naturaleza; no marca ningún dato ni interrumpe ningún guardado.
- [ ] El grupo de activos aparece **solo en `/mes`**; las cards de `/reportes` solo muestran el grupo de pasivos.
- [ ] Dos cards del **mismo tipo de reporte** listan el mismo conjunto de límites.
- [ ] Cada ítem nombra **siempre** el dato observado; tener nombre propio no lo reemplaza.
- [ ] Los límites deshabilitados se listan atenuados y etiquetados como desactivados, **en su posición** dentro del grupo.
- [ ] Dentro de cada grupo el orden es el de configuración (el de la sección Límites).
- [ ] Los límites pasivos de alcance "mes en curso" llevan su qualifier; los de "todos los meses" no; los activos nunca.
- [ ] El listado **no cambia** con el mes navegado, el año de la card, sus filtros ni con que algún límite cruce o no.
- [ ] El popover **no** muestra el efecto visual de los límites pasivos.
- [ ] Es solo lectura: no expone acciones de edición, de toggle ni link a `/configuracion/limites`.

**Notas:**
- El **copy visible** (caption del popover, encabezados de grupo, etiqueta de deshabilitado y qualifier de alcance temporal) está fijado en `docs/screens.md` (pantallas 4 y 7). El spec visual del ícono y el popover lo define `docs/design.md`, §Popover informativo de límites por superficie.
