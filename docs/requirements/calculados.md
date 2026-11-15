# 3.4.b Submódulo: Movimientos calculados

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Contrato de API: `docs/data-model/calculados.md`.

Un **movimiento calculado** es un movimiento **fijo** cuyo monto **no se ingresa**: se **deriva** del monto de un **movimiento de origen** mediante una **fórmula**, **en vivo**. Tiene categoría y descripción **propias**; su **tipo** (Gasto/Ingreso) **no se elige**: se **deriva** del signo del monto resultante (RF-MCALC-003). Lo único que toma del origen es el **monto**. El **origen puede ser un fijo, un único o un grupo de cuotas** (RF-MCALC-008); el calculado **espeja la cadencia** del origen. Es un fijo a todos los demás efectos (se edita y elimina con la misma mecánica de split del calculado de fijo, salvo el borrado total del calculado de único/cuota — RF-MCALC-006). No es un tipo en el formulario de carga: su **único** punto de creación es la acción **"Crear movimiento calculado"** sobre un fijo, único o cuota en `/mes` (RF-MCALC-001).

---

## RF-MCALC-001 — Crear movimiento calculado desde un movimiento de origen

| Campo | Detalle |
|---|---|
| **Descripción** | Desde la Vista del mes (`/mes`), un ítem **fijo, único o cuota** ofrece —además de editar y eliminar— la acción **"Crear movimiento calculado"**. Es la **única** forma de crear un movimiento calculado: define el movimiento de origen, su categoría/descripción propias y la fórmula (con su signo) que deriva el monto; el **tipo** queda determinado por el signo del resultado (RF-MCALC-003). El **tipo de origen** (fijo / único / cuota) determina la cadencia del calculado (RF-MCALC-008). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe un movimiento **fijo, único o de cuotas** en el mes visualizado, propio del usuario. El origen **no** es a su vez un movimiento calculado (sin encadenamiento). |

**Flujo principal:**
1. El usuario, parado en un mes en `/mes`, abre el menú de acciones de un ítem **fijo, único o cuota** y elige **"Crear movimiento calculado"**.
2. El sistema abre el formulario del calculado, con el movimiento de origen ya fijado (el ítem desde el que se disparó).
3. El usuario elige **categoría** y **descripción** propias del calculado (independientes del origen). **No** elige tipo: se deriva del signo del resultado (RF-MCALC-003).
4. El usuario define la **fórmula**: un **operador** (`+`, `−`, `×`, `÷`, `%`) y un **operando** numérico común (RN-017).
5. El usuario elige el **signo del resultado** (positivo o negativo) mediante el switch de signo (RN-018).
6. El usuario confirma. El sistema crea el movimiento calculado como un fijo vinculado al **origen** (RF-MCALC-004), con su monto ya derivado para cada mes en que el origen aparece y su **tipo derivado** del signo de ese monto, siguiendo la **cadencia del origen** (RF-MCALC-008).

**Flujos alternativos:**
- *A1 — El usuario cancela:* no se crea nada.

**Criterios de aceptación:**
- [ ] La acción **"Crear movimiento calculado"** está disponible en los ítems **fijo, único y cuota** de `/mes`.
- [ ] El origen es un **fijo, un único o un grupo de cuotas**. Un movimiento **calculado no puede ser origen** de otro calculado (sin encadenamiento): la acción **no** se ofrece sobre un ítem que ya es calculado.
- [ ] Un mismo origen puede tener **varios** movimientos calculados derivados.
- [ ] El calculado se crea como un **fijo** (es a la vez fijo y calculado): aparece en `/mes` con la misma mecánica de listado de los fijos.
- [ ] La categoría y la descripción del calculado son **propias** y se eligen al crearlo; pueden diferir del origen. El **tipo no se elige**: se deriva del signo del monto resultante (RF-MCALC-003), de modo que un calculado puede tener distinto tipo que el origen (ej.: origen = sueldo/Ingreso; "ahorro = 10% del sueldo" con signo `−` → monto negativo → tipo derivado **Gasto**).
- [ ] La fórmula (operador + operando) y el signo son obligatorios; el **monto no se ingresa** (se deriva — RN-017) y el **tipo tampoco** (se deriva — RF-MCALC-003).
- [ ] No existe un tab "calculado" en el formulario de carga (RF-CM-001): el único punto de creación es esta acción.

---

