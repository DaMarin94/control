"use client";

/**
 * Sección "Datos externos" de /configuracion — dentro de General, debajo de
 * la tarjeta "Moneda por defecto" (decisión cerrada: NO es una ruta/nav
 * nueva, ver settings-client.tsx).
 *
 * Spec visual: docs/design.md §"Sección 'Datos externos' de /configuracion —
 * ver y actualizar inflación (IPC) + cotizaciones" (§1 a §8 + checklist).
 * Reutilización total, cero token nuevo: `.card` del DS, jerarquía de cabecera
 * nivel 2 del hub, botón `RefreshCw` (mismo patrón que el refrescar de
 * reportes), `SkeletonPill`/`SkeletonLine`, patrón de error inline de la
 * card de Moneda, y las reglas duras de cifra (mono tabular, neutralidad).
 *
 * Estructura:
 *   1. Cabecera de sección (h2 + bajada + botón "Actualizar datos", outline).
 *   2. Card "Inflación (IPC)" — destacado (último dato) + historial del año +
 *      "Ver meses anteriores" (anexa hacia atrás, re-pidiendo el GET con un
 *      `ipcFrom` anterior — el backend devuelve el historial completo, no
 *      incremental, así que "anexar" = reemplazar por la respuesta más amplia).
 *   3. Card "Cotizaciones" — grilla 2×2 (Dólar oficial · Dólar blue · Euro · Real).
 *   4. Pie discreto — última actualización + fuentes.
 *
 * Feedback de "Actualizar datos" por TOAST (§4): éxito con cambios / sin
 * novedades (info) / error. La distinción "cambió" vs "ya estaba al día" la
 * resuelve el hook `useExternalRates` (el backend no la señala — ver gotcha
 * en use-external-rates.ts).
 */

import { RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkeletonLine, SkeletonPill } from "@/components/ui/skeleton";
import { useExternalRates } from "@/hooks/use-external-rates";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  formatMonthLabel,
  formatExchangeRate,
  formatDateTimeShort,
  getBrowserTimezone,
} from "@/lib/format";
import type { ExternalRatesSnapshot, FxEntry } from "@/types/external-rates";

// ─── Helpers de formato locales ────────────────────────────────────────────

