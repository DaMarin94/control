# Roadmap — Límites y Alertas (P2)

> **Working doc descartable, exclusivo de P2.** Documento de trabajo del sistema de **Límites y Alertas**, en **fase de descubrimiento**. Es el item más grande y transversal del roadmap (`docs/roadmap.md`) y va **último**. Se borra al cerrar la versión; los RF/RN definitivos se escriben en `requirements.md` cuando el item se implemente.

Nombre de trabajo: **Límites y Alertas** (o "Límites"). "Límite" = la configuración que activa las distintas alertas, marcas de línea o cambios de estilo en reportes y pantallas.

---

## Intención completa

Un sistema para que el usuario **configure libremente** límites y alertas sobre **cualquier dato de reportes y de `/mes`**. Objetivo central de la app CONTROL: previsibilidad.

- **Abarcativo y profundo.** La idea es poder poner límites en **CUALQUIER reporte** y sobre **cualquier dato de `/mes`**. Implica ofrecer **múltiples lugares** donde marcar o resaltar objetos, líneas, números, meses — **lo que sea resaltable**. El alcance es **amplísimo**, sin recortes.
- **Aplicación condicional.** Las líneas/palabras/sobreescrituras se muestran o aplican **condicionalmente**: si cierta configuración está activada → cierto límite se muestra / cierta alerta se dispara.
- **Keys hardcodeadas como "lenguaje común".** Un registro de keys hardcodeadas —a propósito hardcodeadas— que son las comunes para disparar cada acción, por consistencia. Actúan como lenguaje compartido entre las partes que las emiten (anclajes en pantalla) y las que las consumen (config del usuario).
- **Dos naturalezas de disparo:**
  - **Marca visual pasiva** — resaltar líneas / números / cambiar estilos al cruzar un límite en `/mes` y reportes.
  - **Alerta activa** — advertencia al intentar hacer **X movimiento**.
- **Panel en Configuración.** Nueva solapa en la pantalla de configuración para **crear / borrar** límites (sin editar en v1, D8). Es el **gestor de límites de toda la app**: lee el resto de la config del usuario (reportes creados con sus títulos y filtros, secciones) como **referencia de solo lectura** para dar contexto, sin re-editarla (D7).

---

## Enfoque acordado

- **Descubrimiento-primero.** control-analyst modela el **concepto completo** antes de cualquier planificación de implementación:
  - qué es un "límite",
  - catálogo de **keys hardcodeadas** y qué dispara cada una,
  - mapa de **todos los anclajes** de `/mes` y de **todos los reportes**,
  - diseño del panel de configuración.

  Con el modelo **aprobado por el usuario** se planifica back / front / design.
- **Alcance entero, sin recortes.** Cubre todos los anclajes posibles; nada acotado.

---

## Semilla del descubrimiento (restricciones acordadas)

1. **Límites por usuario.**
2. **Persistencia.** Arranca en el **blob de preferencias**, clave nueva `limits`, igual que `reports` / `monthSections` ("tu config es tu pantalla"). Se revisa **solo si** el descubrimiento halla necesidad de evaluación server-side.
3. **Dos naturalezas de disparo** (ver arriba): marca visual pasiva + alerta activa al intentar X movimiento. El descubrimiento **prioriza cuál se ataca primero**.
4. **Evaluación client-side en v1.** Se evalúan en el frontend sobre datos que **ya tiene**; el backend queda afuera (blob opaco, como `theme` / `reports`). Las keys hardcodeadas son un **registro compartido front ↔ design** (el "lenguaje común").

---

# Modelado conceptual (borrador para aprobación)

> **Estado: modelo con decisiones cerradas (D1–D10, §6), pendiente de traducir a RF.** Modela el concepto completo. Las decisiones de producto están resueltas; los nombres de campos/keys siguen siendo **provisionales** hasta que se traduzca a RF en `requirements.md`, a shape en `data-model.md` (clave `limits` del blob) y a pantalla en `screens.md`. La clave `limits` es **frontend-pura / blob opaco**, igual que `theme` / `reports` / `monthSections` (el backend no la valida ni conoce; normalización y defaults del front).

## 1. Anatomía de un "límite"

Un **límite** es una regla que **observa un dato** (vía su key del catálogo), lo **compara contra un umbral** y, si se cumple la condición, **dispara un efecto** de una de las dos naturalezas. Vive como una entrada en el array `limits` del blob de preferencias.

