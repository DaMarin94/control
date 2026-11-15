# Documentación de Control — mapa

Punto de entrada a `docs/`. Cada `docs/<x>.md` de nivel superior es un **índice** de su carpeta (`docs/<x>/`): se entra por el índice y se lee **solo** el archivo que hace falta. `base.md` (frontend y backend) se lee siempre que se toque ese lado.

## Qué leer según la tarea

| Tarea | Leer |
|---|---|
| Feature de **fijos** (incluye anulación, reapertura, frecuencia) | `requirements/fijos.md` · `data-model/movimientos.md` (+ `data-model/reapertura.md` si es reapertura) · `backend/fijos.md` · `frontend/fijos.md` · `design/fijos-frecuencia.md`, `design/anulacion-fijo.md`, `design/reabrir-fijo.md` |
| Feature de **calculados** | `requirements/calculados.md` · `data-model/calculados.md` · `backend/calculados.md` · `frontend/calculados.md` · `design/form-movimiento.md` |
| Feature de **únicos** / **cuotas** | `requirements/unicos.md` / `requirements/cuotas.md` · `data-model/movimientos.md` · `backend/unicos.md` / `backend/cuotas.md` · `frontend/unicos.md` / `frontend/cuotas.md` |
| **Vista del mes** / **Dashboard** | `requirements/vista-mes.md` / `requirements/dashboard.md` · `data-model/movimientos.md`, `data-model/filtro-categorias.md` · `backend/movimientos-mes.md` · `frontend/vista-mes-y-dashboard.md` · `design/mes-listado.md`, `design/card-detalle.md` |
| **Reportes** (cards de `/reportes`) | `requirements/informes.md` · `data-model/informes.md`, `data-model/preferencias.md` §`reports` · `backend/graficos.md` · `frontend/graficos.md` · `design/card-grafico.md`, `design/graficos.md`, `design/graficos-anuales.md`, `design/historico-fijos.md` |
| Categorías / Métodos de pago | `requirements/categorias.md` / `requirements/metodos-pago.md` · `data-model/categorias.md` / `data-model/metodos-pago.md` · `backend/categorias.md` / `backend/metodos-pago.md` · `frontend/categorias.md` / `frontend/metodos-pago.md` · `design/categorias-colores.md` / `design/metodos-pago-iconos.md` |
| Límites | `requirements/limites.md` · `data-model/preferencias.md` §`limits` · `frontend/limites.md` · `design/limites.md`, `design/limites-by-category.md` |
| Historial / Deshacer | `requirements/historial.md` · `data-model/historial.md` · `backend/historial.md` · `frontend/historial.md` · `design/historial.md`, `design/toast-deshacer.md` |
| Simulación de categoría | `requirements/simulacion.md` · `data-model/simulacion.md` · `backend/simulacion.md` · `frontend/simulacion.md` · `design/simulacion-categoria.md`, `design/simulados-en-cards.md` |
| Multi-moneda / cotizaciones externas | `requirements/multi-moneda.md`, `requirements/sincronizacion.md` · `data-model/settings.md`, `data-model/cotizaciones.md` · `design/moneda.md`, `design/datos-externos.md` |
| **Endpoint nuevo** o cambio de contrato | `backend/base.md` (capas, DELETE, índice de endpoints) · el archivo de `data-model/` del contrato · `technical.md` (sobre de respuesta, validación, migraciones) |
| **Cambio visual** | `design/fundamentos.md` (base obligatoria) + el archivo del patrón (índice en `design.md`) |
| Pantalla nueva o cambio de pantalla | `screens.md` + el módulo de `requirements/` |
| Decisión estructural / stack | `architecture.md` · `technical.md` |
| Regla de negocio transversal | `requirements/reglas-de-negocio.md` (RN) |
| Estado de una feature | `features.md` |

Ubicar un RF/RN por ID: tabla ID → archivo en `requirements.md`. Ubicar una sección de data-model / frontend / backend / design por título: tabla del índice correspondiente.

## Dónde se documenta cada cosa

Un **destino canónico por faceta**. El resto **referencia** (por archivo y título de sección), no repite.

| Faceta | Destino |
|---|---|
| Requerimiento / decisión de producto | `requirements/<módulo>.md` |
| Regla de negocio (RN) | `requirements/reglas-de-negocio.md` |
| Definiciones, RNF, fuera de alcance | `requirements/definiciones-y-alcance.md` |
| Término del dominio | `requirements/glosario.md` |
| Contrato de API / shape / clave de preferencias | `data-model/<contrato>.md` |
| Entidad o decisión de datos | `data-model/entidades.md` |
| Implementación backend (mecánica, gotchas) | `backend/<módulo>.md` (transversal: `backend/base.md`) |
| Implementación frontend (arquitectura, gotchas) | `frontend/<feature>.md` (transversal: `frontend/base.md`) |
| Estructura y stack | `architecture.md` |
| Estándares transversales (respuesta, errores, logging, testing, migraciones, env, deploy) | `technical.md` |
| Estado de implementación | `features.md` — una línea por feature |
| Pantallas (contenido, acciones, navegación, estados) | `screens.md` |
| Lenguaje visual y specs | `design/` — solo `control-design` escribe acá |
| Archivos de agente (`.claude/agents/`) | Solo reglas que el agente necesita para trabajar; **sin gotchas por feature** (el gotcha va a `docs/` y el agente apunta ahí) |

**Regla:** archivo nuevo en una carpeta ⇒ fila nueva en el índice de esa carpeta (`requirements.md`, `data-model.md`, `frontend.md`, `backend.md`, `design.md`).

Reglas de redacción: skill `documentar` (`.claude/skills/documentar/SKILL.md`).
