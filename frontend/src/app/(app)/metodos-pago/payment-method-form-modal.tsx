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
 * - Sección "Predeterminado para" (RF-PM-007; spec visual en docs/design.md,
 *   §"Predeterminado por estructura — configuración en el modal…"): última
 *   sección del form, después del Icon-picker, con los 3 checkboxes de
 *   estructura (Únicos/Fijos/Cuotas). La exclusividad se resuelve AL GUARDAR
 *   (no en vivo por cada tilde): en crear, arrancan destildados y la asignación
 *   se aplica después de crear el método (con el id recién devuelto); en editar,
 *   arrancan reflejando el estado actual.
 */

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { usePreferences } from "@/hooks/use-preferences";
import { ModalShell, ModalShellHeader, ModalShellBody, ModalShellFooter } from "@/components/ui/modal-shell";
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
import {
  DEFAULT_PAYMENT_METHOD_SLOT_ORDER,
  DEFAULT_PAYMENT_METHOD_SLOT_LABELS,
  EMPTY_DEFAULT_PAYMENT_METHOD_SLOTS,
  formatStructureList,
  type DefaultPaymentMethodSlot,
  type DefaultPaymentMethodSlots,
} from "./default-payment-method-slots";

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
  const { toast } = useToast();

  const { paymentMethods, createPaymentMethod, updatePaymentMethod, isCreating, isUpdating } =
    usePaymentMethods();
  const { preferences, setPreferences } = usePreferences();

  // Estado para el prompt de reactivación
  const [reactivable, setReactivable] = useState<{
    id: string;
    name: string;
    type: string;
    icon: string;
  } | null>(null);

  // ─── Sección "Predeterminado para" (RF-PM-007) ─────────────────────────────
  // En editar arranca reflejando el estado actual del método; en crear, los
  // tres arrancan destildados (el método aún no existe/no es default de nada).
  function initialCheckedSlots(): Record<DefaultPaymentMethodSlot, boolean> {
    const defaults = preferences.defaultPaymentMethods ?? EMPTY_DEFAULT_PAYMENT_METHOD_SLOTS;
    return {
      unico: isEditing && defaults.unico === paymentMethod.id,
      fijo: isEditing && defaults.fijo === paymentMethod.id,
      cuota: isEditing && defaults.cuota === paymentMethod.id,
    };
  }
  const [checkedSlots, setCheckedSlots] =
    useState<Record<DefaultPaymentMethodSlot, boolean>>(initialCheckedSlots);
  // Espejo textual del toast de reasignación, para lectores de pantalla
  // (docs/design.md §"Accesibilidad").
  const [announcement, setAnnouncement] = useState("");

  function toggleSlot(slot: DefaultPaymentMethodSlot) {
    setCheckedSlots((prev) => ({ ...prev, [slot]: !prev[slot] }));
  }

  /** "Hoy: {Otro}" — solo cuando el slot lo tiene OTRO método y sigue destildado. */
  function getOtherOwnerName(slot: DefaultPaymentMethodSlot): string | undefined {
    if (checkedSlots[slot]) return undefined;
    const ownerId = (preferences.defaultPaymentMethods ?? EMPTY_DEFAULT_PAYMENT_METHOD_SLOTS)[slot];
    if (!ownerId) return undefined;
    if (isEditing && ownerId === paymentMethod.id) return undefined;
    return paymentMethods?.find((pm) => pm.id === ownerId)?.name;
  }

  /**
   * Aplica la asignación de "Predeterminado para" con exclusividad, AL GUARDAR
   * (no en vivo). Devuelve las estructuras desplazadas de OTRO método, para el
   * toast `info` consolidado.
   */
  async function applyDefaultPaymentMethods(
    methodId: string,
    methodName: string,
  ): Promise<{ success: boolean; error?: string }> {
    const current = preferences.defaultPaymentMethods ?? EMPTY_DEFAULT_PAYMENT_METHOD_SLOTS;
    const next: DefaultPaymentMethodSlots = { ...current };
    const displaced: DefaultPaymentMethodSlot[] = [];
    let changed = false;

    for (const slot of DEFAULT_PAYMENT_METHOD_SLOT_ORDER) {
      if (checkedSlots[slot]) {
        if (current[slot] !== methodId) {
          if (current[slot] !== null) displaced.push(slot);
          next[slot] = methodId;
          changed = true;
        }
      } else if (current[slot] === methodId) {
        next[slot] = null;
        changed = true;
      }
    }

    if (!changed) return { success: true };

    const result = await setPreferences({ ...preferences, defaultPaymentMethods: next });
    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (displaced.length > 0) {
      const structures = formatStructureList(displaced.map((slot) => DEFAULT_PAYMENT_METHOD_SLOT_LABELS[slot]));
      const message = `‘${methodName}’ ahora es el predeterminado de ${structures}.`;
      toast.info(message);
      setAnnouncement(message);
    }

    return { success: true };
  }

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
    setCheckedSlots(initialCheckedSlots());
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
      const defaultsResult = await applyDefaultPaymentMethods(paymentMethod.id, data.name);
      if (!defaultsResult.success) {
        toast.error(defaultsResult.error ?? "No se pudo guardar el predeterminado.");
      }
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
      if (result.paymentMethod) {
        const defaultsResult = await applyDefaultPaymentMethods(result.paymentMethod.id, data.name);
        if (!defaultsResult.success) {
          toast.error(defaultsResult.error ?? "No se pudo guardar el predeterminado.");
        }
      }
      onClose();
    }
  }

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

  return (
    <ModalShell variant="form" onClose={onClose} labelledBy="payment-method-modal-title">
      <ModalShellHeader
        titleId="payment-method-modal-title"
        title={isEditing ? "Editar método de pago" : "Nuevo método de pago"}
        onClose={onClose}
      />

      {/* Formulario */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col flex-1 min-h-0">
        <ModalShellBody>
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

            {/* Predeterminado para — divisor + 3 checkboxes de estructura (RF-PM-007) */}
            <div className="pt-[14px] mt-[2px] border-t border-hair">
              <div className="flex flex-col gap-[2px] mb-[4px]">
                <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
                  Predeterminado para
                </Label>
                <p className="text-[12px] text-muted">
                  Se prellena al crear un movimiento de esta estructura. Podés cambiarlo al
                  cargar.
                </p>
              </div>

              <div>
                {DEFAULT_PAYMENT_METHOD_SLOT_ORDER.map((slot) => {
                  const checked = checkedSlots[slot];
                  const otherOwnerName = getOtherOwnerName(slot);

                  return (
                    <div
                      key={slot}
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={DEFAULT_PAYMENT_METHOD_SLOT_LABELS[slot]}
                      tabIndex={0}
                      onClick={() => toggleSlot(slot)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          toggleSlot(slot);
                        }
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-[9px] py-[7px] px-1 -mx-1 rounded-ctl",
                        "hover:bg-panel-2 transition-colors duration-[140ms]",
                        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
                      )}
                    >
                      {/* Checkbox visual — reuso del checkbox del DS */}
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-[140ms]",
                          checked ? "border-accent bg-accent" : "border-line bg-panel",
                        )}
                        aria-hidden="true"
                      >
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                            <path
                              d="M1 4L3.5 6.5L9 1"
                              stroke="white"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>

                      {/* Label de estructura */}
                      <span className="text-[13px] font-medium text-ink">
                        {DEFAULT_PAYMENT_METHOD_SLOT_LABELS[slot]}
                      </span>

                      {/* Nota de titular actual — solo cuando el slot lo tiene OTRO método */}
                      {otherOwnerName && (
                        <span className="flex-1 truncate text-right text-[12px] text-muted">
                          Hoy: {otherOwnerName}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
        </ModalShellBody>

        {/* Espejo textual del toast de reasignación (accesibilidad) */}
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>

        <ModalShellFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={isLoading}>
            {isLoading
              ? isEditing ? "Guardando..." : "Creando..."
              : isEditing ? "Guardar cambios" : "Crear método de pago"}
          </Button>
        </ModalShellFooter>
      </form>
    </ModalShell>
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
