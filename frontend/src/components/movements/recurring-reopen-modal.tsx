"use client";

/**
 * Modal de reapertura de un fijo terminado (RF-MF-008, docs/design.md
 * §"Reabrir un fijo terminado (`/mes` + `/historial`) — RF-MF-008").
 *
 * Se abre desde la acción "Reabrir" del kebab de un fijo normal con fin
 * (movement-item-row.tsx; el padre lo monta vía `onReopen`, mismo patrón que
 * `RecurringSkipScopeModal`). Pide: el mes X desde el que vuelve a aparecer
 * (stepper con piso, sin techo), el monto desde X y —solo si hay datos dados
 * de baja— los reemplazos obligatorios. Una caja de consecuencia recalculada
 * en vivo explica el resultado.
 *
 * Datos: el `MovementItem` aporta identidad/frecuencia/vigencia/monto (el modal
 * abre completo en eso); `GET /recurring/:id/reopen-preview` aporta el piso, el
 * último monto, qué reemplazos se exigen y los calculados en espejo. Mientras
 * el preview llega, la caja muestra un skeleton y el primario está `disabled`.
 * Si el preview falla: el modal se cierra y `toast.error`.
 *
 * `ModalShell variant="dialog"`: cierra con ✕ y `Esc`; el scrim NO cierra.
 * `Enter` confirma desde cualquier control (los botones conservan su acción).
 *
 * Los reemplazos se mandan SOLO si el preview los marca requeridos (mandarlos
 * sin requerirse = 400). `paymentMethodId: null` = "Sin método de pago".
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarSync, ChevronLeft, ChevronRight, CornerDownRight, Info } from "lucide-react";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SkeletonLine } from "@/components/ui/skeleton";
import { capitalizeMonthLabel, formatVigencia, Dot } from "@/components/movements/recurring-skip-scope-modal";
import { useReopenRecurring } from "@/hooks/use-reopen-recurring";
import { useReopenPreview } from "@/hooks/use-reopen-preview";
import { useCategories } from "@/hooks/use-categories";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { useUndoHistory } from "@/hooks/use-history";
import { useToast } from "@/hooks/use-toast";
import { FREQUENCY_LABEL_LOWER } from "@/hooks/use-recurring-form-logic";
import { FREQUENCY_LABEL } from "@/lib/movements";
import { buildUndoAction } from "@/lib/toast-undo";
import { countAppearances } from "@/lib/recurring-skip-range";
import {
  CURRENCY_SYMBOLS,
  MAX_AMOUNT_CENTS,
  formatMonthShort,
  getCurrentMonth,
  nextMonth,
  parseCurrencyInput,
  prevMonth,
  sanitizeAmountInput,
} from "@/lib/format";
import type { MovementItem } from "@/types/movement";
import { cn } from "@/lib/utils";

interface RecurringReopenModalProps {
  /** MovementItem del fijo (normal, con fin) — nunca un calculado ni un simulado. */
  movement: MovementItem;
  onClose: () => void;
}

/** Valor del `<select>` de método que representa la decisión "Sin método de pago". */
const NO_PAYMENT_METHOD = "__none__";

const TITLE_ID = "reopen-title";
const STEPPER_LABEL_ID = "reopen-month-label";
const RESULT_BOX_ID = "reopen-result";

