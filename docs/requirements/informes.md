# 3.9 Módulo: Reportes

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Contratos de los endpoints de reportes: `docs/data-model/informes.md`; shape de la clave `reports`: `docs/data-model/preferencias.md`.

El módulo de Reportes visualiza los movimientos del usuario a lo largo del tiempo. Cada reporte es un **widget de reporte autónomo, configurable por props**, que lleva embebidos su propia navegación de período y su propio filtro. Hay seis tipos de card: Ingresos vs Gastos y Gastos por categoría (RF-REP-001), grilla anual de gastos Únicos (RF-REP-010), gantt anual de gastos en Cuotas (RF-REP-011), Inflación vs Ingresos (RF-REP-012) y Detalle histórico de fijos (RF-REP-013). La pantalla `/reportes` es **configurable**: el usuario arma su vista agregando y quitando **cards de reporte**; el dashboard monta una sola instancia del widget (ver RF-DASH-001/002).

> **Alcance:** los seis tipos de card de arriba. La card de Ingresos vs Gastos admite además filtros por tipo / dirección / categoría (RF-REP-014); ella y la de Gastos por categoría pueden incluir los **movimientos simulados** en el tramo alcanzado por las simulaciones —como mínimo desde el mes en curso—, opt-in por card (RF-REP-017). Otros tipos de reporte/gráfico (torta, barras de comparación) quedan fuera de alcance (ver `definiciones-y-alcance.md`, §6).

---

## RF-REP-001 — Tipos de reporte disponibles

| Campo | Detalle |
|---|---|
| **Descripción** | Define los **dos tipos de reporte sobre la serie anual** (`GET /movements/reports`, RF-REP-005), sobre los 12 meses de un año (eje X: los meses del año; eje Y: monto): **Ingresos vs Gastos** por mes, y **Gastos por categoría** (gastos del mes descompuestos por categoría). Los otros cuatro tipos de card se definen en sus propios RF (RF-REP-010..013); el set completo de seis tipos es el alcance del módulo. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Tipos de reporte:**

- **Ingresos vs Gastos** (`income-expense`). Dos series por mes a lo largo del año: el **total de ingresos** del mes y el **total de gastos** del mes. Cada mes del eje X tiene su par de valores (ingresos, gastos). Los totales por mes suman los tres tipos de movimiento que caen en el mes (únicos + fijos activos + cuotas), con el mismo criterio que los totales de la Vista del mes (RF-VM-002) y el Dashboard (RF-DASH-002). Es **Total-only**: muestra únicamente las dos series agregadas, sin sub-vista por categoría ni toggle.
- **Gastos por categoría** (`by-category`). Toma el **total de gastos** de cada mes y lo descompone, una porción por **categoría**, cada una con el **color propio de su categoría** (RF-CAT-005 / RN-013). Las porciones de un mes suman exactamente el total de gastos de ese mes (el mismo valor que la serie "gastos" de Ingresos vs Gastos). Es **solo de gastos** (`EXPENSE`): los ingresos no se descomponen por categoría en este reporte. La card ofrece un **toggle de representación Barra ↔ Línea** (RF-REP-006): mismo dato, geometría distinta.

**Criterios de aceptación:**
- [ ] Sobre la serie anual hay exactamente **dos tipos de reporte**: `income-expense` (Ingresos vs Gastos) y `by-category` (Gastos por categoría). Los demás tipos de card (`unique-grid`, `installment-gantt`, `inflation-income`, `fixed-evolution`) tienen endpoint y RF propios (RF-REP-010..013).
- [ ] El eje X representa los 12 meses del año configurado; el eje Y representa el monto.
- [ ] Los **12 meses están siempre presentes** en el eje X; un mes sin datos se grafica en **cero** (no se omite ni deja hueco). Esto incluye los meses futuros, que también se muestran en cero salvo lo que proyecten los fijos activos y las cuotas en tramo (RN-006) y, en las cards que lo habilitan, los movimientos simulados (RF-REP-017). La representación visual concreta de un mes en cero la define `control-design`.
- [ ] Ingresos vs Gastos muestra, por mes, el total de ingresos y el total de gastos del mes; ambos totales suman únicos + fijos activos + cuotas del mes (mismo criterio que RF-VM-002).
- [ ] Gastos por categoría muestra, por mes, el total de gastos del mes descompuesto por categoría, cada porción con el color de su categoría; la suma de las porciones de un mes iguala el total de gastos de ese mes.
- [ ] Gastos por categoría considera **solo gastos** (`EXPENSE`); los ingresos no aparecen descompuestos por categoría.
- [ ] Gastos por categoría muestra **una porción por cada categoría con gasto, sin agrupar ni colapsar** ninguna en una porción "Otras"; no hay tope de categorías visibles. La agrupación "Otras" para la cola de categorías queda como candidato futuro.
- [ ] Los colores de las porciones de Gastos por categoría son los colores ya asignados a cada categoría (RF-CAT-005); el reporte no inventa ni reasigna colores.
- [ ] El mes al que pertenece cada movimiento, para la agregación anual, se determina con el mismo criterio de zona horaria ya definido (RN-015): la zona propia de cada registro para los únicos, y el `startMonth` `YYYY-MM` para fijos y cuotas.
- [ ] Un movimiento cuya categoría fue eliminada (soft delete) sigue contando en los totales y, en `by-category`, sigue apareciendo bajo su categoría con su color (consistente con RF-CAT-004 / RF-VM-002).

**Notas:**
- Las decisiones de presentación visual del reporte (tipo de trazo, relleno de áreas, leyenda, ejes, interacción de hover/tooltip, comportamiento responsivo) son responsabilidad de `control-design` (`docs/design.md`), no de este RF.
- **Excepción a "mes sin datos = cero":** el criterio vale para los dos tipos de este RF. La card `fixed-evolution` (RF-REP-013) grafica la **ausencia como hueco, nunca como cero** —una línea suya puede valer 0 de verdad (RN-018)—; esa excepción es intencional y no se "corrige".
- Los criterios de arriba describen el dato **real** de ambos tipos. Una card `income-expense` o `by-category` puede además sumar los **movimientos simulados** al tramo que alcanzan las simulaciones —**como mínimo desde el mes en curso**, que queda mixto— cuando la propia card lo habilita (RF-REP-017, apagado por defecto).

---

## RF-REP-002 — Widget de reporte autónomo

| Campo | Detalle |
|---|---|
| **Descripción** | Cada reporte (RF-REP-001) se implementa como un **widget de reporte autónomo**: un componente reutilizable, configurable por props, que lleva **embebidos** su propia **navegación de año** (independiente por instancia) y su propio **filtro de categorías**. Se inyecta tanto en cada card de `/reportes` (RF-REP-003) como en el dashboard (RF-DASH-001/002; ahí sin filtro, ver *Widget del dashboard*). No hay control de año ni filtro compartidos entre instancias: cada widget gobierna su propio año y su propio set de categorías. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Props funcionales:**

- **Tipo de reporte.** `income-expense` (Ingresos vs Gastos) o `by-category` (Gastos por categoría). Define qué visualización monta la instancia.
- **Año a mostrar.** Define el año cuyos 12 meses se grafican. La navegación de año (flechas embebidas en el widget) está **siempre activa** e **independiente por instancia**: cambiar el año de un widget no afecta a ningún otro. Los límites los fija el **rango de datos de la propia card** (ver *Límites de navegación de año* abajo).
- **Categorías seleccionadas (filtro).** Subconjunto de categorías que el reporte considera; default **todas**. El filtro tiene **tres estados**: **todas** (default, sin filtro), **subconjunto** (solo las tildadas) y **ninguna** (todas destildadas) → la serie/bandas se grafican en **cero** (igual que el filtro de `/mes`, RF-VM-006). El universo de categorías ofrecido son **solo las categorías que aportan a lo que la card muestra** en el año (no el catálogo completo del usuario): en `by-category`, las categorías con **gasto**; en `income-expense`, las categorías con **algún movimiento** (gasto o ingreso). Ese universo es **estable**: no se achica al destildar categorías.
- **La leyenda del gráfico ES el filtro de categorías.** En las cards de `/reportes` de ambos tipos no hay un control de filtro de categorías separado: la **leyenda interactiva de categorías** es el único disparador (clic en un ítem lo activa/desactiva, con la lógica de tres estados). La card `income-expense` de `/reportes` suma además los controles de **tipo de movimiento** y **dirección** (RF-REP-014); **no** tiene leyenda interactiva de las series Ingresos/Gastos: la dirección es el único control de cuántas líneas dibuja.
- **Widget del dashboard** (`income-expense`, RF-DASH-001/002): **sin filtros** de ningún tipo; su leyenda de series Ingresos/Gastos es **decorativa** (no interactiva).
- **Persistencia (modo).** Define qué hace la instancia con sus cambios:
  - **Persistida** — en `/reportes`: cada cambio de año y de filtro de la card se persiste en la clave `reports` de preferencias (RF-REP-004).
  - **Efímera** — en el dashboard: el año es de sesión; **no** se persiste (al recargar, el widget vuelve al año en curso). Ver RF-DASH-001/002.

**Límites de navegación de año** (destino canónico; vale para las cinco cards con stepper de año):

- **El límite de una card es su propia información.** Cada card navega dentro del rango `[primer año con dato, último año con dato]` calculado sobre **el dato que esa card grafica**, no sobre todos los movimientos del usuario.
- **El rango respeta el filtro vigente de la card.** Cambiar el filtro cambia el rango. En Ingresos vs Gastos y Gastos por categoría entran el filtro de categorías, los tipos de movimiento y la dirección (RF-REP-014); en los reportes anuales (RF-REP-010/011/012), el filtro de categorías.
- **El rango incluye los movimientos simulados cuando la card los habilita.** Es la misma regla sin excepción: el límite es el dato que la card grafica con el filtro vigente, y con el toggle de simulados encendido (RF-REP-017, solo Ingresos vs Gastos y Gastos por categoría) los tramos de las simulaciones son parte de ese dato y **extienden el rango hacia adelante**. Con el toggle apagado, el rango es solo el del dato real. Detalle del aporte en `docs/data-model/informes.md`, §Rango de años navegable.
- **El rango es continuo de punta a punta.** Los años **vacíos dentro** del rango son navegables: no se evalúa año por año, porque un hueco dejaría inalcanzable el dato más viejo.
- **Un fijo activo sin fecha de fin genera dato indefinidamente hacia adelante** — es dato real por recurrencia (RN-016), no proyección. Cuando el dato no termina, el límite lo pone la **cota técnica**: `añoEnCurso − 100` … `añoEnCurso + 100`.
- **Dos cards nunca pasan del año en curso**, porque su propio dato no existe a futuro: el reporte **anual de Únicos** (RF-REP-010 — los únicos no se repiten) y el de **Inflación vs Ingresos** (RF-REP-012 — no hay IPC futuro). Es el mismo criterio por el que `fixed-evolution` nunca grafica meses futuros (RF-REP-013). **Ingresos vs Gastos**, **Gastos por categoría** y el **gantt de Cuotas** (RF-REP-011) sí navegan a años futuros.
- **Sin dato con el filtro vigente → el stepper se congela:** ambas flechas deshabilitadas y el año no cambia. Es el caso del filtro con **ninguna** categoría tildada, que **sigue graficando en cero** (RF-VM-006); y es también el de la **carga inicial** —no una excepción—: mientras no hay respuesta no hay rango, así que el stepper está deshabilitado.
- **Año fuera de rango → corrección automática.** Si el año vigente de la card queda fuera del rango —al montar con un año persistido, o al cambiar el filtro—, la card salta al **extremo más cercano** del rango y ese año **se persiste** en la configuración de la card (RF-REP-004), igual que cualquier cambio de año.
- **`fixed-evolution` (RF-REP-013) queda afuera:** no tiene stepper de año, sino un select de rango de meses corridos con sus propios bordes.

