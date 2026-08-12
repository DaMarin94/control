"use client";

/**
 * Modal de alcance de la anulación de un fijo (RF-MF-005, docs/design.md
 * §"Modal de alcance de la anulación de un fijo (`/mes`) — RF-MF-005").
 *
 * Se abre desde la acción "Anular este mes" / "Des-anular este mes" del
 * kebab de un ítem FIJO no calculado (movement-item-row.tsx). Ofrece dos
 * alcances excluyentes:
 * - "Solo este mes" (preseleccionado): mismo comportamiento de hoy — toggle
 *   puntual sobre `viewMonth`, sin toast (el efecto se ve en la fila).
 * - "Un rango de meses": operación EXPLÍCITA (no toggle) sobre [desde, hasta]
 *   del fijo lógico completo (la cadena) — POST /recurring/:id/skip con
 *   { from, to, action }. Emite toast de éxito (el efecto puede caer fuera
 *   del mes visualizado).
 *
 * Cero fetch al abrir: nombre, categoría, frecuencia, arranque y fin del
 * fijo lógico viajan en el `MovementItem` que la lista ya tiene. El conteo
 * de apariciones es aritmética RN-016 en el cliente (lib/recurring-skip-range.ts).
 *
 * `ModalShell variant="dialog"`: cierra con ✕ y `Esc`; el clic en el scrim
 * NO cierra (modal de decisión, default de `ModalShell`).
 *
 * Foco inicial en el radio "Solo este mes" (no en el botón) — así `Enter`
 * confirma y ↑↓ recorren el radiogroup sin `Tab` (§4 del spec). `Enter`
 * confirma desde cualquier control salvo un `<select>` nativo desplegado
 * (el navegador lo intercepta antes de que llegue a React — sin código
 * especial de nuestro lado).
 */

import { forwardRef, useMemo, useRef, useState } from "react";
import { CalendarOff, CalendarPlus, CalendarRange, Info } from "lucide-react";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useRecurring } from "@/hooks/use-recurring";
import { useToast } from "@/hooks/use-toast";
import { FREQUENCY_LABEL } from "@/lib/movements";
import { formatMonthLabel, formatMonthShort, prevMonth } from "@/lib/format";
import {
  buildDesdeOptions,
  buildHastaOptions,
  countAppearances,
} from "@/lib/recurring-skip-range";
import type { MovementItem } from "@/types/movement";
import { cn } from "@/lib/utils";

interface RecurringSkipScopeModalProps {
  /** MovementItem del fijo (no calculado) — nunca un calculado (no tiene skip propio). */
  movement: MovementItem;
  /** Mes visualizado en la Vista del mes, formato YYYY-MM */
  viewMonth: string;
  onClose: () => void;
}

type Scope = "month" | "range";
type NoteState = "base" | "maxLength" | "dragged";

const NOTE_COPY: Record<NoteState, string> = {
  base: "Hasta 24 meses por operación. Para un tramo más largo, repetí la operación desde el mes siguiente.",
  maxLength: "El ‘hasta’ se ajustó al máximo de 24 meses.",
  dragged: "El ‘hasta’ se movió junto con el ‘desde’.",
};

