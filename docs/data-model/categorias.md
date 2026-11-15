# Contrato de categorías

> Parte del modelo de datos de Control. Índice: `docs/data-model.md`. Reglas funcionales: módulo 3.6 (`docs/requirements/categorias.md`) y RN-007/008/013/014. Decisiones de modelado (soft delete, unicidad app-level, color elegible): `entidades.md`.

Toda respuesta exitosa de los endpoints de categorías devuelve, dentro del sobre `{ success, statusCode, data }`, este shape:

```
Categoria = {
  id: string,
  userId: string,
  name: string,                          // tal cual lo tipeó el usuario
  scope: "BOTH" | "EXPENSE" | "INCOME",
  color: string,                         // "#HEX" de la matriz, en mayúsculas; editable
  deletedAt: null,                       // las respuestas solo traen activas
  createdAt: string,
  updatedAt: string,
  movementCount: number
}
```

- **`movementCount` — derivado de solo lectura.** Es la suma de las **tres relaciones de movimiento** que referencian la categoría: movimientos únicos + fijos + grupos de cuotas. No es un campo almacenado ni editable; el backend lo calcula al responder. Cero si la categoría no tiene movimientos. Alimenta el contador "N movimientos" de la pantalla de categorías (RF-CAT-006) y **no** se confunde con los totales de dinero del mes (RF-VM-002).
- **`color` — editable, de la matriz.** `POST /categories` y `PATCH /categories/:id` aceptan `color?: string` **opcional**. Validación: debe **pertenecer a la matriz de 40** (case-insensitive; se **almacena en mayúsculas**); un color fuera de la matriz → **`400`**. En `POST`, si **no** llega `color`, el backend asigna el "menos usado" como **red de seguridad** — pero el frontend **siempre lo envía**. Detalle de la validación en `docs/backend/categorias.md` §Pool de colores.

### Payload reactivable en errores (409)

Cuando se intenta crear una categoría cuyo nombre normalizado colisiona con una **eliminada** (RF-CAT-002, A3), el backend responde `409` y adjunta, dentro del sobre de error, un `data` estructurado:

```
error.data = {
  reactivable: true,
  category: { id, name, scope, color }
}
```

- Es el **único** caso de categorías en que el sobre de error lleva `data` (métodos de pago usan el mismo patrón, ver `metodos-pago.md`). El front usa `category.id` para ofrecer reactivar (`POST /categories/:id/reactivate`) sin un endpoint extra de búsqueda. La colisión con una categoría **activa** (RN-008) responde `409` **sin** `data`.

### Matriz de colores (dato del dominio)

El set **elegible** por el usuario es una **matriz de 40 colores** (`COLOR_MATRIX`: 8 hues × 5 tonalidades), única en el backend. Los 8 hues son rojo, naranja, oro, verde, teal, azul, violeta y magenta; las 5 tonalidades van de L1 (clara) a L5 (oscura). El color **es editable** por el usuario, tanto al crear como al editar; solo se aceptan colores de la matriz (sin hex libre).

- **Pool base de 8 como base del "menos usado".** Los **8 colores base** (`COLOR_POOL`) son un **subconjunto explícito** de la matriz —uno por hue, en su fila vívida— dispuestos en un **orden propio salteado por la rueda cromática**, **no** una fila posicional de la matriz. Por eso el backend lo modela como un **array explícito**, no derivado por posición. Sobre esos 8 base se calcula el default "menos usado" al crear (regla en RN-013); las categorías por defecto del alta toman los primeros 4 en orden. Es solo un default: el usuario puede elegir cualquiera de los 40.
- El color es solo presentación. Detalle de `COLOR_MATRIX` / `COLOR_POOL` y la estrategia en `docs/backend/categorias.md` §Pool de colores.
- **GOTCHA ESTRUCTURAL — la matriz es el set ELEGIBLE en la UI, NO el universo de lo que existe en la base.** Hay categorías reales cuyo `color` **no pertenece** a `COLOR_MATRIX` (ejemplos: `#84A9D6`, `#E06B8B`, `#F1C4AE`, `#443458`, `#5BC4B8`); en una cuenta real, la mayoría de las categorías cae fuera de la matriz. **Ningún código puede asumir que `category.color` es un color de la matriz**: todo consumidor —paletas de gráficos, derivaciones de tinte, mapeos color → índice— tiene que funcionar con **cualquier hex**. Asumir pertenencia degrada silenciosamente (un mapeo que no matchea colapsa a un mismo valor y pinta toda una card de un solo color).
