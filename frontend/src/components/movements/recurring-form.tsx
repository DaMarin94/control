"use client";

/**
 * Formulario de movimiento fijo (RF-MF-001 / RF-MF-003).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * - Toggle Gasto/Ingreso (o read-only con badge en edición)
 * - Input de monto mono 20px con prefijo "$"
 * - Nota de recurrencia (.field-note con ícono Repeat)
 * - Footer: Cancelar / Guardar
 *
 * Lógica de negocio preservada intacta.
 */

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { AlertTriangle, Repeat, Check, ArrowDown, ArrowUp } from "lucide-react";
import type { RecurringFrequency } from "@/types/recurring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoreOptionsSection } from "@/components/movements/more-options-section";
import { useCategories } from "@/hooks/use-categories";
import { useRecurring } from "@/hooks/use-recurring";
import { useSettings } from "@/hooks/use-settings";
import { useReferenceRate } from "@/hooks/use-reference-rate";
import { useActiveLimitProjection } from "@/hooks/use-active-limit-projection";
import { useDefaultPaymentMethodPrefill } from "@/hooks/use-default-payment-method-prefill";
import { useToast } from "@/hooks/use-toast";
import { type TransactionType } from "@/types/transaction";
import { type Category, type CategoryScope } from "@/types/category";
import { CategoryFormModal } from "@/app/(app)/configuracion/categorias/category-form-modal";
import { type Recurring } from "@/types/recurring";
import { ActiveLimitDialog } from "@/components/limits/active-limit-dialog";
import { toCanonicalAmountCents } from "@/lib/limits/project";
import type { LimitConfig } from "@/types/limit";
import {
  parseCurrencyInput,
  parseExchangeRateInput,
  formatExchangeRate,
  formatMonthLabel,
  getCurrentMonth,
  sanitizeAmountInput,
  MAX_AMOUNT_CENTS,
} from "@/lib/format";
import { createLogger } from "@/lib/logger";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/settings";

const logger = createLogger("RecurringForm");

// ─── Schema ───────────────────────────────────────────────────────────────────

/**
 * Opciones de frecuencia: valor (entero 1..12) → etiqueta capitalizada (para
 * el select). Fuente única: docs/design.md "Frecuencia del fijo — entero
 * 1..12 y sus etiquetas", columna "Select". Orden estrictamente 1→12.
 */
const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
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

/**
 * Etiqueta en minúscula (palabras deletreadas) para la nota de recurrencia
 * del form. Columna "Ayuda del form" de la misma tabla — deletrea el número
 * porque el usuario confirma acá una decisión irreversible (RF-MF-006).
 */
const FREQUENCY_LABEL_LOWER: Record<number, string> = {
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
  /**
   * Input de cotización como string. Solo se valida cuando currency !== defaultCurrency.
   */
  exchangeRateInput: z.string(),
  startMonth: z
    .string()
    .min(1, "El mes de inicio es requerido")
    .regex(/^\d{4}-\d{2}$/, "El mes debe tener formato YYYY-MM"),
  /**
   * Frecuencia — entero 1..12, siempre presente en el schema.
   * En edición se inicializa con el valor del fijo existente (o 1 como fallback)
   * para satisfacer el schema; NO se envía en el PATCH (el backend no permite cambiarla).
   */
  frequency: z.number().int().min(1).max(12),
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

type RecurringFormData = z.infer<typeof recurringSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

/**
 * Prefill de "Duplicar movimiento" (docs/design.md §"Duplicar movimiento") —
 * valores del fijo ORIGEN copiados tal cual, incluido el `startMonth` original
 * (no el mes visualizado). Distinto de `Recurring` (que trae campos de servidor
 * pensados para PATCH) — ver gotcha en month-view-client.tsx.
 */
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
  /** Mes de inicio ORIGINAL del fijo — se copia tal cual, no el mes visualizado */
  startMonth: string;
}

interface RecurringFormProps {
  recurring: Recurring | null;
  onClose: () => void;
  defaultMonth?: string;
  viewMonth?: string;
  /**
   * true si, en modo edición, el fijo está ACTUALMENTE anulado (skipped) para
   * el mes visualizado. El form no expone el toggle de anular — este flag
   * alimenta la intercepción de límites activos (D16). Ausente = false.
   */
  editingSkipped?: boolean;
  /**
   * Prefill de "Duplicar movimiento" — llena `defaultValues` en modo CREAR
   * (POST) sin activar `isEditing`. Ignorado si `recurring` está presente.
   */
  prefill?: RecurringPrefill | null;
}

/** Datos ya validados/parseados, pendientes de persistir tras "Guardar igual" (P2 — Fase 2). */
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

// ─── Componente ───────────────────────────────────────────────────────────────