### Shape propuesto del objeto límite

```
LimitConfig = {
  id: string,                 // id local (key de React / borrar); generado en el front
  label?: string,             // nombre opcional dado por el usuario; ausente = placeholder derivado de la key + umbral
  enabled: boolean,           // toggle on/off sin borrar la regla

  anchorKey: string,          // key del catálogo hardcodeado (§2) que este límite observa
  refinement?: {              // acota la key cuando emite muchas instancias (ver "keys con refinamiento")
    section?: "unicos" | "fijos" | "cuotas",   // para keys de sección de /mes
    categoryId?: string                        // para keys por categoría
  },

  temporalScope: "all" | "current",  // a qué meses aplica: todos los meses navegables | solo el mes en curso (D4)

  operator: "gt" | "gte" | "lt" | "lte" | "eq",   // comparación dato {op} umbral
  threshold: number,          // número puro de comparación; su tipo (money/percent/count) lo fija el `unit` de la key (§2). Sin moneda: la app es equivalente en cuanto a monedas (D3)

  nature: "passive" | "active",   // marca visual pasiva | alerta activa al intentar el movimiento
  effect?: string             // (solo passive) identificador del estilo/efecto a aplicar; el catálogo de efectos lo define control-design
}
```

- **La regla es semántica, no atada a un widget puntual.** Un límite se vincula a la **key + refinamiento**, no a una card o instancia concreta. Consecuencia: el mismo límite ilumina **en todo anclaje que emita esa key** (p. ej. "gasto del mes > X" marca el total en `/mes` y en el dashboard; "gasto de categoría Comida > X" marca esa categoría dondequiera que aparezca). Esto es lo que hace de las keys un "lenguaje común".
- **`unit` no vive en el límite: lo hereda de la key.** El catálogo (§2) declara el tipo de dato de cada key (`money` / `percent` / `count` / `signed-money`); eso determina cómo se interpreta `threshold` y qué input muestra el panel (monto / porcentaje / entero).
- **El umbral es un número puro, sin moneda.** La app es equivalente en cuanto a monedas; no se modela moneda en el umbral. El umbral se compara directamente contra el número que muestra el anclaje, en la unidad de su `unit`. No hay conversión de moneda en la evaluación (D3).
- **Condición única.** Un límite es exactamente **una** condición `dato {operador} umbral`. No hay condiciones compuestas (AND/OR) ni umbrales escalonados en el shape (D1); un efecto escalonado se modela como **varios límites sobre la misma key con distinto umbral/efecto**.
- **Alcance temporal.** `temporalScope` decide a qué meses aplica el límite: `all` marca cualquier mes que exceda al navegar, `current` solo el mes en curso (D4).
- **Naturaleza y efecto.** `passive` → aplica una marca/estilo al anclaje. `active` → intercepta el flujo de guardar un movimiento, **avisa y deja continuar** (no bloquea el guardado, ver §4 y D10). El **catálogo de efectos visuales** de la marca pasiva lo define `control-design` en `docs/design.md` (D9); acá `effect` es solo el identificador que apunta a una entrada de ese catálogo.
- **Impacto visual nulo con config vacía (restricción dura).** Con **cero límites configurados**, la app se ve **exactamente igual que hoy**. Ningún anclaje cambia de estilo, ni aparece UI de marca pasiva, mientras el array `limits` esté vacío (D9).

## 2. Catálogo de keys hardcodeadas

Naming propuesto: `<pantalla/objeto>.<métrica>`. `unit`: `money` (centavos + moneda), `signed-money` (monto con signo, p. ej. balance), `percent` (puntos %), `count` (entero). Columna **Disparo**: **P** = admite marca pasiva, **A** = admite alerta activa (ver §4 para por qué A se acota a datos de mes).

### Vista del mes (`/mes`) — y dashboard (mismo dato para el mes en curso)