## RF-MCALC-002 — Fórmula del movimiento calculado

| Campo | Detalle |
|---|---|
| **Descripción** | El monto del calculado se obtiene aplicando una **fórmula** —un operador y un operando numérico— sobre el monto del origen en el **mes de referencia** (por defecto, el mismo mes en que el calculado aparece; RF-MCALC-011). Operadores soportados: suma, resta, multiplicación, división y porcentaje. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El calculado está en creación o edición (RF-MCALC-001 / RF-MCALC-006). |

**Operadores (los cinco):**
- **Suma (`+`)** — `origen + operando`.
- **Resta (`−`)** — `origen − operando`.
- **Multiplicación (`×`)** — `origen × operando`.
- **División (`÷`)** — `origen ÷ operando` (operando ≠ 0).
- **Porcentaje (`%`)** — `origen × operando ÷ 100` (ej.: operando `10` = 10% del origen).

**Criterios de aceptación:**
- [ ] La fórmula es **una sola operación**: un operador de los cinco más un **operando** numérico común (se ingresa como número, ej. `5000`, `1.5`, `10`).
- [ ] El operando se valida según RN-017: **división y porcentaje con operando 0 no se permiten** (división por cero); el resto acepta cualquier operando numérico.
- [ ] La **base** de la fórmula es el monto del origen en el **mes de referencia** del calculado —por defecto el mes en que el calculado aparece; para origen **fijo** puede ser un mes anterior (RF-MCALC-011)—, y el resultado se **redondea a centavos enteros** (RN-017): no se persiste precisión sub-centavo.
- [ ] El signo final del resultado lo determina el switch de signo (RN-018), no la fórmula.

---

## RF-MCALC-003 — Signo del resultado y tipo derivado

| Campo | Detalle |
|---|---|
| **Descripción** | El movimiento calculado tiene un **switch de signo** que fuerza el resultado final a **positivo** o **negativo**. A diferencia del resto de los movimientos (monto siempre > 0), el monto de un calculado **puede ser negativo o cero** (RN-018). El **tipo** (Gasto/Ingreso) **no se elige**: se **deriva del signo del monto resultante** —monto negativo → **Gasto (`EXPENSE`)**; monto positivo → **Ingreso (`INCOME`)**—, de modo que signo y tipo quedan siempre consistentes (positivo = ingreso, negativo = gasto). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El calculado está en creación o edición. |

**Criterios de aceptación:**
- [ ] Hay un control de signo (positivo / negativo) que multiplica el resultado de la fórmula por `+1` o `−1`. **No** hay selector de tipo en el calculado.
- [ ] El monto resultante del calculado **puede ser negativo o cero** — excepción explícita a la regla de monto > 0 (RN-001), válida **solo** para movimientos calculados (RN-018).
- [ ] El **tipo se deriva del signo del monto final**: `final < 0` → **Gasto (`EXPENSE`)**; `final > 0` → **Ingreso (`INCOME`)**.
- [ ] **Caso borde `final == 0`:** se **permite guardar**; el tipo derivado por defecto es **Gasto (`EXPENSE`)**. Es solo una convención de borde: un monto 0 no aporta a ningún bucket de totales (RN-019), así que el tipo asignado no altera totales ni balance.
- [ ] El signo es un campo **propio** del calculado, editable como la fórmula (RF-MCALC-006). El tipo se recalcula al cambiar el signo o la fórmula (cambia el signo del resultado).
- [ ] La imputación del monto (con signo) a los totales del mes y a los reportes sigue RN-019: la **magnitud** del monto suma al bucket del tipo derivado.

---

## RF-MCALC-004 — Vínculo vivo con el origen y monto sincronizado

| Campo | Detalle |
|---|---|
| **Descripción** | El vínculo con el origen es **vivo**: el monto del calculado **no se persiste**, se **deriva al vuelo** del monto del origen en cada lectura (on-the-fly, RN-006, igual que fijos, únicos y cuotas; aplica a los tres tipos de origen — RF-MCALC-008). El calculado **espeja la estructura del origen** mes a mes: si el origen vale distinto en distintos meses (por su cadena de fijo), el monto del calculado sigue esa variación automáticamente, sin re-guardar nada. Para un origen de **cuota**, la base de la fórmula es el **monto por cuota** del grupo (no el total). **No** es un valor congelado. |
| **Actor** | Sistema |
| **Prioridad** | Media |
| **Precondiciones** | Existe un movimiento calculado vinculado a un movimiento de origen. |

