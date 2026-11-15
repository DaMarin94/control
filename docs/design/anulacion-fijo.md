# `/mes` — modal de alcance de la anulación de un fijo

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Acciones del kebab y fila anulada: `mes-listado.md` *Ítem anulado*.

## Modal de alcance de la anulación de un fijo (`/mes`) — RF-MF-005

**Modal de alcance** que abre "Anular este mes" / "Des-anular este mes" del kebab de un ítem **fijo**. Lo funcional (dos alcances excluyentes, verbo fijado por el mes visualizado, reglas del rango) está en `requirements.md` RF-MF-005 y `screens.md` §Vista del mes; acá, **cómo se ve y cómo se opera**.

### 0. Encuadre — qué cambia y qué no

- **Solo el fijo abre modal.** El toggle de **único** y **cuota** sigue directo (sin modal, sin alcance).
- **La fila anulada no cambia.** Atenuación `0.55`, monto tachado y badge "Anulado", sin importar el alcance. No existe señal de "anulado por rango".
- **Costo asumido, acotado.** El caso frecuente (anular el mes que estoy mirando) pasa de 1 clic a 2; todo el diseño hace barato ese segundo clic: preselección, foco, `Enter`, modal chico, **cero espera** (§4).
- **Sin fetch al abrir.** Todo viaja en el `MovementItem` (nombre, categoría, frecuencia, arranque y fin del fijo lógico, mes visualizado). El conteo de apariciones es aritmética sobre `startMonth` + frecuencia (RN-016). **Sin skeleton, sin spinner.**

### 1. Contenedor, título y verbo

- **Contenedor:** `ModalShell variant="dialog"` (`max-w-[440px]`). Cierra con **✕ y `Esc`**; el scrim **no** cierra.
- **Título** (18px/700): **"Anular apariciones"** / **"Des-anular apariciones"**.
  - **No repite el rótulo del kebab**: el modal cubre **dos** alcances. La reconexión la hace la **primera opción** ("Solo este mes · Junio 2026").
  - **"Apariciones" y no "meses":** es la unidad real (un trimestral en 10 meses toca 3).
- **Un solo verbo para todo el modal**, fijado por el estado del mes visualizado; sin control que lo cambie. No existe un modal mixto.

### 2. Cuerpo — orden y anatomía

Cuerpo `space-y-[14px]`. De arriba abajo:

**2.1 · Bajada** — 13px `--muted`, `max-w-[46ch]`:
- Anular: *"El fijo sigue existiendo. Las apariciones anuladas se siguen mostrando en su mes, pero no suman a los totales."*
- Des-anular: *"Las apariciones vuelven a sumar a los totales de su mes."*
- **Por qué:** anular y **eliminar** son vecinas en el kebab y se confunden (RF-MF-005). *(Prevención de error.)*

**2.2 · Caja de identidad — y domicilio de los límites** — molde del diálogo de eliminar / deshacer: `rounded-ctl border border-line bg-panel-2 px-4 py-3`.
- Línea 1: **nombre del fijo**, 13px/600 `--ink`, `truncate`.
- Línea 2 (12px `--muted`, `·` en `--faint`): `● {Categoría} · {frecuencia} · {vigencia}`.
  - `● {Categoría}`: punto 6px `movement.category.color` + nombre.
  - `{frecuencia}`: etiqueta en minúscula (`fijos-frecuencia.md`).
  - `{vigencia}`: formato de la card de detalle — `Desde Mar 2024 · activo` o `Mar 2024 – Jun 2028`. Space Grotesk, no mono.
- **Decisión clave: los límites del rango se presentan como propiedad del fijo, no como restricción.** El piso y el techo del selector **son** la vigencia, ya leída arriba; la frecuencia explica de antemano el conteo.

**2.3 · Radiogroup de alcance** — `role="radiogroup"` `aria-label="Alcance de la anulación"`, dos filas `gap-[6px]`. **Dos opciones.**

- **Fila:** `flex items-start gap-[10px] px-[10px] py-[9px] rounded-[var(--r-ctl)] min-h-[44px]`, `border border-transparent`.
  `[radio 16px] [rótulo 13.5px/600 --ink] / [sub 12.5px --muted]`
