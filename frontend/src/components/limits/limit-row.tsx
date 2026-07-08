"use client";

/**
 * LimitRow — fila de la lista de límites (docs/design.md §"Panel de gestión de
 * límites" → 2. "Solapa Límites — encabezado y lista"). Dos zonas, espejo de la
 * sublínea del ítem de /mes: identidad (izquierda) · estados/acciones (derecha).
 *
 * P2 — Fase 2: la lista ahora puede incluir límites `nature: "active"` (sin
 * `effect` ni `temporalScope`, D20). El identificador de efecto se reemplaza
 * por un glifo ámbar de aviso (misma familia visual que el diálogo de la
 * activa) y el chip de alcance temporal se reemplaza por un chip "Alerta
 * activa". No hay spec formal de `control-design` para este caso todavía —
 * se resuelve con el molde de chip existente (mismo `--r-chip`/`--panel-3`),
 * sin cromo nuevo; a confirmar si amerita spec propia.
 */

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LimitConfig, LimitSectionRefinement } from "@/types/limit";
import { getAnchorDef, formatCondition, deriveLimitLabel } from "@/lib/limits/catalog";
import { LimitEffectPreview } from "@/components/limits/limit-effect-picker";

const SECTION_LABELS: Record<LimitSectionRefinement, string> = {
  unicos: "Únicos",
  fijos: "Fijos",
  cuotas: "Cuotas",
};

export interface LimitRowProps {
  limit: LimitConfig;
  /** Nombre de la categoría del refinamiento, resuelto por el padre (LimitsTab). */
  categoryName?: string;
  onToggleEnabled: (enabled: boolean) => void;
  onRemove: () => void;
}

export function LimitRow({ limit, categoryName, onToggleEnabled, onRemove }: LimitRowProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const anchorDef = getAnchorDef(limit.anchorKey);
  const label = limit.label ?? deriveLimitLabel(limit.anchorKey, limit.operator, limit.threshold);

  const metaParts = [anchorDef?.label ?? limit.anchorKey];
  if (limit.refinement?.section) metaParts.push(SECTION_LABELS[limit.refinement.section]);
  if (limit.refinement?.categoryId) metaParts.push(categoryName ?? "Categoría");

  const conditionChip = anchorDef
    ? formatCondition(anchorDef.unit, limit.operator, limit.threshold)
    : `${limit.operator} ${limit.threshold}`;

  const isActive = limit.nature === "active";
  const effect = limit.effect ?? anchorDef?.defaultEffect ?? "glyph";

  return (
    <div
      className={cn("flex items-center justify-between gap-6", !limit.enabled && "opacity-[0.55]")}
      style={{ padding: "var(--row-pad) 22px" }}
    >
      {/* Zona identidad (izquierda, flex-1) */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[8px]">
          {isActive ? (
            <AlertTriangle size={13} aria-hidden="true" style={{ color: "var(--warning-ink)" }} />
          ) : (
            <LimitEffectPreview effect={effect} />
          )}
          <b className="text-[14.5px] font-semibold text-ink truncate">{label}</b>
        </div>
        <div className="flex items-center gap-[8px] mt-[2px] flex-wrap">
          <span className="text-[12.5px] font-medium text-muted">{metaParts.join(" · ")}</span>
          <span className="inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-ink-2 px-[7px] py-[1px] text-[12px] font-semibold mono tabular-nums">
            {conditionChip}
          </span>
          <span className="inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em]">
            {isActive ? "Alerta activa" : limit.temporalScope === "all" ? "Todos los meses" : "Mes en curso"}
          </span>
        </div>
      </div>

      {/* Zona estados/acciones (derecha, shrink-0) */}
      <div className="flex items-center gap-[10px] shrink-0">
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] text-muted whitespace-nowrap">¿Eliminar?</span>
            <Button type="button" size="sm" variant="destructive" onClick={onRemove}>
              Eliminar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <>
            {/* Toggle enabled */}
            <button
              type="button"
              role="switch"
              aria-checked={limit.enabled}
              aria-label={`Activar límite: ${label}`}
              onClick={() => onToggleEnabled(!limit.enabled)}
              className="relative inline-flex h-[22px] w-[38px] items-center rounded-pill transition-colors duration-[140ms] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
              style={{ backgroundColor: limit.enabled ? "var(--accent)" : "var(--panel-3)" }}
            >
              <span
                aria-hidden="true"
                className="inline-block h-[18px] w-[18px] rounded-full bg-panel shadow-[var(--shadow-sm)] transition-transform duration-[140ms] motion-reduce:transition-none"
                style={{ transform: limit.enabled ? "translateX(18px)" : "translateX(2px)" }}
              />
            </button>

            {/* Eliminar — confirmación inline */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Eliminar límite: ${label}`}
              onClick={() => setConfirmingDelete(true)}
              className="text-muted hover:text-expense-ink"
            >
              <Trash2 size={16} aria-hidden="true" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
