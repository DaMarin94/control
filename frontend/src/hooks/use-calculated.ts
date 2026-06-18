"use client";

/**
 * Hook de datos para movimientos calculados (Fase 1.1.7 — RF-MCALC-001..007).
 *
 * Expone:
 * - createCalculated(sourceId, data): POST /recurring/:id/calculated
 * - updateCalculated(id, data): PATCH /recurring/:id/calculated
 *
 * La eliminación de un calculado reutiliza deleteRecurring de use-recurring
 * (DELETE /recurring/:id — mismo endpoint que fijos normales).
 *
 * Invalidación: invalida toda la familia ["movements"] por prefijo (un calculado
 * afecta múltiples meses, igual que un fijo).
 *
 * OJO: PATCH /recurring/:id (fijos normales) rechaza 400 si el id es un calculado.
 * Para editar un calculado usar SIEMPRE este hook (PATCH /recurring/:id/calculated).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import type { FormulaOperator } from "@/types/movement";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useCalculated");

/** Prefijo de la familia de queries de movimientos — invalida todos los meses */
const MOVEMENTS_QUERY_PREFIX = ["movements"] as const;

// ─── Tipos de contrato ────────────────────────────────────────────────────────

/**
 * Body de POST /recurring/:id/calculated
 * :id = id de la fila activa del fijo de origen en el mes.
 *
 * formulaOperand está escalado (ver escala en types/movement.ts CalculatedInfo).
 * NOTA: `type` NO se envía — el backend lo deriva del signo del monto (RF-MCALC-003).
 */
export interface CreateCalculatedRequest {
  categoryId: string;
  /** Mes de inicio en formato YYYY-MM — mes actual del navegador */
  startMonth: string;
  formulaOperator: FormulaOperator;
  /** Operando escalado según el operador (ver CalculatedInfo.formulaOperand) */
  formulaOperand: number;
  /** Signo del resultado: +1 o -1 */
  formulaSign: 1 | -1;
  description?: string;
}

/**
 * Body de PATCH /recurring/:id/calculated
 * currentMonth es REQUERIDO (para la lógica de split del backend).
 * NOTA: `type` NO se envía — el backend lo deriva del signo del monto (RF-MCALC-003).
 */
export interface UpdateCalculatedRequest {
  /** Mes actual/visualizado en formato YYYY-MM (requerido por el backend para el split) */
  currentMonth: string;
  categoryId?: string;
  description?: string | null;
  formulaOperator?: FormulaOperator;
  formulaOperand?: number;
  formulaSign?: 1 | -1;
}

/** Respuesta de POST y PATCH /calculated — forma simplificada (el front solo necesita el id) */
export interface CalculatedResponse {
  id: string;
  [key: string]: unknown;
}

// ─── Tipos de resultado ────────────────────────────────────────────────────────

export interface CreateCalculatedResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface UpdateCalculatedResult {
  success: boolean;
  id?: string;
  error?: string;
}

// ─── Hook principal ────────────────────────────────────────────────────────────

export function useCalculated() {
  const { api } = useApi();
  const queryClient = useQueryClient();

  // ─── Mutation: crear calculado ─────────────────────────────────────────────

  const createMutation = useMutation<
    CalculatedResponse,
    ApiError,
    { sourceId: string; data: CreateCalculatedRequest }
  >({
    mutationFn: ({ sourceId, data }) =>
      api.post<CalculatedResponse>(`/recurring/${sourceId}/calculated`, data),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
      logger.info("Calculado creado", { id: res.id });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al crear calculado", { statusCode: err.statusCode });
      }
    },
  });

  async function createCalculated(
    sourceId: string,
    data: CreateCalculatedRequest,
  ): Promise<CreateCalculatedResult> {
    try {
      const res = await createMutation.mutateAsync({ sourceId, data });
      return { success: true, id: res.id };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        if (err.statusCode === 404) {
          return { success: false, error: "El movimiento de origen no existe o ya fue eliminado." };
        }
        logger.error("Error al crear calculado", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al guardar el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al crear calculado", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: editar calculado ────────────────────────────────────────────

  const updateMutation = useMutation<
    CalculatedResponse,
    ApiError,
    { id: string; data: UpdateCalculatedRequest }
  >({
    mutationFn: ({ id, data }) =>
      api.patch<CalculatedResponse>(`/recurring/${id}/calculated`, data),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
      logger.info("Calculado actualizado", { id: res.id });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al editar calculado", { statusCode: err.statusCode });
      }
    },
  });

  async function updateCalculated(
    id: string,
    data: UpdateCalculatedRequest,
  ): Promise<UpdateCalculatedResult> {
    try {
      const res = await updateMutation.mutateAsync({ id, data });
      return { success: true, id: res.id };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "El movimiento no existe o ya fue eliminado." };
        }
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al editar calculado", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al guardar el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al editar calculado", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  return {
    createCalculated,
    updateCalculated,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
