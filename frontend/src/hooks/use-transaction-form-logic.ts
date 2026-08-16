"use client";

/**
 * useTransactionFormLogic — capa 1 (lógica de feature, agnóstica de UI) del
 * form de movimiento único (RF-MU-001/002), extraída de `transaction-form.tsx`
 * al separar lógica y composición (docs/design.md §Superficie de captura →
 * "0. Encuadre — una lógica, dos composiciones").
 *
 * CERO JSX acá: estado del formulario (react-hook-form + zod), defaults por
 * modo (crear/editar/duplicar), pre-carga y detección de cotización
 * modificada, filtro de categorías, proyección/intercepción de límites
 * activos (D11), persistencia (crear/actualizar) y el comportamiento
 * post-guardado (RF-APP-003 §9 vs. comportamiento vigente de escritorio).
 *
 * Consumida por DOS composiciones hermanas — el modal de escritorio
 * (`TransactionForm`) y la superficie de captura (`CaptureTransactionForm`) —
 * que arman su propia UI a partir de lo que este hook devuelve. Ninguna
 * regla de negocio vive en ninguna de las dos: cambia acá y cambia en las dos
 * superficies a la vez.
 *
 * El hook NO sabe en qué superficie se usa: no hay ninguna pregunta de
 * dispositivo/régimen adentro. Las diferencias de comportamiento (qué pasa
 * después de crear con éxito) se cierran con la prop explícita
 * `onCreateSuccess`, presente/ausente según la superficie — decisión que
 * toma quien INSTANCIA el hook (la composición), nunca el hook mismo.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useForm, type Control, type FieldErrors, type UseFormRegister, type UseFormRegisterReturn, type UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useSettings } from "@/hooks/use-settings";
import { useReferenceRate } from "@/hooks/use-reference-rate";
import { useActiveLimitProjection } from "@/hooks/use-active-limit-projection";
import { useDefaultPaymentMethodPrefill } from "@/hooks/use-default-payment-method-prefill";
import { useToast } from "@/hooks/use-toast";
import { useUndoHistory } from "@/hooks/use-history";
import { buildUndoAction } from "@/lib/toast-undo";
import { type Transaction, type TransactionType } from "@/types/transaction";
import { type Category, type CategoryScope } from "@/types/category";
import { toCanonicalAmountCents } from "@/lib/limits/project";
import type { LimitConfig } from "@/types/limit";
import type { MovementFormFooterState } from "@/components/movements/movement-form-footer";
import {
  parseCurrencyInput,
  parseExchangeRateInput,
  formatExchangeRate,
  getBrowserTimezone,
  localToUtcIso,
  utcToLocalDate,
  utcToLocalTime,
  MAX_AMOUNT_CENTS,
  MAX_DESCRIPTION_LENGTH,
} from "@/lib/format";
import type { CurrencyCode } from "@/types/settings";

// ─── Schema ───────────────────────────────────────────────────────────────────

const transactionSchema = z.object({
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
  categoryId: z.string().min(1, "La categoría es requerida"),
  paymentMethodId: z.string().optional(),
  autoDebit: z.boolean().optional(),
  date: z.string().min(1, "La fecha es requerida"),
  time: z.string().min(1, "La hora es requerida"),
  description: z
    .string()
    .max(MAX_DESCRIPTION_LENGTH, "La descripción no puede superar los 200 caracteres")
    .optional(),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

// ─── Prefill de "Duplicar movimiento" ──────────────────────────────────────────

/**
 * Prefill de "Duplicar movimiento" (docs/design.md §"Duplicar movimiento") —
 * valores del único ORIGEN copiados tal cual, incluida la fecha/hora original
 * (no "ahora"). Distinto de `Transaction` (que trae campos de servidor como
 * `id`/`createdAt` pensados para PATCH) — ver gotcha en month-view-client.tsx.
 */
export interface TransactionPrefill {
  type: TransactionType;
  amountCents: number;
  currency: CurrencyCode;
  exchangeRate: number;
  categoryId: string;
  paymentMethodId: string | null;
  autoDebit: boolean | null;
  description: string | null;
  occurredAt: string;
  timezone: string;
}

