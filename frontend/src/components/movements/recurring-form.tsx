"use client";

/**
 * RecurringForm — composición de ESCRITORIO (capa 3) del form de movimiento
 * fijo (RF-MF-001/003). Consume `useRecurringFormLogic` (capa 1) y arma su
 * propia UI con las primitivas del DS (capa 2) — docs/design.md §Superficie
 * de captura → "0. Encuadre — una lógica, dos composiciones". Su composición
 * hermana en régimen de captura es `CaptureRecurringForm` (components/capture/).
 *
 * Este componente NO cambió su render respecto de la versión previa al
 * refactor de capas — mismo JSX, mismos ids, mismas clases.
 */

import { Controller } from "react-hook-form";
import Link from "next/link";
import { AlertTriangle, Repeat, ArrowDown, ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoreOptionsSection } from "@/components/movements/more-options-section";
import { type Category } from "@/types/category";
import { CategoryFormModal } from "@/app/(app)/configuracion/categorias/category-form-modal";
import { type Recurring } from "@/types/recurring";
import { ActiveLimitDialog } from "@/components/limits/active-limit-dialog";
import type { MovementFormFooterState } from "@/components/movements/movement-form-footer";
import {
  useRecurringFormLogic,
  FREQUENCY_OPTIONS,
  FREQUENCY_LABEL_LOWER,
  type RecurringPrefill,
} from "@/hooks/use-recurring-form-logic";
import { sanitizeAmountInput } from "@/lib/format";
import { cn } from "@/lib/utils";

export type { RecurringPrefill };

// ─── Props ────────────────────────────────────────────────────────────────────

