"use client";

/**
 * useInstallmentFormLogic — capa 1 (lógica de feature, agnóstica de UI) del
 * form de movimiento en cuotas (RF-MC-001/003), extraída de
 * `installment-form.tsx` al separar lógica y composición (docs/design.md
 * §Superficie de captura → "0. Encuadre — una lógica, dos composiciones").
 * Ver `use-transaction-form-logic.ts` para el contrato general del patrón.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useForm, type Control, type FieldErrors, type UseFormRegister, type UseFormRegisterReturn, type UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useCategories } from "@/hooks/use-categories";
import { useInstallments } from "@/hooks/use-installments";
import { useSettings } from "@/hooks/use-settings";
import { useReferenceRate } from "@/hooks/use-reference-rate";
import { useActiveLimitProjection } from "@/hooks/use-active-limit-projection";
import { useDefaultPaymentMethodPrefill } from "@/hooks/use-default-payment-method-prefill";
import { useToast } from "@/hooks/use-toast";
import { useUndoHistory } from "@/hooks/use-history";
import { buildUndoAction } from "@/lib/toast-undo";
import { type Category, type CategoryScope } from "@/types/category";
import { type InstallmentGroup } from "@/types/installment";
import { toCanonicalAmountCents } from "@/lib/limits/project";
import type { LimitConfig } from "@/types/limit";
import type { MovementFormFooterState } from "@/components/movements/movement-form-footer";
import {
  parseCurrencyInput,
  parseExchangeRateInput,
  formatExchangeRate,
  getCurrentMonth,
  MAX_AMOUNT_CENTS,
  MAX_DESCRIPTION_LENGTH,
} from "@/lib/format";
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
  paymentMethodId: z.string().optional(),
  autoDebit: z.boolean().optional(),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH, "La descripción no puede superar los 200 caracteres")
    .optional(),
});

export type InstallmentFormData = z.infer<typeof installmentSchema>;

// ─── Prefill de "Duplicar movimiento" ──────────────────────────────────────────

export interface InstallmentPrefill {
  amountCents: number;
  currency: CurrencyCode;
  exchangeRate: number;
  totalInstallments: number;
  categoryId: string;
  paymentMethodId: string | null;
  autoDebit: boolean | null;
  description: string | null;
  startMonth: string;
}

export interface UseInstallmentFormLogicOptions {
  installment: InstallmentGroup | null;
  onClose: () => void;
  defaultMonth?: string;
  editingSkipped?: boolean;
  prefill?: InstallmentPrefill | null;
  onFooterStateChange: (state: MovementFormFooterState) => void;
  /** Ver `use-transaction-form-logic.ts` — comportamiento post-guardado (§9). */
  onCreateSuccess?: () => void;
}

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface InstallmentFormLogic {
  formId: string;
  isEditing: boolean;
  register: UseFormRegister<InstallmentFormData>;
  control: Control<InstallmentFormData>;
  errors: FieldErrors<InstallmentFormData>;
  amountFieldRegister: UseFormRegisterReturn<"amountInput">;
  setValue: UseFormSetValue<InstallmentFormData>;

  selectedCurrency: CurrencyCode;
  exchangeRateInput: string;
  selectedPaymentMethodId: string;
  selectedAutoDebit: boolean;
  defaultCurrency: CurrencyCode;
  isExchangeRateModified: boolean;
  exchangeRateError?: string;

  // Preview en vivo "Total del plan" (docs/design.md §"Total del plan de
  // cuotas — las tres superficies"): informativo, no valida ni bloquea.
  planAmountCents: number | null;
  planTotalNum: number;
  planPreviewValid: boolean;
  isPlanCrossRate: boolean;

  availableCategories: { id: string; name: string; scope: CategoryScope }[];
  noCategoriesAvailable: boolean;

  isLoading: boolean;

  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;

  showCategoryModal: boolean;
  openCategoryModal: () => void;
  closeCategoryModal: () => void;
  handleCategoryCreated: (category: Category) => void;

  crossedLimits: LimitConfig[] | null;
  handleCancelLimitDialog: () => void;
  handleConfirmSaveAnyway: () => Promise<void>;
}

