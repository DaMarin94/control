"use client";

/**
 * Formulario de movimiento único (RF-MU-001 / RF-MU-002).
 *
 * Modo crear: campos con defaults (tipo=EXPENSE, fecha/hora=ahora).
 * Modo editar: campos precargados desde la transacción existente.
 *
 * Reglas de negocio:
 * - El usuario ingresa el monto en pesos; se convierte a centavos antes de enviar.
 * - Categorías filtradas por scope según el tipo (RN-010).
 * - Si cambia el tipo y la categoría deja de ser compatible, se resetea.
 * - occurredAt se construye combinando fecha + hora local → UTC ISO 8601 (RN-004).
 * - timezone = zona IANA del navegador en modo crear; zona guardada en modo editar.
 * - Sin categorías disponibles → bloquear guardado y mostrar enlace a /categorias.
 * - Error del backend → modal queda abierto con datos conservados (RNF-008).
 */

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useToast } from "@/hooks/use-toast";
import { type Transaction, type TransactionType } from "@/types/transaction";
import { type CategoryScope } from "@/types/category";
import {
  parseCurrencyInput,
  getBrowserTimezone,
  localToUtcIso,
  utcToLocalDate,
  utcToLocalTime,
} from "@/lib/format";
import { useRouter } from "next/navigation";

// ─── Schema ───────────────────────────────────────────────────────────────────

const transactionSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  amountInput: z
    .string()
    .min(1, "El monto es requerido")
    .refine((val) => parseCurrencyInput(val) !== null, {
      message: "Ingresá un monto mayor a 0",
    }),
  categoryId: z.string().min(1, "La categoría es requerida"),
  date: z.string().min(1, "La fecha es requerida"),
  time: z.string().min(1, "La hora es requerida"),
  description: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface TransactionFormProps {
  /** null = modo crear; Transaction = modo editar */
  transaction: Transaction | null;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Devuelve las categorías compatibles con el tipo dado (RN-010) */
function filterCategoriesByType(
  categories: { id: string; name: string; scope: CategoryScope }[],
  type: TransactionType,
) {
  return categories.filter((cat) => {
    if (type === "EXPENSE") return cat.scope === "EXPENSE" || cat.scope === "BOTH";
    return cat.scope === "INCOME" || cat.scope === "BOTH";
  });
}

/** Devuelve fecha y hora actuales en la timezone del navegador */
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

  const isLoading = isEditing ? isUpdating : isCreating;

  // Determinar timezone: al crear = browser; al editar = zona guardada del movimiento
  const timezone = isEditing ? transaction.timezone : getBrowserTimezone();

  // Defaults para el form
  const { date: nowDate, time: nowTime } = getNowLocalDateAndTime();

  const defaultValues: TransactionFormData = isEditing
    ? {
        type: transaction.type,
        amountInput: String(transaction.amountCents / 100).replace(".", ","),
        categoryId: transaction.categoryId,
        date: utcToLocalDate(transaction.occurredAt, transaction.timezone),
        time: utcToLocalTime(transaction.occurredAt, transaction.timezone),
        description: transaction.description ?? "",
      }
    : {
        type: "EXPENSE",
        amountInput: "",
        categoryId: "",
        date: nowDate,
        time: nowTime,
        description: "",
      };

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

  // Sincronizar cuando cambia la transacción (abrir en modo editar)
  useEffect(() => {
    if (isEditing) {
      reset({
        type: transaction.type,
        amountInput: String(transaction.amountCents / 100).replace(".", ","),
        categoryId: transaction.categoryId,
        date: utcToLocalDate(transaction.occurredAt, transaction.timezone),
        time: utcToLocalTime(transaction.occurredAt, transaction.timezone),
        description: transaction.description ?? "",
      });
    }
  }, [transaction, isEditing, reset]);

  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");

  // Categorías disponibles filtradas por tipo
  const availableCategories = filterCategoriesByType(
    (categories ?? []).map((c) => ({ id: c.id, name: c.name, scope: c.scope })),
    selectedType,
  );

  // Si cambia el tipo y la categoría elegida deja de ser compatible → resetear
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
    if (amountCents === null) return; // Zod ya valida esto, pero guardarnos

    const occurredAt = localToUtcIso(data.date, data.time, timezone);

    if (isEditing) {
      const result = await updateTransaction(transaction.id, {
        type: data.type,
        amountCents,
        categoryId: data.categoryId,
        occurredAt,
        timezone,
        description: data.description || undefined,
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
      });

      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar el movimiento.");
        return;
      }

      // Toast con acción "Ir a ver" → /mes?month=YYYY-MM del mes del movimiento
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 px-6 py-5">
      {/* ── Tipo ── */}
      <div className="space-y-1.5">
        <Label htmlFor="tx-type" required>
          Tipo
        </Label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select
              id="tx-type"
              value={field.value}
              onChange={field.onChange}
              error={errors.type?.message}
            >
              <option value="EXPENSE">Gasto</option>
              <option value="INCOME">Ingreso</option>
            </Select>
          )}
        />
      </div>

      {/* ── Monto ── */}
      <div className="space-y-1.5">
        <Label htmlFor="tx-amount" required>
          Monto ($)
        </Label>
        <Input
          id="tx-amount"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          error={errors.amountInput?.message}
          {...register("amountInput")}
        />
        <p className="text-xs text-muted-foreground">Ingresá el monto en pesos (ej: 1500,50)</p>
      </div>

      {/* ── Categoría ── */}
      <div className="space-y-1.5">
        <Label htmlFor="tx-category" required>
          Categoría
        </Label>
        {noCategoriesAvailable ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            No hay categorías disponibles para este tipo de movimiento.{" "}
            <Link
              href="/categorias"
              className="font-semibold underline underline-offset-2 hover:opacity-80"
            >
              Creá una categoría
            </Link>
            .
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tx-date" required>
            Fecha
          </Label>
          <Input
            id="tx-date"
            type="date"
            error={errors.date?.message}
            {...register("date")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tx-time" required>
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
      <div className="space-y-1.5">
        <Label htmlFor="tx-description">Descripción</Label>
        <Input
          id="tx-description"
          type="text"
          placeholder="Opcional"
          error={errors.description?.message}
          {...register("description")}
        />
      </div>

      {/* ── Acciones ── */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isLoading || noCategoriesAvailable}
        >
          {isLoading
            ? isEditing
              ? "Guardando..."
              : "Guardando..."
            : isEditing
              ? "Guardar cambios"
              : "Guardar movimiento"}
        </Button>
      </div>
    </form>
  );
}
