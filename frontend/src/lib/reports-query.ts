import type { Query } from "@tanstack/react-query";

/**
 * Predicado de invalidación para TODAS las queries de reportes. Sus keys no
 * cuelgan de un único prefijo (`reports`, `reports-unico-grid`,
 * `reports-fixed-evolution`, …), por eso se compara por prefijo del primer segmento.
 */
export function isReportsQuery(query: Query): boolean {
  return String(query.queryKey[0]).startsWith("reports");
}
