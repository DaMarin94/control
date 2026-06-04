# Backend

## Endpoints

<!-- Documentar todos los endpoints con su descripción, params, y comportamiento. -->
<!-- Formato sugerido:

### `GET /[recurso]`
Descripción de qué hace.
- **Params opcionales:** `?param=` — para qué sirve
- **Respuesta:** `[{ campo, tipo }]`

### `POST /[recurso]/:id`
Descripción.
-->

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Healthcheck |
| | | |

## Pipeline de datos

```
fetch([API externa])
  → filter([condición de validez])
  → map([normalización])
  → filter([condición de negocio])
  → sort([criterio])
```

## Cachés

| Cache | TTL | Descripción |
|-------|-----|-------------|
| `[nombre]` | [duración] | [qué cachea] |

<!-- Notas sobre la implementación del caché:
- In-flight deduplication: si dos requests llegan al mismo tiempo,
  solo se hace una llamada a la API externa.
-->

## Reglas de negocio y filtros

<!-- Documentar las reglas no obvias de filtrado, ordenamiento y procesamiento. -->
<!-- Ejemplo:
### Filtro de [entidad]
Una entidad pasa el filtro si cumple alguna de estas condiciones:
- [condición A]
- [condición B]
- [caso especial — por qué se incluye aunque parezca que no debería]

### Tiebreaker de [campo duplicado]
Cuando dos o más entidades comparten [campo], el orden es:
1. [criterio 1] descendente
2. [criterio 2] descendente
3. [criterio 3 opcional]
-->

## APIs externas

| API | URL | Uso |
|-----|-----|-----|
| [Nombre] | [URL estable] | [Para qué se usa] |

<!-- Documentar cualquier decisión sobre cómo consumir cada API externa:
- URL preferida (round-robin vs endpoint específico)
- Rate limits o consideraciones de uso
- Campos importantes del response
-->
