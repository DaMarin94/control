# Roadmap de trabajo

> **Documento descartable.** Es un doc de trabajo que retomamos en días distintos; se **borra al cerrar la versión**. No es registro histórico ni fuente de verdad permanente: la verdad vive en `requirements.md`, `data-model.md`, `design.md` y los demás docs canónicos. Acá viven el **orden de ejecución acordado** y los **gotchas** que hacen falta para arrancar cada tanda sin releer nada.

---

## Estado y orden de ejecución

Orden acordado:

**P0-a ✅ → P0-b ✅ → P6 ✅ → P1 ✅ + P4 ✅ → P2 + P3**

P0-a: **cerrado** (política enganchada al workflow: `docs/design.md`, `docs/qa-visual.md` y los agentes).
P0-b: **cerrado** (barrido de la deuda responsive de las superficies existentes).

### Por qué P0-a va primero

P0-a **no es una tarea, es una política permanente** (responsiveness como criterio vigente de acá en adelante). Al ser política y no entregable, todo lo que se construya después nace cumpliéndola. Por eso P0-b —el barrido de la deuda existente— puede ir al principio de una vez, sin riesgo de tener que repetirse: una vez que la política está enganchada al workflow, lo nuevo ya no genera deuda.

### Agrupamientos

- **P1 + P4 juntos.** Ambos cambian la línea del ítem fijo en `/mes` y ambos cambian el contrato del fijo. Hacerlos juntos = **un solo pase de backend** y **un solo spec visual** para esa línea. Separarlos es pagar dos veces el mismo trabajo.
- **P2 + P3 juntos.** Ambos viven en las cards de `/reportes` y ambos agregan popovers/editores dentro de la card.

### Backend antes que frontend en los cambios de contrato

Los tres cambios de contrato —`frequency` (P1), `startMonth` del fijo (P4) y el ancla de `annual-unicos` (P3)— van **backend primero, frontend después**, para que los tipos del front se alineen contra un contrato ya cerrado.

---

## P0-a — Responsiveness como política permanente ✅ CERRADO

**No es una tarea, es una regla vigente de acá en adelante.**

### Criterio de contención — cuatro invariantes verificables

1. Sin scroll horizontal del `body` en todo ancho `≥ 640px` (el ancho mínimo soportado). Por debajo del piso la app no promete contención.
2. Modales completos y scrolleables: no cortados, no atrapantes.
3. Ninguna acción inalcanzable (fuera de pantalla o tapada).
4. Las superficies anchas scrollean **dentro de sí mismas**, no rompen el layout de la página.

### Alcance deliberado: contención, no adaptación

No se rediseña nada para mobile. No se promete buena experiencia en pantalla chica; se promete que **no se rompe**. La distinción es intencional y acota el trabajo.

### Enganche al workflow (esto es lo que la vuelve política)

- Los specs de `control-design` declaran **obligatoriamente** el comportamiento en pantalla chica.
- `control-frontend` lo implementa.
- El QA visual lo verifica **siempre**. Los 4 invariantes son material de QA visual: no los detecta ni el build ni los tests.

### Hallazgo estructural

La app **no tiene sistema de breakpoints**. Tiene un número mágico: **`941`**. Medición real sobre 80 archivos `.tsx`:

```
@media(min-width:941px)  × 12
@media(max-width:940px)  ×  1
lg: ×2   md: ×1   sm: ×2      (sueltos, sin escala)
```

No hay config de `screens`. **`control-design` debe nombrar el `941` como token** en `docs/design.md`.

### Entregables (cero código)

| Quién | Qué |
|---|---|
| `control-design` | Escribe el criterio y el token `941` en `docs/design.md`. |
| `control-analyst` | Engancha los archivos de `.claude/agents/` (los agentes solo **apuntan** al doc canónico, no lo duplican) y `docs/qa-visual.md` (los 4 invariantes como chequeo permanente). |

---

## P0-b — Barrido de la deuda existente ✅ CERRADO

Aplicar el criterio de P0-a a lo que ya existe.

Ya cumplen:

- `/mes` (`month-view-client.tsx`): layout desktop ≥941px y stepper pill mobile ≤940px.
- El shell: `layout.tsx`, `app-sidebar.tsx`, `period-nav.tsx`.

El resto está crudo.

### Superficies que no se adaptan achicando → necesitan scroll interno (invariante 4)

- `unique-grid` — grilla día × mes, 31 columnas × 12 filas.
- `installment-gantt` — gantt de barras horizontales.
- La tabla de límites en `/configuracion`.

Y **todos los modales** (invariante 2).

---

## P6 — `/configuracion`: sacar el segmented

