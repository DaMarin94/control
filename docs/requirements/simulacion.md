# 3.15 Módulo: Simulación de categoría

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Modelo `Simulation`, endpoints y shapes: `docs/data-model/simulacion.md`.

La simulación proyecta, a lo largo de un **tramo propio** que arranca en el mes desde el que se la crea y **nunca alcanza meses pasados**, el comportamiento de **una categoría** a partir de su historia reciente, y lo muestra como movimientos en la Vista del mes (`/mes`, RF-SIM-003) y —**opt-in por card**— en las cards de Ingresos vs Gastos y Gastos por categoría de `/reportes` (RF-REP-017). Lo que muestra en cada mes es el **remanente**: lo que falta para llegar a lo proyectado, descontando los únicos reales que ese mes ya tiene (RN-028).

Su alcance son **únicamente los movimientos únicos**. Los fijos y las cuotas ya se calculan on-the-fly en cualquier mes (RN-006): navegando a un mes del tramo de una simulación, los fijos activos y las cuotas en tramo **ya aparecen**. El único hueco son los **Únicos** — simular fijos o cuotas duplicaría lo que el sistema ya sabe.

La simulación **no genera filas**: lo que persiste es su configuración (usuario + categoría) y su **tramo** (RN-028/029); los movimientos simulados se **derivan al vuelo** en cada lectura, igual que los fijos y las cuotas.

---

## RF-SIM-001 — Crear una simulación de categoría

| Campo | Detalle |
|---|---|
| **Descripción** | Desde el **disparador de filtro de la sección Únicos** de `/mes` (RF-VM-006), la acción **"Simular categoría"** crea simulaciones sobre **una o varias** categorías en **una sola operación**, todas **ancladas al mes visualizado** (RN-028). Lo que persiste es la configuración (usuario + categoría) y el **tramo** resuelto al crear: ni monto ni dirección se ingresan — salen del cálculo (RF-SIM-002). Un usuario puede tener **varias simulaciones a la vez**, como máximo **una por categoría**. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario está en `/mes`. |

**Flujo principal:**
1. El usuario abre el disparador de filtro de la sección **Únicos** y elige **"Simular categoría"**.
2. El sistema ofrece **solo las categorías simulables**: las del catálogo activo con **3 o más meses con únicos** en la ventana histórica que **no** tienen ya una simulación.
3. El usuario elige **una o varias** categorías y confirma.
4. Las simulaciones quedan activas: los meses de su tramo pasan a mostrar su movimiento simulado (RF-SIM-002, RF-SIM-003).

**Flujos alternativos:**
- *A1 — El usuario cancela:* no se crea nada.
- *A2 — Ninguna categoría es simulable:* la lista queda vacía y el sistema **explica la causa** (ver criterios).
- *A3 — Alguna categoría de la selección falla:* la operación **no es atómica** — las que se pudieron crear **quedan creadas** y el usuario se entera de **cuáles fallaron y por qué**, con la selección todavía abierta para reintentar solo esas. Que fallen **todas** tampoco es un error duro del alta: mismo desenlace, sin nada creado.

