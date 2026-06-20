# Decisiones técnicas transversales

> Estándares técnicos que aplican a todo el proyecto, independientes de un feature puntual.
> Los agentes especialistas (frontend y backend) deben seguir estas convenciones al implementar.

---

## Logging

Logging estructurado en back y front, con salida a consola. La centralización en un servicio externo queda fuera de v1; el diseño permite cambiar el destino sin tocar el código que loggea.

### Backend (NestJS + Pino)

- **Pino** como logger estructurado, salida JSON a consola.
- **Niveles:**
  - `error` — falla que rompe una operación.
  - `warn` — algo recuperable o sospechoso.
  - `info` — eventos relevantes (request completado, recurso creado).
  - `debug` — detalle, solo en desarrollo.
- **Correlación por request:** cada request entrante recibe un `requestId` que se incluye en todos los logs de esa request, para seguir el hilo de una operación completa.

### Frontend (Next.js)

- Wrapper liviano de logging que emite a consola con la **misma forma estructurada** que el backend.
- Captura de errores: errores no manejados y fallos de llamadas al backend se loggean con nivel `error`.
- En producción se silencian `debug` e `info`; solo quedan `warn` y `error`.

### Común a ambos

- **Forma del log:** `{ timestamp, level, context, message, ...datos }`.
- **Datos sensibles:** nunca loggear el JWT, tokens ni el header `Authorization` completo. Sí el `userId` ya extraído.
- **Destino:** consola por ahora. Centralizar (servicio externo) cambia solo el transporte, no el código que loggea.

---

## Formato de respuesta de la API

El backend **nunca devuelve texto plano ni valores sueltos**. Toda respuesta viaja en un sobre (envelope) consistente. El frontend siempre desenvuelve igual.

**El sobre siempre tiene:** `success` + `statusCode`, y luego **o** `data` **o** `error` — nunca ambos.

**Respuesta exitosa:**
```json
{ "success": true, "statusCode": 200, "data": { } }
```
El contenido real (un movimiento, una lista, etc.) viaja dentro de `data`.

**Respuesta de error:**
```json
{ "success": false, "statusCode": 400, "error": { "message": "...", "timestamp": "...", "path": "/movements" } }
```

**Notas:**
- El `statusCode` también viaja en la status line HTTP; se incluye en el cuerpo por conveniencia de la capa centralizada del front y del logging. Es una redundancia deliberada.
- Un interceptor global arma el sobre de las respuestas exitosas. El exception filter global (ver abajo) arma el de los errores.

---

## Error handling

Manejo de errores **centralizado**: un único punto atrapa las excepciones, las loggea y siempre responde con el formato del sobre. No hay manejo de errores disperso por cada endpoint o componente.

### Backend — Global Exception Filter

- Un **Exception Filter global** intercepta toda excepción de cualquier endpoint, sin que cada controller haga nada.
- **Loggea** según los niveles definidos en Logging:
  - Errores esperados (validación, 404, 401, 403) → `warn`.
  - Errores inesperados (bugs, 500, DB caída) → `error` con stack completo.
- **Siempre responde con el sobre de error** (`{ success: false, statusCode, error }`).
- Los detalles internos de un 500 **nunca** se filtran al cliente: se loggean en el server, el usuario recibe un mensaje genérico.
- Los especialistas solo lanzan excepciones (`throw new BadRequestException(...)`); el filtro se encarga de loggear y dar formato.

### Frontend — capa centralizada de llamadas

- Un **único cliente/capa sobre fetch** centraliza todas las llamadas al backend. Ningún componente llama al backend directamente ni maneja errores de red a mano.
- En respuesta exitosa: desenvuelve `data` automáticamente y se lo entrega al consumidor.
- En respuesta de error: loggea (nivel `error`) y propaga un error normalizado para que la UI lo muestre.
- Mapeo en la UI:
  - Errores de validación → se muestran en el campo correspondiente.
  - Errores de servidor (500) o de red (backend caído) → toast de error.
- Se conecta con RNF-008: ante error al guardar, el formulario permanece abierto y conserva los datos.

---

## Notificaciones (toasts)

Sistema de toasts **centralizado**: cualquier parte de la app dispara un toast desde un único punto. Ningún componente renderiza toasts a mano.