| Key | Dato | Emitido en | unit | Refinamiento | Disparo |
|---|---|---|---|---|---|
| `mes.total.gasto` | Total de gastos del mes | `/mes` totales · dashboard resumen | money | — | P, A |
| `mes.total.ingreso` | Total de ingresos del mes | `/mes` totales · dashboard resumen | money | — | P, A |
| `mes.balance` | Balance del mes (ingresos − gastos) | `/mes` totales · dashboard resumen | signed-money | — | P, A |
| `mes.seccion.subtotal` | Subtotal de una sección | cabecera de sección de `/mes` | money | `section` | P, A |
| `mes.seccion.conteo` | Cantidad de ítems de una sección | pill contador de la cabecera | count | `section` | P, A |
| `mes.item.monto` | Monto convertido de una línea de movimiento | cada ítem de `/mes` | money | (`categoryId` opcional) | P, A |
| `mes.categoria.gastoMes` | Total gastado en una categoría en el mes | *derivado* (hoy no tiene número propio renderizado) | money | `categoryId` | P, A |

- **Dashboard reutiliza estas keys** para el mes en curso: el resumen del dashboard (RF-DASH-002) muestra el mismo dato que los totales de `/mes`, así que no necesita keys propias.
- **`mes.categoria.gastoMes` es dato derivado, no un número renderizado hoy** en `/mes` (solo se ve como subtotal de sección al filtrar por esa categoría). Se incluye por ser el límite más natural ("no gastar más de X en Comida este mes"): las keys sobre datos derivados/no renderizados se exponen igual (D2). El front calcula y marca ese dato aunque no exista como número suelto en pantalla.

### Reportes — card `income-expense` (Ingresos vs Gastos) + widget del dashboard

| Key | Dato | unit | Refinamiento | Disparo |
|---|---|---|---|---|
| `reporte.ie.gastoMes` | Gasto de un mes en la serie anual | money | — | P |
| `reporte.ie.ingresoMes` | Ingreso de un mes en la serie anual | money | — | P |

- El **widget income-expense del dashboard** (efímero) emite estas mismas keys. Como es efímero (año en curso, sin persistir), la marca pasiva aplica sobre lo que muestre en el momento.

### Reportes — card `by-category` (Gastos por categoría)

| Key | Dato | unit | Refinamiento | Disparo |
|---|---|---|---|---|
| `reporte.cat.gastoMesCategoria` | Gasto de una categoría en un mes (banda apilada) | money | `categoryId` | P |
| `reporte.cat.gastoMesTotal` | Total de gasto apilado del mes (suma de bandas) | money | — | P |

### Reportes — card `unique-grid` (Gastos Únicos)

| Key | Dato | unit | Refinamiento | Disparo |
|---|---|---|---|---|
| `reporte.unicos.celda` | Gasto Único de un día (celda día×mes) | money | — | P |
| `reporte.unicos.mesTotal` | Total mensual de Únicos (footer) | money | — | P |
| `reporte.unicos.promedioDiario` | Promedio diario del mes (footer) | money | — | P |
| `reporte.unicos.pctVsPrev` | % de diferencia vs. mes anterior (footer) | percent | — | P |
| `reporte.unicos.inflacionMes` | Inflación IPC del mes (footer) | percent | — | P |
| `reporte.unicos.pctVsPrevAjustado` | % vs. mes anterior ajustado por inflación (footer) | percent | — | P |

- `colorAnchorCents` **no** es una key: es escala de paleta, no un dato de negocio.

### Reportes — card `installment-gantt` (Gastos en Cuotas)

| Key | Dato | unit | Refinamiento | Disparo |
|---|---|---|---|---|
| `reporte.cuotas.montoPorCuota` | Monto por cuota de una compra (barra) | money | — | P |
| `reporte.cuotas.cantidadCuotas` | Cantidad total de cuotas del plan | count | — | P |

### Reportes — card `inflation-income` (Inflación vs Ingresos)

| Key | Dato | unit | Refinamiento | Disparo |
|---|---|---|---|---|
| `reporte.infl.inflacionMes` | Inflación IPC del mes | percent | — | P |
| `reporte.infl.ingresoVarMes` | Variación % mensual del ingreso (nominal) | percent | — | P |
| `reporte.infl.ingresoVarAjustado` | Variación % mensual del ingreso ajustada por inflación | percent | — | P |

- Las **rectas de tendencia / pendientes** (`slope`/`intercept`, OLS) quedan **fuera de alcance de v1**: no se proponen como keys ni se marcan (D6).
- `reporte.unicos.inflacionMes` y `reporte.infl.inflacionMes` son el mismo dato IPC en dos anclajes distintos, pero se modelan como **keys separadas por anclaje** (D5): un límite sobre una no ilumina la otra.

## 3. Mapa completo de anclajes

