# Roadmap de trabajo

> **Documento descartable.** Es un doc de trabajo que retomamos en días distintos; se **borra al cerrar la versión**. No es registro histórico ni fuente de verdad permanente: la verdad vive en `requirements.md`, `data-model.md`, `design.md` y los demás docs canónicos. Acá viven el **orden de ejecución acordado** y los **gotchas** que hacen falta para arrancar cada tanda sin releer nada.

---

## Estado y orden de ejecución

**P0-a ✅ → P0-b ✅ → P6 ✅ → P1 ✅ + P4 ✅ → P3 ✅ → P2**

**Queda únicamente P2** (popover informativo de límites por superficie). El resto del plan está cerrado.

Fuera del plan original, cerrado: **card de detalle de movimiento** y **RF-REP-017** (movimientos simulados en las cards de `/reportes`).

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

## RF-REP-017 — Movimientos simulados en las cards de `/reportes` ✅ CERRADO

**Entró desde el TODO del README, fuera del plan P0..P6.**

Las cards `income-expense` y `by-category` de `/reportes` tienen un toggle **"Simulados"** (opt-in por card, apagado por default, persistido en su entrada del blob `reports`) que incorpora los movimientos simulados al tramo de meses futuros. El widget del dashboard no lo expone.

- **Funcional:** `requirements.md` RF-REP-017 (+ módulo 3.15); pantalla en `screens.md` §`/reportes`.
- **Contrato:** `docs/data-model.md` — `includeSimulated` en `ReportCardConfig` y bloque `simulated` de la respuesta de `GET /movements/reports` (aporte **separado** del dato real).
- **Implementación:** `docs/backend.md` y `docs/frontend.md`. **Diseño:** `docs/design.md`.

**Gotcha estructural — orden de pintado en las áreas apiladas.** El bloque real y el simulado comparten `stackId`, así que el simulado se pinta después y ocluye el contorno del total real en la costura entre bloques; por eso ese contorno va como **serie propia sin `stackId`, al final del árbol**. Un test de atributos no lo detecta. Detalle completo en `docs/frontend.md`, §Reportes.

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

## P3 — Techo editable de la escala de color de `unique-grid` ✅ CERRADO

**Estado: cerrado ✅.** La card `unique-grid` ("Reporte anual de Únicos", grilla día × mes) tiene el **techo de su escala de color** editable dentro de la propia card, por card, con entrada monto + moneda y guardado en USD (`anchorUsdCents` en `ReportCardConfig`); el backend reconvierte con `pivotRatesForYear` y sigue devolviendo `colorAnchorCents` resuelto en la moneda de la card.

- **Funcional:** `requirements.md` / `screens.md` (pantalla `/reportes`).
- **Contrato:** `docs/data-model.md` — §`ReportCardConfig` y §Contrato de reporte anual de Únicos (query params de ancla de `GET /movements/reports/annual-unicos`).
- **Implementación:** `docs/backend.md` y `docs/frontend.md`. **Diseño:** `docs/design.md`.

**Decisión que no se reabre:** la escala de color **no** se expresa con la feature Límites. Un `Limit` no tiene dimensión de color, el efecto `fill` es un único ámbar con semántica propia ("atención acá") y se renderiza una sola marca por dato: modelarla como límite rompería RF-LIM-001 y la regla de desempate de RF-LIM-003.

---

## Pendientes sueltos

Ninguno asignado a una tanda.

- **`statusLabel` de `/mes` dice "Histórico" para meses futuros** (`month-view-client.tsx`: `isCurrentMonth ? "Mes en curso" : "Histórico"`). Noviembre 2026 no es histórico.
- **Marca de límite que no pinta en `by-category` — bug, con diagnóstico cerrado.** El ancla `reporte.cat.gastoMesTotal` ("Total de gasto apilado del mes") **se evalúa bien**, pero la marca **no tiene portador visual propio**: se cuelga del `<Cell>` de la **última categoría del stack**. El orden de apilado es determinístico (mayor → menor gasto anual, la mayor en la base), así que esa última es siempre **la categoría más chica del año**; si el mes tiene cero en esa categoría, el elemento que porta el contorno ámbar mide ~0px y la marca no se ve. Afecta a `by-category` en **modo Barra y modo Línea**.
  - **Segundo problema, mismo lugar:** en esa card los tres efectos del catálogo (`glyph`, `badge`, `ring`) **colapsan al mismo contorno ámbar**. Configuración ofrece las tres opciones con preview distinto y la card entrega siempre lo mismo.
  - **Para destrabarlo:** re-especificación de `control-design` que defina un portador visual **independiente de la geometría de las bandas** (envolver la columna apilada completa del mes, marcador sobre el eje, u otra forma) y resuelva qué hace cada uno de los tres efectos. Recién después lo implementa `control-frontend`.

---

## Nota de operativa

- **No correr `pnpm build` con `next dev` levantado.** El build pisa `.next/` y deja al dev server sirviendo un CSS que ya no existe: la app se ve **sin estilos** (los `<button>` caen al UA stylesheet). Para verificar tipos sin romper el server: `pnpm exec tsc --noEmit`.