- **API:** un hook `useToast` disponible en toda la app.
- **Tipos:** `success`, `error`, `warning`, `info`. El tratamiento visual lo define el diseño; acá solo se define que los cuatro existen.
- **Acción opcional:** un toast puede llevar un botón de acción (label + callback). Caso de referencia: el toast `success` post-guardado con la acción "Ir a ver" (Gap 5 / RF-MU-001, RF-MF-001, RF-MC-001).
- **Auto-dismiss:** todos los toasts desaparecen solos tras un tiempo, sin importar el tipo. Si el usuario no interactúa con la acción del toast, este se va igual.

**Quién dispara toasts:**
- Guardado exitoso de un movimiento → `success` con acción "Ir a ver".
- La capa centralizada de errores del frontend → `error` (fallo de servidor o de red).
- Otras confirmaciones (categoría creada, editada, eliminada, etc.) → `success`.

---

## Convenciones de hooks (frontend)

### Reglas básicas

- Todo hook custom empieza con `use` (estándar de React): `useToast`, `useMovements`, etc.
- Un hook = una responsabilidad.
- Se respetan las reglas de hooks (no llamadas condicionales, siempre top-level).

### Categorías de hooks

- **Hooks de datos** — traen o mutan datos del backend a través de la capa centralizada de llamadas (ver Error handling). Exponen el estado: cargando / datos / error. Ej: `useMovements(month)`, `useCategories()`.
- **Hooks de UI/estado** — manejan estado de interfaz. Ej: `useToast`, `useModal`.
- **Hooks de lógica** — encapsulan lógica reutilizable sin tocar el backend.

### Server-state: React Query (TanStack Query)

El estado del servidor se maneja con **React Query**. Los hooks de datos son wrappers finos sobre React Query montados encima de la capa centralizada de llamadas.

- React Query provee caché, estados de loading/error, refetch e invalidación.
- **Invalidación al mutar:** tras crear, editar o eliminar un recurso, se invalidan las queries afectadas para que la UI se actualice sola (ej: guardar un movimiento → la lista del mes y los totales se refrescan sin recarga manual). Conecta con RF-VM-002 (totales que se actualizan inmediatamente) y con el toast post-guardado.
- Los estados "cargando / vacío / error" definidos en las pantallas (ver `screens.md`) se alimentan del estado expuesto por React Query.

---

## Testing

**Política:** todo feature se implementa **con sus tests en el mismo PR** (tests obligatorios junto al feature). No se exige TDD estricto (test-first), pero un feature sin tests no se considera terminado.

**Alcance v1:** tests unitarios + de integración. Los e2e (Playwright) quedan fuera de v1.

### Ubicación

- Los tests viven en una carpeta `tests/` **hermana de `src/`** en cada app — no colocados junto al código. `src/` contiene solo código.
- La carpeta `tests/` **espeja el árbol de `src/`**: cada test refleja la ruta del archivo que prueba.
- **Backend:** `tests/unit/` (specs de services, interceptors, etc.) y `tests/e2e/` (tests de endpoint con DB de test, junto a su `jest-e2e.json`).
- **Frontend:** `tests/` espejando `src/`, con el setup global en `tests/setup.ts`. Los imports al código fuente usan el alias `@/`.
- La cobertura apunta a `src/`, no a `tests/`.

### Qué priorizar

Las reglas de negocio son lo más valioso a testear, porque un bug ahí corrompe datos:
- Montos en centavos, sin floats (RN-002).
- Aislamiento por usuario — nunca devolver datos de otro (RN-003).
- Cálculo on-the-fly de fijos y cuotas por mes (RN-006).
- Inmutabilidad del pasado en fijos (RN-005).
- Filtrado de categorías por scope (RN-010).

### Backend (Jest)

- **Unitarios** sobre los services (lógica de negocio), sin tocar la DB.
- **Integración / e2e** sobre los endpoints, con DB de test: verifican el sobre de respuesta, los códigos de error y el aislamiento por usuario.
- Herramienta: **Jest** (default de NestJS).

### Frontend (Vitest + React Testing Library)

