# Handoff: Control — App de finanzas personales

## Overview
**Control** es una app web (desktop-first) para registrar gastos e ingresos del mes y ver el balance real de un vistazo. El alcance de este handoff cubre el flujo completo de 5 vistas: **Login, Dashboard, Vista del mes, Modal de carga de movimiento y Categorías.**

El idioma de la UI es **español (es-AR)**. Formato de moneda argentino: separador de miles `.` y decimales `,` → `$ 219.400,00`.

---

## Sobre los archivos de diseño
Los archivos de este bundle son **referencias de diseño hechas en HTML/CSS/JS** — prototipos que muestran el look final y el comportamiento esperado. **No son código de producción para copiar tal cual.**

La tarea es **recrear estos diseños dentro del entorno/codebase existente** (React, Vue, Svelte, etc.) usando sus patrones, componentes y librerías establecidos. Si todavía no hay un entorno, elegir el framework más apropiado (sugerencia: React + CSS Modules o Tailwind con tokens mapeados) e implementarlos ahí.

- `Control — Hi-Fi.html` — markup de las 5 pantallas + ambos modales.
- `control.css` — sistema de diseño completo (tokens, componentes, temas claro/oscuro).
- `app.js` — interacciones (navegación, modales, toggles, toast, tweaks).
- `reference/Wireframes Control.html` — wireframes lo-fi originales con las 3 variantes por pantalla y la variante elegida marcada (contexto de por qué cada layout).

## Fidelidad
**Alta fidelidad (hi-fi).** Colores, tipografía, espaciado e interacciones son finales. Recrear la UI con fidelidad de píxel usando las librerías del codebase. Los **números y copy de marca son placeholders** (datos demo) — reemplazar por datos reales / tono definitivo.

---

## Design Tokens

> Definidos en `control.css` con `oklch()`. Abajo van también aproximaciones hex para referencia rápida; **preferir los valores oklch** (más fieles y permiten el cambio de acento por hue).

### Color — acento de marca (Índigo, default)
El acento se controla por una sola variable de tono: `--accent-h: 264`. Cambiar el hue regenera toda la familia. Hues ofrecidos: **Índigo 264**, Azul 250, Violeta 295, Teal 205.

| Token | Light | Dark | Aprox hex (light) |
|---|---|---|---|
| `--accent` | `oklch(0.52 0.17 264)` | `oklch(0.64 0.16 264)` | `#4f46d6` |
| `--accent-press` | `oklch(0.45 0.17 264)` | `oklch(0.58 0.16 264)` | `#4338b8` |
| `--accent-soft` (fondo) | `oklch(0.95 0.035 264)` | `oklch(0.30 0.07 264)` | `#eceaf9` |
| `--accent-ink` (texto) | `oklch(0.40 0.16 264)` | `oklch(0.80 0.10 264)` | `#3a2fa0` |

### Color — semántico (NO cambia con el acento)
Verde = ingreso, Rojo = gasto. **Reservados estrictamente** para ese significado.

| Token | Light | Dark | Aprox hex |
|---|---|---|---|
| `--income` | `oklch(0.58 0.12 158)` | `oklch(0.66 0.12 158)` | `#1f8a5b` |
| `--income-soft` | `oklch(0.95 0.04 158)` | `oklch(0.30 0.05 158)` | `#e3f4ea` |
| `--income-ink` | `oklch(0.45 0.11 158)` | `oklch(0.78 0.11 158)` | `#1c6e49` |
| `--expense` | `oklch(0.57 0.16 27)` | `oklch(0.64 0.15 27)` | `#c64637` |
| `--expense-soft` | `oklch(0.95 0.035 27)` | `oklch(0.31 0.06 27)` | `#f7e6e3` |
| `--expense-ink` | `oklch(0.47 0.15 27)` | `oklch(0.78 0.13 27)` | `#a23a2d` |

