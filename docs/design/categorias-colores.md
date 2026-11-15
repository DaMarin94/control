# Categorías — paleta de colores y picker

> Parte de la guía viva de diseño (índice: `docs/design.md`). Base obligatoria: `fundamentos.md` (presentación en oscuro: §Categorías y gráficos en oscuro).

## Paleta de colores para categorías

El usuario **elige y edita** el color de una categoría —tanto al crear como al editar— desde una **matriz de colores tipo Office** (sin entrada de hex libre). El pool de asignación automática de `backend/src/categories/color-pool.ts` es **el subset base identificable de la matriz** (la fila media L3).

### Regla dura

El color de categoría es **solo un identificador de categoría** (swatch en la lista, bandas del apilado de la Forma 2 del gráfico, swatch en leyendas). **Nunca** tiñe un monto ni comunica ingreso/gasto — eso lo hacen income/expense (regla dura 1). La matriz está construida para **no chocar** con los semánticos ni con la marca: ningún hex de la matriz es el verde income (`#1F8A5B`), el rojo expense (`#C64637`) ni el índigo de acento (`~#5B57C2`).

### Regla de diseño rectora — máxima separación perceptual

La única regla dura de esta paleta: **dos categorías nunca deben confundirse de un vistazo.** Se prioriza **distinguibilidad sobre cantidad**. De ahí las tres decisiones estructurales:

1. **8 hues categóricamente distintos.** Cada columna es un color con **nombre propio inequívoco**: rojo, naranja, oro, verde, teal, azul, violeta, magenta — repartidos alrededor de la rueda sin dos adyacentes parecidos, sin hues "barrosos" que colapsen con un vecino.
2. **Chroma alto y parejo en la fila base.** Ningún color base es la "versión desaturada" de otro; todos son vívidos, así la distinción es por **hue**, no por sutilezas de saturación.
3. **5 tonalidades con saltos grandes.** Los pasos de claridad son amplios (~0.13–0.15 L de OKLCH entre filas) para que aun dentro de una misma columna dos tonos se lean claramente distintos.

### La matriz — fuente de verdad compartida (8 hues × 5 tonalidades)

La matriz es la **única fuente de verdad** del set de colores elegibles: el backend la usa para **validar** que el color recibido pertenezca a la matriz, y el frontend para **renderizar** el picker. Cualquier hex fuera de esta lista es inválido.

- **Estructura:** 5 **filas** (L1 = más clara, arriba → L5 = más oscura, abajo) × 8 **columnas** (un hue por columna). **Total: 40 swatches.**
- **Orden de columnas (espectral, izq→der):** C1 rojo, C2 naranja, C3 oro, C4 verde, C5 teal, C6 azul, C7 violeta, C8 magenta.
- **Fila base = subset de asignación:** la fila **L3** (fila media, la vívida) es el **subset base** que usa el backend para el "menos usado". Es la fila dominante del picker. Todos los hex son explícitos abajo (no se derivan en runtime: esta tabla **es** la fuente).
- **Cálculo del "menos usado" (default al crear):** sobre los **8 colores base de la fila L3** (no sobre los 40). El sistema preselecciona el color base menos usado entre las categorías activas; en empate, el primero del **orden de asignación** (ver abajo); el usuario puede cambiarlo a cualquiera de los 40.

**Matriz de hex (filas L1→L5 de claro a oscuro; L3 es el subset base):**

| Fila | C1 rojo | C2 naranja | C3 oro | C4 verde | C5 teal | C6 azul | C7 violeta | C8 magenta |
|---|---|---|---|---|---|---|---|---|
| **L1** | `#F7C8C8` | `#F9DDC8` | `#F7EBC5` | `#C6E6D1` | `#BFE6E9` | `#C8DBF6` | `#DFCEF3` | `#F4CCE4` |
| **L2** | `#EE8D8D` | `#F2B98D` | `#EFD686` | `#8ACB9F` | `#7ACBD1` | `#8DB4ED` | `#BC99E6` | `#E996C7` |
| **L3** | `#E23B3B` | `#E8863A` | `#E3B92E` | `#35A65A` | `#1AA5B0` | `#3B7DE0` | `#8B4FD4` | `#D94A9E` |
| **L4** | `#9E2929` | `#A25E29` | `#9F8220` | `#25743F` | `#12747B` | `#29589D` | `#613794` | `#98346F` |
| **L5** | `#6C1C1C` | `#6F401C` | `#6D5916` | `#19502B` | `#0C4F54` | `#1C3C6C` | `#432666` | `#68244C` |

**Lista canónica ordenada (orden flat para el picker) — recorrido por filas, de L1 a L5, cada fila C1→C8:**