- Tests de **componentes y hooks**, con foco en lógica: validaciones del formulario, comportamiento de los hooks de datos, estados (vacío / error).
- Herramientas: **Vitest + React Testing Library**.

---

## Fechas y zonas horarias

El manejo de fechas está diseñado para multiusuario y para preservar la hora local original de cada registro, incluso si el usuario cambia de país.

### Principios

1. **El movimiento único es un instante con su zona original.** No es una fecha de calendario: tiene fecha y hora. Se guarda como:
   - `occurredAt` — el instante en **UTC** (`timestamptz`), para orden absoluto y cálculos entre registros.
   - `timezone` — el nombre IANA de la zona en la que ocurrió el gasto (ej: `America/Argentina/Buenos_Aires`), guardado **con cada registro**.
2. **Se guarda el nombre IANA de la zona, no el offset crudo** (`-03:00`). El offset cambia con horario de verano; el nombre IANA permite reconstruir correctamente la hora local en cualquier fecha.
3. **Mostrar = renderizar `occurredAt` en la `timezone` guardada del registro.** Así el usuario ve siempre la hora local original del gasto, sin importar dónde esté ahora. La hora de un registro nunca se "mueve".
4. **El bucketing por mes se calcula en la zona del propio registro**, no en UTC. Esto fija el gasto en el mes en que ocurrió, de forma estable y permanente (Postgres `AT TIME ZONE`). El error clásico —filtrar el mes en UTC y correr el gasto al mes equivocado— queda evitado por diseño.
5. **El backend nunca calcula "ahora" para lógica de negocio.** El frontend (que conoce la zona del usuario) manda las fechas y el mes explícitos; el backend guarda y filtra por lo que recibe.
6. **Fijos y cuotas no cambian** — son a nivel mes, sin instante ni zona. Un mes es una etiqueta absoluta.
7. **Los timestamps de sistema (`createdAt`, etc.) son instantes en UTC** — preocupación separada de las fechas de negocio.

### Zona del perfil vs zona del registro

- **`timezone` del perfil del Usuario:** su zona "de casa" / default. Se usa para calcular "hoy" y "mes actual" al crear un movimiento y para el mes que muestra el dashboard.
- **`timezone` del registro:** la zona activa al momento de cargar el gasto (donde realmente ocurrió). Es la que se usa para mostrar y para el bucketing de ese registro.

### Conversiones (dónde ocurre cada una)

- **Al escribir:** el front manda el instante con offset explícito (ej: `2026-06-17T14:30:00-03:00`) y el nombre de zona. El backend guarda `occurredAt` en UTC + `timezone`.
- **Al filtrar por mes:** el backend bucketea usando la `timezone` del registro (`AT TIME ZONE`).
- **Al mostrar:** el backend devuelve el instante UTC + la zona; el front lo formatea en esa zona.

---

## Validación

Validación en dos capas, cada app define la suya. No hay esquema compartido entre back y front.

### Backend (fuente de verdad)

- `class-validator` + DTOs + `ValidationPipe` global de NestJS.
- Valida toda entrada en el borde de la API: monto > 0, cantidad de cuotas entero > 0, campos obligatorios, formatos, etc.
- **El backend siempre valida, sin confiar en el cliente.** Es la fuente de verdad.

### Frontend (UX)

- **Zod + React Hook Form** en los formularios.
- Valida en el campo antes de enviar, para mostrar el error sin esperar el round-trip.
- Es una capa de experiencia de usuario, no de seguridad: no reemplaza la validación del backend.

### Nota

Las reglas de validación se escriben en cada lado por separado (back y front son proyectos independientes, sin código compartido). Ante una regla de negocio nueva, mantener ambas capas alineadas.

---

## Migraciones de base de datos (Prisma)

El proyecto usa **Prisma 7**, que mueve la configuración de conexión fuera del schema y exige un driver adapter explícito. Esto cambia cómo se configura la URL y cómo se corre el CLI:

