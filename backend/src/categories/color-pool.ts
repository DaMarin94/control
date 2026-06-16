/**
 * Pool de colores para categorías (RF-CAT-005) y matriz elegible por el usuario.
 *
 * COLOR_MATRIX (70 colores, 7 filas × 10 columnas):
 *   Es la fuente de verdad de validación para la elección de color por el usuario.
 *   Solo se aceptan hex presentes en esta matriz; cualquier otro hex → 400.
 *   La fila T4 de la matriz ES COLOR_POOL (los 10 colores base, misma posición, mismo orden).
 *   Filas T1–T3 son variantes más claras; T5–T7 son variantes más oscuras.
 *
 * COLOR_POOL (10 colores = fila T4 de la matriz):
 *   Sigue siendo la base del cálculo de asignación automática de color.
 *   assignColor() opera exclusivamente sobre COLOR_POOL, no sobre los 70 colores.
 *
 * Estrategia de asignación automática (implementada en CategoriesService):
 *   Se elige el color del pool que esté MENOS usado entre las categorías ACTIVAS
 *   del usuario. Si hay empate, se elige el que aparece primero en el array (orden
 *   de definición). Si todos los colores ya están usados, se cicla eligiendo el de
 *   menor conteo (rotación determinística).
 *
 * Back-compat: los colores existentes en DB son todos de T4 (COLOR_POOL), por lo
 *   tanto ya pertenecen a la matriz — ninguna categoría preexistente queda inválida.
 */

/** Matriz completa elegible (70 colores). Fuente de verdad de validación de color. */
export const COLOR_MATRIX: readonly string[][] = [
  // T1 — variantes más claras
  ['#DCE7F4', '#F8E2D7', '#E0F1DE', '#ECE4F6', '#FBF3D1', '#D8F0ED', '#F8DEE7', '#E3E8F0', '#F0E0CD', '#DDF1E8'],
  // T2
  ['#B6CDE9', '#F1C4AE', '#C2E4BF', '#D6C6ED', '#F6E6A6', '#B2E2DB', '#F1BDCC', '#C8D1E1', '#E2C19C', '#BCE4D2'],
  // T3
  ['#84A9D6', '#E89E78', '#97D08F', '#BFA4E1', '#EFD56F', '#83D2C7', '#E893AB', '#A9B6CD', '#D29F66', '#9BD5B8'],
  // T4 — colores base (= COLOR_POOL, mismas posiciones)
  ['#4F86C6', '#E07B54', '#6DBF67', '#A98BD6', '#E8C84A', '#5BC4B8', '#E06B8B', '#8B9DBF', '#C47D3E', '#7DBF9E'],
  // T5
  ['#3E6BA3', '#BC6241', '#54A04E', '#8A6BB8', '#C2A52E', '#46A096', '#BD5572', '#71819F', '#A2632C', '#629E81'],
  // T6
  ['#2E5079', '#8E4A30', '#3E7739', '#674F89', '#917B1F', '#33766F', '#8C3F55', '#546077', '#794927', '#497660'],
  // T7 — variantes más oscuras
  ['#1F3551', '#5F311F', '#284E25', '#443458', '#5F5113', '#214E49', '#5D2A39', '#383F4F', '#502F19', '#304E40'],
] as const;

/**
 * Conjunto plano de todos los hex de la matriz (70 valores en mayúsculas).
 * Se construye una sola vez al cargar el módulo para O(1) en las validaciones.
 */
const COLOR_MATRIX_SET: ReadonlySet<string> = new Set(
  COLOR_MATRIX.flat(),
);

/**
 * Valida si un hex pertenece a la matriz elegible (COLOR_MATRIX).
 * La comparación es case-insensitive: normaliza a mayúsculas antes de buscar.
 *
 * @param color - string hex, ej. "#4f86c6" o "#4F86C6"
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

/** Pool de colores base para asignación automática (RF-CAT-005). Son la fila T4 de COLOR_MATRIX. */
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
