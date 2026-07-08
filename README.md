# Control

Diario de gastos personal: registrá gastos e ingresos organizados por mes para ver en qué se te va el dinero. No es un sistema contable — su foco es la **previsibilidad**, no la conciliación ni los libros mayores.

## Stack

- **Frontend:** Next.js 15 (App Router) + Tailwind CSS v4
- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL
- **Auth:** Auth.js (NextAuth v5) — Google OAuth + email/contraseña

## Estructura del repo

```
control/
├── backend/    NestJS + Prisma — API y lógica de datos
├── frontend/   Next.js 15 — interfaz web
├── docs/       documentación del proyecto (requerimientos, arquitectura, etc.)
└── .claude/    agentes y workflow del proyecto
```

`backend/` y `frontend/` son **dos proyectos independientes**: cada uno tiene su propio `package.json` y se gestiona por separado con **pnpm**. No hay workspaces ni código compartido — el contrato entre ambos es la API HTTP.

## Puesta en marcha (desarrollo)

### Requisitos

- Node.js
- pnpm (v11)
- PostgreSQL

### Backend (puerto 3001)

```bash
cd backend
cp .env.example .env          # completá los valores
pnpm install
pnpm approve-builds --all     # pnpm 11: aprueba los builds nativos
pnpm start:dev
```

### Frontend (puerto 3000)

```bash
cd frontend
cp .env.example .env.local    # completá los valores
pnpm install
pnpm approve-builds --all     # pnpm 11: aprueba los builds nativos
pnpm dev
```

> En Windows, los scripts del backend apuntan directo al binario en `node_modules` en lugar de los shims de `.bin/` (los shims son scripts bash que Node no ejecuta en Windows). Es la convención del proyecto; ver `docs/technical.md`.

## TODO
P-1 - Mejorar el agente de diseño. Que objetivo cumple actualmente? Esta tomando muy malas decisiones.
P0 - R e s p o n s i v n e s s
P1 - gastos fijos: agregar la posibilidad de elegir cada cuantos meses se va a repetir desde un selector de numeros del 1 al 12, entonces si selecciono "1" significa "cada mes" si selecciono "2" significa cada 2 meses (bimestral). Y asi... En la pantalla de mes mantener la palabra. bi/tri/cuatri/etc + mestral. se entiende?
P2 - limites y alertas: Me gustaria que cada reporte, segun corresponda tenga un pequeño lugar donde pueda (con un hover o similar) listar que limites se encuentran activados ahi. No se puede editar ni nada por el estilo, es solo informativo.
P3 - limites y alertas. reporte Gastos diarios. El reporte tiene un rango que colorea los valores ingresados en el dia segun el monto. Esa caracteristica deberia poder ser editable desde los limites. donde se pueda elegir rango de color y los limites que lo colorean.

## Tests

Cada app guarda sus tests en una carpeta `tests/` separada de `src/` (`src/` solo contiene código; ver `docs/technical.md`).

- **Backend (Jest):**
  - `pnpm test` — tests unitarios (`tests/unit/`)
  - `pnpm test:e2e` — tests de endpoint con DB de test (`tests/e2e/`)
- **Frontend (Vitest + React Testing Library):**
  - `pnpm test` — modo watch
  - `pnpm test:run` — corrida única
  - `pnpm test:coverage` — con cobertura

## Documentación

| Documento | Qué contiene |
|---|---|
| [`docs/requirements.md`](docs/requirements.md) | Requerimientos funcionales (RF, RN, RNF) |
| [`docs/architecture.md`](docs/architecture.md) | Stack y decisiones estructurales del repo |
| [`docs/technical.md`](docs/technical.md) | Estándares técnicos transversales (logging, auth, testing, env, etc.) |
| [`docs/data-model.md`](docs/data-model.md) | Entidades y decisiones del modelo de datos |
| [`docs/screens.md`](docs/screens.md) | Definiciones funcionales de cada pantalla |


Tu objetivo : es ENCONTRAR maneras de romperla. Recorré todo,
meté datos que no deberían entrar, forzá flujos raros, y documentá cada falla con
screenshot y pasos para reproducir.

FUERA DE ALCANCE (ignoralo, se ataca en otra instancia):
- Responsive / cambio de tamaño de ventana / mobile. Testeá en escritorio normal.
- Accesibilidad: uso solo con teclado, foco, contraste, legibilidad, info por color.
  No lo evalúes ahora.

Enfocate en: datos inválidos que se guardan, roturas visuales de layout, modales
cortados, opciones inalcanzables, estados rotos y crashes.

## Superficies de la app (recorrelas todas)
- Login (Google).
- /mes: vista del mes con movimientos en secciones (Únicos, Fijos, Cuotas). Navegación
  entre meses. Cada movimiento tiene acciones (editar, eliminar, anular) en un menú.
- Alta/edición de movimiento: modal con tipos Único / Fijo / Cuota / Calculado. Campos:
  monto, descripción, categoría, fecha, y en "Más opciones" moneda + cotización y método
  de pago (+ débito automático si el método es débito).
- Dashboard.
- /reportes: crear/configurar cards (5 tipos), filtros por categoría, orden, año, refrescar.
- /configuracion: solapas General (moneda, tema) y Límites.
- Categorías: alta/edición/borrado, color,
- Métodos de pago: alta/edición/borrado, tipo (crédito/débito/efectivo), campos según tipo.