- **La URL de conexión NO va en el `datasource` del `schema.prisma`.** En Prisma 7 vive en `backend/prisma.config.ts` (`defineConfig` + `env('DATABASE_URL')`). El `datasource db` del schema solo declara `provider = "postgresql"`.
- **El `PrismaClient` requiere un driver adapter explícito** (`@prisma/adapter-pg` + `pg`); ya no acepta la URL en el constructor. En runtime el adapter lo arma `PrismaService` con la URL del `ConfigService` (ver `docs/backend.md`).
- **El CLI no carga `.env` solo cuando hay `prisma.config.ts`.** Por eso el config hace `import 'dotenv/config'` al tope, y dotenv resuelve relativo al `cwd`: los comandos de Prisma CLI (`migrate`, `generate`, seed) se corren **desde `backend/`**, o fallan con `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`.
- **`prisma.config.ts` está excluido del build de producción** (`tsconfig.build.json`): es solo del CLI, no compila a `dist/`.

- **`schema.prisma` es la fuente de verdad** del modelo. Toda la estructura de la DB vive ahí.
- **Desarrollo:** `prisma migrate dev` — crea la migración a partir de los cambios del schema, la aplica a la DB local y regenera el Prisma Client.
- **Producción / CI:** `prisma migrate deploy` — aplica las migraciones pendientes sin generar nuevas. Determinístico.
- **Las migraciones se commitean al repo** (`prisma/migrations/`). Son parte del historial.
- **Nunca se edita una migración ya aplicada.** Si algo está mal, se crea una nueva que corrige.
- **Nombres descriptivos** por lo que hace cada migración (ej: `add_movement_timezone`, `create_categories`).

#### Generar migraciones sin shadow database (Prisma 7 en este proyecto)

`prisma migrate dev` necesita crear una **shadow database** temporal para diff-ear el schema; en este entorno el rol de Postgres **no tiene permiso** para crearla, así que `migrate dev` falla. El **patrón a seguir** para generar una migración nueva (probado en la Fase 1.1.1) es, todo desde `backend/`:

1. **Generar el SQL** con `prisma migrate diff` (compara el estado de las migraciones aplicadas contra el `schema.prisma` actual y escribe el `migration.sql`):
   ```
   prisma migrate diff \
     --from-migrations ./prisma/migrations \
     --to-schema-datamodel ./prisma/schema.prisma \
     --script > prisma/migrations/<timestamp>_<nombre>/migration.sql
   ```
2. **Aplicar el cambio a la DB** con `prisma db push` (sincroniza el schema sin pasar por el motor de migraciones).
3. **Marcar la migración como aplicada** en el historial con `prisma migrate resolve --applied <timestamp>_<nombre>`, para que `migrate deploy` (prod/CI) no intente reaplicarla.
4. **Regenerar el client** con `prisma generate` y revisar el `migration.sql` a mano antes de commitearlo (se commitea como cualquier otra migración).

No usar `migrate dev` mientras no haya permisos de shadow DB. La migración resultante es un archivo SQL normal en `prisma/migrations/` y `migrate deploy` la aplica determinísticamente en producción.

### Seed de desarrollo

- Hay un **seed de desarrollo** (`prisma/seed.ts`) que puebla la DB con datos de prueba (un usuario dummy con movimientos de ejemplo) para no programar contra una base vacía.
- El seed es **solo para desarrollo** — no corre en producción.

### Categorías por defecto vs seed (no confundir)

- Las **categorías por defecto** (RF-CAT-001) **no son un seed**. Son lógica de aplicación que corre dentro del flujo de alta de cada usuario: al crearse un usuario nuevo, el sistema le genera sus 4 categorías propias.
- Razón: los usuarios se crean dinámicamente (al primer login con Google) y cada uno es dueño de sus propias categorías (aislamiento por usuario, RN-003). Un seed corre una vez y no conoce usuarios futuros.

---

## Configuración y variables de entorno

- **Validación al arrancar (fail-fast):** la app valida que todas las env vars requeridas estén presentes y bien formadas al iniciar. Si falta una o está mal, **no arranca** y reporta cuál falla.
  - Backend (NestJS): `ConfigModule` con validación vía **Zod** al boot.
  - Frontend (Next.js): módulo de env validado con **Zod** que falla en build/start si falta algo.