**Criterios de aceptación:**
- [ ] El widget es un componente reutilizable; tipo, año, categorías seleccionadas y modo de persistencia se controlan por props, no por lógica interna distinta en cada pantalla.
- [ ] La navegación de año está **embebida en el widget** y es **independiente por instancia**: mover el año de una instancia no mueve el de ninguna otra (no hay control de año compartido).
- [ ] En las cards de `/reportes`, el filtro de categorías está **embebido en el widget** y ofrece **solo las categorías que aportan a lo que la card muestra** en el año (`by-category`: con gasto; `income-expense`: con algún movimiento), con default **todas seleccionadas**; el universo es estable (no se achica al destildar).
- [ ] La **leyenda de categorías es el filtro**: no hay un control de filtro de categorías separado. Clic en un ítem de la leyenda lo activa/desactiva, con la lógica de tres estados (todas / subconjunto / ninguna). La card `income-expense` de `/reportes` suma los controles de tipo y dirección (RF-REP-014) y no tiene leyenda interactiva de series.
- [ ] El widget del dashboard no expone filtros; su leyenda de series es decorativa.
- [ ] El filtro aplica a ambos tipos: en `income-expense` restringe qué categorías cuentan en los totales de ingresos y de gastos; en `by-category` restringe qué bandas se apilan (contrato del endpoint en `docs/data-model/informes.md`).
- [ ] Los límites de navegación de año son el **rango de datos propio de la card**, calculado sobre lo que esa card grafica y **respetando su filtro vigente**; los años vacíos **dentro** del rango son navegables. Con el toggle de simulados encendido (RF-REP-017), los tramos de las simulaciones cuentan como dato propio de la card.
- [ ] Un rango **ausente** (sin dato con el filtro vigente, incluida la carga inicial) **congela el stepper**: ambas flechas deshabilitadas y el año no cambia; con el filtro en "ninguna" el gráfico igual se dibuja en **cero**.
- [ ] Un año vigente **fuera del rango** se corrige al **extremo más cercano** y el año corregido se **persiste** como cualquier cambio de año.
- [ ] En modo **persistido** (cards de `/reportes`), los cambios de año y de filtro de la instancia se persisten vía clave `reports` (RF-REP-004).
- [ ] En modo **efímero** (dashboard), los cambios de año de la instancia **no** se persisten: al recargar vuelve al año en curso.

---

## RF-REP-003 — Pantalla de reportes configurable

| Campo | Detalle |
|---|---|
| **Descripción** | La pantalla `/reportes` es **configurable por el usuario**: arma su propia vista agregando y quitando **cards de reporte**, cada una de las cuales monta un widget de reporte autónomo (RF-REP-002). La pantalla siempre expone un recuadro **"[+]"** para agregar una card nueva. La **primera vez la pantalla está vacía** (solo el "[+]"); la configuración persistida (clave `reports`, RF-REP-004) **es** su pantalla. Es el lugar donde el usuario explora sus movimientos a lo largo de los años con las visualizaciones que le interesan. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Flujo principal:**
1. El usuario abre `/reportes`. El sistema lee la clave `reports` de preferencias (RF-REP-004) y monta una card por cada entrada, en el orden del array.
2. Si no hay cards (clave ausente o array vacío), la pantalla muestra solo el recuadro **"[+]"** (estado vacío inicial).
3. El usuario activa el **"[+]"** para agregar una card; elige el tipo de reporte (RF-REP-001). El sistema agrega la card al final con su tipo, el **año en curso** y **todas las categorías** por defecto, y persiste el cambio (RF-REP-004).
4. Cada card monta un widget autónomo (RF-REP-002): navega su propio año y filtra sus propias categorías; cada cambio se persiste.
5. El usuario puede **quitar** una card; el sistema la elimina de la vista y de la clave `reports`.

**Criterios de aceptación:**
- [ ] La ruta de la pantalla es **`/reportes`** y su link en el sidebar se rotula **"Reportes"**.
- [ ] La pantalla siempre expone un recuadro **"[+]"** para agregar una card de reporte.
- [ ] Al agregar una card, el usuario elige el **tipo de reporte** (RF-REP-001); la card nace con el año en curso y todas las categorías seleccionadas.
- [ ] El usuario puede **quitar** cualquier card; quitarla la elimina de la vista y de la persistencia (RF-REP-004).
- [ ] Cada card monta un **widget de reporte autónomo** (RF-REP-002) en **modo persistido**: navega su año y filtra sus categorías de forma independiente, y persiste cada cambio.
- [ ] El **orden de las cards** en pantalla es el orden del array `reports` (RF-REP-004).
- [ ] **Estado vacío inicial:** la primera vez (clave ausente o array vacío), la pantalla muestra solo el "[+]".
- [ ] La pantalla es accesible desde el sidebar (RF-NAV-001) con el link **"Reportes"**, ubicado **debajo de "Vista del mes"** (orden: Dashboard → Vista del mes → Reportes → Historial → Configuración).
- [ ] La definición funcional completa (contenido, acciones, navegación y estados) vive en `docs/screens.md`. El detalle visual (layout, tamaños, colores, comportamiento de las flechas embebidas) lo define `control-design`.

---

## RF-REP-004 — Persistencia de las cards de reporte

| Campo | Detalle |
|---|---|
| **Descripción** | La configuración de las cards de `/reportes` se persiste por usuario mediante el mecanismo de preferencias, en la clave `reports`. Cada card persiste su **tipo + año + categorías seleccionadas**; el **orden del array es el orden de despliegue**. La normalización y el shape concreto los define el front (igual que `monthSections`): el backend no conoce ni valida esta clave. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. El mecanismo de preferencias está disponible. |

**Criterios de aceptación:**
- [ ] La clave es `reports`, un array de configuraciones de card (shape concreto en `docs/data-model/preferencias.md`, §`reports`).
- [ ] Cada entrada persiste **tipo de reporte, año y categorías seleccionadas**; "todas las categorías" se representa como `categoryIds: null`.
- [ ] El **orden del array = orden de despliegue** de las cards.
- [ ] **Array vacío o clave ausente = pantalla vacía** (solo "[+]"). Un blob de preferencias sin la clave `reports` se interpreta como vacío.
- [ ] La persistencia aplica **solo** a las cards de `/reportes` (modo persistido). El widget del dashboard es **efímero** y no toca esta clave (RF-DASH-001/002).
- [ ] El backend **no** valida ni conoce la clave `reports`; la normalización es responsabilidad del front, igual que con `monthSections`.

---

## RF-REP-005 — Endpoint de datos de reporte

| Campo | Detalle |
|---|---|
| **Descripción** | El backend expone los datos de reporte mediante `GET /movements/reports`. Acepta el **año** más un **filtro de categorías** opcional por query param; devuelve la serie de 12 meses del año, filtrada al set de categorías pedido. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa (JWT válido). |

**Criterios de aceptación:**
- [ ] El endpoint es `GET /movements/reports`.
- [ ] Acepta el año y un **filtro de categorías** como query param que distingue **tres estados**: **ausente = todas**, **presente y vacío = ninguna** (serie en cero), **lista = subconjunto** (contrato exacto en `docs/data-model/filtro-categorias.md`).
- [ ] El filtro afecta a **ambos tipos**: en `income-expense`, qué categorías cuentan en los totales de ingresos y de gastos por mes; en `by-category`, qué porciones por categoría se incluyen.
- [ ] La respuesta trae el **rango de años navegable** de la card (`yearRange`), calculado sobre el dato que sirve el endpoint y **respetando el filtro** recibido; **ausente** (`null`) cuando el filtro no deja ningún dato. Es el único insumo de los límites de navegación de año (RF-REP-002); contrato en `docs/data-model/informes.md`.
- [ ] El campo **`earliestYear` NO se ve afectado por el filtro** (primer año con CUALQUIER movimiento del usuario) y **no gobierna la navegación de año**.
- [ ] La respuesta tiene el shape `{ year, months, categories, earliestYear, yearRange }` (contrato en `docs/data-model/informes.md`), con `months` y `categories` filtrados al set pedido.
- [ ] El endpoint filtra siempre por el `userId` del JWT (RNF-002).
- [ ] El array `categories` (desglose de gastos `EXPENSE`) alimenta la card `by-category` en **ambas representaciones** (barra y línea, RF-REP-006): es el mismo dato, distinta geometría de render. El backend no distingue barra de línea; eso es solo render del front.

---

## RF-REP-006 — Toggle de representación Barra / Línea en la card Gastos por categoría

| Campo | Detalle |
|---|---|
| **Descripción** | La card de reporte de tipo `by-category` (Gastos por categoría) ofrece un **toggle de representación**: **Barra** y **Línea**. Es la **misma data** (gastos del mes descompuestos por categoría) graficada con **geometría distinta**; no cambia el tipo, el año ni el filtro de categorías de la card. La card `income-expense` (Ingresos vs Gastos) **no** tiene este toggle (es Total-only). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe una card de tipo `by-category` (en `/reportes`). |

**Representaciones:**

- **Barra** (default). Barras **apiladas** por categoría: una porción por categoría con gasto, cada una con el color propio de su categoría (RF-CAT-005 / RN-013). La suma de las porciones de un mes iguala el total de gastos de ese mes.
- **Línea.** Áreas **apiladas** por categoría (mismo apilado que Barra, geometría continua): las mismas categorías con los mismos colores, más una **línea de contorno = total de gasto** del mes.

**Criterios de aceptación:**
- [ ] La card `by-category` expone un toggle de dos opciones: **Barra** (default) y **Línea**.
- [ ] La card `income-expense` **no** expone este toggle.
- [ ] Ambas representaciones grafican el **mismo dato** (gastos por categoría apilados); solo difiere la geometría de render. La suma de las porciones/áreas de un mes iguala el total de gastos del mes.
- [ ] El toggle **no** cambia el tipo, el año ni el filtro de categorías de la card.
- [ ] **Persistencia:** en `/reportes` la representación elegida se **persiste por card** (clave `reports`, campo `categoryChartMode`; **ausente = "bar"**, ver `docs/data-model/preferencias.md`).
- [ ] El desglose de gastos por categoría se sirve mediante el array **`categories`** de `GET /movements/reports` (RF-REP-005); barra vs línea es solo render del front.

