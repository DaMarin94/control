# Simulación de categoría (`Simulation` + `/simulations`)

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Destino canónico del modelo y del contrato de API de la simulación. Reglas funcionales en el módulo 3.15 (`docs/requirements/simulacion.md`, RF-SIM-001..005) y RN-028/029; el movimiento simulado que la simulación aporta a `/mes` está en `movimientos.md` (`simulated`); implementación en `docs/backend/simulacion.md`.

### Modelo — `Simulation`

```
Simulation = {
  id, userId, categoryId,
  startMonth: string,      // "YYYY-MM" — mes desde el que se creó, ya clampeado contra el mes en curso; inmutable
  endMonth:   string,      // "YYYY-MM" — fin del tramo; persistido, no derivado (RN-028/029); se corre hacia adelante al extender (RF-SIM-005)
  createdAt: DateTime
}
```

- **Persiste la configuración y el tramo** (`userId` + `categoryId` + `startMonth` + `endMonth`, RN-029). No guarda monto, dirección ni ventana: se derivan al vuelo en cada lectura (RN-028). **No genera filas de movimiento** — el movimiento simulado se sintetiza en la respuesta de `GET /movements`.
- **`startMonth`** = `max(mes desde el que se crea, mes en curso)`, fijado al crear y **nunca cambia**. **`endMonth`** = diciembre del año de `startMonth`, extendido a `startMonth + 6` si ese tramo queda por debajo de 6 meses (RN-028); se **persiste** en vez de derivarse porque es un extremo **movible**: `PATCH /simulations/:id/extend` (RF-SIM-005) lo corre hacia adelante sin volver a aplicar esa fórmula. El **arranque efectivo** de una lectura (`max(startMonth, mes en curso de esa lectura)`) no se persiste — se calcula on-the-fly y viaja como `effectiveStartMonth` en el DTO.
- **A lo sumo una simulación por `(userId, categoryId)`**, impuesto en la **DB** con un **índice único** sobre `(userId, categoryId)`.
- **Borrado físico** (RF-SIM-004): eliminar la simulación borra la fila. No tiene `deletedAt`, no genera entrada de historial y no es deshacible — es la excepción a RN-027.
- **FK `categoryId` con `onDelete: Restrict`**, igual que en los movimientos.

### Endpoints

**JWT requerido** en los cinco; scope por `userId` del token (`401` global si falta o es inválido).

**`today`** (`YYYY-MM-DD`, opcional) es query param de los **cuatro** endpoints que calculan —`POST /simulations`, `GET /simulations`, `GET /simulations/candidates` y `PATCH /simulations/:id/extend`— con la misma semántica que en `GET /movements`: fija el mes en curso con el que se resuelven la **ventana histórica de 12 meses**, el **tramo** de cada simulación y, en `PATCH .../extend`, los derivados (`monthsWithData`/`paused`/`effectiveStartMonth`) del `SimulationDto` de respuesta (RN-028). Formato inválido → **`400`**; **ausente = fecha UTC del backend**. `DELETE /simulations/:id` no lo acepta (no calcula nada).

**`startMonth`** (`YYYY-MM`, opcional) tiene dos usos distintos según el endpoint:
- En `POST /simulations`, es el mes desde el que se crea el lote (el mes visualizado en `/mes`); ausente = mes en curso. Se aplica a **todo el lote** y el backend lo **clampea** contra el mes en curso (RN-028) — no hace falta que el caller lo clampee. Formato inválido (no matchea `/^\d{4}-\d{2}$/`) → `400`.
- En `GET /simulations/candidates`, es el mismo mes hipotético, usado solo para **previsualizar** el tramo (`startMonth`/`endMonth` de la raíz de la respuesta) que resultaría si se creara un lote desde ahí; no crea nada.

- **GOTCHA — `today` es opcional en el contrato pero obligatorio en la práctica: todo consumidor tiene que mandarlo, en los cuatro endpoints que lo aceptan.** El fallback UTC no es equivalente a la fecha local: en UTC−N, cerca de fin de mes, el backend ya está en el mes siguiente mientras el usuario todavía no. Una superficie que lo omita resuelve ventana y tramo con un mes distinto al de las que sí lo mandan, y las superficies **se contradicen entre sí** — el mismo `monthsWithData` / `effectiveStartMonth` difiere según qué endpoint lo produjo, y una categoría elegible en el selector puede ser rechazada por el `POST`. Omitirlo no rompe nada de forma visible: la respuesta es válida, solo está corrida un mes.

| Endpoint | Body | Éxito | Errores |
|---|---|---|---|
| `POST /simulations` | `{ categoryIds: string[], startMonth?: "YYYY-MM" }` | `201` · `data: CreateSimulationsResponse` | `400` |
| `GET /simulations` | — | `200` · `data: SimulationsListResponse` | — |
| `GET /simulations/candidates` | — | `200` · `data: SimulationCandidatesResponse` | — |
| `PATCH /simulations/:id/extend` | `{ months: 1 \| 3 \| 6 \| 12 }` | `200` · `data: SimulationDto` | `400`, `404` |
| `DELETE /simulations/:id` | — | `204` sin body | `404` |

