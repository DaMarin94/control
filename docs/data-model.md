# Data Model

## Tipos principales

<!-- Documentar los tipos de datos que viajan por el sistema. -->
<!-- Incluir: tipo crudo (de la API externa), tipo normalizado (interno), y tipos de UI. -->

### Tipo crudo (API externa)

```typescript
// Tal como viene de [API externa]
type [NombreCrudo] = {
  // campos relevantes
}
```

### Tipo normalizado (interno)

```typescript
// Normalizado por el backend, consumido por el frontend
type [NombreNormalizado] = {
  // campos internos
}
```

## Transformaciones

### Pipeline de normalización

```
[NombreCrudo] (API externa)
  → map[Entidad]()          // normaliza campos, fuerza https, formatea displayName
  → filter[Condicion]()     // descarta entradas sin [campo obligatorio]
  → sort[Criterio]()        // ordena por [criterio de negocio]
  → [NombreNormalizado][]   // lista lista para consumir
```

### Campos computados

<!-- Documentar campos que no vienen directamente de la API sino que se calculan. -->
<!-- Ejemplo:
- **`displayName`** — nombre formateado para mostrar en UI
- **`streamUrl`** — URL del stream forzada a HTTPS
-->

## Persistencia local

### Web (localStorage)

| Key | Tipo | TTL | Descripción |
|-----|------|-----|-------------|
| `[nombre]-cache` | `{ data: T[], timestamp: number }` | [X]h | Caché de [entidad] |

### Extensión (browser.storage.local)

| Key | Tipo | Descripción |
|-----|------|-------------|
| | | |

### Mobile (AsyncStorage)

| Key | Tipo | Descripción |
|-----|------|-------------|
| | | |

## Contratos de API

### Request / Response shapes

<!-- Documentar el shape exacto de cada endpoint, especialmente los campos que
     el frontend necesita para renderizar la UI. -->

```typescript
// GET /[endpoint]
// Response:
[NombreNormalizado][]
```
