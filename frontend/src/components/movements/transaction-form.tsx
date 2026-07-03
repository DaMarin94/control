"use client";

/**
 * Formulario de movimiento único (RF-MU-001 / RF-MU-002).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 * - Toggle Gasto/Ingreso (.gi): dos botones 50/50 con variantes on-gasto/on-ingreso
 * - Monto: input mono 20px con prefijo "$"
 * - Bloque .warn para "sin categorías" (expense-soft, border expense/0.25)
 * - Footer: Cancelar ghost / Guardar
 *
 * Lógica de negocio preservada intacta.
 */

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { AlertTriangle, Calendar, Check, ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoreOptionsSection } from "@/components/movements/more-options-section";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useSettings } from "@/hooks/use-settings";
import { useReferenceRate } from "@/hooks/use-reference-rate";
import { useToast } from "@/hooks/use-toast";
import { type Transaction, type TransactionType } from "@/types/transaction";
import { type Category, type CategoryScope } from "@/types/category";
import { CategoryFormModal } from "@/app/(app)/categorias/category-form-modal";
import {
  parseCurrencyInput,
  parseExchangeRateInput,
  formatExchangeRate,
  getBrowserTimezone,
  localToUtcIso,
  utcToLocalDate,
  utcToLocalTime,
} from "@/lib/format";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/settings";

// ─── Schema ───────────────────────────────────────────────────────────────────

const transactionSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  amountInput: z
    .string()
    .min(1, "El monto es requerido")
    .refine((val) => parseCurrencyInput(val) !== null, {
      message: "Ingresá un monto mayor a 0",
    }),
  currency: z.enum(["ARS", "USD", "EUR", "BRL"]),
  /**
   * Input de cotización como string (puede tener decimales, locale es-AR).
   * Solo se valida cuando currency !== defaultCurrency (se valida en onSubmit).
   * Se inicializa vacío/"0" si no aplica.
   */
  exchangeRateInput: z.string(),
  categoryId: z.string().min(1, "La categoría es requerida"),
  /** Método de pago opcional (RF-PM-006). "" = ninguno. */
  paymentMethodId: z.string().optional(),
  /**
   * Débito automático (P4 — corrección de alcance). Atributo del movimiento;
   * el control solo se renderiza cuando el método elegido es de tipo DEBIT.
   */
  autoDebit: z.boolean().optional(),
  date: z.string().min(1, "La fecha es requerida"),
  time: z.string().min(1, "La hora es requerida"),
  description: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface TransactionFormProps {
  transaction: Transaction | null;
  onClose: () => void;
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

// ─── Componente ───────────────────────────────────────────────────────────────

export function TransactionForm({ transaction, onClose }: TransactionFormProps) {
  const isEditing = transaction !== null;
  const router = useRouter();
  const { toast } = useToast();
  const { categories } = useCategories();
  const { createTransaction, updateTransaction, isCreating, isUpdating } = useTransactions();
  const { defaultCurrency, lastExchangeRate } = useSettings();

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  // Error de cotización (validación manual en onSubmit, no por Zod)
  const [exchangeRateError, setExchangeRateError] = useState<string | undefined>();
  // Rastrear si el usuario modificó el valor de cotización respecto al pre-cargado
  const [isExchangeRateModified, setIsExchangeRateModified] = useState(false);

  const isLoading = isEditing ? isUpdating : isCreating;
  const timezone = isEditing ? transaction.timezone : getBrowserTimezone();
  const { date: nowDate, time: nowTime } = getNowLocalDateAndTime();

  // Cotización pre-cargada inicial (para el defaultValues del form):
  // - Editando: la del movimiento (siempre presente, nunca null en el backend).
  // - Creando: vacío para ahora; se actualiza al resolver la query de referencia.
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

  // Rastrear el valor de pre-carga para detectar si el usuario lo modificó
  const [preloadedExchangeRateInput, setPreloadedExchangeRateInput] = useState(
    initialEditingExchangeRateInput,
  );

  // En edición: moneda original al abrir el modal. Si el usuario la cambia, se
  // pre-carga la cotización de referencia para la nueva moneda (como en creación).
  const initialCurrencyRef = useRef<CurrencyCode>(
    isEditing ? (transaction?.currency ?? defaultCurrency) : defaultCurrency,
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

  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");
  const selectedCurrency = watch("currency") as CurrencyCode;
  const selectedDate = watch("date");
  const exchangeRateInput = watch("exchangeRateInput");
  const selectedPaymentMethodId = watch("paymentMethodId") ?? "";
  const selectedAutoDebit = watch("autoDebit") ?? false;

  // Mes del movimiento derivado de la fecha seleccionada (para el endpoint de referencia)
  const movementMonth = selectedDate?.length >= 7 ? selectedDate.substring(0, 7) : nowDate.substring(0, 7);

  // Hook de cotización de referencia — Fase 1.2.4
  // Solo activo en modo crear y cuando la moneda difiere de la default (currency ≠ default).
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
      // Actualizar la referencia de moneda inicial para que el effect de pre-carga
      // pueda detectar correctamente si el usuario la cambia en esta sesión.
      initialCurrencyRef.current = newCurrency;
      setIsExchangeRateModified(false);
    }
  }, [transaction, isEditing, reset, defaultCurrency]);

  // Pre-cargar cotización al crear: prioridad referenceRate → lastExchangeRate → vacío (Fase 1.2.4).
  // Se recalcula cuando cambia: defaultCurrency, selectedCurrency, referenceRate, lastExchangeRate.
  useEffect(() => {
    if (!isEditing) {
      setValue("currency", defaultCurrency);
      // Para el par que muestra el label cuando moneda===default, la cotización relevante
      // es siempre referenceRate/lastExchangeRate de la "otra" moneda. En ese caso
      // no cambiamos nada — el campo queda como estaba (o vacío al inicio).
      // Cuando la moneda cambia a algo distinto de la default, tomamos la referencia del mes.
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

  async function onSubmit(data: TransactionFormData) {
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

    const occurredAt = localToUtcIso(data.date, data.time, timezone);

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

      toast.success("Movimiento actualizado correctamente.");
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

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="px-[22px] pb-[22px] space-y-[14px]">
          {/* ── Toggle Gasto/Ingreso (.gi) ── */}
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
          {errors.type && (
            <p className="text-[12px] text-expense-ink">{errors.type.message}</p>
          )}

          {/* ── Monto (input amount mono) ── */}
          <div className="flex flex-col gap-[7px]">
            <Label htmlFor="tx-amount" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
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
                id="tx-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                className="flex-1 border-none outline-none bg-transparent mono text-[20px] font-semibold tracking-[-0.01em] text-ink placeholder:text-faint"
                {...register("amountInput")}
              />
            </div>
            {errors.amountInput && (
              <p className="text-[12px] text-expense-ink">{errors.amountInput.message}</p>
            )}
          </div>

          {/* ── Categoría ── */}
          <div className="flex flex-col gap-[7px]">
            <div className="flex items-center justify-between">
              <Label htmlFor="tx-category" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
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

            {/* Bloque .warn cuando no hay categorías */}
            {noCategoriesAvailable ? (
              <div className="flex items-start gap-[11px] rounded-ctl border px-[14px] py-[13px] bg-expense-soft" style={{ borderColor: "oklch(0.57 0.16 27 / 0.25)" }}>
                <AlertTriangle size={18} className="text-expense-ink shrink-0 mt-[1px]" aria-hidden="true" />
                <div className="text-[13px] leading-[1.45] text-expense-ink">
                  <b className="font-bold">Sin categorías para este tipo.</b>{" "}
                  <Link
                    href="/categorias"
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
                    id="tx-category"
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

          {/* ── Fecha y hora ── */}
          <div className="grid grid-cols-2 gap-[14px]">
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="tx-date" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                <span className="inline-flex items-center gap-1">
                  <Calendar size={13} aria-hidden="true" />
                  Fecha
                </span>
              </Label>
              <Input
                id="tx-date"
                type="date"
                error={errors.date?.message}
                {...register("date")}
              />
            </div>
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="tx-time" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Hora
              </Label>
              <Input
                id="tx-time"
                type="time"
                error={errors.time?.message}
                {...register("time")}
              />
            </div>
          </div>

          {/* ── Descripción ── */}
          <div className="flex flex-col gap-[7px]">
            <Label htmlFor="tx-description" className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Descripción{" "}
              <span className="text-faint font-normal">(opcional)</span>
            </Label>
            <Input
              id="tx-description"
              type="text"
              placeholder="Ej: Compra en Día"
              error={errors.description?.message}
              {...register("description")}
            />
          </div>

          {/* ── Más opciones: moneda+cotización + método de pago (P4) ── */}
          <MoreOptionsSection
            idPrefix="tx"
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

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-[22px] py-4 border-t border-hair bg-panel-2">
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
                ? isEditing ? "Guardando..." : "Guardando..."
                : isEditing ? "Guardar cambios" : "Guardar"}
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
    </>
  );
}