**Notas:**
- El detalle visual del toggle y de cada representación lo define `control-design` (`docs/design.md`).

---

## RF-REP-007 — Moneda por card de reporte

| Campo | Detalle |
|---|---|
| **Descripción** | Cada card de `/reportes` tiene su **propia moneda de display**, independiente de las demás y persistida junto al resto de su config (clave `reports`, RF-REP-004). La card re-expresa sus cifras a esa moneda **al vuelo** (capa de display, igual que la moneda default; no toca ningún movimiento guardado, RF-CUR-005). La card de reporte del **dashboard** no tiene esta opción: queda siempre en la moneda default global del usuario. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe una card de reporte en `/reportes`. |

**Criterios de aceptación:**
- [ ] Cada card de `/reportes` expone un **selector de moneda** en su cabecera, con las 4 monedas del set (RF-CUR-001).
- [ ] Al **crear** una card, su moneda nace con la **moneda default global vigente** del usuario (RF-CUR-002), sin preguntar ni ofrecer elección.
- [ ] Cambiar la moneda de una card **re-expresa sus cifras al vuelo** y **no afecta a las demás cards** ni a la moneda default global; no toca ningún movimiento guardado.
- [ ] La moneda elegida se **persiste por card** (clave `reports`, campo `currency`, RF-REP-004; shape en `docs/data-model/preferencias.md`). Una card sin el campo usa la **default global vigente** del usuario.
- [ ] El **chip de moneda del header** de `/reportes` refleja la **moneda default global** del usuario (RF-CUR-002), no la de ninguna card en particular.
- [ ] La card de reporte del **dashboard** **no** expone selector de moneda: muestra siempre la moneda default global.

**Notas:**
- El detalle visual del selector lo define `control-design` (`docs/design.md`).

---

## RF-REP-008 — Título editable por card de reporte

| Campo | Detalle |
|---|---|
| **Descripción** | Cada card de `/reportes` tiene un **título editable** en su cabecera, persistido junto al resto de su config (clave `reports`, campo `title`, RF-REP-004). Aplica a **todos** los tipos de card de `/reportes`. Una card sin título muestra el placeholder **"Reporte N"**. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe una card de reporte en `/reportes`. |

**Criterios de aceptación:**
- [ ] Cada card de `/reportes` expone un **título editable** en su cabecera.
- [ ] Una card **sin título** (campo ausente o vacío) muestra el placeholder **"Reporte N"**, donde **N = posición 1-based de la card en la columna**, contando **todas** las cards (tengan título o no). El N se **recalcula en vivo** según las cards existentes: al quitar o reordenar cards, el placeholder de las demás cambia (es **no monotónico**). Este "Reporte N" es **display, no dato**: no se persiste.
- [ ] La edición admite **máximo 60 caracteres**. **Enter** o **blur** confirman (se persiste el título trimmeado); **Esc** cancela y descarta el cambio en curso.
- [ ] El título confirmado se **persiste por card** (clave `reports`, campo `title`, RF-REP-004; shape en `docs/data-model/preferencias.md`). Si el usuario confirma un título **vacío**, el campo se **omite** del objeto (la card vuelve a mostrar el placeholder).

**Notas:**
- El detalle visual del título y su modo de edición lo define `control-design` (`docs/design.md`).

---

## RF-REP-009 — Reordenar las cards de reporte

| Campo | Detalle |
|---|---|
| **Descripción** | Las cards de `/reportes` son reordenables entre sí mediante drag & drop, con el **mismo mecanismo que el "modo orden" de las secciones de `/mes`** (RF-VM-005). El orden de las cards es el orden del array de la clave `reports` de preferencias (RF-REP-004): se persiste por usuario y se aplica en vivo. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario está en `/reportes` con **2 o más** cards de reporte. |

**Flujo principal:**
1. El usuario activa el **"modo orden"** desde el header ("Ordenar reportes"); en ese modo cada card colapsa a una representación **mini** y se arrastra para reordenarla entre las demás.
2. El usuario sale del modo orden ("Listo"). El nuevo orden ya quedó aplicado en vivo.

**Criterios de aceptación:**
- [ ] El usuario puede reordenar **las cards entre sí** mediante drag, dentro de un **modo orden** explícito que se activa/desactiva con un botón del header ("Ordenar reportes" / "Listo").
- [ ] El botón "Ordenar reportes" se muestra **solo cuando hay 2 o más cards** (con 0 o 1 no hay nada que reordenar).
- [ ] En modo orden, cada card colapsa a su representación **mini** y se arrastra como una unidad; los controles internos de cada card (navegación de año, moneda, refrescar, quitar, título editable) y el recuadro **"[+]"** quedan **deshabilitados**.
- [ ] El **orden de las cards** es el orden del array `reports`; se **persiste por usuario** (clave `reports`, RF-REP-004; shape en `docs/data-model/preferencias.md`) y se **aplica en vivo**. No hay acción de "cancelar" (espejo de RF-VM-005).
- [ ] Al reordenar, el placeholder **"Reporte N"** de las cards sin título se recalcula en vivo según la nueva posición (RF-REP-008).

---

## RF-REP-010 — Reporte anual de gastos Únicos (grilla día × mes)

| Campo | Detalle |
|---|---|
| **Descripción** | Tercer tipo de card de reporte (`unique-grid`): una **grilla de gastos Únicos del año**, con un **día por fila (1–31)** y un **mes por columna (ene–dic)**. Cada celda muestra el total de **gastos Únicos** (`EXPENSE`) imputados a ese día y mes, en la moneda de display de la card. Bajo la grilla, un **footer de métricas mensuales** por columna. Solo considera **movimientos Únicos de tipo gasto**: fijos, cuotas y calculados no entran. Es un widget de reporte autónomo (RF-REP-002) con su año, su filtro de categorías y su moneda propios, persistidos en la clave `reports` (RF-REP-004). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Contenido de la grilla:**

- **31 filas × 12 columnas, siempre.** Fila = día del mes (1–31), columna = mes (ene–dic). Una celda agrega los gastos Únicos del usuario cuyo día y mes (en la zona propia de cada registro, RN-015) caen en esa posición.
- **Días inexistentes del mes** (ej. 30/31 de febrero) se distinguen de un día sin gasto: la celda de un día que no existe en ese mes **no aplica**, distinta de un día existente con **$0** de gasto.
- El **filtro de categorías** (RF-REP-002) restringe qué gastos Únicos entran en la grilla y en el footer; el universo ofrecido es **solo las categorías con gasto Único del año** (estable, no se achica al destildar).
- **Hover de celda de día** — revela, además de fecha y total, el **desglose por categoría** del gasto de ese día. **Hover del footer de un mes** — revela las cinco métricas mensuales en detalle. Spec visual de ambos tooltips en `docs/design/graficos-anuales.md` §Reporte anual de Únicos.

**Footer de métricas mensuales** (una entrada por mes/columna):

- **Total del mes** — suma de los gastos Únicos del mes (la columna).
- **Promedio diario** — total del mes dividido por el divisor de días: el **día en curso** si la columna es el mes corriente del año en curso; los **días del mes** si el mes ya terminó (incluye meses de años pasados); **no aplica** (sin valor) para un mes **futuro**.
- **% de diferencia vs. mes anterior** — variación del promedio diario respecto del mes anterior. El mes anterior de **enero es diciembre del año previo** (continuidad temporal). Sin valor si el promedio del mes anterior es cero.
- **Inflación del mes** — variación mensual del IPC nacional (RF-IPC-001) de ese mes; sin valor si no hay dato de IPC.
- **% de diferencia ajustado por inflación** — el mismo % vs. mes anterior, pero descontando la inflación del mes en curso del promedio del mes anterior antes de comparar; sin valor si falta el IPC, si el promedio anterior es cero o si el mes en curso no tiene dato.

**Techo de la escala de color (editable por card):**

- El **techo** (ancla) de la escala de color de la grilla es **editable por card**, desde un editor dentro de la propia card (junto a año, moneda y filtro de categorías; **no** en `/configuracion`). Entrada = **monto + selector de moneda**. Un monto **≤ 0 no es guardable**. Default = **15 USD**.
- El techo se **persiste en USD** (constante en términos reales) y se **reconvierte** según el año y la moneda de la card. La rampa de color y la fórmula `t = clamp(total / techo, 0, 1)` no cambian: solo cambia el ancla. La representación visual de la rampa es de `control-design`.
- **Naturaleza del sistema** (consecuencias intencionales de anclar en dólares):
  1. El monto tipeado **no reingresa exacto**: al guardarse en USD y reconvertirse, al reabrir el editor puede diferir en centavos (intrascendente para una escala de color).
  2. El techo es **constante en términos reales**: al cambiar el año de la card se reconvierte con el TC de enero de ese año, y el número en pesos cambia.
  3. El monto tipeado se interpreta con el TC del **año que la card muestra**: el mismo monto en ARS en una card de 2024 y otra de 2026 produce anclas en USD distintas.

**Criterios de aceptación:**
- [ ] La card `unique-grid` muestra una grilla de **31 filas (días 1–31) × 12 columnas (meses ene–dic)** con el total de gastos **Únicos** (`EXPENSE`) por día y mes, en la moneda de display de la card (RF-REP-007).
- [ ] El techo de la escala de color es **editable por card** (monto + moneda), se persiste en USD, default 15 USD; un monto ≤ 0 no es guardable.
- [ ] **Solo** gastos Únicos de tipo `EXPENSE` entran en la grilla y el footer: fijos, cuotas y calculados se excluyen.
- [ ] Un día que **no existe** en un mes se muestra distinto de un día existente con **$0** de gasto.
- [ ] El footer muestra, por mes: total, promedio diario, % vs. mes anterior, inflación del mes y % ajustado por inflación, con la semántica de divisor y de "sin valor" descrita arriba.
- [ ] El **promedio diario** usa como divisor el día en curso (mes corriente), los días del mes (mes terminado) o no aplica (mes futuro).
- [ ] El **% vs. mes anterior** trata diciembre del año previo como anterior de enero; queda sin valor si el promedio anterior es cero.
- [ ] La card es un widget autónomo (RF-REP-002): año, filtro de categorías y moneda propios, persistidos en la clave `reports` (RF-REP-004). El universo del filtro son **solo las categorías con gasto Único del año**.
- [ ] La navegación de año se mueve dentro del **rango propio de la card** (RF-REP-002), calculado sobre sus gastos Únicos ya filtrados, y **nunca pasa del año en curso** (un único no se repite a futuro).

