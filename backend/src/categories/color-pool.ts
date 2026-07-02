/**
 * Pool de colores para categorías (RF-CAT-005) y matriz elegible por el usuario.
 *
 * COLOR_MATRIX (40 colores, 5 filas × 8 columnas):
 *   Es la fuente de verdad de validación para la elección de color por el usuario.
 *   Solo se aceptan hex presentes en esta matriz; cualquier otro hex → 400.
 *   Filas L1 (clara) → L5 (oscura). Columnas C1→C8 = rojo, naranja, oro, verde,
 *   teal, azul, violeta, magenta (un hue por columna). L3 es la fila base (vívida).
 *
 * COLOR_POOL (8 colores = subset base):
 *   Es la base del cálculo de asignación automática de color.
 *   assignColor() opera exclusivamente sobre COLOR_POOL, no sobre los 40 colores.
 *   Los 8 hex son los de la fila L3, pero reordenados (no es un slice posicional
 *   de la fila): el orden salta por la rueda de hues para que las primeras
 *   categorías creadas queden lo más separadas posible entre sí.
 *
 * Estrategia de asignación automática (implementada en CategoriesService):
 *   Se elige el color del pool que esté MENOS usado entre las categorías ACTIVAS
 *   del usuario. Si hay empate, se elige el que aparece primero en el array (orden
 *   de definición). Si todos los colores ya están usados, se cicla eligiendo el de
 *   menor conteo (rotación determinística).
 */

/** Matriz completa elegible (40 colores). Fuente de verdad de validación de color. */
export const COLOR_MATRIX: readonly string[][] = [
  // L1 — variantes más claras
  ['#F7C8C8', '#F9DDC8', '#F7EBC5', '#C6E6D1', '#BFE6E9', '#C8DBF6', '#DFCEF3', '#F4CCE4'],
  // L2
  ['#EE8D8D', '#F2B98D', '#EFD686', '#8ACB9F', '#7ACBD1', '#8DB4ED', '#BC99E6', '#E996C7'],
  // L3 — fila base (vívida)
  ['#E23B3B', '#E8863A', '#E3B92E', '#35A65A', '#1AA5B0', '#3B7DE0', '#8B4FD4', '#D94A9E'],
  // L4
  ['#9E2929', '#A25E29', '#9F8220', '#25743F', '#12747B', '#29589D', '#613794', '#98346F'],
  // L5 — variantes más oscuras
  ['#6C1C1C', '#6F401C', '#6D5916', '#19502B', '#0C4F54', '#1C3C6C', '#432666', '#68244C'],
] as const;

/**
 * Conjunto plano de todos los hex de la matriz (40 valores en mayúsculas).
 * Se construye una sola vez al cargar el módulo para O(1) en las validaciones.
 */
const COLOR_MATRIX_SET: ReadonlySet<string> = new Set(
  COLOR_MATRIX.flat(),
);

/**
 * Valida si un hex pertenece a la matriz elegible (COLOR_MATRIX).
 * La comparación es case-insensitive: normaliza a mayúsculas antes de buscar.
 *
 * @param color - string hex, ej. "#e23b3b" o "#E23B3B"
 * @returns true si el color pertenece a la matriz; false en caso contrario
 */
export function isValidCategoryColor(color: string): boolean {
  return COLOR_MATRIX_SET.has(color.toUpperCase());
}

/**
 * Normaliza un hex a mayúsculas (formato canónico del proyecto).
 * Solo normaliza el case; no valida si es un hex válido.
 */
export function normalizeColorHex(color: string): string {
  return color.toUpperCase();
}

/**
 * Pool de colores base para asignación automática (RF-CAT-005).
 * Son los 8 hex de la fila L3 de COLOR_MATRIX, reordenados salteando la rueda
 * de hues (rojo, teal, oro, violeta, naranja, azul, verde, magenta) para
 * maximizar la separación perceptual entre las primeras categorías asignadas.
 */
export const COLOR_POOL: readonly string[] = [
  '#E23B3B', // rojo
  '#1AA5B0', // teal
  '#E3B92E', // oro
  '#8B4FD4', // violeta
  '#E8863A', // naranja
  '#3B7DE0', // azul
  '#35A65A', // verde
  '#D94A9E', // magenta
] as const;