**Criterios de aceptación:**
- [ ] La acción vive **dentro del disparador de filtro de la sección Únicos** de `/mes` (RF-VM-006); no en el header de la pantalla ni en el kebab (⋮) de una fila.
- [ ] Se eligen **una o varias categorías** y se confirman en **una sola operación**. Pueden coexistir **varias simulaciones**, a lo sumo **una por categoría**.
- [ ] El alta de varias es **tolerante a fallo parcial**: una categoría que falla **no impide** las demás, cada fallo se comunica **por categoría** con su motivo, y lo creado **no se revierte**.
- [ ] **Solo se ofrecen las categorías simulables:** las que tienen **menos de 3 meses con movimientos únicos** en la ventana histórica (RF-SIM-002) y las que **ya están simuladas** **no se listan**. El criterio se enuncia en una **nota de elegibilidad** al pie de la lista, para que la ausencia de una categoría sea explicable sin mostrarla.
- [ ] El **universo se congela al abrir** el selector: ninguna categoría desaparece de la lista mientras el usuario está eligiendo, aunque los datos cambien detrás.
- [ ] **Lista vacía — se explica la causa.** Cuando no queda ninguna categoría simulable, el mensaje distingue **cuatro** situaciones: el usuario **no tiene categorías activas**; **ninguna llega a 3 meses** con datos; **ya están simuladas todas** las que se pueden simular; o **mixto** (las que tienen datos ya están simuladas y a las demás les faltan meses).
- [ ] El universo del que sale la lista es el **catálogo de categorías activas** del usuario (las eliminadas no se ofrecen, RN-007), **no** las categorías presentes en el mes visualizado: la simulación se apoya en la ventana histórica, que no depende del mes navegado.
- [ ] Lo que persiste es la **simulación** (usuario + categoría + tramo, RN-028). **No se crean movimientos ni filas** de ningún tipo.
- [ ] El **tramo se ancla al mes visualizado** al crear y **no revive meses pasados**: crear parado en un mes anterior al mes en curso equivale a crear desde el mes en curso (RN-028). Todas las categorías del mismo alta comparten el ancla.
- [ ] La simulación es editable en **un solo eje: el fin del tramo**, que se extiende en incrementos fijos (RF-SIM-005). El `startMonth` y el monto simulado **no** se ajustan a mano; **crear** (este RF), **extender** (RF-SIM-005) y **eliminar** (RF-SIM-004) son sus tres únicas operaciones.
- [ ] Crear una simulación **no** genera entrada de historial (excepción a RN-027 documentada en RF-SIM-004).

**Notas:**
- Shape de la entidad y contrato del endpoint en `docs/data-model/simulacion.md`.
- El filtrado por elegibilidad es **de presentación**: el contrato de candidatas trae el catálogo completo con los datos que permiten decidir y distinguir la causa del vacío (`docs/data-model/simulacion.md`).

---

## RF-SIM-002 — Cálculo del movimiento simulado

| Campo | Detalle |
|---|---|
| **Descripción** | El monto y la dirección del movimiento simulado de cada mes del tramo de una simulación se derivan de una **regresión lineal por mínimos cuadrados** sobre el **total mensual con signo** de los movimientos únicos de la categoría en los **12 meses anteriores** al mes en curso, **menos lo que esa categoría ya lleva realmente cargado en el mes**: el simulado es el **remanente**, "lo que falta para llegar a lo proyectado". El cálculo es **on-the-fly en cada lectura** (RN-006): no se persiste ningún monto. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | Existe una simulación sobre la categoría. |

**Regla de cálculo** (`A` = mes en curso):