**Notas:**
- Las decisiones de presentación visual (escala de color de las celdas, tipografía, layout del footer) son responsabilidad de `control-design` (`docs/design.md`), no de este RF.
- Las fórmulas exactas de cada métrica del footer (truncado, ajuste por inflación) y el contrato del endpoint viven en `docs/backend/graficos.md` §Reporte anual de Únicos y `docs/data-model/informes.md` §Contrato de reporte anual de Únicos.

---

## RF-REP-011 — Reporte anual de gastos en Cuotas (gantt de barras horizontales)

| Campo | Detalle |
|---|---|
| **Descripción** | Cuarto tipo de card de reporte (`installment-gantt`): un **gantt de gastos en Cuotas del año**. El eje X son los 12 meses (ene–dic); cada **gasto en cuotas** se dibuja como una **barra horizontal** que abarca los meses que ocupa la cuota (desde su mes de inicio por su cantidad de cuotas). Solo considera **gastos en cuotas** (`EXPENSE` en cuotas); los ingresos en cuotas no se muestran. Es un widget de reporte autónomo (RF-REP-002) con su año, su filtro de categorías y su moneda propios, persistidos en la clave `reports` (RF-REP-004). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Contenido del gantt:**

- **Una barra por gasto en cuotas** que toca el año, sobre un eje X de los 12 meses (ene–dic). La barra abarca desde el mes de inicio de la cuota por su cantidad de cuotas.
- **Solo gastos en cuotas** (`EXPENSE` en cuotas). Únicos, fijos, calculados e **ingresos en cuotas** no entran.
- **Monto mostrado** — el **monto por cuota** (no el total de la compra), en la moneda de display de la card (RF-REP-007).
- **Disposición en renglones (packing)** — las barras se ordenan por **mes de origen de la cuota** (las que arrancan antes en el tiempo, más cerca del eje). Una barra reusa un renglón existente si no entra en conflicto con ninguna de las barras ya colocadas ahí —**al menos 1 mes de descanso** a cada lado—, **aprovechando huecos intermedios**; si ningún renglón la admite, sube a uno nuevo por encima.
- **Barras que cruzan el borde del año** — se recortan a los 12 meses visibles y muestran un **indicador de continuación**: `‹` si la cuota empezó antes del año, `›` si sigue después.
- El **filtro de categorías** (RF-REP-002) restringe qué gastos en cuotas entran y, por lo tanto, también el packing; el universo ofrecido es **solo las categorías con gasto en cuotas del año** (estable, no se achica al destildar).
- **Hover de barra** — revela descripción (si la cuota no tiene, el **nombre de su categoría**), categoría, monto por cuota, **total del plan** (RF-MC-005), rango de meses que ocupa, cantidad de cuotas y progreso (qué cuotas caen en el año). El rango del tooltip es el **período real** de la cuota con mes + año (ej. "nov 2025 – feb 2027"), aunque empiece antes o termine después del año visible (`realStartMonth`/`realEndMonth`, ver `docs/data-model/informes.md`). Spec visual del tooltip en `docs/design.md`.
- **Etiqueta dentro de la barra** — prioriza el **monto por cuota** (pieza primaria); el nombre (descripción o, sin ella, el nombre de la categoría) es secundario y se omite antes que el monto; en barras de 1 mes se muestra solo el monto. Degradación visual en `docs/design/graficos-anuales.md` §Reporte anual de Cuotas.

**Criterios de aceptación:**
- [ ] La card `installment-gantt` muestra, para el año configurado, una **barra horizontal por gasto en cuotas** sobre el eje X de los 12 meses (ene–dic), con el **monto por cuota** en la moneda de display de la card (RF-REP-007).
- [ ] **Solo** gastos en cuotas de tipo `EXPENSE` entran: Únicos, fijos, calculados e ingresos en cuotas se excluyen.
- [ ] Las barras se disponen en renglones por **mes de origen de la cuota** (las que arrancan antes en el tiempo, pegadas al eje); una barra reusa un renglón solo si deja **al menos 1 mes de descanso** a cada lado respecto de todas las barras ya colocadas ahí (aprovechando huecos intermedios), y sube a un renglón nuevo si ninguno la admite.
- [ ] Una barra que **cruza el borde del año** se recorta a los 12 meses visibles y muestra el indicador de continuación (`‹` antes del año, `›` después).
- [ ] El **hover de barra** revela descripción, categoría, monto por cuota, total del plan (RF-MC-005), rango de meses, cantidad de cuotas y progreso de cuotas del año; el rango mostrado es el **período real** con mes + año, aunque caiga fuera del año visible.
- [ ] La **etiqueta dentro de la barra** prioriza el monto por cuota: el nombre se omite antes que el monto y, en barras de 1 mes, se muestra solo el monto (degradación visual en `docs/design/graficos-anuales.md` §Reporte anual de Cuotas).
- [ ] La card es un widget autónomo (RF-REP-002): año, filtro de categorías y moneda propios, persistidos en la clave `reports` (RF-REP-004). El filtro afecta el set de barras y el packing; su universo son **solo las categorías con gasto en cuotas del año**.
- [ ] La navegación de año (RF-REP-002) cambia el set de barras visibles; un año **sin gastos en cuotas** muestra el estado **empty** de la card.
- [ ] El **rango navegable** es el propio de la card (RF-REP-002), calculado sobre sus cuotas gasto ya filtradas, y **sí alcanza años futuros** (un plan en tramo ocupa meses futuros): un año vacío **dentro** del rango es navegable y muestra el estado **empty**.

**Notas:**
- Las decisiones de presentación visual (alto y color de las barras, indicador de continuación, layout del eje) son responsabilidad de `control-design` (`docs/design.md`), no de este RF.
- Las reglas de negocio del packing en renglones y la conversión de moneda, y el contrato del endpoint, viven en `docs/backend/graficos.md` §Reporte anual de Cuotas y `docs/data-model/informes.md` §Contrato de reporte anual de Cuotas.
- **Fuera de alcance (futuro):** alertas de renglón.

---

## RF-REP-012 — Reporte anual de Inflación vs Ingresos (gráfico de líneas)

| Campo | Detalle |
|---|---|
| **Descripción** | Quinto tipo de card de reporte (`inflation-income`): un **gráfico de líneas anual** (12 meses, ene–dic) que compara, en **puntos porcentuales**, la **inflación** del mes con la evolución de los **ingresos** del usuario. Muestra tres series: (1) la inflación mensual del IPC nacional (RF-IPC-001), (2) la variación mensual del total de **ingresos** respecto del mes anterior, y (3) esa misma variación **ajustada por inflación**. Sobre las dos series de ingreso traza además sus **rectas de tendencia**. Solo considera movimientos de tipo **ingreso (`INCOME`)**. Es un widget de reporte autónomo (RF-REP-002) con su año, su filtro de categorías y su moneda propios, persistidos en la clave `reports` (RF-REP-004). **Solo en `/reportes`; no se monta en el dashboard.** |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Contenido del gráfico:**

- **Eje X:** los 12 meses del año (ene–dic). **Eje Y:** puntos porcentuales (no moneda).
- **Tres series**, todas en puntos %:
  - **Inflación del mes** — variación mensual del IPC nacional (RF-IPC-001) de ese mes; sin punto si no hay dato de IPC.
  - **Variación de ingresos** — variación del total de ingresos del mes respecto del mes anterior. El mes anterior de **enero es diciembre del año previo** (continuidad temporal). Sin punto si el ingreso del mes anterior es cero o si el mes es **futuro**.
  - **Variación de ingresos ajustada por inflación** — la misma variación, descontando la inflación del mes en curso del ingreso del mes anterior antes de comparar; sin punto si falta el IPC, si el ingreso anterior es cero o si el mes es futuro.
- **Dos rectas de tendencia** — una sobre la serie de ingresos nominal y otra sobre la ajustada (ajuste lineal sobre los meses con dato). Cada tendencia **acompaña la visibilidad de su serie de ingreso madre**: no es un ítem propio de la leyenda.
- **Total de ingreso del mes** — suma de los ingresos del mes (únicos + fijos + cuotas aplicables) en la moneda de display de la card; es el insumo de la variación %, no se grafica como moneda. El mes en curso se computa **a la fecha**; los meses futuros no tienen dato.
- **Línea cortada en meses futuros** — la serie no conecta a través de meses sin dato.
- El **filtro de categorías** (RF-REP-002) restringe qué ingresos cuentan en las variaciones; el universo ofrecido es **solo las categorías con ingreso del año** (estable, no se achica al destildar).

**Criterios de aceptación:**
- [ ] La card `inflation-income` muestra un **gráfico de líneas de 12 meses (ene–dic)** con tres series en **puntos porcentuales**: inflación del mes, variación de ingresos y variación de ingresos ajustada por inflación.
- [ ] **Solo** movimientos de tipo `INCOME` alimentan las series de ingreso; gastos no entran.
- [ ] Cada serie queda **sin punto** cuando no se puede computar (sin IPC, ingreso previo cero, mes futuro), y la línea **no conecta** a través de esos meses.
- [ ] El mes anterior de **enero** es **diciembre del año previo** para la variación de ingresos.
- [ ] Se trazan **dos rectas de tendencia** (ingreso nominal y ajustado), cada una **siguiendo la visibilidad de su serie de ingreso madre**; no aparecen como ítems propios de la leyenda.
- [ ] La **leyenda togglea la visibilidad de las tres series** de forma **efímera** (no se persiste; al recargar vuelven las tres visibles).
- [ ] La card es un widget autónomo (RF-REP-002): año, filtro de categorías y moneda propios, persistidos en la clave `reports` (RF-REP-004). El universo del filtro son **solo las categorías con ingreso del año**.
- [ ] La card **solo existe en `/reportes`**; no se ofrece como widget del dashboard.
- [ ] La navegación de año se mueve dentro del **rango propio de la card** (RF-REP-002), calculado sobre sus ingresos ya filtrados, y **nunca pasa del año en curso** (no hay IPC futuro).

**Notas:**
- Las decisiones de presentación visual (color de cada serie y de las tendencias, grosor, leyenda) son responsabilidad de `control-design` (`docs/design.md`), no de este RF.
- Las fórmulas exactas (truncado de la variación, ajuste por inflación, ajuste lineal de la tendencia) y el contrato del endpoint viven en `docs/backend/graficos.md` §Reporte anual de Inflación vs Ingresos y `docs/data-model/informes.md` §Contrato de reporte anual de Inflación vs Ingresos.

---

## RF-REP-013 — Reporte de Detalle histórico de fijos (gráfico de líneas)

