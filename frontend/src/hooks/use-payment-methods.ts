"use client";

/**
 * Hook de datos para métodos de pago.
 * Wrapper fino sobre React Query + useApi. Espejo de use-categories.ts.
 *
 * Query key: ['paymentMethods'] — se invalida tras crear, editar, eliminar o reactivar.
 * Además se invalida la familia ["movements"] (por prefijo): el ítem de un movimiento
 * embebe { id, name, icon, type } del método asociado (RF-PM-006), así que un cambio
 * de nombre/ícono/tipo debe reflejarse también en la Vista del mes.
 *
 * Expone:
 * - paymentMethods: PaymentMethod[] | undefined
 * - isLoading, isError, error
 * - createPaymentMethod(data): maneja 409 colisión activa y 409 reactivable
 * - updatePaymentMethod(id, data)
 * - deletePaymentMethod(id)
 * - reactivatePaymentMethod(id)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import {
  type PaymentMethod,
  type CreatePaymentMethodRequest,
  type UpdatePaymentMethodRequest,
  isReactivablePaymentMethodError,
} from "@/types/payment-method";
import { createLogger } from "@/lib/logger";

const logger = createLogger("usePaymentMethods");

export const PAYMENT_METHODS_QUERY_KEY = ["paymentMethods"] as const;

/** Prefijo de la familia de queries de movimientos — el ítem embebe el método */
const MOVEMENTS_QUERY_PREFIX = ["movements"] as const;

// ─── Tipos de resultado de mutaciones ────────────────────────────────────────

export interface CreatePaymentMethodResult {
  success: boolean;
  /** Método de pago creado (solo en éxito) */
  paymentMethod?: PaymentMethod;
  /** Error de colisión con método activo: mostrar en el form */
  nameConflict?: boolean;
  /** Datos para el prompt de reactivación */
  reactivable?: {
    id: string;
    name: string;
    type: string;
    icon: string;
  };
  /** Error genérico (servidor/red) */
  error?: string;
}

export interface UpdatePaymentMethodResult {
  success: boolean;
  paymentMethod?: PaymentMethod;
  /** Error de colisión con otro método activo */
  nameConflict?: boolean;
  error?: string;
}

export interface DeletePaymentMethodResult {
  success: boolean;
  error?: string;
}

export interface ReactivatePaymentMethodResult {
  success: boolean;
  paymentMethod?: PaymentMethod;
  error?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePaymentMethods() {
  const { api, isAuthenticated } = useApi();
  const queryClient = useQueryClient();

  // ─── Query: listar métodos de pago activos ─────────────────────────────────

  const {
    data: paymentMethods,
    isLoading,
    isError,
    error,
  } = useQuery<PaymentMethod[]>({
    queryKey: PAYMENT_METHODS_QUERY_KEY,
    queryFn: () => api.get<PaymentMethod[]>("/payment-methods"),
    // No disparar hasta que la sesión resolvió y el token está presente;
    // evita 401 espurios en el primer render cuando status === "loading".
    enabled: isAuthenticated,
  });

  function invalidateAfterMutation() {
    void queryClient.invalidateQueries({ queryKey: PAYMENT_METHODS_QUERY_KEY });
    // El ítem de movimiento embebe { id, name, icon, type } del método (RF-PM-006).
    void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
  }

  // ─── Mutation: crear método de pago ────────────────────────────────────────

  const createMutation = useMutation<PaymentMethod, ApiError, CreatePaymentMethodRequest>({
    mutationFn: (data) => api.post<PaymentMethod>("/payment-methods", data),
    onSuccess: () => {
      invalidateAfterMutation();
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al crear método de pago", { statusCode: err.statusCode });
      }
    },
  });

  async function createPaymentMethod(
    data: CreatePaymentMethodRequest,
  ): Promise<CreatePaymentMethodResult> {
    try {
      const paymentMethod = await createMutation.mutateAsync(data);
      return { success: true, paymentMethod };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          // Discriminar por error.data: si tiene reactivable → prompt de reactivación
          if (isReactivablePaymentMethodError(err.data)) {
            return {
              success: false,
              reactivable: err.data.paymentMethod,
            };
          }
          // Sin error.data → colisión con método activo
          return { success: false, nameConflict: true };
        }
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al crear método de pago", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al crear el método de pago. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al crear método de pago", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: editar método de pago ───────────────────────────────────────

  const updateMutation = useMutation<
    PaymentMethod,
    ApiError,
    { id: string; data: UpdatePaymentMethodRequest }
  >({
    mutationFn: ({ id, data }) => api.patch<PaymentMethod>(`/payment-methods/${id}`, data),
    onSuccess: () => {
      invalidateAfterMutation();
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al editar método de pago", { statusCode: err.statusCode });
      }
    },
  });

  async function updatePaymentMethod(
    id: string,
    data: UpdatePaymentMethodRequest,
  ): Promise<UpdatePaymentMethodResult> {
    try {
      const paymentMethod = await updateMutation.mutateAsync({ id, data });
      return { success: true, paymentMethod };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          return { success: false, nameConflict: true };
        }
        if (err.statusCode === 404) {
          return { success: false, error: "El método de pago no existe o fue eliminado." };
        }
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al editar método de pago", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al editar el método de pago. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al editar método de pago", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: eliminar método de pago ─────────────────────────────────────

  const deleteMutation = useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/payment-methods/${id}`),
    onSuccess: () => {
      invalidateAfterMutation();
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al eliminar método de pago", { statusCode: err.statusCode });
      }
    },
  });

  async function deletePaymentMethod(id: string): Promise<DeletePaymentMethodResult> {
    try {
      await deleteMutation.mutateAsync(id);
      return { success: true };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "El método de pago no existe o ya fue eliminado." };
        }
        logger.error("Error al eliminar método de pago", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al eliminar el método de pago. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al eliminar método de pago", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: reactivar método de pago ────────────────────────────────────

  const reactivateMutation = useMutation<PaymentMethod, ApiError, string>({
    mutationFn: (id) => api.post<PaymentMethod>(`/payment-methods/${id}/reactivate`, {}),
    onSuccess: () => {
      invalidateAfterMutation();
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al reactivar método de pago", { statusCode: err.statusCode });
      }
    },
  });

  async function reactivatePaymentMethod(id: string): Promise<ReactivatePaymentMethodResult> {
    try {
      const paymentMethod = await reactivateMutation.mutateAsync(id);
      return { success: true, paymentMethod };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "El método de pago no existe o ya estaba activo." };
        }
        if (err.statusCode === 409) {
          return { success: false, error: err.message };
        }
        logger.error("Error al reactivar método de pago", { statusCode: err.statusCode });
        return {
          success: false,
          error: "Ocurrió un error al reactivar el método de pago. Intentalo de nuevo.",
        };
      }
      logger.error("Error inesperado al reactivar método de pago", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  return {
    paymentMethods,
    isLoading,
    isError,
    error,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    reactivatePaymentMethod,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isReactivating: reactivateMutation.isPending,
  };
}
