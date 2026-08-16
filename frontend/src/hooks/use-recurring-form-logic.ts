"use client";

/**
 * useRecurringFormLogic — capa 1 (lógica de feature, agnóstica de UI) del
 * form de movimiento fijo (RF-MF-001/003), extraída de `recurring-form.tsx`
 * al separar lógica y composición (docs/design.md §Superficie de captura →
 * "0. Encuadre — una lógica, dos composiciones"). Ver `use-transaction-form-logic.ts`
 * para el contrato general del patrón — este hook lo replica para Fijo.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useForm, type Control, type FieldErrors, type UseFormRegister, type UseFormRegisterReturn, type UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import type { RecurringFrequency, Recurring } from "@/types/recurring";
import { useCategories } from "@/hooks/use-categories";
import { useRecurring } from "@/hooks/use-recurring";
import { useSettings } from "@/hooks/use-settings";
import { useReferenceRate } from "@/hooks/use-reference-rate";
import { useActiveLimitProjection } from "@/hooks/use-active-limit-projection";
import { useDefaultPaymentMethodPrefill } from "@/hooks/use-default-payment-method-prefill";
import { useToast } from "@/hooks/use-toast";
import { useUndoHistory } from "@/hooks/use-history";
import { buildUndoAction } from "@/lib/toast-undo";
import { type TransactionType } from "@/types/transaction";
import { type Category, type CategoryScope } from "@/types/category";
import { toCanonicalAmountCents } from "@/lib/limits/project";
import type { LimitConfig } from "@/types/limit";
import type { MovementFormFooterState } from "@/components/movements/movement-form-footer";
import {
  parseCurrencyInput,
  parseExchangeRateInput,
  formatExchangeRate,
  formatMonthLabel,
  getCurrentMonth,
  MAX_AMOUNT_CENTS,
  MAX_DESCRIPTION_LENGTH,
} from "@/lib/format";
import { createLogger } from "@/lib/logger";
import type { CurrencyCode } from "@/types/settings";

const logger = createLogger("useRecurringFormLogic");

// ─── Frecuencias ────────────────────────────────────────────────────────────

/**
 * Opciones de frecuencia: valor (entero 1..12) → etiqueta capitalizada.
 * Fuente única: docs/design.md "Frecuencia del fijo — entero 1..12 y sus
 * etiquetas", columna "Select". Orden estrictamente 1→12.
 */
export const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 1, label: "Mensual" },
  { value: 2, label: "Bimestral" },
  { value: 3, label: "Trimestral" },
  { value: 4, label: "Cuatrimestral" },
  { value: 5, label: "Cada 5 meses" },
  { value: 6, label: "Semestral" },
  { value: 7, label: "Cada 7 meses" },
  { value: 8, label: "Cada 8 meses" },
  { value: 9, label: "Cada 9 meses" },
  { value: 10, label: "Cada 10 meses" },
  { value: 11, label: "Cada 11 meses" },
  { value: 12, label: "Anual" },
];

/** Etiqueta en minúscula (palabras deletreadas) para la nota de recurrencia. */
export const FREQUENCY_LABEL_LOWER: Record<number, string> = {
  1: "cada mes",
  2: "cada dos meses",
  3: "cada tres meses",
  4: "cada cuatro meses",
  5: "cada cinco meses",
  6: "cada seis meses",
  7: "cada siete meses",
  8: "cada ocho meses",
  9: "cada nueve meses",
  10: "cada diez meses",
  11: "cada once meses",
  12: "cada año",
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const recurringSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
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
  exchangeRateInput: z.string(),
  startMonth: z
    .string()
    .min(1, "El mes de inicio es requerido")
    .regex(/^\d{4}-\d{2}$/, "El mes debe tener formato YYYY-MM"),
  frequency: z.number().int().min(1).max(12),
  categoryId: z.string().min(1, "La categoría es requerida"),
  paymentMethodId: z.string().optional(),
  autoDebit: z.boolean().optional(),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH, "La descripción no puede superar los 200 caracteres")
    .optional(),
});

export type RecurringFormData = z.infer<typeof recurringSchema>;

// ─── Prefill de "Duplicar movimiento" ──────────────────────────────────────────

export interface RecurringPrefill {
  type: TransactionType;
  amountCents: number;
  currency: CurrencyCode;
  exchangeRate: number;
  frequency: RecurringFrequency;
  categoryId: string;
  paymentMethodId: string | null;
  autoDebit: boolean | null;
  description: string | null;
  startMonth: string;
}

export interface UseRecurringFormLogicOptions {
  recurring: Recurring | null;
  onClose: () => void;
  defaultMonth?: string;
  viewMonth?: string;
  editingSkipped?: boolean;
  prefill?: RecurringPrefill | null;
  onFooterStateChange: (state: MovementFormFooterState) => void;
  /** Ver `use-transaction-form-logic.ts` — comportamiento post-guardado (§9). */
  onCreateSuccess?: () => void;
}