| Campo | Detalle |
|---|---|
| **Descripción** | Tipo de card de reporte (`fixed-evolution`) que muestra el **detalle histórico** de los fijos del usuario a lo largo de un **rango de meses corridos anclado al presente y siempre hacia atrás**: **una línea por fijo**, sin agregación de ningún tipo. Su alcance son **únicamente** los movimientos de tipo **Fijo**, de **ambas direcciones** —gasto (`EXPENSE`) e ingreso (`INCOME`)—: no entran cuotas ni únicos. En lugar del filtro por categoría de las demás cards (RF-REP-002), expone una **selección a nivel de fijo individual**: el usuario elige cuáles fijos se dibujan (1, varios o todos). Ofrece un selector de **modo de visualización** con tres lecturas del mismo dato, aplicadas **por línea**: montos, variación % nominal y variación % ajustada por inflación. Es un widget de reporte autónomo (RF-REP-002) con su **rango**, su selección, su modo y su moneda propios, persistidos en la clave `reports` (RF-REP-004). **Se monta en `/reportes`** y, acotada a un solo fijo, en la **vista evolución de la card de detalle de `/mes`** (RF-VM-009); **no se monta en el dashboard.** |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Contenido del gráfico:**

- **Eje X:** los **meses corridos del rango visible**, del primer mes del rango al **mes en curso**, **siempre a nivel mes**: la card **no agrega por año** y **no ofrece selector de granularidad**. Son entre **3 y 60 posiciones**, según el rango elegido. **Eje Y:** monto en el modo "montos"; puntos porcentuales en los dos modos de variación.
- **Una línea por fijo seleccionado**, de gasto o de ingreso. Ambas direcciones comparten el **mismo eje Y** y se grafican por **magnitud**; la dirección se distingue solo visualmente. Cada fijo se dibuja **separado**: no hay suma, ni total, ni línea agregada de ningún tipo. Cambiar la selección **agrega o quita líneas**; no recalcula nada. Geometría: **línea**.
- **La unidad de la serie es el fijo lógico = la cadena (`chainId`)**, no la fila `Recurring`: los **splits de edición** (RN-005) se recomponen en **una sola línea**, y un cambio de monto se lee como **escalón** dentro de esa misma línea.
- **Calculados derivados de un fijo.** Un movimiento calculado cuyo origen es un fijo (RF-MCALC-001) entra como **línea propia**, con su propia cadena, **visualmente diferenciada** de las líneas de fijos normales. Grafica **solo los meses en que su monto resulta `EXPENSE`** (RN-018), por su **magnitud** (RN-019); un mes en que resulta `INCOME` **no tiene punto** (hueco). Los calculados de único y de cuota no entran (su origen no es un fijo). La línea de un calculado de fijo es siempre una línea de **gasto**, aunque su origen sea un fijo de ingreso: los meses en que resulta `INCOME` siguen siendo hueco, no se grafican como ingreso. Su presencia en la card depende del toggle **"Mostrar calculados"** (ver abajo).
  - **Ítem de leyenda de un calculado de fijo** — además de su descripción muestra su **origen**: `↳ {descripción} · desde {Origen}`, donde `{Origen}` es la descripción del fijo del que deriva o, si no tiene, el **nombre de su categoría**. La forma visual la define `control-design`.
- **Fijo sin descripción** — en toda superficie de la card donde va la descripción, un fijo (o calculado) sin descripción se nombra con el **nombre de su categoría**.
- **Fijos de gasto y de ingreso en la misma card.** Las líneas de fijos de ingreso conviven con las de gasto y la dirección de cada línea es **identificable** por el usuario (el tratamiento visual lo define `control-design`). Cada línea conserva su dirección: el modo de visualización, la variación y la conversión de moneda aplican igual a ambas.
- **La ausencia es hueco, nunca cero.** Un mes sin aparición del fijo **no tiene punto**; nunca se grafica como cero. Es una **excepción explícita** al criterio de RF-REP-001 (mes sin datos = cero): un calculado puede valer **0 de verdad** (RN-018), así que graficar la ausencia en cero mentiría.
- **Selección de fijos (reemplaza el filtro por categoría).** El usuario elige a nivel de **fijo individual** (gasto o ingreso) cuáles se dibujan. En esta card **no** hay filtro por categoría: la selección por fijo lo sustituye. El universo ofrecido es el de la leyenda activa (ver abajo) —uno por línea, incluidos los calculados de fijo cuando el toggle "Mostrar calculados" está prendido—, **sin agrupar** ni colapsar ninguno en un ítem "Otros", y es **estable** (no se achica al destildar). La card nace con **todos** seleccionados.
- **Modo de visualización (3 lecturas del mismo dato, aplicadas por línea):**
  - **Montos** — cada línea en moneda, en la moneda de display de la card (RF-REP-007).
  - **Variación % nominal** — variación del monto de **cada fijo** respecto de **su pago anterior**, en puntos porcentuales. Sin punto si esa línea no tiene pago anterior conocido o si ese pago valió cero.
  - **Variación % ajustada por inflación** — la misma variación descontando la **inflación acumulada del tramo** entre los dos pagos (IPC nacional, RF-IPC-001); sin punto si no hay pago anterior o si falta el dato de IPC de **alguno** de los meses del tramo.
  - El **ajuste por inflación aplica solo a los modos de variación**, nunca al modo de montos.
- **La variación compara pagos consecutivos de la línea, no meses consecutivos del calendario.** El término de comparación de un punto es **la aparición anterior de ese mismo fijo**, esté donde esté:
  - Para un fijo **mensual** el pago anterior es el mes anterior.
  - Para un fijo de **frecuencia > 1** son los dos pagos consecutivos, salteando los meses sin aparición: un bimestral compara contra hace dos meses; un anual, contra hace doce.
  - Los **meses anulados** (`RecurringSkip`) no son pago y **no cortan la cadena**: la comparación va contra el último pago real previo.
  - El pago anterior **puede caer fuera del rango visible** y se usa igual, de modo que el **primer punto visible también tiene variación**.
- **La inflación del tramo es todo o nada.** El ajuste descuenta el IPC **acumulado compuesto** de los meses que van del pago anterior al pago del punto. Si falta el dato de IPC de **cualquiera** de esos meses, el punto **no tiene variación ajustada**: descontar solo una parte de la inflación del tramo daría un resultado engañosamente favorable. El mismo punto **sí** muestra su variación **nominal**.
- **La moneda de display incide en los tres modos.** Cada aparición se convierte a la moneda de display de la card (RF-REP-007) con la cotización de **su propio mes**, igual que en el resto de los reportes; los dos modos de variación se calculan **sobre los montos ya convertidos**, no sobre el monto en la moneda original del fijo.

**Comportamiento de la línea por caso de dominio:**

| Caso | Puntos | Línea |
|---|---|---|
| Fijo mensual vigente en todo el rango | un punto por cada mes del rango | continua |
| `frequency > 1` — mes sin aparición (RN-016) | sin punto | continua: los huecos internos **no parten** la línea |
| Mes anulado (`RecurringSkip`, RN-016 / RN-020) | sin punto | continua (hueco interno) |
| Fijo que arranca dentro del rango | empieza en su primera aparición | sin ceros antes |
| Fijo dado de baja (`deletedFrom`) | termina en su última aparición | **no** continúa en cero |
| Fijo eliminado (RN-026) | no entra | — |

**Rango (universo propio de la card):**

- **Selector de rango** — un **select único** con ocho opciones: **3 meses · 6 meses · 9 meses · 1 año · 2 años · 3 años · 4 años · 5 años**. **Default 3 años**, persistido por card. El tope de 5 años (60 meses) es el máximo de posiciones que el eje X admite sin perder legibilidad.
- **El borde derecho es siempre el mes en curso.** La card es **histórica**: no proyecta. **Ningún mes posterior al mes en curso se grafica**, aunque los fijos activos tengan monto conocido para él (RN-016) o lo proyecten (RN-006).
- **El borde izquierdo** es el mes que resulta de **restar el rango elegido al mes en curso**; el rango son esos meses corridos.
- **No hay navegación de rango.** La card **no tiene stepper ni año final**: el rango solo se estira hacia atrás desde el presente, así que **no se encuadra un período suelto del pasado**. Cambiar el rango corre el **borde izquierdo**; el derecho no se mueve.
- **Tope del borde izquierdo** — el rango se **recorta** contra el **primer mes con alguna aparición de un fijo** del usuario (de gasto o de ingreso): si se pide más rango del que hay historia, el rango arranca en ese mes y queda **más corto que el pedido** (el borde derecho no se corre para compensar).

**Universo de la leyenda (criterio de ≥2 apariciones):**

- **Se excluye del gráfico y de la leyenda activa todo fijo con menos de 2 apariciones graficables en el rango visible.** Una línea de un solo punto no dibuja evolución: es lo que la card muestra.
- **Aparición graficable** = mes con monto (el punto existe). **No cuentan**: los meses sin aparición por frecuencia (RN-016), los meses anulados (`RecurringSkip`), los meses previos al alta o posteriores a la baja, ni el mes en que un **calculado** resulta `INCOME` (RN-018).
- **El criterio se evalúa sobre las apariciones, no sobre el modo de visualización.** Cambiar de modo (montos / variación nominal / variación ajustada) **no cambia** el universo de la leyenda: un fijo con 2 apariciones sigue en la leyenda aunque en modo variación tenga menos puntos dibujables.
- **La selección persistida sobrevive a los cambios de rango.** Una cadena seleccionada que sale del universo al cambiar el rango **no se dibuja** y **vuelve tildada** si el rango la reincorpora; cambiar el rango **nunca reescribe** la selección.
- **Fijos nuevos en el universo.** Con la selección en "todos" (default), todo fijo que entra al universo —incluidos los de ingreso— aparece tildado. Con una selección **explícita**, un fijo que no está en ella —incluido un fijo de ingreso— aparece **destildado**: la selección explícita no se reescribe ni se migra.
- **Orden canónico de la leyenda** — una **sola lista** por **monto total del rango visible**, descendente, **sin agrupar por dirección** (gastos e ingresos intercalados); es **estable dentro de un mismo rango** y se recalcula al cambiarlo.

**Fijos excluidos alcanzables:**

- Un fijo excluido por el criterio de ≥2 apariciones **no se pierde de vista**: la card lo sigue exponiendo **fuera de la leyenda activa**, identificable por el usuario.
- La información que se muestra de cada excluido es su **mes de inicio** (el arranque de su cadena): con eso el usuario ubica desde cuándo existe el fijo.
- Un fijo excluido **no se dibuja ni se puede tildar**: la superficie de excluidos es **informativa**, no un segundo selector.

**Toggle "Mostrar calculados":**

