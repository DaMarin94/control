"use client";

/**
 * CreateLimitModal — modal de creación de un límite (docs/design.md
 * §"Panel de gestión de límites" → 3. "Flujo de crear — modal con formulario
 * progresivo", extendido en P2 — Fase 2 con el selector de naturaleza).
 * Reusa el molde `transaction-modal` (portal, scrim, diálogo, header con X) —
 * mismo patrón que crear movimientos/categorías/métodos de pago.
 *
 * Orden de los controles (arriba → abajo), condicionales que NO reservan alto
 * (se montan/desmontan): 1) key (compuerta) → 2) refinamiento → 3) naturaleza
 * (pasiva/activa — Fase 2; "Activa" solo habilitada si la key admite esa
 * naturaleza, las 7 keys `mes.*`) → 4) condición (operador + umbral; en rama
 * activa el operador se restringe por polaridad del anclaje, D12) → [5) alcance
 * temporal — SOLO pasiva, D20] → [6) efecto — SOLO pasiva] → 7) nombre opcional.
 * Resumen en lenguaje natural antes del footer.
 *
 * v1 (D8): SOLO crear. Sin editar — para cambiar un límite se borra y se crea
 * de nuevo (el panel de listado, `limits-tab.tsx`, es quien borra).
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLimits } from "@/hooks/use-limits";
import { useToast } from "@/hooks/use-toast";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import {
  getAnchorDef,
  LIMIT_OPERATORS,
  formatThreshold,
  deriveLimitLabel,
  getActiveOperators,
  type LimitUnit,
} from "@/lib/limits/catalog";
import { LimitAnchorPicker } from "@/components/limits/limit-anchor-picker";
import { LimitCategorySelect } from "@/components/limits/limit-category-select";
import { LimitEffectPicker } from "@/components/limits/limit-effect-picker";
import type {
  LimitOperator,
  LimitSectionRefinement,
  LimitTemporalScope,
  LimitEffect,
  LimitNature,
} from "@/types/limit";

// ─── Datos de copy locales (solo para la frase-resumen y el segmented) ────────

const SECTION_OPTIONS: { value: LimitSectionRefinement; label: string }[] = [
  { value: "unicos", label: "Únicos" },
  { value: "fijos", label: "Fijos" },
  { value: "cuotas", label: "Cuotas" },
];

const TEMPORAL_OPTIONS: { value: LimitTemporalScope; label: string }[] = [
  { value: "all", label: "Todos los meses" },
  { value: "current", label: "Mes en curso" },
];

// P2 — Fase 2: selector de naturaleza (pasiva/activa).
const NATURE_OPTIONS: { value: LimitNature; label: string }[] = [
  { value: "passive", label: "Pasiva" },
  { value: "active", label: "Activa" },
];

const OPERATOR_VERB: Record<LimitOperator, string> = {
  gt: "supere",
  gte: "sea mayor o igual a",
  lt: "sea menor a",
  lte: "sea menor o igual a",
  eq: "sea igual a",
};

const EFFECT_PHRASE: Record<LimitEffect, string> = {
  bold: "un énfasis de peso",
  tint: "un tinte ámbar",
  glyph: "un glifo de alerta",
  dot: "un punto de alerta",
  badge: "un badge de límite",
  fill: "un fondo tenue",
  ring: "un ring de alerta",
};

function thresholdPlaceholder(unit: "money" | "signed-money" | "percent" | "count"): string {
  switch (unit) {
    case "percent":
      return "Ej: 10";
    case "count":
      return "Ej: 5";
    default:
      return "Ej: 300000";
  }
}

/** Parsea el input de umbral — número puro, acepta punto o coma decimal (D3, sin moneda). */
function parseThresholdInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Valida el signo del umbral según la unidad del anclaje (catalog-driven, el
 * `unit` de `anchorDef` define qué signos tienen sentido):
 * - "money"  → debe ser > 0 (un tope de gasto/ingreso negativo no tiene sentido).
 * - "count"  → entero ≥ 1.
 * - "signed-money" (Balance) / "percent" → cualquier valor, negativos incluidos.
 * Retorna el mensaje de error inline, o undefined si el valor es válido.
 */