**Estado: cerrado ✅.** `/configuracion` es hoy un hub de administración con navegación vertical de secciones y 4 rutas anidadas deep-linkables (General, Categorías, Métodos de pago, Límites). Arquitectura en `docs/frontend.md` § Hub de Configuración; pantalla en `docs/screens.md` §9.

**Alcance acotado: se reemplaza el control de navegación. NO es un rediseño de la pantalla ni del gestor de límites.**

### Diagnóstico (esto es lo importante, no el síntoma)

El segmented no está mal hecho, está **mal usado**. Un segmented control es un *input de elección* ("elegí un valor"), no un control de navegación. En `/configuracion` no se elige nada: se navega entre secciones. Por eso se siente mal — el control promete setear un valor y en realidad cambia de vista.

### Decisión

`/configuracion` pasa a **navegación vertical**: columna de secciones a la izquierda, contenido a la derecha (patrón GitHub / macOS / Stripe). Se eligió sobre tabs subrayadas porque **escala** cuando la pantalla crezca.

### Gotcha crítico

`configuracion-tabs.tsx` **reusa el molde `.dtabs`**, el mismo del selector `Ingreso / Gasto / Transferencia` del modal de movimiento. Ese es su **uso correcto** (ahí sí se elige un dato). **El molde NO se toca.** `/configuracion` simplemente **deja de usarlo**.

---

## P1 — Periodicidad del fijo: entero 1..12 ✅ CERRADO

**Cambia el modelo. Requiere migración.**

### Estado hoy

- Prisma: `enum RecurringFrequency { MONTHLY BIMONTHLY QUARTERLY BIANNUAL ANNUAL }`.
- RN-016 usa `step(F)` con `MONTHLY=1, BIMONTHLY=2, QUARTERLY=3, BIANNUAL=6, ANNUAL=12`.

**El enum tiene un agujero: no existe el 4 (cuatrimestral).** Pasar a entero `1..12` no es cosmético — completa el modelo y lo simplifica.

### Cambios

- **Migración / back-compat:** `MONTHLY→1`, `BIMONTHLY→2`, `QUARTERLY→3`, `BIANNUAL→6`, `ANNUAL→12`.
- **RN-016:** `step(F)` desaparece; la regla `monthDiff(S, M) % N === 0` **no cambia**. Sigue **anclada al mes de inicio**.
- **Contrato de API:** `MovementItem.frequency` pasa de enum (`"MONTHLY" | ... | "ANNUAL"`) a **número** → actualizar `docs/data-model.md` (hoy declara `RecurringFrequency` como unión de strings, líneas del §Contrato de `GET /movements`).
- **RF-MF-006 se reescribe:** hoy dice "set cerrado de 5 valores"; pasa a entero `1..12`.
- **Cálculo:** sigue **on-the-fly** (RN-006). No se generan filas por instancia.

### Etiquetas — híbrido

No existen palabras en castellano para 5, 7, 8, 9, 10 y 11 meses:

> 1 Mensual · 2 Bimestral · 3 Trimestral · 4 Cuatrimestral · **5 Cada 5 meses** · 6 Semestral · **7..11 Cada N meses** · 12 Anual

### Inmutabilidad

**La frecuencia sigue siendo inmutable tras crearse** (RF-MF-006 ya lo establece; no se cambia). El selector aparece solo al crear; en edición es de **solo lectura**.

---

## P4 — Mes de arranque de cada fijo en `/mes` ✅ CERRADO

**Cambia el contrato.**

### Gotcha central — sin esto la feature muestra datos falsos

Los fijos preservan el pasado con **splits de cadena**. Al editar un fijo se crea una fila `Recurring` nueva que hereda el `chainId`. Por eso **el `startMonth` de la fila vigente es el mes del último split, no el arranque del fijo**.

**Ejemplo:** "Alquiler" creado en marzo 2024, editado en junio 2026 → la fila vigente dice `startMonth = 2026-06`. Mostrar ese campo afirmaría que el alquiler arranca en junio 2026. Es **falso**.

### Decisión

Se muestra el arranque del **fijo lógico** = `startMonth` de la **primera fila de la cadena** (`chainId`).

El backend debe:
- Resolver el arranque **por cadena** (primera fila del `chainId`).
- Agregar `startMonth` a `MovementItem` **para fijos**. Hoy solo las cuotas lo traen, dentro de `installment` (`MovementItem.installment.startMonth`); los fijos lo tienen en `null`.

### Calculados

Un calculado **es** un fijo, con **cadena propia**. Muestra **su propio arranque**, no el del origen.

Razón: un calculado creado en enero 2026 sobre un origen de marzo 2024 no existía en 2024; decir que arranca ahí afirmaría movimientos que nunca ocurrieron.

### Diseño

Ubicación y forma visual del dato en la línea del ítem: la define `control-design`.

---

## Card de detalle de movimiento ✅ CERRADO