/** Capitaliza la primera letra de un rótulo de mes ("junio 2026" → "Junio 2026") */
function capitalizeMonthLabel(month: string): string {
  const label = formatMonthLabel(month);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Vigencia del fijo lógico — mismo formato que la card de detalle (movement-detail-card.tsx),
 * pero como texto plano (Space Grotesk, sin `mono`: es un rótulo de mes, no una cifra). */
function formatVigencia(startMonth: string, endMonth: string | null): string {
  if (endMonth === null) {
    return `Desde ${formatMonthShort(startMonth)} · activo`;
  }
  const lastActiveMonth = prevMonth(endMonth);
  if (lastActiveMonth === startMonth) {
    return formatMonthShort(startMonth);
  }
  return `${formatMonthShort(startMonth)} – ${formatMonthShort(lastActiveMonth)}`;
}

/** Separador "·" entre segmentos — mismo molde que IdentitySeparator de movement-item-row.tsx */
function Dot() {
  return <span className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0" aria-hidden="true" />;
}

// ─── Fila de radio del alcance ──────────────────────────────────────────────

interface RadioRowProps {
  checked: boolean;
  label: string;
  sub: string;
  onSelect: () => void;
}

const RadioRow = forwardRef<HTMLDivElement, RadioRowProps>(function RadioRow(
  { checked, label, sub, onSelect },
  ref,
) {
  return (
    <div
      ref={ref}
      role="radio"
      aria-checked={checked}
      tabIndex={checked ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-[10px] px-[10px] py-[9px] rounded-[var(--r-ctl)] min-h-[44px] border cursor-pointer transition-colors duration-[140ms]",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
        checked ? "bg-panel-2 border-accent" : "border-transparent hover:bg-panel-2",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          checked ? "border-accent bg-accent" : "border-line-strong",
        )}
      >
        {checked && <span className="h-[6px] w-[6px] rounded-full bg-white" />}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-[13.5px] font-semibold text-ink">{label}</span>
        <span className="text-[12.5px] text-muted">{sub}</span>
      </span>
    </div>
  );
});

// ─── Componente ──────────────────────────────────────────────────────────────

