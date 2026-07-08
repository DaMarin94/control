"use client";

/**
 * Hook de datos para la proyección de límites ACTIVOS (P2 — Fase 2).
 *
 * Combina los límites del usuario (`useLimits`) con los movimientos crudos del
 * MES DESTINO (`useMovements` — la MISMA fuente que ya alimenta `/mes` y el
 * dashboard; no se inventa un fetch nuevo) y expone una función pura de
 * evaluación que los 3 forms de carga (único/fijo/cuota) llaman antes de
 * persistir (D11).
 *
 * D13 (mes de proyección) lo resuelve el LLAMADOR: pasa el mes correcto según
 * el tipo de movimiento (único → su propio mes; fijo/cuota → el mes en curso
 * real) como `projectionMonth`.
 *
 * Falla ABIERTO: si los movimientos del mes destino todavía no resolvieron
 * (`data` undefined — loading o error), `evaluate` devuelve `[]`. La alerta
 * activa es advisory (D10, no bloquea); nunca debe trabar un guardado
 * legítimo por latencia de red en un mes recién visitado.
 */

import { useMovements } from "@/hooks/use-movements";
import { useLimits } from "@/hooks/use-limits";
import { projectActiveLimitCrossings, type ProjectedMovement } from "@/lib/limits/project";
import type { LimitConfig } from "@/types/limit";

export function useActiveLimitProjection(projectionMonth: string) {
  const { limits } = useLimits();
  const { data } = useMovements(projectionMonth);

  function evaluate(movement: ProjectedMovement): LimitConfig[] {
    if (!data) return [];
    return projectActiveLimitCrossings(movement, data.movements, limits);
  }

  return { evaluate };
}
