"use client";

/**
 * Formulario de movimiento en cuotas (RF-MC-001 / RF-MC-003).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * - Badge "Gasto" read-only (cuotas son siempre EXPENSE)
 * - Monto por cuota: input mono 20px con prefijo "$"
 * - Grid 2-col para Cantidad de cuotas + Mes de inicio
 * - Footer: Cancelar / Guardar
 *
 * Lógica de negocio preservada intacta.
 */

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { AlertTriangle, Check, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoreOptionsSection } from "@/components/movements/more-options-section";
import { useCategories } from "@/hooks/use-categories";
import { useInstallments } from "@/hooks/use-installments";
import { useSettings } from "@/hooks/use-settings";
import { useReferenceRate } from "@/hooks/use-reference-rate";
import { useActiveLimitProjection } from "@/hooks/use-active-limit-projection";
import { useDefaultPaymentMethodPrefill } from "@/hooks/use-default-payment-method-prefill";
import { useToast } from "@/hooks/use-toast";
import { type Category, type CategoryScope } from "@/types/category";
import { CategoryFormModal } from "@/app/(app)/configuracion/categorias/category-form-modal";
import { type InstallmentGroup } from "@/types/installment";
import { ActiveLimitDialog } from "@/components/limits/active-limit-dialog";
import { toCanonicalAmountCents } from "@/lib/limits/project";
import type { LimitConfig } from "@/types/limit";
import {
  parseCurrencyInput,
  parseExchangeRateInput,
  formatExchangeRate,
  getCurrentMonth,
  sanitizeAmountInput,
  MAX_AMOUNT_CENTS,
} from "@/lib/format";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/settings";

// ─── Schema ───────────────────────────────────────────────────────────────────

const installmentSchema = z.object({
  amountInput: z
    .string()
    .min(1, "El monto es requerido")
    .refine((val) => parseCurrencyInput(val) !== null, {
      message: "Ingresá un monto mayor a 0",
    })
    .refine(
      (val) => {
        const cents = parseCurrencyInput(val);
        return cents === null || cents <= MAX_AMOUNT_CENTS;
      },
      { message: "El monto es demasiado grande" },
    ),
  currency: z.enum(["ARS", "USD", "EUR", "BRL"]),
  /** Input de cotización como string. Solo se valida cuando currency !== defaultCurrency. */
  exchangeRateInput: z.string(),
  totalInstallments: z
    .string()
    .min(1, "La cantidad de cuotas es requerida")
    .refine(
      (val) => {
        const num = parseInt(val, 10);
        return !isNaN(num) && num > 0 && Number.isInteger(num);
      },
      { message: "Ingresá una cantidad de cuotas mayor a 0" },
    ),
  startMonth: z
    .string()
    .min(1, "El mes de inicio es requerido")
    .regex(/^\d{4}-\d{2}$/, "El mes debe tener formato YYYY-MM"),
  categoryId: z.string().min(1, "La categoría es requerida"),
  /** Método de pago opcional (RF-PM-006). "" = ninguno. */
  paymentMethodId: z.string().optional(),
  /**
   * Débito automático (P4 — corrección de alcance). Atributo del movimiento;
   * el control solo se renderiza cuando el método elegido es de tipo DEBIT.
   */
  autoDebit: z.boolean().optional(),
  description: z.string().optional(),
});

type InstallmentFormData = z.infer<typeof installmentSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface InstallmentFormProps {
  installment: InstallmentGroup | null;
  onClose: () => void;
  defaultMonth?: string;
  /**
   * true si, en modo edición, la cuota está ACTUALMENTE anulada (skipped) para
   * el mes visualizado. El form no expone el toggle de anular — este flag
   * alimenta la intercepción de límites activos (D16). Ausente = false.
   */
  editingSkipped?: boolean;
}