- **Ventana histórica — los 12 meses anteriores,** `[A−12 .. A−1]`. El mes en curso **no** entra: está incompleto y distorsionaría la tendencia.
- **Serie — un punto por mes de la ventana:** el **total mensual con signo** de los únicos de esa categoría (**ingresos +, gastos −**), en la **moneda default** del usuario (cada único convertido con su propia cotización, RF-CUR-005). No aportan los únicos **anulados** (RN-020) ni los **eliminados** (RF-HIST-006).
- **Los meses sin únicos de la categoría valen 0 y entran igual** a la serie: no se saltean. La ausencia **es dato** — si la categoría aparece 3 de cada 12 meses, la expectativa mensual **es** baja y eso es correcto.
- **Eje:** los meses de la ventana ocupan las posiciones `1..12` (`A−12` = 1 … `A−1` = 12); el **mes en curso ocupa la 13** aunque no entre a la regresión, y cada mes siguiente la que le sigue (`A+1` = 14, `A+2` = 15, …). La recta se ajusta sobre los 12 puntos y se **extrapola** evaluándola en la posición del mes a simular, **incluido el mes en curso**.
- **Mínimo de datos — 3 meses:** se necesitan **3 o más meses con únicos** de la categoría dentro de la ventana. Por debajo de ese piso **no hay simulación**: la categoría no se ofrece (RF-SIM-001) y una simulación existente cuya categoría queda por debajo **deja de derivar movimientos** sin eliminarse (queda **pausada**, y vuelve a proyectar sola si la categoría recupera datos).
- **Tramo — propio de cada simulación, fijado al crearla y persistido.** `startMonth` = `max(mes desde el que se la crea, mes en curso)`; `endMonth` = **diciembre del año de `startMonth`**, extendido a `startMonth + 6` si ese tramo queda por debajo de 6 meses (nunca es menor a 6 meses). Ejemplo: creada en octubre de 2026, `oct..dic` son 3 meses, así que `endMonth` = **abril de 2027**.
- **Arranque efectivo = `max(startMonth, mes en curso)`.** El `startMonth` guardado no cambia nunca, pero un tramo que ya arrancó **no revive meses pasados**. Un mes lleva movimiento simulado si `arranque efectivo <= mes <= endMonth`, **evaluado simulación por simulación**: dos simulaciones pueden cubrir tramos distintos. Los **meses pasados nunca se simulan**.
- **La ventana, la pausa y el remanente se resuelven contra el mes en curso**, no contra el `startMonth`: el tramo dice **en qué meses** aparece el simulado, no con qué datos se calcula.
- **El monto es un remanente.** En **cada** mes del tramo: `remanente = proyección(mes) − total real con signo de los únicos de esa categoría en ese mes`, tomando el real con el mismo criterio que la serie de ajuste. La simulación significa **"lo que falta para llegar a lo proyectado"**, no un monto que se suma encima de lo ya cargado. Aplica igual al **mes en curso** (que ya tiene sus únicos reales) y a un **mes futuro** con únicos cargados por adelantado.
- **Dirección = resultado del cálculo.** El **signo del remanente** define el tipo del movimiento simulado: **negativo → gasto**; **positivo → ingreso**. La magnitud es `|remanente|`. El usuario elige **solo la categoría**, nunca la dirección; una misma simulación puede resultar gasto en un mes e ingreso en otro.
- **Redondeo y cancelación:** el remanente se redondea a **centavos enteros** (RN-002). Ese mes **no genera movimiento simulado** —no se muestra ninguna fila— en dos casos: si **redondea a 0**, y si **cambia de signo respecto de la proyección**. Lo segundo es lo que impide que un **gasto proyectado se dé vuelta como ingreso** porque la categoría ya gastó de más ese mes: la simulación se agota en cero, no se invierte.
- **Recálculo permanente:** la simulación no congela ningún número. El **tramo** ya quedó fijado y persistido al crearla (RN-028/029); lo que se rehace en cada lectura es el cálculo, con la **ventana** y los movimientos reales **vigentes en ese momento**: cargar un único de la categoría en un mes del tramo **encoge el remanente de ese mes** en el acto, y al avanzar el calendario un mes simulado queda atrás y **deja de derivarse solo**, sin dejar residuo.

**Criterios de aceptación:**
- [ ] La serie de ajuste son los **12 meses anteriores** al mes en curso, con el **total mensual con signo** de los únicos de la categoría (ingresos +, gastos −) en la moneda default del usuario.
- [ ] Los meses **sin únicos** de la categoría entran a la serie **con valor 0**; no se omiten ni se interpolan.
- [ ] La **proyección** de un mes es la **recta de mínimos cuadrados evaluada en la posición de ese mes**, con el mes en curso ocupando la posición 13 aunque no entre a la regresión.
- [ ] Con **menos de 3 meses con únicos** en la ventana no se produce ningún movimiento simulado.
- [ ] El monto simulado de un mes es el **remanente** (proyección menos el total real con signo de los únicos de la categoría en ese mes), tanto en el **mes en curso** como en un mes futuro que ya tenga únicos cargados.
- [ ] El **signo del remanente** define el tipo: negativo → **gasto**, positivo → **ingreso**; la magnitud del movimiento es el valor absoluto.
- [ ] Un remanente que **redondea a 0 centavos** o que **cambia de signo respecto de la proyección** **no genera** movimiento simulado ese mes.
- [ ] El **tramo de cada simulación** va de su **arranque efectivo** a su `endMonth` persistido —diciembre del año de `startMonth`, extendido a `startMonth + 6` cuando ese tramo queda por debajo de 6 meses—, evaluado **por simulación**. Los **meses pasados nunca** llevan movimientos simulados.
- [ ] El cálculo es **on-the-fly**: no se persiste ningún monto, y navegar dos veces al mismo mes recalcula con los datos vigentes.