**Criterios de aceptación:**
- [ ] El monto del calculado en un mes es `signo × redondear(fórmula(montoDelOrigenEnElMesDeReferencia))` (RN-017 / RN-018). El **mes de referencia** es el mes en que el calculado aparece, salvo que el calculado sea de origen **fijo** y tenga un desfasaje configurado (RF-MCALC-011). Para origen de **cuota**, la base es el **monto por cuota** del grupo.
- [ ] Para origen **fijo**, el vínculo es a la **identidad de cadena** del origen, no a una fila puntual (`docs/data-model/entidades.md`, §Decisiones de negocio sobre los datos — identidad de cadena): sobrevive a los splits del origen. Para origen **único** o **cuota**, el vínculo es al `Transaction` / `InstallmentGroup` de origen (RF-MCALC-008).
- [ ] Si el monto del origen cambia (edición del origen, o variación mes a mes propia de su cadena), el monto del calculado **refleja el nuevo valor** en la próxima lectura, sin re-guardar nada ni acción del usuario (se deriva al vuelo). Aplica a los tres tipos de origen.
- [ ] El calculado aparece **en cada mes donde aparece el origen** según la **cadencia del origen** (RF-MCALC-008), y solo en esos meses.
- [ ] **No congelado:** el monto nunca es un valor estático fijado al crear.

---

## RF-MCALC-005 — Ciclo de vida atado al origen

| Campo | Detalle |
|---|---|
| **Descripción** | El movimiento calculado sigue el **ciclo de vida del origen**: nace, aparece y desaparece con él. |
| **Actor** | Sistema |
| **Prioridad** | Media |
| **Precondiciones** | Existe un movimiento calculado vinculado a un movimiento de origen. |

**Criterios de aceptación:**
- [ ] Si el origen **fijo** se **elimina** (RF-MF-004), el calculado **se elimina** (con la misma semántica de pivote/split del fijo: desaparece desde el mes en que desaparece el origen, preservando el pasado).
- [ ] Si el origen **único** o de **cuota** se **elimina**, su(s) calculado(s) se **eliminan por completo** (cascada total, RF-MCALC-008): un único/cuota no tiene split, así que al borrarlo desaparece toda su derivación.
- [ ] Si el origen (**fijo**, **único** o **cuota**) está **anulado** en un mes (skip — RF-MF-005 / RF-MU-005 / RF-MC-004), el calculado **se anula ese mes**: se sigue listando pero no suma a los totales ni a la serie anual, igual que el origen. El calculado **no tiene skip propio** (el toggle no aparece en su kebab): su estado de anulación es siempre el del origen para ese mes.
- [ ] Si el origen **fijo** cambia de **frecuencia** —que en el modelo equivale a recrearlo (RF-MF-006)— el calculado **matchea la presencia** del origen vigente.
- [ ] Si el origen **fijo** se **reabre** (RF-MF-008), los calculados que terminaron **junto con él** (mismo `endMonth`) se reabren en espejo, con el mismo mes de reapertura y su relleno anulado; los que tienen otro fin quedan cerrados. Un calculado no se reabre por su cuenta.
- [ ] El calculado nunca aparece en un mes donde el origen no aparece.

---

## RF-MCALC-006 — Editar y eliminar un movimiento calculado

| Campo | Detalle |
|---|---|
| **Descripción** | El movimiento calculado se edita y elimina **por su cuenta**, como cualquier fijo: categoría, descripción, fórmula y signo son editables; el **tipo no es editable** (se deriva del signo del resultado, RF-MCALC-003). La eliminación es independiente de la del origen. La edición usa la **misma mecánica de split del pasado** que los fijos (RF-MF-003 / RF-MF-004, RN-005). El **borrado** del calculado **espeja cómo se borra su origen**: calculado de **fijo** → borrado por boundary (split del pasado); calculado de **único o cuota** → **borrado total directo** (RF-MCALC-009). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El movimiento calculado existe y pertenece al usuario. |