- **Radio:** molde de *Simular categoría* — círculo 16px `border --line-strong`; seleccionado `border-accent bg-accent` con punto blanco 6px.
- **Estados:** hover `bg-panel-2`; **seleccionada `bg-panel-2` + `border --accent`**; focus ring `--accent-soft` 3px sobre la fila.
  - **Borde índigo en la seleccionada:** con dos filas y hover sobre la otra, solo-fondo daría dos filas idénticas. Cromo de interacción legítimo.
- **Opción 1 — preseleccionada:** **"Solo este mes"** · sub **"{Mes AAAA}"** (ej. `Junio 2026`), escrito.
- **Opción 2:** **"Un rango de meses"** · sub **"Desde y hasta, ambos inclusive."**

**2.4 · Bloque de rango** — se monta **solo** con la opción 2; con la opción 1 **no existe en el DOM**. **Indentado `pl-[36px]`** (10 + 16 del radio + 10): su borde izquierdo coincide con el rótulo de la opción 2.

- **Par de selectores:** `.row2` (`grid grid-cols-2 gap-[14px]`), celdas `min-w-0`. Campo `.f` (label 12.5px/600 `--ink-2`, gap 7px) + **`Select` nativo** (`.input.select`).
  - Labels: **"Desde"** · **"Hasta"**.
  - **Opciones:** un mes por opción, **`Mmm AAAA`** (`formatMonthShort`), Space Grotesk, no mono.
  - **Por qué `Select` nativo y no la "rueda" del salto de mes:** (a) dominio **acotado y enumerable** — las opciones *no incluyen* lo prohibido; (b) 60+ meses con ▲▼ de a uno sería inaceptable; (c) misma primitiva que Categoría/Método/Frecuencia.
- **Universo de opciones (el rango inválido no se puede expresar):**
  - **Desde:** desde el **arranque del fijo lógico** hasta su **último mes de aparición** (sin fin: hasta el horizonte que el contrato de datos provea).
  - **Hasta:** se **recalcula a partir de Desde**: primera opción = **Desde**; última = `min(techo del fijo, Desde + 23 meses)`. **Máximo 24 opciones.**
  - `hasta < desde` **es irrepresentable**, y más de 24 meses también. **Sin estado de error de rango.**
  - **Defensa:** un rango invertido por bug se trata como **cero apariciones** (§3.2). Nunca rojo.
- **Ajuste automático:** al cambiar **Desde**, si **Hasta** queda fuera del nuevo universo, se reajusta **al valor válido más cercano** (a `Desde` o a `Desde + 23`). Silencioso en el control, **explícito en la nota** (§3.1).
- **Nota de límite** — `.field-note` (12.5px `--muted`, glifo 14px `--accent-ink`, `gap-7px`), **siempre presente** bajo el par. Copy en §3.1.

**2.5 · Caja de resultado — la cuenta de apariciones.** Último elemento del bloque de rango; **solo en el alcance rango**.

- **Caja:** `rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px]`, `flex items-start gap-[10px]`. Glifo 16px `--ink-2` (`CalendarOff` al anular, `CalendarPlus` al des-anular). Texto 13px `--ink`, fragmentos clave en **600**.
- **`aria-live="polite"`.**
- **Copy (el singular tiene frase propia, sin numeral):**

| Caso | Copy |
|---|---|
| `N ≥ 2` | *"Se anulan **{N} apariciones**, entre **{Mmm AAAA}** y **{Mmm AAAA}**."* |
| `N = 1` | *"Se anula **una aparición**: **{Mmm AAAA}**."* |
| `N = 0` | ver §3.2 |
| Des-anular | espejo exacto: *"Se des-anulan **{N} apariciones**, entre …"* / *"Se des-anula **una aparición**: …"* |

