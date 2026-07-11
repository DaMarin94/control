# QA visual

Validación que ni los tests, ni el build, ni el e2e cubren: pixel, layout, modales cortados o atrapantes, marcas mal puestas, datos inválidos que se guardan. Se corre contra la app andando, en un navegador de escritorio.

**Quién ejecuta:** el orquestador lo corre él mismo contra el navegador conectado vía `/chrome` (herramientas `mcp__claude-in-chrome`) — navega, interactúa, dispara casos borde, saca screenshots y reporta. Si el navegador no está conectado/disponible en la sesión, cae al **fallback**: arma el prompt per-feature y se lo entrega al usuario para que lo corra en el chat de la extensión **Claude para Chrome**. La conexión de `/chrome` no es persistente: se reconecta en cada sesión nueva. En ambos modelos el guion es el mismo — cambia solo quién lo ejecuta.

**Sembrado de datos de prueba:** el orquestador **siembra la data que el caso requiera** (categorías, movimientos únicos/fijos/cuotas, calculados, límites, etc.) cuando la cuenta conectada no tiene los casos necesarios para ejercitar la feature. Es **parte esperada** de correr el QA, no un paso extraordinario: sin los datos adecuados el recorrido no prueba nada.

**La base de datos local de desarrollo es descartable.** Sus datos no tienen valor. Al correr QA (o cualquier prueba), el orquestador **crea, modifica y elimina** libremente lo que necesite —categorías, movimientos, métodos de pago, calculados, etc.— **sin pedir permiso** y **sin obligación de revertir** la data de prueba. La data no se trata como preciosa. Esto aplica **solo a la base local de desarrollo**, no a datos de producción.

**Único límite (regla de seguridad):** el orquestador **no crea cuentas de usuario, no ingresa credenciales/contraseñas ni realiza el login** (incluido Google OAuth). Si una prueba requiere una sesión autenticada, la autenticación la resuelve el usuario; el resto —los datos— lo maneja el orquestador sin fricción.

Este doc es un **asset de trabajo vivo**: el prompt genérico de regresión y la plantilla per-feature se mantienen acá al día con las superficies del producto.

## Alcance y exclusiones

**Valida:**
- Roturas visuales de layout.
- Modales cortados o atrapantes (que no se cierran, que pierden datos al cerrar).
- Opciones inalcanzables (menús que se salen de pantalla, selects que tapan).
- Datos inválidos que se guardan.
- Estados vacíos rotos (NaN, undefined, empty feo).
- Crashes.
- **Contención responsive** — los cuatro invariantes de `docs/design.md` § Contención responsive, verificados entre el **ancho mínimo soportado (`640px`) y arriba** (incluyendo la disposición compacta, `< --bp-wide`, 640–940px, además del amplio). Por debajo de `640px` la app no promete contención (muestra el gate): fuera de alcance.
  1. Sin scroll horizontal del `body` en todo ancho `≥ 640px`.
  2. Modales completos y scrolleables: no cortados, no atrapantes.
  3. Ninguna acción inalcanzable (fuera de pantalla o tapada).
  4. Las superficies anchas scrollean dentro de sí mismas, no rompen el layout de la página.

El grueso del recorrido va en **escritorio normal**; los cuatro invariantes de contención se verifican **siempre**, también achicando la ventana entre `640px` y `--bp-wide` (disposición compacta). Por debajo de `640px` no se verifica: no es un ancho soportado.

> **El régimen responsive del área autenticada se juzga contra el ancho de `<main>`, no del viewport.** El sidebar abierto le resta ~248px al ancho disponible, así que la disposición compacta/amplia puede cambiar con el sidebar abierto o cerrado al mismo viewport. Hay que QA-ear la contención **con el sidebar abierto Y cerrado**.

**Exclusiones vigentes** — se atacan como esfuerzos propios y **no** se incluyen en los prompts por ahora:
- **Adaptación / rediseño mobile:** evaluar si la experiencia en pantalla chica es *buena* o *cómoda*. Lo único que se verifica en pantalla chica es que **no se rompe** (los cuatro invariantes de contención, arriba); adaptar o rediseñar para mobile queda fuera.
- **Accesibilidad**: uso por teclado, foco, contraste, legibilidad, información transmitida solo por color.

## Prompt genérico de regresión adversarial

