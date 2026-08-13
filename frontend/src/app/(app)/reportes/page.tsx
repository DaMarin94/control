"use client";

/**
 * Pantalla configurable de Reportes — /reportes (RF-REP-003/004, Pantalla 7).
 * Fase 1.1.5: renombre de /anual.
 * Ola 2, P1: modo orden de cards (reordenables con dnd-kit).
 *
 * La pantalla es una grilla de cards de reporte configurables:
 *   - El usuario agrega cards con el recuadro "[+]".
 *   - Cada card es un ReportCard autónomo con su propio año y filtro de categorías.
 *   - Cada card se puede quitar con el botón X + confirmación inline.
 *   - El orden de las cards es configurable por drag (modo orden explícito).
 *   - El estado se persiste en la clave `reports` del blob de preferencias (RF-REP-004).
 *
 * Spec visual: docs/design.md, secciones C (recuadro "[+]"), D (estado vacío),
 *              E (grilla con cards), F (dashboard),
 *              "Reportes reordenables — modo orden de cards (Ola 2, P1)".
 *
 * prefers-reduced-motion: las animaciones de las cards usan animate-screen-fade
 * (fade + translateY) que ya respeta reduced-motion a través del keyframe del DS.
 * El colapso a mini en modo orden es instantáneo (sin transición de altura).
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, AreaChart, BarChart3, CalendarDays, CalendarRange, TrendingUp, ArrowUpDown, Check } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  MeasuringStrategy,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { usePreferences } from "@/hooks/use-preferences";
import { useSettings } from "@/hooks/use-settings";
import { SortableReportCard } from "@/components/charts/sortable-report-card";
import type { ReportCardConfig, ReportCardType } from "@/types/reports";
import type { CurrencyCode } from "@/types/settings";
import { cn } from "@/lib/utils";
import { getCurrentMonth } from "@/lib/format";
import { createLogger } from "@/lib/logger";
import { CurrencyChip } from "@/components/ui/currency-chip";

const logger = createLogger("ReportesPage");

/** Deriva el año actual del helper getCurrentMonth. */
function getCurrentYear(): number {
  const month = getCurrentMonth();
  return parseInt(month.split("-")[0] ?? String(new Date().getFullYear()), 10);
}