Barrido de todo dato resaltable, con su key y sus disparos admitidos.

- **`/mes`:** totales del mes (gasto/ingreso/balance), por cada sección su subtotal y su contador, cada línea de movimiento su monto, y el gasto-por-categoría-del-mes (derivado). Todos admiten **P**; los de nivel mes admiten además **A** (el guardado de un movimiento en ese mes cambia el dato).
- **Dashboard:** resumen del mes en curso → reusa `mes.total.*` / `mes.balance` (P + A). Widget income-expense efímero → `reporte.ie.*` (P).
- **Reportes, por tipo de card:**
  - `income-expense`: gasto e ingreso por mes (P).
  - `by-category`: gasto por categoría-mes y total apilado del mes (P).
  - `unique-grid`: celda diaria + 5 métricas del footer (total, promedio diario, %vs prev, inflación, %vs prev ajustado) (P).
  - `installment-gantt`: monto por cuota y cantidad de cuotas por barra (P).
  - `inflation-income`: inflación del mes, variación de ingreso nominal y ajustada (P).

**Regla de disparo por naturaleza (resumen):** **P (marca pasiva)** es universal — cualquier dato renderizado puede recibir marca. **A (alerta activa)** se acota a los datos de **nivel mes de `/mes`** (totales, balance, subtotal/contador de sección, monto de ítem, gasto-categoría-del-mes), porque son los que un movimiento que se está por guardar **modifica en el acto**. Los datos de reportes son anuales/retrospectivos: no hay un "intentar X movimiento" que los altere puntualmente (salvo el mes en curso, que ya está cubierto por las keys `mes.*`).

## 4. Naturalezas de disparo + priorización

| | Marca visual pasiva | Alerta activa |
|---|---|---|
| **Qué hace** | Al renderizar, si el dato cruza el umbral → aplica estilo/marca | Al intentar guardar un movimiento, si el resultado cruzaría el umbral → **avisa y deja continuar** (no bloquea el guardado) |
| **Sobre qué datos** | Todos (todo el catálogo) | Solo datos de mes (`mes.*`) |
| **Momento de evaluación** | Read-path: sobre datos que el front **ya tiene** renderizados | Write-path: hay que **proyectar** el dato post-movimiento (sumar el nuevo monto, imputarlo al mes/categoría/sección correctos) |
| **UX nueva requerida** | Ninguna (solo estilo condicional) | Interceptar el flujo de guardado para **advertir sin frenar** la confirmación (D10) |

### Recomendación: **atacar primero la marca visual pasiva.**

Fundamentos:

1. **Encaja con la evaluación client-side v1.** La marca pasiva se computa sobre datos **ya renderizados** (totales, series, celdas). No requiere backend ni recalcular nada nuevo: es puro estilo condicional sobre lo que la pantalla ya muestra. La semilla fija exactamente eso (evaluación en el front sobre datos que ya tiene).
2. **Cobertura máxima con la menor superficie.** Pasiva cubre **todo el catálogo** (todos los anclajes de `/mes`, dashboard y las 5 cards). Entrega el valor de "previsibilidad" de inmediato y en todas las pantallas.
3. **La activa es un flujo write-path con más aristas.** Exige proyectar el estado post-movimiento (imputar el nuevo monto al bucket correcto, comparar) y enganchar el modal de carga para avisar sin frenar (D10). Es más chica en anclajes (solo mes) pero más cara en implementación y casos borde.
4. **La activa reutiliza el mismo modelo.** Una vez probado el catálogo de keys + umbral + comparación con la pasiva, la activa se monta encima (mismas keys `mes.*`, misma comparación, distinto momento). Nada se tira.

**Conclusión:** v1 = marca pasiva sobre todo el catálogo; alerta activa como segunda fase sobre las keys `mes.*`.

## 5. Panel de Configuración

Nueva **solapa en `/configuracion`** (pantalla 9 de `screens.md`) que es el **gestor de límites de toda la app**: el lugar único para administrar (crear / listar / borrar) los límites. Gestiona **solo límites** — no re-edita órdenes, filtros ni reportes (D7).

### Config del usuario que consume el panel

El panel gestiona límites; el resto de la config del blob (`data-model.md`, §Claves del blob) la **lee como referencia de solo lectura** para dar contexto (qué reportes/secciones existen y qué keys tienen activas), **sin re-editarla** — cada cosa se sigue editando en su pantalla nativa (D7).