**Notas:**
- **Relación con RF-REP-015 (proyección de gastos fijos).** Ambas son proyecciones a futuro sobre datos del usuario, pero de **dominio y método distintos**: RF-REP-015 proyecta **fijos** con un esqueleto determinista × tasa de encarecimiento; la simulación proyecta el **total de únicos de una categoría** por regresión lineal. Lo que se comparte es la **infraestructura de proyección del backend**, abstraída para servir a ambos cálculos — la fórmula de cada uno es propia y no se reusa la del otro.
- **Limitación de moneda.** El ajuste se calcula sobre la serie en la **moneda default** (montos ya convertidos con la cotización de cada único), no sobre la moneda propia de cada movimiento: parte de la variación de tipo de cambio queda mezclada en la tendencia. Es la misma limitación conocida de RF-REP-015.
- La regresión lineal es deliberadamente simple: captura **nivel y tendencia**, no estacionalidad. Un gasto anual concentrado en un mes se reparte como tendencia, no se replica en su mes.

---

## RF-SIM-003 — Movimientos simulados en la Vista del mes

| Campo | Detalle |
|---|---|
| **Descripción** | En un mes dentro del **tramo de una simulación** —**el mes en curso incluido**—, esa simulación activa aporta a la sección **Únicos** de `/mes` **un** movimiento simulado, derivado al vuelo (RF-SIM-002) y **claramente distinguible** de los movimientos reales. Suma a los totales del mes y entra en la evaluación de límites. `/mes` es la superficie donde el movimiento simulado se ve **siempre**; en `/reportes` se ve solo en las cards que lo habilitan (RF-REP-017). |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | El mes visualizado está dentro del tramo de al menos una simulación activa. |

**Contenido del movimiento simulado:** la **categoría simulada** (su identidad visible), el **tipo** derivado del signo, la **magnitud** en la moneda default del usuario y una marca de **simulado**. **No tiene** instante (día ni hora), método de pago, descripción propia, cotización propia ni débito automático.