Doc vivo: cuando una feature agrega una superficie nueva, se agrega a la lista de superficies de este prompt, **en el mismo commit que el código**. El bloque de abajo es el asset a mantener y se pega tal cual.

---
Sos un QA senior con mentalidad adversarial. Tu objetivo NO es confirmar que la app anda: es ENCONTRAR maneras de romperla. La app se llama Control, un diario de gastos personal. Recorré todo, meté datos que no deberían entrar, forzá flujos raros, y documentá cada falla con screenshot y pasos para reproducir.

FUERA DE ALCANCE (ignoralo): adaptación/rediseño mobile —si la experiencia en pantalla chica es *cómoda* o *buena* no es tu problema— y accesibilidad (teclado, foco, contraste, legibilidad, info por color).

DENTRO DE ALCANCE, SIEMPRE — contención responsive: además de probar en escritorio normal, achicá la ventana hasta 640px (el ancho mínimo soportado), pasando por la disposición compacta (640–940px), y verificá los cuatro invariantes. No bajes de 640px: por debajo de ese ancho la app muestra el gate y no promete contención. Ojo: el régimen compacto/amplio del área autenticada se mide contra el ancho de `<main>`, no del viewport — el sidebar abierto resta ~248px, así que probá con el sidebar abierto Y cerrado.
1. El `body` no tiene scroll horizontal en ningún ancho ≥ 640px.
2. Los modales se ven completos y scrollean: ni cortados ni atrapantes.
3. Ninguna acción queda fuera de pantalla ni tapada.
4. Las superficies anchas (tablas, grillas, gráficos) scrollean dentro de sí mismas sin romper el layout de la página.

Enfocate en: datos inválidos que se guardan, roturas visuales de layout, modales cortados, opciones inalcanzables, estados rotos y crashes.

Superficies (recorrelas todas): Login (Google); /mes (movimientos por sección Únicos/Fijos/Cuotas, navegación de meses, menú de acciones editar/eliminar/anular por ítem); alta/edición de movimiento (modal con tipos Único/Fijo/Cuota/Calculado; campos monto, descripción, categoría, fecha, y en "Más opciones" moneda+cotización y método de pago + débito automático); Dashboard; /reportes (crear/configurar 5 tipos de card, filtros por categoría, orden, año, refrescar); /configuracion (solapas General [moneda, tema] y Límites); Categorías (alta/edición/borrado, color, soft delete); Métodos de pago (alta/edición/borrado, tipo crédito/débito/efectivo, campos según tipo).

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

## Plantilla del prompt per-feature

Guion per-feature que el orquestador sigue al cierre de cada tarea con superficie visual — lo ejecuta él directo contra el navegador, o lo entrega como prompt al usuario en el fallback. Estructura fija, en este orden, para que salga consistente:

1. **Rol + objetivo** — QA visual adversarial, con las mismas exclusiones (adaptación/rediseño mobile y a11y fuera) y el mismo chequeo permanente de los cuatro invariantes de contención responsive entre el ancho mínimo soportado (`640px`) y arriba (sin bajar de `640px`), con el sidebar abierto Y cerrado.
2. **Contexto breve de la feature** — qué hace, en términos de UI.
3. **Invariantes críticos** (testear primero) — p. ej. "cero-impacto con config vacía": la app se ve igual si la feature no está activada.
4. **Recorrido superficie por superficie** de lo que la feature toca — con qué mirar y qué esperar en cada una.
5. **Casos borde** de input y de estado propios de la feature.
6. **Modales/overlays nuevos** — cortado, cierre, apilado.
7. **Formato de reporte** (dónde / pasos / qué pasó / qué esperabas / severidad / screenshot). No hay paso de limpieza: la data de prueba de la base local no se revierte (ver arriba).

El contenido visual esperado (colores, posiciones, estados) sale del **"Checklist de aceptación visual"** del spec de `control-design` de esa feature; el orquestador lo reusa para los puntos 3 y 4.

## Cadencia

| Prompt | Cuándo |
|--------|--------|
| Per-feature | **Siempre**, en el paso 5.5 del flujo del orquestador, al cierre de cada tarea con superficie visual/UI. Lo ejecuta el orquestador directo contra `/chrome`; hand-off al usuario como fallback. |
| Genérico de regresión | **On-demand** y al cerrar una versión. |
