"use client";

/**
 * Fila de un movimiento en la lista del mes (RF-VM-001).
 *
 * Re-estilado con tokens del DS "Precise Ledger" (Fase 3).
 *
 * Layout: grid 40px 1fr auto auto auto
 *   1. Ícono 40×40 tintado (expense-soft/expense-ink o income-soft/income-ink)
 *   2. Texto: nombre + sub-línea (categoría · tipo · [mensual para fijos])
 *   3. Fecha en mono (DD Mmm); en cuotas "Cuota X/N"; fijos: vacío
 *   4. Monto mono 15.5px (gastos con −$, ingresos con +$ en income-ink)
 *   5. KebabMenu de acciones (aparece en hover de la fila)
 *
 * Acciones editar/borrar: via KebabMenu (portal+fixed por overflow-hidden de la tarjeta).
 */

import { type MovementItem } from "@/types/movement";
import { formatCurrency, formatDate } from "@/lib/format";
import { ArrowDown, ArrowUp, Repeat, Pencil, Trash2 } from "lucide-react";
import { KebabMenu } from "@/components/ui/kebab-menu";

interface MovementItemRowProps {
  movement: MovementItem;
  onEdit: (movement: MovementItem) => void;
  onDelete: (movement: MovementItem) => void;
}

export function MovementItemRow({ movement, onEdit, onDelete }: MovementItemRowProps) {
  const isExpense = movement.type === "EXPENSE";
  const isFijo = movement.origin === "fijo";
  const isCuota = movement.origin === "cuota";

  // Fecha formateada "02 Jun" (solo para únicos)
  const dateFormatted =
    !isFijo && !isCuota && movement.occurredAt && movement.timezone
      ? formatDate(movement.occurredAt, movement.timezone)
      : null;

  // Monto: gastos con −$, ingresos con +$
  const amountFormatted = formatCurrency(movement.amountCents);
  const amountDisplay = isExpense ? `−${amountFormatted}` : `+${amountFormatted}`;

  // Ícono y clases de color por tipo
  const IconComponent = isExpense ? ArrowDown : ArrowUp;
  const iconBg = isExpense ? "bg-expense-soft" : "bg-income-soft";
  const iconColor = isExpense ? "text-expense-ink" : "text-income-ink";

  // Sublínea: "Categoría · tipo · [repeat mensual]"
  const typeLabel = isExpense ? "gasto" : "ingreso";
  const categoryName = movement.category.name;

  // Cuota label: "Cuota X/N"
  const installmentLabel =
    isCuota && movement.installment
      ? `Cuota ${movement.installment.number}/${movement.installment.total}`
      : null;

  return (
    <div
      className="group relative grid items-center gap-[14px] px-[18px] cursor-pointer transition-colors duration-[120ms] hover:bg-panel-2 [&+&]:border-t [&+&]:border-hair"
      style={{ gridTemplateColumns: "40px 1fr auto auto auto", padding: `var(--row-pad) 18px` }}
    >
      {/* Col 1: Ícono tintado */}
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${iconBg} ${iconColor}`}
        aria-hidden="true"
      >
        <IconComponent size={19} strokeWidth={2.2} />
      </span>

      {/* Col 2: Nombre + sublínea */}
      <div className="min-w-0">
        <b className="block text-[14.5px] font-semibold tracking-[-0.01em] text-ink leading-snug truncate">
          {movement.description ?? categoryName}
        </b>
        <span className="flex items-center gap-[7px] text-[12.5px] text-muted flex-wrap">
          <span>{categoryName}</span>
          <span
            className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0"
            aria-hidden="true"
          />
          <span>{typeLabel}</span>
          {isFijo && (
            <>
              <span
                className="inline-block h-[3px] w-[3px] rounded-full bg-faint shrink-0"
                aria-hidden="true"
              />
              <span className="inline-flex items-center gap-[4px]">
                <Repeat size={12} className="opacity-60" aria-hidden="true" />
                mensual
              </span>
            </>
          )}
        </span>
      </div>

      {/* Col 3: Fecha / cuota — fijos: vacío */}
      <div className="text-right">
        {!isFijo && (
          <span className="block text-[12.5px] text-muted mono whitespace-nowrap">
            {isCuota ? (installmentLabel ?? "") : (dateFormatted ?? "")}
          </span>
        )}
      </div>

      {/* Col 4: Monto mono */}
      <span
        className={`text-[15.5px] font-semibold text-right min-w-[100px] mono ${
          isExpense ? "text-ink" : "text-income-ink"
        }`}
      >
        {amountDisplay}
      </span>

      {/* Col 5: KebabMenu de acciones (portal+fixed — ver CLAUDE.md) */}
      <KebabMenu
        ariaLabel={`Acciones de ${movement.description ?? categoryName}`}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        items={[
          {
            label: "Editar",
            icon: Pencil,
            onSelect: () => onEdit(movement),
          },
          {
            label: "Eliminar",
            icon: Trash2,
            danger: true,
            onSelect: () => onDelete(movement),
          },
        ]}
      />
    </div>
  );
}