export function RecurringSkipScopeModal({ movement, viewMonth, onClose }: RecurringSkipScopeModalProps) {
  const { toast } = useToast();
  const { skipRecurring, skipRecurringRange, isSkipping, isSkippingRange } = useRecurring();

  const isSkipped = movement.skipped;
  const name = movement.description ?? movement.category.name;
  const startMonth = movement.startMonth!;
  const frequency = movement.frequency!;
  const endMonth = movement.endMonth;
  const frequencyLabel = FREQUENCY_LABEL[frequency] ?? "mensual";

  const [scope, setScope] = useState<Scope>("month");
  const [desde, setDesde] = useState(viewMonth);
  const [hasta, setHasta] = useState(viewMonth);
  const [noteState, setNoteState] = useState<NoteState>("base");

  const radioMonthRef = useRef<HTMLDivElement>(null);
  const radioRangeRef = useRef<HTMLDivElement>(null);
  const hasFocusedInitialRef = useRef(false);

  // Foco inicial en el radio preseleccionado ("Solo este mes") — no en el botón (§4).
  // `ModalShell` gatea su propio mount (portal SSR-safe) antes de montar los
  // children — por eso el foco no puede salir de un efecto con deps `[]` acá
  // (correría en el commit anterior a que el nodo real exista, con
  // `radioMonthRef.current` todavía `null`); sale de un ref callback que
  // dispara justo cuando React adjunta el nodo, mismo patrón que
  // `ActiveLimitDialog` (`focusCancelOnMount`).
  function attachRadioMonthRef(el: HTMLDivElement | null) {
    radioMonthRef.current = el;
    if (el && !hasFocusedInitialRef.current) {
      hasFocusedInitialRef.current = true;
      el.focus();
    }
  }

  const desdeOptions = useMemo(
    () => buildDesdeOptions(startMonth, frequency, endMonth, viewMonth),
    [startMonth, frequency, endMonth, viewMonth],
  );
  const hastaOptions = useMemo(
    () => buildHastaOptions(desde, startMonth, frequency, endMonth),
    [desde, startMonth, frequency, endMonth],
  );
  const rangeResult = useMemo(
    () => countAppearances(startMonth, frequency, desde, hasta),
    [startMonth, frequency, desde, hasta],
  );

  function selectScope(next: Scope) {
    setScope(next);
    (next === "month" ? radioMonthRef : radioRangeRef).current?.focus();
  }

  function handleRadiogroupKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleConfirm();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    selectScope(scope === "month" ? "range" : "month");
  }

  function handleSelectKeyDown(e: React.KeyboardEvent<HTMLSelectElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void handleConfirm();
  }

  function handleDesdeChange(newDesde: string) {
    const newHastaOptions = buildHastaOptions(newDesde, startMonth, frequency, endMonth);
    const newFirst = newHastaOptions[0]!;
    const newLast = newHastaOptions[newHastaOptions.length - 1]!;

    let newHasta = hasta;
    let note: NoteState = "base";
    if (hasta < newFirst) {
      newHasta = newFirst;
      note = "dragged";
    } else if (hasta > newLast) {
      newHasta = newLast;
      note = "maxLength";
    }

    setDesde(newDesde);
    setHasta(newHasta);
    setNoteState(note);
  }

  function handleHastaChange(newHasta: string) {
    setHasta(newHasta);
    setNoteState("base");
  }

  const isSubmitting = scope === "month" ? isSkipping : isSkippingRange;
  const isRangeDisabled = scope === "range" && rangeResult.count === 0;

  async function handleConfirm() {
    if (isSubmitting || isRangeDisabled) return;

    if (scope === "month") {
      const result = await skipRecurring(movement.id, viewMonth);
      if (!result.success) {
        toast.error(result.error ?? "No se pudo cambiar el estado del movimiento.");
        return;
      }
      // Sin toast (RF-MF-005 §5) — el efecto ya se ve en la fila.
      onClose();
      return;
    }

    const action = isSkipped ? "unskip" : "skip";
    const result = await skipRecurringRange(movement.id, { from: desde, to: hasta, action });
    if (!result.success) {
      toast.error(result.error ?? "No se pudo cambiar el estado del movimiento.");
      return;
    }

    const affected = result.affectedCount ?? rangeResult.count;
    if (affected >= 2) {
      toast.success(
        isSkipped
          ? `Des-anuladas ${affected} apariciones de ‘${name}’.`
          : `Anuladas ${affected} apariciones de ‘${name}’.`,
      );
    } else {
      const monthLabel = rangeResult.first ? formatMonthShort(rangeResult.first) : "";
      toast.success(
        isSkipped
          ? `Des-anulada una aparición de ‘${name}’: ${monthLabel}.`
          : `Anulada una aparición de ‘${name}’: ${monthLabel}.`,
      );
    }
    onClose();
  }

  const titleId = "skip-scope-title";
  const resultBoxId = "skip-scope-result";
  const ResultIcon = isSkipped ? CalendarPlus : CalendarOff;

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy={titleId}>
      <ModalShellHeader
        titleId={titleId}
        title={isSkipped ? "Des-anular apariciones" : "Anular apariciones"}
        onClose={onClose}
      />

      <ModalShellBody>
        <p className="text-[13px] text-muted max-w-[46ch]">
          {isSkipped
            ? "Las apariciones vuelven a sumar a los totales de su mes."
            : "El fijo sigue existiendo. Las apariciones anuladas se siguen mostrando en su mes, pero no suman a los totales."}
        </p>

        {/* Caja de identidad — nombre + categoría · frecuencia · vigencia */}
        <div className="rounded-ctl border border-line bg-panel-2 px-4 py-3">
          <p className="text-[13px] font-semibold text-ink truncate m-0">{name}</p>
          <p className="mt-[2px] flex flex-wrap items-center gap-[6px] text-[12px] text-muted m-0">
            <span
              className="h-[6px] w-[6px] rounded-full shrink-0"
              style={{ background: movement.category.color }}
              aria-hidden="true"
            />
            <span>{movement.category.name}</span>
            <Dot />
            <span>{frequencyLabel}</span>
            <Dot />
            <span>{formatVigencia(startMonth, endMonth)}</span>
          </p>
        </div>

        {/* Radiogroup de alcance — 2 opciones, ↑↓ navegan, Enter confirma */}
        <div
          role="radiogroup"
          aria-label="Alcance de la anulación"
          className="flex flex-col gap-[6px]"
          onKeyDown={handleRadiogroupKeyDown}
        >
          <RadioRow
            ref={attachRadioMonthRef}
            checked={scope === "month"}
            onSelect={() => selectScope("month")}
            label="Solo este mes"
            sub={capitalizeMonthLabel(viewMonth)}
          />
          <RadioRow
            ref={radioRangeRef}
            checked={scope === "range"}
            onSelect={() => selectScope("range")}
            label="Un rango de meses"
            sub="Desde y hasta, ambos inclusive."
          />
        </div>

        {/* Bloque de rango — solo en el DOM cuando scope === "range" (cero impacto en "este mes") */}
        {scope === "range" && (
          <div className="pl-[36px] flex flex-col gap-[14px]">
            <div className="grid grid-cols-2 gap-[14px]">
              <div className="flex flex-col gap-[7px] min-w-0">
                <Label htmlFor="skip-scope-desde">Desde</Label>
                <Select
                  id="skip-scope-desde"
                  value={desde}
                  onChange={(e) => handleDesdeChange(e.target.value)}
                  onKeyDown={handleSelectKeyDown}
                >
                  {desdeOptions.map((month) => (
                    <option key={month} value={month}>
                      {formatMonthShort(month)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-[7px] min-w-0">
                <Label htmlFor="skip-scope-hasta">Hasta</Label>
                <Select
                  id="skip-scope-hasta"
                  value={hasta}
                  onChange={(e) => handleHastaChange(e.target.value)}
                  onKeyDown={handleSelectKeyDown}
                >
                  {hastaOptions.map((month) => (
                    <option key={month} value={month}>
                      {formatMonthShort(month)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Nota de límite — siempre presente, solo cambia el texto */}
            <p className="flex items-center gap-[7px] text-[12.5px] text-muted m-0">
              <CalendarRange size={14} className="text-accent-ink shrink-0" aria-hidden="true" />
              {NOTE_COPY[noteState]}
            </p>

            {/* Caja de resultado — conteo de apariciones, aria-live */}
            <div
              id={resultBoxId}
              aria-live="polite"
              className="rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px] flex items-start gap-[10px]"
            >
              {rangeResult.count === 0 ? (
                <>
                  <Info size={16} className="text-ink-2 shrink-0 mt-[1px]" aria-hidden="true" />
                  <p className="text-[13px] text-ink-2 m-0">
                    El rango no incluye ninguna aparición: <span className="font-semibold">{name}</span> es{" "}
                    <span className="font-semibold">{frequencyLabel}</span> y no cae en esos meses.
                  </p>
                </>
              ) : (
                <>
                  <ResultIcon size={16} className="text-ink-2 shrink-0 mt-[1px]" aria-hidden="true" />
                  <p className="text-[13px] text-ink m-0">
                    {rangeResult.count === 1 ? (
                      <>
                        Se {isSkipped ? "des-anula" : "anula"}{" "}
                        <span className="font-semibold">una aparición</span>:{" "}
                        <span className="font-semibold">{formatMonthShort(rangeResult.first!)}</span>.
                      </>
                    ) : (
                      <>
                        Se {isSkipped ? "des-anulan" : "anulan"}{" "}
                        <span className="font-semibold">{rangeResult.count} apariciones</span>, entre{" "}
                        <span className="font-semibold">{formatMonthShort(rangeResult.first!)}</span> y{" "}
                        <span className="font-semibold">{formatMonthShort(rangeResult.last!)}</span>.
                      </>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </ModalShellBody>

      <ModalShellFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() => void handleConfirm()}
          disabled={isSubmitting || isRangeDisabled}
          aria-describedby={isRangeDisabled ? resultBoxId : undefined}
        >
          {isSubmitting
            ? isSkipped
              ? "Des-anulando…"
              : "Anulando…"
            : isSkipped
              ? "Des-anular"
              : "Anular"}
        </Button>
      </ModalShellFooter>
    </ModalShell>
  );
}