**Criterios de aceptación:**
- [ ] Son editables: **categoría, descripción, fórmula (operador + operando) y signo** (y el desfasaje de la base en calculados de fijo, RF-MCALC-011). El **tipo no es editable** (se deriva del signo del resultado). El vínculo al origen **no** se cambia editando: para derivar de otro movimiento se crea un calculado nuevo.
- [ ] La edición aplica **desde el mes visualizado inclusive en adelante** (split de fijos, RN-005); el pasado del calculado es inmutable. Aplica a los tres tipos de origen.
- [ ] La eliminación del calculado es **independiente** de la del origen: borrar el calculado no toca el origen ni a otros calculados del mismo origen.
- [ ] Borrado de un calculado de **fijo**: aplica **desde el mes visualizado** (boundary/split, RF-MF-004). Borrado de un calculado de **único o cuota**: **borrado total directo** (RF-MCALC-009).
- [ ] Eliminar el **origen** sí arrastra al calculado (RF-MCALC-005); eliminar el **calculado** no arrastra al origen.

---

## RF-MCALC-007 — Indicación visual de la relación padre/hijo

| Campo | Detalle |
|---|---|
| **Descripción** | En `/mes` se distingue cuándo un movimiento **tiene** un calculado derivado (es origen/padre) y cuándo un movimiento **es** un calculado de otro (es hijo). |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | El usuario está en la Vista del mes. |

**Criterios de aceptación:**
- [ ] En `/mes` se ve que un ítem **tiene al menos un calculado derivado** (es padre).
- [ ] En `/mes` se ve que un ítem **es un calculado** de un movimiento de origen (es hijo).

**Notas:**
- El **detalle visual** de esta indicación (cómo se representa la relación padre/hijo, ubicación, jerarquía) lo define `control-design` (`docs/design.md`). Este RF fija únicamente el requerimiento funcional de que la relación sea visible.

---

## RF-MCALC-008 — Origen único o cuota; cadencia espejo del origen

| Campo | Detalle |
|---|---|
| **Descripción** | El **origen** de un calculado puede ser un **fijo**, un **único** o un **grupo de cuotas**. El calculado **espeja la cadencia del origen**: aparece en los mismos meses que el origen, derivando del monto del origen en cada uno. La derivación es **en vivo** para los tres tipos (RF-MCALC-004): editar el monto del origen recalcula el calculado en la próxima lectura, sin persistir el monto. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe un movimiento fijo, único o de cuotas, propio del usuario, que no es a su vez un calculado. |

**Cadencia espejo por tipo de origen:**
- **Fijo:** una aparición por cada mes en que el fijo aparece según su frecuencia (RF-MCALC-004/005). Base de la fórmula: el monto del fijo en ese mes.
- **Único:** **un solo** calculado, presente **únicamente en el mes del único** (RN-011). Base: el monto del único. El calculado **hereda la fecha del único** (`occurredAt`/`timezone` del origen), ya que ocurre junto con él y la sección Únicos muestra día/hora (contrato en `docs/data-model/movimientos.md`, §`MovementItem`); los calculados de fijo y de cuota no tienen fecha.
- **Cuota:** **un calculado por cada mes/cuota del grupo** (`startMonth ≤ mes < startMonth + totalInstallments`). Base: el **monto por cuota** del grupo (NO el total).

**Criterios de aceptación:**
- [ ] Un origen **único** produce un calculado presente solo en su mes; un origen **cuota** produce un calculado por cada mes del grupo.
- [ ] El calculado de **cuota** deriva del **monto por cuota** del grupo, no del total de la compra.
- [ ] La derivación en vivo (RF-MCALC-004) aplica también a único y cuota: editar el monto del origen recalcula el calculado en la próxima lectura (no se persiste el monto).
- [ ] El calculado se **lista en la sección de su origen**: calculado de único → sección **Únicos**; de cuota → sección **Cuotas**; de fijo → sección **Fijos**.
- [ ] El calculado de **cuota NO arrastra la etiqueta "X/N"** (no es una cuota real del grupo, solo deriva su monto).
- [ ] El calculado de **único hereda `occurredAt`/`timezone` del origen** (muestra día/hora como el resto de la sección Únicos); los de fijo y cuota quedan sin fecha (`null`).

---

## RF-MCALC-009 — Borrado total del calculado de único o cuota

| Campo | Detalle |
|---|---|
| **Descripción** | Un único y un grupo de cuotas **no se borran por mes** (no tienen split del pasado); por eso, el **borrado del propio calculado** de un origen único o cuota es **total y directo** —una sola confirmación, sin elegir mes—, espejando cómo se borra su origen. La **cascada** del borrado del origen (RF-MCALC-005) hacia su(s) calculado(s) es también **total**. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | Existe un calculado de origen único o cuota. |