### Color — neutros (Light → Dark)
| Token | Light | Dark | Uso |
|---|---|---|---|
| `--paper` | `oklch(0.965 0.004 270)` | `oklch(0.17 0.008 270)` | fondo de app |
| `--panel` | `#ffffff` | `oklch(0.215 0.009 270)` | tarjetas/superficies |
| `--panel-2` | `oklch(0.975 0.004 270)` | `oklch(0.24 0.010 270)` | hover sutil |
| `--panel-3` | `oklch(0.955 0.005 270)` | `oklch(0.27 0.011 270)` | chips/fills |
| `--ink` | `oklch(0.22 0.012 270)` | `oklch(0.94 0.006 270)` | texto principal |
| `--ink-2` | `oklch(0.40 0.012 270)` | `oklch(0.82 0.008 270)` | texto secundario |
| `--muted` | `oklch(0.55 0.012 270)` | `oklch(0.66 0.012 270)` | texto terciario |
| `--faint` | `oklch(0.70 0.010 270)` | `oklch(0.50 0.012 270)` | placeholders |
| `--hair` | `ink / 0.10` | `white / 0.08` | divisores internos |
| `--line` | `ink / 0.17` | `white / 0.13` | bordes de tarjeta |
| `--line-strong` | `ink / 0.28` | `white / 0.22` | bordes de input |

### Sombras
- `--shadow-sm`: `0 1px 2px rgb(.../0.06), 0 1px 3px rgb(.../0.05)` — tarjetas, botones.
- `--shadow-md`: `0 4px 16px (.../0.08), 0 2px 6px (.../0.05)` — hover, balance hero.
- `--shadow-lg`: `0 18px 50px (.../0.18), 0 6px 18px (.../0.10)` — modales, toast, panel.

### Tipografía
- **UI / títulos:** `"Space Grotesk"`, pesos 400/500/600/700.
- **Cifras / fechas / montos:** `"IBM Plex Mono"`, pesos 400/500/600, con `font-feature-settings: "tnum" 1` (cifras tabulares) y `letter-spacing: -.01em`. **Toda cantidad de dinero va en mono.**
- Base body: 15px / line-height 1.45.

Escala de texto observada:
| Rol | Size | Weight | Tracking |
|---|---|---|---|
| H1 página (`Junio 2026`) | 32px | 700 | -.02em |
| Balance hero (cifra) | 46px | 600 | -.025em |
| Stat valor | 30px | 600 | -.02em |
| Título de diálogo | 18px | 700 | -.01em |
| Nombre de movimiento | 14.5px | 600 | -.01em |
| Monto en fila | 15.5px | 600 | — |
| Eyebrow / labels | 12px | 600 | .1em, uppercase |
| Group header (Únicos…) | 13px | 700 | .1em, uppercase |
| Meta / subtítulos | 12.5px | 500 | — |

### Espaciado
Escala usada: 4, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 40 px.
Variables de densidad (tweakables): `--row-pad` (fila lista), `--card-pad` (interior tarjeta), `--gap` (separación de grid). Presets: **Compacto** (10/16/13), **Medio/default** (14/22/18), **Amplio** (18/28/24).

### Geometría (radios) — tweakable
| Token | Definido | Medio/default | Suave |
|---|---|---|---|
| `--r-card` | 6px | 14px | 20px |
| `--r-ctl` (botones/inputs) | 6px | 10px | 13px |
| `--r-chip` | 4px | 7px | 9px |
| `--r-pill` | 999px (fijo) | | |
Diálogos usan radio fijo 18px; logo gem 10px; avatar 50%.

---

## Pantallas / Vistas

### 1. Login  (`/login`)
- **Propósito:** único punto de entrada sin sesión. Acceso solo con Google.
- **Layout:** grid 2 columnas `1.05fr 1fr`, alto = viewport. Izquierda = panel de marca; derecha = acceso. En ≤940px colapsa a 1 columna (marca arriba, min-height 280px).
- **Panel de marca (izq):** fondo gradiente diagonal del acento (`135–150°`, de `--accent-press` a `--accent` a un hue +30). Textura de grilla sutil (líneas a `white/0.07`, celdas 44px, con máscara radial de fade) + un glow radial inferior-derecho. Contenido en `space-between`: arriba logo (gem blanco 44px radio 13px con "C" en `--accent-ink` + wordmark "Control" 22px/700 blanco); centro hero (`h2` 42px/700 tracking -.03em "Tus finanzas del mes, sin sorpresas." + `p` 16px a `white/0.82`); abajo línea con ícono escudo "Privado · solo vos ves tus números." a `white/0.7`.
- **Panel de acceso (der):** fondo `--paper`. Tarjeta centrada max-width 360px: eyebrow "Bienvenido"; `h3` 28px/700 "Ingresá a Control"; sub 14.5px muted; **botón Google** ancho completo (ver componente `gbtn`); fine-print 12.5px con links subrayados (Términos / Política);
- **Interacción:** click en el botón Google → navega a Dashboard.

