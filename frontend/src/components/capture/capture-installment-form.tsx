"use client";

/**
 * CaptureInstallmentForm — composición de la SUPERFICIE DE CAPTURA (capa 3)
 * del form de movimiento en cuotas (RF-MC-001/RF-APP-003). Consume
 * `useInstallmentFormLogic` (capa 1, la MISMA que usa `InstallmentForm` de
 * escritorio). Ver `capture-transaction-form.tsx` para el contrato general
 * del patrón — este archivo lo replica para Cuotas.
 *
 * Solo crea (RF-APP-003) — `installment` siempre `null`.
 */

import { type RefObject } from "react";
import { Controller } from "react-hook-form";
import { AlertTriangle, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CategoryFormModal } from "@/app/(app)/configuracion/categorias/category-form-modal";
import { ActiveLimitDialog } from "@/components/limits/active-limit-dialog";
import { CaptureMoreOptions } from "@/components/capture/capture-more-options";
import { useInstallmentFormLogic } from "@/hooks/use-installment-form-logic";
import type { MovementFormFooterState } from "@/components/movements/movement-form-footer";
import { sanitizeAmountInput, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CaptureInstallmentFormProps {
  defaultMonth?: string;
  onFooterStateChange: (state: MovementFormFooterState) => void;
  onCreateSuccess: () => void;
  /** Ref al cuerpo scrolleable (Zona 2, §1) — ver `capture-transaction-form.tsx`. */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

const FIELD_INPUT_CLASS = "px-[14px] py-[13px] text-[16px] scroll-mt-[16px] scroll-mb-[88px]";

export function CaptureInstallmentForm({ defaultMonth, onFooterStateChange, onCreateSuccess, scrollContainerRef }: CaptureInstallmentFormProps) {
  const logic = useInstallmentFormLogic({
    installment: null,
    onClose: () => {
      /* no-op: no hay "Cancelar" en esta superficie (docs/design.md §8) */
    },
    defaultMonth,
    onFooterStateChange,
    onCreateSuccess,
  });

  const {
    formId,
    control,
    register,
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
    <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col flex-1 min-h-0">
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      {/* Columna de contenido — min(100%, 480px), centrada (§1). */}
      <div className="mx-auto w-full max-w-[480px] px-[16px] pt-[16px] pb-[20px]">
        {/* ── Tipo (read-only: siempre Gasto) ── */}
        <div className="flex flex-col gap-[6px]">
          <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">Tipo</Label>
          <div className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[14px] py-[13px] text-[14px] font-semibold text-ink-2">
            <ArrowDown size={15} className="text-expense-ink" aria-hidden="true" />
            Gasto
          </div>
          <p className="text-[12px] text-muted">Los movimientos en cuotas son siempre de tipo Gasto en esta versión.</p>
        </div>

        {/* ── Monto por cuota — protagonista, 64px ── */}
        <div className="mt-[16px] flex flex-col gap-[6px]">
          <Label htmlFor={`${formId}-amount`} required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
            Monto por cuota
          </Label>
          <div
            className={cn(
              "flex w-full items-center gap-2 rounded-ctl border-[1.5px] px-[14px] py-[10.5px] transition-colors duration-[140ms]",
              "focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]",
              errors.amountInput
                ? "border-expense shadow-[0_0_0_3px_var(--expense-soft)]"
                : "border-line-strong bg-panel",
            )}
          >
            <span className="shrink-0 text-[20px] text-muted mono">$</span>
            <input
              id={`${formId}-amount`}
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              className="flex-1 min-w-0 border-none outline-none bg-transparent mono text-[28px] font-semibold tracking-[-0.01em] text-ink placeholder:text-faint scroll-mt-[16px] scroll-mb-[88px]"
              {...amountFieldRegister}
              onChange={(e) => {
                e.target.value = sanitizeAmountInput(e.target.value);
                void amountFieldRegister.onChange(e);
              }}
            />
          </div>
          {errors.amountInput && <p className="text-[12px] text-expense-ink">{errors.amountInput.message}</p>}
        </div>

        {/* ── Cantidad de cuotas + Mes de inicio ── */}
        <div className="mt-[20px] grid grid-cols-2 gap-[14px]">
          <div className="flex min-w-0 flex-col gap-[6px]">
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
              className={FIELD_INPUT_CLASS}
              {...register("totalInstallments")}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-[6px]">
            <Label htmlFor={`${formId}-start-month`} required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Mes de inicio
            </Label>
            <Input
              id={`${formId}-start-month`}
              type="month"
              error={errors.startMonth?.message}
              className={FIELD_INPUT_CLASS}
              {...register("startMonth")}
            />
          </div>
        </div>
        {(errors.totalInstallments || errors.startMonth) && (
          <div className="mt-[6px] space-y-1">
            {errors.totalInstallments && <p className="text-[12px] text-expense-ink">{errors.totalInstallments.message}</p>}
            {errors.startMonth && <p className="text-[12px] text-expense-ink">{errors.startMonth.message}</p>}
          </div>
        )}

        {/* ── Total del plan — preview en vivo, informativo ── */}
        <div className="mt-[16px] flex flex-wrap items-center justify-between gap-x-[16px] gap-y-[4px] rounded-ctl border border-line bg-panel-2 px-[14px] py-[12px]">
          <span className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">Total del plan</span>
          <div className="flex flex-col items-end gap-[2px] shrink-0">
            <span className="inline-flex items-center gap-[6px]">
              <span className={cn("mono text-[16px] font-semibold whitespace-nowrap", planPreviewValid ? "text-ink" : "text-muted")}>
                {planPreviewValid ? formatCurrency(planAmountCents! * planTotalNum, selectedCurrency) : "—"}
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
            <span className={cn("mono text-[11.5px] text-muted whitespace-nowrap", !planPreviewValid && "invisible")}>
              {planPreviewValid ? `${planTotalNum} × ${formatCurrency(planAmountCents!, selectedCurrency)}` : " "}
            </span>
          </div>
        </div>

        {/* ── Categoría ── */}
        <div className="mt-[16px] flex flex-col gap-[6px]">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${formId}-category`} required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Categoría
            </Label>
            <button
              type="button"
              onClick={openCategoryModal}
              className="min-h-[44px] inline-flex items-center -my-[13px] text-[12.5px] font-semibold text-accent-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)] rounded-sm"
            >
              + Nueva
            </button>
          </div>

          {noCategoriesAvailable ? (
            <div className="flex items-start gap-[11px] rounded-ctl border px-[14px] py-[13px] bg-expense-soft" style={{ borderColor: "oklch(0.57 0.16 27 / 0.25)" }}>
              <AlertTriangle size={18} className="text-expense-ink shrink-0 mt-[1px]" aria-hidden="true" />
              <div className="text-[13px] leading-[1.45] text-expense-ink">
                <b className="font-bold">Sin categorías para Gasto.</b> Usá el botón &ldquo;+ Nueva&rdquo; de arriba.
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
                  className={FIELD_INPUT_CLASS}
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
        <div className="mt-[16px] flex flex-col gap-[6px]">
          <Label htmlFor={`${formId}-description`} className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
            Descripción <span className="text-faint font-normal">(opcional)</span>
          </Label>
          <Input
            id={`${formId}-description`}
            type="text"
            placeholder="Ej: Notebook Lenovo"
            error={errors.description?.message}
            className={FIELD_INPUT_CLASS}
            {...register("description")}
          />
        </div>

        {/* ── Más opciones ── */}
        <div className="mt-[16px] border-t border-line pt-[16px]">
          <CaptureMoreOptions
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
      </div>
      </div>

      {/* ── Modal inline de nueva categoría (RF-MU-004) ── */}
      {showCategoryModal && (
        <CategoryFormModal
          category={null}
          lockScopeToType="EXPENSE"
          onClose={closeCategoryModal}
          onCreated={handleCategoryCreated}
        />
      )}

      {/* ── Aviso de alerta activa de límites — sin modal debajo, capa normal (§10) ── */}
      {crossedLimits && (
        <ActiveLimitDialog
          crossed={crossedLimits}
          onCancel={handleCancelLimitDialog}
          onConfirm={handleConfirmSaveAnyway}
          isConfirming={isLoading}
          stacked={false}
          expandedButtons
        />
      )}
    </form>
  );
}