- **Los dos meses son la primera y la última aparición REAL dentro del rango**, no los extremos elegidos (trimestral desde Enero, rango `Mar 2026 – Dic 2026` → *"Se anulan **3 apariciones**, entre **Abr 2026** y **Oct 2026**."*).
- **La cuenta dice el estado final, no el delta** (idempotencia, RF-MF-005); no se desglosa lo ya anulado.
- **Nunca en mono** (no hay dinero; `{N}` es un conteo en una frase).

### 3. Estados del rango

**3.1 · Límite alcanzado — se informa, no se recrimina.** La nota es el único lugar donde se habla de límites; **nunca** rojo, ámbar ni borde de error.

| Estado | Copy de la nota |
|---|---|
| **Base** (siempre, mientras no haya ajuste) | *"Hasta 24 meses por operación. Para un tramo más largo, repetí la operación desde el mes siguiente."* |
| **Tras clamp por largo máximo** | *"El ‘hasta’ se ajustó al máximo de 24 meses."* |
| **Tras arrastre del ‘hasta’** | *"El ‘hasta’ se movió junto con el ‘desde’."* |

- Los copys de ajuste **reemplazan** al base hasta la siguiente interacción; mismo tamaño, color y glifo — **solo cambia el texto**.
- **El base menciona la salida** (encadenar dos rangos da el mismo estado).
- **El selector no muestra opciones deshabilitadas**: lo prohibido no está en la lista.

**3.2 · Cero apariciones — estado neutro, confirmar bloqueado.** Frecuencia > 1 y el rango no contiene ninguna aparición.

- La **caja de resultado** cambia de contenido (no de molde ni color): **`Info` 16px `--ink-2`**, texto 13px `--ink-2`: *"El rango no incluye ninguna aparición: **{Nombre}** es **{frecuencia}** y no cae en esos meses."*
- **El primario queda `disabled`** (`opacity-50`, `cursor-not-allowed`, sin hover): confirmar sería un **no-op silencioso**.
- **Neutro, no error.**
- **Imposible en "Solo este mes"** (el fijo aparece en el mes visualizado por precondición). En la opción 1 el primario **nunca** está deshabilitado.

**3.3 · Estado normal.** Con `N ≥ 1` el primario está habilitado. Los selectores siempre tienen valor (arrancan en `Desde = Hasta = mes visualizado`).

### 4. El camino barato — cómo se paga el segundo clic

1. **Preselección + verificación en un renglón** (la opción 1 dice el mes).
2. **Foco inicial en el radio seleccionado**, no en el botón: `Enter` confirma **y** ↑↓ llevan al rango sin `Tab`.
3. **`Enter` confirma desde cualquier control** (excepto con un `<select>` nativo desplegado). Camino frecuente: kebab → `Enter`.
4. **El modal arranca chico** (≈330px sin el bloque de rango).
5. **Cero espera** (§0).

**Lo que NO se hace:** sin "no volver a preguntar", sin doble confirmación, sin `Enter` diferido.

### 5. Footer, carga, éxito y error

- **Footer** (`flex justify-end gap-3`): **`Cancelar`** (`variant="ghost" size="sm"`) + **`Anular`** / **`Des-anular`** (`variant="default" size="sm"`, primario índigo).
  - **Nunca `destructive`** (anular es reversible).
  - **Rótulo del primario fijo — sin el conteo** (un botón que cambia de ancho mueve el blanco bajo el cursor). El conteo vive en la caja de resultado.
- **Carga:** primario → **"Anulando…"** / **"Des-anulando…"** + `disabled`. `Cancelar` habilitado. El cuerpo no se atenúa.
- **Éxito:** cierra el modal y la lista se refresca.
  - **"Solo este mes": sin toast** (la fila cambia a la vista).
  - **Rango: toast `success` obligatorio** (sin acción, ≤460px), porque el efecto puede caer fuera del mes visualizado:
    - `N ≥ 2` → **"Anuladas {N} apariciones de ‘{Nombre}’."**
    - `N = 1` → **"Anulada una aparición de ‘{Nombre}’: {Mmm AAAA}."**
    - Des-anular: espejo (*"Des-anuladas {N} apariciones…"*).
  - **Regla:** *el toast aparece cuando el efecto no es visible en la pantalla actual.*