/** Datos ya validados/parseados, pendientes de persistir tras "Guardar igual" (P2 — Fase 2). */
interface PendingSave {
  data: InstallmentFormData;
  amountCents: number;
  parsedExchangeRate: number;
  totalInstallments: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterCategoriesForExpense(
  categories: { id: string; name: string; scope: CategoryScope }[],
) {
  return categories.filter((cat) => cat.scope === "EXPENSE" || cat.scope === "BOTH");
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function InstallmentForm({ installment, onClose, defaultMonth, editingSkipped }: InstallmentFormProps) {
  const isEditing = installment !== null;
  const router = useRouter();
  const { toast } = useToast();
  const { categories } = useCategories();
  const { createInstallment, updateInstallment, isCreating, isUpdating } = useInstallments();
  const { defaultCurrency, lastExchangeRate } = useSettings();

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState<string | undefined>();
  const [isExchangeRateModified, setIsExchangeRateModified] = useState(false);

  // P2 — Fase 2: intercepción de límites activos al guardar (D11).
  const [crossedLimits, setCrossedLimits] = useState<LimitConfig[] | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  // Una cuota (recurrente) se chequea contra el MES EN CURSO real (D13), sin
  // importar el mes de inicio elegido.
  const { evaluate: evaluateActiveLimits } = useActiveLimitProjection(getCurrentMonth());

  const isLoading = isEditing ? isUpdating : isCreating;

  // Cotización pre-cargada inicial:
  // - Editando: la del grupo de cuotas (siempre presente, nunca null en el backend).
  // - Creando: se rellena luego desde referenceRate/lastExchangeRate.
  const initialEditingExchangeRateInput = isEditing
    ? formatExchangeRate(installment.exchangeRate ?? 1)
    : "";

  const defaultValues: InstallmentFormData = isEditing
    ? {
        amountInput: String(installment.amountCents / 100).replace(".", ","),
        currency: installment.currency ?? defaultCurrency,
        exchangeRateInput: initialEditingExchangeRateInput,
        totalInstallments: String(installment.totalInstallments),
        startMonth: installment.startMonth,
        categoryId: installment.categoryId,
        paymentMethodId: installment.paymentMethodId ?? "",
        autoDebit: installment.autoDebit ?? false,
        description: installment.description ?? "",
      }
    : {
        amountInput: "",
        currency: defaultCurrency,
        exchangeRateInput: "",
        totalInstallments: "",
        startMonth: defaultMonth ?? getCurrentMonth(),
        categoryId: "",
        paymentMethodId: "",
        autoDebit: false,
        description: "",
      };

  const [preloadedExchangeRateInput, setPreloadedExchangeRateInput] = useState(
    initialEditingExchangeRateInput,
  );

  // En edición: moneda original al abrir el modal. Si el usuario la cambia, se
  // pre-carga la cotización de referencia para la nueva moneda (como en creación).
  const initialCurrencyRef = useRef<CurrencyCode>(
    isEditing ? (installment?.currency ?? defaultCurrency) : defaultCurrency,
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<InstallmentFormData>({
    resolver: zodResolver(installmentSchema),
    defaultValues,
  });

  // Registro del campo Monto — se reusa en el onChange que sanitiza la entrada
  // (#4: solo dígitos + un único separador decimal) antes de que RHF la capture.
  const amountFieldRegister = register("amountInput");

  const selectedCurrency = watch("currency") as CurrencyCode;
  const selectedStartMonth = watch("startMonth");
  const exchangeRateInput = watch("exchangeRateInput");
  const selectedPaymentMethodId = watch("paymentMethodId") ?? "";
  const selectedAutoDebit = watch("autoDebit") ?? false;

  // Prefill del método de pago por defecto — solo al crear una cuota
  // (RF-PM-007). Valor inicial editable; no pisa una selección manual del usuario.
  useDefaultPaymentMethodPrefill({
    slot: "cuota",
    isEditing,
    currentPaymentMethodId: selectedPaymentMethodId,
    setPaymentMethodId: (id) => setValue("paymentMethodId", id),
  });

  // Mes relevante para la cotización de referencia:
  // - Crear: mes de inicio seleccionado (o mes actual como fallback)
  // - Editar: el startMonth del grupo (no cambia en edición)
  const referenceMonth = isEditing
    ? (installment.startMonth ?? getCurrentMonth())
    : (selectedStartMonth?.length >= 7 ? selectedStartMonth : getCurrentMonth());

  // Hook de cotización de referencia — Fase 1.2.4
  const { referenceRate } = useReferenceRate({
    month: referenceMonth,
    currency: selectedCurrency,
    defaultCurrency,
  });

  useEffect(() => {
    if (isEditing) {
      const newCurrency = installment.currency ?? defaultCurrency;
      reset({
        amountInput: String(installment.amountCents / 100).replace(".", ","),
        currency: newCurrency,
        exchangeRateInput: formatExchangeRate(installment.exchangeRate ?? 1),
        totalInstallments: String(installment.totalInstallments),
        startMonth: installment.startMonth,
        categoryId: installment.categoryId,
        paymentMethodId: installment.paymentMethodId ?? "",
        autoDebit: installment.autoDebit ?? false,
        description: installment.description ?? "",
      });
      // Actualizar la referencia de moneda inicial para que el effect de pre-carga
      // pueda detectar correctamente si el usuario la cambia en esta sesión.
      initialCurrencyRef.current = newCurrency;
      setIsExchangeRateModified(false);
    }
  }, [installment, isEditing, reset, defaultCurrency]);

  // Pre-cargar defaultCurrency al crear cuando cambia
  useEffect(() => {
    if (!isEditing) {
      setValue("currency", defaultCurrency);
    }
  }, [defaultCurrency, isEditing, setValue]);

  // Pre-cargar cotización: prioridad referenceRate → lastExchangeRate → vacío (Fase 1.2.4).
  // En modo crear: siempre al cambiar referencia o moneda.
  // En modo edición: solo si el usuario cambió la moneda (≠ moneda original al abrir) y
  // no modificó la cotización manualmente.
  useEffect(() => {
    const currencyChanged = selectedCurrency !== initialCurrencyRef.current;
    if (isEditing && !currencyChanged) return;
    if (isEditing && isExchangeRateModified) return;
    const rate =
      referenceRate !== null
        ? referenceRate
        : lastExchangeRate;
    const formatted = rate !== null ? formatExchangeRate(rate) : "";
    setPreloadedExchangeRateInput(formatted);
    setValue("exchangeRateInput", formatted);
    if (!isEditing) {
      setIsExchangeRateModified(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceRate, lastExchangeRate, isEditing, selectedCurrency, setValue]);

  // Detectar si el usuario modificó la cotización respecto al valor pre-cargado
  useEffect(() => {
    setIsExchangeRateModified(
      exchangeRateInput !== preloadedExchangeRateInput && exchangeRateInput !== ""
    );
  }, [exchangeRateInput, preloadedExchangeRateInput]);

  const availableCategories = filterCategoriesForExpense(
    (categories ?? []).map((c) => ({ id: c.id, name: c.name, scope: c.scope })),
  );

  const noCategoriesAvailable = availableCategories.length === 0;

  async function persist({ data, amountCents, parsedExchangeRate, totalInstallments }: PendingSave) {
    if (isEditing) {
      const result = await updateInstallment(installment.id, {
        amountCents,
        totalInstallments,
        startMonth: data.startMonth,
        categoryId: data.categoryId,
        description: data.description || null,
        currency: data.currency,
        exchangeRate: parsedExchangeRate,
        paymentMethodId: data.paymentMethodId || null,
        autoDebit: data.autoDebit ?? false,
      });

      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar el movimiento.");
        return;
      }

      toast.success("Movimiento actualizado correctamente.");
      onClose();
    } else {
      const result = await createInstallment({
        type: "EXPENSE",
        amountCents,
        totalInstallments,
        startMonth: data.startMonth,
        categoryId: data.categoryId,
        description: data.description || undefined,
        currency: data.currency,
        exchangeRate: parsedExchangeRate,
        paymentMethodId: data.paymentMethodId || undefined,
        autoDebit: data.autoDebit ?? false,
      });

      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar el movimiento.");
        return;
      }

      const startMonth = data.startMonth;
      toast.success("Movimiento guardado correctamente.", {
        action: {
          label: "Ir a ver",
          onClick: () => router.push(`/mes?month=${startMonth}`),
        },
      });

      onClose();
    }
  }

  async function onSubmit(data: InstallmentFormData) {
    const amountCents = parseCurrencyInput(data.amountInput);
    if (amountCents === null) return;

    const totalInstallments = parseInt(data.totalInstallments, 10);

    // Cuando moneda === defaultCurrency el campo cotización está oculto (Fase 1.2.4).
    // El backend ignora exchangeRate en ese caso, así que enviamos 1 directamente.
    // Solo cuando moneda ≠ default validamos y parseamos el input visible.
    let parsedExchangeRate: number;
    if (data.currency === defaultCurrency) {
      parsedExchangeRate = 1;
      setExchangeRateError(undefined);
    } else {
      const parsed = parseExchangeRateInput(data.exchangeRateInput);
      if (parsed === null) {
        setExchangeRateError("Ingresá una cotización mayor a 0");
        return;
      }
      parsedExchangeRate = parsed;
      setExchangeRateError(undefined);
    }

    const pending: PendingSave = { data, amountCents, parsedExchangeRate, totalInstallments };

    // P2 — Fase 2: compuerta de intercepción (D11). Sin cruces → persiste
    // directo, EXACTAMENTE como hoy (cero fricción). Con cruces → aviso.
    const canonicalAmountCents = toCanonicalAmountCents(
      amountCents,
      data.currency,
      defaultCurrency,
      parsedExchangeRate,
    );
    const crossed = evaluateActiveLimits({
      type: "EXPENSE",
      convertedAmountCents: canonicalAmountCents,
      categoryId: data.categoryId,
      section: "cuotas",
      skipped: editingSkipped ?? false,
      editingId: isEditing ? installment.id : undefined,
    });

    if (crossed.length > 0) {
      setCrossedLimits(crossed);
      setPendingSave(pending);
      return;
    }

    await persist(pending);
  }

  function handleCancelLimitDialog() {
    setCrossedLimits(null);
    setPendingSave(null);
  }

  async function handleConfirmSaveAnyway() {
    if (!pendingSave) return;
    const toPersist = pendingSave;
    setCrossedLimits(null);
    setPendingSave(null);
    await persist(toPersist);
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col flex-1 min-h-0">
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
            <Label htmlFor="inst-amount" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
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
                id="inst-amount"
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
              <Label htmlFor="inst-total" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Cant. de cuotas
              </Label>
              <Input
                id="inst-total"
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
              <Label htmlFor="inst-start-month" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Mes de inicio
              </Label>
              <Input
                id="inst-start-month"
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

          {/* ── Categoría ── */}
          <div className="flex flex-col gap-[7px]">
            <div className="flex items-center justify-between">
              <Label htmlFor="inst-category" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Categoría
              </Label>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
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
                    id="inst-category"
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
            <Label htmlFor="inst-description" className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Descripción{" "}
              <span className="text-faint font-normal">(opcional)</span>
            </Label>
            <Input
              id="inst-description"
              type="text"
              placeholder="Ej: Notebook Lenovo"
              error={errors.description?.message}
              {...register("description")}
            />
          </div>

          {/* ── Más opciones: moneda+cotización + método de pago (P4) ── */}
          <MoreOptionsSection
            idPrefix="inst"
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

        {/* ── Footer (pineado — hermano del cuerpo scrolleable, no hijo) ── */}
        <div className="flex items-center justify-end gap-3 px-[22px] py-4 border-t border-hair bg-panel-2 shrink-0">
          <div className="flex gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || noCategoriesAvailable}
              className="gap-1.5"
            >
              <Check size={14} aria-hidden="true" />
              {isLoading
                ? "Guardando..."
                : isEditing
                  ? "Guardar cambios"
                  : "Guardar"}
            </Button>
          </div>
        </div>
      </form>

      {/* ── Modal inline de nueva categoría (RF-MU-004) ── */}
      {showCategoryModal && (
        <CategoryFormModal
          category={null}
          lockScopeToType="EXPENSE"
          onClose={() => setShowCategoryModal(false)}
          onCreated={(cat: Category) => {
            setValue("categoryId", cat.id);
            setShowCategoryModal(false);
          }}
        />
      )}

      {/* ── Aviso de alerta activa de límites (P2 — Fase 2, D11) ── */}
      {crossedLimits && (
        <ActiveLimitDialog
          crossed={crossedLimits}
          onCancel={handleCancelLimitDialog}
          onConfirm={handleConfirmSaveAnyway}
          isConfirming={isLoading}
        />
      )}
    </>
  );
}
