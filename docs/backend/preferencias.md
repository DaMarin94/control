# Backend — Preferencias de usuario (PreferencesModule)

Lectura y escritura del blob JSON de preferencias, **scopeado por `userId` del JWT**. El blob es **abierto/extensible**: las claves las definen sus consumidores, no este módulo. Endpoints (`GET /preferences`, `PUT /preferences` — reemplazo completo, no merge, upsert), claves y modelo en `docs/data-model/preferencias.md` §Contrato de preferencias de usuario y entidad `UserPreferences` (`docs/data-model/entidades.md`). Acá, la implementación.

## Usuarios sin fila — no se crea en lectura

La fila `UserPreferences` **no se crea al leer**: `GET /preferences` y el `AuthResponse` de login devuelven **`{}`** si no hay fila. Se materializa solo:

- en el **`PUT`** (upsert), o
- en el **alta de cuenta nueva** — `register` y `google` con usuario nuevo (no el `google` de un usuario existente).

## `buildAuthResult` es `async`

Arma el `AuthResponse` de los tres flujos de auth y lee las preferencias: quien lo **llame o lo mockee** tiene que `await`-earlo.

## Gotchas

- **Prisma 7 + tipo `Json` (cast obligatorio).** En `create` / `update` / `upsert`, un `Record<string, unknown>` **no es asignable directo** al input de Prisma. Requiere un cast (`as any` con comentario). El runtime es correcto; el cast es solo para el type-checker.
- **Los e2e que levantan `AppModule` necesitan `userPreferences` en el mock de `PrismaService`** (con `findUnique`, `upsert` y `create`): `AuthService` lee preferencias, y sin el mock los flujos de auth rompen en el setup. Análogo al gotcha de `installmentGroup`.
