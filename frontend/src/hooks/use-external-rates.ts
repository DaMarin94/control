"use client";

/**
 * Hook de datos para la sección "Datos externos" de /configuracion (General).
 *
 * GET  /settings/external-rates?ipcFrom=YYYY-MM → data: ExternalRatesSnapshot
 * POST /settings/external-rates/sync (sin body)  → data: SyncResult
 *
 * Responsabilidades:
 * - Cargar el snapshot (IPC + FX) con `enabled: isAuthenticated` (patrón estándar).
 * - "Ver meses anteriores" (§2.c del spec visual): re-pedir el GET con un
 *   `ipcFrom` un año anterior al `from` efectivo actual. El backend devuelve el
 *   historial COMPLETO en [ipcFrom, mes actual] (no incremental), así que
 *   "anexar" es simplemente reemplazar la data de la query por la respuesta
 *   más amplia — no hay merge manual de arrays.
 * - Sync + diff (GOTCHA): el backend NO señala "hubo cambios" — el
 *   upsert pisa `fetchedAt` en cada corrida exitosa aunque los valores no
 *   hayan cambiado (misma fuente, mismo mes). Por eso, tras el POST, se
 *   re-consulta el GET y se comparan los valores (ignorando `fetchedAt`/`source`)
 *   contra el snapshot previo para distinguir "cambió algo" de "ya estaba al día".
 */

import { useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { ApiError } from "@/types/api";
import type { ExternalRatesSnapshot, IpcEntry, FxEntry, SyncResult } from "@/types/external-rates";
import { createLogger } from "@/lib/logger";

const logger = createLogger("useExternalRates");

// ─── Query key ──────────────────────────────────────────────────────────────

export const EXTERNAL_RATES_QUERY_KEY = (ipcFrom?: string) =>
  ["external-rates", ipcFrom ?? null] as const;

// ─── Comparación de snapshots (ignora fetchedAt/source) ────────────────────

function ipcEntryEquals(a: IpcEntry | null, b: IpcEntry | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.yearMonth === b.yearMonth &&
    a.monthlyVariation === b.monthlyVariation &&
    a.indexValue === b.indexValue
  );
}

function fxEntryEquals(a: FxEntry | null, b: FxEntry | null): boolean {
  if (a === null || b === null) return a === b;
  return a.compra === b.compra && a.venta === b.venta;
}

/**
 * true si algún valor (no metadata) difiere entre dos snapshots.
 * Exportado para testing aislado.
 */
export function snapshotsDiffer(
  a: ExternalRatesSnapshot,
  b: ExternalRatesSnapshot,
): boolean {
  if (!ipcEntryEquals(a.ipc.latest, b.ipc.latest)) return true;
  if (a.ipc.history.length !== b.ipc.history.length) return true;
  for (let i = 0; i < a.ipc.history.length; i++) {
    if (!ipcEntryEquals(a.ipc.history[i], b.ipc.history[i])) return true;
  }
  if (!fxEntryEquals(a.fx.arsOficial, b.fx.arsOficial)) return true;
  if (!fxEntryEquals(a.fx.arsBlue, b.fx.arsBlue)) return true;
  if (!fxEntryEquals(a.fx.eur, b.fx.eur)) return true;
  if (!fxEntryEquals(a.fx.brl, b.fx.brl)) return true;
  return false;
}

// ─── Resultado de la acción de sync ────────────────────────────────────────

export interface SyncExternalRatesResult {
  /** "changed" = hubo valores nuevos; "unchanged" = ya estaba al día; "error" = falló. */
  outcome: "changed" | "unchanged" | "error";
}

// ─── Hook principal ─────────────────────────────────────────────────────────

export function useExternalRates() {
  const { api, isAuthenticated } = useApi();
  const queryClient = useQueryClient();

  // ipcFrom explícito solo cuando el usuario pidió "ver meses anteriores".
  // undefined = default del backend (enero del año en curso).
  const [ipcFrom, setIpcFrom] = useState<string | undefined>(undefined);
  const [isSyncing, setIsSyncing] = useState(false);

  function buildUrl(from: string | undefined): string {
    return `/settings/external-rates${from ? `?ipcFrom=${from}` : ""}`;
  }

  const query = useQuery<ExternalRatesSnapshot>({
    queryKey: EXTERNAL_RATES_QUERY_KEY(ipcFrom),
    queryFn: () => {
      logger.debug("Cargando datos externos", { ipcFrom });
      return api.get<ExternalRatesSnapshot>(buildUrl(ipcFrom));
    },
    enabled: isAuthenticated,
    // Al pedir meses anteriores, mantiene la data visible mientras refetcha
    // (el botón "Ver meses anteriores" es el único que muestra su propio loading).
    placeholderData: keepPreviousData,
  });

  /** Re-pide el historial de IPC extendido un año hacia atrás desde el `from` efectivo. */
  function loadOlderMonths(): void {
    const currentFrom = query.data?.ipc.from;
    if (!currentFrom) return;
    const year = Number(currentFrom.slice(0, 4));
    setIpcFrom(`${year - 1}-01`);
  }

  /**
   * Dispara POST /settings/external-rates/sync y re-consulta el snapshot para
   * determinar si hubo cambios reales (ver gotcha en el comentario de arriba).
   * No modifica el estado mostrado si el POST falla.
   */
  async function syncExternalRates(): Promise<SyncExternalRatesResult> {
    const previous = query.data;
    setIsSyncing(true);
    try {
      await api.post<SyncResult>("/settings/external-rates/sync", undefined);

      const fresh = await queryClient.fetchQuery<ExternalRatesSnapshot>({
        queryKey: EXTERNAL_RATES_QUERY_KEY(ipcFrom),
        queryFn: () => api.get<ExternalRatesSnapshot>(buildUrl(ipcFrom)),
      });

      const changed = !previous || snapshotsDiffer(previous, fresh);
      logger.info("Sync de datos externos completado", { changed });
      return { outcome: changed ? "changed" : "unchanged" };
    } catch (err) {
      if (err instanceof ApiError) {
        logger.error("Error al actualizar datos externos", {
          statusCode: err.statusCode,
          message: err.message,
        });
      } else {
        logger.error("Error inesperado al actualizar datos externos", {
          error: err instanceof Error ? err.message : "desconocido",
        });
      }
      return { outcome: "error" };
    } finally {
      setIsSyncing(false);
    }
  }

  return {
    /** undefined mientras carga la primera vez. */
    snapshot: query.data,
    /** true solo en la carga inicial (sin data previa cacheada para la key actual). */
    isLoading: query.isLoading,
    isError: query.isError,
    /** true mientras se cargan meses anteriores (placeholderData mantiene la lista visible). */
    isLoadingMore: query.isFetching && !query.isLoading,
    hasMore: query.data?.ipc.hasMore ?? false,
    loadOlderMonths,
    isSyncing,
    syncExternalRates,
  };
}
