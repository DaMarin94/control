# Fijos — frecuencia, selector y arranque/vigencia

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md`. Pertenece al grupo *Patrones de componentes vigentes*.

### Frecuencia del fijo — entero 1..12 y sus etiquetas

La frecuencia del fijo es un **entero 1..12** (número de meses del período; la instancia cae cuando `monthDiff(startMonth, mes) % N === 0`). No existen palabras en castellano para todos los períodos, así que las etiquetas son **híbridas**: nombre canónico donde existe, "Cada N meses" donde no. Este set es la **fuente única** de las tres superficies (opción del select, ayuda del form, sublínea del ítem):

| N | Select (capitalizada) | Ayuda del form (minúscula, va en "Se registra automáticamente __ …") | Sublínea del ítem (minúscula, terso) |
|---|---|---|---|
| 1 | Mensual | cada mes | mensual |
| 2 | Bimestral | cada dos meses | bimestral |
| 3 | Trimestral | cada tres meses | trimestral |
| 4 | Cuatrimestral | cada cuatro meses | cuatrimestral |
| 5 | Cada 5 meses | cada cinco meses | cada 5 meses |
| 6 | Semestral | cada seis meses | semestral |
| 7 | Cada 7 meses | cada siete meses | cada 7 meses |
| 8 | Cada 8 meses | cada ocho meses | cada 8 meses |
| 9 | Cada 9 meses | cada nueve meses | cada 9 meses |
| 10 | Cada 10 meses | cada diez meses | cada 10 meses |
| 11 | Cada 11 meses | cada once meses | cada 11 meses |
| 12 | Anual | cada año | anual |

**Racional de los tres registros.** La **ayuda del form** deletrea el número en palabras ("cada cuatro meses") porque es la superficie donde el usuario **confirma una decisión irreversible** (la frecuencia es inmutable, RF-MF-006): ahí la desambiguación explícita vale más que la brevedad, y resuelve la confusión clásica de "bimestral/cuatrimestral". La **sublínea** usa dígito ("cada 5 meses") porque es una línea de metadatos densa que trunca. El **orden del select es estrictamente 1→12** (período creciente): la posición N-ésima es N meses.

### Selector de frecuencia del form de fijo

El bloque **Frecuencia** del form de fijo (entre Mes de inicio y Categoría en crear; entre Monto y Categoría en editar) sigue el patrón de bloque del form (`Label` arriba + control). Etiquetas: las 12 de la tabla anterior, columna *Select*, en orden 1→12.

- **Crear:** `Select` **nativo** del DS (molde `.input.select`), `required`, **12 `<option>`**, default **Mensual** (valor 1, sin placeholder vacío). Select nativo — no segmented ni picker custom: 12 opciones en un segmented serían targets diminutos que envuelven. El texto de cada `<option>` es la etiqueta capitalizada, **sin** prefijo numérico.
- **Ayuda (solo en crear):** bajo Categoría, `Repeat` 14px `--accent-ink` + texto 12.5px `--muted`: "Se registra automáticamente **{ayuda}** a partir del mes de inicio." donde `{ayuda}` es la columna *Ayuda del form*. Recalcula en vivo al cambiar el select.
- **Editar (inmutable):** caja **read-only con badge**, mismo patrón que "Tipo" en edición (`rounded-ctl border-line bg-panel-2 px-[13px] py-[11px]`): glifo `Repeat` 15px `--accent-ink` + la etiqueta capitalizada. Sin ayuda debajo. Sin control editable.

> La frecuencia también se muestra en la **sublínea del ítem** (segmento `Repeat` 12px + etiqueta en minúscula), sin badge ni decoración extra.

### Arranque y vigencia del fijo — en la card de detalle

El arranque del fijo **no** vive en la fila de `/mes`: la **col 3 va vacía para fijos**. El arranque vive en la card de detalle, combinado con el **fin** (`endMonth`) en una sola línea de **"Vigencia"** (`Desde Mar 2024 · activo` o rango `Mar 2024 – Jun 2026`). Ver `card-detalle.md` *Card de detalle de movimiento*.

- **Arranque del fijo lógico** = `MovementItem.startMonth` de la **primera fila de la cadena** (`chainId`), no el del último split. Un **calculado de origen fijo** muestra **su propia** cadena, no la del origen.
- **Formato de mes (`formatMonthShort`):** mes **abreviado a 3 letras capitalizado** + año completo (ej. `Mar 2024`). No es cifra de dinero → **no va en mono** (es un rótulo).
