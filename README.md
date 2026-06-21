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

.P0 - Que en la vista por mes se pueda ordenar por fecha los gastos, CONSIDERAR hacer tablas en esta pantalla en vez de listados. Solo pensarlo, no se si quedara mejor.
.P1 - Que los labels de los reportes (que aparecen en el footer) funcionen como los checks de filtrado y en vez de boxes se subrayaria/tacharia/*loquepropongas* segun se habiliten o no.
.P2 - Modo oscuro. Default = que el navegador o sistema, recordar compatibilidad absoluta en cualquier tipo de dispositivo, es mas podriamos agregar eso como regla importante en todos los lugares que consideres pertinentes. se puede almacenar la preferencia como el resto de las configuraciones que se persisten en DB.
.P2_b - Que las categorias que se muestren para check sean las que existan movimientos, por ejemplo si yo en el reporte pongo Gastos, entonces deberian listarse solo las categorias que compartan los movimientos de Gastos que se listen en el año. Esto aplica a todos los reportes o lugares donde se use filtro de categoria.
.P3 - que los reportes tengan opcion de cambiar de moneda, cada uno por su cuenta como el resto de las configuraciones. Que al crear se hagan con la moneda actual seleccionada, no se pregunta ni se ofrece.
.P4 - En la pagina /mes, que el titulo del mes sea interactivo (o agregar un icono cerca, lo que se crea conveniente). Y se abra la opcion de cambiar año o mes y poder asi saltar de meses mas rapido. me imagino 2 inputs tipo rueda donde podes subir o bajar o escribir el nro/texto directamente.
.P5 - Crear skeletons en todos los procesos de carga, que sean uniformes y tambien una nueva regla para futuros desarrollos, siempre se incluirian y siguiendo ciertos lineamientos que definamos y recomiendes.
.P6 - Que los modales no se cierren si cliqueamos afuera. Esto aplica a todos
.P7 - Agregar Frankfurter (frankfurter.app) para mantener actualizado el tipo de cambio. y esta u otra para obtener la inflacion de argentina (el IPC).
.P8 - con frankfurter o equivalente agregado, cambiar el dato por defecto a la cotizacion de las monedas al crear un movimiento y en vez de tomar el de la tabla de referencia, tomamos el del dia. 

Errores:
.E1 - En la screen mes, cuando tenes todos los grupos del acordeon contraiodos y la pagina se ve "vacia". Se genera un scroll habiendo espacio vacio.
.E2 - En la screen reportes, cuando le doy agregar y me lista los reportes disponiobles, el 3er reporte ya no se peude ver la lista por que esta al final de la pantalla y la lista siempre va para abajo.



- **F2 — convención global de _ordering_ en los query params del API** queda **diferido, fuera de v1.2**: sigue sin haber un listado paginado o grande que lo justifique. Se diseñará cuando aparezca el primer listado que lo amerite, definiendo formato de los params, campos ordenables y dirección, de forma reutilizable entre endpoints.


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
