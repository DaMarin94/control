"use client";

/**
 * Formulario de movimiento calculado (RF-MCALC-001/002/003/006).
 * Spec visual: docs/design/specs-archive.md §"Movimientos calculados — spec visual (Fase 1.1.7)" secciones 3.x
 *
 * Bloques (de arriba hacia abajo):
 *  1. Origen (read-only)
 *  2. Fórmula (operador + operando con affordance $/%/factor)
 *  3. Signo del resultado (segmented Positivo / Negativo)
 *  4. Resultado derivado (preview read-only: cifra + badge de tipo derivado)
 *  5. Categoría (selector con + Nueva)
 *  6. Descripción (opcional)
 *
 * Sin bloque "Tipo" — el tipo se deriva del signo del monto final (RF-MCALC-003):
 *   final < 0 → Gasto (EXPENSE); final > 0 → Ingreso (INCOME); final == 0 → Gasto.
 * Sin bloque "Monto" (el monto se deriva — RF-MCALC-001/RN-017).
 * Sin bloque "Mes de inicio" ni "Frecuencia" (heredados del origen).
 */

import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Repeat,
  Receipt,
  CreditCard,
  Info,
  AlertTriangle,
  Check,
  Plus,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCategories } from "@/hooks/use-categories";
import { useCalculated } from "@/hooks/use-calculated";
import { useSettings } from "@/hooks/use-settings";
import { useActiveLimitProjection } from "@/hooks/use-active-limit-projection";
import { useToast } from "@/hooks/use-toast";
import { CategoryFormModal } from "@/app/(app)/categorias/category-form-modal";
import { type Category, type CategoryScope } from "@/types/category";
import { type TransactionType } from "@/types/transaction";
import type { FormulaOperator, MovementItem } from "@/types/movement";
import type { RecurringFrequency } from "@/types/recurring";
import { ActiveLimitDialog } from "@/components/limits/active-limit-dialog";
import { toCanonicalAmountCents, type ProjectionSection } from "@/lib/limits/project";
import type { LimitConfig } from "@/types/limit";
import { formatCurrency, getCurrentMonth } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/logger";

/** Etiqueta en minúscula por valor de frecuencia (para la caja de origen fijo) */
const FREQUENCY_LABEL_LOWER: Record<RecurringFrequency, string> = {
  MONTHLY: "mensual",
  BIMONTHLY: "bimestral",
  QUARTERLY: "trimestral",
  BIANNUAL: "semestral",
  ANNUAL: "anual",
};

/** Etiqueta de tipo de origen para la caja de origen read-only */
function getOriginTypeLabel(origin: "fijo" | "unico" | "cuota"): string {
  switch (origin) {
    case "fijo": return "fijo";
    case "unico": return "único";
    case "cuota": return "cuota";
  }
}

const logger = createLogger("CalculatedForm");

// ─── Tipos de operador (UI) ──────────────────────────────────────────────────

interface OperatorOption {
  value: FormulaOperator;
  /** Símbolo visual en el segmented (glifo Unicode) */
  glyph: string;
  /** Etiqueta aria */
  label: string;
}

const OPERATOR_OPTIONS: OperatorOption[] = [
  { value: "ADD", glyph: "+", label: "Suma" },
  { value: "SUB", glyph: "−", label: "Resta" },
  { value: "MUL", glyph: "×", label: "Multiplicación" },
  { value: "DIV", glyph: "÷", label: "División" },
  { value: "PCT", glyph: "%", label: "Porcentaje" },
];

// ─── Escala del operando (CRÍTICO) ────────────────────────────────────────────

/**
 * Convierte el operando ingresado por el usuario (float, ej "10", "1.5") al
 * entero escalado que espera el backend, según el operador.
 *
 * ADD/SUB: centavos → userInput * 100 (el operando es un monto en pesos)
 * MUL/DIV: factor × 1.000.000 → userInput * 1_000_000
 * PCT: porcentaje × 100 → userInput * 100
 */
