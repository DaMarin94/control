"use client";

/**
 * CaptureRecurringForm — composición de la SUPERFICIE DE CAPTURA (capa 3)
 * del form de movimiento fijo (RF-MF-001/RF-APP-003). Consume
 * `useRecurringFormLogic` (capa 1, la MISMA que usa `RecurringForm` de
 * escritorio). Ver `capture-transaction-form.tsx` para el contrato general
 * del patrón — este archivo lo replica para Fijo.
 *
 * Solo crea (RF-APP-003) — `recurring` siempre `null`, por lo que el bloque
 * "Tipo"/"Frecuencia" read-only de edición nunca se renderiza acá.
 */

import { type RefObject } from "react";
import { Controller } from "react-hook-form";
import { AlertTriangle, Repeat, ArrowDown, ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CategoryFormModal } from "@/app/(app)/configuracion/categorias/category-form-modal";
import { ActiveLimitDialog } from "@/components/limits/active-limit-dialog";
import { CaptureMoreOptions } from "@/components/capture/capture-more-options";
import {
  useRecurringFormLogic,
  FREQUENCY_OPTIONS,
  FREQUENCY_LABEL_LOWER,
} from "@/hooks/use-recurring-form-logic";
import type { MovementFormFooterState } from "@/components/movements/movement-form-footer";
import { sanitizeAmountInput } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CaptureRecurringFormProps {
  defaultMonth?: string;
  onFooterStateChange: (state: MovementFormFooterState) => void;
  onCreateSuccess: () => void;
  /** Ref al cuerpo scrolleable (Zona 2, §1) — ver `capture-transaction-form.tsx`. */
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
}

const FIELD_INPUT_CLASS = "px-[14px] py-[13px] text-[16px] scroll-mt-[16px] scroll-mb-[88px]";

export function CaptureRecurringForm({ defaultMonth, onFooterStateChange, onCreateSuccess, scrollContainerRef }: CaptureRecurringFormProps) {
  const logic = useRecurringFormLogic({
    recurring: null,
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
    <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col flex-1 min-h-0">
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      {/* Columna de contenido — min(100%, 480px), centrada (§1). */}
      <div className="mx-auto w-full max-w-[480px] px-[16px] pt-[16px] pb-[20px]">
        {/* ── Toggle Gasto/Ingreso ── */}
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => field.onChange("EXPENSE")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-ctl border-[1.5px] py-[14px] text-[15px] font-semibold transition-colors duration-[140ms] cursor-pointer",
                  "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--expense-soft)]",
                  field.value === "EXPENSE"
                    ? "border-expense bg-expense-soft text-expense-ink"
                    : "border-line bg-panel text-muted",
                )}
              >
                <ArrowDown size={16} aria-hidden="true" />
                Gasto
              </button>
              <button
                type="button"
                onClick={() => field.onChange("INCOME")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-ctl border-[1.5px] py-[14px] text-[15px] font-semibold transition-colors duration-[140ms] cursor-pointer",
                  "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--income-soft)]",
                  field.value === "INCOME"
                    ? "border-income bg-income-soft text-income-ink"
                    : "border-line bg-panel text-muted",
                )}
              >
                <ArrowUp size={16} aria-hidden="true" />
                Ingreso
              </button>
            </div>
          )}
        />
        {errors.type && <p className="mt-[6px] text-[12px] text-expense-ink">{errors.type.message}</p>}

        {/* ── Monto — protagonista, 64px ── */}
        <div className="mt-[16px] flex flex-col gap-[6px]">
          <Label htmlFor={`${formId}-amount`} required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
            Monto
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

        {/* ── Mes de inicio ── */}
        <div className="mt-[20px] flex flex-col gap-[6px]">
          <Label htmlFor={`${formId}-start-month`} required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
            Mes de inicio
          </Label>
          <Input id={`${formId}-start-month`} type="month" error={errors.startMonth?.message} className={FIELD_INPUT_CLASS} {...register("startMonth")} />
          <p className="text-[12.5px] text-muted">Mes a partir del cual aparece este gasto fijo</p>
        </div>

        {/* ── Frecuencia ── */}
        <div className="mt-[16px] flex flex-col gap-[6px]">
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
                className={FIELD_INPUT_CLASS}
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
                <b className="font-bold">Sin categorías para este tipo.</b> Usá el botón &ldquo;+ Nueva&rdquo; de arriba.
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

        {/* ── Nota de recurrencia ── */}
        <div className="mt-[16px] flex items-center gap-[7px] text-[12.5px] text-muted">
          <Repeat size={14} className="text-accent-ink shrink-0" aria-hidden="true" />
          Se registra automáticamente {FREQUENCY_LABEL_LOWER[selectedFrequency]} a partir del mes de inicio.
        </div>

        {/* ── Descripción ── */}
        <div className="mt-[16px] flex flex-col gap-[6px]">
          <Label htmlFor={`${formId}-description`} className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
            Descripción <span className="text-faint font-normal">(opcional)</span>
          </Label>
          <Input
            id={`${formId}-description`}
            type="text"
            placeholder="Ej: Alquiler departamento"
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
            recurringMonthNote={recurringMonthNote}
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
          lockScopeToType={selectedType}
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
