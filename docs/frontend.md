# Frontend

## Web

### Entry y composición

```
main.tsx           ← entry; carga temas, providers globales
App.tsx            ← raíz; compone el árbol de componentes principales
```

### Componentes principales

<!-- Documentar los componentes clave, su responsabilidad y props importantes. -->
<!-- Ejemplo:
- **`[Componente].tsx`** — [qué hace, cuándo se usa]
-->

### Hooks

<!-- Documentar los hooks personalizados, su estado y efectos secundarios. -->
<!-- Ejemplo:
- **`use[Nombre].ts`** — [qué maneja, qué retorna]
-->

### Persistencia (web)

<!-- Documentar qué se guarda en localStorage y por qué. -->
<!-- Ejemplo:
- `theme` — tema seleccionado
- `[entidad]-cache` — `{ data, timestamp }`, TTL [X]h
-->

### Temas

<!-- Documentar el sistema de temas si aplica. -->

---

## Extensión (Chrome MV3 / Firefox MV2)

<!-- Documentar la arquitectura de la extensión solo si el proyecto la incluye. -->

### Arquitectura de audio / estado

<!-- Documentar los mecanismos de IPC, reconciliación de estado, y persistencia
     específicos de la extensión. -->

### Mensajes IPC

| Mensaje | Dirección | Descripción |
|---------|-----------|-------------|
| | | |

### Persistencia (extensión)

<!-- Documentar qué se guarda en browser.storage.local -->

---

## @control/shared

<!-- Documentar qué tipos y helpers viven en shared y por qué. -->

| Export | Tipo | Descripción |
|--------|------|-------------|
| | | |

**Regla**: si lo necesitan dos o más de web / extension / mobile → va en shared.
**Restricción**: sin DOM ni framework (puro TS).
