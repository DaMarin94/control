---
name: qa-visual
description: Usar cuando una tarea con superficie visual/UI terminó de implementarse y el orquestador tiene que correr el QA visual per-feature contra la app andando (vía /chrome o hand-off a Claude para Chrome), o cuando se pide la regresión visual genérica (on-demand o al cerrar versión).
---

# QA visual

Valida lo que tests, build y e2e no cubren: pixel, layout, modales cortados o atrapantes, marcas mal puestas, datos inválidos que se guardan. Contra la app andando, en navegador de escritorio.

## Quién ejecuta
- **Principal:** el orquestador, contra el navegador conectado vía `/chrome` (herramientas `mcp__claude-in-chrome`): navega, interactúa, dispara casos borde, saca screenshots, reporta.
- **Fallback (hand-off):** navegador no conectado/disponible → armar el prompt per-feature y entregárselo al usuario para el chat de la extensión **Claude para Chrome**.
- `/chrome` no es persistente: se reconecta en cada sesión nueva. Sin conexión → fallback.
- El guion es el mismo en ambos modelos; cambia solo quién lo ejecuta.
- No es gate automático, pero los hallazgos se re-delegan y corrigen antes de cerrar la tarea.
- Tareas sin superficie visible (backend puro, refactor de lógica) no lo disparan.

## Datos y permisos (solo base local de desarrollo)
- **Sembrar** la data que el caso requiera (categorías, movimientos únicos/fijos/cuotas, calculados, límites, etc.) si la cuenta no la tiene. Es parte esperada del QA.
- La base local es **descartable**: crear, modificar y borrar libremente, sin pedir permiso y sin revertir.
- En **localhost**, usar la app y enviar formularios **sin pedir confirmación por acción** — crear, guardar, borrar, anular/des-anular, navegar. Pedir permiso por submit invalida el recorrido.
- **Anular no es borrar:** es un caso reversible más.
- **Autenticación:** el orquestador se autentica solo con **credenciales de prueba** del entorno de desarrollo (las del seed del proyecto, o las que el usuario pase para ese fin).
- **No:** credenciales personales del usuario en servicios de terceros; **Google OAuth** (proveedor externo, deja de ser localhost); borrar nada contra **producción**.

## Alcance
**Valida:**
- Roturas visuales de layout.
- Modales cortados o atrapantes (no cierran, pierden datos al cerrar).
- Opciones inalcanzables (menús fuera de pantalla, selects que tapan).
- Datos inválidos que se guardan.
- Estados vacíos rotos (NaN, undefined, empty feo).
- Crashes.
- **Contención responsive** — los cuatro invariantes de `docs/design.md` § Contención responsive, en **régimen de app** (piso `600px`), incluida la disposición compacta (`< --bp-wide`, 600–940px) además de la amplia:
  1. Sin scroll horizontal del `body` en todo ancho del régimen de app.
  2. Modales completos y scrolleables: ni cortados ni atrapantes.
  3. Ninguna acción inalcanzable (fuera de pantalla o tapada).
  4. Las superficies anchas scrollean dentro de sí mismas, sin romper el layout de la página.
- **Superficie de captura y su acceso** (régimen de captura, `min(ancho, alto) < 600px`, RF-APP-003/004): se recorren como cualquier otra superficie. Contrato visual en `docs/design.md` § Superficie de captura.

- Grueso del recorrido en escritorio normal; los cuatro invariantes se verifican **siempre**, también entre `600px` y `--bp-wide`. Por debajo de `600px` no se miden: ahí se verifica la superficie de captura.
- **El régimen del área autenticada se juzga contra el ancho de `<main>`, no del viewport.** El sidebar abierto resta ~248px → QA-ear la contención con sidebar **abierto Y cerrado**.

**Excluido:** accesibilidad (teclado, foco, contraste, legibilidad, info solo por color). Esfuerzo propio, fuera de los prompts.

## Método responsive
Redimensionar la ventana desde las herramientas **no es confiable** (reporta éxito y el viewport no cambia). Montar la app en un `<iframe>` del ancho objetivo dentro de una pestaña ya autenticada:
- Media queries y `100vw` responden al ancho del iframe.
- Mismo origen: se maneja el DOM (`contentDocument`) y se reusa la sesión.
- Varios anchos en una pasada, sin tocar la ventana del usuario.