/** Genera un id único para una card nueva. */
function generateCardId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback SSR-safe
  return `card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── Popover-menú de elección de tipo ─────────────────────────────────────────

interface AddCardMenuProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSelect: (type: ReportCardType) => void;
  onClose: () => void;
}

/** Ancho fijo del popover (debe coincidir con w-[240px] en el JSX). */
const POPOVER_WIDTH = 240;
/** Colchón mínimo al borde del viewport. */
const VIEWPORT_MARGIN = 12;
/** Gap entre anchor y popover (ambas direcciones). */
const POPOVER_GAP = 6;
/** Alto estimado para el primer frame antes de medir el DOM real (5 opciones). */
const POPOVER_HEIGHT_ESTIMATE = 330;

function AddCardMenu({ anchorRef, onSelect, onClose }: AddCardMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  /**
   * Calcula la posición del popover con flip vertical.
   * Se invoca tanto en el mount (con alto estimado) como después de pintar
   * (con alto real del DOM), para evitar saltos visibles.
   */
  function calcPosition(popoverHeight: number) {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const vh = window.innerHeight;

    const espacioAbajo = vh - rect.bottom - VIEWPORT_MARGIN;
    const espacioArriba = rect.top - VIEWPORT_MARGIN;
    const cabe_abajo = popoverHeight + POPOVER_GAP <= espacioAbajo;
    const cabe_arriba = popoverHeight + POPOVER_GAP <= espacioArriba;

    let top: number;
    if (cabe_abajo) {
      // Default: abajo del anchor
      top = rect.bottom + POPOVER_GAP;
    } else if (cabe_arriba) {
      // Flip: arriba del anchor
      top = rect.top - popoverHeight - POPOVER_GAP;
    } else {
      // No entra en ningún lado: priorizar el que tiene más espacio, clampear
      const topCandidate =
        espacioArriba > espacioAbajo
          ? rect.top - popoverHeight - POPOVER_GAP
          : rect.bottom + POPOVER_GAP;
      top = Math.max(VIEWPORT_MARGIN, Math.min(topCandidate, vh - popoverHeight - VIEWPORT_MARGIN));
    }

    // Clamp horizontal: si el popover se pasa del borde derecho, recortar
    let left = rect.left;
    if (left + POPOVER_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN;
    }

    setPosition({ top, left });
  }

  // Primera pasada con estimado (antes del primer paint del menú)
  useEffect(() => {
    calcPosition(POPOVER_HEIGHT_ESTIMATE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorRef]);

  // Segunda pasada con alto real (después de que el menú está en el DOM)
  useEffect(() => {
    if (!menuRef.current) return;
    const realHeight = menuRef.current.getBoundingClientRect().height;
    if (realHeight > 0) calcPosition(realHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose, anchorRef]);

  if (!mounted) return null;

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-50 w-[240px] rounded-ctl border border-line bg-panel shadow-[var(--shadow-lg)] p-[6px] animate-modal-pop"
      style={{ top: position.top, left: position.left }}
      role="menu"
      aria-label="Tipo de reporte"
    >
      {/* Opción 1: Ingresos vs Gastos */}
      <button
        type="button"
        role="menuitem"
        onClick={() => onSelect("income-expense")}
        className="flex w-full items-center gap-[10px] rounded-ctl px-3 py-[10px] text-left transition-colors duration-[140ms] hover:bg-panel-2 focus-visible:outline-none focus-visible:bg-panel-2"
      >
        <AreaChart size={16} className="shrink-0 text-ink-2" aria-hidden="true" />
        <div>
          <p className="text-[13px] font-semibold text-ink">Ingresos vs Gastos</p>
          <p className="text-[11.5px] text-muted mt-[1px]">Ingresos vs. gastos por mes</p>
        </div>
      </button>

      {/* Opción 2: Gastos por categoría */}
      <button
        type="button"
        role="menuitem"
        onClick={() => onSelect("by-category")}
        className="flex w-full items-center gap-[10px] rounded-ctl px-3 py-[10px] text-left transition-colors duration-[140ms] hover:bg-panel-2 focus-visible:outline-none focus-visible:bg-panel-2"
      >
        <BarChart3 size={16} className="shrink-0 text-ink-2" aria-hidden="true" />
        <div>
          <p className="text-[13px] font-semibold text-ink">Gastos por categoría</p>
          <p className="text-[11.5px] text-muted mt-[1px]">Gastos por categoría, apilado</p>
        </div>
      </button>

      {/* Opción 3: Gastos Únicos (grilla día × mes) */}
      <button
        type="button"
        role="menuitem"
        onClick={() => onSelect("unique-grid")}
        className="flex w-full items-center gap-[10px] rounded-ctl px-3 py-[10px] text-left transition-colors duration-[140ms] hover:bg-panel-2 focus-visible:outline-none focus-visible:bg-panel-2"
      >
        <CalendarDays size={16} className="shrink-0 text-ink-2" aria-hidden="true" />
        <div>
          <p className="text-[13px] font-semibold text-ink">Gastos Únicos</p>
          <p className="text-[11.5px] text-muted mt-[1px]">Grilla día × mes de gastos únicos</p>
        </div>
      </button>

      {/* Opción 4: Gastos en Cuotas (gantt de barras horizontales) */}
      <button
        type="button"
        role="menuitem"
        onClick={() => onSelect("installment-gantt")}
        className="flex w-full items-center gap-[10px] rounded-ctl px-3 py-[10px] text-left transition-colors duration-[140ms] hover:bg-panel-2 focus-visible:outline-none focus-visible:bg-panel-2"
      >
        <CalendarRange size={16} className="shrink-0 text-ink-2" aria-hidden="true" />
        <div>
          <p className="text-[13px] font-semibold text-ink">Gastos en Cuotas</p>
          <p className="text-[11.5px] text-muted mt-[1px]">Gantt anual de gastos en cuotas</p>
        </div>
      </button>

      {/* Opción 5: Inflación vs Ingresos (gráfico de líneas) */}
      <button
        type="button"
        role="menuitem"
        onClick={() => onSelect("inflation-income")}
        className="flex w-full items-center gap-[10px] rounded-ctl px-3 py-[10px] text-left transition-colors duration-[140ms] hover:bg-panel-2 focus-visible:outline-none focus-visible:bg-panel-2"
      >
        <TrendingUp size={16} className="shrink-0 text-ink-2" aria-hidden="true" />
        <div>
          <p className="text-[13px] font-semibold text-ink">Inflación vs Ingresos</p>
          <p className="text-[11.5px] text-muted mt-[1px]">Variación de tus ingresos frente a la inflación, mes a mes.</p>
        </div>
      </button>
    </div>
  );

  return createPortal(menuContent, document.body);
}

// ─── Recuadro "[+]" ───────────────────────────────────────────────────────────

interface AddCardButtonProps {
  variant: "empty" | "compact";
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  isMenuOpen: boolean;
  onClick: () => void;
}

function AddCardButton({ variant, buttonRef, isMenuOpen, onClick }: AddCardButtonProps) {
  if (variant === "empty") {
    // Versión grande (estado vacío inicial)
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        aria-label="Agregar primer reporte"
        aria-expanded={isMenuOpen}
        className={cn(
          "mx-auto flex w-full max-w-[480px] flex-col items-center justify-center gap-3",
          "rounded-card border border-dashed border-line bg-panel-2",
          "transition-all duration-[140ms] cursor-pointer",
          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
          "hover:border-line-strong hover:bg-panel-3",
        )}
        style={{ height: 280 }}
      >
        {/* Ícono en círculo */}
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-panel-3">
          <Plus size={32} className="text-muted" aria-hidden="true" />
        </span>
        {/* Copy */}
        <div className="text-center px-6">
          <p className="text-[15px] font-semibold text-ink-2">Armá tu primer reporte</p>
          <p className="text-[12.5px] font-medium text-muted mt-1 leading-[1.5] max-w-[300px]">
            Agregá un reporte de ingresos y gastos o de gastos por categoría. Cada uno navega su propio año y filtra sus categorías.
          </p>
        </div>
      </button>
    );
  }

  // Versión compacta (cuando ya hay cards)
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label="Agregar reporte"
      aria-expanded={isMenuOpen}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2",
        "rounded-card border border-dashed border-line bg-panel-2",
        "transition-all duration-[140ms] cursor-pointer",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
        "hover:border-line-strong hover:bg-panel-3",
      )}
      style={{ height: 120 }}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-panel-3">
        <Plus size={28} className="text-muted" aria-hidden="true" />
      </span>
      <span className="text-[13px] font-semibold text-muted">Agregar reporte</span>
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function ReportesPageContent() {
  const { preferences, setPreferences } = usePreferences();
  const { defaultCurrency } = useSettings();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Modo orden (Ola 2, P1) ─────────────────────────────────────────────────
  const [isOrderMode, setIsOrderMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  function handleEnterOrderMode() {
    // Cerrar el menú de tipo si estaba abierto
    setMenuOpen(false);
    setIsOrderMode(true);
  }

  function handleExitOrderMode() {
    setIsOrderMode(false);
    setActiveId(null);
  }

  // ── Configuración de sensores dnd-kit ────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // ── Handlers drag dnd-kit ─────────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = cards.findIndex((c) => c.id === active.id);
    const newIndex = cards.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newCards = arrayMove(cards, oldIndex, newIndex);
    // Persistir en background (merge manual con el resto de preferencias)
    void setPreferences({ ...preferences, reports: newCards }).catch((err) => {
      logger.error("Error al persistir orden de cards", { error: err });
    });
  }

  // Normalizar y migrar las cards del blob de preferencias.
  //
  // Reglas de migración:
  //   - income-expense con categoryBreakdown=true → type "by-category" + categoryChartMode "line"
  //     (conserva id, title, year, categoryIds, currency; quita categoryBreakdown y hiddenSeries).
  //   - income-expense con categoryBreakdown=false/ausente → queda income-expense sin ese campo.
  //   - income-expense con hiddenSeries → se limpia (campo deprecated; la leyenda-filtro de
  //     categorías reemplazó la leyenda de series; RF-REP-014 rework).
  //   - by-category sin categoryChartMode → queda by-category, se lee como "bar" en runtime.
  const rawReports = preferences?.reports;
  const cards: ReportCardConfig[] = Array.isArray(rawReports)
    ? rawReports.map((raw): ReportCardConfig => {
        // Migrar income-expense con categoryBreakdown=true → by-category + line
        if (
          raw.type === "income-expense" &&
          (raw as ReportCardConfig).categoryBreakdown === true
        ) {
          const { categoryBreakdown: _cb, hiddenSeries: _hs, ...rest } = raw as ReportCardConfig;
          void _cb; void _hs; // suprimir unused
          return { ...rest, type: "by-category", categoryChartMode: "line" };
        }
        // income-expense con categoryBreakdown=false/ausente: limpiar campo si existe.
        // Si además tiene hiddenSeries (deprecated), también se limpia en esta pasada.
        if (
          raw.type === "income-expense" &&
          "categoryBreakdown" in raw
        ) {
          const { categoryBreakdown: _cb, hiddenSeries: _hs, ...rest } = raw as ReportCardConfig;
          void _cb; void _hs;
          return rest as ReportCardConfig;
        }
        // income-expense con hiddenSeries (deprecated, sin categoryBreakdown): limpiar.
        if (raw.type === "income-expense" && "hiddenSeries" in raw) {
          const { hiddenSeries: _hs, ...rest } = raw as ReportCardConfig;
          void _hs;
          return rest as ReportCardConfig;
        }
        // by-category sin categoryChartMode: queda tal cual (runtime lo trata como "bar")
        return raw as ReportCardConfig;
      })
    : [];

  function handleAddCard(type: ReportCardType) {
    setMenuOpen(false);
    const newCard: ReportCardConfig = {
      id: generateCardId(),
      type,
      year: getCurrentYear(),
      categoryIds: null,
      // La card nace con la moneda default del usuario (Ola 3, P3).
      // Al cambiar la default global, las cards existentes sin override
      // caen a la nueva default por el ?? del ReportCard (back-compat).
      currency: defaultCurrency,
    };
    const newCards = [...cards, newCard];
    void setPreferences({ ...preferences, reports: newCards }).catch((err) => {
      logger.error("Error al persistir nueva card", { error: err });
    });
  }

  function handleRemoveCard(id: string) {
    const newCards = cards.filter((c) => c.id !== id);
    void setPreferences({ ...preferences, reports: newCards }).catch((err) => {
      logger.error("Error al quitar card", { error: err, cardId: id });
    });
  }

  function handleYearChange(id: string, newYear: number) {
    const newCards = cards.map((c) => (c.id === id ? { ...c, year: newYear } : c));
    void setPreferences({ ...preferences, reports: newCards }).catch((err) => {
      logger.error("Error al persistir año de card", { error: err, cardId: id });
    });
  }

  function handleCategoryIdsChange(id: string, ids: string[] | null) {
    const newCards = cards.map((c) =>
      c.id === id ? { ...c, categoryIds: ids } : c
    );
    void setPreferences({ ...preferences, reports: newCards }).catch((err) => {
      logger.error("Error al persistir filtro de card", { error: err, cardId: id });
    });
  }

  function handleCategoryChartModeChange(id: string, mode: "bar" | "line") {
    const newCards = cards.map((c) =>
      c.id === id ? { ...c, categoryChartMode: mode } : c
    );
    void setPreferences({ ...preferences, reports: newCards }).catch((err) => {
      logger.error("Error al persistir modo de gráfico de card", { error: err, cardId: id });
    });
  }

  function handleCurrencyChange(id: string, newCurrency: CurrencyCode) {
    const newCards = cards.map((c) =>
      c.id === id ? { ...c, currency: newCurrency } : c
    );
    void setPreferences({ ...preferences, reports: newCards }).catch((err) => {
      logger.error("Error al persistir moneda de card", { error: err, cardId: id });
    });
  }

  function handleTitleChange(id: string, title: string) {
    const newCards = cards.map((c) => {
      if (c.id !== id) return c;
      // Si el título queda vacío, omitir el campo (vuelve al placeholder display).
      if (title) return { ...c, title };
      const updated = { ...c };
      delete updated.title;
      return updated;
    });
    void setPreferences({ ...preferences, reports: newCards }).catch((err) => {
      logger.error("Error al persistir título de card", { error: err, cardId: id });
    });
  }

  function handleMovementTypesChange(id: string, types: Array<"fijo" | "cuota" | "unico">) {
    const newCards = cards.map((c) => {
      if (c.id !== id) return c;
      // Si están los tres tipos (= default), omitir el campo para back-compat.
      if (types.length === 3) {
        const updated = { ...c };
        delete updated.movementTypes;
        return updated;
      }
      return { ...c, movementTypes: types };
    });
    void setPreferences({ ...preferences, reports: newCards }).catch((err) => {
      logger.error("Error al persistir tipos de movimiento de card", { error: err, cardId: id });
    });
  }

  function handleDirectionChange(id: string, dir: "expense" | "income" | "both") {
    const newCards = cards.map((c) => {
      if (c.id !== id) return c;
      // Si es "both" (= default), omitir el campo para back-compat (campo ausente = ambos).
      if (dir === "both") {
        const updated = { ...c };
        delete updated.direction;
        return updated;
      }
      return { ...c, direction: dir };
    });
    void setPreferences({ ...preferences, reports: newCards }).catch((err) => {
      logger.error("Error al persistir dirección de card", { error: err, cardId: id });
    });
  }

  // Ola 3, P3: techo editable de la escala de color de la card `unique-grid`.
  // `usdCents` ya viene resuelto por el backend (el front nunca calcula la
  // conversión a USD) — acá solo se persiste tal cual en la clave `reports`.
  function handleAnchorChange(id: string, usdCents: number) {
    const newCards = cards.map((c) =>
      c.id === id ? { ...c, anchorUsdCents: usdCents } : c
    );
    void setPreferences({ ...preferences, reports: newCards }).catch((err) => {
      logger.error("Error al persistir techo de color de card", { error: err, cardId: id });
    });
  }

  // RF-REP-017: toggle "incluir movimientos simulados" — income-expense y by-category.
  // Si es false (= default), se omite el campo para back-compat (mismo patrón que
  // direction/movementTypes: ausente = apagado).
  function handleIncludeSimulatedChange(id: string, v: boolean) {
    const newCards = cards.map((c) => {
      if (c.id !== id) return c;
      if (!v) {
        const updated = { ...c };
        delete updated.includeSimulated;
        return updated;
      }
      return { ...c, includeSimulated: true };
    });
    void setPreferences({ ...preferences, reports: newCards }).catch((err) => {
      logger.error("Error al persistir toggle de simulados de card", { error: err, cardId: id });
    });
  }

  const hasCards = cards.length > 0;

  return (
    <div className="px-10 py-[34px] pb-20 max-w-[1120px] mx-auto animate-screen-fade">
      {/* ── Header .phead ── */}
      <div className="flex items-end justify-between gap-5 mb-7 flex-wrap">
        <div>
          {/* Fila del eyebrow: label + chip de moneda default (a la derecha del eyebrow) */}
          <div className="flex items-center gap-[10px] mb-[6px]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
              Tu actividad
            </p>
            <CurrencyChip currency={defaultCurrency} />
          </div>
          <h1 className="text-[32px] font-bold tracking-[-0.02em] leading-[1.05] text-ink m-0">
            Reportes
          </h1>
        </div>

        {/* Zona derecha del .phead: toggle "Ordenar reportes" / "Listo" */}
        {/* Solo se muestra cuando hay 2 o más cards */}
        {cards.length >= 2 && (
          isOrderMode ? (
            <button
              type="button"
              onClick={handleExitOrderMode}
              className={[
                // Primario índigo (señala modo activo)
                "inline-flex items-center gap-1.5 px-3 py-2",
                "text-[13px] font-semibold text-white",
                "rounded-[var(--r-ctl)]",
                "bg-accent hover:bg-accent-press",
                "transition-colors duration-[140ms]",
                "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
                "shadow-[var(--shadow-sm),inset_0_1px_0_oklch(1_0_0_/_0.2)]",
                "hover:shadow-[var(--shadow-md)]",
              ].join(" ")}
            >
              <Check size={15} aria-hidden="true" />
              Listo
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEnterOrderMode}
              aria-label="Ordenar reportes"
              className={[
                // Ghost del DS
                "inline-flex items-center gap-1.5 px-3 py-2",
                "text-[13px] font-semibold text-ink-2",
                "rounded-[var(--r-ctl)]",
                "bg-panel border border-line",
                "hover:bg-panel-2 hover:text-ink",
                "transition-colors duration-[140ms]",
                "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              ].join(" ")}
            >
              <ArrowUpDown size={15} aria-hidden="true" />
              Ordenar reportes
            </button>
          )
        )}
      </div>

      {/* ── Estado vacío: solo el "[+]" grande centrado ── */}
      {!hasCards && (
        <AddCardButton
          variant="empty"
          buttonRef={addButtonRef}
          isMenuOpen={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        />
      )}

      {/* ── Con cards: columna de cards + "[+]" compacto al final ── */}
      {hasCards && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={cards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-[var(--gap)]">
              {cards.map((card, index) => (
                <SortableReportCard
                  key={card.id}
                  config={card}
                  index={index + 1}
                  isOrderMode={isOrderMode}
                  isActive={activeId === card.id}
                  onYearChange={(year) => handleYearChange(card.id, year)}
                  onCategoryIdsChange={(ids) => handleCategoryIdsChange(card.id, ids)}
                  onCategoryChartModeChange={(mode) => handleCategoryChartModeChange(card.id, mode)}
                  onRemove={() => handleRemoveCard(card.id)}
                  onCurrencyChange={(c) => handleCurrencyChange(card.id, c)}
                  onTitleChange={(t) => handleTitleChange(card.id, t)}
                  onMovementTypesChange={(types) => handleMovementTypesChange(card.id, types)}
                  onDirectionChange={(dir) => handleDirectionChange(card.id, dir)}
                  onAnchorChange={(usdCents) => handleAnchorChange(card.id, usdCents)}
                  onIncludeSimulatedChange={(v) => handleIncludeSimulatedChange(card.id, v)}
                />
              ))}

              {/* "[+]" compacto al final — atenuado y deshabilitado en modo orden */}
              <div
                className={cn(
                  isOrderMode ? "opacity-45 pointer-events-none cursor-default" : "",
                )}
              >
                <AddCardButton
                  variant="compact"
                  buttonRef={addButtonRef}
                  isMenuOpen={menuOpen && !isOrderMode}
                  onClick={() => {
                    if (!isOrderMode) setMenuOpen((o) => !o);
                  }}
                />
              </div>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Popover-menú de tipo (portaled a body) — no en modo orden */}
      {menuOpen && !isOrderMode && (
        <AddCardMenu
          anchorRef={addButtonRef}
          onSelect={handleAddCard}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

export default function ReportesPage() {
  return <ReportesPageContent />;
}