- **`POST /simulations` es un ALTA MÚLTIPLE con fallo parcial tolerado (RF-SIM-001).** El body es `{ categoryIds: string[], startMonth?: "YYYY-MM" }`: `categoryIds` **no vacío** y **sin ids duplicados**, y `startMonth` (si viene) debe matchear `/^\d{4}-\d{2}$/` — cualquiera de las tres cosas es `400` de body inválido, los **únicos** `400` del endpoint. Fuera de eso responde **`201` siempre**, incluso si fallaron **todas** las categorías: un fallo por categoría no es un error duro de la operación, viaja en `failed`.
- **Los `message` de `failed` son los textos legibles por categoría**, uno por causa de rechazo: categoría inexistente, ajena o eliminada (mismo criterio **no revelador** que el resto de los movimientos: nunca `404`); categoría con **menos de 3 meses con únicos** en la ventana (RF-SIM-002); categoría que **ya tiene una simulación** (existencia según el índice único `(userId, categoryId)`, sin mirar `paused`). El selector **oculta** esas categorías (no las ofrece, ni siquiera deshabilitadas), así que solo se alcanzan en una carrera con candidatas stale (universo congelado al abrir el selector, RF-SIM-001).
- **`PATCH /simulations/:id/extend` corre el `endMonth` hacia adelante** (RF-SIM-005): `endMonth` nuevo = `endMonth` vigente + `months`. **No** se re-deriva con `computeHorizonEndMonth` (exclusiva de la creación), **no** se clampea contra el mes en curso y **no** tiene tope. `months` ausente o fuera de `{1, 3, 6, 12}` → `400`; simulación inexistente o ajena → `404`. Responde el mismo `SimulationDto`, con `monthsWithData`, `paused` y `effectiveStartMonth` recalculados.
- **`DELETE /simulations/:id` es un borrado físico**: una simulación inexistente o ajena responde `404`. No genera entrada de historial y **no es deshacible** (RF-SIM-004).

### Shapes

```
SimulationDto = {
  id: string,
  categoryId: string,
  category: { id, name, color, scope },
  monthsWithData: number,        // 0..12 — meses CON únicos de la categoría en la ventana vigente
  paused: boolean,               // true ⇔ monthsWithData < 3
  startMonth: string,             // "YYYY-MM" — mes desde el que se creó, ya clampeado, inmutable
  effectiveStartMonth: string,    // "YYYY-MM" — max(startMonth, mes en curso de ESTA lectura)
  endMonth: string,                // "YYYY-MM" — fin del tramo, persistido
  createdAt: string              // ISO 8601
}

CreateSimulationsResponse = {          // body de POST /simulations — 201 SIEMPRE
  created: SimulationDto[],            // una por categoría creada (puede ser [])
  failed: Array<{
    categoryId: string,
    message: string                    // texto legible del rechazo de ESA categoría
  }>
}

SimulationsListResponse = {
  simulations: SimulationDto[]
}

SimulationCandidatesResponse = {
  startMonth: string,             // "YYYY-MM" — arranque del tramo hipotético de un lote creado ahora
  endMonth: string,               // "YYYY-MM" — fin de ese tramo hipotético
  categories: Array<{
    categoryId: string,
    name: string,
    color: string,
    monthsWithData: number,
    alreadySimulated: boolean
  }>
}
```

- **`monthsWithData` y `paused` son derivados vigentes, no estado guardado.** Se recomputan en cada lectura sobre la ventana `[A−12 .. A−1]` del momento (RN-028), así que la misma simulación puede pasar de `paused: false` a `true` sin que nadie la toque.
- **`paused: true` = viva en DB pero sin derivar.** La simulación **no se elimina** al caer por debajo del mínimo de 3 meses: deja de aportar movimientos simulados y vuelve a aportarlos sola si la categoría recupera datos (RF-SIM-002).
- **El tramo es propio de cada simulación, no de la respuesta.** `startMonth` se persiste tal cual quedó fijado al crear y nunca cambia; `endMonth` también se persiste (RN-028/029), porque es el extremo que se corre hacia adelante al extender (RF-SIM-005). `effectiveStartMonth` sí es un derivado vigente: `max(startMonth, mes en curso de esta lectura)`, recalculado contra el `today` de cada llamada. Dos simulaciones pueden tener `startMonth`/`endMonth` distintos entre sí; no hay un tramo único a nivel respuesta.
- **`GET /simulations/candidates` expone `startMonth`/`endMonth` en la raíz como previsualización de un lote hipotético**, no como propiedad de una categoría puntual — todavía no existe ninguna simulación de ese lote. Refleja el mismo cálculo que aplicaría `POST /simulations` si se confirmara con ese `startMonth` (o el mes en curso si se omite).
- **`created` + `failed` cubren exactamente las categorías pedidas**, sin repetidos: `created.length + failed.length === categoryIds.length`. El orden de ambos arrays es el del body.
- **`candidates` — el universo es el catálogo de categorías ACTIVAS del usuario** (RF-SIM-001), en el orden del catálogo (nombre ASC), **sin reagrupar por elegibilidad**. No se filtra por elegibilidad ni por el mes navegado: la respuesta trae **todas** con los dos datos que permiten al consumidor decidir y explicar el motivo — `monthsWithData` (< 3 = sin datos suficientes) y `alreadySimulated`.
