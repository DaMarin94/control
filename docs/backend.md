# Backend — índice

La documentación del backend vive en `docs/backend/`. **`base.md` se lee siempre** (lo transversal); el resto es un archivo por módulo/feature.

| Sección | Archivo | Incluye |
|---|---|---|
| Stack | `backend/base.md` | |
| Arranque (bootstrap) | `backend/base.md` | CORS |
| Estructura y capas | `backend/base.md` | Capas dentro de cada módulo; Propiedad de dominio |
| Capa de datos (Prisma) | `backend/base.md` | Entidades; Decisiones de modelado; Filtro de borrado lógico; Migraciones y seed |
| Módulos | `backend/base.md` | |
| Endpoints | `backend/base.md` | DELETE → `204 No Content`; Índice de endpoints |
| Autenticación | `backend/base.md` | Endpoints; Hashing; JWT; Guard global y rutas públicas; Categorías por defecto al alta |
| Movimientos únicos (TransactionsModule) | `backend/unicos.md` | Endpoints; Validación de categoría (RN-010) |
| Movimientos del mes (MovementsModule) | `backend/movimientos-mes.md` | `GET /movements`; Bucketeo; Totales; Integración de fijos, cuotas y simulados |
| Movimientos del mes → Serie de reportes, Rango de años, Reportes anuales de Únicos / Cuotas / Inflación vs Ingresos, Detalle histórico de Fijos | `backend/graficos.md` | Filtros; Aporte simulado; Proyección de fijos (RF-REP-015); `yearRange`; `evolutionAvailable` |
| Movimientos fijos (RecurringModule) | `backend/fijos.md` | Endpoints; Anulación de apariciones; Split al editar; Cálculo de aparición; Eliminación; Reapertura (RF-MF-008) |
| Movimientos calculados | `backend/calculados.md` | Enganche por FK; `chainId`; Derivación on-the-fly; `hasCalculated`; Imputación; Eliminación |
| Movimientos en cuotas (InstallmentsModule) | `backend/cuotas.md` | |
| `CategoryValidatorService` | `backend/categorias.md` | |
| Categorías (CategoriesModule) | `backend/categorias.md` | Pool de colores; Normalización y unicidad; `ReactivableConflictException` |
| Métodos de pago (PaymentMethodsModule) | `backend/metodos-pago.md` | Campos condicionales; Allowlists; Método y débito automático en movimientos |
| Preferencias de usuario (PreferencesModule) | `backend/preferencias.md` | |
| Simulación de categoría (SimulationsModule) | `backend/simulacion.md` | Dependencia `Movements → Simulations`; API de derivación; Proyección compartida; Alta múltiple; Extender |
| Historial de cambios (HistoryModule) | `backend/historial.md` | Captura; Retención y purga; Deshacer; Excepción arquitectónica; Campos emitidos |