**Criterios de aceptación:**
- [ ] Borrar el **propio calculado** de un único/cuota: confirmación directa, borra el calculado **entero** (todas sus apariciones). No se ofrece elegir mes.
- [ ] Borrar el **origen** único/cuota: cascada **total** a su(s) calculado(s) (los borra enteros).
- [ ] El calculado de **fijo** conserva su borrado por **boundary** sobre la cadena (RF-MCALC-006).

---

## RF-MCALC-010 — Calculados de único y cuota en reportes

| Campo | Detalle |
|---|---|
| **Descripción** | Los calculados de origen **único** y **cuota** se **incluyen en la proyección anual** de `/reportes`, igual que los de fijo, con la **imputación por magnitud al bucket de su tipo derivado** (RN-019). |
| **Actor** | Sistema |
| **Prioridad** | Media |
| **Precondiciones** | Existen calculados de único/cuota y el usuario consulta `/reportes`. |

**Criterios de aceptación:**
- [ ] Un calculado de único/cuota imputa su **magnitud** (`\|amountCents\|`) al bucket de su **tipo derivado** (RN-018/019) en cada mes en que aparece (el mes del único; cada mes del grupo de cuotas).
- [ ] Conserva el tipo derivado del signo: `final > 0` → `INCOME`, `final ≤ 0` → `EXPENSE` (default `0 = EXPENSE`).
- [ ] Se preserva la invariante de reportes (suma de bandas de gasto del mes = `expenseCents`), igual que con los calculados de fijo.

---

## RF-MCALC-011 — Mes de referencia de la base (calculado de origen fijo)

| Campo | Detalle |
|---|---|
| **Descripción** | Un calculado de origen **fijo** toma como **base** de su fórmula el monto del origen en su **mes de referencia**: el mes en que el calculado aparece **desplazado N meses hacia atrás**, con `N` entero **0..12** (`0` = el mismo mes). Cubre los casos en que un movimiento se calcula sobre el valor de un mes anterior —un aguinaldo que aparece en diciembre pero se calcula sobre el sueldo de noviembre—. El desfasaje afecta **solo la base**: todo lo demás del calculado se resuelve contra el mes en que aparece. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El calculado está en creación o edición (RF-MCALC-001 / RF-MCALC-006) y su origen es un **fijo**. |

**Vocabulario — "mes de referencia" y "monto base" son el mismo concepto:**

| Ámbito | Término |
|---|---|
| Funcional / contrato | **mes de referencia** (`sourceMonthOffset`) |
| Pantalla | **monto base** — rótulo del campo: "Mes del monto base" (`docs/design.md`) |

**Criterios de aceptación:**
- [ ] El desfasaje es un **entero 0..12**; **`0` (mismo mes) es el default** y el comportamiento por omisión: un calculado sin desfasaje configurado deriva del monto del origen del mes en que aparece. Un valor fuera del rango se **rechaza**.
- [ ] Aplica **solo a calculados de origen fijo**. Los de origen **único** y **cuota** no tienen desfasaje (no es configurable ni expuesto para esos tipos).
- [ ] Es **editable** como el resto de la fórmula, con la misma mecánica de **split del pasado** (RF-MCALC-006): el cambio aplica desde el mes visualizado en adelante.
- [ ] Cambiar el desfasaje **queda registrado en el historial** como parte del campo `formula` de la entrada (RF-HIST-001).
- [ ] **Alcance: solo la base.** La **aparición** del calculado (cadencia espejo del origen, RF-MCALC-008), el **skip heredado** (RF-MCALC-005), la **moneda y la cotización** (RF-CUR-004), el **método de pago** y el **débito automático** (RN-021) se resuelven contra el **mes en que el calculado aparece**, no contra el mes de referencia.
- [ ] Si el origen **no resuelve en el mes de referencia** —no aparece ese mes por su frecuencia (RN-016) o el mes es anterior al alta del fijo—, el calculado **no aparece ese mes**: mismo tratamiento que cuando el origen no está activo (RF-MCALC-005).
- [ ] La base se resuelve contra la **cadena** del origen: si el origen se editó entre el mes de referencia y el mes de aparición (split, RN-005), la base sale de la fila de la cadena **vigente en el mes de referencia**.