export function RecurringForm({ recurring, onClose, defaultMonth, viewMonth, editingSkipped, prefill }: RecurringFormProps) {
  const isEditing = recurring !== null;
  // Modo "Duplicar" (docs/design.md): crea (POST) con defaultValues del prefill,
  // sin activar isEditing. Mutuamente excluyente con isEditing.
  const isPrefillActive = !isEditing && prefill != null;
  const router = useRouter();
  const { toast } = useToast();
  const { categories } = useCategories();
  const { createRecurring, updateRecurring, isCreating, isUpdating } = useRecurring();
  const { defaultCurrency, lastExchangeRate } = useSettings();

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState<string | undefined>();
  const [isExchangeRateModified, setIsExchangeRateModified] = useState(false);

  // P2 — Fase 2: intercepción de límites activos al guardar (D11).
  const [crossedLimits, setCrossedLimits] = useState<LimitConfig[] | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  // Un fijo/cuota (recurrente) se chequea contra el MES EN CURSO real (D13),
  // sin importar el mes de inicio elegido o el mes visualizado (viewMonth).
  const { evaluate: evaluateActiveLimits } = useActiveLimitProjection(getCurrentMonth());

  const isLoading = isEditing ? isUpdating : isCreating;

  // Cotización pre-cargada inicial:
  // - Editando: la del fijo (siempre presente, nunca null en el backend).
  // - Creando: se rellena luego desde referenceRate/lastExchangeRate.
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
        // frequency: se inicializa con el valor del fijo (o 1 como fallback) para
        // satisfacer la validación del schema en edición — NO se envía en el PATCH.
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
          // Duplicar: el mes de inicio ORIGINAL del fijo, no el mes visualizado.
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

  // En edición: moneda original al abrir el modal. Si el usuario la cambia, se
  // pre-carga la cotización de referencia para la nueva moneda (como en creación).
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

  // Registro del campo Monto — se reusa en el onChange que sanitiza la entrada
  // (#4: solo dígitos + un único separador decimal) antes de que RHF la capture.
  const amountFieldRegister = register("amountInput");

  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");
  const selectedFrequency = watch("frequency");
  const selectedCurrency = watch("currency") as CurrencyCode;
  const exchangeRateInput = watch("exchangeRateInput");
  const selectedPaymentMethodId = watch("paymentMethodId") ?? "";
  const selectedAutoDebit = watch("autoDebit") ?? false;

  // Prefill del método de pago por defecto — solo al crear un movimiento fijo
  // (RF-PM-007). Valor inicial editable; no pisa una selección manual del usuario.
  useDefaultPaymentMethodPrefill({
    slot: "fijo",
    isEditing,
    currentPaymentMethodId: selectedPaymentMethodId,
    setPaymentMethodId: (id) => setValue("paymentMethodId", id),
  });

  // Mes relevante para la cotización de referencia:
  // - Crear: mes de inicio seleccionado (o mes actual como fallback)
  // - Editar: mes visualizado (viewMonth) o mes actual
  const referenceMonth = viewMonth ?? getCurrentMonth();

  // Hook de cotización de referencia — Fase 1.2.4
  const { referenceRate } = useReferenceRate({
    month: referenceMonth,
    currency: selectedCurrency,
    defaultCurrency,
  });

  // Depende de `recurring?.id` (no del objeto `recurring` completo): el llamador
  // (month-view-client) construye el objeto `recurring` inline en cada render
  // (`movementItemToRecurring(editingFijo)`), por lo que su referencia cambia en
  // cualquier re-render del padre (ej. refetch de movements por window focus)
  // aunque sea el mismo movimiento. Si este effect dependiera de la referencia,
  // se dispararía `reset()` en cada uno de esos re-renders y pisaría silenciosamente
  // el monto (u otro campo) que el usuario ya tipeó en el form con el valor original.
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
      // Actualizar la referencia de moneda inicial para que el effect de pre-carga
      // pueda detectar correctamente si el usuario la cambia en esta sesión.
      initialCurrencyRef.current = newCurrency;
      setIsExchangeRateModified(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurring?.id, isEditing, reset, defaultCurrency]);

  // Pre-cargar defaultCurrency al crear cuando cambia — NO en modo "Duplicar"
  // (isPrefillActive): la moneda copiada del original debe sobrevivir intacta.
  useEffect(() => {
    if (!isEditing && !isPrefillActive) {
      setValue("currency", defaultCurrency);
    }
  }, [defaultCurrency, isEditing, isPrefillActive, setValue]);

  // Pre-cargar cotización: prioridad referenceRate → lastExchangeRate → vacío (Fase 1.2.4).
  // En modo crear (sin prefill): siempre al cambiar referencia o moneda.
  // En modo edición Y en modo "Duplicar": solo si el usuario cambió la moneda
  // (≠ moneda original/copiada al abrir) y no modificó la cotización manualmente.
  useEffect(() => {
    const lockedInitial = isEditing || isPrefillActive;
    const currencyChanged = selectedCurrency !== initialCurrencyRef.current;
    if (lockedInitial && !currencyChanged) return;
    if (lockedInitial && isExchangeRateModified) return;
    const rate =
      referenceRate !== null
        ? referenceRate
        : lastExchangeRate;
    const formatted = rate !== null ? formatExchangeRate(rate) : "";
    setPreloadedExchangeRateInput(formatted);
    setValue("exchangeRateInput", formatted);
    if (!lockedInitial) {
      setIsExchangeRateModified(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceRate, lastExchangeRate, isEditing, isPrefillActive, selectedCurrency, setValue]);

  // Detectar si el usuario modificó la cotización
  useEffect(() => {
    setIsExchangeRateModified(
      exchangeRateInput !== preloadedExchangeRateInput && exchangeRateInput !== ""
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

  async function persist({ data, amountCents, parsedExchangeRate }: PendingSave) {
    if (isEditing) {
      const result = await updateRecurring(recurring.id, {
        currentMonth: viewMonth ?? getCurrentMonth(),
        amountCents,
        categoryId: data.categoryId,
        description: data.description || null,
        currency: data.currency,
        // En edición de fijo: la cotización aplica al mes visualizado
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

      toast.success("Movimiento guardado correctamente.", {
        action: {
          label: "Ir a ver",
          onClick: () => router.push(`/mes?month=${data.startMonth}`),
        },
      });

      onClose();
    }
  }

  async function onSubmit(data: RecurringFormData) {
    const amountCents = parseCurrencyInput(data.amountInput);
    if (amountCents === null) return;

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

    const pending: PendingSave = { data, amountCents, parsedExchangeRate };

    // P2 — Fase 2: compuerta de intercepción (D11). Sin cruces → persiste
    // directo, EXACTAMENTE como hoy (cero fricción). Con cruces → aviso.
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

  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit, (errors) => {
          logger.warn("Validación del form de fijo falló", { errors });
        })}
        noValidate
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="flex-1 min-h-0 overflow-y-auto px-[22px] pb-[22px] space-y-[14px]">
          {/* ── Tipo (toggle o read-only en edición) ── */}
          {isEditing ? (
            <div className="flex flex-col gap-[7px]">
              <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Tipo
              </Label>
              <div className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px] text-[14px] font-semibold text-ink-2">
                {recurring.type === "EXPENSE" ? (
                  <ArrowDown size={15} className="text-expense-ink" aria-hidden="true" />
                ) : (
                  <ArrowUp size={15} className="text-income-ink" aria-hidden="true" />
                )}
                {recurring.type === "EXPENSE" ? "Gasto" : "Ingreso"}
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
            <Label htmlFor="rec-amount" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
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
                id="rec-amount"
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
              <Label htmlFor="rec-start-month" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Mes de inicio
              </Label>
              <Input
                id="rec-start-month"
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
            /* En editar: frecuencia inmutable — caja read-only (patrón igual a "Tipo") */
            <div className="flex flex-col gap-[7px]">
              <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Frecuencia
              </Label>
              <div className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px] text-[14px] font-semibold text-ink-2">
                <Repeat size={15} className="text-accent-ink shrink-0" aria-hidden="true" />
                {FREQUENCY_OPTIONS.find((o) => o.value === selectedFrequency)?.label ?? "Mensual"}
              </div>
              {/* Campo oculto para que RHF tenga el valor en el form state */}
              <input type="hidden" {...register("frequency")} />
            </div>
          ) : (
            /* En crear: selector editable — entre Mes de inicio y Categoría */
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="rec-frequency" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Frecuencia
              </Label>
              <Controller
                name="frequency"
                control={control}
                render={({ field }) => (
                  <Select
                    id="rec-frequency"
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
              <Label htmlFor="rec-category" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
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
                    id="rec-category"
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
            <Label htmlFor="rec-description" className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Descripción{" "}
              <span className="text-faint font-normal">(opcional)</span>
            </Label>
            <Input
              id="rec-description"
              type="text"
              placeholder="Ej: Alquiler departamento"
              error={errors.description?.message}
              {...register("description")}
            />
          </div>

          {/* ── Más opciones: moneda+cotización + método de pago (P4) ── */}
          <MoreOptionsSection
            idPrefix="rec"
            currency={selectedCurrency}
            exchangeRateInput={exchangeRateInput}
            defaultCurrency={defaultCurrency}
            isExchangeRateModified={isExchangeRateModified}
            exchangeRateError={exchangeRateError}
            // Para fijos: nota "Cotización para {Mes Año}" — siempre visible (campo siempre presente)
            recurringMonthNote={`Cotización para ${
              formatMonthLabel(viewMonth ?? getCurrentMonth()).replace(
                /^\w/,
                (c) => c.toUpperCase()
              )
            }`}
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
          lockScopeToType={selectedType}
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