- **Secrets fuera del repo:** los `.env` con valores reales están gitignoreados. Se commitea un `.env.example` con las claves (sin valores) como plantilla.
- **Acceso tipado y centralizado:** nadie lee `process.env.X` desperdigado. Se accede a través de un config central tipado.
- **Público vs privado en Next.js:** solo las vars con prefijo `NEXT_PUBLIC_` se exponen al browser. Secrets y tokens nunca llevan ese prefijo — quedan server-side.

### Variables (ilustrativo, no es la lista final)

- **Backend:** `DATABASE_URL`, secret para validar el JWT, `PORT`.
- **Frontend:** URL del backend, `AUTH_SECRET`, credenciales de Google OAuth.

---

## Autenticación

Dos métodos de login que conviven (Google OAuth + email/contraseña), resueltos con **Auth.js (NextAuth v5)** en el frontend. El backend es dueño de los usuarios y las credenciales.

### Métodos (frontend, Auth.js con dos providers)

- **Google OAuth** — provider de Google.
- **Email + contraseña** — provider de credenciales.

### Endpoints del backend (dueño de usuarios y credenciales)

- `POST /auth/register` — email + contraseña → el backend hashea la contraseña, crea el usuario y genera las categorías por defecto (RF-CAT-001), devuelve el `userId`.
- `POST /auth/login` — email + contraseña → el backend verifica el hash y devuelve el `userId`. Lo llama el provider de credenciales de Auth.js.
- `POST /auth/google` — el frontend (en el callback de Auth.js) pasa el `id_token` de Google; el backend lo **verifica contra Google**, crea-o-trae el usuario + categorías por defecto, devuelve el `userId`.

### Hashing de contraseñas

- Las contraseñas se hashean con **argon2id** en el backend. Nunca se almacenan en texto plano (RN-012).
- El hash y la verificación ocurren siempre del lado del backend.

### Emisión y validación del JWT (común a ambos métodos)

Ocurre **después** de autenticar, sin importar el método:

1. **El token de sesión de Auth.js está encriptado (JWE)** y es específico de Auth.js — el backend NO lo valida directamente.
2. Auth.js, en su callback, **firma un JWT propio para el backend**: algoritmo **HS256** con un **secret compartido** entre front y back, con claims `sub=userId` y `exp` (vida corta). Se guarda en la sesión.
3. El frontend adjunta ese JWT como `Authorization: Bearer <token>` en cada llamada al backend.
4. El **`JwtAuthGuard` global** del backend verifica la firma y los claims con el secret compartido, extrae el `userId` y scopea todos los recursos (RN-003).
5. **Refresh:** el JWT de backend se re-emite desde la sesión viva de Auth.js. No hay maquinaria de refresh tokens aparte; la sesión de Auth.js es la fuente de verdad.

### Fuera de v1

Recuperación de contraseña, verificación de email y account linking (mismo email por Google y por credenciales) quedan diferidos — ver `docs/requirements.md`, sección 6.

---

## Linting y formato

- **ESLint + Prettier** en ambas apps (cada una con su config; NestJS y Next.js ya traen ESLint, se suma Prettier para formato).
- **Sin pre-commit hooks** por ahora (no husky/lint-staged).
- **Sin CI** por ahora.

### Notas de entorno (pnpm / Windows)

- **pnpm 11 — builds nativos:** al clonar el repo correr `pnpm approve-builds --all` una vez. pnpm 11 requiere aprobación explícita de scripts de build de dependencias nativas (esbuild, sharp, etc.).
- **Windows — scripts de package.json:** en el backend los scripts apuntan directo al binario (`node node_modules/<paquete>/bin/<bin>.js`) en lugar de los shims de `.bin/`. En Windows con pnpm los shims son scripts bash que Node no ejecuta directamente. En Linux/Mac los comandos cortos (`nest`, `jest`) funcionan normal. Al agregar un script nuevo, respetar esta forma.

### Deploy (Render)

