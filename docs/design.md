# Guía de diseño — Control (índice)

> Guía **viva** del lenguaje visual de Control: la versión curada y vigente que `control-design` mantiene (único escriba) y que `control-frontend` implementa. Sistema **"Precise Ledger"**, densidad Medio, acento Índigo, modos claro y oscuro (default Sistema).
>
> - El contenido vive en **`docs/design/*.md`** (este archivo es solo el índice). Ante conflicto con el handoff crudo (`docs/design/README.md`, `control.css`, `app.js`, `Control - Hi-Fi.html`, `icon-export/` — no se editan), prevalece la guía.
> - Cómo están portados los tokens al código: secciones Design system de `docs/frontend.md`.
> - El código cita `docs/design.md §<Título>`: buscá el título en la tabla de abajo para saber en qué archivo vive. Los títulos son estables.
> - Para escribir un spec nuevo: skill `spec-visual` (`.claude/skills/spec-visual/SKILL.md`). QA visual: skill `qa-visual` (`.claude/skills/qa-visual/SKILL.md`).

## Archivos

| Archivo | Contenido |
|---|---|
| `design/fundamentos.md` | **Base obligatoria de todo spec:** reglas duras, tokens, tipografía, espaciado, radios, sombras, focus, modo claro/oscuro, jerarquía/layout, contención responsive. |
| `design/captura.md` | Superficie de captura (régimen de pantalla chica: carga de movimiento y login). |
| `design/sidebar.md` | Sidebar mostrar/ocultar, padding del logo, logo de marca. |
| `design/overlays-modales.md` | Cierre de overlays (modales vs. popovers) y contrato de shell (overflow, bloqueo del fondo). |
| `design/scroll-interno.md` | Superficies con scroll interno (tablas y gráficos anchos). |
| `design/navegacion-periodo.md` | PeriodNav, selector de salto mes/año, link "Ir al mes en curso". |
| `design/skeletons.md` | Sistema unificado de estados de carga. |
| `design/categorias-colores.md` | Paleta de colores de categorías y su picker. |
| `design/metodos-pago-iconos.md` | Íconos de método de pago, débito automático, predeterminado. |
| `design/moneda.md` | Multi-moneda: cromo neutro, indicador global, símbolos, set ARS/USD/EUR/BRL, disclosure "Más opciones". |
| `design/mes-listado.md` | `/mes`: acordeón, filtros por sección, orden de Únicos, sublínea, ítem anulado + kebab, duplicar. |
| `design/fijos-frecuencia.md` | Frecuencia del fijo, su selector, arranque/vigencia. |
| `design/card-detalle.md` | Card de detalle de movimiento y su vista evolución. |
| `design/form-movimiento.md` | Total del plan de cuotas, form de calculado, mes del monto base. |
| `design/card-grafico.md` | Card de reporte: widget, modo orden, título editable, moneda por card, refrescar. |
| `design/graficos.md` | Formas 1 y 2, toggle Barra/Línea, `income-expense` y sus filtros, leyenda interactiva, filtro embebido. |
| `design/graficos-anuales.md` | Cards anuales: Únicos (grilla), Cuotas (gantt), Inflación vs Ingresos. |
| `design/historico-fijos.md` | Card "Detalle histórico de fijos" (`fixed-evolution`). |
| `design/simulados-en-cards.md` | Movimientos simulados en cards de `/reportes` (RF-REP-017). |
| `design/limites.md` | Límites: marca pasiva, panel de gestión + hub `/configuracion`, aviso activo, popover informativo. |
| `design/limites-by-category.md` | Marcas de límite en `by-category` (cartucho de mes). |
| `design/datos-externos.md` | `/configuracion` → Datos externos (IPC + cotizaciones). |
| `design/historial.md` | `/historial`: entradas, deshacer, bloqueo LIFO. |
| `design/toast-deshacer.md` | Sistema de toasts y Deshacer inmediato. |
| `design/anulacion-fijo.md` | Modal de alcance de la anulación de un fijo (RF-MF-005). |
| `design/reabrir-fijo.md` | Reabrir un fijo terminado (RF-MF-008). |
| `design/simulacion-categoria.md` | Simulación de categoría en `/mes` (RF-SIM-001..004). |
| `design/gate-arranque.md` | Gate de arranque del backend. |

## Sección → archivo