### 2. Dashboard  (`/`)
- **Propósito:** panorama del mes en curso. Sin lista de movimientos (eso vive en Vista del mes).
- **Layout:** frame de app = grid `248px 1fr` (sidebar + contenido). Contenido: padding 34px 40px, max-width 1120px.
- **Header (`.phead`):** izq eyebrow "Tu mes" + `h1` "Junio **2026**" (el año en `--accent-ink`). Der: botón primario grande "+ Nuevo movimiento".
- **Fila de stats:** grid `1fr 1fr`, gap `--gap`. Dos tarjetas:
  - **Gastos** — ícono cuadrado `--expense-soft`/`--expense-ink` con flecha abajo; valor mono 30px `$ 219.400,00` (decimales en `.cents` 18px muted); meta "8 movimientos · 2 fijos".
  - **Ingresos** — ícono `--income-soft`/`--income-ink` flecha arriba; valor mono 30px en `--income-ink` `$ 365.000,00`; meta "2 movimientos · sueldo + freelance".
- **Balance hero:** tarjeta full-width, fondo gradiente del acento, texto blanco. Label "Balance de junio"; cifra mono 46px `+ $ 145.600,00`; **barra de proporción** (alto 7px, pill) ingreso vs gasto (verde claro / rojo claro, anchos 62.5% / 37.5%); debajo, fila de leyenda "Ingresos $ 365.000" / "Gastos $ 219.400". Detalles decorativos: dos círculos (uno relleno `white/0.08`, otro solo borde) en pseudo-elementos.
- **Footer de sección:** texto muted "8 gastos y 2 ingresos registrados este mes" + link "Ver todos los movimientos →" que navega a Vista del mes.

### 3. Vista del mes  (`/mes`)
- **Propósito:** lista completa del mes activo, agrupada en **Únicos · Fijos · Cuotas**. Navegación entre meses.
- **Header:** izq = **stepper de mes** (pill con `‹` / label "Junio 2026" + sub "Mes en curso" / `›`). Der: botón "+ Nuevo movimiento".
- **Totales:** grid `1fr 1fr 1.1fr`: tarjeta Gastos, tarjeta Ingresos, y mini-balance (versión chica del hero, cifra 28px). Versión compacta de los stats (padding 16px 18px, valor 23px).
- **Grupos:** cada uno con `.ghead` = título uppercase (Únicos/Fijos/Cuotas) + contador pill + regla horizontal flexible + subtotal del grupo en mono. Debajo, una `.list` (tarjeta con bordes redondeados, filas divididas por hairline).
- **Fila de movimiento (`.mov`):** grid `40px 1fr auto auto`:
  1. Ícono 40px radio 11px — tintado por tipo (`is-gasto` rojo soft / `is-ingreso` verde soft) con flecha abajo/arriba.
  2. Texto: nombre 14.5px/600 + sub-línea (categoría · tipo · si es fijo, ícono repetir + "mensual").
  3. Fecha en mono (`02 Jun`); en cuotas, debajo `cuota 3/12` en mono pequeño.
  4. Monto mono 15.5px (gastos con `−$`, ingresos con `+$` en `--income-ink`).
- **Datos demo:** Únicos (4): Supermercado −24.300, Carga de nafta −12.500, Proyecto freelance +45.000, Regalo cumpleaños −15.000. Fijos (4): Sueldo +320.000, Alquiler −120.000, Internet −18.500, Gimnasio −15.000. Cuotas (2): Notebook 3/12 −9.900, Heladera 5/18 −14.200.
- **Regla:** las secciones vacías no se muestran.

