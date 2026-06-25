# Features

> Estado de implementación de cada feature.
> Para la descripción funcional completa y criterios de aceptación ver `docs/requirements.md`.

---

## Estado general

| Feature | ID req. | Estado |
|---------|---------|--------|
| Auth — email/contraseña (login + registro) | RF-AUTH-005..006, 002..004 | Implementado |
| Auth — Google OAuth | RF-AUTH-001 | Scaffolded (diferido) |
| Dashboard — resumen del mes (en `/`) | RF-DASH-001..003, 005 | Implementado |
| Formulario de carga (tabs único/fijo/cuotas) | RF-CM-001 | Implementado |
| Movimiento único — crear, editar, eliminar | RF-MU-001..003 | Implementado |
| Movimiento fijo — crear, visualizar, editar, eliminar | RF-MF-001..004 | Implementado |
| Fijos extendidos — anular por mes (P1) + periodicidad (P2) | RF-MF-005..006, RN-016 | Implementado |
| Movimiento en cuotas — crear, visualizar, editar, eliminar | RF-MC-001..003 | Implementado (solo Gasto en v1) |
| Movimientos calculados — fijo/único/cuota de origen | RF-MCALC-001..010, RN-017..019 | Implementado |
| Categorías — defaults + CRUD + soft delete | RF-CAT-001..006 | Implementado |
| Color de categoría editable — matriz de 70 colores | RF-CAT-005, RN-013 | Implementado |
| Vista del mes — lista + totales + navegación | RF-VM-001..004 | Implementado |
| Vista del mes — salto rápido mes/año (popover de dos ruedas) + navegación ilimitada | RF-VM-004 | Implementado |
| Skeletons — sistema unificado de estados de carga (primitivas `Skeleton*` + regla) | — | Implementado |
| Vista del mes — secciones colapsables + reordenables (persistidas) | RF-VM-005 | Implementado |
| Vista del mes — filtros por listado (tipo + categoría por sección, filtrado en front) | RF-VM-006 | Implementado |
| Reportes + listado — filtro vía leyenda interactiva en cards y orden configurable de Únicos | RF-REP-002/006, RF-VM-001 | Implementado |
| Navegación global — sidebar persistente | RF-NAV-001 | Implementado |
| Crear categoría desde el formulario de movimiento | RF-MU-004 | Implementado |
| Reportes — pantalla configurable por cards + widget en dashboard | RF-REP-001..005 | Implementado |
| Reportes — toggle "Total / Por categoría" en la card Ingresos y gastos | RF-REP-006 | Implementado |
| Reportes — moneda de display por card (selector por card, nace con la default global) | RF-REP-007 | Implementado |
| Reportes — título editable por card (placeholder "Reporte N" si vacío) | RF-REP-008 | Implementado |
| Reportes — cards reordenables por drag & drop (modo orden, ≥2 cards) | RF-REP-009 | Implementado |
| Reportes — card "Reporte anual de Únicos" (grilla día × mes + footer de métricas mensuales) | RF-REP-010 | Implementado |
| Reportes — card "Reporte anual de gastos en Cuotas" (gantt de barras horizontales por mes) | RF-REP-011 | Implementado |
| Multi-moneda — set curado 4 (ARS/USD/EUR/BRL) + tabla de cotizaciones de referencia + pantalla `/configuracion` | RF-CUR-001..006, RN-009 | Implementado |
| Modo de color — toggle Sistema/Claro/Oscuro en el chrome global (sidebar), persistido (blob `theme`) | RF-APP-001 | Implementado |
| Sincronización de cotizaciones externas — FX (dolarapi/Frankfurter) + IPC (datos.gob.ar) vía trigger sin datos | RF-FX-001, RF-IPC-001, RF-SYNC-001 | Definido (no implementado) |
| Preferencias de usuario — cimiento (blob JSON + sesión) | — | Implementado (sin UI de producto) |

---

## Notas de implementación

> Solo comportamientos no obvios. El detalle vive en los docs canónicos referenciados.

