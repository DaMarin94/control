# 3.12 Módulo: Sincronización de cotizaciones externas

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Modelo de datos, contrato del trigger y seguridad de la ingesta: `docs/data-model/cotizaciones.md`.

El sistema captura cotizaciones FX e IPC argentino desde fuentes oficiales externas, vía un trigger sin datos. Es la única excepción a "sin APIs externas en v1". Lo capturado alimenta la **tabla de cotizaciones de referencia** (FX, RF-CUR-006) y la serie de **IPC** que consumen los reportes anuales (RF-REP-010, RF-REP-012), y se expone de solo lectura al usuario en `/configuracion` → General (RF-SYNC-002).

La captura se parte en dos requerimientos independientes (fuentes distintas): **FX** (RF-FX-001) e **IPC** (RF-IPC-001). Los dos corren en la **misma ingesta**, que **no recibe valores** —solo gatilla el fetch server-side— y tiene **dos vías de disparo**: el **trigger de operación**, protegido por un secret (`CRON_SECRET`) y no por el JWT de usuario (RF-SYNC-001), y el **disparo manual del usuario**, autenticado por su sesión (RF-SYNC-002).

---

## RF-FX-001 — Captura de cotizaciones FX desde fuentes externas

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema obtiene de fuentes oficiales las cotizaciones de las monedas del set curado contra USD, las guarda como variantes (`CurrencyQuote`) y propaga la variante **oficial** a la tabla de cotizaciones de referencia (`ReferenceRate`, RF-CUR-006). |
| **Actor** | Sistema (disparado por un proceso de operación / cron) |
| **Prioridad** | Media |
| **Precondiciones** | El disparador presenta el secret de operación válido. Hay conectividad con las fuentes. |

**Fuentes:**
- **ARS por USD → `dolarapi.com`** (Frankfurter no cubre ARS de forma confiable). Se guardan **ambas** variantes publicadas, **oficial y blue**; la conversión interna usa **siempre la oficial** (no hay UI para elegir variante).
- **EUR por USD y BRL por USD → `api.frankfurter.dev`** (base USD, valor directo, sin derivar). Valor único por moneda → se guarda como variante `oficial` con `compra == venta`.

**Criterios de aceptación:**
- [ ] El sync escribe cada cotización capturada en `CurrencyQuote` por `(moneda, variante, mes)` (upsert idempotente) y propaga la variante **oficial** a `ReferenceRate.rate` del mismo `(moneda, mes)`.
- [ ] Se guardan **oficial y blue** para ARS; la **conversión interna del producto usa solo la oficial** (la variante no es elegible por UI en v1).
- [ ] El conjunto de variantes es **extensible sin migración**: `variant` es string libre validado contra una allowlist en código (`docs/data-model/cotizaciones.md`, §`CurrencyQuote`). Sumar una variante futura es editar la allowlist, no el esquema.
- [ ] Semántica de pivote: cada valor es **unidades de la moneda por 1 USD**; **USD no tiene fila** (pivote implícito = 1).
- [ ] La conversión interna (`/mes`, dashboard, reportes) **lee solo `ReferenceRate`**; las variantes no-oficiales no afectan ningún total en v1.
- [ ] Un dato externo que no pasa validación (schema, cotas de cordura, circuit breaker > 15%) **no sobrescribe** el valor vigente y se registra en `RateSyncLog` (ver RF-SYNC-001 y `docs/data-model/cotizaciones.md`, §Seguridad de la ingesta).

---

## RF-IPC-001 — Captura del IPC argentino

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema obtiene el IPC nacional (INDEC) por mes desde `apis.datos.gob.ar` y lo guarda en `InflationRate`. El dato lo consumen los **reportes que muestran inflación** (RF-REP-010, RF-REP-012, RF-REP-013) y se muestra al usuario en el bloque de datos externos de `/configuracion` (RF-SYNC-002). |
| **Actor** | Sistema (disparado por un proceso de operación / cron) |
| **Prioridad** | Media |
| **Precondiciones** | El disparador presenta el secret de operación válido. Hay conectividad con la fuente. |

**Criterios de aceptación:**
- [ ] La fuente es `apis.datos.gob.ar` (series de tiempo INDEC): variación mensual (`145.3_INGNACUAL_DICI_M_38`) y nivel del índice (`148.3_INIVELNAL_DICI_M_26`).
- [ ] Cada corrida **completa todos los meses faltantes**: trae ambas series desde un mes de arranque hasta el **último mes publicado por la fuente**. El mes de arranque es:

  | Estado de `InflationRate` | Arranca desde |
  |---|---|
  | Con huecos dentro del rango que cubre (entre el primer y el último mes guardado) | el **primer mes faltante** (ej.: 08 y 10 guardados, 09 faltante → desde 09) |
  | Sin huecos | el **último mes guardado**, inclusive |
  | Vacía | **24 meses atrás** del mes en curso |

  Los meses ya guardados que vuelven en la respuesta se re-upsertean con las mismas validaciones (captan revisiones de la fuente). INDEC publica con desfasaje: el mes en curso **no tiene dato** hasta que la fuente lo publica, y una corrida que no encuentra meses nuevos no cambia nada (desenlace "ya estaba al día" de RF-SYNC-002).
