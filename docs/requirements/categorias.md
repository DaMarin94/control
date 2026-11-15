# 3.6 Módulo: Categorías

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Submódulo de métodos de pago (3.6.b): `metodos-pago.md`.

Las categorías clasifican los movimientos. Son personalizables por usuario y tienen un scope que define a qué tipo de movimiento aplican, y un color que el usuario elige y edita desde una matriz de colores predefinidos.

---

## RF-CAT-001 — Categorías por defecto al crear cuenta

| Campo | Detalle |
|---|---|
| **Descripción** | Al crear la cuenta por primera vez —por cualquiera de los dos métodos: Google OAuth (RF-AUTH-001) o registro con email + contraseña (RF-AUTH-006)— el sistema crea automáticamente un conjunto de categorías por defecto. |
| **Actor** | Sistema |
| **Prioridad** | Alta |
| **Precondiciones** | Se crea una cuenta nueva (primer ingreso por Google o registro con email + contraseña). |

**Criterios de aceptación:**
- [ ] Al crear la cuenta por cualquiera de los dos métodos, el sistema genera las siguientes categorías con `scope: BOTH`:
  - Consumibles
  - Tarjeta de crédito
  - Gastos fijos
  - Servicios
- [ ] Estas categorías son propiedad del usuario y se pueden editar o eliminar como cualquier otra.
- [ ] No se generan categorías duplicadas si el usuario ya existe.

---

## RF-CAT-002 — Crear categoría

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede crear nuevas categorías personalizadas. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | El usuario tiene sesión activa. |

**Flujo principal:**
1. El usuario accede a la gestión de categorías.
2. El usuario ingresa el nombre de la nueva categoría (obligatorio).
3. El usuario selecciona el scope (default: AMBOS).
4. El usuario confirma.
5. El sistema verifica que el nombre **normalizado** (RN-014) no colisione con otra categoría del mismo usuario.
6. Sin colisión: la categoría queda creada y disponible para asignar a movimientos.

**Flujos alternativos:**
- *A1 — Nombre vacío:* el sistema muestra error de validación y no crea la categoría.
- *A2 — Colisión con una categoría activa del mismo nombre normalizado:* el sistema bloquea la creación e informa que ya existe una categoría con ese nombre. No crea un duplicado (RN-008).
- *A3 — Colisión con una categoría eliminada (soft delete) del mismo nombre normalizado:* el sistema **no crea un duplicado**. En su lugar **propone reactivar** la categoría eliminada mediante un prompt — *"Ya tenés una categoría 'X' eliminada. ¿Querés reactivarla?"* — con las acciones **Reactivar** y **Cancelar**. El prompt aclara explícitamente que la categoría se reactivará **con su configuración original** (mismo scope y color), de modo que el usuario no se sorprenda si el scope que tipeó no se aplica.
  - *A3.1 — El usuario elige Reactivar:* el sistema restaura la categoría eliminada **exactamente como estaba** — mismo `id`, mismo `scope`, mismo color — y sus movimientos históricos vuelven a quedar bajo la categoría activa. Los valores que el usuario haya tipeado en el formulario de alta (nombre, scope) **se ignoran**: prevalece la configuración original de la categoría reactivada. No se crea una categoría nueva.
  - *A3.2 — El usuario elige Cancelar:* no se crea ni se reactiva nada. El usuario vuelve al formulario.

**Criterios de aceptación:**
- [ ] El nombre es obligatorio y no puede estar vacío.
- [ ] No pueden existir dos categorías activas con el mismo nombre para el mismo usuario.
- [ ] La comparación de nombres para detectar colisiones usa la **normalización definida en RN-014** (trim, insensible a mayúsculas e insensible a acentos), aplicada tanto contra categorías activas como eliminadas.
- [ ] Una colisión con una categoría **activa** del mismo nombre normalizado bloquea la creación como duplicado (RN-008).
- [ ] Una colisión con una categoría **eliminada (soft delete)** del mismo nombre normalizado no crea un duplicado: el sistema propone reactivar la eliminada mediante un prompt con acciones Reactivar / Cancelar.
- [ ] El prompt de reactivación aclara explícitamente que la categoría se reactivará con su configuración original (scope y color), no con lo tipeado en el formulario.
- [ ] Al reactivar, la categoría vuelve **exactamente como estaba** (mismo `id`, scope y color) y sus movimientos históricos vuelven a quedar bajo la categoría activa; los datos tipeados en el alta se ignoran.
- [ ] Al cancelar el prompt de reactivación, no se crea ni se reactiva ninguna categoría.
- [ ] El scope puede ser: AMBOS, GASTO, INGRESO. Default: AMBOS.
- [ ] El usuario **elige el color** de la categoría desde la matriz de colores (RF-CAT-005). El sistema **pre-selecciona** el color "menos usado" como default, pero el usuario puede cambiarlo (incluye un botón "aleatorio").
- [ ] La categoría creada está disponible inmediatamente en los selectores de movimientos.
- [ ] La gestión de categorías (crear, editar, eliminar y listar) vive en la **sección Categorías del hub de Configuración**, accesible en `/configuracion/categorias` (RF-NAV-001; ver `docs/screens.md`, §6). Es una superficie de gestión dedicada, no un modal.

