# Mobile

## Stack

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| Expo SDK | [versión] | Runtime managed |
| React Native | [versión] | Framework |
| React | [versión] | UI |
| TypeScript | strict | Lenguaje |
| NativeWind | v4 | Estilos (`className`) |
| [Lib de audio] | [versión] | Background audio |
| AsyncStorage | — | Persistencia local |

Target: iOS + Android.

## Alcance v1

<!-- Definir qué features entran en la primera versión de la app mobile. -->
<!-- Qué no entra en v1 (y por qué) también es importante de documentar. -->

## Arquitectura

### Entry y composición

```
index.ts      ← bootstrap: registerRootComponent + [servicios nativos]
App.tsx        ← UI raíz
```

### Audio en background

<!-- Documentar la estrategia de audio en background, lock screen controls, etc. -->
<!-- Ejemplo:
- **react-native-track-player v4**: background + controles en lock screen
- Requiere **development build** (`expo run:ios` / `expo run:android`) — NO funciona en Expo Go
- Config en `app.json`: iOS `UIBackgroundModes: ["audio"]`, Android `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
-->

### Wiring de @control/shared

- **Metro**: `watchFolders` + `extraNodeModules` + `resolveRequest` en `metro.config.js`
- **TypeScript**: path alias `@control/shared` en `tsconfig.json`
- **No romper este wiring** — es lo que permite usar los tipos y helpers compartidos

### Persistencia

<!-- Documentar qué se guarda en AsyncStorage y por qué. -->

## Reglas permanentes

<!-- Documentar reglas que no deben cambiar en mobile. -->
<!-- Ejemplo:
- **Sin slider de volumen in-app** — volumen vía botones físicos del teléfono
- **Paridad con web** — misma experiencia, mismo lenguaje visual
- **Background playback** — parte del core, no un extra
-->

## Estado actual

<!-- Describir en qué estado está la app mobile hoy (scaffold, features implementadas, pendientes). -->
