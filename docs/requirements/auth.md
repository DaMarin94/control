# 3.1 Módulo: Autenticación

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`.

Coexisten **dos métodos de autenticación**: Google OAuth (RF-AUTH-001) y email + contraseña (login en RF-AUTH-005, registro en RF-AUTH-006). La protección de rutas (RF-AUTH-002), la sesión persistente (RF-AUTH-003) y el cierre de sesión (RF-AUTH-004) son **agnósticos del método**: una vez que el usuario tiene sesión activa, se comportan igual sin importar cómo inició sesión.

La recuperación de contraseña ("olvidé mi contraseña"), la verificación de email y el account linking (una misma cuenta accesible por Google y por email/contraseña) están **fuera de alcance en v1** (ver `definiciones-y-alcance.md` §6).

Contrato JWT: `docs/data-model/auth.md`.

---

## RF-AUTH-001 — Inicio de sesión con Google OAuth

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema permite iniciar sesión mediante Google OAuth 2.0. El método está **condicionado a que el proveedor de Google esté configurado** en el entorno de la app. |
| **Actor** | Usuario no autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario no tiene sesión activa. Tiene una cuenta de Google válida. El proveedor de Google está configurado. |

**Flujo principal:**
1. El usuario accede a la aplicación.
2. El sistema detecta que no hay sesión y muestra la pantalla de login.
3. El usuario hace clic en "Iniciar sesión con Google".
4. El sistema redirige al flujo OAuth de Google.
5. El usuario autoriza el acceso.
6. Google redirige al sistema con el código de autorización.
7. El sistema crea o actualiza el registro del usuario (email, nombre, avatar).
8. El sistema crea una sesión y redirige al dashboard.

**Flujos alternativos:**
- *A1 — El usuario cancela en Google:* el sistema vuelve a mostrar la pantalla de login.
- *A2 — Error en el flujo OAuth:* el sistema muestra un mensaje de error y permite reintentar.

**Criterios de aceptación:**
- [ ] El botón de Google está **siempre presente** en la superficie de login, y queda **habilitado solo si el proveedor de Google está configurado**. Sin configurar, se muestra **deshabilitado** y rotulado como no disponible: no dispara ningún flujo. El login con email + contraseña (RF-AUTH-005) funciona igual en ambos casos.
- [ ] Completar el flujo OAuth exitosamente redirige al dashboard con sesión activa.
- [ ] Si es la primera vez que el usuario ingresa, el sistema crea su registro automáticamente.
- [ ] Si el usuario ya existe, el sistema actualiza nombre e imagen si cambiaron.
- [ ] Al crear la cuenta por primera vez, el sistema genera las categorías por defecto (ver RF-CAT-001).
- [ ] Un usuario ya autenticado que navega a `/login` es redirigido automáticamente al dashboard, sin volver a mostrar la pantalla de login.

---

## RF-AUTH-002 — Protección de rutas

| Campo | Detalle |
|---|---|
| **Descripción** | Ninguna ruta protegida es accesible sin sesión activa. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | — |

**Flujo principal:**
1. Un usuario sin sesión intenta acceder a una URL protegida.
2. El sistema redirige a la pantalla de login.
3. Tras autenticarse, el sistema redirige a la URL original solicitada.

**Criterios de aceptación:**
- [ ] Acceder sin sesión a cualquier ruta protegida redirige a `/login`.
- [ ] Tras autenticarse, el usuario llega a la ruta que intentaba visitar.
- [ ] La pantalla de login es la única accesible sin autenticación.

---

## RF-AUTH-003 — Sesión persistente

| Campo | Detalle |
|---|---|
| **Descripción** | La sesión persiste entre visitas. No se solicita login en cada apertura de la app. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario inició sesión previamente. |

**Criterios de aceptación:**
- [ ] Cerrar el navegador y volver a abrir la app no requiere hacer login nuevamente.
- [ ] La sesión expira pasado el período de inactividad configurado en Auth.js.

---

## RF-AUTH-004 — Cierre de sesión

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede cerrar su sesión en cualquier momento. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa. |

**Flujo principal:**
1. El usuario selecciona la opción "Cerrar sesión".
2. El sistema invalida la sesión.
3. El sistema redirige a la pantalla de login.

**Criterios de aceptación:**
- [ ] La opción de cerrar sesión está disponible desde cualquier pantalla.
- [ ] Tras cerrar sesión, las rutas protegidas redirigen a login.
- [ ] El token queda invalidado — no se puede reutilizar.

---

## RF-AUTH-005 — Inicio de sesión con email y contraseña

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema permite iniciar sesión con email y contraseña. El backend verifica la contraseña contra el hash almacenado. |
| **Actor** | Usuario no autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario no tiene sesión activa. Existe una cuenta registrada con ese email y contraseña (ver RF-AUTH-006). |

**Flujo principal:**
1. El usuario accede a la pantalla de login.
2. El usuario ingresa su email y su contraseña.
3. El usuario confirma ("Iniciar sesión").
4. El sistema envía las credenciales al backend.
5. El backend busca el usuario por email y verifica la contraseña contra el hash almacenado.
6. Las credenciales son válidas: el sistema crea una sesión y redirige al dashboard.

**Flujos alternativos:**
- *A1 — Credenciales inválidas (email inexistente o contraseña incorrecta):* el sistema muestra un mensaje de error genérico que **no revela** si falló el email o la contraseña, y permite reintentar.
- *A2 — Campos incompletos o email con formato inválido:* el sistema muestra error de validación y no envía la request.
- *A3 — Error del backend:* el sistema informa el error y permite reintentar sin perder el email ingresado.

**Criterios de aceptación:**
- [ ] El login con credenciales válidas redirige al dashboard con sesión activa.
- [ ] Ante credenciales inválidas, el mensaje de error es genérico y no distingue entre email inexistente y contraseña incorrecta.
- [ ] La verificación de la contraseña contra el hash ocurre en el backend; el frontend nunca compara contraseñas.
- [ ] La contraseña nunca se almacena ni se transmite en texto plano fuera del envío de la credencial al backend para su verificación.
- [ ] Un usuario ya autenticado que navega a `/login` es redirigido al dashboard (igual que RF-AUTH-001).

---

## RF-AUTH-006 — Registro con email y contraseña

| Campo | Detalle |
|---|---|
| **Descripción** | El sistema permite crear una cuenta nueva con email y contraseña. El backend hashea la contraseña, crea el usuario y genera las categorías por defecto. |
| **Actor** | Usuario no autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario no tiene sesión activa. No existe una cuenta previa con ese email. |

**Flujo principal:**
1. El usuario accede a la pantalla de registro.
2. El usuario ingresa su email y una contraseña (y la confirmación de contraseña).
3. El usuario confirma ("Registrarme").
4. El sistema valida el formato del email y la longitud mínima de la contraseña (mínimo 8 caracteres).
5. El sistema envía los datos al backend.
6. El backend verifica que el email no esté en uso, hashea la contraseña (bcrypt/argon2) y crea el registro del usuario.
7. El backend genera las categorías por defecto de la cuenta nueva (ver RF-CAT-001).
8. El sistema crea una sesión y redirige al dashboard con el usuario ya logueado.

**Flujos alternativos:**
- *A1 — Email ya registrado:* el sistema muestra un error indicando que el email ya está en uso y no crea la cuenta.
- *A2 — Email con formato inválido:* el sistema muestra error de validación y no envía la request.
- *A3 — Contraseña menor a 8 caracteres:* el sistema muestra error de validación y no crea la cuenta (no envía la request).
- *A4 — Contraseña y confirmación no coinciden:* el sistema muestra error de validación y no envía la request.
- *A5 — Error del backend:* el sistema informa el error y permite reintentar sin perder el email ingresado.

**Criterios de aceptación:**
- [ ] El email y la contraseña son obligatorios; el email debe tener formato válido.
- [ ] La contraseña debe tener un mínimo de 8 caracteres. No se exige complejidad obligatoria (mayúscula, número ni símbolo).
- [ ] Una contraseña de menos de 8 caracteres produce error de validación y no registra la cuenta.
- [ ] Si se incluye confirmación de contraseña, debe coincidir con la contraseña para poder registrarse.
- [ ] Si el email ya está registrado, el sistema no crea la cuenta e informa el error.
- [ ] El backend almacena la contraseña siempre hasheada (bcrypt/argon2), nunca en texto plano (RN-012).
- [ ] Al crear la cuenta, el backend genera las categorías por defecto (RF-CAT-001), igual que en el alta por Google.
- [ ] Tras un registro exitoso, el usuario queda logueado y es redirigido al dashboard sin pasar por el login.

---

## RF-AUTH-007 — Cierre de sesión automático ante token inválido o expirado

| Campo | Detalle |
|---|---|
| **Descripción** | Cuando el backend responde `401` (token del backend inválido o expirado), la app cierra la sesión y lleva al usuario al login con un aviso: "Tu sesión expiró, volvé a entrar." |
| **Actor** | Usuario autenticado |
| **Prioridad** | Alta |
| **Precondiciones** | El usuario tiene sesión activa y realiza una llamada al backend. |

**Flujo principal:**
1. La app hace una llamada al backend con el token de sesión.
2. El backend responde `401` (token inválido o expirado).
3. El sistema cierra la sesión y redirige a `/login`.
4. El sistema muestra el aviso "Tu sesión expiró, volvé a entrar."

**Criterios de aceptación:**
- [ ] Un `401` del backend cierra la sesión y redirige a `/login` con el aviso "Tu sesión expiró, volvé a entrar."
- [ ] Solo el `401` dispara el cierre de sesión automático. `403`, `400`, `500` y los errores de red (`503`) no cierran sesión: se manejan localmente como cualquier error.
- [ ] Cuando varias llamadas fallan con `401` a la vez, el cierre de sesión y el aviso se disparan una sola vez (sin loop ni avisos duplicados).
- [ ] Estando ya en `/login`, un `401` no vuelve a disparar el flujo.