- [ ] Cada mes se valida y se guarda **por separado**, con su propia fila de auditoría: un mes rechazado no frena a los siguientes. Un mes que aparece en **una sola** de las dos series se rechaza (`schema`).
- [ ] No hay ingesta agendada dentro del sistema: el IPC se captura solo cuando corre el trigger de operación (RF-SYNC-001) o el disparo manual (RF-SYNC-002).
- [ ] Cada mes se guarda en `InflationRate` por `yearMonth` (clave única, upsert idempotente): variación mensual + nivel del índice + fuente + instante de captura.
- [ ] El IPC **no alimenta** la conversión de monedas ni los totales del mes; sí lo consumen los reportes que exponen inflación o variación ajustada (RF-REP-010, RF-REP-012, RF-REP-013) y la superficie de datos externos de `/configuracion` (RF-SYNC-002).
- [ ] Mismas garantías de ingesta segura que RF-FX-001 (schema estricto, cotas, log de auditoría).

---

## RF-SYNC-001 — Trigger de sincronización sin datos

| Campo | Detalle |
|---|---|
| **Descripción** | La ingesta se dispara con `POST /settings/reference-rates/sync`, que **no recibe valores de cotización** en el body —solo gatilla el fetch server-side a las fuentes oficiales— y está protegido por un secret de operación. El caller no puede inyectar números. |
| **Actor** | Sistema (proceso de operación / cron autorizado) |
| **Prioridad** | Media |
| **Precondiciones** | El request presenta el secret de operación (`CRON_SECRET`) válido. |

**Criterios de aceptación:**
- [ ] El endpoint **no acepta valores** de cotización ni de IPC en el body (a lo sumo un selector de scope `fx`/`ipc`/`all`); cualquier valor que llegue se descarta.
- [ ] Está protegido por **`CRON_SECRET`** (no por el JWT de usuario): sin secret válido responde `401`. El secret nunca se loguea.
- [ ] El proceso aplica **validación estricta** del dato externo (schema, cotas de cordura) y un **circuit breaker al 15%** (un valor que se desvía > 15% del último guardado **no** sobrescribe, se marca anomalía y se refleja en la respuesta).
- [ ] Cada intento de escritura (aceptado o rechazado) queda registrado en `RateSyncLog` con su motivo.
- [ ] La respuesta es **ruidosa ante la anomalía**: un rechazo aislado entre varios targets devuelve `200` con el detalle; una corrida sin ningún target aceptado (fuente caída, dato inválido) responde **no-2xx** (`422`/`502`). Contrato completo en `docs/data-model/cotizaciones.md`, §Contrato — `POST /settings/reference-rates/sync`; seguridad en §Seguridad de la ingesta del mismo archivo.

---

## RF-SYNC-002 — Consulta y disparo manual de los datos externos

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario **ve** los datos externos vigentes —IPC y cotizaciones— y puede **pedir una corrida de captura** a mano, desde la sección **General** de `/configuracion`. Es una superficie de **solo lectura con una sola acción**: lo único que escribe es la corrida. Qué muestra y con qué anatomía, en `docs/screens.md` §9. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Disparo manual:** corre la **misma ingesta** que el trigger de operación (RF-SYNC-001), siempre sobre **todos** los targets (FX + IPC), pero autenticado por la **sesión del usuario** en lugar del secret de operación. Mientras la corrida está en curso la acción queda inhabilitada.

**Tres desenlaces distinguibles** — el usuario tiene que poder saber cuál de los tres ocurrió:

| Desenlace | Qué significa |
|---|---|
| **Se actualizó** | La corrida dejó al menos un valor distinto del que se estaba mostrando. |
| **Ya estaba al día** | La corrida terminó bien y **ningún valor cambió**. **No es un fallo**: es el desenlace esperado cuando la fuente no publicó nada nuevo. |
| **Falló** | La corrida no se pudo completar. Lo mostrado no cambia y la acción queda disponible para reintentar. |

**Criterios de aceptación:**
- [ ] La superficie vive **dentro de la sección General** de `/configuracion`: no es una sección propia del hub ni tiene ruta propia.
- [ ] Es **solo lectura sobre el dato**: no permite editar ni cargar a mano ninguna cotización ni ningún valor de IPC — la tabla de referencia sigue siendo interna y no editable por UI (RF-CUR-006).
- [ ] El disparo manual está disponible para **cualquier usuario autenticado** y corre la ingesta **completa** (FX + IPC); no expone ni requiere el secret de operación de RF-SYNC-001.
- [ ] Los **tres desenlaces** se comunican de forma distinguible entre sí, y **"ya estaba al día" no se presenta como error**.
- [ ] Un fallo al cargar los datos se informa **sin romper** el resto de General (la moneda por defecto sigue editable).