| Fuente | Qué aporta al panel |
|---|---|
| `reports` | Reportes creados: su **título** (o placeholder "Reporte N"), tipo, año, filtro de categorías → contexto de qué keys de reporte hay activas |
| `monthSections` | Secciones de `/mes` disponibles para refinar keys de sección |
| `limits` (**nueva**) | Los límites del usuario (lo único editable desde el panel) |

### Administración de límites (crear / listar / borrar)

En v1 el panel **crea** y **borra** límites; **no edita** un límite existente ni su key ni su umbral (D8). Para cambiar un límite se borra y se crea de nuevo. El toggle `enabled` permite desactivar sin borrar.

- **Listado:** todos los límites del array `limits`, con su label (o placeholder derivado), la key que observan (rótulo legible), su condición (`{operador} {umbral}`), su naturaleza (pasiva/activa) y su toggle `enabled`.
- **Crear:** el flujo arranca **eligiendo una key del catálogo**, presentado **agrupado por pantalla/objeto** (Vista del mes · Dashboard · cada tipo de reporte) con rótulos legibles. Elegida la key:
  - si la key tiene **refinamiento**, se pide (selector de sección o de categoría);
  - se elige el **alcance temporal** (`temporalScope`: todos los meses / mes en curso, D4);
  - el **`unit`** de la key define el input del umbral (monto / porcentaje / entero, **número puro sin moneda**) y qué operadores ofrecer;
  - se elige la **naturaleza** (pasiva siempre; activa solo habilitada si la key admite **A**);
  - (pasiva) se elige el **efecto** del catálogo visual de `control-design`.
- **Borrar:** quita la entrada del array.
- **Persistencia:** cada cambio reescribe el blob completo vía `PUT /preferences` (`{ ...preferences, limits: [...] }`), semántica de reemplazo total (igual que `reports`).

### Relación límites ↔ keys

El panel es el **consumidor** del catálogo (§2); los anclajes son los **emisores**. El catálogo hardcodeado es el contrato entre ambos: el panel solo puede crear límites sobre keys que existen, y cualquier anclaje que emita una key evalúa automáticamente los límites que la referencian. Ni el panel ni los anclajes inventan keys en runtime.

## 6. Decisiones cerradas

| # | Tema | Resolución |
|---|---|---|
| **D1** | Complejidad de la condición | Condición **única** (`dato {operador} umbral`). Sin compuesto (AND/OR) ni escalonado en v1. Un efecto escalonado se arma con varios límites sobre la misma key. |
| **D2** | Keys sobre datos derivados/no renderizados | **Se exponen.** Ej.: `mes.categoria.gastoMes` (límite sobre el gasto de una categoría del mes) aunque no exista como número suelto en pantalla; el front lo calcula y lo marca. |
| **D3** | Moneda del umbral | El umbral es un **número puro, sin moneda**. Se elimina `thresholdCurrency` del shape. La app es equivalente en cuanto a monedas; no se modela moneda en el umbral ni hay conversión en la evaluación. |
| **D4** | Alcance temporal | **Configurable** por límite vía `temporalScope` (todos los meses / mes en curso). |
| **D5** | Inflación: una key o varias | **Una key por anclaje.** `reporte.unicos.inflacionMes` y `reporte.infl.inflacionMes` quedan **separadas**; un límite sobre una no ilumina la otra. |
| **D6** | Tendencias/pendientes (slopes OLS) | **Fuera de alcance de v1.** No se modelan como keys ni se marcan. |
| **D7** | Alcance del panel de Configuración | El panel gestiona **solo límites** (de toda la app). El resto de la config se **muestra como referencia de solo lectura**; no se re-edita desde acá (cada cosa se edita en su pantalla nativa). |
| **D8** | Edición de límites | v1 = **crear y borrar** nomás. No se edita un límite existente (ni su key ni su umbral); para cambiarlo se borra y se recrea. `enabled` permite desactivar sin borrar. |
| **D9** | Efectos visuales (marca pasiva) | El **catálogo de efectos** lo define `control-design` en `docs/design.md` (se delega en paralelo). **Restricción dura:** con **cero límites** configurados, la app se ve **exactamente igual que hoy** (impacto visual nulo con config vacía). |
| **D10** | Alerta activa | **Avisa y deja continuar.** No bloquea el guardado del movimiento. |