**Trampas que invalidan el resultado:**
- **Las dos superficies de régimen están montadas a la vez**; el CSS oculta la que no corresponde. `querySelector` + `.click()` alcanza nodos ocultos → falsos hallazgos. Verificar que el nodo pertenece a la superficie visible (p. ej. `offsetParent !== null`).
- **El truncado se mide, no se mira:** `scrollHeight > clientHeight` sobre el elemento de texto.
- **Medir con `offsetWidth` / `offsetHeight`, no `getBoundingClientRect()`:** el `transform` residual de la animación de entrada (`scale(0.98)`) achica el rect (440px mide 431) → falso defecto. `offsetWidth` es inmune.
- **El borde del `<iframe>` resta ancho:** `width:600px` con borde deja el viewport < 600 y cae en captura. Compensar (sumar el borde al `width`, o `border:0`).
- **Los eventos sintéticos mienten:** `new MouseEvent('mouseenter')` no dispara el `onMouseEnter` de React → usar el cursor real para hover. Una `Response` armada a mano debe respetar el sobre real del cliente HTTP (`{ success, statusCode, error: { message } }`, ver `frontend/src/lib/api.ts`).

## Plantilla per-feature
Estructura fija, en este orden:
1. **Rol + objetivo** — QA visual adversarial; misma exclusión (a11y fuera); chequeo permanente de los cuatro invariantes desde `600px` hacia arriba, sidebar abierto Y cerrado. Si la feature tiene superficie en régimen de captura, recorrerla también.
2. **Contexto breve de la feature** — qué hace, en términos de UI.
3. **Invariantes críticos** (testear primero) — p. ej. "cero-impacto con config vacía".
4. **Recorrido superficie por superficie** de lo que la feature toca — qué mirar y qué esperar.
5. **Casos borde** de input y de estado propios de la feature.
6. **Modales/overlays nuevos** — cortado, cierre, apilado.
7. **Formato de reporte** (dónde / pasos / qué pasó / qué esperabas / severidad / screenshot). Sin paso de limpieza.

Contenido visual esperado (colores, posiciones, estados) → **"Checklist de aceptación visual"** del spec de `control-design` de la feature; reusarlo en los puntos 3 y 4.

## Cadencia
| Prompt | Cuándo |
|--------|--------|
| Per-feature | Siempre, al cierre de cada tarea con superficie visual/UI (skill `finalizar-tarea`). `/chrome` directo; hand-off como fallback. |
| Genérico de regresión | On-demand y al cerrar una versión. |

## Prompt genérico de regresión adversarial
Asset vivo: cuando una feature agrega una superficie nueva, se suma a la lista de superficies de este prompt, **en el mismo commit que el código**. Se pega tal cual.

---
Sos un QA senior con mentalidad adversarial. Tu objetivo NO es confirmar que la app anda: es ENCONTRAR maneras de romperla. La app se llama Control, un diario de gastos personal. Recorré todo, meté datos que no deberían entrar, forzá flujos raros, y documentá cada falla con screenshot y pasos para reproducir.

FUERA DE ALCANCE (ignoralo): accesibilidad (teclado, foco, contraste, legibilidad, info por color).

BORRADOS, DENTRO DEL GUION: los casos que borran datos (borrar una categoría o un método de pago en uso, eliminar movimientos, eliminar una simulación) están dentro del alcance y **los ejecutás vos, sin pedir confirmación**, igual que crear, editar y anular/des-anular. Estás sobre una base local de desarrollo: su data es descartable y no hay que revertir nada. Contra localhost **te autenticás vos** con las credenciales de prueba del entorno de desarrollo cuando el recorrido lo requiera; lo que NO hacés es usar credenciales personales del usuario en servicios de terceros ni entrar por **Google OAuth**.

DENTRO DE ALCANCE, SIEMPRE — contención responsive: además de probar en escritorio normal, achicá la ventana hasta 600px (el piso del régimen de app), pasando por la disposición compacta (600–940px), y verificá los cuatro invariantes. Ojo: el régimen compacto/amplio del área autenticada se mide contra el ancho de `<main>`, no del viewport — el sidebar abierto resta ~248px, así que probá con el sidebar abierto Y cerrado. Por debajo de 600px (o con menos de 600px de alto) no hay app: hay superficie de captura, que se recorre aparte (ver superficies).
1. El `body` no tiene scroll horizontal en ningún ancho ≥ 600px.
2. Los modales se ven completos y scrollean: ni cortados ni atrapantes.
3. Ninguna acción queda fuera de pantalla ni tapada.
4. Las superficies anchas (tablas, grillas, gráficos) scrollean dentro de sí mismas sin romper el layout de la página.

Enfocate en: datos inválidos que se guardan, roturas visuales de layout, modales cortados, opciones inalcanzables, estados rotos y crashes.

