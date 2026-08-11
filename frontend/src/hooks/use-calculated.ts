"use client";

/**
 * Hook de datos para movimientos calculados (Fase 1.1.7 — RF-MCALC-001..007;
 * Fase 1.1.8 — extendido a origen único y cuota).
 *
 * Expone:
 * - createCalculated(sourceId, data, sourceType): POST /:endpoint/:id/calculated
 * - updateCalculated(id, data, sourceType): PATCH /:endpoint/:id/calculated
 *
 * El endpoint varía según el tipo de origen:
 *   'fijo'  → /recurring/:id/calculated
 *   'unico' → /transactions/:id/calculated
 *   'cuota' → /installments/:id/calculated
 *
 * La eliminación de un calculado reutiliza deleteRecurring de use-recurring
 * (DELETE /recurring/:id — mismo endpoint independientemente del origen).
 *
 * Invalidación: invalida toda la familia ["movements"] por prefijo (un calculado
 * afecta múltiples meses, igual que un fijo).
 *
 * OJO: PATCH /recurring/:id (fijos normales) rechaza 400 si el id es un calculado.
 * Para editar un calculado usar SIEMPRE este hook (PATCH …/:id/calculated).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import type { FormulaOperator, MovementOrigin } from "@/types/movement";
import { createLogger } from "@/lib/logger";

// ─── Helper: resolución del endpoint según el tipo de origen ─────────────────

/**
 * Devuelve el prefijo de ruta base para los endpoints de calculado según el origen.
 *   'fijo'  → '/recurring'
 *   'unico' → '/transactions'
 *   'cuota' → '/installments'
 */
function calculatedEndpointPrefix(sourceType: MovementOrigin): string {
  switch (sourceType) {
    case "fijo":
      return "/recurring";
    case "unico":
      return "/transactions";
    case "cuota":
      return "/installments";
  }
}

const logger = createLogger("useCalculated");

/** Prefijo de la familia de queries de movimientos — invalida todos los meses */
const MOVEMENTS_QUERY_PREFIX = ["movements"] as const;

// ─── Tipos de contrato ────────────────────────────────────────────────────────

/**
 * Body de POST /recurring/:id/calculated (origen fijo).
 * :id = id de la fila activa del fijo de origen en el mes.
 *
 * formulaOperand está escalado (ver escala en types/movement.ts CalculatedInfo).
 * NOTA: `type` NO se envía — el backend lo deriva del signo del monto (RF-MCALC-003).
 */
export interface CreateCalculatedFromFixedRequest {
  categoryId: string;
  /** Mes de inicio en formato YYYY-MM — mes actual del navegador (solo para origen fijo) */
  startMonth: string;
  formulaOperator: FormulaOperator;
  /** Operando escalado según el operador (ver CalculatedInfo.formulaOperand) */
  formulaOperand: number;
  /** Signo del resultado: +1 o -1 */
  formulaSign: 1 | -1;
  description?: string;
}

/**
 * Body de POST /transactions/:id/calculated (origen único) o
 *             POST /installments/:id/calculated (origen cuota).
 *
 * Sin `startMonth` (no aplica a únicos ni cuotas — Fase 1.1.8).
 * NOTA: `type` NO se envía — el backend lo deriva del signo del monto (RF-MCALC-003).
 */
export interface CreateCalculatedFromNonFixedRequest {
  categoryId: string;
  formulaOperator: FormulaOperator;
  formulaOperand: number;
  formulaSign: 1 | -1;
  description?: string;
}

/**
 * Unión discriminada de los requests de creación según el tipo de origen.
 * El consumidor pasa el tipo adecuado según `sourceType`.
 */
export type CreateCalculatedRequest =
  | CreateCalculatedFromFixedRequest
  | CreateCalculatedFromNonFixedRequest;

/**
 * Body de PATCH /recurring/:id/calculated
 * currentMonth es REQUERIDO (para la lógica de split del backend).
 * NOTA: `type` NO se envía — el backend lo deriva del signo del monto (RF-MCALC-003).
 *
 * Mismo contrato para PATCH /transactions/:id/calculated y
 *                       PATCH /installments/:id/calculated.
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

/**
 * Respuesta de POST y PATCH /calculated — forma simplificada (el front solo
 * necesita id/chainId/historyEntryId; el resto de campos de Recurring quedan
 * en el índice, no se leen).
 *
 * chainId: siempre presente — el calculado ES una fila Recurring, cualquiera
 * sea el sourceType (fijo/único/cuota). Es la clave de agrupación de toasts
 * (RN-024) para PATCH — NUNCA usar `id`, cambia en cada split de edición.
 * historyEntryId: solo en PATCH (edición) — no en POST (crear no genera
 * entrada de historial).
 */
export interface CalculatedResponse {
  id: string;
  chainId: string;
  historyEntryId?: string;
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
  /** chainId del calculado — identidad de grupo estable para el toast de "Deshacer". */
  chainId?: string;
  /** Id de la entrada de historial creada — habilita el "Deshacer" del toast. */
  historyEntryId?: string;
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
    { sourceId: string; sourceType: MovementOrigin; data: CreateCalculatedRequest }
  >({
    mutationFn: ({ sourceId, sourceType, data }) => {
      const prefix = calculatedEndpointPrefix(sourceType);
      return api.post<CalculatedResponse>(`${prefix}/${sourceId}/calculated`, data);
    },
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
    sourceType: MovementOrigin = "fijo",
  ): Promise<CreateCalculatedResult> {
    try {
      const res = await createMutation.mutateAsync({ sourceId, sourceType, data });
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
    { id: string; sourceType: MovementOrigin; data: UpdateCalculatedRequest }
  >({
    mutationFn: ({ id, sourceType, data }) => {
      const prefix = calculatedEndpointPrefix(sourceType);
      return api.patch<CalculatedResponse>(`${prefix}/${id}/calculated`, data);
    },
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
    sourceType: MovementOrigin = "fijo",
  ): Promise<UpdateCalculatedResult> {
    try {
      const res = await updateMutation.mutateAsync({ id, sourceType, data });
      return { success: true, id: res.id, chainId: res.chainId, historyEntryId: res.historyEntryId };
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