| Sección (título textual) | Archivo |
|---|---|
| Reglas duras | `design/fundamentos.md` |
| Paleta y uso de tokens | `design/fundamentos.md` |
| Acento de marca — Índigo (default) | `design/fundamentos.md` |
| Semánticos — income / expense (NO cambian con el acento) | `design/fundamentos.md` |
| Neutros | `design/fundamentos.md` |
| Tipografía | `design/fundamentos.md` |
| Escala de texto (roles) | `design/fundamentos.md` |
| Prosa secundaria — dos filas y una regla de subordinación | `design/fundamentos.md` |
| Espaciado y densidad | `design/fundamentos.md` |
| Geometría (radios) | `design/fundamentos.md` |
| Sombras | `design/fundamentos.md` |
| Focus ring | `design/fundamentos.md` |
| Modo de color — claro / oscuro | `design/fundamentos.md` |
| Cómo se modela | `design/fundamentos.md` |
| Principios de calibración del oscuro | `design/fundamentos.md` |
| Paleta dark — valores completos (oklch) | `design/fundamentos.md` |
| Categorías y gráficos en oscuro | `design/fundamentos.md` |
| Panel de marca de auth en oscuro | `design/fundamentos.md` |
| Transición de cambio de modo | `design/fundamentos.md` |
| Selector de modo de color (chrome global) | `design/fundamentos.md` |
| Principios de jerarquía y layout | `design/fundamentos.md` |
| Contención responsive | `design/fundamentos.md` |
| Dos regímenes de superficie — la frontera es el tamaño | `design/fundamentos.md` |
| La política del régimen de app — contener, no adaptar | `design/fundamentos.md` |
| El breakpoint — un solo umbral nombrado | `design/fundamentos.md` |
| El piso del régimen de app — 600px, por construcción | `design/fundamentos.md` |
| Los cuatro invariantes de contención | `design/fundamentos.md` |
| Ancho de contenido de página — llenar hasta el cap, después centrar | `design/fundamentos.md` |
| Obligación sobre los specs | `design/fundamentos.md` |
| Franja de checkpoints — anchos de referencia (con el sidebar en juego) | `design/fundamentos.md` |
| Superficie de captura | `design/captura.md` |
| 0. Encuadre — una lógica, dos composiciones | `design/captura.md` |
| 1. Envase de captura — anatomía y zonas | `design/captura.md` |
| 2. Safe areas y alto real | `design/captura.md` |
| 3. Teclado virtual abierto | `design/captura.md` |
| 4. Densidad táctil y ritmo — la escala propia de esta superficie | `design/captura.md` |
| 5. Cabecera A — chrome de la sesión (identidad + cierre) | `design/captura.md` |
| 6. Cabecera B — barra de tabs (Único / Fijo / Cuotas) | `design/captura.md` |
| 7. Cuerpo — el form, con el Monto de protagonista | `design/captura.md` |
| 8. Footer — la acción primaria | `design/captura.md` |
| 9. Guardado con éxito — confirmación y estado posterior | `design/captura.md` |
| 10. Overlays sobre la superficie | `design/captura.md` |
| 11. Errores, validación y estados | `design/captura.md` |
| 12. Disposición corta — `--bp-short` | `design/captura.md` |
| 13. Acceso (login) en régimen de captura | `design/captura.md` |
| 14. Invariantes de la superficie | `design/captura.md` |
| 15. Agregados más allá del brief — estado | `design/captura.md` |
| 16. Reglas duras reafirmadas | `design/captura.md` |
| Checklist de aceptación visual — Superficie de captura | `design/captura.md` |
| Sidebar — mostrar/ocultar (chrome toggleable) | `design/sidebar.md` |
| Estado abierto (default) | `design/sidebar.md` |
| Estado cerrado | `design/sidebar.md` |
| Borde crítico — sidebar abierto a ancho apretado: empuja, no overlay | `design/sidebar.md` |
| Transición de abrir/cerrar | `design/sidebar.md` |
| Carga inicial sin flash | `design/sidebar.md` |
| Sidebar de navegación global — padding superior del logo | `design/sidebar.md` |
| Logo de marca — ícono real (gem) en sidebar y login | `design/sidebar.md` |
| Paleta de colores para categorías | `design/categorias-colores.md` |
| Regla dura | `design/categorias-colores.md` |
| Regla de diseño rectora — máxima separación perceptual | `design/categorias-colores.md` |
| La matriz — fuente de verdad compartida (8 hues × 5 tonalidades) | `design/categorias-colores.md` |
| Subset base (pool de asignación automática) — orden explícito | `design/categorias-colores.md` |
| Picker — geometría del grid | `design/categorias-colores.md` |
| Notas de construcción y comportamiento | `design/categorias-colores.md` |
| Picker de color de categoría (matriz de swatches) | `design/categorias-colores.md` |
| Métodos de pago — identificador de ícono | `design/metodos-pago-iconos.md` |
| Campos del modal según tipo | `design/metodos-pago-iconos.md` |
| Regla dura y decisión de color — SIN campo de color | `design/metodos-pago-iconos.md` |
| Set curado de íconos — allowlist v1 (`PAYMENT_METHOD_ICONS`) | `design/metodos-pago-iconos.md` |
| Default y ausencia de "Aleatorio" | `design/metodos-pago-iconos.md` |
| Icon-picker en el modal de método — espejo del color-picker | `design/metodos-pago-iconos.md` |
| Render del ícono en la lista de `/configuracion/metodos-pago` | `design/metodos-pago-iconos.md` |
| Render del ícono en el selector de método del form de carga | `design/metodos-pago-iconos.md` |
| Débito automático — control condicional en el form de carga | `design/metodos-pago-iconos.md` |
| Débito automático — indicador en la card de detalle | `design/metodos-pago-iconos.md` |
| Predeterminado por estructura — configuración en el modal + indicador de solo-lectura en la fila de `/configuracion/metodos-pago` | `design/metodos-pago-iconos.md` |
| Patrones de componentes vigentes | grupo: los archivos de patrones de este índice (overlays, scroll, navegación, skeletons, listado, cards, gráficos, moneda, form, fijos) |
| Cierre de overlays — modales vs. popovers | `design/overlays-modales.md` |
| Overflow de modales y bloqueo del fondo (contrato de shell) | `design/overlays-modales.md` |
| Superficies con scroll interno — contención de tablas y gráficos anchos | `design/scroll-interno.md` |
| PeriodNav — navegación de período (flechas gigantes laterales + modo `.stepper`) | `design/navegacion-periodo.md` |
| Acordeón — sección colapsable + reordenable | `design/mes-listado.md` |
| Card de reporte — widget de gráfico autónomo | `design/card-grafico.md` |
| Reportes reordenables — modo orden de cards (antes: "… (Ola 2, P1)") | `design/card-grafico.md` |
| Título editable de la card de reporte (antes: "… (Ola 2, P4)") | `design/card-grafico.md` |
| Moneda por reporte — selector embebido en la cabecera de la card (antes: "… (Ola 3, P3)") | `design/card-grafico.md` |
| Botón de refrescar por reporte — utilidad per-card (antes: "… (P5)") | `design/card-grafico.md` |
| Gráficos — Forma 1 y Forma 2 | `design/graficos.md` |
| Reporte anual de Únicos — grilla día × mes (antes: "… (Ola 3, P2)") | `design/graficos-anuales.md` |
| 9. Techo editable de la escala de color (antes: "… (P3)") | `design/graficos-anuales.md` |
| Reporte anual de Cuotas — gantt de barras horizontales (antes: "… (Ola 3, P2)") | `design/graficos-anuales.md` |
| Reporte anual "Inflación vs Ingresos" — gráfico de líneas (antes: "… (Ola 4, P5)") | `design/graficos-anuales.md` |
| Reporte "Detalle histórico de fijos" — gráfico de líneas por fijo (`fixed-evolution`) | `design/historico-fijos.md` |
| Checklist de aceptación visual — Detalle histórico de fijos (`fixed-evolution`) | `design/historico-fijos.md` |
| Toggle Barra ↔ Línea en la card `by-category` (Gastos por categoría) | `design/graficos.md` |
| `income-expense` (Ingresos vs Gastos) — sin tabs, Total-only | `design/graficos.md` |
| Filtros de tipo, dirección y categoría en `income-expense` (Ingresos vs Gastos) — RF-REP-014 | `design/graficos.md` |
| Leyenda interactiva (la leyenda es el filtro) | `design/graficos.md` |
| Filtro de categorías embebido (checklist en popover) | `design/graficos.md` |
| Filtros por listado en `/mes` — controles de sección | `design/mes-listado.md` |
| Control de orden de la sección Únicos (toggle monto ↔ fecha) | `design/mes-listado.md` |
| Sublínea del ítem de `/mes` — dos zonas (identidad · estados) | `design/mes-listado.md` |
| Ítem anulado (`skipped`) y acciones del KebabMenu | `design/mes-listado.md` |
| Duplicar movimiento — acción del kebab y modo "duplicar" del modal | `design/mes-listado.md` |
| Frecuencia del fijo — entero 1..12 y sus etiquetas | `design/fijos-frecuencia.md` |
| Selector de frecuencia del form de fijo | `design/fijos-frecuencia.md` |
| Arranque y vigencia del fijo — en la card de detalle | `design/fijos-frecuencia.md` |
| Card de detalle de movimiento (`/mes`) — apertura, contenido read-only y fila adelgazada | `design/card-detalle.md` |
| Total del plan de cuotas — las tres superficies | `design/form-movimiento.md` |
| Form de movimiento calculado | `design/form-movimiento.md` |
| Mes del monto base del calculado (desfasaje 0..12) — las tres superficies | `design/form-movimiento.md` |
| Multi-moneda — cromo neutro de moneda y cotización | `design/moneda.md` |
| Indicador de moneda default a nivel app | `design/moneda.md` |
| Símbolos de moneda por código | `design/moneda.md` |
| Monedas configurables — set curado ARS/USD/EUR/BRL | `design/moneda.md` |
| Selector de salto de mes/año en `/mes` (popover "rueda") | `design/navegacion-periodo.md` |
| Botón "Mes en curso" — recentrado temporal en el header de `/mes` | `design/navegacion-periodo.md` |
| Skeletons — sistema unificado de estados de carga | `design/skeletons.md` |
| Marca visual pasiva de límites (antes: "… (Límites y Alertas — P2)") | `design/limites.md` |
| Restricción rectora — cero impacto con config vacía | `design/limites.md` |
| Tono y severidad — una sola familia: **ámbar `--warning`** | `design/limites.md` |
| Vocabulario de efectos (primitivas) | `design/limites.md` |
| Mapeo efecto ↔ tipo de anclaje | `design/limites.md` |
| Colisión de marcas — un dato, varios límites | `design/limites.md` |
| Accesibilidad — nunca solo color | `design/limites.md` |
| Cumplimiento de reglas duras | `design/limites.md` (también en `design/mes-listado.md`, sublínea) |
| Panel de gestión de límites (antes: "… (Configuración — P2)") | `design/limites.md` |
| 1. Control de navegación — `/configuracion` es el hub de administración con navegación vertical de secciones | `design/limites.md` |
| 2. Solapa Límites — encabezado y lista | `design/limites.md` |
| 3. Flujo de crear — modal con formulario progresivo | `design/limites.md` |
| 4. Efecto — subset por anclaje, default y preview | `design/limites.md` |
| 5. Coherencia — moldes reusados (resumen) | `design/limites.md` |
| Aviso de alerta activa de límites (antes: "… (Límites y Alertas — P2, fase 2)") | `design/limites.md` |
| Restricción rectora — cero fricción sin límites activos cruzados | `design/limites.md` |
| Forma y ubicación — diálogo de confirmación apilado, en registro ámbar | `design/limites.md` |
| Tono — ámbar `--warning`, aviso NO destructivo | `design/limites.md` |
| Contenido y enumeración de cruces | `design/limites.md` |
| Jerarquía de botones y copy | `design/limites.md` |
| Accesibilidad | `design/limites.md` |
| Coherencia — moldes reusados | `design/limites.md` |
| Popover informativo de límites por superficie (antes: "… (Límites y Alertas — P2)") | `design/limites.md` |
| 1. El ícono disparador | `design/limites.md` |
| 2. Ubicación del ícono por superficie | `design/limites.md` |
| 3. Anatomía del popover | `design/limites.md` |
| 4. Disparo, cierre y accesibilidad | `design/limites.md` |
| 5. Comportamiento en pantalla chica — los cuatro invariantes (antes: "5. Comportamiento en pantalla chica (contención, política P0-a) — los cuatro invariantes") | `design/limites.md` |
| 6. Cumplimiento de reglas duras | `design/limites.md` |
| 7. Checklist de aceptación visual | `design/limites.md` |
| Sección "Datos externos" de `/configuracion` — ver y actualizar inflación (IPC) + cotizaciones | `design/datos-externos.md` |
| 0. Ubicación estructural — bloque dentro de General | `design/datos-externos.md` |
| 1. Cabecera de sección (nivel 2 del hub) + botón "Actualizar datos" | `design/datos-externos.md` |
| 2. Card "Inflación (IPC)" | `design/datos-externos.md` |
| 3. Card "Cotizaciones" | `design/datos-externos.md` |
| 4. Feedback de resultado — por TOAST | `design/datos-externos.md` |
| 5. Estados de la sección entera | `design/datos-externos.md` |
| 6. Pie discreto — última actualización + fuentes | `design/datos-externos.md` |
| 7. Contención responsive (obligatoria) | `design/datos-externos.md` |
| 8. Reglas duras reafirmadas | `design/datos-externos.md` |
| Checklist de aceptación visual — Datos externos | `design/datos-externos.md` |
| Historial de cambios (`/historial`) — lista de entradas, deshacer y bloqueo LIFO | `design/historial.md` |
| 1. Encuadre de pantalla | `design/historial.md` |
| 2. Anatomía de la entrada (régimen amplio) | `design/historial.md` |
| 3. Bloque "Qué cambió" — el par antes → después | `design/historial.md` |
| 4. Estados de la entrada | `design/historial.md` |
| 5. La acción Deshacer y su confirmación | `design/historial.md` |
| 6. Modal de entrada bloqueada — desbloqueo en cadena | `design/historial.md` |
| 7. Vacío, carga y error | `design/historial.md` |
| 8. Ítem del sidebar | `design/historial.md` |
| 9. Contención responsive (obligatoria) | `design/historial.md` |
| 10. Agregados más allá del brief — estado | `design/historial.md` |
| 11. Reglas duras reafirmadas | `design/historial.md` |
| Checklist de aceptación visual — Historial de cambios | `design/historial.md` |
| Simulación de categoría (`/mes`) — fila simulada, disparador y ciclo de vida | `design/simulacion-categoria.md` |
| 0. Encuadre y cero-impacto | `design/simulacion-categoria.md` |
| 1. Fila del movimiento simulado | `design/simulacion-categoria.md` |
| 2. Banda "Simulación" en el popover de filtro de Únicos | `design/simulacion-categoria.md` |
| 3. Modal "Simular categoría" — selector MÚLTIPLE, solo categorías simulables | `design/simulacion-categoria.md` |
| 4. Lista de simulaciones activas y eliminar | `design/simulacion-categoria.md` |
| 4.1 Extender el tramo de una simulación — disparador condicional, revelado en el lugar | `design/simulacion-categoria.md` |
| 5. Composición del subtotal y de los totales — se señala, sin tocar las cifras | `design/simulacion-categoria.md` |
| 6. Simulación pausada por falta de datos — el silencio se rompe en dos lugares | `design/simulacion-categoria.md` |
| 7. Meses fuera del horizonte — sin señal (decisión) | `design/simulacion-categoria.md` |
| 8. Contención responsive (obligatoria) | `design/simulacion-categoria.md` |
| 9. Agregados más allá del brief — estado | `design/simulacion-categoria.md` |
| 10. Reglas duras reafirmadas | `design/simulacion-categoria.md` |
| Checklist de aceptación visual — Simulación de categoría | `design/simulacion-categoria.md` |
| Toast con acción — Deshacer inmediato tras editar o eliminar | `design/toast-deshacer.md` |
| 1. Anatomía — la acción va INLINE, no debajo del mensaje | `design/toast-deshacer.md` |
| 2. Copy | `design/toast-deshacer.md` |
| 3. Duración y pausa | `design/toast-deshacer.md` |
| 4. Ciclo de vida de la acción | `design/toast-deshacer.md` |
| 5. Apilado e identidad | `design/toast-deshacer.md` |
| 6. Contención responsive (obligatoria) | `design/toast-deshacer.md` |
| 7. Agregados más allá del brief — estado | `design/toast-deshacer.md` |
| 8. Reglas duras reafirmadas | `design/toast-deshacer.md` |
| Checklist de aceptación visual — Toast con Deshacer | `design/toast-deshacer.md` |
| Modal de alcance de la anulación de un fijo (`/mes`) — RF-MF-005 | `design/anulacion-fijo.md` |
| 0. Encuadre — qué cambia y qué no | `design/anulacion-fijo.md` (y `design/reabrir-fijo.md`) |
| 1. Contenedor, título y verbo | `design/anulacion-fijo.md` |
| 2. Cuerpo — orden y anatomía | `design/anulacion-fijo.md` |
| 3. Estados del rango | `design/anulacion-fijo.md` |
| 4. El camino barato — cómo se paga el segundo clic | `design/anulacion-fijo.md` |
| 5. Footer, carga, éxito y error | `design/anulacion-fijo.md` (y `design/reabrir-fijo.md`) |
| 6. Contención responsive (obligatoria) | `design/anulacion-fijo.md` (y `design/reabrir-fijo.md`) |
| 7. Agregados más allá del brief — estado | `design/anulacion-fijo.md` |
| 8. Reglas duras reafirmadas | `design/anulacion-fijo.md` |
| Checklist de aceptación visual — Modal de alcance de la anulación | `design/anulacion-fijo.md` |
| Reabrir un fijo terminado (`/mes` + `/historial`) — RF-MF-008 | `design/reabrir-fijo.md` |
| 1. La acción "Reabrir" en el KebabMenu | `design/reabrir-fijo.md` |
| 2. Contenedor, título, foco y cierre | `design/reabrir-fijo.md` |
| 3. Cuerpo — orden y anatomía | `design/reabrir-fijo.md` |
| 4. Estado "con reemplazos obligatorios" | `design/reabrir-fijo.md` |
| 7. `/historial` — la entrada "Reabierto" | `design/reabrir-fijo.md` |
| 8. Agregados más allá del brief — estado | `design/reabrir-fijo.md` |
| 9. Reglas duras reafirmadas | `design/reabrir-fijo.md` |
| Checklist de aceptación visual — Reabrir un fijo terminado | `design/reabrir-fijo.md` |
| Movimientos simulados en cards de reporte (`/reportes`) — RF-REP-017 | `design/simulados-en-cards.md` |
| 0. Encuadre — una sola idea, tres geometrías | `design/simulados-en-cards.md` |
| 1. El toggle — chip "Simulados" en el cluster de cómputo | `design/simulados-en-cards.md` |
| 2. La capa simulada dentro del gráfico | `design/simulados-en-cards.md` |
| 3. Convivencia con las marcas pasivas de límite | `design/simulados-en-cards.md` |
| 4. Contención responsive (obligatoria) (antes: "… (obligatoria — política P0-a)") | `design/simulados-en-cards.md` |
| 5. Agregados más allá del brief — estado | `design/simulados-en-cards.md` |
| 6. Reglas duras reafirmadas | `design/simulados-en-cards.md` |
| Checklist de aceptación visual — Movimientos simulados en cards de reporte | `design/simulados-en-cards.md` |
| Marcas de límite en `by-category` — el cartucho de mes (antes: "… (P2)") | `design/limites-by-category.md` |
| 1. Qué se corrige y con qué criterio | `design/limites-by-category.md` |
| 2. El portador — **cartucho de mes** en el carril del eje X | `design/limites-by-category.md` |
| 3. La banda de categoría — subset restringido a `ring`, con rescate | `design/limites-by-category.md` |
| 4. Un cartucho por mes — fusión y desempate | `design/limites-by-category.md` |
| 5. Ortogonalidad con RF-REP-017 (simulados) | `design/limites-by-category.md` |
| 6. Accesibilidad | `design/limites-by-category.md` |
| 7. Contención responsive (obligatoria) (antes: "… (obligatoria — política P0-a)") | `design/limites-by-category.md` |
| 8. Alcance — qué cubre esta spec y qué se verificó que no aplica | `design/limites-by-category.md` |
| 9. Agregados más allá del brief — estado | `design/limites-by-category.md` |
| 10. Reglas duras reafirmadas | `design/limites-by-category.md` |
| Checklist de aceptación visual — Marcas de límite en `by-category` | `design/limites-by-category.md` |
| Gate de arranque del backend — pantalla de espera a pantalla completa | `design/gate-arranque.md` |
| 0. Encuadre — qué es y qué no | `design/gate-arranque.md` |
| 1. Fondo negro fijo — excepción declarada a la regla dura 4 | `design/gate-arranque.md` |
| 2. Estado `despertando` — composición | `design/gate-arranque.md` |
| 3. Entrada y salida — nunca un corte ni un flash | `design/gate-arranque.md` |
| 4. Estado `error` (a los 3 minutos) | `design/gate-arranque.md` |
| 5. Régimen de captura y contención responsive (obligatoria) | `design/gate-arranque.md` |
| 6. Reglas duras reafirmadas | `design/gate-arranque.md` |
| Checklist de aceptación visual — Gate de arranque | `design/gate-arranque.md` |