**Criterios de aceptación:**
- [ ] Cada simulación activa aporta **como máximo un** movimiento simulado por mes **de su tramo** —**mes en curso incluido**—, en la sección **Únicos**; un mes cuyo remanente redondea a 0 o cambia de signo no lleva ninguno (RF-SIM-002).
- [ ] El **mes en curso** es un **mes mixto**: lista sus únicos reales y, además, el **remanente** de cada simulación que alcance (RF-SIM-002). El movimiento simulado no duplica lo ya cargado — lo descuenta.
- [ ] El movimiento simulado es **claramente distinguible** de los reales en la lista; el detalle visual lo define `control-design` (`docs/design.md`).
- [ ] **Totales del mes (RF-VM-002):** suma su **magnitud** al bucket de su tipo (RN-019) y al **subtotal** y al **contador** de la sección Únicos.
- [ ] **La composición se señala:** siempre que la sección **Únicos** deje a la vista al menos un movimiento simulado tras aplicar sus filtros, `/mes` **avisa que el número incluye simulados** en dos superficies —los **totales del mes** y el **subtotal de la sección Únicos**— e indica **cuántos** incluye. Es la única señal de composición: el **contador** de la sección no la lleva, y ninguna otra sección puede llevarla (RN-029). Sin simulados a la vista no hay señal en ningún lado. El detalle visual lo define `control-design` (`docs/design.md`).
- [ ] **Filtros de la sección (RF-VM-006):** participa como cualquier único — lo alcanzan tanto el filtro de tipo como el de categoría. Un filtro que lo excluye lo saca también de subtotal, contador, totales y de la señal de composición.
- [ ] **Orden (RF-VM-001):** en el orden **por monto** entra por magnitud como cualquier ítem; en el orden **por fecha** —que no tiene— va **al final** de la sección.
- [ ] **Límites (RF-LIM-003, RF-LIM-004):** los datos que `/mes` emite ya lo incluyen, así que las **marcas pasivas** lo evalúan como a cualquier dato del mes y la **alerta activa** proyecta sobre una base que lo contiene. Como el **mes en curso** puede llevar simulados, esto alcanza a las **cuatro** formas de carga: el único se chequea contra el mes al que va, y fijos, cuotas y calculados contra el mes en curso. **Consecuencia:** un límite de alcance **"mes en curso"** (RF-LIM-003 / RF-LIM-004) puede marcar o avisar sobre un dato que incluye el remanente simulado, es decir sobre **dato estimado**. Es el dato que la superficie muestra, y esa es la regla (RN-022).
- [ ] **`/reportes` (módulo 3.9):** entra **solo** en las cards que lo **habilitan** (opt-in por card, RF-REP-017); una card sin habilitarlo grafica solo lo real. **No entra en el dashboard** en ninguna superficie: ni en el resumen mensual (mes en curso, nunca simulado) ni en su widget de reporte.
- [ ] **Sin acciones de movimiento:** la fila simulada **no** expone kebab (⋮) —ni editar, ni duplicar, ni anular, ni eliminar, ni crear calculado— ni **card de detalle** (RF-VM-007), y **no puede ser origen** de un movimiento calculado.
- [ ] No genera ni ocupa ninguna fila en la base: existe solo en la respuesta del mes que lo deriva.

---

## RF-SIM-004 — Eliminar una simulación

| Campo | Detalle |
|---|---|
| **Descripción** | Eliminar la simulación es la única forma de darla de baja. Se elimina desde el **mismo disparador donde se crea** (el filtro de la sección Únicos de `/mes`), que lista las simulaciones del usuario. Sus movimientos simulados dejan de derivarse en el acto. La eliminación es **definitiva**: no genera entrada de historial y no se puede deshacer. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene al menos una simulación. |

**Flujo principal:**
1. El usuario abre el disparador de filtro de la sección **Únicos** de `/mes`.
2. El sistema lista las **simulaciones** del usuario.
3. El usuario elimina una y confirma.
4. Los movimientos simulados de esa categoría desaparecen de todos los meses que alcanzaba y los totales se recalculan sin ellos.

**Flujos alternativos:**
- *A1 — El usuario cancela:* la simulación queda intacta.

**Criterios de aceptación:**
- [ ] La eliminación se ofrece en el **mismo punto de entrada** que la creación (RF-SIM-001), que lista las simulaciones del usuario.
- [ ] Eliminar una simulación **deja de derivar** sus movimientos simulados en **todos** los meses de su tramo de inmediato; los totales, subtotales y contadores de esos meses se recalculan sin ellos.
- [ ] La eliminación es **definitiva y física**: la simulación desaparece por completo y **no se puede restaurar**. Recuperarla es volver a crearla (RF-SIM-001).
- [ ] La eliminación **se confirma** antes de ejecutarse (es irreversible).
- [ ] La eliminación **no genera entrada de historial** y **no aparece en `/historial`** (RF-HIST-002); tampoco la creación.
- [ ] La categoría de una simulación eliminada vuelve a estar **disponible para simular** de inmediato (RF-SIM-001).