### 4. Modal de carga de movimiento  (overlay)
- **Propósito:** crear (o editar) un movimiento.
- **Estructura:** scrim fijo (`ink/0.46` + `backdrop-filter: blur(3px)`), diálogo centrado max-width 440px, radio 18px, `--shadow-lg`.
- **Header:** título "Nuevo movimiento" + botón cerrar (X).
- **Tabs de tipo (`.dtabs`):** segmented "Único · Fijo · Cuotas" sobre fondo `--panel-3`, pill activo blanco con sombra. **Solo en creación.**
- **Toggle Gasto/Ingreso (`.gi`):** dos botones 50/50. Activo Gasto → borde+texto `--expense`, fondo `--expense-soft`; activo Ingreso → equivalente verde.
- **Campos (cambian según el tab):**
  - **Monto** (siempre) — input grande mono 20px con prefijo "$". En Cuotas el label cambia a **"Monto por cuota"**.
  - **Cantidad de cuotas + Mes de inicio** — grid 2-col, **solo en Cuotas**.
  - **Categoría** (siempre) — select "Elegir categoría ▾".
  - **Fecha** (select con ícono calendario) — **solo en Único**.
  - **Nota de recurrencia** (ícono repetir, "Se registra automáticamente cada mes…") — **solo en Fijo**.
  - **Descripción** (siempre, opcional).
- **Footer:** der "Cancelar" (ghost) + "Guardar" (primario con check).
- **Al guardar:** cierra el modal y muestra **toast** "Movimiento guardado" con acción "Ir a ver" → Vista del mes.
- **Modo edición (de los wireframes, aún no implementado):** abre directamente en el tipo del movimiento, **sin tabs**, título "Editar · {tipo}". Si no hay categorías para el tipo elegido, mostrar bloque de advertencia con CTA a `/categorias`.

### 5. Categorías  (`/categorias`)
- **Propósito:** administrar categorías (nombre + alcance).
- **Header:** eyebrow "Configuración" + `h1` "Categorías"; der botón "+ Nueva categoría". Bajada: "8 categorías activas. El **alcance** define en qué tipo de movimiento aparece cada una al cargar."
- **Lista (`.cat-list`):** tarjeta con filas. Cada fila (`.catrow`) = grid `16px 1fr auto auto auto`: swatch de color 14px radio 5px · nombre 15px/600 · contador "N movimientos" muted · **badge de alcance** · acciones (editar / borrar) que aparecen en hover (`opacity 0→1`).
- **Badge de alcance (`.scope`):** chip con punto + texto. `gasto` (rojo soft), `ingreso` (verde soft), `ambos` (acento soft).
- **Datos demo:** Supermercado·Gasto, Sueldo·Ingreso, Alquiler·Gasto, Transporte·Gasto, Freelance·Ingreso, Varios·Ambos, Servicios·Gasto, Ocio·Gasto.
- **Modal Nueva categoría:** max-width 380px. Campos: Nombre; **Alcance** = picker de 3 (`.scopepick`: Ambos / Gasto / Ingreso, activo en acento) con nota explicativa. Footer Cancelar / Guardar. Al guardar → toast "Categoría creada".
- **Borrado:** soft delete con confirmación (los wireframes lo prevén; no implementado en el prototipo).

---

## Componentes reutilizables

| Clase | Descripción |
|---|---|
| `.btn` / `.btn.ghost` / `.btn.sm` / `.btn.lg` | Botón primario (acento) y secundario (panel + borde). Hover: `translateY(-1px)` + sombra. Inset highlight `white/0.2` arriba. |
| `.gbtn` | Botón "Continuar con Google": panel, borde fuerte, gmark cuadrado placeholder con "G". **No usar el logo oficial de Google** — placeholder neutro; en producción usar el botón/marca oficial según las guías de Google Sign-In. |
| `.card` / `.stat` | Superficie base + variante de métrica con ícono `.ki`. |
| `.balance` | Tarjeta hero de gradiente con barra de proporción. |
| `.mov` | Fila de movimiento (grid 4-col). Variantes `is-gasto` / `is-ingreso`. |
| `.scope` | Badge de alcance/tipo. Variantes gasto/ingreso/ambos/cuota. |
| `.nav` | Item de sidebar; estado `.on` = fondo `--accent-soft`, texto `--accent-ink`. |
| `.stepper` | Navegador de mes (pill). |
| `.input` / `.input.amount` / `.input.select` | Campos; focus = borde acento + ring `--accent-soft` 3px. |
| `.dtabs`, `.gi`, `.scopepick` | Segmented controls del modal. |
| `.toast` | Notificación inferior-centro, auto-dismiss 3.8s, con acción opcional. |

