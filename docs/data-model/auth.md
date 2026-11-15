# Contrato de autenticación (auth / JWT)

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Reglas funcionales: módulo 3.1 (`docs/requirements/auth.md`).

Los tres endpoints de auth (`/auth/register`, `/auth/login`, `/auth/google`) devuelven, dentro del sobre `{ success, statusCode, data }`, el mismo shape en `data`:

```
AuthResponse = {
  accessToken: string,
  user: {
    id: string,
    email: string,
    name: string | null,
    image: string | null
  },
  preferences: { ... }      // blob JSON de preferencias del usuario; {} si no tiene fila
}
```

- **`accessToken`** es el JWT que **emite NestJS** (HS256). Sus claims son: `sub` (el `userId`, cuid del usuario), `iat` y `exp` (expira a los **30 días**). El frontend lo trata como **opaco**: lo guarda y lo reenvía como `Authorization: Bearer`, no lo decodifica.
- **Dos tokens distintos.** El `accessToken` (JWT de NestJS) viaja **dentro** de la sesión de Auth.js, que es un **JWE separado** encriptado por NextAuth. No confundirlos: el backend solo valida el JWT de NestJS; nunca ve el JWE de Auth.js. Detalle del flujo en `docs/architecture.md`.
- **`preferences` — blob JSON cargado al loguear.** Los tres flujos (`/auth/login`, `/auth/register`, `/auth/google`) incluyen el blob de preferencias del usuario en `data`, para que el frontend lo cargue **una sola vez** en la sesión de Auth.js al iniciar sesión y no tenga que pedirlo aparte. Es **`{}`** si el usuario no tiene fila de preferencias (ver `docs/backend/preferencias.md`). Mutaciones posteriores se hacen contra `PUT /preferences` (`preferencias.md`), no re-logueando.
