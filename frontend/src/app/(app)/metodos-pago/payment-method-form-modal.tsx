"use client";

/**
 * Modal de creación y edición de métodos de pago (RF-PM-001 / RF-PM-002).
 *
 * Espejo 1:1 de category-form-modal.tsx en chrome, layout, estados y validaciones
 * (docs/screens.md, pantalla 10). Lo propio de esta feature:
 * - El campo "Tipo" es obligatorio y SIN preselección (a diferencia del scope de
 *   categorías, que arranca en "Ambos").
 * - Campos condicionales según el tipo: Crédito → día de cierre / día de cobro;
 *   Débito → sin campos condicionales (idéntico a Efectivo). "Débito automático"
 *   NO es un campo del método (corrección de alcance P4): es un atributo del
 *   MOVIMIENTO — ver auto-debit-checkbox.tsx en los forms de carga.
 * - Icon-picker en vez de color-picker (RF-PM-004, sin botón "Aleatorio").
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { PaymentMethodIcon } from "@/components/ui/payment-method-icon";
import {
  type PaymentMethod,
  type PaymentMethodType,
  PAYMENT_METHOD_TYPE_OPTIONS,
  PAYMENT_METHOD_ICON_KEYS,
  DEFAULT_PAYMENT_METHOD_ICON,
  normalizePaymentMethodIcon,
} from "@/types/payment-method";
import { ReactivationPrompt } from "./reactivation-prompt";
import { cn } from "@/lib/utils";

// ─── Schema ───────────────────────────────────────────────────────────────────

const dayFieldSchema = z
  .string()
  .optional()
  .refine((val) => !val || (/^\d+$/.test(val) && Number(val) >= 1 && Number(val) <= 31), {
    message: "Debe ser un día entre 1 y 31",
  });

const paymentMethodSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").trim(),
  // Tipado explícito de retorno (`: boolean`) para que TS NO infiera un type
  // predicate acá (TS 5.5+ "inferred type predicates" narrowaría `type` a
  // "CREDIT" | "DEBIT" | "CASH", perdiendo el estado intermedio "" —
  // sin tipo elegido, RF-PM-001 — que necesita el form antes de validar).
  type: z
    .string()
    .refine((val): boolean => val === "CREDIT" || val === "DEBIT" || val === "CASH", {
      message: "Elegí un tipo de método de pago",
    }),
  icon: z.string().min(1, "El ícono es requerido"),
  closingDay: dayFieldSchema,
  paymentDay: dayFieldSchema,
});

type PaymentMethodFormData = z.infer<typeof paymentMethodSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaymentMethodFormModalProps {
  paymentMethod: PaymentMethod | null;
  onClose: () => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function PaymentMethodFormModal({ paymentMethod, onClose }: PaymentMethodFormModalProps) {
  const isEditing = paymentMethod !== null;
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useBodyScrollLock();

  useEffect(() => {
    setMounted(true);
  }, []);

  const { createPaymentMethod, updatePaymentMethod, isCreating, isUpdating } = usePaymentMethods();

  // Estado para el prompt de reactivación
  const [reactivable, setReactivable] = useState<{
    id: string;
    name: string;
    type: string;
    icon: string;
  } | null>(null);

  const defaultValues: PaymentMethodFormData = isEditing
    ? {
        name: paymentMethod.name,
        type: paymentMethod.type,
        icon: normalizePaymentMethodIcon(paymentMethod.icon),
        closingDay: paymentMethod.closingDay !== null ? String(paymentMethod.closingDay) : "",
        paymentDay: paymentMethod.paymentDay !== null ? String(paymentMethod.paymentDay) : "",
      }
    : {
        name: "",
        // Sin preselección — el usuario debe elegir un tipo explícitamente (RF-PM-001).
        type: "",
        icon: DEFAULT_PAYMENT_METHOD_ICON,
        closingDay: "",
        paymentDay: "",
      };

  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<PaymentMethodFormData>({
    resolver: zodResolver(paymentMethodSchema),
    defaultValues,
  });

  // Sincronizar valores cuando cambia el método (al abrir en modo editar)
  useEffect(() => {
    reset(
      isEditing
        ? {
            name: paymentMethod.name,
            type: paymentMethod.type,
            icon: normalizePaymentMethodIcon(paymentMethod.icon),
            closingDay: paymentMethod.closingDay !== null ? String(paymentMethod.closingDay) : "",
            paymentDay: paymentMethod.paymentDay !== null ? String(paymentMethod.paymentDay) : "",
          }
        : {
            name: "",
            type: "",
            icon: DEFAULT_PAYMENT_METHOD_ICON,
            closingDay: "",
            paymentDay: "",
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod?.id, reset]);

  const isLoading = isEditing ? isUpdating : isCreating;
  const selectedType = watch("type");

  async function onSubmit(data: PaymentMethodFormData) {
    const type = data.type as PaymentMethodType;
    const closingDay = data.closingDay ? parseInt(data.closingDay, 10) : undefined;
    const paymentDay = data.paymentDay ? parseInt(data.paymentDay, 10) : undefined;

    const payload = {
      name: data.name,
      type,
      icon: data.icon,
      ...(type === "CREDIT" && closingDay !== undefined ? { closingDay } : {}),
      ...(type === "CREDIT" && paymentDay !== undefined ? { paymentDay } : {}),
    };

    if (isEditing) {
      const result = await updatePaymentMethod(paymentMethod.id, payload);

      if (!result.success) {
        if (result.nameConflict) {
          setError("name", { message: "Ya existe un método de pago activo con ese nombre." });
          return;
        }
        if (result.error) {
          toast.error(result.error);
        }
        return;
      }

      toast.success("Método de pago actualizado correctamente.");
      onClose();
    } else {
      const result = await createPaymentMethod(payload);

      if (!result.success) {
        if (result.reactivable) {
          setReactivable(result.reactivable);
          return;
        }
        if (result.nameConflict) {
          setError("name", { message: "Ya existe un método de pago activo con ese nombre." });
          return;
        }
        if (result.error) {
          toast.error(result.error);
        }
        return;
      }

      toast.success("Método de pago creado correctamente.");
      onClose();
    }
  }

  if (!mounted) return null;

  // Si hay un prompt de reactivación activo, renderizarlo
  if (reactivable) {
    return (
      <ReactivationPrompt
        reactivable={reactivable}
        onCancel={() => setReactivable(null)}
        onReactivated={() => {
          setReactivable(null);
          onClose();
        }}
      />
    );
  }

  return createPortal(
    /* Scrim */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "oklch(0.18 0.02 270 / 0.46)", backdropFilter: "blur(3px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-method-modal-title"
    >
      {/* Diálogo */}
      <div
        className="w-full max-w-[380px] bg-panel border border-line overflow-hidden animate-modal-pop max-h-[calc(100dvh-48px)] flex flex-col"
        style={{ borderRadius: "18px", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-[22px] pt-5 pb-4 shrink-0">
          <h2
            id="payment-method-modal-title"
            className="text-[18px] font-bold tracking-[-0.01em] text-ink m-0"
          >
            {isEditing ? "Editar método de pago" : "Nuevo método de pago"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-ctl text-muted transition-colors duration-[140ms] hover:bg-panel-2 hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto px-[22px] pb-[22px] space-y-[14px]">
            {/* Campo nombre */}
            <div className="flex flex-col gap-[7px]">
              <Label htmlFor="pm-name" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Nombre
              </Label>
              <Input
                id="pm-name"
                type="text"
                placeholder="Ej: Visa Banco Nación"
                error={errors.name?.message}
                {...register("name")}
              />
            </div>

            {/* Tipo picker — obligatorio, sin preselección */}
            <div className="flex flex-col gap-[7px]">
              <Label required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                Tipo
              </Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHOD_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className={cn(
                          "text-[13px] font-semibold cursor-pointer px-2 py-[10px] rounded-ctl border transition-colors duration-[140ms]",
                          field.value === opt.value
                            ? "border-accent bg-accent-soft text-accent-ink"
                            : "border-line bg-panel text-muted hover:text-ink",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              />
              {errors.type && (
                <p className="text-[12px] text-expense-ink">{errors.type.message}</p>
              )}
            </div>

            {/* Campos condicionales por tipo (RN-021) */}
            {selectedType === "CREDIT" && (
              <div className="grid grid-cols-2 gap-[14px]">
                <div className="flex flex-col gap-[7px]">
                  <Label htmlFor="pm-closing-day" className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                    Día de cierre
                  </Label>
                  <Input
                    id="pm-closing-day"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="31"
                    placeholder="Ej: 15"
                    error={errors.closingDay?.message}
                    {...register("closingDay")}
                  />
                </div>
                <div className="flex flex-col gap-[7px]">
                  <Label htmlFor="pm-payment-day" className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                    Día de cobro
                  </Label>
                  <Input
                    id="pm-payment-day"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="31"
                    placeholder="Ej: 10"
                    error={errors.paymentDay?.message}
                    {...register("paymentDay")}
                  />
                </div>
              </div>
            )}

            {/* Icon picker */}
            <Controller
              name="icon"
              control={control}
              render={({ field }) => (
                <IconPicker value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          {/* Footer (pineado — hermano del cuerpo scrolleable, no hijo) */}
          <div className="flex items-center justify-end gap-3 px-[22px] py-4 border-t border-hair bg-panel-2 shrink-0">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading
                ? isEditing ? "Guardando..." : "Creando..."
                : isEditing ? "Guardar cambios" : "Crear método de pago"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ─── IconPicker ─────────────────────────────────────────────────────────────

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

/**
 * Icon-picker — espejo del ColorPicker de categorías, sin botón "Aleatorio"
 * (docs/design.md, §Icon-picker en el modal de método — espejo del color-picker).
 */
function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
        Ícono
      </Label>

      <div
        role="radiogroup"
        aria-label="Seleccionar ícono"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "6px",
        }}
      >
        {PAYMENT_METHOD_ICON_KEYS.map((key) => {
          const isSelected = value === key;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={key}
              onClick={() => onChange(key)}
              style={{
                aspectRatio: "1",
                borderRadius: "var(--r-ctl, 10px)",
                border: isSelected ? "1px solid transparent" : "1px solid var(--line)",
                boxShadow: isSelected
                  ? "0 0 0 2px var(--panel), 0 0 0 4px var(--ink)"
                  : undefined,
                cursor: "pointer",
                position: "relative",
                transition: "transform 0.14s, box-shadow 0.14s, border-color 0.14s",
                zIndex: 0,
              }}
              className={cn(
                "flex items-center justify-center bg-panel-3",
                "hover:scale-[1.12] hover:z-10 hover:border-line-strong hover:shadow-[var(--shadow-sm)]",
                "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
                isSelected && "scale-100",
              )}
            >
              <PaymentMethodIcon
                icon={key}
                size={20}
                className={isSelected ? "text-ink" : "text-ink-2"}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
