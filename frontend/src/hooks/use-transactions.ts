"use client";

/**
 * Hook de datos para transacciones/movimientos.
 * Wrapper fino sobre React Query + useApi (patrón establecido en Fase 2/3).
 *
 * Expone:
 * - createTransaction(data): crea un movimiento único
 * - updateTransaction(id, data): edita un movimiento existente
 * - deleteTransaction(id, month): elimina un movimiento (hard delete, permanente)
 * - skipTransaction(id, month): POST /transactions/:id/skip — toggle anular/des-anular (P3)
 *
 * Invalidación: tras crear/editar/eliminar/skip se invalida MOVEMENTS_QUERY_KEY(month)
 * (endpoint vigente desde Fase 5: GET /movements?month=YYYY-MM).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import {
  type Transaction,
  type CreateTransactionRequest,
  type UpdateTransactionRequest,
  type SkipTransactionResponse,
} from "@/types/transaction";
import { MOVEMENTS_QUERY_KEY } from "@/hooks/use-movements";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useTransactions");

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CreateTransactionResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
}

export interface UpdateTransactionResult {
  success: boolean;
  transaction?: Transaction;
  error?: string;
}

export interface DeleteTransactionResult {
  success: boolean;
  error?: string;
}

export interface SkipTransactionResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

// ─── Hook principal ────────────────────────────────────────────────────────────

/**
 * Hook con mutaciones create/update/delete.
 * La query GET por mes se hace via useMovements (use-movements.ts).
 */
export function useTransactions() {
  const { api } = useApi();
  const queryClient = useQueryClient();

  // ─── Mutation: crear transacción ───────────────────────────────────────────

  const createMutation = useMutation<Transaction, ApiError, CreateTransactionRequest>({
    mutationFn: (data) => api.post<Transaction>("/transactions", data),
    onSuccess: (transaction) => {
      const month = transaction.occurredAt.substring(0, 7);
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_KEY(month) });
      logger.info("Transacción creada", { id: transaction.id });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al crear transacción", { statusCode: err.statusCode });
      }
    },
  });

  async function createTransaction(
    data: CreateTransactionRequest,
  ): Promise<CreateTransactionResult> {
    try {
      const transaction = await createMutation.mutateAsync(data);
      return { success: true, transaction };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al crear transacción", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al guardar el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al crear transacción", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: editar transacción ──────────────────────────────────────────

  const updateMutation = useMutation<
    Transaction,
    ApiError,
    { id: string; data: UpdateTransactionRequest }
  >({
    mutationFn: ({ id, data }) => api.patch<Transaction>(`/transactions/${id}`, data),
    onSuccess: (transaction) => {
      const month = transaction.occurredAt.substring(0, 7);
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_KEY(month) });
      logger.info("Transacción actualizada", { id: transaction.id });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al editar transacción", { statusCode: err.statusCode });
      }
    },
  });

  async function updateTransaction(
    id: string,
    data: UpdateTransactionRequest,
  ): Promise<UpdateTransactionResult> {
    try {
      const transaction = await updateMutation.mutateAsync({ id, data });
      return { success: true, transaction };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "El movimiento no existe o ya fue eliminado." };
        }
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al editar transacción", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al guardar el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al editar transacción", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: eliminar transacción ───────────────────────────────────────

  const deleteMutation = useMutation<void, ApiError, { id: string; month: string }>({
    mutationFn: ({ id }) => api.delete<void>(`/transactions/${id}`),
    onSuccess: (_, { month }) => {
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_KEY(month) });
      logger.info("Transacción eliminada");
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al eliminar transacción", { statusCode: err.statusCode });
      }
    },
  });

  /**
   * Elimina una transacción (hard delete, permanente).
   * @param id - ID de la transacción
   * @param month - Mes en formato YYYY-MM para invalidar la query correspondiente
   */
  async function deleteTransaction(
    id: string,
    month: string,
  ): Promise<DeleteTransactionResult> {
    try {
      await deleteMutation.mutateAsync({ id, month });
      return { success: true };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "El movimiento no existe o ya fue eliminado." };
        }
        logger.error("Error al eliminar transacción", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al eliminar el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al eliminar transacción", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: toggle anular/des-anular único (P3) ────────────────────────

  const skipMutation = useMutation<SkipTransactionResponse, ApiError, { id: string }>({
    mutationFn: ({ id }) =>
      api.post<SkipTransactionResponse>(`/transactions/${id}/skip`, undefined),
    onSuccess: (_res, { id }) => {
      logger.info("Toggle skip de único", { id });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al toggle skip de único", { statusCode: err.statusCode });
      }
    },
  });

  /**
   * Anula/des-anula un movimiento único. Sin alcance temporal (a diferencia de
   * fijos/cuotas) — el endpoint no recibe body. `month` solo se usa para invalidar
   * la query del mes que se está visualizando.
   */
  async function skipTransaction(id: string, month: string): Promise<SkipTransactionResult> {
    try {
      const res = await skipMutation.mutateAsync({ id });
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_KEY(month) });
      return { success: true, skipped: res.skipped };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "El movimiento no existe o ya fue eliminado." };
        }
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al toggle skip de único", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al anular el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al toggle skip de único", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  return {
    createTransaction,
    updateTransaction,
    deleteTransaction,
    skipTransaction,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSkipping: skipMutation.isPending,
  };
}

