"use client";

/**
 * InstallmentForm — composición de ESCRITORIO (capa 3) del form de
 * movimiento en cuotas (RF-MC-001/003). Consume `useInstallmentFormLogic`
 * (capa 1) y arma su propia UI con las primitivas del DS (capa 2) —
 * docs/design.md §Superficie de captura → "0. Encuadre — una lógica, dos
 * composiciones". Su composición hermana en régimen de captura es
 * `CaptureInstallmentForm` (components/capture/).
 *
 * Este componente NO cambió su render respecto de la versión previa al
 * refactor de capas — mismo JSX, mismos ids, mismas clases.
 */

import { Controller } from "react-hook-form";
import Link from "next/link";
import { AlertTriangle, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoreOptionsSection } from "@/components/movements/more-options-section";
import { type Category } from "@/types/category";
import { CategoryFormModal } from "@/app/(app)/configuracion/categorias/category-form-modal";
import { type InstallmentGroup } from "@/types/installment";
import { ActiveLimitDialog } from "@/components/limits/active-limit-dialog";
import type { MovementFormFooterState } from "@/components/movements/movement-form-footer";
import {
  useInstallmentFormLogic,
  type InstallmentPrefill,
} from "@/hooks/use-installment-form-logic";
import { sanitizeAmountInput, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export type { InstallmentPrefill };

// ─── Props ────────────────────────────────────────────────────────────────────

interface InstallmentFormProps {
  installment: InstallmentGroup | null;
  onClose: () => void;
  defaultMonth?: string;
  /** true si, en edición, la cuota está ACTUALMENTE anulada para el mes visualizado — alimenta D16. */
  editingSkipped?: boolean;
  /** Prefill de "Duplicar movimiento" — solo aplica en modo crear. */
  prefill?: InstallmentPrefill | null;
  /** La zona de acción es un slot del envase — ver `movement-form-footer.ts`. */
  onFooterStateChange: (state: MovementFormFooterState) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function InstallmentForm({
  installment,
  onClose,
  defaultMonth,
  editingSkipped,
  prefill,
  onFooterStateChange,
}: InstallmentFormProps) {
  const logic = useInstallmentFormLogic({
    installment,
    onClose,
    defaultMonth,
    editingSkipped,
    prefill,
    onFooterStateChange,
  });

  const {
    formId,
    register,
    control,
    errors,
    amountFieldRegister,
    setValue,
    selectedCurrency,
    exchangeRateInput,
    selectedPaymentMethodId,
    selectedAutoDebit,
    defaultCurrency,
    isExchangeRateModified,
    exchangeRateError,
    planAmountCents,
    planTotalNum,
    planPreviewValid,
    isPlanCrossRate,
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
          {/* ── Tipo (read-only: siempre Gasto) ── */}
          <div className="flex flex-col gap-[7px]">
            <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Tipo
            </Label>
            <div className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px] text-[14px] font-semibold text-ink-2">
              <ArrowDown size={15} className="text-expense-ink" aria-hidden="true" />
              Gasto
            </div>
            <p className="text-[12px] text-muted">
              Los movimientos en cuotas son siempre de tipo Gasto en esta versión.
            </p>
          </div>

          {/* ── Monto por cuota ── */}
          <div className="flex flex-col gap-[7px]">
            <Label htmlFor={`${formId}-amount`} required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Monto por cuota
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

          {/* ── Cantidad de cuotas + Mes de inicio (grid 2-col) ── */}
          <div className="grid grid-cols-2 gap-[14px]">
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor={`${formId}-total`} required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Cant. de cuotas
              </Label>
              <Input
                id={`${formId}-total`}
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                placeholder="12"
                error={errors.totalInstallments?.message}
                {...register("totalInstallments")}
              />
            </div>
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
            </div>
          </div>
          {(errors.totalInstallments || errors.startMonth) && (
            <div className="space-y-1">
              {errors.totalInstallments && (
                <p className="text-[12px] text-expense-ink">{errors.totalInstallments.message}</p>
              )}
              {errors.startMonth && (
                <p className="text-[12px] text-expense-ink">{errors.startMonth.message}</p>
              )}
            </div>
          )}

          {/* ── Total del plan — preview en vivo, read-only, informativo (no valida) ── */}
          <div className="flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[4px] rounded-ctl border border-line bg-panel-2 px-[13px] py-[10px]">
            <span className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Total del plan
            </span>
            <div className="flex flex-col items-end gap-[2px] shrink-0">
              <span className="inline-flex items-center gap-[6px]">
                <span
                  className={cn(
                    "mono text-[16px] font-semibold whitespace-nowrap",
                    planPreviewValid ? "text-ink" : "text-muted",
                  )}
                >
                  {planPreviewValid
                    ? formatCurrency(planAmountCents! * planTotalNum, selectedCurrency)
                    : "—"}
                </span>
                {planPreviewValid && isPlanCrossRate && (
                  <span
                    className="inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em] mono shrink-0"
                    aria-label={`Total del plan en ${selectedCurrency}`}
                  >
                    {selectedCurrency}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "mono text-[11.5px] text-muted whitespace-nowrap",
                  !planPreviewValid && "invisible",
                )}
              >
                {planPreviewValid
                  ? `${planTotalNum} × ${formatCurrency(planAmountCents!, selectedCurrency)}`
                  : " "}
              </span>
            </div>
          </div>

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
                  <b className="font-bold">Sin categorías para Gasto.</b>{" "}
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

          {/* ── Descripción ── */}
          <div className="flex flex-col gap-[7px]">
            <Label htmlFor={`${formId}-description`} className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Descripción{" "}
              <span className="text-faint font-normal">(opcional)</span>
            </Label>
            <Input
              id={`${formId}-description`}
              type="text"
              placeholder="Ej: Notebook Lenovo"
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
          lockScopeToType="EXPENSE"
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