interface PendingSave {
  data: RecurringFormData;
  amountCents: number;
  parsedExchangeRate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterCategoriesByType(
  categories: { id: string; name: string; scope: CategoryScope }[],
  type: TransactionType,
) {
  return categories.filter((cat) => {
    if (type === "EXPENSE") return cat.scope === "EXPENSE" || cat.scope === "BOTH";
    return cat.scope === "INCOME" || cat.scope === "BOTH";
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface RecurringFormLogic {
  formId: string;
  isEditing: boolean;
  register: UseFormRegister<RecurringFormData>;
  control: Control<RecurringFormData>;
  errors: FieldErrors<RecurringFormData>;
  amountFieldRegister: UseFormRegisterReturn<"amountInput">;
  setValue: UseFormSetValue<RecurringFormData>;

  selectedType: TransactionType;
  selectedFrequency: RecurringFrequency;
  selectedCurrency: CurrencyCode;
  exchangeRateInput: string;
  selectedPaymentMethodId: string;
  selectedAutoDebit: boolean;
  defaultCurrency: CurrencyCode;
  isExchangeRateModified: boolean;
  exchangeRateError?: string;
  recurringMonthNote: string;

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

export function useRecurringFormLogic({
  recurring,
  onClose,
  defaultMonth,
  viewMonth,
  editingSkipped,
  prefill,
  onFooterStateChange,
  onCreateSuccess,
}: UseRecurringFormLogicOptions): RecurringFormLogic {
  const formId = useId();
  const isEditing = recurring !== null;
  const isPrefillActive = !isEditing && prefill != null;
  const router = useRouter();
  const { toast } = useToast();
  const { undo } = useUndoHistory();
  const { categories } = useCategories();
  const { createRecurring, updateRecurring, isCreating, isUpdating } = useRecurring();
  const { defaultCurrency, lastExchangeRate } = useSettings();

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState<string | undefined>();
  const [isExchangeRateModified, setIsExchangeRateModified] = useState(false);

  const [crossedLimits, setCrossedLimits] = useState<LimitConfig[] | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  // Un fijo/cuota (recurrente) se chequea contra el MES EN CURSO real (D13),
  // sin importar el mes de inicio elegido o el mes visualizado (viewMonth).
  const { evaluate: evaluateActiveLimits } = useActiveLimitProjection(getCurrentMonth());

  const isLoading = isEditing ? isUpdating : isCreating;

  const initialEditingExchangeRateInput = isEditing
    ? formatExchangeRate(recurring.exchangeRate ?? 1)
    : "";

  const defaultValues: RecurringFormData = isEditing
    ? {
        type: recurring.type,
        amountInput: String(recurring.amountCents / 100).replace(".", ","),
        currency: recurring.currency ?? defaultCurrency,
        exchangeRateInput: initialEditingExchangeRateInput,
        startMonth: getCurrentMonth(),
        frequency: recurring.frequency ?? 1,
        categoryId: recurring.categoryId,
        paymentMethodId: recurring.paymentMethodId ?? "",
        autoDebit: recurring.autoDebit ?? false,
        description: recurring.description ?? "",
      }
    : prefill
      ? {
          type: prefill.type,
          amountInput: String(prefill.amountCents / 100).replace(".", ","),
          currency: prefill.currency,
          exchangeRateInput: formatExchangeRate(prefill.exchangeRate ?? 1),
          startMonth: prefill.startMonth,
          frequency: prefill.frequency,
          categoryId: prefill.categoryId,
          paymentMethodId: prefill.paymentMethodId ?? "",
          autoDebit: prefill.autoDebit ?? false,
          description: prefill.description ?? "",
        }
      : {
          type: "EXPENSE",
          amountInput: "",
          currency: defaultCurrency,
          exchangeRateInput: "",
          startMonth: defaultMonth ?? getCurrentMonth(),
          frequency: 1,
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
      ? (recurring?.currency ?? defaultCurrency)
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
  } = useForm<RecurringFormData>({
    resolver: zodResolver(recurringSchema),
    defaultValues,
  });

  const amountFieldRegister = register("amountInput");

  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");
  const selectedFrequency = watch("frequency");
  const selectedCurrency = watch("currency") as CurrencyCode;
  const exchangeRateInput = watch("exchangeRateInput");
  const selectedPaymentMethodId = watch("paymentMethodId") ?? "";
  const selectedAutoDebit = watch("autoDebit") ?? false;

  useDefaultPaymentMethodPrefill({
    slot: "fijo",
    isEditing,
    currentPaymentMethodId: selectedPaymentMethodId,
    setPaymentMethodId: (id) => setValue("paymentMethodId", id),
  });

  const referenceMonth = viewMonth ?? getCurrentMonth();

  const { referenceRate } = useReferenceRate({
    month: referenceMonth,
    currency: selectedCurrency,
    defaultCurrency,
  });

  // Depende de `recurring?.id` (no del objeto `recurring` completo) — ver
  // comentario original en recurring-form.tsx (evita pisar el form en cada
  // re-render del padre con la misma referencia lógica pero objeto nuevo).
  useEffect(() => {
    if (isEditing) {
      const newCurrency = recurring.currency ?? defaultCurrency;
      reset({
        type: recurring.type,
        amountInput: String(recurring.amountCents / 100).replace(".", ","),
        currency: newCurrency,
        exchangeRateInput: formatExchangeRate(recurring.exchangeRate ?? 1),
        startMonth: getCurrentMonth(),
        frequency: recurring.frequency ?? 1,
        categoryId: recurring.categoryId,
        paymentMethodId: recurring.paymentMethodId ?? "",
        autoDebit: recurring.autoDebit ?? false,
        description: recurring.description ?? "",
      });
      initialCurrencyRef.current = newCurrency;
      setIsExchangeRateModified(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurring?.id, isEditing, reset, defaultCurrency]);

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

  const availableCategories = filterCategoriesByType(
    (categories ?? []).map((c) => ({ id: c.id, name: c.name, scope: c.scope })),
    selectedType,
  );

  useEffect(() => {
    if (!isEditing && selectedCategoryId && categories) {
      const isCompatible = availableCategories.some((c) => c.id === selectedCategoryId);
      if (!isCompatible) {
        setValue("categoryId", "");
      }
    }
  }, [isEditing, selectedType, categories, selectedCategoryId, availableCategories, setValue]);

  const noCategoriesAvailable = availableCategories.length === 0;

  useLayoutEffect(() => {
    onFooterStateChange({
      formId,
      isLoading,
      disabled: isLoading || noCategoriesAvailable,
      submitLabel: isLoading ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar",
    });
  }, [onFooterStateChange, formId, isLoading, noCategoriesAvailable, isEditing]);

  async function persist({ data, amountCents, parsedExchangeRate }: PendingSave) {
    if (isEditing) {
      const result = await updateRecurring(recurring.id, {
        currentMonth: viewMonth ?? getCurrentMonth(),
        amountCents,
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

      const updated = result.recurring;
      const name = updated?.description || updated?.category.name || recurring.description || recurring.category.name;
      if (result.historyEntryId && updated) {
        toast.success(`Actualizado: '${name}'.`, {
          groupId: updated.chainId,
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
      const result = await createRecurring({
        type: data.type,
        amountCents,
        categoryId: data.categoryId,
        startMonth: data.startMonth,
        frequency: data.frequency,
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
          type: "EXPENSE",
          amountInput: "",
          currency: defaultCurrency,
          exchangeRateInput: "",
          startMonth: defaultMonth ?? getCurrentMonth(),
          frequency: 1,
          categoryId: "",
          paymentMethodId: "",
          autoDebit: false,
          description: "",
        });
        setIsExchangeRateModified(false);
        onCreateSuccess();
      } else {
        toast.success("Movimiento guardado correctamente.", {
          action: {
            label: "Ir a ver",
            onClick: () => router.push(`/mes?month=${data.startMonth}`),
          },
        });
        onClose();
      }
    }
  }

  async function onSubmitInternal(data: RecurringFormData) {
    const amountCents = parseCurrencyInput(data.amountInput);
    if (amountCents === null) return;

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

    const pending: PendingSave = { data, amountCents, parsedExchangeRate };

    const canonicalAmountCents = toCanonicalAmountCents(
      amountCents,
      data.currency,
      defaultCurrency,
      parsedExchangeRate,
    );
    const crossed = evaluateActiveLimits({
      type: data.type,
      convertedAmountCents: canonicalAmountCents,
      categoryId: data.categoryId,
      section: "fijos",
      skipped: editingSkipped ?? false,
      editingId: isEditing ? recurring.id : undefined,
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

  // Nota de recurrencia — siempre presente (campo cotización siempre en el form).
  const recurringMonthNote = `Cotización para ${formatMonthLabel(viewMonth ?? getCurrentMonth()).replace(
    /^\w/,
    (c) => c.toUpperCase(),
  )}`;

  // onSubmit con logger de validación fallida (comportamiento vigente).
  const onSubmit = handleSubmit(onSubmitInternal, (validationErrors) => {
    logger.warn("Validación del form de fijo falló", { errors: validationErrors });
  });

  return {
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
    isLoading,
    onSubmit,
    showCategoryModal,
    openCategoryModal: () => setShowCategoryModal(true),
    closeCategoryModal: () => setShowCategoryModal(false),
    handleCategoryCreated,
    crossedLimits,
    handleCancelLimitDialog,
    handleConfirmSaveAnyway,
  };
}
