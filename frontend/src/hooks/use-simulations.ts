"use client";

/**
 * Hooks de datos para la Simulación de categoría — /simulations (Módulo 3.15,
 * RF-SIM-001..004). Wrapper fino sobre React Query + useApi (patrón
 * establecido, docs/technical.md §Convenciones de hooks).
 *
 * Crear/eliminar una simulación afecta los movimientos simulados de TODOS los
 * meses futuros de su horizonte: se invalida la familia `["movements"]` por
 * prefijo (mismo patrón que `useRecurring` — un fijo también afecta muchos
 * meses a la vez). Ni crear ni eliminar generan entrada de historial
 * (RF-SIM-001/004) — la simulación de categoría queda entera fuera de
 * `/historial`, así que no hay `["history"]` que invalidar acá.
 *
 * Se manda `today=YYYY-MM-DD` (fecha local del navegador, NO UTC — ver
 * `getLocalTodayString` en `@/lib/format`) en GET /simulations, GET
 * /simulations/candidates y POST /simulations: los tres calculan/validan
 * contra `horizonEndMonth`/la ventana histórica (RN-028), y sin `today` el
 * backend cae a su propia fecha UTC — mismo desfase de mes que corrige
 * `today` en `use-movements.ts`.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import type {
  SimulationDto,
  SimulationsListResponse,
  SimulationCandidatesResponse,
} from "@/types/simulation";
import { createLogger } from "@/lib/logger";
import { getLocalTodayString } from "@/lib/format";

const logger = createLogger("useSimulations");

/**
 * Claves BASE (sin `today`) — son las que se usan para invalidar. `today` se
 * agrega como elemento adicional SOLO en la key real de cada query (abajo),
 * nunca acá: estas keys de 1/2 elementos deben seguir siendo un prefijo
 * válido de la key real para que `invalidateQueries` (que matchea por
 * prefijo) siga alcanzando la query tras crear/eliminar una simulación.
 */
export const SIMULATIONS_QUERY_KEY = ["simulations"] as const;
export const SIMULATION_CANDIDATES_QUERY_KEY = ["simulations", "candidates"] as const;

/** Prefijo de la familia de queries de movimientos — invalida todos los meses. */
const MOVEMENTS_QUERY_PREFIX = ["movements"] as const;

// ─── Query: simulaciones activas + horizonte vigente ───────────────────────────

/**
 * Simulaciones activas del usuario + horizonte vigente (banda del popover de Únicos,
 * §2/§4; también consumida por el chip "Simulados" de las cards de reporte, RF-REP-017,
 * para saber si hay al menos una simulación).
 *
 * @param enabled Gate adicional (default `true`), AND-eado con `isAuthenticated`. Permite
 *   a un consumidor que solo necesita el dato condicionalmente (ej. `ReportCard`, que no
 *   debe pedirlo desde el widget efímero del Dashboard) llamar el hook de forma incondicional
 *   (regla de hooks) sin disparar la query cuando no corresponde.
 */
export function useSimulations(enabled: boolean = true) {
  const { api, isAuthenticated } = useApi();
  const today = useMemo(() => getLocalTodayString(), []);

  return useQuery<SimulationsListResponse>({
    queryKey: [...SIMULATIONS_QUERY_KEY, today],
    queryFn: () => api.get<SimulationsListResponse>(`/simulations?today=${today}`),
    enabled: enabled && isAuthenticated,
  });
}

// ─── Query: candidatas del selector ────────────────────────────────────────────

/**
 * Universo de categorías activas con elegibilidad para simular (RF-SIM-001,
 * §3). Se pide solo mientras el modal "Simular categoría" está abierto
 * (`enabled`) — no hace falta mantenerlo cargado con el resto de `/mes`.
 */
export function useSimulationCandidates(enabled: boolean) {
  const { api, isAuthenticated } = useApi();
  const today = useMemo(() => getLocalTodayString(), []);

  return useQuery<SimulationCandidatesResponse>({
    queryKey: [...SIMULATION_CANDIDATES_QUERY_KEY, today],
    queryFn: () => api.get<SimulationCandidatesResponse>(`/simulations/candidates?today=${today}`),
    enabled: enabled && isAuthenticated,
  });
}

// ─── Mutation: crear simulación ─────────────────────────────────────────────────

export interface CreateSimulationResult {
  success: boolean;
  simulation?: SimulationDto;
  error?: string;
}

export function useCreateSimulation() {
  const { api } = useApi();
  const queryClient = useQueryClient();

  const mutation = useMutation<SimulationDto, ApiError, { categoryId: string }>({
    mutationFn: ({ categoryId }) => {
      const today = getLocalTodayString();
      return api.post<SimulationDto>(`/simulations?today=${today}`, { categoryId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SIMULATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: SIMULATION_CANDIDATES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al crear simulación", { statusCode: err.statusCode });
      }
    },
  });

  async function createSimulation(categoryId: string): Promise<CreateSimulationResult> {
    try {
      const simulation = await mutation.mutateAsync({ categoryId });
      return { success: true, simulation };
    } catch (err) {
      if (err instanceof ApiError) {
        // 400 (categoría inválida / <3 meses) y 409 (ya simulada) traen mensaje
        // ya legible del backend — el selector ya las ofrece deshabilitadas con
        // su motivo, así que esto solo cubre una carrera (candidatos stale).
        if (err.statusCode === 400 || err.statusCode === 409) {
          return { success: false, error: err.message };
        }
        logger.error("Error al crear simulación", { statusCode: err.statusCode });
        return { success: false, error: "No se pudo crear la simulación. Intentá de nuevo." };
      }
      logger.error("Error inesperado al crear simulación", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "No se pudo crear la simulación. Intentá de nuevo." };
    }
  }

  return { createSimulation, isCreating: mutation.isPending };
}

// ─── Mutation: eliminar simulación ─────────────────────────────────────────────

export interface DeleteSimulationResult {
  success: boolean;
  error?: string;
}

export function useDeleteSimulation() {
  const { api } = useApi();
  const queryClient = useQueryClient();

  const mutation = useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/simulations/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SIMULATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: SIMULATION_CANDIDATES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: MOVEMENTS_QUERY_PREFIX });
    },
    onError: (err) => {
      if (err.isServerError()) {
        logger.error("Error de servidor al eliminar simulación", { statusCode: err.statusCode });
      }
    },
  });

  async function deleteSimulation(id: string): Promise<DeleteSimulationResult> {
    try {
      await mutation.mutateAsync(id);
      return { success: true };
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          return { success: false, error: "La simulación no existe o ya fue eliminada." };
        }
        logger.error("Error al eliminar simulación", { statusCode: err.statusCode });
        return { success: false, error: "No se pudo eliminar la simulación. Intentá de nuevo." };
      }
      logger.error("Error inesperado al eliminar simulación", {
        error: err instanceof Error ? err.message : "desconocido",
      });
      return { success: false, error: "No se pudo eliminar la simulación. Intentá de nuevo." };
    }
  }

  return { deleteSimulation, isDeleting: mutation.isPending };
}