export function useInstallmentFormLogic({
  installment,
  onClose,
  defaultMonth,
  editingSkipped,
  prefill,
  onFooterStateChange,
  onCreateSuccess,
}: UseInstallmentFormLogicOptions): InstallmentFormLogic {
  const formId = useId();
  const isEditing = installment !== null;
  const isPrefillActive = !isEditing && prefill != null;
  const router = useRouter();
  const { toast } = useToast();
  const { undo } = useUndoHistory();
  const { categories } = useCategories();
  const { createInstallment, updateInstallment, isCreating, isUpdating } = useInstallments();
  const { defaultCurrency, lastExchangeRate } = useSettings();

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState<string | undefined>();
  const [isExchangeRateModified, setIsExchangeRateModified] = useState(false);

  const [crossedLimits, setCrossedLimits] = useState<LimitConfig[] | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  // Una cuota (recurrente) se chequea contra el MES EN CURSO real (D13).
  const { evaluate: evaluateActiveLimits } = useActiveLimitProjection(getCurrentMonth());

  const isLoading = isEditing ? isUpdating : isCreating;

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
    : prefill
      ? {
          amountInput: String(prefill.amountCents / 100).replace(".", ","),
          currency: prefill.currency,
          exchangeRateInput: formatExchangeRate(prefill.exchangeRate ?? 1),
          totalInstallments: String(prefill.totalInstallments),
          startMonth: prefill.startMonth,
          categoryId: prefill.categoryId,
          paymentMethodId: prefill.paymentMethodId ?? "",
          autoDebit: prefill.autoDebit ?? false,
          description: prefill.description ?? "",
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

  const initialCurrencyRef = useRef<CurrencyCode>(
    isEditing
      ? (installment?.currency ?? defaultCurrency)
      : (prefill?.currency ?? defaultCurrency),
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

  const amountFieldRegister = register("amountInput");

  const selectedCurrency = watch("currency") as CurrencyCode;
  const selectedStartMonth = watch("startMonth");
  const exchangeRateInput = watch("exchangeRateInput");
  const selectedPaymentMethodId = watch("paymentMethodId") ?? "";
  const selectedAutoDebit = watch("autoDebit") ?? false;
  const watchedAmountInput = watch("amountInput");
  const watchedTotalInstallments = watch("totalInstallments");

  const planAmountCents = parseCurrencyInput(watchedAmountInput);
  const planTotalNum = parseInt(watchedTotalInstallments, 10);
  const planPreviewValid =
    planAmountCents !== null &&
    planAmountCents > 0 &&
    !errors.amountInput &&
    !isNaN(planTotalNum) &&
    planTotalNum > 0 &&
    !errors.totalInstallments;
  const isPlanCrossRate = selectedCurrency !== defaultCurrency;

  useDefaultPaymentMethodPrefill({
    slot: "cuota",
    isEditing,
    currentPaymentMethodId: selectedPaymentMethodId,
    setPaymentMethodId: (id) => setValue("paymentMethodId", id),
  });

  const referenceMonth = isEditing
    ? (installment.startMonth ?? getCurrentMonth())
    : (selectedStartMonth?.length >= 7 ? selectedStartMonth : getCurrentMonth());

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
      initialCurrencyRef.current = newCurrency;
      setIsExchangeRateModified(false);
    }
  }, [installment, isEditing, reset, defaultCurrency]);

  useEffect(() => {
    if (!isEditing && !isPrefillActive) {
      setValue("currency", defaultCurrency);
    }
  }, [defaultCurrency, isEditing, isPrefillActive, setValue]);

  useEffect(() => {
    const lockedInitial = isEditing || isPrefillActive;
    const currencyChanged = selectedCurrency !== initialCurrencyRef.current;
    if (lockedInitial && !currencyChanged) return;
    if (lockedInitial && isExchangeRateModified) return;
    const rate = referenceRate !== null ? referenceRate : lastExchangeRate;
    const formatted = rate !== null ? formatExchangeRate(rate) : "";
    setPreloadedExchangeRateInput(formatted);
    setValue("exchangeRateInput", formatted);
    if (!lockedInitial) {
      setIsExchangeRateModified(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceRate, lastExchangeRate, isEditing, isPrefillActive, selectedCurrency, setValue]);

  useEffect(() => {
    setIsExchangeRateModified(
      exchangeRateInput !== preloadedExchangeRateInput && exchangeRateInput !== "",
    );
  }, [exchangeRateInput, preloadedExchangeRateInput]);

  const availableCategories = filterCategoriesForExpense(
    (categories ?? []).map((c) => ({ id: c.id, name: c.name, scope: c.scope })),
  );

  const noCategoriesAvailable = availableCategories.length === 0;

  useLayoutEffect(() => {
    onFooterStateChange({
      formId,
      isLoading,
      disabled: isLoading || noCategoriesAvailable,
      submitLabel: isLoading ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar",
    });
  }, [onFooterStateChange, formId, isLoading, noCategoriesAvailable, isEditing]);

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

      const updated = result.installment;
      const name = updated?.description || updated?.category.name || installment.description || installment.category.name;
      if (result.historyEntryId) {
        toast.success(`Actualizado: '${name}'.`, {
          groupId: installment.id,
          action: {
            label: "Deshacer",
            pendingLabel: "Deshaciendo…",
            onClick: buildUndoAction(undo, result.historyEntryId),
          },
        });
      } else {
        toast.success(`Actualizado: '${name}'.`);
      }
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

      if (onCreateSuccess) {
        toast.success("Movimiento guardado correctamente.");
        reset({
          amountInput: "",
          currency: defaultCurrency,
          exchangeRateInput: "",
          totalInstallments: "",
          startMonth: defaultMonth ?? getCurrentMonth(),
          categoryId: "",
          paymentMethodId: "",
          autoDebit: false,
          description: "",
        });
        setIsExchangeRateModified(false);
        onCreateSuccess();
      } else {
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
  }

  async function onSubmitInternal(data: InstallmentFormData) {
    const amountCents = parseCurrencyInput(data.amountInput);
    if (amountCents === null) return;

    const totalInstallments = parseInt(data.totalInstallments, 10);

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

  function handleCategoryCreated(category: Category) {
    setValue("categoryId", category.id);
    setShowCategoryModal(false);
  }

  return {
    formId,
    isEditing,
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
    planPreviewValid: Boolean(planPreviewValid),
    isPlanCrossRate,
    availableCategories,
    noCategoriesAvailable,
    isLoading,
    onSubmit: handleSubmit(onSubmitInternal),
    showCategoryModal,
    openCategoryModal: () => setShowCategoryModal(true),
    closeCategoryModal: () => setShowCategoryModal(false),
    handleCategoryCreated,
    crossedLimits,
    handleCancelLimitDialog,
    handleConfirmSaveAnyway,
  };
}