interface RecurringFormProps {
  recurring: Recurring | null;
  onClose: () => void;
  defaultMonth?: string;
  viewMonth?: string;
  /** true si, en edición, el fijo está ACTUALMENTE anulado para el mes visualizado — alimenta D16. */
  editingSkipped?: boolean;
  /** Prefill de "Duplicar movimiento" — solo aplica en modo crear. */
  prefill?: RecurringPrefill | null;
  /** La zona de acción es un slot del envase — ver `movement-form-footer.ts`. */
  onFooterStateChange: (state: MovementFormFooterState) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function RecurringForm({
  recurring,
  onClose,
  defaultMonth,
  viewMonth,
  editingSkipped,
  prefill,
  onFooterStateChange,
}: RecurringFormProps) {
  const logic = useRecurringFormLogic({
    recurring,
    onClose,
    defaultMonth,
    viewMonth,
    editingSkipped,
    prefill,
    onFooterStateChange,
  });

  const {
    formId,
    isEditing,
    register,
    control,
    errors,
    amountFieldRegister,
    setValue,
    selectedType,
    selectedFrequency,
    selectedCurrency,
    exchangeRateInput,
    selectedPaymentMethodId,
    selectedAutoDebit,
    defaultCurrency,
    isExchangeRateModified,
    exchangeRateError,
    recurringMonthNote,
    availableCategories,
    noCategoriesAvailable,
    onSubmit,
    showCategoryModal,
    openCategoryModal,
    closeCategoryModal,
    handleCategoryCreated,
    crossedLimits,
    handleCancelLimitDialog,
    handleConfirmSaveAnyway,
    isLoading,
  } = logic;

  return (
    <>
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto px-[22px] pb-[22px] space-y-[14px]">
          {/* ── Tipo (toggle o read-only en edición) ── */}
          {isEditing ? (
            <div className="flex flex-col gap-[7px]">
              <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Tipo
              </Label>
              <div className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px] text-[14px] font-semibold text-ink-2">
                {recurring?.type === "EXPENSE" ? (
                  <ArrowDown size={15} className="text-expense-ink" aria-hidden="true" />
                ) : (
                  <ArrowUp size={15} className="text-income-ink" aria-hidden="true" />
                )}
                {recurring?.type === "EXPENSE" ? "Gasto" : "Ingreso"}
              </div>
              {/* Campo oculto para que RHF lo tenga en el form state */}
              <input type="hidden" {...register("type")} />
            </div>
          ) : (
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => field.onChange("EXPENSE")}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-ctl border-[1.5px] px-3 py-3 text-[14px] font-semibold transition-colors duration-[140ms] cursor-pointer",
                      "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--expense-soft)]",
                      field.value === "EXPENSE"
                        ? "border-expense bg-expense-soft text-expense-ink"
                        : "border-line bg-panel text-muted hover:text-ink",
                    )}
                  >
                    <ArrowDown size={16} aria-hidden="true" />
                    Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange("INCOME")}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-ctl border-[1.5px] px-3 py-3 text-[14px] font-semibold transition-colors duration-[140ms] cursor-pointer",
                      "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--income-soft)]",
                      field.value === "INCOME"
                        ? "border-income bg-income-soft text-income-ink"
                        : "border-line bg-panel text-muted hover:text-ink",
                    )}
                  >
                    <ArrowUp size={16} aria-hidden="true" />
                    Ingreso
                  </button>
                </div>
              )}
            />
          )}

          {/* ── Monto ── */}
          <div className="flex flex-col gap-[7px]">
            <Label htmlFor={`${formId}-amount`} required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Monto
            </Label>
            <div
              className={cn(
                "flex items-center gap-2 rounded-ctl border-[1.5px] px-[13px] py-[11px] transition-colors duration-[140ms]",
                "focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]",
                errors.amountInput
                  ? "border-expense shadow-[0_0_0_3px_var(--expense-soft)]"
                  : "border-line-strong bg-panel",
              )}
            >
              <span className="text-[15px] text-muted mono shrink-0">$</span>
              <input
                id={`${formId}-amount`}
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                className="flex-1 border-none outline-none bg-transparent mono text-[20px] font-semibold tracking-[-0.01em] text-ink placeholder:text-faint"
                {...amountFieldRegister}
                onChange={(e) => {
                  e.target.value = sanitizeAmountInput(e.target.value);
                  void amountFieldRegister.onChange(e);
                }}
              />
            </div>
            {errors.amountInput && (
              <p className="text-[12px] text-expense-ink">{errors.amountInput.message}</p>
            )}
          </div>

          {/* ── Mes de inicio (solo en modo crear) ── */}
          {!isEditing && (
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor={`${formId}-start-month`} required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Mes de inicio
              </Label>
              <Input
                id={`${formId}-start-month`}
                type="month"
                error={errors.startMonth?.message}
                {...register("startMonth")}
              />
              <p className="text-[12.5px] text-muted">
                Mes a partir del cual aparece este gasto fijo
              </p>
            </div>
          )}

          {/* ── Frecuencia: selector en crear / read-only con badge en editar ── */}
          {isEditing ? (
            <div className="flex flex-col gap-[7px]">
              <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Frecuencia
              </Label>
              <div className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px] text-[14px] font-semibold text-ink-2">
                <Repeat size={15} className="text-accent-ink shrink-0" aria-hidden="true" />
                {FREQUENCY_OPTIONS.find((o) => o.value === selectedFrequency)?.label ?? "Mensual"}
              </div>
              <input type="hidden" {...register("frequency")} />
            </div>
          ) : (
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor={`${formId}-frequency`} required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Frecuencia
              </Label>
              <Controller
                name="frequency"
                control={control}
                render={({ field }) => (
                  <Select
                    id={`${formId}-frequency`}
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    error={errors.frequency?.message}
                  >
                    {FREQUENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                )}
              />
            </div>
          )}

          {/* ── Categoría ── */}
          <div className="flex flex-col gap-[7px]">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${formId}-category`} required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Categoría
              </Label>
              <button
                type="button"
                onClick={openCategoryModal}
                className="text-[12.5px] font-semibold text-accent-ink hover:text-accent transition-colors duration-[140ms] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] rounded-sm"
              >
                + Nueva
              </button>
            </div>

            {noCategoriesAvailable ? (
              <div className="flex items-start gap-[11px] rounded-ctl border px-[14px] py-[13px] bg-expense-soft" style={{ borderColor: "oklch(0.57 0.16 27 / 0.25)" }}>
                <AlertTriangle size={18} className="text-expense-ink shrink-0 mt-[1px]" aria-hidden="true" />
                <div className="text-[13px] leading-[1.45] text-expense-ink">
                  <b className="font-bold">Sin categorías para este tipo.</b>{" "}
                  <Link
                    href="/configuracion/categorias"
                    className="font-bold underline underline-offset-[2px] text-expense-ink hover:opacity-80"
                    onClick={onClose}
                  >
                    Creá una categoría
                  </Link>{" "}
                  o usá el botón &ldquo;+ Nueva&rdquo; de arriba.
                </div>
              </div>
            ) : (
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <Select
                    id={`${formId}-category`}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.categoryId?.message}
                  >
                    <option value="">Seleccioná una categoría</option>
                    {availableCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                )}
              />
            )}
          </div>

          {/* ── Nota de recurrencia (solo en crear): copy dinámico según frecuencia ── */}
          {!isEditing && (
            <div className="flex items-center gap-[7px] pt-[2px] text-[12.5px] text-muted">
              <Repeat size={14} className="text-accent-ink shrink-0" aria-hidden="true" />
              Se registra automáticamente {FREQUENCY_LABEL_LOWER[selectedFrequency]} a partir del mes de inicio.
            </div>
          )}

          {/* ── Descripción ── */}
          <div className="flex flex-col gap-[7px]">
            <Label htmlFor={`${formId}-description`} className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Descripción{" "}
              <span className="text-faint font-normal">(opcional)</span>
            </Label>
            <Input
              id={`${formId}-description`}
              type="text"
              placeholder="Ej: Alquiler departamento"
              error={errors.description?.message}
              {...register("description")}
            />
          </div>

          {/* ── Más opciones: moneda+cotización + método de pago (P4) ── */}
          <MoreOptionsSection
            idPrefix={formId}
            currency={selectedCurrency}
            exchangeRateInput={exchangeRateInput}
            defaultCurrency={defaultCurrency}
            isExchangeRateModified={isExchangeRateModified}
            exchangeRateError={exchangeRateError}
            recurringMonthNote={recurringMonthNote}
            onCurrencyChange={(val) => setValue("currency", val)}
            onExchangeRateChange={(val) => setValue("exchangeRateInput", val)}
            paymentMethodId={selectedPaymentMethodId}
            onPaymentMethodChange={(val) => setValue("paymentMethodId", val)}
            autoDebit={selectedAutoDebit}
            onAutoDebitChange={(checked) => setValue("autoDebit", checked)}
          />
        </div>
      </form>

      {/* ── Modal inline de nueva categoría (RF-MU-004) ── */}
      {showCategoryModal && (
        <CategoryFormModal
          category={null}
          lockScopeToType={selectedType}
          onClose={closeCategoryModal}
          onCreated={(cat: Category) => handleCategoryCreated(cat)}
        />
      )}

      {/* ── Aviso de alerta activa de límites (P2 — Fase 2, D11) ── */}
      {crossedLimits && (
        <ActiveLimitDialog
          crossed={crossedLimits}
          onCancel={handleCancelLimitDialog}
          onConfirm={handleConfirmSaveAnyway}
          isConfirming={isLoading}
          stacked
        />
      )}
    </>
  );
}