Superficies (recorrelas todas): Login (Google); /mes (movimientos por sección Únicos/Fijos/Cuotas, navegación de meses, menú de acciones editar/eliminar/anular por ítem); banda "Simulación" del popover de filtro de la sección Únicos (botón de alta, lista de simulaciones con su acción de eliminar y el tramo propio de cada una); modal selector de categoría a simular (solo categorías simulables, candidatas inelegibles ocultas —no deshabilitadas—, nota de elegibilidad al pie, los cuatro estados vacíos por causa); fila de movimiento simulado en un mes futuro (mezclada con los únicos reales, sin kebab ni card de detalle); alta/edición de movimiento (modal con tipos Único/Fijo/Cuota/Calculado; campos monto, descripción, categoría, fecha, y en "Más opciones" moneda+cotización y método de pago + débito automático); Dashboard; /reportes (crear/configurar 6 tipos de card, filtros por categoría, orden, año, refrescar); card "Detalle histórico de fijos" (incluye fijos de ingreso, marcados con punto cuadrado y ↑ en leyenda, tooltip y lista de excluidos; leyenda con un ítem por fijo como control de selección en lugar del filtro por categoría, con 20-30 ítems; modos Montos/Variación, que cambian la unidad del eje Y entre moneda y puntos porcentuales; chip "Ajustada por inflación" deshabilitado con motivo en Montos y activo en Variación; calculados como líneas punteadas propias; meses sin dato —frecuencia, anulado, fuera de vigencia— que no se grafican en cero y explican el motivo por tooltip; select de rango con 8 opciones —3/6/9 meses y 1 a 5 años— que estira el eje hacia atrás desde el mes en curso, sin graficar nunca meses futuros; lista de fijos sin evolución —los de menos de 2 apariciones en el rango, con su mes de inicio—); vista evolución de la card de detalle de /mes (acceso "Ver evolución" en fijos no calculados, grisado con tooltip si el fijo no tiene ≥2 meses con monto; la vista muestra solo el select de rango y "Volver al detalle" al pie; Esc vuelve al detalle, ✕ y scrim cierran la card); /historial (entradas de edición/eliminación, deshacer simple y en cadena); /configuracion (solapas General [moneda, tema] y Límites); Categorías (alta/edición/borrado, color, soft delete); Métodos de pago (alta/edición/borrado, tipo crédito/débito/efectivo, campos según tipo); superficie de captura (con el viewport por debajo de 600px en cualquiera de los dos ejes: tabs Único/Fijo/Cuotas, todos los campos incluido "Más opciones", aviso de límite, confirmación al guardar sin navegación, identidad de la sesión y cierre de sesión, y que nada más de la app sea alcanzable); acceso en régimen de captura (login sin registro, y que cruzar la frontera de 600px en los dos sentidos conmute de superficie sin recargar ni parpadear).

Mentalidad para romperla, por cada campo:
- Texto: vacío, solo espacios, 2000+ chars, emojis/unicode RTL, HTML/JS (`<script>`, `<img onerror>`) verificando que NO ejecute, comillas/backslashes/`{{7*7}}`/`'; DROP TABLE`/saltos de línea, espacios al borde, nombres duplicados, recrear con nombre de uno borrado (¿ofrece reactivar?).
- Numérico (monto, umbral, cotización, día del mes): 0, negativos, decimales largos, notación científica, números enormes (¿desborda?), letras/símbolos/pegar no-numérico, coma vs punto, vacío, cotización 0/negativa, día fuera de 1–31, cuotas 0/1/negativa/999.
- Fechas: inválidas, año 0001/9999, muy futuras/pasadas, 31 en meses de 30, febrero/bisiesto, fijo/cuota que cruza fin de año.
- Selects/menús: kebab cerca del borde (¿se corta/queda fuera?), selects largos (¿scrollean/tapan?), guardar sin elegir (¿validación?).

Modales y overlays (foco especial): ¿se ve completo o CORTADO?, contenido largo (¿crece/scrollea/rompe?), cerrar con X/Esc/backdrop (¿alguno cierra perdiendo datos sin avisar?), fondo bloqueado (no scrollea atrás), modal sobre modal (apilado/z-index/orden de cierre).

Flujos que rompen: doble/rápido submit (¿duplicados?), spam de clicks en acciones, guardar/navegar durante carga, borrar categoría/método EN USO (¿lo impide con mensaje?, ¿histórico consistente?), editar+cancelar (¿descarta y reabre con valores originales?), vaciar descripción al editar, anular/des-anular repetido (¿totales y reportes coherentes?), reporte con filtro que no matchea (¿empty prolijo?), reordenar drag y soltar raro, cambiar moneda por defecto (¿recalcula sin mezclar viejos?), cambiar tema claro/oscuro/sistema rápido (¿flashea?).

Estados vacíos y carga pesada: mes/usuario sin movimientos (¿empty prolijo o NaN/undefined?), mes con 30+ movimientos (¿aguanta?, ¿números desbordan?).

Sesión/navegación: F5 en medio de un flujo (modal abierto), botón atrás tras modales/cambio de mes, URL interna deslogueado (¿redirige a login?), sesión expirada (¿mensaje claro, no pantalla blanca?).

Reporte: por hallazgo (1) dónde, (2) pasos, (3) qué pasó, (4) qué esperabas, (5) severidad (rompe/feo/menor), (6) screenshot. Agrupá por severidad; priorizá datos inválidos guardados, modales cortados/atrapantes, opciones inalcanzables, crashes.
---