/** "junio 2026" (formatMonthLabel) → "Junio 2026" — mismo patrón que /mes. */
function capitalize(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** 1.58 → "1,58%" (puntos porcentuales, sin signo forzado — cifra neutra). */
function formatIpcVariation(value: number): string {
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted}%`;
}

// ─── Card "Inflación (IPC)" ────────────────────────────────────────────────

interface InflationCardProps {
  snapshot: ExternalRatesSnapshot | undefined;
  isLoading: boolean;
  isError: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  currentYear: number;
}

function InflationCard({
  snapshot,
  isLoading,
  isError,
  isLoadingMore,
  hasMore,
  onLoadMore,
  currentYear,
}: InflationCardProps) {
  if (isError) {
    return (
      <div
        className="rounded-[14px] border border-line bg-panel shadow-[var(--shadow-sm)]"
        style={{ padding: "var(--card-pad)" }}
      >
        <p className="text-[13px] text-expense-ink">
          No se pudieron cargar los datos externos. Recargá la página.
        </p>
      </div>
    );
  }

  const latest = snapshot?.ipc.latest ?? null;
  const historyRows = snapshot
    ? snapshot.ipc.history.filter((entry) => entry.yearMonth !== latest?.yearMonth)
    : [];

  return (
    <div
      className="rounded-[14px] border border-line bg-panel shadow-[var(--shadow-sm)]"
      style={{ padding: "var(--card-pad)" }}
    >
      {/* Destacado — último dato */}
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">
            Último dato
          </p>
          {isLoading ? (
            <div className="mt-[2px]">
              <SkeletonLine height={14.5} width={120} />
            </div>
          ) : (
            <p className="text-[14.5px] font-semibold text-ink mt-[2px]">
              {latest ? capitalize(formatMonthLabel(latest.yearMonth)) : "—"}
            </p>
          )}
          <p className="text-[12.5px] font-medium text-muted mt-[2px]">Variación mensual</p>
        </div>
        <div className="shrink-0">
          {isLoading ? (
            <SkeletonPill height={24} width={80} />
          ) : (
            <p className="mono text-[22px] font-semibold text-ink leading-none">
              {latest ? formatIpcVariation(latest.monthlyVariation) : "—"}
            </p>
          )}
        </div>
      </div>

      {/* Historial del año en curso */}
      <div className="mt-4 border-t border-hair pt-4">
        {isLoading ? (
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-[10px] border-b border-hair last:border-b-0"
              >
                <SkeletonPill height={14} width={90} />
                <SkeletonPill height={14} width={44} />
              </div>
            ))}
          </div>
        ) : historyRows.length === 0 ? (
          <p className="text-[12.5px] font-medium text-muted text-center">
            Todavía no hay más datos de {currentYear}.
          </p>
        ) : (
          <ul role="list">
            {historyRows.map((entry) => (
              <li
                key={entry.yearMonth}
                className="flex items-center justify-between py-[10px] border-b border-hair last:border-b-0"
              >
                <span className="text-[13px] font-medium text-ink-2">
                  {capitalize(formatMonthLabel(entry.yearMonth))}
                </span>
                <span className="mono text-[13px] font-medium text-ink-2">
                  {formatIpcVariation(entry.monthlyVariation)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ver meses anteriores — se desmonta cuando no hay más historial */}
      {!isLoading && hasMore && (
        <div className="mt-4 border-t border-hair pt-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            aria-busy={isLoadingMore}
            className="flex w-full items-center justify-center gap-1.5 rounded-ctl py-2.5 text-[13px] font-semibold text-ink-2 transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] disabled:opacity-60"
          >
            {isLoadingMore ? "Cargando…" : "Ver meses anteriores"}
            {isLoadingMore ? (
              <RefreshCw size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <ChevronDown size={14} aria-hidden="true" className="text-muted" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Card "Cotizaciones" ────────────────────────────────────────────────────

interface QuoteTile {
  label: string;
  entry: FxEntry | null | undefined;
}

interface QuotesCardProps {
  snapshot: ExternalRatesSnapshot | undefined;
  isLoading: boolean;
  isError: boolean;
}

function QuotesCard({ snapshot, isLoading, isError }: QuotesCardProps) {
  if (isError) {
    return (
      <div
        className="rounded-[14px] border border-line bg-panel shadow-[var(--shadow-sm)]"
        style={{ padding: "var(--card-pad)" }}
      >
        <p className="text-[13px] text-expense-ink">
          No se pudieron cargar los datos externos. Recargá la página.
        </p>
      </div>
    );
  }

  // Orden fijo: Dólar oficial · Dólar blue (fila 1), Euro · Real (fila 2)
  const tiles: QuoteTile[] = [
    { label: "Dólar oficial", entry: snapshot?.fx.arsOficial },
    { label: "Dólar blue", entry: snapshot?.fx.arsBlue },
    { label: "Euro", entry: snapshot?.fx.eur },
    { label: "Real", entry: snapshot?.fx.brl },
  ];

  return (
    <div
      className="rounded-[14px] border border-line bg-panel shadow-[var(--shadow-sm)]"
      style={{ padding: "var(--card-pad)" }}
    >
      <div className="mb-4">
        <p className="text-[14.5px] font-semibold text-ink">Cotizaciones</p>
        <p className="text-[12.5px] font-medium text-muted mt-[2px]">Valores del mes en curso.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex min-w-0 flex-col gap-1 rounded-[var(--r-ctl)] border border-line bg-panel-2 px-3.5 py-3"
          >
            <span className="text-[12.5px] font-medium text-muted">{tile.label}</span>
            {isLoading ? (
              <SkeletonPill height={18} width={90} />
            ) : tile.entry ? (
              <span className="mono text-[16px] font-semibold text-ink">
                ${formatExchangeRate(tile.entry.venta)}
              </span>
            ) : (
              <span className="mono text-[16px] text-faint">—</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pie discreto ───────────────────────────────────────────────────────────

function ExternalRatesFooter({ snapshot }: { snapshot: ExternalRatesSnapshot | undefined }) {
  if (!snapshot) return null;

  const timestamps = [
    snapshot.ipc.latest?.fetchedAt,
    snapshot.fx.arsOficial?.fetchedAt,
    snapshot.fx.arsBlue?.fetchedAt,
    snapshot.fx.eur?.fetchedAt,
    snapshot.fx.brl?.fetchedAt,
  ].filter((v): v is string => Boolean(v));

  // ISO 8601 UTC ordena correctamente como string — no hace falta parsear a Date.
  const lastUpdated =
    timestamps.length > 0 ? timestamps.reduce((a, b) => (b > a ? b : a)) : null;

  const lastUpdatedLabel = lastUpdated
    ? formatDateTimeShort(lastUpdated, getBrowserTimezone())
    : "—";

  return (
    <p className="mt-1 text-[12px] font-medium text-muted">
      Última actualización: {lastUpdatedLabel} · Fuentes: INDEC (inflación) · dolarapi (dólar) ·
      frankfurter (euro, real).
    </p>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────

export function ExternalRatesSection() {
  const { toast } = useToast();
  const {
    snapshot,
    isLoading,
    isError,
    isLoadingMore,
    hasMore,
    loadOlderMonths,
    isSyncing,
    syncExternalRates,
  } = useExternalRates();

  async function handleRefresh() {
    const result = await syncExternalRates();
    if (result.outcome === "changed") {
      toast.success("Datos actualizados.");
    } else if (result.outcome === "unchanged") {
      toast.info("Ya estás al día. No había datos nuevos.");
    } else {
      toast.error("No se pudieron actualizar los datos. Intentá de nuevo.");
    }
  }

  const currentYear = snapshot?.fx.month
    ? Number(snapshot.fx.month.slice(0, 4))
    : new Date().getFullYear();

  return (
    <div>
      {/* Cabecera de sección (nivel 2 del hub, docs/design.md §1) */}
      <div className="flex items-center justify-between gap-5 flex-wrap mb-4">
        <div>
          <h2 className="text-[18px] font-bold tracking-[-0.01em] text-ink">Datos externos</h2>
          <p className="text-[13px] font-medium text-muted mt-[3px]">
            Inflación y cotizaciones que Control usa para convertir y ajustar tus montos.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleRefresh}
          disabled={isLoading || isSyncing}
          aria-label="Actualizar datos externos"
          aria-busy={isSyncing}
          className="disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            aria-hidden="true"
            className={cn(isSyncing && "animate-spin motion-reduce:animate-none")}
          />
          {isSyncing ? "Actualizando…" : "Actualizar datos"}
        </Button>
      </div>

      {/* Dos cards apiladas */}
      <div
        className="space-y-4"
        role={isLoading ? "status" : undefined}
        aria-label={isLoading ? "Cargando datos externos" : undefined}
      >
        <InflationCard
          snapshot={snapshot}
          isLoading={isLoading}
          isError={isError}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          onLoadMore={loadOlderMonths}
          currentYear={currentYear}
        />
        <QuotesCard snapshot={snapshot} isLoading={isLoading} isError={isError} />
      </div>

      {/* Pie discreto */}
      <ExternalRatesFooter snapshot={snapshot} />
    </div>
  );
}