- La card ofrece un toggle **"Mostrar calculados"**, **persistido por card** (`fixedShowCalculated`, ver `docs/data-model/preferencias.md` §`reports`). **Default apagado**, también para una card sin el campo persistido.
- **Apagado** — los calculados de fijo **desaparecen de toda la card**: gráfico, leyenda activa, contador de selección `N / M`, superficie de excluidos y tooltip.
- **Prendido** — los calculados de fijo entran con las reglas de esta sección (línea propia, criterio de ≥2 apariciones, excluidos alcanzables).
- **No reescribe la selección.** Apagarlo no toca `fixedSelectedIds`: un calculado conserva su estado de tilde y lo recupera al prenderlo. El `ordinal` y el color de cada línea **no cambian** al togglear.
- **"Todas" / "Ninguna" actúan sobre todo el universo, incluidos los calculados ocultos.** Con el toggle apagado, "Todas" deja la selección en "todos" y "Ninguna" la vacía también para los calculados que no se ven: al prender el toggle, cada calculado aparece con el estado que fijó la última de esas acciones. Es comportamiento intencional.
- **Visibilidad** — el toggle **no se muestra** si en el rango visible no hay ninguna línea ni ningún excluido que sea calculado de fijo. La visibilidad se evalúa sobre lo que trae el rango, **no** sobre lo que queda tras aplicar el toggle.
- **Apagado con un rango de solo calculados** — si todo lo que trae el rango son calculados de fijo, la card muestra un **estado vacío propio** (sin los calculados) y el toggle **sigue visible**, para poder prenderlo. El copy de ese estado lo define `control-design` y puede diferir del de rango sin fijos.
- **Toggle oculto no toca el valor** — mientras el toggle no se muestra, `fixedShowCalculated` **conserva** su valor persistido y vuelve a aplicar cuando otro rango trae calculados.
- **No aplica a la variante acotada** de la card de detalle de `/mes` (RF-VM-009): esa variante no tiene el toggle y el calculado se ve siempre.

**Criterios de aceptación:**
- [ ] La card `fixed-evolution` grafica **una línea por fijo seleccionado** (gasto o ingreso) sobre los **meses corridos del rango visible**. **No** hay línea total, suma ni agregación en ningún modo; cambiar la selección **agrega o quita líneas**.
- [ ] El eje X es **siempre mensual**: no hay agregación por año ni selector de granularidad, ni con el rango de 5 años.
- [ ] El alcance es **exclusivamente** movimientos de tipo **Fijo**, de gasto (`EXPENSE`) y de ingreso (`INCOME`): no entran cuotas ni únicos. La dirección de cada línea es identificable.
- [ ] La unidad de cada línea es el **fijo lógico (la cadena, `chainId`)**: los splits de edición (RN-005) se recomponen en **una sola línea** y el cambio de monto se ve como **escalón**.
- [ ] Los **calculados derivados de un fijo** entran como **líneas propias, visualmente diferenciadas** de los fijos normales; grafican **solo** los meses en que resultan `EXPENSE` (RN-018), por su **magnitud** (RN-019), y dejan **hueco** en los meses en que resultan `INCOME`; su línea es siempre de gasto, también cuando su origen es un fijo de ingreso.
- [ ] El ítem de leyenda de un calculado de fijo muestra su descripción **y su origen** (`↳ {descripción} · desde {Origen}`), no solo en el tooltip.
- [ ] La card ofrece el toggle **"Mostrar calculados"**, **apagado por defecto** (también en una card sin `fixedShowCalculated`) y **persistido por card**.
- [ ] Con el toggle **apagado**, ningún calculado de fijo aparece en el gráfico, la leyenda activa, el contador `N / M`, la superficie de excluidos ni el tooltip; con el toggle **prendido**, aparecen según las reglas de este RF.
- [ ] Apagar y volver a prender el toggle **restaura** el estado de tilde de cada calculado: `fixedSelectedIds` no se reescribe. El `ordinal` y el color de las líneas no cambian al togglear.
- [ ] Con el toggle **apagado**, "Todas" y "Ninguna" también tildan / destildan los calculados ocultos: al prender el toggle aparecen con ese estado.
- [ ] El toggle **no se muestra** cuando en el rango visible no hay ninguna línea ni excluido calculado de fijo.
- [ ] Con el toggle **apagado** y un rango que solo trae calculados de fijo, la card muestra su **estado vacío propio** (sin calculados, copy de `control-design`) y el toggle **sigue visible**.
- [ ] Con el toggle **oculto**, `fixedShowCalculated` **no se modifica**; al pasar a un rango con calculados, el toggle reaparece con el valor persistido y lo aplica.
- [ ] La variante acotada de la card de detalle de `/mes` (RF-VM-009) **no** tiene el toggle: un calculado se ve siempre.
- [ ] **La ausencia es hueco, nunca cero**, en todos los casos de la tabla de casos de dominio: mes sin aparición por frecuencia (RN-016), mes anulado, meses previos al alta y posteriores a la baja. Es **excepción explícita** al criterio de RF-REP-001.
- [ ] Los **huecos internos no parten la línea**: un fijo con frecuencia > 1 o con un mes anulado se dibuja como una sola línea continua sin punto en esos meses.
- [ ] Un fijo **eliminado** (RN-026) no entra en la card.
- [ ] La selección se hace a nivel de **fijo individual** y **reemplaza** al filtro por categoría: esta card **no** ofrece filtro por categoría. El universo es la leyenda activa del rango, **un ítem por fijo sin agrupar**, estable; la card nace con **todos** seleccionados.
- [ ] Un **select único de rango** ofrece ocho opciones —3, 6 y 9 meses; 1, 2, 3, 4 y 5 años— con **default 3 años** (también para una card sin el campo persistido).
- [ ] El **borde derecho del rango es siempre el mes en curso** y el izquierdo es el mes en curso menos el rango elegido. La card **no tiene stepper ni año final**: no se puede encuadrar un período suelto del pasado.
- [ ] La card **no grafica ningún mes posterior al mes en curso**, aunque haya monto conocido o proyectado de los fijos activos para esos meses (RN-006 / RN-016). Es un reporte histórico: no proyecta.
- [ ] El **borde izquierdo se recorta** contra el primer mes con alguna aparición de un fijo (gasto o ingreso) del usuario: el rango puede quedar **más corto** que el pedido y el borde derecho **no se corre** para compensar.
- [ ] Todo fijo con **menos de 2 apariciones graficables en el rango visible** queda **fuera del gráfico y de la leyenda activa**. Una **aparición graficable** es un mes con monto: no cuentan los meses sin aparición por frecuencia, los anulados, los previos al alta o posteriores a la baja, ni el mes en que un calculado resulta `INCOME`.
- [ ] El criterio se evalúa **sobre las apariciones, no sobre el modo**: cambiar de modo de visualización **no cambia** el universo de la leyenda.
- [ ] Un fijo excluido por el criterio de ≥2 apariciones **sigue expuesto en la card, fuera de la leyenda activa**, con su **mes de inicio**. Un excluido **no se dibuja ni se puede tildar**.
- [ ] La **selección persistida sobrevive a los cambios de rango**: una cadena que sale del universo no se dibuja y **vuelve tildada** si el rango la reincorpora.
- [ ] Con selección "todos", los fijos de ingreso aparecen tildados; con una selección explícita, un fijo que no está en ella aparece destildado (sin migración).
- [ ] La leyenda se ordena en una sola lista por **monto total del rango visible**, descendente, sin agrupar por dirección, estable dentro del rango.
- [ ] Las líneas de gasto y de ingreso comparten el mismo eje Y, graficadas por magnitud.
- [ ] Los modos de variación comparan cada punto contra el **pago anterior de esa misma línea**, no contra el mes anterior del calendario: un fijo de **frecuencia > 1** tiene variación en cada aparición (salteando los meses sin pago) y los meses **anulados no cortan la cadena** (se compara contra el último pago real previo).
- [ ] El **pago anterior se usa aunque caiga fuera del rango visible**: el primer punto graficado también tiene variación.
- [ ] La **variación ajustada** descuenta la **inflación acumulada del tramo** entre los dos pagos y queda **sin punto si falta el IPC de alguno** de los meses de ese tramo (nunca se descuenta inflación parcial); ese mismo punto conserva su variación **nominal**.
- [ ] Los **estados de la card** (vacío, error, sin selección) se expresan en términos del **rango**, no de un año suelto.
- [ ] Un selector de **modo de visualización** ofrece tres lecturas del mismo dato, aplicadas **por línea**: montos, variación % nominal y variación % ajustada por inflación.
- [ ] El **ajuste por inflación** (RF-IPC-001) aplica **solo** a los modos de variación; el modo de montos nunca se ajusta.
- [ ] La card reusa la **moneda de display por card** del widget de reporte (RF-REP-007), que incide en **los tres modos**: cada aparición se convierte con la cotización de **su propio mes** y los dos modos de variación se calculan sobre los montos **ya convertidos**.
- [ ] La selección de fijos, el modo de visualización, el **rango**, el toggle "Mostrar calculados" y la moneda se **persisten por card** en la clave `reports` (RF-REP-004); shape en `docs/data-model/preferencias.md`.
- [ ] La card existe en `/reportes` y, acotada a un fijo, en la vista evolución de la card de detalle de `/mes` (RF-VM-009); no se ofrece como widget del dashboard.
- [ ] La card **no expone** el toggle de movimientos simulados (RF-REP-017).

**Notas:**
- El rango se ancla al **mes en curso** porque este reporte **no admite simulación hacia adelante**: mira lo que efectivamente pasó, no lo que va a pasar.
- El criterio de **≥2 apariciones** existe porque la card grafica **evolución**: un fijo con un solo punto en el rango no muestra ninguna, y en un rango de 5 años ensucia la leyenda con cadenas que no dibujan nada.
- La **forma** de la superficie de **fijos excluidos** (sección aparte, lista colapsable, popover, tooltip, ícono de info) la define `control-design` (`docs/design.md`). Este RF fija **qué** tiene que poder saber el usuario, no cómo se ve.
- La forma concreta del **select de rango**, la del **control de modo** (tres opciones planas, o "Montos / Variación" con un sub-toggle de ajuste por inflación), la del **selector de fijos**, el tratamiento visual que distingue las líneas de **calculados** de las de fijos normales, la del ítem de leyenda de un calculado con su origen, la forma, ubicación y copys del toggle **"Mostrar calculados"**, el que distingue las de **ingreso** de las de **gasto**, y los **copys de los estados** (que hablan del rango) los define `control-design` (`docs/design.md`), no este RF.
- La card necesita el **monto mensual de cada cadena de fijo a lo largo del rango** (reconstruible de la cadena de splits `Recurring`, RN-005). Contrato del endpoint en `docs/data-model/informes.md`, §Contrato del detalle histórico de Fijos.
- **Por qué la variación se mide entre pagos consecutivos:** comparar contra el mes anterior del calendario deja **sin ningún punto** a los fijos de frecuencia > 1 —su mes anterior nunca tiene monto—, justo los fijos donde más interesa leer cuánto aumentaron. Para un fijo **mensual** da exactamente lo mismo, porque su pago anterior *es* el mes anterior.
- **Alcance exclusivo de `fixed-evolution`.** El rango multi-mes anclado al presente, el criterio de ≥2 apariciones y la superficie de excluidos **no se extienden** a los otros cinco tipos de card, que son anuales (RF-REP-002).
- La card **no** consume la proyección de fijos de RF-REP-015.
- **Qué mide la variación en moneda extranjera:** como los modos de variación se calculan sobre los montos ya convertidos, un fijo en moneda extranjera visto en otra moneda refleja **también** el movimiento del tipo de cambio, no solo lo que le aumentó el proveedor. Un fijo en USD que nunca cambió de monto, leído en ARS con el dólar subiendo 20%, marca **+20%**. Es el mismo criterio que usa `inflation-income` (RF-REP-012), para que dos cards con el mismo control no den números distintos.
- **Relación con Ingresos vs Gastos (RF-REP-014):** ambas son miradas sobre los fijos. Esta card es la mirada **desagregada, fijo por fijo**; Ingresos vs Gastos es la mirada de **totales con filtros por tipo / dirección / categoría**.