/** Nota con glifo de la `.field-note` (12.5px --muted, `Info` 14px --accent-ink). */
function FieldNote({ children, withGlyph = false }: { children: React.ReactNode; withGlyph?: boolean }) {
  return (
    <p className="flex items-start gap-1.75 text-[12.5px] text-muted m-0">
      {withGlyph && <Info size={14} className="text-accent-ink shrink-0 mt-px" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}

function CategoryDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full shrink-0 align-middle"
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

export function RecurringReopenModal({ movement, onClose }: RecurringReopenModalProps) {
  const { toast } = useToast();
  const { undo } = useUndoHistory();
  const { reopenRecurring, isReopening } = useReopenRecurring();
  const { categories } = useCategories();
  const { paymentMethods } = usePaymentMethods();

  const currentMonth = useMemo(() => getCurrentMonth(), []);
  const name = movement.description ?? movement.category.name;
  const startMonth = movement.startMonth!;
  const frequency = movement.frequency ?? 1;
  const endMonth = movement.endMonth!;
  const frequencyLabel = FREQUENCY_LABEL[frequency] ?? "mensual";

  const previewQuery = useReopenPreview(movement.id, currentMonth);
  const preview = previewQuery.data;

  // Piso de X = máx(mes en curso, fin original). El preview lo confirma; hasta que
  // llega se usa el cálculo local (mismo valor) para que el stepper ya funcione.
  const floor = preview?.minReopenMonth ?? (endMonth > currentMonth ? endMonth : currentMonth);
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const reopenMonth = pickedMonth !== null && pickedMonth > floor ? pickedMonth : floor;

  // Monto: sin tocar = último monto del fijo (preview; antes, el del ítem).
  const [amountInput, setAmountInput] = useState<string | null>(null);
  const currency = preview?.currency ?? movement.currency;
  const defaultCents = preview?.amountCents ?? movement.amountCents;
  const amountValue = amountInput ?? String(defaultCents / 100).replace(".", ",");

  // Reemplazos ("" = sin decidir).
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethodChoice, setPaymentMethodChoice] = useState("");
  const [mirrorCategoryIds, setMirrorCategoryIds] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const amountRef = useRef<HTMLInputElement | null>(null);
  const selectRefs = useRef<Record<string, HTMLSelectElement | null>>({});
  const hasFocusedInitialRef = useRef(false);
  // `ModalShell` monta sus hijos en un segundo render (gate SSR-safe del portal): el efecto de
  // foco de los reemplazos tiene que esperar a que el cuerpo exista de verdad.
  const [isBodyMounted, setIsBodyMounted] = useState(false);

  const needsCategory = preview?.requiresCategory ?? false;
  const needsPaymentMethod = preview?.requiresPaymentMethod ?? false;
  const mirrorsWithReplacement = useMemo(
    () => (preview?.mirrors ?? []).filter((m) => m.requiresCategory),
    [preview],
  );
  const hasReplacements = needsCategory || needsPaymentMethod || mirrorsWithReplacement.length > 0;
  const fijoHasFields = needsCategory || needsPaymentMethod;

  // Foco inicial en el input Monto (sin seleccionar su texto) — ref callback, mismo
  // patrón que `RecurringSkipScopeModal`: `ModalShell` gatea su montado.
  function attachAmountRef(el: HTMLInputElement | null) {
    amountRef.current = el;
    if (el) setIsBodyMounted(true);
    if (el && !hasFocusedInitialRef.current) {
      hasFocusedInitialRef.current = true;
      el.focus();
    }
  }

  // Preview con reemplazos: el foco pasa al primero, salvo que el usuario ya haya
  // empezado a escribir el monto (no se le roba el foco).
  const hasMovedFocusRef = useRef(false);
  useEffect(() => {
    if (!preview || !hasReplacements || !isBodyMounted || hasMovedFocusRef.current) return;
    hasMovedFocusRef.current = true;
    if (amountInput !== null || document.activeElement !== amountRef.current) return;
    const firstKey = needsCategory
      ? "category"
      : needsPaymentMethod
        ? "paymentMethod"
        : `mirror:${mirrorsWithReplacement[0]?.chainId}`;
    selectRefs.current[firstKey]?.focus();
  }, [preview, hasReplacements, isBodyMounted, amountInput, needsCategory, needsPaymentMethod, mirrorsWithReplacement]);

  // Falla de la carga del preview → cierra con aviso (el usuario no perdió nada).
  const hasHandledPreviewErrorRef = useRef(false);
  useEffect(() => {
    if (previewQuery.isError && !hasHandledPreviewErrorRef.current) {
      hasHandledPreviewErrorRef.current = true;
      toast.error("No se pudo preparar la reapertura.");
      onClose();
    }
  }, [previewQuery.isError, toast, onClose]);

  // ─── Consecuencia (se recalcula con X) ─────────────────────────────────────

  const filler = useMemo(
    () => countAppearances(startMonth, frequency, endMonth, prevMonth(reopenMonth)),
    [startMonth, frequency, endMonth, reopenMonth],
  );

  function clearError(key: string) {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function changeMonth(delta: 1 | -1) {
    if (delta === -1) {
      if (reopenMonth <= floor) return;
      setPickedMonth(prevMonth(reopenMonth));
    } else {
      setPickedMonth(nextMonth(reopenMonth));
    }
  }

  // ─── Confirmar ─────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (isReopening || !preview) return;

    const nextErrors: Record<string, string> = {};
    const cents = parseCurrencyInput(amountValue);
    if (cents === null) nextErrors.amount = "Ingresá un monto mayor a 0";
    else if (cents > MAX_AMOUNT_CENTS) nextErrors.amount = "El monto es demasiado grande";
    if (needsCategory && !categoryId) nextErrors.category = "Elegí una categoría.";
    if (needsPaymentMethod && !paymentMethodChoice) nextErrors.paymentMethod = "Elegí un método de pago.";
    for (const m of mirrorsWithReplacement) {
      if (!mirrorCategoryIds[m.chainId]) nextErrors[`mirror:${m.chainId}`] = "Elegí una categoría.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      // Foco al primero en error, en orden de DOM.
      if (nextErrors.amount) amountRef.current?.focus();
      else {
        const firstKey = ["category", "paymentMethod", ...mirrorsWithReplacement.map((m) => `mirror:${m.chainId}`)].find(
          (k) => nextErrors[k],
        );
        const el = firstKey ? selectRefs.current[firstKey] : null;
        el?.focus();
        el?.scrollIntoView?.({ block: "nearest" });
      }
      return;
    }

    const result = await reopenRecurring(movement.id, {
      currentMonth,
      reopenMonth,
      amountCents: cents!,
      ...(needsCategory ? { categoryId } : {}),
      ...(needsPaymentMethod
        ? { paymentMethodId: paymentMethodChoice === NO_PAYMENT_METHOD ? null : paymentMethodChoice }
        : {}),
      ...(mirrorsWithReplacement.length > 0
        ? {
            calculatedCategories: mirrorsWithReplacement.map((m) => ({
              chainId: m.chainId,
              categoryId: mirrorCategoryIds[m.chainId]!,
            })),
          }
        : {}),
    });

    if (!result.success) {
      // El modal queda abierto con todo lo elegido intacto.
      toast.error("No se pudo reabrir el movimiento.");
      return;
    }

    const message = `Reabierto: ‘${name}’.`;
    if (result.historyEntryId) {
      toast.success(message, {
        // Identidad de grupo = chainId (la misma del toast de editar/eliminar ese fijo, RN-024).
        groupId: movement.chainId!,
        action: {
          label: "Deshacer",
          pendingLabel: "Deshaciendo…",
          onClick: buildUndoAction(undo, result.historyEntryId),
        },
      });
    } else {
      toast.success(message);
    }
    onClose();
  }

  // `Enter` confirma desde cualquier control salvo los botones (que conservan su acción).
  function handleBodyKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter") return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    void handleConfirm();
  }

  // ─── Opciones de los selects de reemplazo ──────────────────────────────────

  const fijoCategoryOptions = (categories ?? []).filter(
    (c) => c.scope === "BOTH" || c.scope === movement.type,
  );
  // Un calculado deriva su tipo on-the-fly: sin chequeo de scope (RF-MCALC-003).
  const mirrorCategoryOptions = categories ?? [];

  const isLoadingPreview = !preview;
  const mirrorNames = (preview?.mirrors ?? []).map((m) => m.description ?? m.category.name);
  const canGoPrev = reopenMonth > floor;
  const isFloorCurrentMonth = floor === currentMonth;
  const symbol = CURRENCY_SYMBOLS[currency] ?? "$";

  return (
    <ModalShell variant="dialog" onClose={onClose} labelledBy={TITLE_ID}>
      <ModalShellHeader titleId={TITLE_ID} title="Reabrir movimiento fijo" onClose={onClose} />

      <ModalShellBody>
        <div className="space-y-3.5" onKeyDown={handleBodyKeyDown}>
          {/* 3.1 · Bajada */}
          <p className="text-[13px] text-muted max-w-[46ch] m-0">
            El fijo vuelve a aparecer desde el mes que elijas, sin fecha de fin.
          </p>

          {/* 3.2 · Caja de identidad */}
          <div className="rounded-ctl border border-line bg-panel-2 px-4 py-3">
            <p className="text-[13px] font-semibold text-ink truncate m-0">{name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted m-0">
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
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

          {/* 3.3 · Mes de reapertura X — stepper con piso, sin techo */}
          <div className="flex flex-col gap-1.75">
            <span id={STEPPER_LABEL_ID} className="text-[12.5px] font-semibold leading-none tracking-[0.01em] text-ink-2">
              Vuelve a aparecer desde
            </span>
            <div
              role="group"
              aria-labelledby={STEPPER_LABEL_ID}
              className="inline-flex w-fit items-center gap-0.5 bg-panel border border-line rounded-pill p-1 shadow-(--shadow-sm)"
            >
              <button
                type="button"
                onClick={canGoPrev ? () => changeMonth(-1) : undefined}
                aria-label="Mes anterior"
                aria-disabled={!canGoPrev}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition-colors duration-140",
                  "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
                  canGoPrev ? "cursor-pointer hover:bg-panel-2 hover:text-ink" : "opacity-40 cursor-default",
                )}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <span
                aria-live="polite"
                className="w-[16ch] text-center text-[14px] font-semibold text-ink"
              >
                {capitalizeMonthLabel(reopenMonth)}
              </span>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Mes siguiente"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-2 transition-colors duration-140 hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
            <FieldNote withGlyph>
              {isFloorCurrentMonth
                ? "No puede ser anterior al mes en curso."
                : `Lo más temprano es ${formatMonthShort(floor)}, el mes siguiente a su último mes.`}
            </FieldNote>
          </div>

          {/* 3.4 · Monto — idéntico al del form de fijo, moneda del fijo en solo lectura */}
          <div className="flex flex-col gap-1.75">
            <Label htmlFor="reopen-amount" required>
              Monto
            </Label>
            <div
              className={cn(
                "flex items-center gap-2 rounded-ctl border-[1.5px] px-3.25 py-2.75 transition-colors duration-140",
                "focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]",
                errors.amount ? "border-expense shadow-[0_0_0_3px_var(--expense-soft)]" : "border-line-strong bg-panel",
              )}
            >
              <span className="text-[15px] text-muted mono shrink-0">{symbol}</span>
              <input
                id="reopen-amount"
                ref={attachAmountRef}
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amountValue}
                aria-invalid={errors.amount ? "true" : undefined}
                className="min-w-0 flex-1 border-none outline-none bg-transparent mono text-[20px] font-semibold tracking-[-0.01em] text-ink placeholder:text-faint"
                onChange={(e) => {
                  setAmountInput(sanitizeAmountInput(e.target.value));
                  clearError("amount");
                }}
              />
            </div>
            {errors.amount && <p className="text-[12px] text-expense-ink m-0">{errors.amount}</p>}
            <FieldNote>
              Rige desde {formatMonthShort(reopenMonth)}. Los meses anteriores conservan el monto que tenían.
            </FieldNote>
          </div>

          {/* 4 · Reemplazos obligatorios — solo si hay datos dados de baja */}
          {hasReplacements && (
            <div className="border-t border-hair pt-3.5 space-y-3">
              <div>
                <p className="text-[13px] font-semibold text-ink m-0">Elegí reemplazos</p>
                <p className="text-[12.5px] text-muted m-0">
                  Estos datos se dieron de baja y no se pueden volver a usar.
                </p>
              </div>

              {fijoHasFields && (
                <div className="space-y-3">
                  {mirrorsWithReplacement.length > 0 && (
                    <p className="text-[12.5px] font-semibold text-ink-2 m-0">{name}</p>
                  )}
                  {needsCategory && preview && (
                    <div className="flex flex-col gap-1.75">
                      <Label htmlFor="reopen-category" required>
                        Categoría
                      </Label>
                      <Select
                        id="reopen-category"
                        ref={(el) => {
                          selectRefs.current.category = el;
                        }}
                        value={categoryId}
                        error={errors.category}
                        onChange={(e) => {
                          setCategoryId(e.target.value);
                          clearError("category");
                        }}
                      >
                        <option value="">Elegí una categoría activa</option>
                        {fijoCategoryOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                      <FieldNote>
                        Antes: <CategoryDot color={preview.category.color} /> {preview.category.name}, dada de baja.
                      </FieldNote>
                    </div>
                  )}
                  {needsPaymentMethod && preview?.paymentMethod && (
                    <div className="flex flex-col gap-1.75">
                      <Label htmlFor="reopen-payment-method" required>
                        Método de pago
                      </Label>
                      <Select
                        id="reopen-payment-method"
                        ref={(el) => {
                          selectRefs.current.paymentMethod = el;
                        }}
                        value={paymentMethodChoice}
                        error={errors.paymentMethod}
                        onChange={(e) => {
                          setPaymentMethodChoice(e.target.value);
                          clearError("paymentMethod");
                        }}
                      >
                        <option value="">Elegí un método</option>
                        <option value={NO_PAYMENT_METHOD}>Sin método de pago</option>
                        {(paymentMethods ?? []).map((pm) => (
                          <option key={pm.id} value={pm.id}>
                            {pm.name}
                          </option>
                        ))}
                      </Select>
                      <FieldNote>
                        Antes:{" "}
                        <PaymentMethodIcon
                          icon={preview.paymentMethod.icon}
                          size={14}
                          className="inline-block align-[-2px] text-ink-2"
                        />{" "}
                        {preview.paymentMethod.name}, dado de baja.
                      </FieldNote>
                    </div>
                  )}
                </div>
              )}

              {mirrorsWithReplacement.map((m) => {
                const key = `mirror:${m.chainId}`;
                const inputId = `reopen-mirror-${m.chainId}`;
                return (
                  <div key={m.chainId} className="space-y-3">
                    <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2 m-0">
                      <CornerDownRight size={12} className="text-muted shrink-0" aria-hidden="true" />
                      {m.description ?? m.category.name}
                    </p>
                    <div className="flex flex-col gap-1.75">
                      <Label htmlFor={inputId} required>
                        Categoría
                      </Label>
                      <Select
                        id={inputId}
                        ref={(el) => {
                          selectRefs.current[key] = el;
                        }}
                        value={mirrorCategoryIds[m.chainId] ?? ""}
                        error={errors[key]}
                        onChange={(e) => {
                          setMirrorCategoryIds((prev) => ({ ...prev, [m.chainId]: e.target.value }));
                          clearError(key);
                        }}
                      >
                        <option value="">Elegí una categoría activa</option>
                        {mirrorCategoryOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                      <FieldNote>
                        Antes: <CategoryDot color={m.category.color} /> {m.category.name}, dada de baja.
                      </FieldNote>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3.5 · Caja de consecuencia — último elemento del cuerpo */}
          <div
            id={RESULT_BOX_ID}
            aria-live="polite"
            aria-busy={isLoadingPreview}
            className="rounded-ctl border border-line bg-panel-2 px-3.25 py-2.75 flex items-start gap-2.5"
          >
            <CalendarSync size={16} className="text-ink-2 shrink-0 mt-px" aria-hidden="true" />
            <div className="min-w-0 space-y-1.5 text-[13px] text-ink">
              <p className="m-0">
                Desde <span className="font-semibold">{formatMonthShort(reopenMonth)}</span> aparece{" "}
                <span className="font-semibold">{FREQUENCY_LABEL_LOWER[frequency] ?? "cada mes"}</span>, sin fecha de
                fin.
              </p>

              {filler.count >= 2 && (
                <p className="m-0">
                  Se anulan <span className="font-semibold">{filler.count} apariciones</span>, entre{" "}
                  <span className="font-semibold">{formatMonthShort(filler.first!)}</span> y{" "}
                  <span className="font-semibold">{formatMonthShort(filler.last!)}</span>: se siguen viendo en su mes,
                  pero no suman.
                </p>
              )}
              {filler.count === 1 && (
                <p className="m-0">
                  Se anula <span className="font-semibold">una aparición</span>:{" "}
                  <span className="font-semibold">{formatMonthShort(filler.first!)}</span>. Se sigue viendo en su mes,
                  pero no suma.
                </p>
              )}

              {isLoadingPreview && <SkeletonLine height={13} width="70%" />}

              {mirrorNames.length >= 2 && (
                <p className="m-0">
                  También se reabren <span className="font-semibold">{mirrorNames.length} calculados</span>:{" "}
                  {mirrorNames.join(", ")}.
                </p>
              )}
              {mirrorNames.length === 1 && (
                <p className="m-0">
                  También se reabre el calculado <span className="font-semibold">{mirrorNames[0]}</span>.
                </p>
              )}
            </div>
          </div>
        </div>
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
          disabled={isReopening || isLoadingPreview}
          aria-describedby={isLoadingPreview ? RESULT_BOX_ID : undefined}
        >
          {isReopening ? "Reabriendo…" : "Reabrir"}
        </Button>
      </ModalShellFooter>
    </ModalShell>
  );
}