function scaleOperand(value: number, operator: FormulaOperator): number {
  switch (operator) {
    case "ADD":
    case "SUB":
      return Math.round(value * 100);
    case "MUL":
    case "DIV":
      return Math.round(value * 1_000_000);
    case "PCT":
      return Math.round(value * 100);
  }
}

/**
 * Desescala el operando almacenado (entero del backend) al float de usuario.
 * Inverso de scaleOperand.
 */
function descaleOperand(scaled: number, operator: FormulaOperator): number {
  switch (operator) {
    case "ADD":
    case "SUB":
      return scaled / 100;
    case "MUL":
    case "DIV":
      return scaled / 1_000_000;
    case "PCT":
      return scaled / 100;
  }
}

// ─── Preview del resultado ────────────────────────────────────────────────────

/**
 * Calcula el resultado derivado en centavos dada la fórmula y el monto del origen.
 * Retorna null si el operando es inválido (0 con DIV/PCT).
 *
 * formulaSign × round(operator(originCents, descaledOperand))
 */
function computePreview(
  originCents: number,
  operator: FormulaOperator,
  userOperand: number,
  sign: 1 | -1,
): number | null {
  if ((operator === "DIV" || operator === "PCT") && userOperand === 0) {
    return null;
  }

  let raw: number;
  switch (operator) {
    case "ADD":
      raw = originCents + userOperand * 100;
      break;
    case "SUB":
      raw = originCents - userOperand * 100;
      break;
    case "MUL":
      raw = originCents * userOperand;
      break;
    case "DIV":
      raw = originCents / userOperand;
      break;
    case "PCT":
      raw = (originCents * userOperand) / 100;
      break;
  }

  return sign * Math.round(raw);
}

/**
 * Deriva el tipo del monto final (RF-MCALC-003 / RN-018):
 *   final > 0  → INCOME (Ingreso)
 *   final <= 0 → EXPENSE (Gasto; cero → EXPENSE por convención de borde)
 */
function derivedTypeFromCents(cents: number | null): TransactionType {
  if (cents === null) return "EXPENSE";
  if (cents > 0) return "INCOME";
  return "EXPENSE"; // 0 y negativo → EXPENSE (RN-018)
}

// ─── Helpers de categoría ─────────────────────────────────────────────────────

function filterCategoriesByType(
  categories: { id: string; name: string; scope: CategoryScope }[],
  type: TransactionType,
) {
  return categories.filter((cat) => {
    if (type === "EXPENSE") return cat.scope === "EXPENSE" || cat.scope === "BOTH";
    return cat.scope === "INCOME" || cat.scope === "BOTH";
  });
}

// ─── Schema Zod ───────────────────────────────────────────────────────────────

const calculatedSchema = z.object({
  operator: z.enum(["ADD", "SUB", "MUL", "DIV", "PCT"]),
  /** Operando ingresado por el usuario como string (acepta punto o coma) */
  operandInput: z
    .string()
    .min(1, "Ingresá un operando.")
    .refine((val) => {
      const normalized = val.trim().replace(",", ".");
      return !isNaN(parseFloat(normalized));
    }, "Ingresá un número válido."),
  /** Signo del resultado: "1" o "-1" (convertido a number al enviar) */
  sign: z.enum(["1", "-1"]),
  categoryId: z.string().min(1, "La categoría es requerida"),
  description: z.string().optional(),
});

type CalculatedFormData = z.infer<typeof calculatedSchema>;