```
L1: #F7C8C8 #F9DDC8 #F7EBC5 #C6E6D1 #BFE6E9 #C8DBF6 #DFCEF3 #F4CCE4
L2: #EE8D8D #F2B98D #EFD686 #8ACB9F #7ACBD1 #8DB4ED #BC99E6 #E996C7
L3: #E23B3B #E8863A #E3B92E #35A65A #1AA5B0 #3B7DE0 #8B4FD4 #D94A9E   ← subset base
L4: #9E2929 #A25E29 #9F8220 #25743F #12747B #29589D #613794 #98346F
L5: #6C1C1C #6F401C #6D5916 #19502B #0C4F54 #1C3C6C #432666 #68244C
```

### Subset base (pool de asignación automática) — orden explícito

El subset base son los **8 hex de la fila L3**. Su **orden de asignación** (el que rompe empates: "en empate, el primero") **no** es el orden espectral de la columna, sino un **orden que salta por la rueda** para que las **primeras** categorías creadas queden lo más separadas posible entre sí (la 1ª y la 2ª casi opuestas, la 3ª/4ª formando triada, etc.). Este orden es `[0,4,2,6,1,5,3,7]` sobre las columnas espectrales:

| # | Hue | Hex |
|---|---|---|
| 1 | rojo | `#E23B3B` |
| 2 | teal | `#1AA5B0` |
| 3 | oro | `#E3B92E` |
| 4 | violeta | `#8B4FD4` |
| 5 | naranja | `#E8863A` |
| 6 | azul | `#3B7DE0` |
| 7 | verde | `#35A65A` |
| 8 | magenta | `#D94A9E` |

**Pool en orden de asignación (lista canónica para `color-pool.ts` / `CATEGORY_BASE_COLORS`):**

```
#E23B3B #1AA5B0 #E3B92E #8B4FD4 #E8863A #3B7DE0 #35A65A #D94A9E
```

> Nota de estructura para implementación: como el orden de asignación **difiere** del orden flat de la fila L3 en la matriz, el subset base se define como un **array explícito** (no como un `slice` posicional de la lista flat). El orden flat de la matriz (espectral) es para **pintar el grid**; el orden del pool (salteado) es para **asignar**.

### Picker — geometría del grid

- **Columnas del grid del picker: 8.** El picker (`category-form-modal.tsx`) renderiza la lista flat en `grid-template-columns: repeat(8, 1fr)`.
- **Orden de render:** la lista flat canónica de arriba (L1→L5, cada fila C1→C8). Con 8 columnas, cada fila del CSS grid coincide exactamente con una tonalidad (L1 arriba … L5 abajo), reproduciendo el patrón "una familia por columna, un tono por fila".
- Estados del swatch, botón Aleatorio y hairline de contorno en oscuro: ver *Picker de color de categoría (matriz de swatches)* abajo.

### Notas de construcción y comportamiento

- **Familia por columna:** cada columna mantiene el **hue** de su color base L3; lo que varía por fila es la claridad (L1–L2 son tintes claros/pastel, aptos como fondo de chip; L4–L5 son sombras profundas, con buen contraste sobre panel blanco). Ninguna fila implica semántica: todas se usan **igual** como identificador de categoría.
- **Separación garantizada en el subset base:** los 8 hues de L3 están repartidos alrededor de la rueda sin dos adyacentes confundibles; combinados con el orden de asignación salteado, las categorías auto-pintadas nacen ya bien separadas.
- **Ambos modos (regla dura 4):** los hex no cambian entre claro y oscuro. Sobre panel oscuro, las filas oscuras (L4–L5) se apoyan en el **hairline de contorno obligatorio** del swatch (definido en `fundamentos.md` *Categorías y gráficos en oscuro*). Los tintes L1–L2 contrastan bien sobre panel oscuro; el texto sobre un chip pintado se calcula por contraste contra el hex, independiente del modo.
- **Fuera de semánticos y marca por construcción:** ningún hex es el verde income, el rojo expense ni el índigo de acento. El rojo de categoría (`#E23B3B`) es un rojo vívido y saturado, distinto del brick apagado del expense (`#C64637`); el verde (`#35A65A`) es un verde grama, distinto del verde teal del income (`#1F8A5B`); el azul (`#3B7DE0`) y el violeta (`#8B4FD4`) son distintos del índigo azul-violeta de marca.

### Picker de color de categoría (matriz de swatches)

Selector del color de categoría en el modal de categoría (crear y editar), que consume la **matriz de 40 colores**. Grid 8 columnas × 5 filas, swatch cuadrado `aspect-ratio: 1` radio `--r-chip` 7px, gap 6px.

- **Estados del swatch:** *reposo* = su hex con borde `--line` 1px. *Hover* = `scale(1.12)` + `--shadow-sm`, borde `--line-strong`, transición 0.14s. *Seleccionado* = anillo `box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--ink)` (ring **neutro `--ink`**, no acento — regla dura 2). *Focus* = ring `--accent-soft` 3px.
- **Botón "Aleatorio":** ghost chico (`Shuffle` 15px) que mueve la selección a un swatch al azar **de la matriz** (nunca un hex fuera de ella).
- **Crear:** arranca en el color menos usado (subset base, fila L3). **Editar:** arranca en el color actual de la categoría.