export interface UseTransactionFormLogicOptions {
  transaction: Transaction | null;
  /** true si, en edición, el movimiento está ACTUALMENTE anulado — alimenta D16. */
  editingSkipped?: boolean;
  /** Prefill de "Duplicar movimiento" — solo aplica en modo crear (transaction===null). */
  prefill?: TransactionPrefill | null;
  onClose: () => void;
  /** Ver `movement-form-footer.ts` — la zona de acción es un slot del envase. */
  onFooterStateChange: (state: MovementFormFooterState) => void;
  /**
   * Presencia = comportamiento post-guardado de la superficie de captura
   * (RF-APP-003, docs/design.md §9): "queda lista para el siguiente
   * movimiento" — el form se resetea (fecha/hora recalculadas) en vez de
   * cerrarse, sin toast con acción "Ir a ver". Ausente = comportamiento
   * vigente de escritorio (toast con "Ir a ver" + `onClose()`).
   */
  onCreateSuccess?: () => void;
}

interface PendingSave {
  data: TransactionFormData;
  amountCents: number;
  parsedExchangeRate: number;
  occurredAt: string;
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

function getNowLocalDateAndTime() {
  const now = new Date();
  const tz = getBrowserTimezone();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = get("hour") === "24" ? "00" : get("hour");
  const time = `${hour}:${get("minute")}`;

  return { date, time };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface TransactionFormLogic {
  formId: string;
  isEditing: boolean;
  register: UseFormRegister<TransactionFormData>;
  control: Control<TransactionFormData>;
  errors: FieldErrors<TransactionFormData>;
  amountFieldRegister: UseFormRegisterReturn<"amountInput">;
  setValue: UseFormSetValue<TransactionFormData>;

  selectedType: TransactionType;
  selectedCurrency: CurrencyCode;
  exchangeRateInput: string;
  selectedPaymentMethodId: string;
  selectedAutoDebit: boolean;
  defaultCurrency: CurrencyCode;
  isExchangeRateModified: boolean;
  exchangeRateError?: string;

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

export function useTransactionFormLogic({
  transaction,
  editingSkipped,
  prefill,
  onClose,
  onFooterStateChange,
  onCreateSuccess,
}: UseTransactionFormLogicOptions): TransactionFormLogic {
  const formId = useId();
  const isEditing = transaction !== null;
  // Modo "Duplicar" (docs/design.md): crea (POST) con defaultValues del prefill,
  // sin activar isEditing. Mutuamente excluyente con isEditing.
  const isPrefillActive = !isEditing && prefill != null;
  const router = useRouter();
  const { toast } = useToast();
  const { undo } = useUndoHistory();
  const { categories } = useCategories();
  const { createTransaction, updateTransaction, isCreating, isUpdating } = useTransactions();
  const { defaultCurrency, lastExchangeRate } = useSettings();

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState<string | undefined>();
  const [isExchangeRateModified, setIsExchangeRateModified] = useState(false);

  // P2 — Fase 2: intercepción de límites activos al guardar (D11).
  const [crossedLimits, setCrossedLimits] = useState<LimitConfig[] | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);

  const isLoading = isEditing ? isUpdating : isCreating;
  const timezone = isEditing
    ? transaction.timezone
    : (prefill?.timezone ?? getBrowserTimezone());
  const { date: nowDate, time: nowTime } = getNowLocalDateAndTime();

  const initialEditingExchangeRateInput = isEditing
    ? formatExchangeRate(transaction.exchangeRate ?? 1)
    : "";

  const defaultValues: TransactionFormData = isEditing
    ? {
        type: transaction.type,
        amountInput: String(transaction.amountCents / 100).replace(".", ","),
        currency: transaction.currency ?? defaultCurrency,
        exchangeRateInput: initialEditingExchangeRateInput,
        categoryId: transaction.categoryId,
        paymentMethodId: transaction.paymentMethodId ?? "",
        autoDebit: transaction.autoDebit ?? false,
        date: utcToLocalDate(transaction.occurredAt, transaction.timezone),
        time: utcToLocalTime(transaction.occurredAt, transaction.timezone),
        description: transaction.description ?? "",
      }
    : prefill
      ? {
          type: prefill.type,
          amountInput: String(prefill.amountCents / 100).replace(".", ","),
          currency: prefill.currency,
          exchangeRateInput: formatExchangeRate(prefill.exchangeRate ?? 1),
          categoryId: prefill.categoryId,
          paymentMethodId: prefill.paymentMethodId ?? "",
          autoDebit: prefill.autoDebit ?? false,
          date: utcToLocalDate(prefill.occurredAt, timezone),
          time: utcToLocalTime(prefill.occurredAt, timezone),
          description: prefill.description ?? "",
        }
      : {
          type: "EXPENSE",
          amountInput: "",
          currency: defaultCurrency,
          exchangeRateInput: "",
          categoryId: "",
          paymentMethodId: "",
          autoDebit: false,
          date: nowDate,
          time: nowTime,
          description: "",
        };

  const [preloadedExchangeRateInput, setPreloadedExchangeRateInput] = useState(
    initialEditingExchangeRateInput,
  );

  const initialCurrencyRef = useRef<CurrencyCode>(
    isEditing
      ? (transaction?.currency ?? defaultCurrency)
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
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues,
  });

  const amountFieldRegister = register("amountInput");

  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");
  const selectedCurrency = watch("currency") as CurrencyCode;
  const selectedDate = watch("date");
  const exchangeRateInput = watch("exchangeRateInput");
  const selectedPaymentMethodId = watch("paymentMethodId") ?? "";
  const selectedAutoDebit = watch("autoDebit") ?? false;

  useDefaultPaymentMethodPrefill({
    slot: "unico",
    isEditing,
    currentPaymentMethodId: selectedPaymentMethodId,
    setPaymentMethodId: (id) => setValue("paymentMethodId", id),
  });

  const movementMonth = selectedDate?.length >= 7 ? selectedDate.substring(0, 7) : nowDate.substring(0, 7);

  const { evaluate: evaluateActiveLimits } = useActiveLimitProjection(movementMonth);

  const { referenceRate } = useReferenceRate({
    month: movementMonth,
    currency: selectedCurrency,
    defaultCurrency,
  });

  useEffect(() => {
    if (isEditing) {
      const newCurrency = transaction.currency ?? defaultCurrency;
      reset({
        type: transaction.type,
        amountInput: String(transaction.amountCents / 100).replace(".", ","),
        currency: newCurrency,
        exchangeRateInput: formatExchangeRate(transaction.exchangeRate ?? 1),
        categoryId: transaction.categoryId,
        paymentMethodId: transaction.paymentMethodId ?? "",
        autoDebit: transaction.autoDebit ?? false,
        date: utcToLocalDate(transaction.occurredAt, transaction.timezone),
        time: utcToLocalTime(transaction.occurredAt, transaction.timezone),
        description: transaction.description ?? "",
      });
      initialCurrencyRef.current = newCurrency;
      setIsExchangeRateModified(false);
    }
  }, [transaction, isEditing, reset, defaultCurrency]);

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
    if (selectedCategoryId && categories) {
      const isCompatible = availableCategories.some((c) => c.id === selectedCategoryId);
      if (!isCompatible) {
        setValue("categoryId", "");
      }
    }
  }, [selectedType, categories, selectedCategoryId, availableCategories, setValue]);

  const noCategoriesAvailable = availableCategories.length === 0;

  useLayoutEffect(() => {
    onFooterStateChange({
      formId,
      isLoading,
      disabled: isLoading || noCategoriesAvailable,
      submitLabel: isLoading ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar",
    });
  }, [onFooterStateChange, formId, isLoading, noCategoriesAvailable, isEditing]);

  async function persist({ data, amountCents, parsedExchangeRate, occurredAt }: PendingSave) {
    if (isEditing) {
      const result = await updateTransaction(transaction.id, {
        type: data.type,
        amountCents,
        categoryId: data.categoryId,
        occurredAt,
        timezone,
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

      const updated = result.transaction;
      const name = updated?.description || updated?.category.name || transaction.description || transaction.category.name;
      if (result.historyEntryId) {
        toast.success(`Actualizado: '${name}'.`, {
          groupId: transaction.id,
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
      const result = await createTransaction({
        type: data.type,
        amountCents,
        categoryId: data.categoryId,
        occurredAt,
        timezone,
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
        const fresh = getNowLocalDateAndTime();
        reset({
          type: "EXPENSE",
          amountInput: "",
          currency: defaultCurrency,
          exchangeRateInput: "",
          categoryId: "",
          paymentMethodId: "",
          autoDebit: false,
          date: fresh.date,
          time: fresh.time,
          description: "",
        });
        setIsExchangeRateModified(false);
        onCreateSuccess();
      } else {
        const month = occurredAt.substring(0, 7);
        toast.success("Movimiento guardado correctamente.", {
          action: {
            label: "Ir a ver",
            onClick: () => router.push(`/mes?month=${month}`),
          },
        });
        onClose();
      }
    }
  }

  async function onSubmitInternal(data: TransactionFormData) {
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

    const occurredAt = localToUtcIso(data.date, data.time, timezone);
    const pending: PendingSave = { data, amountCents, parsedExchangeRate, occurredAt };

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
      section: "unicos",
      skipped: editingSkipped ?? false,
      editingId: isEditing ? transaction.id : undefined,
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
    selectedType,
    selectedCurrency,
    exchangeRateInput,
    selectedPaymentMethodId,
    selectedAutoDebit,
    defaultCurrency,
    isExchangeRateModified,
    exchangeRateError,
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
