"use client";

/**
 * LimitsInfoPopover — ícono `Info` + popover de solo lectura que lista los
 * límites que observan una superficie dada (P2 — Popover informativo de
 * límites por superficie). Spec visual: docs/design.md
 * §"Popover informativo de límites por superficie (Límites y Alertas — P2)".
 *
 * Es SOLO LECTURA: no marca, no evalúa ni avisa — únicamente enumera qué
 * límites observan esta superficie, agrupados por naturaleza ("Marcan un
 * dato" / "Avisan al guardar", este último solo en `/mes`).
 *
 * El ícono se monta solo si hay ≥1 límite (habilitado o no) para `surface`
 * (regla dura del subsistema — sin config, sin hueco reservado). Ese chequeo
 * lo resuelve el propio componente (retorna `null`).
 *
 * Dashboard: el componente NO tiene forma de distinguir "Dashboard" de
 * "/reportes" a partir de `surface` (el widget income-expense efímero del
 * Dashboard usa la misma surface `reporte-income-expense` que la card real de
 * /reportes) — la asimetría deliberada de la spec (nunca en el Dashboard) la
 * resuelve el LLAMADOR no montando `<LimitsInfoPopover />` en esa rama.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { useLimits } from "@/hooks/use-limits";
import { useCategories } from "@/hooks/use-categories";
import { getAnchorDef, formatCondition, type LimitSurface } from "@/lib/limits/catalog";
import type { LimitConfig, LimitSectionRefinement } from "@/types/limit";
import { cn } from "@/lib/utils";

const SECTION_LABELS: Record<LimitSectionRefinement, string> = {
  unicos: "Únicos",
  fijos: "Fijos",
  cuotas: "Cuotas",
};

/** Delay de intención de hover en desktop (spec §4: "~150ms de intención"). */
const HOVER_OPEN_DELAY = 150;
/** Gracia corta antes de cerrar por mouseleave (spec §4: "una gracia corta"). */
const HOVER_CLOSE_GRACE = 150;

const VIEWPORT_MARGIN = 12;
const POPOVER_GAP = 6;

// ─── Hover-capable (puntero fino / hover-capable) ─────────────────────────────