- **Error:** `toast.error` — *"No se pudo cambiar el estado del movimiento."* — y **el modal queda abierto** con la selección intacta (RNF-008).
- **a11y:** radiogroup con ↑↓; los `Select` con `<label>` asociado; caja de resultado `aria-live="polite"`; el primario deshabilitado con `aria-describedby` a la caja de resultado.

### 6. Contención responsive (obligatoria)

Régimen **único**: igual en todo el régimen de app (`≥ 600px` en ambos ejes), sidebar abierto o cerrado. Sin disposición compacta propia.

- **Ancho:** `ModalShell variant="dialog"` — `w-full max-w-[440px]` en scrim `p-6` = **`min(440px, 100vw − 48px)`**. A 640px mide **440px exactos**. Scrim `fixed inset-0` sobre el viewport: el sidebar **no** lo afecta.
- **Prohibido el piso de ancho sin clamp.** Ningún elemento declara `min-width` en px; las celdas del par `min-w-0` (si `Mmm AAAA` no entrara, trunca el `<select>`).
- **Aritmética a 640px:** 440 − 22×2 = **396** de cuerpo; indentado 36 ⇒ **360**; `.row2` con gap 14 ⇒ **173px por selector**. El par **nunca** envuelve.
- **Invariante 1:** el modal no aporta ancho; body-lock del shell.
- **Invariante 2:** con el rango abierto ≈500px de alto; por debajo de ≈560px de viewport, el **cuerpo scrollea** con header + footer pineados (`max-h-[calc(100dvh−48px)]`).
- **Invariante 3:** botones del footer pineados; `<select>` nativos posicionados por el SO.
- **Invariante 4:** no aplica.

### 7. Agregados más allá del brief — estado

1. **Toast de éxito solo en el alcance rango** (§5) — **confirmado por el usuario**.
2. **Caja de identidad con vigencia + frecuencia** (§2.2) — **confirmado por el usuario** (se lee *"Alquiler · mensual · Desde Ene 2026 · activo"*).
3. Sugerencia de "la aparición más cercana" en el estado de cero — **descartada por el usuario**.

### 8. Reglas duras reafirmadas

- **Verde/rojo:** el modal **no muestra cifras de dinero** ni usa `--income`/`--expense`. Cero apariciones y ajuste de límite son **neutros**.
- **Índigo:** radio seleccionado, borde de la fila elegida, focus ring, glifo de la `.field-note` y botón primario.
- **Mono tabular:** no aplica; **ningún elemento usa IBM Plex Mono**.
- **Ámbar `--warning` no se usa.**

### Checklist de aceptación visual — Modal de alcance de la anulación

> Montar `/mes` en un iframe del ancho objetivo (método en la skill `qa-visual`, `.claude/skills/qa-visual/SKILL.md`). Fijo de prueba recomendado: **frecuencia trimestral**, arranque `Ene 2025`, sin fin, visualizando `Jun 2026`.

*Apertura y camino frecuente:*
- [ ] Kebab de un ítem **fijo** → "Anular este mes" **abre un modal** (no togglea). En un ítem **único** y en uno de **cuota**, la misma acción **sigue togglando directo, sin modal**.
- [ ] Título del modal = **"Anular apariciones"**; sobre un fijo ya anulado en el mes = **"Des-anular apariciones"**.
- [ ] `document.activeElement` al abrir tiene `role="radio"` y `aria-checked="true"`, y su fila dice **"Solo este mes"** con sub **"Junio 2026"**.
- [ ] `Enter` inmediatamente después de abrir **confirma y cierra** el modal, y la fila queda anulada (opacidad `0.55` + monto tachado + badge "Anulado").
- [ ] En alcance "Solo este mes" **no aparece ningún toast** de éxito.
- [ ] Con la opción 1 elegida, `document.querySelectorAll('select')` **dentro del modal = 0** (el bloque de rango **no está en el DOM**, no está oculto).
- [ ] Alto del diálogo con la opción 1 ≈ **330px** (`getBoundingClientRect().height` entre 300 y 360).