## MENTALIDAD: cómo intentar romperla
Para CADA campo de texto/número/fecha/select de TODA la app, probá:

### Inputs de texto (descripción, nombre dec.)
- Vacío y solo espacios.
- Muy largo (pegá 2.000+ caracteres) → ¿desborda, corta el layout, deja guardar?
- Emojis y unicode raro (👋, caracteres RTL.
- HTML/JS: `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>` → ¿se renderiza,
  se escapa? (verificá que NO ejecute nada).
- Comillas, backslashes, `{{7*7}}`, `${...}`, `'; DROP TABLE`, saltos de línea.
- Espacios al inicio/fin → ¿se recortan o s
- Nombres duplicados (categoría/método con nombre ya existente) → ¿mensaje claro?
- Crear con el mismo nombre que uno borradotivar?

### Inputs numéricos (monto, umbral de lími
- 0, negativos, decimales largos (1.999999999), notación científica (1e10).
- Números enormes (999999999999999) → ¿desbrte?
- Letras, símbolos, pegar texto no numérico, comas vs puntos como separador.
- Monto vacío / solo el signo.
- Cotización 0 o negativa.
- Día de cierre/cobro fuera de 1–31 (0, 32, -1) en métodos de crédito.
- Cantidad de cuotas: 0, 1, negativa, gigante (999).

### Fechas
- Fechas inválidas, año 0001, año 9999, muy futuras / muy pasadas.
- 31 en meses de 30 días, 29/30/31 de febrero, año bisiesto.
- Un fijo/cuota que cruce fin de año → ¿se eses?

### Selects / dropdowns / menús
- Abrir un menú kebab de movimiento cerca del borde de la pantalla → ¿se corta o queda
  fuera de vista? ¿es alcanzable con el mou
- Selects con muchas opciones (categorías, iconos de método) → ¿scrollean bien, se
  cortan, tapan otra cosa?
- Dejar un select sin elegir y guardar → ¿v

## MODALES y OVERLAYS (foco especial — hay reportes de modales cortados)
- Abrí cada modal (alta de movimiento, crearía, crear/editar
  método de pago, diálogos de confirmación) y verificá:
  - ¿Se ve completo o queda CORTADO (arriba/abajo)? ¿Se puede scrollear su contenido?
  - Contenido largo (descripción larga, mucl modal crece,
    scrollea, o rompe?
  - Cerrar con la X, con Esc, y con click en el fondo (backdrop) → ¿funcionan? ¿alguno
    NO debería cerrar y cierra perdiendo datos sin avisar?
  - Al abrir un modal, ¿el fondo queda bloqueado (no scrollea la página de atrás)?
  - Modal sobre modal (ej. el aviso de límito, o una
    confirmación de borrado) → ¿se apilan bien, z-index correcto, se cierran en orden?

## FLUJOS que suelen romper
- Doble submit: apretá "Guardar" muy rápido varias veces → ¿crea duplicados? ¿doble request?
- Spamear clicks en botones de acción (elim
- Guardar mientras algo está cargando; navegar de pantalla mientras hay un guardado en curso.
- Borrar una categoría / método de pago que está EN USO por movimientos → ¿lo impide con
  mensaje claro, o rompe? Verificá que el hte.
- Editar un movimiento, cambiar campos, y CANCELAR → ¿descarta bien? Reabrir → ¿muestra
  los valores originales, no los que tipeaste?
- Vaciar la descripción de un movimiento ala la vieja?
- Anular y des-anular un movimiento varias veces → ¿el total del mes y los reportes se
  actualizan coherentemente?
- Crear un reporte, aplicarle un filtro de categoría que no matchee nada → ¿estado vacío
  prolijo o card rota?
- Reordenar secciones/reportes (drag) y solrrompe el orden?
- Cambiar la moneda por defecto y ver si /mes y reportes se recalculan sin quedar valores
  viejos mezclados.
- Cambiar tema (claro/oscuro/sistema) repetidamente y rápido → ¿flashea, queda a medias?

## ESTADOS VACÍOS y CARGA PESADA
- Usuario/mes SIN movimientos: /mes, dashboard, reportes, ¿tienen empty-states prolijos
  o se ven rotos/con NaN/undefined?
- Mes con muchísimos movimientos (cargá 30+): ¿la lista y los totales aguantan? ¿algún
  número desborda su contenedor?

## SESIÓN / NAVEGACIÓN
- Refrescar (F5) en medio de un flujo (modal abierto, datos sin guardar) → ¿se pierde
  todo de forma prolija o rompe?
- Botón "atrás" del navegador tras abrir modales / cambiar de mes.
- Estar deslogueado y entrar a una URL interna directa → ¿redirige al login?
- Sesión expirada (si podés simularla) y haro, no pantalla
  en blanco?

## Formato del reporte
Por cada hallazgo: (1) dónde (pantalla + elemento), (2) qué hiciste (pasos), (3) qué pasó,
(4) qué esperabas, (5) severidad (rompe / feo / menor), (6) screenshot.
Agrupá por severidad. Priorizá: datos inválcortados o que
atrapan al usuario, opciones inalcanzables, y cualquier crash/pantalla en blanco.
