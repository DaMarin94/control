"use client";

/**
 * Hook de datos para los límites del usuario (P2 — Fase 1, marca visual pasiva).
 *
 * Análogo a los helpers de CRUD de `reports` en /reportes: lee `preferences.limits`
 * y expone mutaciones que hacen el patrón read-modify-write del blob completo
 * (merge manual sobre `usePreferences().setPreferences` — la semántica del backend
 * es reemplazo total, ver docs/frontend.md §Preferencias de usuario).
 *
 * v1 (D8): crear, eliminar y alternar `enabled`. SIN editar la key/refinamiento/
 * umbral de un límite existente — para cambiarlo, se borra y se crea de nuevo.
 */

import { usePreferences } from "@/hooks/use-preferences";
import type { LimitConfig } from "@/types/limit";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useLimits");

/** Datos de un límite nuevo — todo el shape de LimitConfig salvo `id`/`enabled` (los pone el hook). */
export type CreateLimitInput = Omit<LimitConfig, "id" | "enabled">;

export interface LimitMutationResult {
  success: boolean;
  error?: string;
}

/** Id local del límite — mismo patrón que generateCardId() de /reportes. */
function generateLimitId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `limit-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useLimits() {
  const { preferences, setPreferences, isLoading, isSaving } = usePreferences();

  const limits: LimitConfig[] = Array.isArray(preferences.limits) ? preferences.limits : [];

  /** Crea un límite nuevo (enabled=true por default) y lo agrega al final del array. */
  async function create(input: CreateLimitInput): Promise<LimitMutationResult> {
    const newLimit: LimitConfig = {
      ...input,
      id: generateLimitId(),
      enabled: true,
    };
    const newLimits = [...limits, newLimit];
    const result = await setPreferences({ ...preferences, limits: newLimits });
    if (!result.success) {
      logger.error("Error al crear límite", { error: result.error });
      return { success: false, error: result.error };
    }
    return { success: true };
  }

  /** Quita un límite del array por id. */
  async function remove(id: string): Promise<LimitMutationResult> {
    const newLimits = limits.filter((limit) => limit.id !== id);
    const result = await setPreferences({ ...preferences, limits: newLimits });
    if (!result.success) {
      logger.error("Error al eliminar límite", { error: result.error, limitId: id });
      return { success: false, error: result.error };
    }
    return { success: true };
  }

  /**
   * Alterna `enabled` de un límite existente sin borrarlo (D8: el toggle NO es
   * "editar" — la key/refinamiento/umbral quedan intactos).
   */
  async function setEnabled(id: string, enabled: boolean): Promise<LimitMutationResult> {
    const newLimits = limits.map((limit) => (limit.id === id ? { ...limit, enabled } : limit));
    const result = await setPreferences({ ...preferences, limits: newLimits });
    if (!result.success) {
      logger.error("Error al cambiar enabled de límite", { error: result.error, limitId: id });
      return { success: false, error: result.error };
    }
    return { success: true };
  }

  return {
    /** Array de límites del usuario. [] si no hay ninguno configurado. */
    limits,
    isLoading,
    isSaving,
    create,
    remove,
    setEnabled,
  };
}
