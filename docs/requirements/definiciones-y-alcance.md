# Definiciones, descripción general, requerimientos no funcionales y fuera de alcance

> Parte de los requerimientos funcionales de Control. Índice e ID → archivo: `docs/requirements.md`. Aplica a la plataforma **web**; no hay aplicación nativa.

---

## 1. Definiciones

Los términos del dominio (movimiento, gasto, ingreso, único, fijo, cuota, grupo de cuotas, categoría, balance, mes activo, etc.) se definen en `glosario.md`. Abreviaturas usadas en los requerimientos:

| Abreviatura | Significado |
|---|---|
| RF | Requerimiento Funcional |
| RN | Regla de Negocio |
| RNF | Requerimiento No Funcional |

---

## 2. Descripción general del sistema

Control es una aplicación web de uso personal para registrar y visualizar movimientos de dinero organizados por mes. No es un sistema contable: su foco es la **previsibilidad** — ver en qué se va el dinero y detectar patrones mes a mes.

**Actor único:** el usuario autenticado (por Google o por email + contraseña). No hay roles, administradores ni invitados; cada usuario accede solo a sus propios datos.

**Supuestos:**

- El usuario dispone de una cuenta de Google, o se registra con email + contraseña.
- Cada movimiento lleva moneda **explícita** sobre un **set curado de 4 monedas (ARS / USD / EUR / BRL)**, con totales en la moneda default del usuario (módulo 3.10, `multi-moneda.md`).
- El usuario registra sus movimientos manualmente — no hay integración bancaria.
- Los movimientos fijos y cuotas se calculan on-the-fly al consultar un mes; no se generan filas por instancia mensual.

**Restricciones de diseño:**

- Los montos se almacenan en **centavos** (entero sin decimales) para evitar errores de punto flotante (la cotización es la excepción — ver `docs/data-model/entidades.md`).
- Todos los recursos están **aislados por usuario**: el backend filtra siempre por el `userId` del JWT activo.
- El instante de un movimiento único (`occurredAt`) es el momento elegido por el usuario (default "ahora"), no el timestamp de creación (`createdAt`).

---

## 5. Requerimientos no funcionales

| ID | Categoría | Requerimiento |
|---|---|---|
| RNF-001 | Seguridad | Toda request al backend debe incluir un JWT válido. Sin token válido el backend retorna `401 Unauthorized`. |
| RNF-002 | Seguridad | El backend filtra todos los recursos por el `userId` del JWT. No existe endpoint que devuelva datos de otro usuario. |
| RNF-003 | Usabilidad | La acción de cargar un nuevo movimiento debe ser accesible en máximo 2 interacciones desde cualquier pantalla. |
| RNF-004 | Usabilidad | El formulario de carga de movimiento debe poder completarse y guardarse en menos de 30 segundos en condiciones normales. |
| RNF-005 | Performance | La vista del mes debe cargar y mostrar los movimientos en menos de 2 segundos en conexión normal. |
| RNF-006 | Compatibilidad | La aplicación debe funcionar correctamente en las últimas dos versiones de Chrome, Firefox y Safari. |
| RNF-007 | Disponibilidad | La aplicación es web-first. No hay requerimiento de funcionamiento offline en v1. |
| RNF-008 | Resiliencia | Resiliencia de formularios — ante un error del backend al guardar, el formulario permanece abierto, conserva los datos ingresados y permite reintentar sin perder información. |

---

## 6. Fuera de alcance — v1

Los siguientes features están explícitamente excluidos de v1. Implementar alguno sin decisión explícita rompe el scope.

| Feature | Motivo de exclusión |
|---|---|
| Reportes: otros tipos (torta, barras de comparación, etc.) | Los tipos de reporte que **sí** entran son ingresos/gastos y apilado por categoría de gastos (RF-REP-001), la grilla anual de gastos Únicos día × mes (RF-REP-010), el gantt anual de gastos en Cuotas (RF-REP-011), las líneas de Inflación vs Ingresos (RF-REP-012) y el Detalle histórico de fijos (RF-REP-013). Sumar nuevos tipos de reporte requiere definición de UX y no es bloqueante |
| Métodos de pago — imputación por cierre de tarjeta, proyección de resúmenes, "cuándo cae el cobro" | En v1 el método de pago es metadato y los días de cierre/cobro son **informativos** (RN-021): no mueven el mes de imputación del gasto. Imputar el gasto de crédito al mes del resumen de la tarjeta, proyectar resúmenes y calcular cuándo cae el cobro quedan fuera de v1 (requieren flujo propio) |
| Edición retroactiva de mes pasado de un fijo | Complejidad en el modelo de datos |
| Cancelación parcial de cuotas restantes | Pendiente de definición |
| Ingreso en cuotas | Existe en la realidad; pendiente de definición |
| Multi-usuario (roles, workspaces) | Sin fecha |
| Importación desde extracto bancario | Sin decisión |
| Vista consolidada de movimientos fijos activos | Candidato para v2 como pantalla propia en el sidebar |
| Lista de últimos movimientos en el dashboard | El dashboard se limita a resumen financiero + acceso a carga (RF-DASH-001) |
| Recuperación de contraseña ("olvidé mi contraseña") | Requiere infraestructura de correo; diferida a post-v1 |
| Verificación de email | Requiere infraestructura de correo; diferida a post-v1 |
| Account linking (misma cuenta por Google y email/contraseña) | Pendiente sin resolver en v1; el caso de mismo email por ambos métodos no se resuelve |
