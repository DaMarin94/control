# Nuevo proyecto — Brief para Claude

> Completá este archivo y pegáselo a Claude Code.
> Claude va a generar el proyecto, correr el script, y rellenar toda la documentación.

---

## Nombre del proyecto
<!-- nombre en minúsculas, sin espacios (ej: podcast, mapa, turno) -->


## Qué es
<!-- 2-3 oraciones. Cuál es la interacción o metáfora central. Qué hace el usuario.  -->
<!-- Ej: "Simula una radio analógica con dial físico. El usuario mueve la sintonía   -->
<!--     y la app conecta con la emisora más cercana a esa frecuencia."              -->


## Qué NO es (anti-features)
<!-- Decisiones explícitas de lo que el producto no va a hacer.                      -->
<!-- Ej: "No es una lista de radios. No hay playlist ni buscador."                   -->


## Principios de diseño
<!-- Las 2-4 reglas que guían cada decisión de producto y UX.                        -->
<!-- Ej: "Simular el comportamiento de una radio física."                             -->
<!--     "La interacción táctil con el dial es el punto de entrada principal."       -->


## Para quién
<!-- Público objetivo y principio rector de UX (autoevidencia, onboarding, etc.)     -->


## Plataformas
<!-- Marcá las que aplican y su estado inicial                                        -->
- [ ] Web — estado: 
- [ ] Extensión (Chrome/Firefox) — estado: 
- [ ] Mobile (React Native + Expo) — estado: 

## Stack

- **Backend**: <!-- ej: Node.js + Express 5 + TypeScript, puerto 3000 -->
- **Frontend web**: <!-- ej: React 19 + Vite + Tailwind CSS v4, puerto 5173 -->
- **Mobile**: <!-- ej: Expo SDK 53 + NativeWind v4 (o "no aplica") -->

## APIs externas
<!-- Nombre, URL, y para qué se usa cada una                                         -->
<!-- Ej: "Radio Browser API (all.api.radio-browser.info) — fuente de streams"        -->


## Features principales (v1)
<!-- Lista de las features que tiene que tener la primera versión                     -->
<!-- Ej: "Dial de sintonía AM/FM, audio player, persistencia de última frecuencia"   -->


## Decisiones de diseño permanentes
<!-- Las cosas que "nunca se rompen". Si alguien las "arregla" sin saber, rompe el   -->
<!-- producto. Ej: "Usar siempre all.api.radio-browser.info (round-robin)."           -->
<!-- "Sin slider de volumen en mobile."                                               -->


## Deploy

- **Backend**: <!-- plataforma + URL de producción. Ej: Render — https://api.miapp.com -->
- **Frontend web**: <!-- plataforma + URL. Ej: Vercel — https://miapp.com -->
- **¿Hay staging?**: <!-- sí / no. Si sí, URL de staging -->
- **¿Deploy automático en push a main?**: <!-- sí / no -->
- **¿GitHub Actions CI?**: <!-- sí / no (si no, comentar los jobs en ci.yml) -->

## Repositorio

- **URL del repo**: <!-- ej: https://github.com/usuario/miapp (o "todavía no existe") -->
- **Rama principal**: <!-- main / master -->

## Contexto adicional
<!-- Cualquier otra cosa que Claude necesite saber: alcance geográfico, integración   -->
<!-- con otras apps, restricciones técnicas, decisiones pendientes, etc.              -->