---

## RF-REP-014 — Filtros por tipo de movimiento y dirección en Ingresos vs Gastos

| Campo | Detalle |
|---|---|
| **Descripción** | La card de tipo `income-expense` (Ingresos vs Gastos, RF-REP-001) admite acotar qué movimientos entran en sus series mediante tres dimensiones de filtro **combinables**: **tipo de movimiento** (fijo / cuota / único, multi-selección), **dirección** (solo gastos / solo ingresos / ambos) y **categoría** (RF-REP-002). El default —todos los tipos, ambas direcciones, todas las categorías— computa todos los movimientos. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe una card de tipo `income-expense` (en `/reportes`). |

**Dimensiones de filtro (combinables):**

- **Tipo de movimiento** — `fijo` / `cuota` / `único`, **multi-selección**; default **los tres**. Acota qué tipos de movimiento aportan a los totales mensuales de ingresos y de gastos.
- **Dirección** — `solo gastos` / `solo ingresos` / `ambos`; default **ambos**. Acota qué dirección se computa en la serie.
- **Categoría** — el filtro de categorías del widget (RF-REP-002), con su lógica de tres estados (todas / subconjunto / ninguna), expuesto como la **leyenda-filtro de categorías tildables del footer** (igual que `by-category`).

Las tres dimensiones se combinan libremente (ej. "solo gastos fijos de la categoría X"; "todas las categorías pero solo gastos fijos"; "solo ingresos únicos").

**Criterios de aceptación:**
- [ ] La card `income-expense` admite filtrar por **tipo de movimiento** (fijo / cuota / único, multi-selección), **dirección** (solo gastos / solo ingresos / ambos) y **categoría** (RF-REP-002), de forma **combinable**.
- [ ] El **default** es **todos los tipos**, **ambas direcciones** y **todas las categorías**.
- [ ] Una card `income-expense` sin estos filtros configurados (campos ausentes) muestra **todo** (todos los tipos, ambas direcciones).
- [ ] El filtro acota **qué movimientos se computan** en los totales mensuales de ingresos y de gastos (mismo criterio de imputación mensual de RN-015).
- [ ] La configuración de filtros se **persiste por card** en la clave `reports` (RF-REP-004); shape en `docs/data-model/preferencias.md`.

**Notas:**
- La **forma de los controles** (cómo se exponen tipo y dirección, y la leyenda-filtro de categorías del footer) la define `control-design` (`docs/design.md`). La card **no** tiene leyenda interactiva de las series Ingresos/Gastos: la **dirección** es el único control de cuántas líneas dibuja el canvas (ambos = 2 líneas; solo gastos / solo ingresos = 1).

---

## RF-REP-015 — Proyección de gastos fijos a futuro (capacidad de backend, sin UI que la consuma)

| Campo | Detalle |
|---|---|
| **Descripción** | El backend sabe **proyectar los fijos hacia meses futuros**: el endpoint `GET /movements/reports` acepta pedir la proyección y, cuando se pide, extiende las series por **línea** (gasto e ingreso por separado) combinando (1) un **esqueleto determinista** que reconstruye, mes a mes, la canasta de fijos conocida que estará activa en el futuro, y (2) una **tasa de encarecimiento** medida sobre el crecimiento de precio propio de cada fijo activo. Solo se proyectan **fijos**: cuotas y únicos no entran en el tramo futuro. El **horizonte es ilimitado**: la proyección se calcula para cualquier año futuro. **Ninguna pantalla consume esta capacidad** —ni `/reportes` ni el dashboard—: no hay toggle ni control de proyección en ninguna card. Es una **capacidad retenida** del backend; la regla de cálculo se documenta acá porque es la parte valiosa y estable. |
| **Actor** | — (capacidad de backend, no expuesta a usuario) |
| **Prioridad** | Baja |
| **Precondiciones** | — |

**Regla de cálculo de la proyección:**

- **Método — esqueleto determinista × tasa de crecimiento de fijos, por línea.** La proyección se calcula por **línea** (gasto e ingreso por separado). Para cada mes futuro `m` (meses hacia adelante desde hoy):

  `valor_línea(m) = canasta_conocida(m) × (1 + tasa_precio)^m`

  compuesto, sin truncar decimales intermedios; el redondeo se aplica solo al valor final. El mes futuro de la línea vale **solo** este valor proyectado de fijos (cuotas y únicos no aportan al futuro).
- **`canasta_conocida(m)` — esqueleto determinista.** Suma, para el mes futuro `m`, del monto de los movimientos **fijos** en alcance que estarán **activos ese mes** según RN-016 (frecuencia, altas con `startMonth` futuro ya cargadas, `deletedFrom`, skips), cada uno a su **último monto conocido**, respetando los filtros de RF-REP-014 (dirección, tipos con `fijo` incluido, categorías tildadas). Solo entran fijos —normales y calculados-de-fijo—; cuotas y únicos no. Es **determinista**: la composición futura conocida (altas programadas, bajas, cadencia de un fijo anual/bimestral) se reconstruye acá, **no** se estima con la tasa. Un fijo con alta futura aparece en su mes; uno dado de baja deja de sumar; un anual reaparece solo en el mes que le toca.
- **`tasa_precio` — crecimiento propio de cada fijo, ponderado por tamaño.** Tasa mensual medida **por línea**, sobre las **cadenas de fijo activas hoy** en alcance (filtros de RF-REP-014, solo fijos). Para cada cadena `i`:
  - Se busca su **monto más viejo dentro de la ventana `[hoy-12 .. hoy-1]`**: el mes más antiguo —hasta 12 atrás— en que esa misma cadena estaba activa (`old_i`, a `n_i` meses de hoy); `today_i` es su monto hoy.
  - Una cadena **sin monto previo en la ventana** (alta reciente) o con `old_i <= 0` queda **excluida de la tasa** —pero sigue en `canasta_conocida`, para que un alta no infle la tasa.
  - `growth_i = (today_i / old_i)^(1/n_i) − 1` (CAGR mensual propio de esa cadena sobre su ventana disponible).
  - `tasa_precio` = promedio de los `growth_i` **ponderado por tamaño** (peso = `today_i`): `Σ(today_i · growth_i) / Σ(today_i)`, sobre las cadenas con historia previa.
- **Piso en 0 — nunca se proyectan bajas.** Se aplica `max(0, tasa_precio)` sobre el **agregado final** (nunca proyecta bajas). Si ninguna cadena tiene historia previa en la ventana, `tasa_precio = 0` (proyección plana al esqueleto).
- **Racional.** Se mide el crecimiento **real de cada fijo sobre su propia historia**, ponderado por tamaño, en vez de anclar en un único mes común de la ventana: así los fijos que varían cuentan aunque tengan pocos meses de historia, los planos aportan ~0, y las altas no inflan la tasa (las absorbe la canasta determinista).
- **Sin IPC.** El pronóstico **no** usa la inflación nacional (IPC) en ningún caso: ni como motor, ni como mezcla, ni como fallback. Un fijo nunca editado (monto constante, sin historial de precio) no aporta señal y contribuye plano a su monto real.
- **Skips.** Un skip es ausencia puntual, no cambio de precio: **no** cuenta para la tasa; sí afecta `canasta_conocida(m)` (un mes skippeado aporta 0 de ese fijo ese mes).
- **Moneda — serie de display.** La proyección se calcula sobre la serie en la **moneda de display** (montos ya convertidos con el TC de sus propios meses). Es una limitación conocida: mezcla parte de la variación de tipo de cambio en la tasa. Proyectar en moneda propia sería inviable sin tipos de cambio futuros.
- **Ventana 12 meses; horizonte ilimitado; solo fijos.** La ventana de la tasa es de 12 meses; el tramo proyectado no se corta a fin de año (se calcula para cualquier año futuro pedido) y solo extiende fijos.

**Criterios de aceptación:**
- [ ] El endpoint `GET /movements/reports` acepta pedir la proyección de fijos; sin pedirla, la respuesta no agrega tramo proyectado (comportamiento por defecto).
- [ ] Con la proyección pedida, las series se **extienden a los meses futuros** proyectando **solo los fijos**; cuotas y únicos **no** entran en el tramo proyectado.
- [ ] Cada mes futuro de cada línea vale `canasta_conocida(m) × (1 + tasa_precio)^m`, aplicado **compuesto** hacia adelante; el redondeo va solo al valor final.
- [ ] `canasta_conocida(m)` reconstruye de forma **determinista** los fijos activos ese mes según RN-016 (frecuencia, altas futuras, bajas, skips) a su último monto conocido, respetando los filtros de RF-REP-014: un fijo con alta futura aparece en su mes, un fijo dado de baja deja de sumar, un anual reaparece solo cuando le toca.
- [ ] `tasa_precio` es el **promedio ponderado por tamaño** (peso = monto hoy) del **CAGR mensual propio** de cada cadena de fijo activa hoy, medido contra su monto más viejo dentro de la ventana `[hoy-12 .. hoy-1]`; las cadenas sin historia previa en la ventana se **excluyen de la tasa** (pero siguen en la canasta).
- [ ] La tasa tiene **piso en 0** sobre el agregado final: nunca se proyectan bajas. Sin ninguna cadena con historia previa ⇒ proyección plana al esqueleto.
- [ ] La proyección **no usa IPC** en ningún caso (ni motor, ni mezcla, ni fallback).
- [ ] El **horizonte es ilimitado**: la proyección se calcula para cualquier año futuro; no se corta a fin de año.
- [ ] **Ninguna pantalla consume la proyección**: no hay toggle ni control de proyección en ninguna card (ni en `/reportes` ni en el dashboard).

**Notas:**
- La tasa se apoya en que el **historial de montos de cada fijo es reconstruible**: cada edición de monto de un fijo crea un **split en la cadena `Recurring`** (RN-005), de modo que el monto de cada cadena en su punta vieja de la ventana está disponible para medir su crecimiento propio.
- **Límite asumido — salto único vs. periódico.** Un aumento único e irrepetible es indistinguible de uno periódico en el dato disponible: la tasa lo trata igual que a un aumento repetible, por lo que puede **sobreestimar** tras un salto único.
- **Capacidad retenida, no consumida.** El backend conserva el soporte para responder la proyección (params `projectFixed` / `today` → `projected`; contrato en `docs/data-model/informes.md`, cálculo en `docs/backend/graficos.md` §Proyección de fijos a futuro), pero ningún consumidor la pide.
- **Relación con RF-REP-013:** la proyección de fijos y el Detalle histórico de fijos (RF-REP-013) son ambas miradas sobre los fijos; aquí es la mirada de **totales** proyectada a futuro, mientras que RF-REP-013 es la mirada **desagregada, una línea por fijo**, sobre montos conocidos.

