"use client";

/**
 * Hook de datos para movimientos en cuotas.
 * Wrapper fino sobre React Query + useApi (patrón de Fases 4/6).
 *
 * Expone:
 * - createInstallment(data): POST /installments
 * - updateInstallment(id, data): PATCH /installments/:id
 * - deleteInstallment(id): DELETE /installments/:id (sin query params)
 * - skipInstallment(id, month): POST /installments/:id/skip — toggle anular/des-anular
 *   la instancia de ese mes (P3)
 *
 * Invalidación: una cuota afecta MUCHOS meses (startMonth hasta startMonth+N-1),
 * por lo que se invalida TODA la familia de queries de movimientos usando el
 * prefijo ["movements"]. Esto borra el caché de todos los meses y fuerza refetch.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import {
  type InstallmentGroup,
  type CreateInstallmentRequest,
  type UpdateInstallmentRequest,
  type SkipInstallmentRequest,
  type SkipInstallmentResponse,
} from "@/types/installment";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useInstallments");

/** Prefijo de la familia de queries de movimientos — invalida todos los meses */
const MOVEMENTS_QUERY_PREFIX = ["movements"] as const;

// ─── Tipos de resultado ────────────────────────────────────────────────────────

export interface CreateInstallmentResult {
  success: boolean;
  installment?: InstallmentGroup;
  error?: string;
}

export interface UpdateInstallmentResult {
  success: boolean;
  installment?: InstallmentGroup;
  error?: string;
}

export interface DeleteInstallmentResult {
  success: boolean;
  error?: string;
}

export interface SkipInstallmentResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

// ─── Hook principal ────────────────────────────────────────────────────────────

/**
 * Hook con mutaciones create/update/delete para grupos de cuotas.
 * La invalidación siempre invalida toda la familia ["movements"] porque
 * un cambio en un grupo puede afectar múltiples meses cacheados.
 */
export function useInstallments() {
  const { api } = useApi();
  const queryClient = useQueryClient();

  // ─── Mutation: crear grupo de cuotas ────────────────────────────────────────

  const createMutation = useMutation<InstallmentGroup, ApiError, CreateInstallmentRequest>({
    mutationFn: (data) => api.post<InstallmentGroup>("/installments", data),
    onSuccess: (installment) => {
      // Invalida toda la familia de queries de movimientos (todos los meses cacheados)
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
      logger.info("Grupo de cuotas creado", {
        id: installment.id,
        startMonth: installment.startMonth,
        totalInstallments: installment.totalInstallments,
      });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al crear cuotas", { statusCode: err.statusCode });
      }
    },
  });

  async function createInstallment(
    data: CreateInstallmentRequest,
  ): Promise<CreateInstallmentResult> {
    try {
      const installment = await createMutation.mutateAsync(data);
      return { success: true, installment };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al crear cuotas", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al guardar el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al crear cuotas", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: editar grupo de cuotas ─────────────────────────────────────

  const updateMutation = useMutation<
    InstallmentGroup,
    ApiError,
    { id: string; data: UpdateInstallmentRequest }
  >({
    mutationFn: ({ id, data }) => api.patch<InstallmentGroup>(`/installments/${id}`, data),
    onSuccess: (installment) => {
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
      logger.info("Grupo de cuotas actualizado", { id: installment.id });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al editar cuotas", { statusCode: err.statusCode });
      }
    },
  });

  async function updateInstallment(
    id: string,
    data: UpdateInstallmentRequest,
  ): Promise<UpdateInstallmentResult> {
    try {
      const installment = await updateMutation.mutateAsync({ id, data });
      return { success: true, installment };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "El movimiento no existe o ya fue eliminado." };
        }
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al editar cuotas", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al guardar el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al editar cuotas", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: eliminar grupo de cuotas ───────────────────────────────────

  const deleteMutation = useMutation<void, ApiError, { id: string }>({
    mutationFn: ({ id }) => api.delete<void>(`/installments/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
      logger.info("Grupo de cuotas eliminado");
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al eliminar cuotas", { statusCode: err.statusCode });
      }
    },
  });

  async function deleteInstallment(id: string): Promise<DeleteInstallmentResult> {
    try {
      await deleteMutation.mutateAsync({ id });
      return { success: true };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "El movimiento no existe o ya fue eliminado." };
        }
        logger.error("Error al eliminar cuotas", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al eliminar el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al eliminar cuotas", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: toggle anular/des-anular cuota (P3) ────────────────────────

  const skipMutation = useMutation<
    SkipInstallmentResponse,
    ApiError,
    { id: string; data: SkipInstallmentRequest }
  >({
    mutationFn: ({ id, data }) =>
      api.post<SkipInstallmentResponse>(`/installments/${id}/skip`, data),
    onSuccess: (res) => {
      // Invalida toda la familia de queries de movimientos (todos los meses cacheados)
      // porque el skip afecta el total del mes consultado.
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
      logger.info("Toggle skip de cuota", { skipped: res.skipped, month: res.month });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al toggle skip de cuota", { statusCode: err.statusCode });
      }
    },
  });

  async function skipInstallment(id: string, month: string): Promise<SkipInstallmentResult> {
    try {
      const res = await skipMutation.mutateAsync({ id, data: { month } });
      return { success: true, skipped: res.skipped };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "El movimiento no existe o ya fue eliminado." };
        }
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al toggle skip de cuota", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al anular el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al toggle skip de cuota", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  return {
    createInstallment,
    updateInstallment,
    deleteInstallment,
    skipInstallment,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSkipping: skipMutation.isPending,
  };
}