**Notas:**
- La unicidad de nombre de categoría activa se valida en **lógica de aplicación**, no con un constraint `@@unique` de base de datos. Motivo: la comparación normalizada (trim + insensible a mayúsculas y acentos) y el flujo "crear-o-reactivar" no caben en un constraint de DB. Ver `docs/data-model/entidades.md`.

---

## RF-CAT-003 — Editar categoría

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede modificar el nombre, el scope y el color de una categoría existente. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | La categoría existe y pertenece al usuario autenticado. |

**Criterios de aceptación:**
- [ ] El nombre, el scope y el **color** son editables (color: ver RF-CAT-005).
- [ ] No puede quedar con el mismo nombre que otra categoría activa del mismo usuario.
- [ ] Los movimientos ya cargados con esa categoría reflejan automáticamente el nuevo nombre.

---

## RF-CAT-004 — Eliminar categoría

| Campo | Detalle |
|---|---|
| **Descripción** | El usuario puede eliminar una categoría. La eliminación es lógica (soft delete): desaparece de los selectores pero los movimientos históricos conservan la referencia. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Media |
| **Precondiciones** | La categoría existe y pertenece al usuario autenticado. |

**Flujo principal:**
1. El usuario selecciona la opción eliminar sobre una categoría.
2. El sistema solicita confirmación.
3. El usuario confirma.
4. El sistema marca la categoría como eliminada (`deletedAt = now`).
5. La categoría deja de aparecer en los selectores de nuevos movimientos.

**Flujos alternativos:**
- *A1 — El usuario cancela:* la categoría no se modifica.

**Criterios de aceptación:**
- [ ] La categoría eliminada no aparece en los selectores al crear o editar movimientos.
- [ ] La categoría eliminada desaparece de la sección de gestión de categorías (`/configuracion/categorias`): mientras está eliminada no se ve su fila ni su contador (RF-CAT-006).
- [ ] Los movimientos históricos que tenían esa categoría siguen mostrando su nombre.
- [ ] La eliminación es lógica — los datos no se borran de la base de datos.
- [ ] El sistema solicita confirmación antes de eliminar.
- [ ] Una categoría eliminada puede **reactivarse** más adelante: al crear una categoría nueva cuyo nombre normalizado colisiona con una eliminada, el sistema propone reactivarla (ver RF-CAT-002, flujo alternativo A3). Al reactivarla, vuelve a aparecer en la pantalla de categorías y en los selectores.

**Notas:**
- *Totales de dinero:* eliminar una categoría con soft delete **no** saca sus movimientos de los totales del mes ni del balance. La eliminación marca la categoría, no toca los movimientos: un movimiento cuenta en los totales (RF-VM-002, RF-DASH-002) **siempre**, sin importar si su categoría fue eliminada. El único conteo afectado es el contador informativo "N movimientos" de la pantalla de categorías (RF-CAT-006), que desaparece junto con la fila de la categoría eliminada y es independiente de los totales de plata.

---

## RF-CAT-005 — Color de categoría

| Campo | Detalle |
|---|---|
| **Descripción** | Cada categoría tiene un color que el usuario **elige y puede editar**, tanto al crear como al editar la categoría, desde una **matriz de colores predefinidos**. El color identifica visualmente a la categoría en la UI. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | Se crea o edita una categoría. |

**Matriz de colores:** el color se elige de una **matriz fija de 40 colores** (8 hues × 5 tonalidades). **No** hay ingreso de hex libre: solo colores que pertenezcan a la matriz. (Definición de la matriz y del pool base en `docs/data-model/categorias.md`, §Matriz de colores.)

**Criterios de aceptación:**
- [ ] Al **crear** una categoría, el usuario puede elegir su color de la matriz de 40 colores.
- [ ] El sistema **pre-selecciona** un color por defecto al abrir el alta: el color **"menos usado"** entre las categorías activas del usuario, calculado sobre los 8 colores base (RN-013). El usuario puede dejar ese default o elegir otro de la matriz.
- [ ] Existe un botón **"aleatorio"** que selecciona un color al azar de la matriz.
- [ ] Al **editar** una categoría, el color es modificable: el picker abre con el color actual de la categoría seleccionado.
- [ ] Solo se aceptan colores que pertenezcan a la matriz; no hay hex libre.
- [ ] Las categorías por defecto del alta de cuenta (RF-CAT-001) reciben su color automáticamente (el alta no tiene UI de elección).
- [ ] El color es solo de presentación: no afecta el cálculo de montos, el scope ni ninguna regla de negocio.

---

## RF-CAT-006 — Contador de movimientos por categoría

| Campo | Detalle |
|---|---|
| **Descripción** | En la pantalla de gestión de categorías, cada categoría muestra la cantidad de movimientos asociados a ella. Es un dato derivado de solo lectura. |
| **Actor** | Usuario autenticado |
| **Prioridad** | Baja |
| **Precondiciones** | El usuario tiene sesión activa y accede a la pantalla de categorías. |

**Criterios de aceptación:**
- [ ] Cada categoría de la lista muestra un contador "N movimientos" con la cantidad de movimientos asociados.
- [ ] El contador es de solo lectura — el usuario no puede editarlo.
- [ ] El contador refleja el estado vigente de los movimientos del usuario; una categoría sin movimientos asociados muestra cero.
