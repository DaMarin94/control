# Data Model (índice)

> Modelo de datos de Control: entidades, decisiones de negocio sobre los datos y contratos de API. Se divide en un archivo por tema dentro de `docs/data-model/`. El schema de Prisma está en `backend/prisma/schema.prisma` (fuente de verdad para tipos, campos y constraints); las decisiones de modelado a nivel DB están en `docs/backend/base.md` §Capa de datos. Los requerimientos se ubican por ID en `docs/requirements.md`.

## Sección → archivo

| Sección | Archivo |
|---|---|
| Entidades | `data-model/entidades.md` |
| Decisiones de negocio sobre los datos | `data-model/entidades.md` |
| Contrato de autenticación (auth / JWT) | `data-model/auth.md` |
| Contrato de preferencias de usuario (preferences) | `data-model/preferencias.md` |
| Claves del blob (`monthSections`, `reports`, `monthListFilters`, `unicosSort`, `theme`, `sidebarOpen`, `limits`, `defaultPaymentMethods`, `monthCategoryFilter`) | `data-model/preferencias.md` |
| Contrato de configuración del usuario (settings) | `data-model/settings.md` |
| `GET /settings/reference-rate` — pre-fill de cotización del mes | `data-model/settings.md` |
| Tabla de cotizaciones de referencia (`ReferenceRate`) | `data-model/settings.md` |
| Cotizaciones externas y sincronización (P7a / P7b) | `data-model/cotizaciones.md` |
| `CurrencyQuote` — variantes de cotización FX (tabla relacional) | `data-model/cotizaciones.md` |
| `InflationRate` — IPC argentino (P7b) | `data-model/cotizaciones.md` |
| `RateSyncLog` — auditoría de la sincronización | `data-model/cotizaciones.md` |
| Contrato — `POST /settings/reference-rates/sync` | `data-model/cotizaciones.md` |
| Seguridad de la ingesta | `data-model/cotizaciones.md` |
| Contrato de categorías (shape `Categoria`) | `data-model/categorias.md` |
| Payload reactivable en errores (409) | `data-model/categorias.md` |
| Matriz de colores (dato del dominio) | `data-model/categorias.md` |
| Métodos de pago (`PaymentMethod`) | `data-model/metodos-pago.md` |
| Contrato de movimiento único (respuesta de la API) | `data-model/movimientos.md` |
| Contrato de movimientos del mes (respuesta de `GET /movements`) | `data-model/movimientos.md` |
| Contrato de reapertura de fijos (`/recurring/:id/reopen`) | `data-model/reapertura.md` |
| Contrato de movimientos calculados | `data-model/calculados.md` |
| Escalado del operando (entero, sin floats) | `data-model/calculados.md` |
| Campos de `Recurring` para calculados (shape de respuesta) | `data-model/calculados.md` |
| Columnas placeholder de un calculado (trampa del modelo) | `data-model/calculados.md` |
| Contrato de serie de reportes (respuesta de `GET /movements/reports`) | `data-model/informes.md` |
| Rango de años navegable (`yearRange`) | `data-model/informes.md` |
| Contrato de reporte anual de Únicos (respuesta de `GET /movements/reports/annual-unicos`) | `data-model/informes.md` |
| Contrato de reporte anual de Cuotas (respuesta de `GET /movements/reports/annual-cuotas`) | `data-model/informes.md` |
| Contrato de reporte anual de Inflación vs Ingresos (respuesta de `GET /movements/reports/annual-inflation-income`) | `data-model/informes.md` |
| Contrato del detalle histórico de Fijos (respuesta de `GET /movements/reports/fijos-historico`) | `data-model/informes.md` |
| Simulación de categoría (`Simulation` + `/simulations`) | `data-model/simulacion.md` |
| Historial de cambios (`HistoryEntry` + `GET /history` · `POST /history/:id/undo`) | `data-model/historial.md` |
| Campos del bloque "Qué cambió" — set cerrado de 12 | `data-model/historial.md` |
| Gotcha — la ausencia de `next` es el discriminador, no `next === null` | `data-model/historial.md` |
| `historyEntryId` — id de la entrada en las respuestas de edición, eliminación y reapertura | `data-model/historial.md` |
| Filtro de categorías — query param `categories` | `data-model/filtro-categorias.md` |
| Preferencia `monthListFilters` — filtros por listado de la Vista del mes (RF-VM-006) | `data-model/filtro-categorias.md` |
| Preferencia `monthCategoryFilter` — filtro de la Vista del mes (RF-VM-006) — **DEPRECADA** | `data-model/filtro-categorias.md` |