---

## RF-REP-016 — Refrescar una card individualmente

| Campo | Detalle |
|---|---|
| **Descripción** | Cada card de `/reportes` —los seis tipos: income-expense (RF-REP-005), by-category (RF-REP-006), unique-grid (RF-REP-010), installment-gantt (RF-REP-011), inflation-income (RF-REP-012), fixed-evolution (RF-REP-013)— **y** el widget income-expense del Dashboard exponen en su cabecera un botón de **refrescar** que vuelve a pedir al backend **solo los datos de esa card**. El refetch es **independiente por card**: refrescar una no afecta a las demás. Reusa el mismo endpoint de datos de la card. El detalle visual (forma, ubicación, ícono, estado de carga) está en `docs/design.md`. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | El usuario está en `/reportes` (o en el Dashboard, para su widget income-expense). |

**Criterios de aceptación:**
- [ ] Cada uno de los seis tipos de card de `/reportes` y el widget income-expense del Dashboard exponen un botón de **refrescar** en su cabecera.
- [ ] Al accionarlo, la card **vuelve a pedir sus datos al backend** y **solo esa card** se recarga; las demás no se ven afectadas.
- [ ] El **feedback es solo un spinner** mientras recarga; **no hay toast** (ni de éxito ni de error).
- [ ] Si la recarga **falla**, la card muestra su propio **estado de error**.
- [ ] En **modo orden** (RF-REP-009) el botón de refrescar, como el resto de los controles internos de la card, **no está disponible**.

---

## RF-REP-017 — Movimientos simulados en una card de reporte (opt-in por card)

| Campo | Detalle |
|---|---|
| **Descripción** | Las cards `income-expense` (Ingresos vs Gastos) y `by-category` (Gastos por categoría) exponen un **toggle que habilita los movimientos simulados** (módulo 3.15, `simulacion.md`) en el tramo del año que la card muestra que cae **dentro de la unión de tramos** de las simulaciones del usuario —que arranca **como mínimo desde el mes en curso**—. Es un control **por card**, persistido junto al resto de su config (clave `reports`, RF-REP-004) —mismo patrón que el techo de color de `unique-grid` (RF-REP-010)—, **apagado por defecto**: una card sin el toggle habilitado grafica **solo lo real**. Ninguna otra card lo expone; el dashboard tampoco. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe una card `income-expense` o `by-category` en `/reportes`. |

**Alcance por tipo de card:**

| Card | Toggle | Motivo |
|---|---|---|
| `income-expense` | **Sí** | Grafica montos de únicos + fijos + cuotas; el simulado es un único y suma a la serie de su dirección. |
| `by-category` | **Sí**, solo los simulados que resultan **gasto** | Descompone el gasto del mes por categoría; el simulado aporta a la porción de su categoría. |
| `unique-grid` | **No — imposibilidad estructural** | La grilla ubica cada gasto en una celda **día × mes** y el movimiento simulado **no tiene día** (RF-SIM-003): no hay celda donde ponerlo. |
| `installment-gantt` | No | Grafica solo **cuotas**; el simulado es un único. |
| `fixed-evolution` | No | Grafica una **línea por fijo**; el simulado es un único. |
| `inflation-income` | No | Grafica **variaciones porcentuales contra el IPC**, no montos. |

**Comportamiento con el toggle habilitado:**

- **Unión de tramos, desde el mes en curso como mínimo.** El simulado entra en los meses **dentro del tramo de cada simulación** (RF-SIM-002); la card, en conjunto, alcanza la **unión** de esos tramos, que arranca como mínimo en el **mes en curso** — una simulación nunca alcanza meses pasados. Los **meses pasados** de la card no cambian nunca.
- **El mes en curso de la card es un mes mixto:** su valor es lo real a la fecha **más** el remanente simulado (RF-SIM-002), y entra en la capa simulada como cualquier otro mes del tramo.
- **Tramo alcanzable.** La unión de tramos es alcanzable **en su totalidad** desde `/reportes`, **por construcción**: con el toggle encendido los tramos de las simulaciones son dato propio de la card para el **límite de navegación de año** (RF-REP-002, §Límites de navegación de año), así que el rango llega al último año del tramo aunque no haya dato real en ese año. El tramo de una simulación cuyo `endMonth` cae en el **año siguiente** (`startMonth + 6`, RF-SIM-002) se ve navegando a ese año. Hacia atrás no hay nada que alcanzar: la unión arranca como mínimo en el **mes en curso** y los meses pasados de la card nunca llevan simulados.
- **Aporte en `income-expense`.** Cada simulado suma su **magnitud** a la serie de su **dirección derivada** (RN-019): gasto a la serie de gastos, ingreso a la de ingresos.
- **Aporte en `by-category`.** Entran **solo los simulados que resultan gasto** (`EXPENSE`), apilados en la porción de **su categoría simulada**. Un simulado que resulta **ingreso** queda afuera de esta card, igual que cualquier ingreso real (RF-REP-001). Como la dirección se deriva del signo mes a mes (RF-SIM-002), la **misma** simulación puede aportar porción en un mes futuro y no en el siguiente.
- **Invariante de `by-category`.** La suma de las porciones de un mes futuro sigue igualando el total de gastos **que esa card muestra** (real + simulado de gasto). La igualdad con la serie "gastos" de una card `income-expense` (RF-REP-001) se sostiene solo cuando **ambas cards tienen el toggle en el mismo estado**: el control es por card.
- **Filtros de la card — el simulado es un único.** Lo alcanzan como a cualquier único: por **tipo de movimiento** entra con `único` y destildar `único` lo saca (RF-REP-014, solo `income-expense`); por **dirección**, según su dirección derivada del mes (RF-REP-014); por **categoría**, según su categoría simulada (RF-REP-002). Ese mismo alcance rige para el **límite de navegación de año**: un tramo que el filtro vigente no deja pasar no extiende el rango de la card. La **categoría simulada entra al universo** del filtro de la card aunque no tenga movimientos reales en el año; con el toggle apagado, no. El universo sigue siendo **estable** (no se achica al destildar).
- **Moneda.** El simulado se re-expresa a la **moneda de display de la card** (RF-REP-007) como cualquier otro dato.
- **Distinción visual, sin aviso textual.** La porción simulada se distingue **dentro del gráfico**; la card **no** lleva el aviso de composición ("incluye N simulados") que `/mes` exige (RF-SIM-003): habilitar el toggle ya es la declaración del usuario. El detalle visual lo define `control-design` (`docs/design.md`).
- **Límites (RF-LIM-003).** Las **marcas pasivas** evalúan siempre el **dato que la card muestra**: con el toggle habilitado, el valor **con** simulados; apagado, el real. El toggle no agrega keys — las de la card (`reporte.ie.*`, `reporte.cat.*`) son las mismas. Los reportes no tienen límites activos (RF-LIM-004). **Consecuencia:** un límite de alcance **"mes en curso"** puede quedar marcado en `/reportes` sobre **dato estimado** (real a la fecha + remanente), porque ese es el dato que la card muestra.
- **Simulación pausada.** Una simulación pausada (RF-SIM-002) no deriva movimientos: no aporta nada a la card y eso no es un error.

**Disponibilidad del control:** el toggle está **siempre presente** en las dos cards y se ofrece **deshabilitado con el motivo visible** —nunca oculto— en dos casos: el usuario **no tiene ninguna simulación**, o el año que la card muestra **ya pasó** (`año < año en curso`) — en este segundo caso el motivo explica que las simulaciones **no alcanzan meses pasados**. El **año en curso nunca se deshabilita por el año**: siempre tiene al menos un mes simulable —el mes en curso—, incluso en diciembre. La **precedencia** entre los dos motivos: "no tenés ninguna simulación" gana sobre el motivo de año. Deshabilitar el control **no apaga el valor persistido**: al volver a un año alcanzado por alguna simulación, la card retoma el estado que tenía.

**Criterios de aceptación:**
- [ ] El toggle existe **solo** en `income-expense` y `by-category` de `/reportes`; las otras cuatro cards no lo exponen y el **dashboard** no lo tiene en ninguna superficie.
- [ ] El **default es apagado**: una card sin el toggle habilitado grafica solo lo real.
- [ ] El estado del toggle se **persiste por card** en la clave `reports` (RF-REP-004); shape en `docs/data-model/preferencias.md`.
- [ ] Habilitado, los simulados entran **solo** en los meses **dentro del tramo de cada simulación** (RF-SIM-002); la card alcanza la **unión** de esos tramos, que arranca **como mínimo en el mes en curso**; los meses pasados de la card no cambian.
- [ ] En `income-expense` cada simulado suma su **magnitud** a la serie de su **dirección derivada** (RN-019).
- [ ] En `by-category` entran **solo** los simulados que resultan **gasto**; uno que resulta **ingreso** no aparece en esa card.
- [ ] Los **filtros** de la card alcanzan al simulado **como a un único**: tipo `único`, dirección derivada y categoría simulada; esa categoría entra al universo del filtro con el toggle habilitado.
- [ ] Con el toggle habilitado, el **límite de navegación de año** de la card incluye los tramos de las simulaciones (RF-REP-002); con el toggle apagado, solo el dato real.
- [ ] Las **marcas pasivas** (RF-LIM-003) evalúan el dato que la card muestra: con simulados si el toggle está habilitado, real si no. El toggle no agrega keys.
- [ ] El toggle se ofrece **deshabilitado con el motivo visible** (nunca oculto) sin simulaciones del usuario o en un **año anterior al año en curso**, **sin perder** el valor persistido. El **año en curso siempre lo ofrece habilitado** (con simulaciones), incluso en diciembre.
- [ ] La card **no** muestra aviso textual de composición: la distinción es visual, dentro del gráfico.

**Notas:**
- **Asimetría con RF-REP-015 (proyección de fijos, capacidad de backend sin UI).** Las dos extienden el tramo futuro de una card y solo una tiene control de usuario; la diferencia es **quién declara ese futuro**. La simulación es una **elección explícita del usuario** —eligió la categoría (RF-SIM-001) y ya ve su resultado en `/mes` (RF-SIM-003)—, con tramo acotado, y el toggle solo lleva a `/reportes` un dato que el usuario pidió. La proyección de fijos es una **estimación del sistema**, de horizonte ilimitado, que nadie declaró. Habilitar este toggle **no** activa la proyección de fijos: los meses futuros de la card siguen valiendo lo que aportan los fijos activos y las cuotas en tramo (RN-006), más los simulados.
- El detalle visual del toggle y de la distinción de la porción simulada lo define `control-design` (`docs/design.md`).
