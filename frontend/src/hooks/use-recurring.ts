"use client";

/**
 * Hook de datos para movimientos fijos.
 * Wrapper fino sobre React Query + useApi (patrón de Fase 4).
 *
 * Expone:
 * - createRecurring(data): POST /recurring
 * - updateRecurring(id, data): PATCH /recurring/:id
 * - deleteRecurring(id, { currentMonth, fromCurrentMonth }): DELETE /recurring/:id
 *
 * Invalidación: un fijo afecta MUCHOS meses (startMonth en adelante), por lo que
 * se invalida TODA la familia de queries de movimientos usando el prefijo ["movements"].
 * Esto borra el caché de todos los meses y fuerza refetch al navegar.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import {
  type Recurring,
  type CreateRecurringRequest,
  type UpdateRecurringRequest,
  type SkipRecurringRequest,
  type SkipRecurringResponse,
} from "@/types/recurring";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useRecurring");

/** Prefijo de la familia de queries de movimientos — invalida todos los meses */
const MOVEMENTS_QUERY_PREFIX = ["movements"] as const;

// ─── Tipos de resultado ────────────────────────────────────────────────────────

export interface CreateRecurringResult {
  success: boolean;
  recurring?: Recurring;
  error?: string;
}

export interface UpdateRecurringResult {
  success: boolean;
  recurring?: Recurring;
  error?: string;
}

export interface DeleteRecurringResult {
  success: boolean;
  error?: string;
}

export interface SkipRecurringResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

// ─── Parámetros para eliminar ─────────────────────────────────────────────────

export interface DeleteRecurringParams {
  /** Mes actual en formato YYYY-MM */
  currentMonth: string;
  /**
   * true  → fromCurrentMonth="true"  → elimina desde el mes visualizado inclusive (RF-MF-004)
   * false → fromCurrentMonth="false" → elimina desde el mes siguiente
   */
  fromCurrentMonth: boolean;
}

// ─── Hook principal ────────────────────────────────────────────────────────────

/**
 * Hook con mutaciones create/update/delete para movimientos fijos.
 * La invalidación siempre invalida toda la familia ["movements"] porque
 * un cambio en un fijo puede afectar múltiples meses cacheados.
 */
export function useRecurring() {
  const { api } = useApi();
  const queryClient = useQueryClient();

  // ─── Mutation: crear fijo ──────────────────────────────────────────────────

  const createMutation = useMutation<Recurring, ApiError, CreateRecurringRequest>({
    mutationFn: (data) => api.post<Recurring>("/recurring", data),
    onSuccess: (recurring) => {
      // Invalida toda la familia de queries de movimientos (todos los meses cacheados)
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
      logger.info("Fijo creado", { id: recurring.id, startMonth: recurring.startMonth });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al crear fijo", { statusCode: err.statusCode });
      }
    },
  });

  async function createRecurring(data: CreateRecurringRequest): Promise<CreateRecurringResult> {
    try {
      const recurring = await createMutation.mutateAsync(data);
      return { success: true, recurring };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al crear fijo", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al guardar el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al crear fijo", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: editar fijo ─────────────────────────────────────────────────

  const updateMutation = useMutation<
    Recurring,
    ApiError,
    { id: string; data: UpdateRecurringRequest }
  >({
    mutationFn: ({ id, data }) => api.patch<Recurring>(`/recurring/${id}`, data),
    onSuccess: (recurring) => {
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
      logger.info("Fijo actualizado", { id: recurring.id });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al editar fijo", { statusCode: err.statusCode });
      }
    },
  });

  async function updateRecurring(
    id: string,
    data: UpdateRecurringRequest,
  ): Promise<UpdateRecurringResult> {
    try {
      const recurring = await updateMutation.mutateAsync({ id, data });
      return { success: true, recurring };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "El movimiento no existe o ya fue eliminado." };
        }
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al editar fijo", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al guardar el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al editar fijo", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: eliminar fijo ───────────────────────────────────────────────

  const deleteMutation = useMutation<void, ApiError, { id: string } & DeleteRecurringParams>({
    mutationFn: ({ id, currentMonth, fromCurrentMonth }) => {
      // fromCurrentMonth se envía como string literal "true"/"false" (contrato del backend)
      const params = new URLSearchParams({
        currentMonth,
        fromCurrentMonth: fromCurrentMonth ? "true" : "false",
      });
      return api.delete<void>(`/recurring/${id}?${params.toString()}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
      logger.info("Fijo eliminado");
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al eliminar fijo", { statusCode: err.statusCode });
      }
    },
  });

  async function deleteRecurring(
    id: string,
    params: DeleteRecurringParams,
  ): Promise<DeleteRecurringResult> {
    try {
      await deleteMutation.mutateAsync({ id, ...params });
      return { success: true };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "El movimiento no existe o ya fue eliminado." };
        }
        logger.error("Error al eliminar fijo", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al eliminar el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al eliminar fijo", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: toggle anular/des-anular fijo (P1 — Fase 1.1.1) ───────────

  const skipMutation = useMutation<
    SkipRecurringResponse,
    ApiError,
    { id: string; data: SkipRecurringRequest }
  >({
    mutationFn: ({ id, data }) =>
      api.post<SkipRecurringResponse>(`/recurring/${id}/skip`, data),
    onSuccess: (res) => {
      // Invalida toda la familia de queries de movimientos (todos los meses cacheados)
      // porque el skip afecta el total del mes consultado.
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
      logger.info("Toggle skip de fijo", { skipped: res.skipped, month: res.month });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al toggle skip de fijo", { statusCode: err.statusCode });
      }
    },
  });

  async function skipRecurring(
    id: string,
    month: string,
  ): Promise<SkipRecurringResult> {
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
        logger.error("Error al toggle skip de fijo", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al anular el movimiento. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al toggle skip de fijo", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  return {
    createRecurring,
    updateRecurring,
    deleteRecurring,
    skipRecurring,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSkipping: skipMutation.isPending,
  };
}