**Surgió durante P1 + P4.** Al adelgazar la línea del ítem fijo se decidió mover **todo** el metadato secundario de la fila de `/mes` a una **card de detalle read-only** que se abre al clickear el cuerpo de la fila; la fila queda solo con lo glanceable (identidad + discriminador + monto). El arranque del fijo (P4) dejó de ir en la fila y pasó a la card, combinado con un dato nuevo del contrato: **`endMonth`** (fin/vigencia del fijo).

- **Contrato:** `MovementItem` suma `endMonth: string \| null` (fin del fijo lógico, resuelto por cadena con `loadChainBounds`, hermano de la resolución de `startMonth`); el método de pago embebido suma `closingDay`/`paymentDay` (crédito). La card es **bidireccional origen ↔ derivados**: además de mostrar el "Origen" desde un calculado, un ítem **origen** de calculados suma `calculatedChildren: CalculatedChild[]` (los derivados del mes, resueltos para los 3 orígenes) y la card los lista read-only. Ver `docs/data-model.md`.
- **Frontend:** `MovementDetailCard` (read-only sobre `ModalShell`), prop `closeOnScrimClick`, `lib/formula.ts` (extraído de `calculated-form`), `FREQUENCY_LABEL` + `formatConvertedAmountDisplay` en `lib/movements.ts`. Ver `docs/frontend.md`.
- **Funcional / diseño:** RF-VM-007 (+ RF-MF-007 reescrito) en `requirements.md` / `screens.md`; anatomía visual en `docs/design.md`. **QA visual: verificado.**

---

## P2 — Popover informativo de límites por superficie

**Solo lectura. No edita nada.**

Es una feature **nueva e independiente** de las marcas/avisos de la feature Límites (RF-LIM-003/004): un popover que **lista** qué límites observan esa superficie. No es una marca ni un aviso.

### Comportamiento

| | |
|---|---|
| **Disparo** | Ícono con **popover por click**; en desktop **también** por hover. **No hover puro** — en touch no existe, y con la política P0-a vigente eso nace roto. |
| **Superficies** | Las **5 cards de `/reportes`** y **`/mes`**. **Sin dashboard.** |
| **Contenido** | Lista los límites de esa superficie, **agrupados y rotulados por naturaleza** (ver abajo). |
| **Deshabilitados** | Se **incluyen**, atenuados. |
| **Aparición del ícono** | Solo si hay **≥1 límite** (habilitado o no) para esa superficie. Con cero límites, no aparece. |

### Agrupación por naturaleza

- **Pasivos** — pintan una marca sobre un dato de la pantalla (RF-LIM-003).
- **Activos** — no pintan nada; avisan al **guardar** un movimiento (RF-LIM-004). Solo existen sobre las **7 keys `mes.*`**, así que este grupo aparece **únicamente en `/mes`**.

### RN-022 se PRECISA, no se borra

Su cuerpo ya dice que *"toda marca y todo aviso son condicionales"* — eso es lo que la regla protege y **sigue vigente**. El paréntesis "(sin límites o todos deshabilitados)" habla de la **config**, no del efecto. Un **popover informativo no es una marca ni un aviso**. La regla se reformula para que hable de **marcas y avisos**, y la condición de aparición del ícono es "**≥1 límite** para esa superficie".

### Gotchas

- **El widget del dashboard es la card Ingresos vs Gastos** (`income-expense`) montada en **modo efímero**. Excluirlo del popover es una **asimetría deliberada**: el dashboard es pantalla de vistazo, sin chrome de card. El flag de modo efímero **ya existe**; `report-card.tsx` es compartido.
- **`/mes` no tiene chrome de card:** hay que **inventarle un lugar** al ícono → `control-design`.
- **Alcance temporal distinto por superficie.** El dashboard es del **mes en curso**; las cards de `/reportes` son **anuales**. Los límites con alcance temporal `mes en curso` se comportan **distinto** en cada superficie: el listado debe **reflejarlo, no mentir**.

---

## P3 — Techo editable de la escala de color de `unique-grid`

**Cambia el contrato del backend.**

### Aclaración de nombres

El "reporte Gastos diarios" es la card **`unique-grid`** ("Reporte anual de Únicos", grilla día × mes).

### Qué NO es (registrar esto evita reabrir el debate)

Esto **no** es la feature Límites gobernando el color. Se evaluó y se **descartó con evidencia**:

- Un `Limit` **no tiene campo de color** (`types/limit.ts`: `anchorKey + refinement + temporalScope + operator + threshold + nature + effect`).
- El efecto `fill` es **un solo color fijo** (`limit-mark.tsx`: `bg-warning-soft`, ámbar). Todas las marcas son ámbar: esa es su semántica ("atención acá").
- Se renderiza **una sola marca por dato**, la más fuerte (`evaluate.ts`, orden quiet→fuerte: bold, tint, glyph, dot, badge, fill, ring).