/** Datos ya validados/parseados, pendientes de persistir tras "Guardar igual" (P2 — Fase 2). */
interface PendingSave {
  data: CalculatedFormData;
  scaledOperand: number;
  sign: 1 | -1;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CalculatedFormProps {
  /**
   * Modo "crear": el ítem de origen desde el que se dispara.
   * Modo "editar": el ítem calculado que se edita.
   */
  mode: "create" | "edit";
  /**
   * En modo "crear": el ítem fijo de origen (desde el que se crea el calculado).
   * En modo "editar": el ítem calculado que se está editando.
   */
  movement: MovementItem;
  onClose: () => void;
  /** Mes que se está visualizando (para el split del backend y para el preview) */
  viewMonth?: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function CalculatedForm({ mode, movement, onClose, viewMonth }: CalculatedFormProps) {
  const isEditing = mode === "edit";
  const { toast } = useToast();
  const { categories } = useCategories();
  const { createCalculated, updateCalculated, isCreating, isUpdating } = useCalculated();
  const { defaultCurrency } = useSettings();
  // Moneda del movimiento de origen: en crear = la del ítem origen; en editar = la del calculado (heredada del origen)
  const movementCurrency = movement.currency;
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // P2 — Fase 2 (extensión a calculado): intercepción de límites activos al guardar (D11).
  const [crossedLimits, setCrossedLimits] = useState<LimitConfig[] | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);

  const isLoading = isEditing ? isUpdating : isCreating;

  // ── Datos del origen para el form ─────────────────────────────────────────

  // En crear: movement ES el origen (fijo, único o cuota padre).
  // En editar: movement ES el calculado (tiene .calculated con los datos de la fórmula).
  const calc = movement.calculated;

  // Tipo de origen:
  // - En crear: el origin del movement (el item de origen pasado).
  // - En editar: el sourceType del calculado.
  const sourceType: "fijo" | "unico" | "cuota" = isEditing
    ? (calc?.sourceType ?? "fijo")
    : (movement.origin as "fijo" | "unico" | "cuota");

  // P2 — Fase 2 (extensión a calculado): mes de proyección de límites activos
  // (D13), mismo criterio ya aplicado por tipo en los otros 3 forms. Un
  // calculado de único imputa a su propio mes — como el único solo puede
  // existir en un mes (data-model.md §Contrato de movimientos calculados), ese
  // mes ES `viewMonth` (el mes visualizado en el que vive el ítem, en crear y
  // en editar). Un calculado de fijo o cuota recurre como su origen → mes en
  // curso real, igual que RecurringForm/InstallmentForm.
  const projectionMonth =
    sourceType === "unico" ? (viewMonth ?? getCurrentMonth()) : getCurrentMonth();
  const { evaluate: evaluateActiveLimits } = useActiveLimitProjection(projectionMonth);

  // Sección de /mes a la que pertenece este calculado (D14) — mapeo directo
  // del sourceType (el backend emite el ítem con `origin` = tipo del origen).
  const projectionSection: ProjectionSection =
    sourceType === "fijo" ? "fijos" : sourceType === "cuota" ? "cuotas" : "unicos";

  // Nombre descriptivo del origen
  const originName = isEditing
    ? (calc?.sourceDescription ?? "Origen")
    : (movement.description ?? movement.category.name);

  // Monto del origen para el preview.
  // En crear: el amountCents del ítem origen.
  // En editar: el backend expone calculated.sourceAmountCents.
  // Si no está disponible (null/ausente), el preview muestra "—".
  const originCents: number | null = isEditing
    ? (calc?.sourceAmountCents ?? null)
    : movement.amountCents;

  // ── Valores iniciales del form ─────────────────────────────────────────────

  const defaultValues: CalculatedFormData = isEditing && calc
    ? {
        operator: calc.formulaOperator,
        operandInput: String(descaleOperand(calc.formulaOperand, calc.formulaOperator)).replace(".", ","),
        sign: String(calc.formulaSign) as "1" | "-1",
        categoryId: movement.category.id,
        description: movement.description ?? "",
      }
    : {
        operator: "PCT",
        operandInput: "",
        sign: "1",
        categoryId: "",
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
  } = useForm<CalculatedFormData>({
    resolver: zodResolver(calculatedSchema),
    defaultValues,
  });

  useEffect(() => {
    if (isEditing && calc) {
      reset({
        operator: calc.formulaOperator,
        operandInput: String(descaleOperand(calc.formulaOperand, calc.formulaOperator)).replace(".", ","),
        sign: String(calc.formulaSign) as "1" | "-1",
        categoryId: movement.category.id,
        description: movement.description ?? "",
      });
    }
  }, [movement, isEditing, calc, reset]);

  const selectedOperator = watch("operator");
  const operandInput = watch("operandInput");
  const selectedSign = watch("sign");
  const selectedCategoryId = watch("categoryId");

  // ── Preview en vivo ────────────────────────────────────────────────────────

  const userOperand = useMemo(() => {
    const normalized = operandInput.trim().replace(",", ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  }, [operandInput]);

  const previewCents = useMemo(() => {
    if (originCents === null || userOperand === null) return null;
    return computePreview(originCents, selectedOperator, userOperand, selectedSign === "1" ? 1 : -1);
  }, [originCents, selectedOperator, userOperand, selectedSign]);

  // Tipo derivado en vivo del monto final (RF-MCALC-003)
  const derivedMovementType = derivedTypeFromCents(previewCents);

  // Error de operando 0 con DIV/PCT (RN-017)
  const isZeroDivError =
    (selectedOperator === "DIV" || selectedOperator === "PCT") &&
    userOperand === 0;

  // ── Categorías disponibles (filtradas por tipo derivado) ──────────────────

  const availableCategories = filterCategoriesByType(
    (categories ?? []).map((c) => ({ id: c.id, name: c.name, scope: c.scope })),
    derivedMovementType,
  );

  useEffect(() => {
    if (!isEditing && selectedCategoryId && categories) {
      const isCompatible = availableCategories.some((c) => c.id === selectedCategoryId);
      if (!isCompatible) {
        setValue("categoryId", "");
      }
    }
  }, [isEditing, derivedMovementType, categories, selectedCategoryId, availableCategories, setValue]);

  const noCategoriesAvailable = availableCategories.length === 0;

  // ── Affordance del input de operando ─────────────────────────────────────

  const isMoneyOperand = selectedOperator === "ADD" || selectedOperator === "SUB";
  const isPctOperand = selectedOperator === "PCT";

  function getOperandPlaceholder(): string {
    if (isMoneyOperand) return "5.000";
    if (isPctOperand) return "10";
    return "1,5";
  }

  // ── Expresión legible para el preview ─────────────────────────────────────

  function buildExpression(): string {
    if (userOperand === null) return "—";
    // Los montos del origen y del operando ADD/SUB van en la moneda del movimiento de origen
    const originFmt = originCents !== null ? formatCurrency(originCents, movementCurrency) : "origen";
    switch (selectedOperator) {
      case "ADD": return `${originFmt} + ${formatCurrency(userOperand * 100, movementCurrency)}`;
      case "SUB": return `${originFmt} − ${formatCurrency(userOperand * 100, movementCurrency)}`;
      case "MUL": return `${originFmt} × ${String(userOperand).replace(".", ",")}`;
      case "DIV": return `${originFmt} ÷ ${String(userOperand).replace(".", ",")}`;
      case "PCT": return `${String(userOperand).replace(".", ",")}% de ${originFmt}`;
    }
  }

  // ── Formato del resultado para el preview ─────────────────────────────────
  // El resultado derivado va en la misma moneda que el origen (heredada del calculado)

  function formatPreviewAmount(cents: number | null): string {
    if (cents === null) return "—";
    if (cents === 0) return formatCurrency(0, movementCurrency);
    if (cents < 0) return `−${formatCurrency(Math.abs(cents), movementCurrency)}`;
    return formatCurrency(cents, movementCurrency);
  }

  // ── Color de la cifra del preview (por tipo derivado, no por signo) ───────

  const previewAmountClass =
    derivedMovementType === "EXPENSE" ? "text-ink" : "text-income-ink";

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function persist({ data, scaledOperand, sign }: PendingSave) {
    if (isEditing) {
      // En edición el id del movimiento calculado + el sourceType del calculado
      const result = await updateCalculated(
        movement.id,
        {
          currentMonth: viewMonth ?? getCurrentMonth(),
          categoryId: data.categoryId,
          description: data.description || null,
          formulaOperator: data.operator,
          formulaOperand: scaledOperand,
          formulaSign: sign,
        },
        sourceType,
      );

      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar el movimiento.");
        return;
      }

      toast.success("Movimiento calculado actualizado.");
      onClose();
    } else {
      // sourceId: en crear, movement ES el origen → su id
      // Solo para fijos se incluye startMonth en el body (contrato Fase 1.1.8)
      const createData =
        sourceType === "fijo"
          ? {
              categoryId: data.categoryId,
              startMonth: viewMonth ?? getCurrentMonth(),
              formulaOperator: data.operator,
              formulaOperand: scaledOperand,
              formulaSign: sign,
              description: data.description || undefined,
            }
          : {
              categoryId: data.categoryId,
              formulaOperator: data.operator,
              formulaOperand: scaledOperand,
              formulaSign: sign,
              description: data.description || undefined,
            };

      const result = await createCalculated(movement.id, createData, sourceType);

      if (!result.success) {
        toast.error(result.error ?? "No se pudo guardar el movimiento.");
        return;
      }

      toast.success("Movimiento calculado creado correctamente.");
      onClose();
    }
  }

  async function onSubmit(data: CalculatedFormData) {
    const normalized = data.operandInput.trim().replace(",", ".");
    const userOpFloat = parseFloat(normalized);
    if (isNaN(userOpFloat)) return;

    const scaledOperand = scaleOperand(userOpFloat, data.operator);
    const sign: 1 | -1 = data.sign === "1" ? 1 : -1;
    const pending: PendingSave = { data, scaledOperand, sign };

    // P2 — Fase 2 (extensión a calculado): compuerta de intercepción (D11).
    // Proyecta sobre el monto/tipo EFECTIVOS que se van a persistir — el
    // resultado derivado de la fórmula (RF-MCALC-003), no el monto del origen.
    // Si el origen todavía no resolvió (originCents===null) no hay nada que
    // proyectar client-side: se persiste directo, igual que antes de P2
    // (cero fricción / falla abierto, mismo criterio que el hook de proyección).
    const finalCents =
      originCents !== null
        ? computePreview(originCents, data.operator, userOpFloat, sign)
        : null;

    if (finalCents !== null) {
      const canonicalAmountCents = toCanonicalAmountCents(
        Math.abs(finalCents),
        movementCurrency,
        defaultCurrency,
        movement.exchangeRate,
      );
      const crossed = evaluateActiveLimits({
        type: derivedTypeFromCents(finalCents),
        convertedAmountCents: canonicalAmountCents,
        categoryId: data.categoryId,
        section: projectionSection,
        skipped: isEditing ? movement.skipped : false,
        editingId: isEditing ? movement.id : undefined,
      });

      if (crossed.length > 0) {
        setCrossedLimits(crossed);
        setPendingSave(pending);
        return;
      }
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit, (errs) => {
          logger.warn("Validación del form de calculado falló", { errs });
        })}
        noValidate
      >
        <div className="px-[22px] pb-[22px] space-y-[14px]">

          {/* ── 1. Origen (read-only) ── */}
          <div className="flex flex-col gap-[7px]">
            <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Origen
            </Label>
            <div className="flex items-center gap-2 rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px]">
              {/* Ícono de tipo de origen: Repeat solo para fijos (Fase 1.1.8) */}
              {sourceType === "fijo" && (
                <Repeat size={15} className="text-accent-ink shrink-0" aria-hidden="true" />
              )}
              {sourceType === "unico" && (
                <Receipt size={15} className="text-accent-ink shrink-0" aria-hidden="true" />
              )}
              {sourceType === "cuota" && (
                <CreditCard size={15} className="text-accent-ink shrink-0" aria-hidden="true" />
              )}
              <span className="text-[14px] font-semibold text-ink-2 flex-1 min-w-0 truncate">
                {originName}
              </span>
              <span className="text-[12.5px] text-muted shrink-0 whitespace-nowrap">
                {movement.type === "EXPENSE" ? "gasto" : "ingreso"}
                {" · "}
                {sourceType === "fijo"
                  ? (movement.frequency
                      ? (FREQUENCY_LABEL_LOWER[movement.frequency] ?? "mensual")
                      : "mensual")
                  : getOriginTypeLabel(sourceType)}
              </span>
              {originCents !== null && (
                <span className="text-[12.5px] text-muted mono shrink-0 ml-2">
                  {formatCurrency(originCents, movementCurrency)}
                </span>
              )}
            </div>
            {/* Nota orientativa (solo en crear) */}
            {!isEditing && (
              <div className="flex items-center gap-[7px] pt-[2px] text-[12.5px] text-muted">
                <Info size={14} className="text-accent-ink shrink-0" aria-hidden="true" />
                El monto se calcula a partir de este movimiento.
              </div>
            )}
          </div>

          {/* ── 2. Fórmula: Operador (segmented) + Operando (input) ── */}
          <div className="flex flex-col gap-[7px]">
            <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]" required>
              Fórmula
            </Label>
            <div className="flex items-center gap-[8px] min-w-0">
              {/* Chip "Origen" — prefijo contextual */}
              <span
                className="inline-flex items-center rounded-[var(--r-chip)] bg-panel-3 text-muted px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em] shrink-0 whitespace-nowrap"
                aria-hidden="true"
              >
                Origen
              </span>