- **Backend como Web Service:** `rootDir: backend`, build `pnpm install --prod=false && pnpm build`, start `pnpm start:prod` (= `node dist/main`). El `--prod=false` es obligatorio: sin él, con `NODE_ENV=production` pnpm omite las devDependencies y `nest build` (que vive en `@nestjs/cli`, una devDependency) no está disponible.
- **Gotcha — compilación incremental de TS + caché de Render (importante):** `tsconfig.json` tiene `incremental: true` (genera `tsconfig.build.tsbuildinfo`), que Render cachea entre deploys. La compilación incremental de TypeScript NO verifica si los archivos de salida existen: solo consulta el buildinfo. Con el buildinfo cacheado, `tsc` concluye "todo al día", sale con código 0 sin emitir nada y `dist/` queda vacío → el build figura como exitoso pero en runtime falla con "Cannot find module dist/main". **Solución:** `incremental: false` en `tsconfig.build.json` (override del tsconfig base), para que el build de producción siempre emita completo; el `tsconfig.json` de desarrollo mantiene `incremental: true` para que el IDE siga rápido. Workaround inmediato si reaparece: "Clear build cache & deploy".
- **Versión de Node:** Render usa Node 24 por default; el proyecto apunta a Node 22. Se fija con un archivo `.node-version` (contenido `22`) ubicado en el `rootDir` del servicio (`backend/.node-version`), no en la raíz del repo.
- **`PORT`:** Render lo inyecta automáticamente; no se declara como env var (declararlo pisaría el valor de Render y rompería el health check). El backend lo lee de `process.env.PORT` vía la config.
- **Variables requeridas en Render:** `DATABASE_URL` (Internal URL de la base; obligatoria para bootear por la validación fail-fast aunque Prisma llegue en Fase 1), `JWT_SECRET` (≥32 chars; secreto compartido HS256 con el frontend), `NODE_ENV=production`.
- **Blueprint (`render.yaml`):** hay un `render.yaml` en la raíz que versiona el web service + la base Postgres. Notas: `region` debe coincidir entre base y servicio; `JWT_SECRET` va con `sync: false` (se carga a mano en el dashboard, no se versiona); `DATABASE_URL` se enlaza desde la base con `fromDatabase`; `PORT` no se declara.
- **Health check:** `healthCheckPath: /health`.

---

## Formato de presentación (moneda y fechas)

Todo el formateo vive en **un único lugar** (`lib/format.ts` del frontend), para que cambiar locale, símbolo o el manejo de moneda después sea trivial. Cubre montos, código de moneda y cotización (multi-moneda, RN-009 / módulo 3.10 RF-CUR).

### Moneda

- Helper de monto con `Intl.NumberFormat`: toma los centavos, divide por 100 y formatea anteponiendo el **símbolo de la moneda** del monto.
- **Locale por defecto `es-AR`:** separador de miles con punto, decimales con coma (`1.500,00`).
- **Símbolo por código de moneda — fuente única.** El formateador recibe el **código** (ARS / USD) y resuelve el símbolo desde un **único mapa** `CURRENCY_SYMBOLS`: **ARS → `$`**, **USD → `US$`**. El símbolo se antepone **sin espacio** y el orden con signo es `[signo][símbolo][cifra]` (`$1.500,00`, `US$1.500,00`, `-$1.500,00`). Sumar una moneda futura = una entrada en el mapa; reemplaza al `$` único anterior (cuando todas las cifras usaban el mismo símbolo).
- **Siempre 2 decimales** (`$1.500,00`).
- Helper de **código de moneda** (badge `ARS` / `USD`).
- Helpers de **cotización** (`formatExchangeRate` / `parseExchangeRateInput`), locale `es-AR` (punto = miles, coma = decimal).
- El detalle funcional/visual vive en `requirements.md` (RF-CUR) y `docs/design.md`; acá solo la nota de que todo este formateo está centralizado.

### Fechas

- Helper central con `Intl.DateTimeFormat`, locale por defecto `es-AR`.
- Los movimientos únicos se muestran en la **zona horaria original del registro** (ver Fechas y zonas horarias).
- Formatos: fecha `dd/mm/aaaa`, hora 24h, encabezado de mes como nombre + año ("Junio 2026").

---

## Estado de cliente

- **Server-state:** React Query (ver Convenciones de hooks).
- **Estado de UI:** context de React o estado local del componente.
- **Sin Redux/Zustand** salvo necesidad real comprobada.

---

## Paginación

- En v1 los datasets están acotados (movimientos por mes, categorías son pocas) → **sin paginación**.
- Si algún listado crece en el futuro, se evalúa en ese momento.
