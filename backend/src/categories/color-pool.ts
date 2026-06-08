/**
 * Pool de colores para categorías (RF-CAT-005).
 *
 * Fuente única de colores predefinidos usada por CategoriesService y AuthService.
 * Los 4 primeros son los colores que las categorías por defecto (RF-CAT-001)
 * tenían como "provisorios" en Fase 2 — ahora son parte del pool oficial.
 *
 * Estrategia de asignación automática (implementada en CategoriesService):
 *   Se elige el color del pool que esté MENOS usado entre las categorías ACTIVAS
 *   del usuario. Si hay empate, se elige el que aparece primero en el array (orden
 *   de definición). Si todos los colores ya están usados, se cicla eligiendo el de
 *   menor conteo (rotación determinística).
 */
export const COLOR_POOL: readonly string[] = [
  '#4F86C6', // azul
  '#E07B54', // naranja
  '#6DBF67', // verde
  '#A98BD6', // violeta
  '#E8C84A', // amarillo
  '#5BC4B8', // turquesa
  '#E06B8B', // rosa
  '#8B9DBF', // azul grisáceo
  '#C47D3E', // marrón
  '#7DBF9E', // verde menta
] as const;