**Notas — excepción explícita a RN-027:**
- **La simulación de categoría queda entera fuera del historial de cambios.** Ni su creación, ni su extensión (RF-SIM-005) ni su eliminación se registran, y la eliminación no es deshacible. Es la excepción que RN-027 exige documentar en el propio RF; ninguna funcionalidad fuera de este módulo la hereda.
- **Por qué es admisible:** una simulación **no contiene datos del usuario**. Lo único que persiste es la elección de una categoría y su tramo (RN-029); el monto y la dirección se derivan al vuelo en cada lectura (RN-028) y no hay nada cargado a mano que perder. Rehacerla cuesta exactamente lo mismo que hacerla la primera vez, desde el mismo punto de entrada. La red de seguridad que RN-027 protege —no perder trabajo de carga— no tiene nada que proteger acá.

---

## RF-SIM-005 — Extender el tramo de una simulación

| Campo | Detalle |
|---|---|
| **Descripción** | Corre el `endMonth` de una simulación **hacia adelante**, en un incremento fijo de **1, 3, 6 o 12 meses** sumado al `endMonth` vigente. El `startMonth` **nunca se toca**. El disparador se ofrece **solo** cuando el mes visualizado en `/mes` es **exactamente** el `endMonth` de esa simulación; en cualquier otro mes esa fila no lo ofrece. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene una simulación cuyo `endMonth` coincide con el mes visualizado en `/mes`. |

**Flujo principal:**
1. Con el mes visualizado en `/mes` igual al `endMonth` de una simulación, el usuario abre el disparador de filtro de la sección **Únicos** y encuentra, en la fila de esa simulación, la acción **"Extender"**.
2. El sistema ofrece cuatro incrementos: **1, 3, 6 o 12 meses**.
3. El usuario elige uno.
4. El `endMonth` de la simulación se corre esa cantidad de meses hacia adelante; el popover **no se cierra**.

**Flujos alternativos:**
- *A1 — El usuario no elige ningún incremento:* la simulación queda intacta.
- *A2 — La extensión falla:* el `endMonth` queda como estaba y el usuario puede reintentar.

**Criterios de aceptación:**
- [ ] El disparador **"Extender"** aparece **únicamente** en la fila de la simulación cuyo `endMonth` es **exactamente** el mes visualizado en `/mes`; cambiar de mes lo mueve a la fila que corresponda o lo hace desaparecer si ninguna coincide.
- [ ] Los incrementos ofrecidos son **1, 3, 6 o 12 meses**, sumados al `endMonth` vigente; no hay otro valor posible.
- [ ] El `startMonth` **no se modifica nunca** por esta acción.
- [ ] El nuevo `endMonth` **no se re-deriva** con la regla de alta (RF-SIM-002/RN-028, `computeHorizonEndMonth`, exclusiva de la creación): es el `endMonth` vigente más el incremento elegido, **sin clampear** contra el mes en curso y **sin tope**.
- [ ] **Sin tope de extensión, por construcción:** al extender, ese mes deja de ser el `endMonth` de la simulación, así que el disparador deja de ofrecerse en ese lugar — repetir la acción exige navegar antes al nuevo último mes.
- [ ] Una simulación cuyo `endMonth` **ya pasó** se extiende **igual**, sin rama especial y sin ningún estado o cartel de "vencida" o "terminada" (esa marca no existe, RN-029).
- [ ] Una simulación **pausada** también ofrece extender, con la misma disponibilidad que Eliminar (RF-SIM-004) en pausa.
- [ ] La extensión **no pide confirmación**: es aditiva, no destructiva. Un toast comunica el éxito.
- [ ] Extender **no genera entrada de historial** (excepción a RN-027 documentada en RF-SIM-004), igual que crear (RF-SIM-001) y eliminar (RF-SIM-004) una simulación.

**Notas:**
- Shape de la entidad y contrato del endpoint en `docs/data-model/simulacion.md`.
- **Por qué no hay tope:** el propio disparador se auto-desactiva al extender —deja de cumplir su condición de aparición—, así que un tope adicional no protegería nada que la mecánica de UI no cubra ya.
