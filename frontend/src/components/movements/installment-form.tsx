"use client";

/**
 * Formulario de movimiento en cuotas (RF-MC-001 / RF-MC-003).
 *
 * Modo crear: campos con defaults (type=EXPENSE fijo, mes=mes actual).
 * Modo editar: campos precargados; type NO se muestra (siempre EXPENSE, RF-MC-001).
 *
 * Reglas de negocio:
 * - Cuotas son SOLO Gasto en v1 — no hay selector de tipo (decisión cerrada).
 * - Monto POR CUOTA en pesos, convertido a centavos al enviar (parseCurrencyInput).
 * - Cantidad de cuotas: entero > 0 (Zod int positivo).
 * - Mes de inicio: <input type="month">, default getCurrentMonth(), editable.
 * - Categorías filtradas por scope EXPENSE/BOTH (siempre EXPENSE → RN-010).
 * - Sin categorías disponibles → bloqueo con enlace a /categorias.
 * - Al crear OK: modal cerrado + toast "Movimiento guardado correctamente." con
 *   acción "Ir a ver" → /mes?month=startMonth (RF-MC-001).
 * - Al editar OK: modal cerrado + toast "Movimiento actualizado correctamente." (sin acción).
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
import { useInstallments } from "@/hooks/use-installments";
import { useToast } from "@/hooks/use-toast";
import { type CategoryScope } from "@/types/category";
import { type InstallmentGroup } from "@/types/installment";
import { parseCurrencyInput, getCurrentMonth } from "@/lib/format";
import { useRouter } from "next/navigation";

// ─── Schema ───────────────────────────────────────────────────────────────────

const installmentSchema = z.object({
  amountInput: z
    .string()
    .min(1, "El monto es requerido")
    .refine((val) => parseCurrencyInput(val) !== null, {
      message: "Ingresá un monto mayor a 0",
    }),
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
  description: z.string().optional(),
});

type InstallmentFormData = z.infer<typeof installmentSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface InstallmentFormProps {
  /**
   * null = modo crear.
   * InstallmentGroup = modo editar (type no se muestra, siempre EXPENSE).
   */
  installment: InstallmentGroup | null;
  onClose: () => void;
  /**
   * Mes contexto (YYYY-MM) desde la Vista del mes.
   * Solo aplica en modo crear; en modo editar se ignora.
   * Si no se pasa, el default es el mes actual del navegador.
   */
  defaultMonth?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Devuelve las categorías compatibles con EXPENSE (RN-010) */
function filterCategoriesForExpense(
  categories: { id: string; name: string; scope: CategoryScope }[],
) {
  return categories.filter((cat) => cat.scope === "EXPENSE" || cat.scope === "BOTH");
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function InstallmentForm({ installment, onClose, defaultMonth }: InstallmentFormProps) {
  const isEditing = installment !== null;
  const router = useRouter();
  const { toast } = useToast();
  const { categories } = useCategories();
  const { createInstallment, updateInstallment, isCreating, isUpdating } = useInstallments();

  const isLoading = isEditing ? isUpdating : isCreating;

  const defaultValues: InstallmentFormData = isEditing
    ? {
        amountInput: String(installment.amountCents / 100).replace(".", ","),
        totalInstallments: String(installment.totalInstallments),
        startMonth: installment.startMonth,
        categoryId: installment.categoryId,
        description: installment.description ?? "",
      }
    : {
        amountInput: "",
        totalInstallments: "",
        startMonth: defaultMonth ?? getCurrentMonth(),
        categoryId: "",
        description: "",
      };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<InstallmentFormData>({
    resolver: zodResolver(installmentSchema),
    defaultValues,
  });

  // Sincronizar cuando cambia el grupo (abrir en modo editar)
  useEffect(() => {
    if (isEditing) {
      reset({
        amountInput: String(installment.amountCents / 100).replace(".", ","),
        totalInstallments: String(installment.totalInstallments),
        startMonth: installment.startMonth,
        categoryId: installment.categoryId,
        description: installment.description ?? "",
      });
    }
  }, [installment, isEditing, reset]);

  // Categorías disponibles — siempre EXPENSE (cuotas son solo Gasto en v1)
  const availableCategories = filterCategoriesForExpense(
    (categories ?? []).map((c) => ({ id: c.id, name: c.name, scope: c.scope })),
  );

  const noCategoriesAvailable = availableCategories.length === 0;

  async function onSubmit(data: InstallmentFormData) {
    const amountCents = parseCurrencyInput(data.amountInput);
    if (amountCents === null) return; // Zod ya valida esto

    const totalInstallments = parseInt(data.totalInstallments, 10);

    if (isEditing) {
      const result = await updateInstallment(installment.id, {
        amountCents,
        totalInstallments,
        startMonth: data.startMonth,
        categoryId: data.categoryId,
        description: data.description || null,
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
      });

      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar el movimiento.");
        return;
      }

      // Toast con acción "Ir a ver" → /mes?month=startMonth (RF-MC-001)
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 px-6 py-5">
      {/* ── Tipo (read-only, siempre Gasto) ── */}
      <div className="space-y-1.5">
        <Label htmlFor="inst-type">Tipo</Label>
        <Input
          id="inst-type"
          type="text"
          value="Gasto"
          disabled
          className="bg-muted/50 text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">
          Los movimientos en cuotas son siempre de tipo Gasto en esta versión.
        </p>
      </div>

      {/* ── Monto por cuota ── */}
      <div className="space-y-1.5">
        <Label htmlFor="inst-amount" required>
          Monto por cuota ($)
        </Label>
        <Input
          id="inst-amount"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          error={errors.amountInput?.message}
          {...register("amountInput")}
        />
        <p className="text-xs text-muted-foreground">
          Ingresá el monto de cada cuota en pesos, no el total de la compra (ej: 1500,00)
        </p>
      </div>

      {/* ── Cantidad de cuotas ── */}
      <div className="space-y-1.5">
        <Label htmlFor="inst-total" required>
          Cantidad de cuotas
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
        <p className="text-xs text-muted-foreground">
          Entero mayor a 0 (ej: 12 para cuotas en 12 meses)
        </p>
      </div>

      {/* ── Mes de inicio ── */}
      <div className="space-y-1.5">
        <Label htmlFor="inst-start-month" required>
          Mes de inicio
        </Label>
        <Input
          id="inst-start-month"
          type="month"
          error={errors.startMonth?.message}
          {...register("startMonth")}
        />
        <p className="text-xs text-muted-foreground">
          Mes a partir del cual se empieza a descontar la primera cuota
        </p>
      </div>

      {/* ── Categoría ── */}
      <div className="space-y-1.5">
        <Label htmlFor="inst-category" required>
          Categoría
        </Label>
        {noCategoriesAvailable ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            No hay categorías disponibles para Gasto.{" "}
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
      <div className="space-y-1.5">
        <Label htmlFor="inst-description">Descripción</Label>
        <Input
          id="inst-description"
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
        <Button type="submit" disabled={isLoading || noCategoriesAvailable}>
          {isLoading
            ? "Guardando..."
            : isEditing
              ? "Guardar cambios"
              : "Guardar movimiento"}
        </Button>
      </div>
    </form>
  );
}