### Iconografía
Set propio de íconos line (stroke `currentColor`, ~1.8px, 24px viewBox) en un sprite SVG `<symbol>`: dash, month (calendario), tags, plus, arrow, up, down, chevrons (L/R/D), check, edit, trash, lock, shield, info, warn, x, cal, repeat. En el codebase, mapear a la librería de íconos existente (Lucide/Phosphor/Heroicons) — los nombres coinciden bastante con Lucide. **Ingreso = flecha arriba, Gasto = flecha abajo, Recurrente = ícono repeat.**

---

## Interacciones y comportamiento
- **Navegación entre pantallas:** sidebar + tabs de la barra superior (esta última es chrome del *prototipo*, no parte del producto — en la app real la navegación es la sidebar + rutas). Rutas sugeridas: `/login`, `/` (dashboard), `/mes`, `/categorias`. Modales como overlay (no ruta, o ruta-modal según convención del codebase).
- **Modal:** abre desde cualquier "+ Nuevo movimiento". Cierra con X, Cancelar, click en scrim, o `Esc`. Cambiar de tab reordena los campos (ver pantalla 4).
- **Toggle Gasto/Ingreso:** exclusivo; cambia el color del control.
- **Stepper de mes:** `‹`/`›` cambian mes/año; el label muestra "Mes en curso" para junio 2026 o "Histórico" para el resto. (En el prototipo los totales/listas son estáticos; en producción se recalculan por mes.)
- **Hover de acciones:** los íconos editar/borrar de Categorías aparecen al hover de la fila.
- **Toast:** aparece al guardar; "Ir a ver" navega y lo descarta.
- **Animaciones:** entrada de pantalla fade+translateY 4px (.32s); modal `pop` (scale .98→1, .22s, `cubic-bezier(.2,.9,.3,1.1)`); toast slide-up (.3s). Transiciones de hover .14s. Respetar `prefers-reduced-motion`.
- **Responsive:** desktop-first. En ≤940px se oculta la sidebar (hay que prever nav mobile) y el login pasa a 1 columna. El target principal acordado es **desktop web**.

## State management (sugerido)
- `session` / `user` (auth Google).
- `currentMonth` (mes/año activo) → deriva totales y listas.
- `movements[]`: `{ id, tipo: 'unico'|'fijo'|'cuotas', flujo: 'gasto'|'ingreso', monto, categoriaId, fecha?, descripcion?, cuotas?: { actual, total, mesInicio } }`.
- `categories[]`: `{ id, nombre, color, scope: 'ambos'|'gasto'|'ingreso', deletedAt? (soft delete) }`.
- Derivados por mes: `totalGastos`, `totalIngresos`, `balance`, agrupación Únicos/Fijos/Cuotas, subtotales por grupo.
- UI state: pantalla/ruta activa, modal abierto + modo (crear/editar) + tipo, toggle flujo, toasts.
- **Regla de negocio:** al cargar, el selector de categoría se filtra por el `scope` y el flujo elegido (una categoría `gasto` no aparece para ingresos). Si no hay categorías válidas → bloquear con CTA a Categorías.
- Preferencias persistidas (en el prototipo, `localStorage`): tema claro/oscuro, hue de acento, densidad, geometría, última pantalla.

## Assets
- **Fuentes:** Space Grotesk + IBM Plex Mono (Google Fonts). En producción, self-host o usar el pipeline de fuentes del codebase.
- **Íconos:** sprite SVG propio (ver Iconografía) — reemplazar por la librería del codebase.
- **Imágenes:** ninguna. El panel de marca es 100% CSS (gradiente + grilla). No hay logos de terceros salvo el placeholder de Google (reemplazar por el activo oficial).
- Sin dependencias JS externas; todo vanilla.

## Files
- `Control — Hi-Fi.html` — markup de las 5 vistas + 2 modales + sprite de íconos + panel de tweaks.
- `control.css` — design system completo (tokens, temas, todos los componentes).
- `app.js` — navegación, lógica de modales, toggles, toast, stepper, tweaks, persistencia.
- `reference/Wireframes Control.html` — wireframes lo-fi con las 3 variantes por pantalla (la elegida está marcada "✓ Elegida"); útil para entender alternativas descartadas.

---

### Notas finales
- Mantener **verde/rojo solo para ingreso/gasto**; el acento (índigo) es la única marca y NO debe usarse para montos.
- Las cifras siempre en mono tabular.
- Reemplazar copy de marca y datos demo por contenido real.
- El botón de Google debe seguir las guías oficiales de Google Sign-In en producción.
