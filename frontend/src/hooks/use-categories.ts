"use client";

/**
 * Hook de datos para categorías.
 * Wrapper fino sobre React Query + useApi (patrón establecido en Fase 2).
 *
 * Query key: ['categories'] — se invalida tras crear, editar, eliminar o reactivar.
 *
 * Expone:
 * - categories: Category[] | undefined
 * - isLoading, isError, error
 * - createCategory(data): maneja 409 colisión activa y 409 reactivable
 * - updateCategory({ id, data })
 * - deleteCategory(id)
 * - reactivateCategory(id)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import {
  type Category,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
  isReactivableError,
} from "@/types/category";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useCategories");

export const CATEGORIES_QUERY_KEY = ["categories"] as const;

// ─── Tipos de resultado de mutaciones ────────────────────────────────────────

export interface CreateCategoryResult {
  success: boolean;
  /** Categoría creada (solo en éxito) */
  category?: Category;
  /** Error de colisión con categoría activa: mostrar en el form */
  nameConflict?: boolean;
  /** Datos para el prompt de reactivación */
  reactivable?: {
    id: string;
    name: string;
    scope: string;
    color: string;
  };
  /** Error genérico (servidor/red) */
  error?: string;
}

export interface UpdateCategoryResult {
  success: boolean;
  category?: Category;
  /** Error de colisión con otra categoría activa */
  nameConflict?: boolean;
  error?: string;
}

export interface DeleteCategoryResult {
  success: boolean;
  error?: string;
}

export interface ReactivateCategoryResult {
  success: boolean;
  category?: Category;
  error?: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCategories() {
  const { api } = useApi();
  const queryClient = useQueryClient();

  // ─── Query: listar categorías activas ──────────────────────────────────────

  const {
    data: categories,
    isLoading,
    isError,
    error,
  } = useQuery<Category[]>({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: () => api.get<Category[]>("/categories"),
  });

  // ─── Mutation: crear categoría ─────────────────────────────────────────────

  const createMutation = useMutation<Category, ApiError, CreateCategoryRequest>({
    mutationFn: (data) => api.post<Category>("/categories", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
    onError: (err) => {
      // Solo loggear errores de servidor; los de cliente (409/400) los maneja el llamador
      if (err.isServerError()) {
        logger.error("Error de servidor al crear categoría", { statusCode: err.statusCode });
      }
    },
  });

  async function createCategory(data: CreateCategoryRequest): Promise<CreateCategoryResult> {
    try {
      const category = await createMutation.mutateAsync(data);
      return { success: true, category };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          // Discriminar por error.data: si tiene reactivable → prompt de reactivación
          if (isReactivableError(err.data)) {
            return {
              success: false,
              reactivable: err.data.category,
            };
          }
          // Sin error.data → colisión con categoría activa
          return { success: false, nameConflict: true };
        }
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al crear categoría", { statusCode: err.statusCode });
        return { success: false, error: "Ocurrió un error al crear la categoría. Intentalo de nuevo." };
      }
      logger.error("Error inesperado al crear categoría", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: editar categoría ────────────────────────────────────────────

  const updateMutation = useMutation<Category, ApiError, { id: string; data: UpdateCategoryRequest }>({
    mutationFn: ({ id, data }) => api.patch<Category>(`/categories/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al editar categoría", { statusCode: err.statusCode });
      }
    },
  });

  async function updateCategory(id: string, data: UpdateCategoryRequest): Promise<UpdateCategoryResult> {
    try {
      const category = await updateMutation.mutateAsync({ id, data });
      return { success: true, category };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          return { success: false, nameConflict: true };
        }
        if (err.statusCode === 404) {
          return { success: false, error: "La categoría no existe o fue eliminada." };
        }
        if (err.statusCode === 400) {
          return { success: false, error: err.message };
        }
        logger.error("Error al editar categoría", { statusCode: err.statusCode });
        return { success: false, error: "Ocurrió un error al editar la categoría. Intentalo de nuevo." };
      }
      logger.error("Error inesperado al editar categoría", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: eliminar categoría ──────────────────────────────────────────

  const deleteMutation = useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al eliminar categoría", { statusCode: err.statusCode });
      }
    },
  });

  async function deleteCategory(id: string): Promise<DeleteCategoryResult> {
    try {
      await deleteMutation.mutateAsync(id);
      return { success: true };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "La categoría no existe o ya fue eliminada." };
        }
        logger.error("Error al eliminar categoría", { statusCode: err.statusCode });
        return { success: false, error: "Ocurrió un error al eliminar la categoría. Intentalo de nuevo." };
      }
      logger.error("Error inesperado al eliminar categoría", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  // ─── Mutation: reactivar categoría ─────────────────────────────────────────

  const reactivateMutation = useMutation<Category, ApiError, string>({
    mutationFn: (id) => api.post<Category>(`/categories/${id}/reactivate`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al reactivar categoría", { statusCode: err.statusCode });
      }
    },
  });

  async function reactivateCategory(id: string): Promise<ReactivateCategoryResult> {
    try {
      const category = await reactivateMutation.mutateAsync(id);
      return { success: true, category };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "La categoría no existe o ya estaba activa." };
        }
        if (err.statusCode === 409) {
          return { success: false, error: err.message };
        }
        logger.error("Error al reactivar categoría", { statusCode: err.statusCode });
        return { success: false, error: "Ocurrió un error al reactivar la categoría. Intentalo de nuevo." };
      }
      logger.error("Error inesperado al reactivar categoría", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "Ocurrió un error inesperado. Intentalo de nuevo." };
    }
  }

  return {
    categories,
    isLoading,
    isError,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    reactivateCategory,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isReactivating: reactivateMutation.isPending,
  };
}