function useHoverCapable(): boolean {
  const [hoverCapable, setHoverCapable] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setHoverCapable(mq.matches);
    const handler = (e: MediaQueryListEvent) => setHoverCapable(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return hoverCapable;
}

// ─── Ítem del listado ──────────────────────────────────────────────────────────

interface LimitItemViewProps {
  limit: LimitConfig;
  categoryName?: string;
  categoryColor?: string;
}

function LimitItemView({ limit, categoryName, categoryColor }: LimitItemViewProps) {
  const anchorDef = getAnchorDef(limit.anchorKey);
  const anchorLabel = anchorDef?.label ?? limit.anchorKey;
  const hasOwnLabel = !!limit.label;

  // Línea 1 — nombre: label propio o rótulo del anclaje; refinamiento de
  // sección se incorpora en texto; refinamiento de categoría antecede con
  // punto de color + nombre de categoría (spec §3).
  let nameText = limit.label ?? anchorLabel;
  if (limit.refinement?.section) {
    nameText = `${nameText} · ${SECTION_LABELS[limit.refinement.section]}`;
  }
  const hasCategoryDot = !!limit.refinement?.categoryId && !!categoryName;
  const displayName = hasCategoryDot ? `${categoryName} · ${nameText}` : nameText;

  // Línea 2 — condición, con rótulo del anclaje como contexto solo si línea 1
  // es un label propio del usuario (spec §3).
  const condition = anchorDef
    ? formatCondition(anchorDef.unit, limit.operator, limit.threshold)
    : `${limit.operator} ${limit.threshold}`;
  const contextPrefix = hasOwnLabel ? `${anchorLabel} · ` : "";

  const showQualifier = limit.nature === "passive" && limit.temporalScope === "current";

  return (
    <div
      role="listitem"
      className={cn(
        "px-[10px] py-[6px] rounded-[var(--r-chip)]",
        !limit.enabled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-[6px] min-w-0">
        {hasCategoryDot && (
          <span
            aria-hidden="true"
            className="shrink-0 rounded-full"
            style={{ width: 6, height: 6, background: categoryColor ?? "var(--faint)" }}
          />
        )}
        <span
          title={displayName}
          className="flex-1 min-w-0 truncate text-[13px] font-medium text-ink"
        >
          {displayName}
        </span>
        {!limit.enabled && (
          <span className="shrink-0 text-[11px] font-medium text-faint">Desactivado</span>
        )}
      </div>
      <div className="mt-[1px] truncate text-[12px] text-muted">
        {contextPrefix}
        <span className="mono">{condition}</span>
        {showQualifier && (
          <>
            {" "}
            <span className="text-faint">·</span>{" "}
            <span className="text-[11px] font-medium text-faint">Solo mes en curso</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Grupo por naturaleza ──────────────────────────────────────────────────────

interface LimitsGroupProps {
  title: string;
  items: LimitConfig[];
  categoryNameById: Map<string, string>;
  categoryColorById: Map<string, string>;
  withDividerBefore: boolean;
}

function LimitsGroup({
  title,
  items,
  categoryNameById,
  categoryColorById,
  withDividerBefore,
}: LimitsGroupProps) {
  if (items.length === 0) return null;
  return (
    <div>
      {withDividerBefore && <div aria-hidden="true" className="h-px bg-hair" />}
      <div className="px-[10px] pt-[8px] pb-[3px] text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
        {title}
      </div>
      <div role="list">
        {items.map((limit) => (
          <LimitItemView
            key={limit.id}
            limit={limit}
            categoryName={
              limit.refinement?.categoryId ? categoryNameById.get(limit.refinement.categoryId) : undefined
            }
            categoryColor={
              limit.refinement?.categoryId ? categoryColorById.get(limit.refinement.categoryId) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

// ─── Panel (portal + posicionamiento + cierre) ────────────────────────────────

interface LimitsInfoPanelProps {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  caption: string;
  ariaLabel: string;
  passiveLimits: LimitConfig[];
  activeLimits: LimitConfig[];
  categoryNameById: Map<string, string>;
  categoryColorById: Map<string, string>;
}

function LimitsInfoPanel({
  triggerRef,
  onClose,
  onMouseEnter,
  onMouseLeave,
  caption,
  ariaLabel,
  passiveLimits,
  activeLimits,
  categoryNameById,
  categoryColorById,
}: LimitsInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top?: number; bottom?: number; left: number; flipUp: boolean }>({
    left: 0,
    flipUp: false,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Posición: ancla al borde del disparador, crece hacia abajo (flip arriba si
  // no hay lugar) y clampea horizontal a 12px del borde (spec §4/§5).
  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelEl = panelRef.current;
    const panelHeight = panelEl ? panelEl.getBoundingClientRect().height : 200;
    const panelWidth = panelEl ? panelEl.getBoundingClientRect().width : 240;

    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const flipUp = spaceBelow < panelHeight + POPOVER_GAP;

    let left = rect.left;
    if (left + panelWidth > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - panelWidth - VIEWPORT_MARGIN;
    }
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

    if (flipUp) {
      setPosition({ bottom: window.innerHeight - rect.top + POPOVER_GAP, left, flipUp: true });
    } else {
      setPosition({ top: rect.bottom + POPOVER_GAP, left, flipUp: false });
    }
  }, [triggerRef]);

  // Primera pasada (estimado) + segunda con medidas reales del panel montado.
  useEffect(() => {
    calcPosition();
  }, [calcPosition]);
  useEffect(() => {
    if (mounted) calcPosition();
  }, [mounted, calcPosition]);

  // Click/tap fuera → cerrar (es informativo, no un form — spec §4).
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [triggerRef, onClose]);

  // Esc → cierra y devuelve el foco al disparador (spec §4).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, triggerRef]);

  if (!mounted) return null;

  const hasPassiveGroup = passiveLimits.length > 0;
  const hasActiveGroup = activeLimits.length > 0;

  const content = (
    <div
      ref={panelRef}
      role="group"
      aria-label={ariaLabel}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-50 min-w-[240px] max-w-[300px] overflow-y-auto rounded-ctl border border-line bg-panel p-[6px] shadow-[var(--shadow-lg)] animate-modal-pop"
      style={{
        left: position.left,
        ...(position.flipUp ? { bottom: position.bottom } : { top: position.top }),
        maxHeight: "min(60vh, 360px)",
      }}
    >
      <div className="px-[10px] pt-[6px] pb-[4px] text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
        {caption}
      </div>
      <LimitsGroup
        title="Marcan un dato"
        items={passiveLimits}
        categoryNameById={categoryNameById}
        categoryColorById={categoryColorById}
        withDividerBefore={false}
      />
      {hasActiveGroup && (
        <LimitsGroup
          title="Avisan al guardar"
          items={activeLimits}
          categoryNameById={categoryNameById}
          categoryColorById={categoryColorById}
          withDividerBefore={hasPassiveGroup}
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
}

// ─── LimitsInfoPopover (disparador + panel) ────────────────────────────────────

export interface LimitsInfoPopoverProps {
  /** Superficie observada (lib/limits/catalog.ts). "mes" habilita el grupo Activos. */
  surface: LimitSurface;
}

export function LimitsInfoPopover({ surface }: LimitsInfoPopoverProps) {
  const { limits } = useLimits();
  const { categories } = useCategories();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hoverCapable = useHoverCapable();
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    openTimerRef.current = null;
    closeTimerRef.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const surfaceLimits = limits.filter((l) => getAnchorDef(l.anchorKey)?.surface === surface);

  // Regla dura: sin ≥1 límite para esta superficie, el disparador no se monta
  // (sin hueco reservado — spec §1).
  if (surfaceLimits.length === 0) return null;

  const isMes = surface === "mes";
  const caption = isMes ? "Límites de esta vista" : "Límites de este reporte";
  const ariaLabel = isMes
    ? "Límites que observan esta vista del mes"
    : "Límites que observan este reporte";

  const passiveLimits = surfaceLimits.filter((l) => l.nature === "passive");
  // El grupo Activos solo existe en /mes (las 7 keys mes.* son las únicas que
  // admiten nature: "active" — spec §3).
  const activeLimits = isMes ? surfaceLimits.filter((l) => l.nature === "active") : [];

  const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const categoryColorById = new Map((categories ?? []).map((c) => [c.id, c.color]));

  function handleTriggerClick() {
    clearTimers();
    setOpen((o) => !o);
  }

  function handleTriggerMouseEnter() {
    if (!hoverCapable) return;
    clearTimers();
    openTimerRef.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY);
  }

  function scheduleClose() {
    if (!hoverCapable) return;
    clearTimers();
    closeTimerRef.current = setTimeout(() => setOpen(false), HOVER_CLOSE_GRACE);
  }

  function cancelClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function handleClose() {
    clearTimers();
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={handleTriggerClick}
        onMouseEnter={handleTriggerMouseEnter}
        onMouseLeave={scheduleClose}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-ctl transition-colors duration-[140ms] motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          open ? "bg-panel-2 text-ink" : "text-muted hover:bg-panel-2 hover:text-ink",
        )}
      >
        <Info size={16} aria-hidden="true" />
      </button>
      {open && (
        <LimitsInfoPanel
          triggerRef={triggerRef}
          onClose={handleClose}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          caption={caption}
          ariaLabel={ariaLabel}
          passiveLimits={passiveLimits}
          activeLimits={activeLimits}
          categoryNameById={categoryNameById}
          categoryColorById={categoryColorById}
        />
      )}
    </>
  );
}