              {/* Segmented de operador (5 opciones) */}
              <Controller
                name="operator"
                control={control}
                render={({ field }) => (
                  <div
                    className="flex gap-1 p-1 rounded-ctl bg-panel-3 shrink-0"
                    role="group"
                    aria-label="Operador de la fórmula"
                  >
                    {OPERATOR_OPTIONS.map((op) => (
                      <button
                        key={op.value}
                        type="button"
                        aria-label={op.label}
                        aria-pressed={field.value === op.value}
                        onClick={() => field.onChange(op.value)}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-[7px] text-[15px] font-semibold mono",
                          "transition-colors duration-[140ms] cursor-pointer",
                          "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
                          field.value === op.value
                            ? "bg-panel text-ink shadow-[var(--shadow-sm)]"
                            : "text-ink-2 hover:text-ink",
                        )}
                      >
                        {op.glyph}
                      </button>
                    ))}
                  </div>
                )}
              />

              {/* Input de operando */}
              <div
                className={cn(
                  "flex flex-1 min-w-0 items-center gap-1 rounded-ctl border-[1.5px] px-[13px] py-[9px] transition-colors duration-[140ms]",
                  "focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-soft)]",
                  isZeroDivError || errors.operandInput
                    ? "border-expense shadow-[0_0_0_3px_var(--expense-soft)]"
                    : "border-line-strong bg-panel",
                )}
              >
                {/* Prefijo $ para ADD/SUB */}
                {isMoneyOperand && (
                  <span className="text-[14px] text-muted mono shrink-0">$</span>
                )}
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={getOperandPlaceholder()}
                  className="flex-1 min-w-0 w-0 border-none outline-none bg-transparent mono text-[14px] font-semibold text-ink text-right placeholder:text-faint"
                  {...register("operandInput")}
                />
                {/* Sufijo % para PCT */}
                {isPctOperand && (
                  <span className="text-[14px] text-muted mono shrink-0">%</span>
                )}
              </div>
            </div>

            {/* Error de operando */}
            {isZeroDivError && (
              <p className="text-[12px] text-expense-ink">
                {selectedOperator === "DIV"
                  ? "No se puede dividir por cero."
                  : "El porcentaje no puede ser 0."}
              </p>
            )}
            {!isZeroDivError && errors.operandInput && (
              <p className="text-[12px] text-expense-ink">{errors.operandInput.message}</p>
            )}
          </div>

          {/* ── 3. Signo del resultado (segmented Positivo / Negativo) ── */}
          <div className="flex flex-col gap-[7px]">
            <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]" required>
              Signo del resultado
            </Label>
            <Controller
              name="sign"
              control={control}
              render={({ field }) => (
                <div
                  className="flex gap-1 p-1 rounded-ctl bg-panel-3"
                  role="group"
                  aria-label="Signo del resultado"
                >
                  <button
                    type="button"
                    aria-pressed={field.value === "1"}
                    onClick={() => field.onChange("1")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-3 py-[9px] text-[13.5px] font-semibold",
                      "transition-colors duration-[140ms] cursor-pointer",
                      "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
                      field.value === "1"
                        ? "bg-panel text-ink shadow-[var(--shadow-sm)]"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    <Plus size={14} aria-hidden="true" />
                    Positivo
                  </button>
                  <button
                    type="button"
                    aria-pressed={field.value === "-1"}
                    onClick={() => field.onChange("-1")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-3 py-[9px] text-[13.5px] font-semibold",
                      "transition-colors duration-[140ms] cursor-pointer",
                      "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]",
                      field.value === "-1"
                        ? "bg-panel text-ink shadow-[var(--shadow-sm)]"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    <Minus size={14} aria-hidden="true" />
                    Negativo
                  </button>
                </div>
              )}
            />
            {/* Nota aclaratoria (spec 3.3) */}
            <p className="text-[12px] text-muted leading-snug">
              El signo define el tipo: positivo = ingreso, negativo = gasto.
            </p>
          </div>

          {/* ── 4. Resultado derivado (preview read-only) ── */}
          <div className="flex flex-col gap-[7px]">
            <Label className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Resultado
            </Label>
            <div className="flex items-center justify-between rounded-ctl border border-line bg-panel-2 px-[13px] py-[11px] gap-3">
              {/* Expresión legible */}
              <span className="text-[12.5px] text-muted mono truncate">
                {isZeroDivError ? "Operando inválido" : buildExpression()}
              </span>
              {/* Columna derecha: cifra + badge de tipo derivado */}
              {isZeroDivError ? (
                <span className="text-[12.5px] text-expense-ink font-semibold mono shrink-0">
                  Operando inválido
                </span>
              ) : originCents === null ? (
                <span className="text-[12.5px] text-muted mono shrink-0">—</span>
              ) : (
                <div className="flex flex-col items-end gap-[5px] shrink-0">
                  {/* Cifra grande (16-18px, color por tipo derivado) */}
                  <span
                    className={cn(
                      "text-[16px] font-semibold mono",
                      previewAmountClass,
                    )}
                  >
                    {formatPreviewAmount(previewCents)}
                  </span>
                  {/* Badge de tipo derivado — tintado por tipo (spec 3.4) */}
                  {derivedMovementType === "EXPENSE" ? (
                    <span
                      className="inline-flex items-center gap-[3px] rounded-[var(--r-chip)] bg-expense-soft text-expense-ink px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em]"
                      aria-label="Tipo derivado: Gasto"
                    >
                      <ArrowDownRight size={11} aria-hidden="true" />
                      Gasto
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-[3px] rounded-[var(--r-chip)] bg-income-soft text-income-ink px-[7px] py-[1px] text-[11px] font-semibold tracking-[0.04em]"
                      aria-label="Tipo derivado: Ingreso"
                    >
                      <ArrowUpRight size={11} aria-hidden="true" />
                      Ingreso
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── 5. Categoría ── */}
          <div className="flex flex-col gap-[7px]">
            <div className="flex items-center justify-between">
              <Label htmlFor="calc-category" required className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
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
                    id="calc-category"
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

          {/* ── 6. Descripción (opcional) ── */}
          <div className="flex flex-col gap-[7px]">
            <Label htmlFor="calc-description" className="text-[12.5px] font-semibold text-ink-2 tracking-[0.01em]">
              Descripción{" "}
              <span className="text-faint font-normal">(opcional)</span>
            </Label>
            <Input
              id="calc-description"
              type="text"
              placeholder="Ej: Ahorro automático"
              error={errors.description?.message}
              {...register("description")}
            />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-[22px] py-4 border-t border-hair bg-panel-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || noCategoriesAvailable || isZeroDivError}
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
      </form>

      {/* Modal inline de nueva categoría */}
      {showCategoryModal && (
        <CategoryFormModal
          category={null}
          lockScopeToType={derivedMovementType}
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
