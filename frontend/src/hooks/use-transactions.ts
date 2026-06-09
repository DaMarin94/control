"use client";

/**
 * Hook de datos para transacciones/movimientos.
 * Wrapper fino sobre React Query + useApi (patrón establecido en Fase 2/3).
 *
 * Query keys:
 *   - TRANSACTIONS_QUERY_KEY(month) = ["transactions", month]
 *     Donde month tiene formato "YYYY-MM".
 *
 * Expone:
 * - getTransactions(month, timezone): query por mes — lista para Fase 5
 * - createTransaction(data): crea un movimiento único
 * - updateTransaction({ id, data }): edita un movimiento existente
 * - deleteTransaction(id): elimina un movimiento (hard delete, permanente)
 *
 * Invalidación: tras crear/editar/eliminar se invalida la query del mes afectado.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import {
  type Transaction,
  type CreateTransactionRequest,
  type UpdateTransactionRequest,
  type GetTransactionsParams,
} from "@/types/transaction";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useTransactions");

// ─── Query keys ───────────────────────────────────────────────────────────────

/**
 * Query key para la lista de transacciones de un mes.
 * Fase 5 reutiliza esta misma función para compartir caché.
 */
export const TRANSACTIONS_QUERY_KEY = (month: string) =>
  ["transactions", month] as const;

// ─── Tipos de resultado de mutaciones ────────────────────────────────────────

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

// ─── Hook principal ────────────────────────────────────────────────────────────

/**
 * Hook con mutaciones create/update/delete.
 * La query GET por mes (para Fase 5) se expone via useTransactionsByMonth.
 */
export function useTransactions() {
  const { api } = useApi();
  const queryClient = useQueryClient();

  // ─── Mutation: crear transacción ───────────────────────────────────────────

  const createMutation = useMutation<Transaction, ApiError, CreateTransactionRequest>({
    mutationFn: (data) => api.post<Transaction>("/transactions", data),
    onSuccess: (transaction) => {
      // Invalida el mes de la transacción creada
      const month = transaction.occurredAt.substring(0, 7);
      void queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY(month) });
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
      void queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY(month) });
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
      void queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY(month) });
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

  return {
    createTransaction,
    updateTransaction,
    deleteTransaction,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// ─── Hook de query por mes (lista para Fase 5) ─────────────────────────────

/**
 * Hook para obtener la lista de transacciones de un mes.
 * Fase 5 usa este hook para cablear la Vista del mes.
 *
 * @param params.month - Formato YYYY-MM
 * @param params.timezone - Nombre de zona IANA
 */
export function useTransactionsByMonth(params: GetTransactionsParams) {
  const { api } = useApi();

  return useQuery<Transaction[]>({
    queryKey: TRANSACTIONS_QUERY_KEY(params.month),
    queryFn: () =>
      api.get<Transaction[]>(
        `/transactions?month=${params.month}&timezone=${encodeURIComponent(params.timezone)}`,
      ),
    enabled: Boolean(params.month && params.timezone),
  });
}