*Rango — selectores y límites:*
- [ ] Al elegir "Un rango de meses" aparecen **2 `<select>`**, con `Desde = Hasta = Jun 2026`.
- [ ] La **primera opción de "Hasta"** es siempre igual al valor de "Desde" (`hastaSelect.options[0].text === desdeSelect.value.text`) → **no se puede armar un rango invertido**.
- [ ] `hastaSelect.options.length ≤ 24` en cualquier valor de "Desde".
- [ ] "Desde" **no ofrece meses anteriores a `Ene 2025`** (arranque del fijo): su `options[0].text === "Ene 2025"`.
- [ ] Poner `Desde = Jun 2026` y `Hasta = May 2028` (24 meses) es posible; **May 2028 es la última opción** de "Hasta".
- [ ] Mover "Desde" a un mes posterior al "Hasta" vigente ⇒ "Hasta" **se reajusta solo** y la nota pasa a *"El ‘hasta’ se movió junto con el ‘desde’."*, en `--muted` (color computado ≠ rojo, ≠ ámbar), **misma altura de línea** que la nota base.
- [ ] La nota `.field-note` está **siempre presente** (no aparece/desaparece): el alto del bloque de rango no cambia entre el copy base y el de ajuste.

*Conteo de apariciones:*
- [ ] Con el fijo **trimestral** (arranque Ene 2025) y rango **`Mar 2026 – Dic 2026`** (10 meses), la caja de resultado dice **"Se anulan 3 apariciones, entre Abr 2026 y Oct 2026."** — tres (Abr/Jul/Oct), no diez; y los meses de la frase son **Abr/Oct**, no Mar/Dic.
- [ ] Con rango de **un solo mes de aparición**, dice **"Se anula una aparición: {Mmm AAAA}."** — sin el numeral "1".
- [ ] La caja de resultado tiene `aria-live="polite"` y su texto cambia al mover cualquiera de los dos selectores.

*Cero apariciones:*
- [ ] Con el trimestral, rango **`Feb 2026 – Mar 2026`** (ninguna aparición): la caja dice *"El rango no incluye ninguna aparición: **{Nombre}** es **trimestral** y no cae en esos meses."*
- [ ] En ese estado el botón **"Anular" está `disabled`** (`opacity-50`, `cursor-not-allowed`, sin hover) y tiene `aria-describedby` apuntando a la caja de resultado.
- [ ] En ese estado **ningún color de error**: el borde de la caja sigue siendo `--line` y ningún texto usa `--expense-ink` ni `--warning-ink`.
- [ ] Volviendo a la opción **"Solo este mes"**, el botón vuelve a estar **habilitado** siempre.

*Reglas duras y modos:*
- [ ] **Cero mono:** ningún nodo dentro del modal tiene `font-family` con `Plex Mono` (`[...modal.querySelectorAll('*')].filter(n => getComputedStyle(n).fontFamily.includes('Plex Mono')).length === 0`).
- [ ] **Cero semánticos:** ningún nodo del modal usa `--income`/`--expense` como color de texto, borde o fondo, en ninguno de los estados de arriba.
- [ ] El botón primario es **índigo** (`variant="default"`), **nunca rojo**.
- [ ] Se ve correcto en **claro y oscuro**: radio seleccionado, borde índigo de la fila elegida, caja de identidad, caja de resultado y focus ring visibles en ambos.

*Contención:*
- [ ] A **640px** de viewport (sidebar **abierto** y **cerrado**): el diálogo mide **440px exactos**, está centrado en el viewport, **no se corre ni se angosta** al abrir/cerrar el sidebar, y no hay **scroll horizontal del `body`**.
- [ ] A 640px con el rango abierto: los dos `<select>` quedan **lado a lado** (misma `offsetTop`), ~**173px** cada uno, sin envolver a dos filas.
- [ ] `min-width` computado de todos los descendientes del diálogo es `0px` o `auto` (ningún piso de ancho en px que pueda ganarle al clamp).
- [ ] A **640×560** con el rango abierto: el **cuerpo scrollea**, el título + ✕ quedan arriba y **Cancelar/Anular quedan visibles al pie** sin scrollear; aparecen las hairlines de corte.
