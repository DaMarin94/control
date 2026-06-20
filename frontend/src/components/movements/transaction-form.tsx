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

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { AlertTriangle, Calendar, Check, ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CurrencyExchangeBlock } from "@/components/ui/currency-exchange-block";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useSettings } from "@/hooks/use-settings";
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
  currency: z.enum(["ARS", "USD"]),
  /**
   * Input de cotización como string (puede tener decimales, locale es-AR).
   * Solo se valida cuando currency !== defaultCurrency (se valida en onSubmit).
   * Se inicializa vacío/"0" si no aplica.
   */
  exchangeRateInput: z.string(),
  categoryId: z.string().min(1, "La categoría es requerida"),
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

  // Cotización pre-cargada:
  // - Editando: la del movimiento (siempre presente, nunca null en el backend).
  // - Creando: el lastExchangeRate del usuario, o vacío si aún no tiene historial.
  const preloadedExchangeRateInput = isEditing
    ? formatExchangeRate(transaction.exchangeRate ?? 1)
    : lastExchangeRate != null
      ? formatExchangeRate(lastExchangeRate)
      : "";

  const defaultValues: TransactionFormData = isEditing
    ? {
        type: transaction.type,
        amountInput: String(transaction.amountCents / 100).replace(".", ","),
        currency: transaction.currency ?? defaultCurrency,
        exchangeRateInput: formatExchangeRate(transaction.exchangeRate ?? 1),
        categoryId: transaction.categoryId,
        date: utcToLocalDate(transaction.occurredAt, transaction.timezone),
        time: utcToLocalTime(transaction.occurredAt, transaction.timezone),
        description: transaction.description ?? "",
      }
    : {
        type: "EXPENSE",
        amountInput: "",
        currency: defaultCurrency,
        exchangeRateInput: preloadedExchangeRateInput,
        categoryId: "",
        date: nowDate,
        time: nowTime,
        description: "",
      };

  // Moneda inicial para detectar cambios y resetear el flag de modificado
  const [initialExchangeRateInput] = useState(defaultValues.exchangeRateInput);

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

  useEffect(() => {
    if (isEditing) {
      reset({
        type: transaction.type,
        amountInput: String(transaction.amountCents / 100).replace(".", ","),
        currency: transaction.currency ?? defaultCurrency,
        exchangeRateInput: formatExchangeRate(transaction.exchangeRate ?? 1),
        categoryId: transaction.categoryId,
        date: utcToLocalDate(transaction.occurredAt, transaction.timezone),
        time: utcToLocalTime(transaction.occurredAt, transaction.timezone),
        description: transaction.description ?? "",
      });
      setIsExchangeRateModified(false);
    }
  }, [transaction, isEditing, reset, defaultCurrency]);

  // Pre-cargar cotización cuando defaultCurrency o lastExchangeRate cambian (solo en crear)
  useEffect(() => {
    if (!isEditing) {
      setValue("currency", defaultCurrency);
      setValue(
        "exchangeRateInput",
        lastExchangeRate != null ? formatExchangeRate(lastExchangeRate) : "",
      );
      setIsExchangeRateModified(false);
    }
  }, [defaultCurrency, lastExchangeRate, isEditing, setValue]);

  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");
  const exchangeRateInput = watch("exchangeRateInput");

  // Detectar si el usuario modificó la cotización respecto al valor inicial
  useEffect(() => {
    setIsExchangeRateModified(
      exchangeRateInput !== initialExchangeRateInput && exchangeRateInput !== ""
    );
  }, [exchangeRateInput, initialExchangeRateInput]);

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

    // Validar cotización SIEMPRE (no solo en cross-rate): el roadmap exige capturar
    // y persistir la cotización real también cuando moneda === defaultCurrency.
    const parsedExchangeRate = parseExchangeRateInput(data.exchangeRateInput);
    if (parsedExchangeRate === null) {
      setExchangeRateError("Ingresá una cotización mayor a 0");
      return;
    }
    setExchangeRateError(undefined);

    const occurredAt = localToUtcIso(data.date, data.time, timezone);

    if (isEditing) {
      const result = await updateTransaction(transaction.id, {
        type: data.type,
        amountCents,
        categoryId: data.categoryId,
        occurredAt,
        timezone,
        description: data.description || undefined,
        currency: data.currency,
        exchangeRate: parsedExchangeRate,
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

          {/* ── Moneda y cotización ── */}
          <Controller
            name="currency"
            control={control}
            render={({ field }) => (
              <CurrencyExchangeBlock
                currency={field.value as CurrencyCode}
                exchangeRateInput={exchangeRateInput}
                defaultCurrency={defaultCurrency}
                isExchangeRateModified={isExchangeRateModified}
                exchangeRateError={exchangeRateError}
                onCurrencyChange={(val) => {
                  field.onChange(val);
                }}
                onExchangeRateChange={(val) => setValue("exchangeRateInput", val)}
                exchangeRateInputId="tx-exchange-rate"
              />
            )}
          />

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