function thresholdSignError(unit: LimitUnit, value: number): string | undefined {
  switch (unit) {
    case "money":
      return value > 0 ? undefined : "El umbral debe ser mayor a 0.";
    case "count":
      return Number.isInteger(value) && value >= 1
        ? undefined
        : "La cantidad debe ser un entero mayor o igual a 1.";
    case "signed-money":
    case "percent":
      return undefined;
  }
}

// ─── Segmented neutro de 2 opciones — alcance temporal ────────────────────────

function TemporalScopeSegmented({
  value,
  onChange,
}: {
  value: LimitTemporalScope;
  onChange: (v: LimitTemporalScope) => void;
}) {
  const selectedIndex = TEMPORAL_OPTIONS.findIndex((o) => o.value === value);
  return (
    <div
      role="radiogroup"
      aria-label="Alcance temporal"
      className="relative flex rounded-pill p-[2px]"
      style={{ backgroundColor: "var(--panel-3)" }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[2px] bottom-[2px] rounded-pill bg-panel shadow-[var(--shadow-sm)] transition-[left,width] duration-[140ms] ease-out motion-reduce:transition-none"
        style={{ left: `calc(${(selectedIndex / 2) * 100}% + 2px)`, width: "calc(50% - 4px)" }}
      />
      {TEMPORAL_OPTIONS.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 flex-1 rounded-pill px-3 py-[7px] text-[12.5px] font-semibold transition-colors duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              isSelected ? "text-ink" : "text-muted hover:text-ink-2",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Segmented neutro de 2 opciones — naturaleza (pasiva/activa, Fase 2) ──────

function NatureSegmented({
  value,
  onChange,
  activeDisabled,
}: {
  value: LimitNature;
  onChange: (v: LimitNature) => void;
  /** true si la key elegida NO admite "active" (solo las 7 keys `mes.*` la admiten). */
  activeDisabled: boolean;
}) {
  const selectedIndex = NATURE_OPTIONS.findIndex((o) => o.value === value);
  return (
    <div
      role="radiogroup"
      aria-label="Naturaleza"
      className="relative flex rounded-pill p-[2px]"
      style={{ backgroundColor: "var(--panel-3)" }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-[2px] bottom-[2px] rounded-pill bg-panel shadow-[var(--shadow-sm)] transition-[left,width] duration-[140ms] ease-out motion-reduce:transition-none"
        style={{ left: `calc(${(selectedIndex / 2) * 100}% + 2px)`, width: "calc(50% - 4px)" }}
      />
      {NATURE_OPTIONS.map((opt) => {
        const isSelected = opt.value === value;
        const isDisabled = opt.value === "active" && activeDisabled;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            title={isDisabled ? "Disponible solo para datos de Vista del mes" : undefined}
            onClick={() => !isDisabled && onChange(opt.value)}
            className={cn(
              "relative z-10 flex-1 rounded-pill px-3 py-[7px] text-[12.5px] font-semibold transition-colors duration-[140ms]",
              "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
              isDisabled
                ? "text-faint cursor-not-allowed opacity-50"
                : isSelected
                  ? "text-ink"
                  : "text-muted hover:text-ink-2",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export interface CreateLimitModalProps {
  onClose: () => void;
}

export function CreateLimitModal({ onClose }: CreateLimitModalProps) {
  const { create } = useLimits();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  useBodyScrollLock();

  useEffect(() => setMounted(true), []);

  const [anchorKey, setAnchorKey] = useState("");
  const [section, setSection] = useState<LimitSectionRefinement | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [nature, setNature] = useState<LimitNature>("passive");
  const [operator, setOperator] = useState<LimitOperator>("gt");
  const [thresholdInput, setThresholdInput] = useState("");
  const [temporalScope, setTemporalScope] = useState<LimitTemporalScope>("all");
  const [effect, setEffect] = useState<LimitEffect | "">("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const anchorDef = anchorKey ? getAnchorDef(anchorKey) : undefined;
  const anchorAdmitsActive = anchorDef?.natures.includes("active") ?? false;
  const isActive = nature === "active";

  // Al cambiar de key: resetear refinamiento + naturaleza y preseleccionar el
  // efecto default de ESA key (naturaleza siempre vuelve a "passive" — el
  // usuario re-elige "Activa" si la nueva key la admite, mismo criterio que
  // el reseteo de refinamiento/efecto).
  useEffect(() => {
    setSection("");
    setCategoryId("");
    setEffect(anchorDef?.defaultEffect ?? "");
    setNature("passive");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey]);

  // D12: en rama activa el operador se restringe por la polaridad del anclaje
  // (techo → gt/gte, piso → lt/lte). Si el operador vigente queda fuera del
  // subset al activar/cambiar de key, se resetea al primero permitido.
  useEffect(() => {
    if (!isActive || !anchorKey) return;
    const allowed = getActiveOperators(anchorKey);
    if (!allowed.includes(operator)) {
      setOperator(allowed[0] ?? "gt");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, anchorKey]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const thresholdValue = parseThresholdInput(thresholdInput);

  const thresholdError =
    anchorDef && thresholdValue !== null ? thresholdSignError(anchorDef.unit, thresholdValue) : undefined;

  const refinementValid =
    !anchorDef?.refinement || !anchorDef.refinement.required
      ? true
      : anchorDef.refinement.kind === "section"
        ? section !== ""
        : categoryId !== "";

  // Rama activa (D20): sin efecto ni alcance temporal — no se piden.
  const isValid =
    Boolean(anchorKey) &&
    thresholdValue !== null &&
    !thresholdError &&
    refinementValid &&
    (isActive || Boolean(effect));

  async function handleSubmit() {
    if (!isValid || !anchorDef || thresholdValue === null) return;
    if (!isActive && !effect) return;
    setSubmitting(true);

    const refinement =
      anchorDef.refinement?.kind === "section"
        ? section
          ? { section: section as LimitSectionRefinement }
          : undefined
        : anchorDef.refinement?.kind === "category"
          ? categoryId
            ? { categoryId }
            : undefined
          : undefined;

    const trimmedLabel = label.trim();
    const result = await create({
      anchorKey,
      refinement,
      operator,
      threshold: thresholdValue,
      nature,
      // Rama activa: SIN temporalScope (D20) ni effect (la activa avisa, no marca).
      ...(isActive ? {} : { temporalScope, effect: effect || anchorDef.defaultEffect }),
      ...(trimmedLabel ? { label: trimmedLabel } : {}),
    });

    setSubmitting(false);
    if (result.success) {
      toast.success("Límite creado.");
      onClose();
    } else {
      toast.error(result.error ?? "No se pudo crear el límite.");
    }
  }

  if (!mounted) return null;

  const namePlaceholder =
    anchorKey && thresholdValue !== null ? deriveLimitLabel(anchorKey, operator, thresholdValue) : undefined;

  const conditionPhrase =
    anchorDef && thresholdValue !== null
      ? `${OPERATOR_VERB[operator]} ${formatThreshold(anchorDef.unit, thresholdValue)}`
      : null;

  // Rama pasiva: resumen completo (dato + condición + alcance + efecto).
  const passiveSummary =
    !isActive && anchorDef && conditionPhrase && effect
      ? {
          anchorLabel: anchorDef.label,
          conditionPhrase,
          temporalLabel: temporalScope === "all" ? "todos los meses" : "el mes en curso",
          effectPhrase: EFFECT_PHRASE[effect],
        }
      : null;

  // Rama activa (D20): sin alcance temporal ni efecto — el resumen enuncia el aviso.
  const activeSummary =
    isActive && anchorDef && conditionPhrase
      ? { anchorLabel: anchorDef.label, conditionPhrase }
      : null;

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      style={{ background: "oklch(0.18 0.02 270 / 0.46)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-limit-modal-title"
    >
      <div
        className="w-full max-w-[460px] bg-panel border border-line overflow-hidden animate-modal-pop max-h-[90vh] flex flex-col"
        style={{ borderRadius: "18px", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[22px] pt-5 pb-4 shrink-0">
          <h2 id="create-limit-modal-title" className="text-[18px] font-bold tracking-[-0.01em] text-ink m-0">
            Nuevo límite
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Body — formulario progresivo, en columna */}
        <div className="px-[22px] pb-5 space-y-[14px] overflow-y-auto">
          {/* 1. Anclaje — primer campo y compuerta */}
          <div className="flex flex-col gap-1">
            <Label htmlFor="limit-anchor">Dato a observar</Label>
            <LimitAnchorPicker id="limit-anchor" value={anchorKey} onChange={setAnchorKey} />
          </div>

          {/* Hasta que no se elige key, el resto del form no se renderiza */}
          {anchorDef && (
            <>
              {/* 2. Refinamiento — condicional */}
              {anchorDef.refinement?.kind === "section" && (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="limit-section">Sección</Label>
                  <Select
                    id="limit-section"
                    value={section}
                    onChange={(e) => setSection(e.target.value as LimitSectionRefinement)}
                  >
                    <option value="">Elegí una sección</option>
                    {SECTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {anchorDef.refinement?.kind === "category" && (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="limit-category">
                    Categoría{!anchorDef.refinement.required ? " (opcional)" : ""}
                  </Label>
                  <LimitCategorySelect id="limit-category" value={categoryId} onChange={setCategoryId} />
                </div>
              )}

              {/* 3. Naturaleza — pasiva/activa (P2, Fase 2). "Activa" solo si la key la admite. */}
              <div className="flex flex-col gap-1">
                <Label>Naturaleza</Label>
                <NatureSegmented
                  value={nature}
                  onChange={setNature}
                  activeDisabled={!anchorAdmitsActive}
                />
              </div>

              {/* 4. Condición — operador + umbral (operador restringido por polaridad en activa, D12) */}
              <div className="flex gap-3">
                <div className="flex flex-col gap-1 w-[190px] shrink-0">
                  <Label htmlFor="limit-operator">Condición</Label>
                  <Select
                    id="limit-operator"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value as LimitOperator)}
                  >
                    {LIMIT_OPERATORS.filter(
                      (op) => !isActive || getActiveOperators(anchorKey).includes(op.value),
                    ).map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.symbol} {op.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <Label htmlFor="limit-threshold">Umbral</Label>
                  <Input
                    id="limit-threshold"
                    inputMode="decimal"
                    className="text-right mono tabular-nums"
                    placeholder={thresholdPlaceholder(anchorDef.unit)}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    error={thresholdError}
                  />
                </div>
              </div>

              {/* 5. Alcance temporal — SOLO pasiva (D20: no aplica a la activa) */}
              {!isActive && (
                <div className="flex flex-col gap-1">
                  <Label>Alcance temporal</Label>
                  <TemporalScopeSegmented value={temporalScope} onChange={setTemporalScope} />
                </div>
              )}

              {/* 6. Efecto visual — SOLO pasiva (la activa avisa, no marca) */}
              {!isActive && (
                <div className="flex flex-col gap-1">
                  <Label>Efecto visual</Label>
                  <LimitEffectPicker
                    effects={anchorDef.effects}
                    value={effect || anchorDef.defaultEffect}
                    onChange={setEffect}
                  />
                </div>
              )}

              {/* 7. Nombre opcional — último campo */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="limit-label">Nombre (opcional)</Label>
                <Input
                  id="limit-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={namePlaceholder}
                />
              </div>

              {/* Resumen en lenguaje natural */}
              {passiveSummary && (
                <p className="text-[12.5px] font-medium text-muted leading-snug">
                  Se marcará <span className="text-ink-2 font-semibold">{passiveSummary.anchorLabel}</span> cuando{" "}
                  <span className="text-ink-2 font-semibold">{passiveSummary.conditionPhrase}</span>, en{" "}
                  <span className="text-ink-2 font-semibold">{passiveSummary.temporalLabel}</span>, con{" "}
                  <span className="text-ink-2 font-semibold">{passiveSummary.effectPhrase}</span>.
                </p>
              )}
              {activeSummary && (
                <p className="text-[12.5px] font-medium text-muted leading-snug">
                  Se te avisará al guardar un movimiento si{" "}
                  <span className="text-ink-2 font-semibold">{activeSummary.anchorLabel}</span>{" "}
                  <span className="text-ink-2 font-semibold">{activeSummary.conditionPhrase}</span>.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-[22px] py-4 border-t border-hair shrink-0">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!isValid || submitting}>
            Crear límite
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