Por eso una escala de color **no es expresable** con límites sin agregarles una dimensión de color, lo que rompería RF-LIM-001 (efecto ∈ catálogo cerrado), la semántica de la marca y la regla de desempate de RF-LIM-003. **Se descarta.**

### Qué SÍ es: una configuración propia de la card

| | |
|---|---|
| **Qué** | El **techo** de la escala de color. |
| **Dónde se edita** | **Dentro de la propia card**, junto a año / moneda / categorías (cada card ya es un widget autónomo). **No en `/configuracion`.** |
| **Alcance** | **Por card.** |
| **Fórmula** | `t = clamp(total / max, 0, 1)` — el piso queda en 0. **Misma fórmula de hoy**, con el ancla reemplazada. |
| **Colores** | **Fijos.** La rampa de 4 stops oklch **no se toca**. |
| **Guardado** | `anchorUsdCents` (entero) en `ReportCardConfig`, **default `1500`** (= 15 USD). Ausente = comportamiento actual. |
| **Entrada** | monto + **selector de moneda**; se convierte a USD al guardar. |
| **Prellenado** | el ancla vigente, ya convertida a la moneda de la card. |

### Por qué se guarda en USD

USD ya es el **pivote interno** del sistema (`pivotRatesForYear`). El ancla de hoy **ya es** un par `(monto, moneda)` hardcodeado en `(15, USD)` (ver `colorAnchorCents` en `data-model.md`, §Contrato de reporte anual de Únicos) — esto **no agrega un concepto, destapa el que existe**. Guardar en USD elimina el problema de que abrir el editor y guardar sin cambiar nada **mute la semántica** del ancla.

### Consecuencias asumidas (documentarlas: son intencionales)

1. **El monto tipeado no vuelve exacto:** `22.500 ARS` → `1500` centavos USD → al reabrir puede mostrar `22.499`. Intrascendente para una escala de color, pero visible.
2. **El techo queda anclado en dólares, no en pesos:** al cambiar el año de la card se reconvierte con el TC de enero de ese año, y el número en pesos cambia. Significa que el techo es constante **en términos reales**. Es la naturaleza que la app ya tiene hoy con los 15 USD.
3. **El monto tipeado se interpreta con el TC del año que la card está mostrando.** Escribir `22.500 ARS` en una card de 2024 y en una de 2026 produce **anclas en USD distintas**.

### Microcopy obligatoria (una línea, junto al campo — a afinar por analyst)

> *Se guarda en USD y se reconvierte según el año y la moneda de la card.*

Cubre las tres consecuencias con un solo enunciado: si se entiende que se reconvierte, el centavo de diferencia deja de sorprender.

### Contrato

`GET /movements/reports/annual-unicos` acepta **dos query params opcionales** (ancla: **monto + moneda**). Nota: la moneda del **ancla** es un parámetro aparte del `currency` de display que ya existe en el endpoint.

- Si vienen: reconvierte **esos** en vez de los 15 USD, con el **mismo** `pivotRatesForYear` (TC de enero del año del reporte, clamp al mes disponible más cercano).
- Si no vienen: se comporta **como hoy**.
- **Sigue devolviendo `colorAnchorCents` ya resuelto en la moneda de la card** (shape de respuesta intacto).

### Por qué la conversión va en el backend y no en el front

El front **no tiene la tabla de cotizaciones**. `pivotRatesForYear` ya resuelve el clamp al mes disponible. Duplicarlo sería **dos fuentes de verdad** para la misma cuenta. `colorAnchorCents` es **referencia de paleta visual**, no una cotización de negocio — no entra en totales ni conversiones (`docs/data-model.md`).

### El frontend no toca la lógica de pintado

`t = clamp(total / colorAnchorCents, 0, 1)` queda **igual**. Solo se agrega el **editor** y el **campo opcional** (`anchorUsdCents`) en `ReportCardConfig`.

---

## Pendientes sueltos

- **Bug preexistente, sin asignar a ninguna tanda:** el `statusLabel` de `/mes` dice **"Histórico" para meses futuros** (`month-view-client.tsx`: `isCurrentMonth ? "Mes en curso" : "Histórico"`). Noviembre 2026 no es histórico. No lo introdujo ningún cambio reciente; quedó más visible al agregarse el acceso directo al mes en curso a su lado.

---

## Nota de operativa

- **No correr `pnpm build` con `next dev` levantado.** El build pisa `.next/` y deja al dev server sirviendo un CSS que ya no existe: la app se ve **sin estilos** (los `<button>` caen al UA stylesheet). Para verificar tipos sin romper el server: `pnpm exec tsc --noEmit`.