- **Auth.** Email + contraseña operativo end-to-end (el backend emite el JWT, el front lo reenvía como Bearer). Google OAuth scaffolded pero inactivo (faltan credenciales y la verificación server-side del `id_token`). Sesión persistente y protección de rutas vía Auth.js + `src/middleware.ts`; auto-login tras registro. Detalle en `docs/backend.md` y `docs/frontend.md`, §Autenticación.
- **Categorías.** CRUD scopeado por `userId`, soft delete, contador "N movimientos" (RF-CAT-006). Flujo crear-o-reactivar ante nombre que colisiona con una eliminada (`409` con `error.data`). Color elegible/editable desde una matriz de 70 colores (RF-CAT-005), default "menos usado" al crear. Detalle en `docs/backend.md` §Categorías, `docs/data-model.md` §Matriz de colores.
- **Movimientos del mes.** Endpoint unificado `GET /movements?month=YYYY-MM` (totales + únicos/fijos/cuotas). El mes de cada movimiento se bucketea con la zona propia del registro (`AT TIME ZONE` en raw SQL parametrizado). Fijos y cuotas se calculan on-the-fly (RN-006), sin filas por instancia. Contrato en `docs/data-model.md` §Contrato de movimientos del mes; implementación en `docs/backend.md` §Movimientos del mes.
- **Dashboard** en `/` (resumen del mes en curso, "Nuevo movimiento", "Ver todos" → `/mes`, estado vacío con CTA). No lista movimientos.
- **Vista del mes** `/mes`: tres secciones colapsables/reordenables siempre visibles (RF-VM-005), con filtros por listado (tipo + categoría) y totales recalculados en el frontend (RF-VM-006).
- **Fijos.** Inmutabilidad del pasado vía split (cadena de filas `Recurring`). Anular por mes (toggle `RecurringSkip`) y periodicidad (`frequency`, set cerrado, inmutable). Detalle en `docs/backend.md` §Movimientos fijos.
- **Cuotas.** Solo Gasto en v1 (el tab no ofrece selector de tipo; el backend rechaza `INCOME` con `400`). Editar es in-place del grupo completo; eliminar es hard delete del grupo entero. Detalle en `docs/backend.md` §Movimientos en cuotas.
- **Calculados.** Fijo cuyo monto/tipo se derivan al vuelo del monto de un origen (fijo, único o cuota) vía fórmula. Creación solo desde la acción "crear movimiento desde este" del kebab. Vínculo al origen por `chainId` (fijo) o FK (`onDelete: Cascade`) para único/cuota. Reglas en `requirements.md` §3.4.b; contrato en `docs/data-model.md` §Contrato de movimientos calculados.
- **Reportes** (`/reportes`): pantalla configurable por cards persistidas (clave `reports`); cada card es un widget autónomo con año y filtro de categorías embebidos. El dashboard monta solo la card Ingresos vs. Gastos en modo efímero. Card `income-expense` con toggle "Total / Por categoría" (RF-REP-006). Backend `GET /movements/reports`. Detalle en `docs/frontend.md` §Reportes, `docs/backend.md` §Serie de reportes.
- **Multi-moneda.** Moneda + cotización por movimiento sobre un set curado de 4 (ARS/USD/EUR/BRL); totales convertidos a la `defaultCurrency` del usuario (capa de display, no toca lo guardado). Conversión vía pivote USD con la tabla de cotizaciones de referencia (global, interna, no editable por UI). Pantalla `/configuracion` edita la moneda default. Reglas en `requirements.md` §3.10; contrato en `docs/data-model.md` §Moneda explícita / §Tabla de cotizaciones de referencia.
- **Preferencias de usuario.** Blob JSON 1:1 con el usuario, cargado en la sesión de Auth.js al loguear; semántica de reemplazo total en `PUT /preferences`. Lo consumen `monthSections`, `monthListFilters` y `reports`. Detalle en `docs/data-model.md` §Contrato de preferencias.
- **Mes contexto.** Abrir "Nuevo movimiento" desde `/mes` propaga el mes navegado como default del "mes de inicio" en los tabs Fijo y Cuotas (el tab Único lo ignora). El mes de inicio admite meses pasados.
